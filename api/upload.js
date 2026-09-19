import fs from 'fs';
import path from 'path';
import busboy from 'busboy';
import { requireAuth } from '../lib/auth-utils.js';
import {
    ensureUploadDirExists,
    UPLOAD_DIR,
    validateImage,
    generateSafeFilename
} from '../lib/upload-utils.js';

export default async function uploadHandler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    // Auth check
    const adminUser = requireAuth(req, res);
    if (!adminUser) return;

    ensureUploadDirExists();

    try {
        const bb = busboy({
            headers: req.headers,
            limits: {
                fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024,
                files: 1
            }
        });

        let fileUploaded = false;
        let uploadError = null;
        let fileUrl = null;
        const uploadPromises = [];

        bb.on('file', (name, file, info) => {
            const { filename, mimeType } = info;
            
            const validation = validateImage(filename, mimeType);
            if (!validation.valid) {
                uploadError = validation.error;
                file.resume(); // Drain file stream
                return;
            }

            const safeFilename = generateSafeFilename(filename);
            const saveTo = path.join(UPLOAD_DIR, safeFilename);
            const writeStream = fs.createWriteStream(saveTo);

            const promise = new Promise((resolve, reject) => {
                writeStream.on('finish', () => {
                    fileUploaded = true;
                    fileUrl = `/uploads/blogs/${safeFilename}`;
                    resolve();
                });

                writeStream.on('error', (err) => {
                    uploadError = `File system write error: ${err.message}`;
                    reject(err);
                });
            });

            uploadPromises.push(promise);
            file.pipe(writeStream);
        });

        bb.on('limit', () => {
            uploadError = `File exceeds max size limit of ${process.env.MAX_FILE_SIZE_MB || 5}MB.`;
        });

        bb.on('finish', async () => {
            try {
                await Promise.all(uploadPromises);
            } catch (e) {}

            if (uploadError) {
                return res.status(400).json({ error: uploadError });
            }
            if (!fileUploaded || !fileUrl) {
                return res.status(400).json({ error: 'No valid image file uploaded.' });
            }

            return res.status(200).json({
                message: 'Image uploaded successfully.',
                url: fileUrl
            });
        });

        req.pipe(bb);
    } catch (err) {
        console.error('[Upload API Error]', err);
        return res.status(500).json({ error: err.message || 'Server error processing file upload.' });
    }
}
