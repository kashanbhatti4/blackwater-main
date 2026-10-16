import { authenticateAdmin } from '../lib/auth.js';
import { handleImageUpload, deleteUploadedImage } from '../lib/upload-handler.js';
import { toServedUrl, toStoredUrl } from '../lib/media.js';
import { saveMedia } from '../lib/media-store.js';
import { UPLOADS_DIR } from '../lib/upload-handler.js';
import fs from 'fs';
import path from 'path';

export default async function uploadHandler(req, res) {
    const admin = authenticateAdmin(req);
    if (!admin) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    if (req.method === 'POST') {
        try {
            const uploadedFile = await handleImageUpload(req);

            // Database copy, so the image survives deploys that replace the uploads folder
            let stored = true;
            try {
                const buffer = fs.readFileSync(path.join(UPLOADS_DIR, uploadedFile.filename));
                await saveMedia(uploadedFile.filename, uploadedFile.mimeType, buffer);
            } catch (storeError) {
                stored = false;
                console.error('Image saved to disk only (database copy failed):', storeError.message);
            }

            return res.status(200).json({
                stored,
                message: 'Image uploaded successfully',
                url: toServedUrl(uploadedFile.url),
                filename: uploadedFile.filename,
                size: uploadedFile.size
            });
        } catch (error) {
            console.error('Image upload error:', error);
            return res.status(400).json({ error: error.message || 'Image upload failed' });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const { url } = req.body || {};
            if (!url) {
                return res.status(400).json({ error: 'Image URL is required' });
            }
            const deleted = deleteUploadedImage(toStoredUrl(url));
            return res.status(200).json({ message: deleted ? 'Image deleted' : 'Image not found or not local' });
        } catch (error) {
            console.error('Image deletion error:', error);
            return res.status(500).json({ error: 'Failed to delete image' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
