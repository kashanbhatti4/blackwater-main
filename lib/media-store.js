// Uploaded images are also kept in the database (media_files), because a deploy that replaces
// the project folder deletes public/uploads. The server serves from disk when it can and
// falls back to this copy (restoring the file on disk) when the file has gone.
// The admin Media tab lists them, filed in folders (media_folders).

import fs from 'fs';
import path from 'path';
import { query } from './db.js';

let tableReady = null;

async function createTables() {
    await query(`
        CREATE TABLE IF NOT EXISTS media_folders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS media_files (
            filename VARCHAR(191) PRIMARY KEY,
            mime_type VARCHAR(100) NOT NULL,
            size INT UNSIGNED NOT NULL,
            data LONGBLOB NOT NULL,
            folder_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Tables made before folders existed
    const columns = await query("SHOW COLUMNS FROM media_files LIKE 'folder_id'");
    if (!columns.length) await query('ALTER TABLE media_files ADD COLUMN folder_id INT NULL AFTER data');
}

function ensureTable() {
    if (!tableReady) {
        tableReady = createTables().catch(error => {
            tableReady = null;
            throw error;
        });
    }
    return tableReady;
}

// folderId only applies to new images; re-saving an image keeps its folder
export async function saveMedia(filename, mimeType, buffer, folderId = null) {
    await ensureTable();
    await query(
        `INSERT INTO media_files (filename, mime_type, size, data, folder_id) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size = VALUES(size), data = VALUES(data)`,
        [filename, mimeType, buffer.length, buffer, folderId]
    );
}

export async function loadMedia(filename) {
    await ensureTable();
    const rows = await query('SELECT mime_type, size, data FROM media_files WHERE filename = ? LIMIT 1', [filename]);
    return rows[0] || null;
}

// Copies every image in these folders that has no database copy yet (uploads from before
// the copies existed, or whose copy failed), so the next deploy can't take them with it
export async function backupUploads(dirs, mimeTypes) {
    await ensureTable();
    const stored = new Set((await query('SELECT filename FROM media_files')).map(row => row.filename));
    let saved = 0;
    for (const dir of [].concat(dirs)) {
        let files;
        try {
            files = await fs.promises.readdir(dir);
        } catch (error) {
            continue;
        }
        for (const filename of files) {
            const mimeType = mimeTypes[path.extname(filename).toLowerCase()];
            if (stored.has(filename) || !mimeType || !mimeType.startsWith('image/')) continue;
            await saveMedia(filename, mimeType, await fs.promises.readFile(path.join(dir, filename)));
            stored.add(filename);
            saved++;
        }
    }
    return saved;
}

// Every stored image, newest first (without the image data)
export async function listMedia() {
    await ensureTable();
    return query('SELECT filename, mime_type, size, folder_id, created_at FROM media_files ORDER BY created_at DESC, filename DESC');
}

export async function moveMedia(filenames, folderId) {
    await ensureTable();
    if (!filenames.length) return;
    await query(
        `UPDATE media_files SET folder_id = ? WHERE filename IN (${filenames.map(() => '?').join(', ')})`,
        [folderId, ...filenames]
    );
}

export async function listFolders() {
    await ensureTable();
    return query(`
        SELECT f.id, f.name, COUNT(m.filename) AS count
        FROM media_folders f
        LEFT JOIN media_files m ON m.folder_id = f.id
        GROUP BY f.id, f.name
        ORDER BY f.name ASC
    `);
}

export async function createFolder(name) {
    await ensureTable();
    const result = await query('INSERT INTO media_folders (name) VALUES (?)', [name]);
    return result.insertId;
}

export async function renameFolder(id, name) {
    await ensureTable();
    const result = await query('UPDATE media_folders SET name = ? WHERE id = ?', [name, id]);
    return result.affectedRows > 0;
}

// Its images stay in the library, outside any folder
export async function deleteFolder(id) {
    await ensureTable();
    await query('UPDATE media_files SET folder_id = NULL WHERE folder_id = ?', [id]);
    const result = await query('DELETE FROM media_folders WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

export async function deleteMedia(filename) {
    try {
        await ensureTable();
        await query('DELETE FROM media_files WHERE filename = ?', [filename]);
    } catch (error) {
        console.error('Could not delete stored image:', error.message);
    }
}
