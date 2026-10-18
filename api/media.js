import fs from 'fs';
import path from 'path';
import { authenticateAdmin } from '../lib/auth.js';
import { UPLOADS_DIR, UPLOADS_DIR_IN_PROJECT, LEGACY_UPLOADS_DIR, deleteUploadedImage } from '../lib/upload-handler.js';
import { backupUploads, deleteMedia, listMedia, listFolders, createFolder, renameFolder, deleteFolder, moveMedia } from '../lib/media-store.js';
import { mediaUsage } from '../lib/media-usage.js';
import { toServedUrl } from '../lib/media.js';

const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;
const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

function folderName(value) {
    const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return name && name.length <= 100 ? name : null;
}

function folderId(value) {
    if (value === null || value === '' || value === undefined) return null;
    const id = parseInt(value, 10);
    return Number.isFinite(id) && id > 0 ? id : undefined;
}

function onDisk(filename) {
    return [UPLOADS_DIR, LEGACY_UPLOADS_DIR].some(dir => fs.existsSync(path.join(dir, filename)));
}

/**
 * Media library (admin only)
 *   GET    /api/media                    images, folders, where each image is used, missing images
 *   POST   /api/media/folders            { name }
 *   PATCH  /api/media/folders/:id        { name }
 *   DELETE /api/media/folders/:id        images move out of the folder
 *   POST   /api/media/move               { filenames: [], folder_id: id | null }
 *   DELETE /api/media/files/:filename    ?force=1 deletes an image articles still use
 */
export default async function mediaHandler(req, res, pathname, searchParams) {
    if (!authenticateAdmin(req)) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    if (pathname === '/api/media' && req.method === 'GET') {
        // Anything on disk without a database copy gets one first, so the library is complete
        await backupUploads([UPLOADS_DIR, LEGACY_UPLOADS_DIR], IMAGE_TYPES)
            .catch(error => console.error('Image backup skipped:', error.message));

        const [rows, folders, usage] = await Promise.all([listMedia(), listFolders(), mediaUsage()]);
        const stored = new Set(rows.map(row => row.filename));

        const items = rows.map(row => ({
            filename: row.filename,
            url: toServedUrl(`/uploads/blogs/${row.filename}`),
            mime_type: row.mime_type,
            size: row.size,
            folder_id: row.folder_id,
            created_at: row.created_at,
            used_in: usage.get(row.filename) || []
        }));

        // Images articles point at that exist nowhere: they need uploading again
        const missing = [...usage.entries()]
            .filter(([filename]) => !stored.has(filename) && !onDisk(filename))
            .map(([filename, usedIn]) => ({ filename, used_in: usedIn }));

        return res.status(200).json({
            storage: { dir: UPLOADS_DIR, inProject: UPLOADS_DIR_IN_PROJECT },
            folders: folders.map(f => ({ id: f.id, name: f.name, count: Number(f.count) })),
            items,
            missing
        });
    }

    if (pathname === '/api/media/folders' && req.method === 'POST') {
        const name = folderName((req.body || {}).name);
        if (!name) return res.status(400).json({ error: 'Give the folder a name (up to 100 characters).' });
        try {
            const id = await createFolder(name);
            return res.status(201).json({ id, name });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: `There is already a folder called "${name}".` });
            throw error;
        }
    }

    const folderMatch = pathname.match(/^\/api\/media\/folders\/(\d+)$/);
    if (folderMatch && req.method === 'PATCH') {
        const name = folderName((req.body || {}).name);
        if (!name) return res.status(400).json({ error: 'Give the folder a name (up to 100 characters).' });
        try {
            const renamed = await renameFolder(Number(folderMatch[1]), name);
            return renamed ? res.status(200).json({ id: Number(folderMatch[1]), name }) : res.status(404).json({ error: 'Folder not found' });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: `There is already a folder called "${name}".` });
            throw error;
        }
    }

    if (folderMatch && req.method === 'DELETE') {
        const deleted = await deleteFolder(Number(folderMatch[1]));
        return deleted ? res.status(200).json({ message: 'Folder deleted' }) : res.status(404).json({ error: 'Folder not found' });
    }

    if (pathname === '/api/media/move' && req.method === 'POST') {
        const { filenames, folder_id } = req.body || {};
        const target = folderId(folder_id);
        if (!Array.isArray(filenames) || !filenames.length || !filenames.every(f => typeof f === 'string' && SAFE_FILENAME.test(f))) {
            return res.status(400).json({ error: 'Choose at least one image.' });
        }
        if (target === undefined) return res.status(400).json({ error: 'Invalid folder' });
        await moveMedia(filenames, target);
        return res.status(200).json({ message: 'Moved', count: filenames.length });
    }

    const fileMatch = pathname.match(/^\/api\/media\/files\/([^/]+)$/);
    if (fileMatch && req.method === 'DELETE') {
        const filename = decodeURIComponent(fileMatch[1]);
        if (!SAFE_FILENAME.test(filename)) return res.status(400).json({ error: 'Invalid file name' });
        const usedIn = (await mediaUsage()).get(filename) || [];
        if (usedIn.length && searchParams.get('force') !== '1') {
            return res.status(409).json({ error: 'This image is used in articles.', used_in: usedIn });
        }
        deleteUploadedImage(`/uploads/blogs/${filename}`);
        await deleteMedia(filename); // finished before the reply, so a reload no longer lists it
        return res.status(200).json({ message: 'Image deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
