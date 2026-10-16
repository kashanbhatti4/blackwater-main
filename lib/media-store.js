// Uploaded images are also kept in the database (media_files), because a deploy that replaces
// the project folder deletes public/uploads. The server serves from disk when it can and
// falls back to this copy (restoring the file on disk) when the file has gone.

import { query } from './db.js';

let tableReady = null;

function ensureTable() {
    if (!tableReady) {
        tableReady = query(`
            CREATE TABLE IF NOT EXISTS media_files (
                filename VARCHAR(191) PRIMARY KEY,
                mime_type VARCHAR(100) NOT NULL,
                size INT UNSIGNED NOT NULL,
                data LONGBLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `).catch(error => {
            tableReady = null;
            throw error;
        });
    }
    return tableReady;
}

export async function saveMedia(filename, mimeType, buffer) {
    await ensureTable();
    await query(
        `INSERT INTO media_files (filename, mime_type, size, data) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size = VALUES(size), data = VALUES(data)`,
        [filename, mimeType, buffer.length, buffer]
    );
}

export async function loadMedia(filename) {
    await ensureTable();
    const rows = await query('SELECT mime_type, size, data FROM media_files WHERE filename = ? LIMIT 1', [filename]);
    return rows[0] || null;
}

export async function deleteMedia(filename) {
    try {
        await ensureTable();
        await query('DELETE FROM media_files WHERE filename = ?', [filename]);
    } catch (error) {
        console.error('Could not delete stored image:', error.message);
    }
}
