import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Busboy from 'busboy';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../public/uploads/blogs');

// Ensure destination folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024;

/**
 * Handle multipart image upload from request stream
 */
export function handleImageUpload(req) {
    return new Promise((resolve, reject) => {
        let busboy;
        try {
            busboy = Busboy({
                headers: req.headers,
                limits: {
                    fileSize: MAX_BYTES,
                    files: 1
                }
            });
        } catch (err) {
            return reject(new Error('Invalid multipart request: ' + err.message));
        }

        let uploadedFile = null;
        let fileTooLarge = false;
        let busboyFinished = false;
        let writeStreamFinished = false;
        let targetFilePath = null;
        let fileCount = 0;

        function checkComplete() {
            if (!busboyFinished) return;
            if (fileCount === 0) {
                return reject(new Error('No valid file was uploaded.'));
            }
            if (writeStreamFinished) {
                if (fileTooLarge) {
                    try {
                        if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
                    } catch (e) {}
                    return reject(new Error(`File exceeds maximum size of ${process.env.MAX_FILE_SIZE_MB || 5}MB.`));
                }
                if (uploadedFile) {
                    return resolve(uploadedFile);
                } else {
                    return reject(new Error('Failed to save uploaded file.'));
                }
            }
        }

        busboy.on('file', (name, fileStream, info) => {
            fileCount++;
            const filename = info?.filename || (typeof info === 'string' ? info : '');
            const mimeType = info?.mimeType || info?.mime || '';

            if (!filename) {
                fileStream.resume();
                fileCount--;
                return;
            }

            const ext = path.extname(filename).toLowerCase();

            if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(ext)) {
                fileStream.resume();
                return reject(new Error('Unsupported file type. Only JPG, PNG, and WebP are allowed.'));
            }

            // Create safe, unique filename
            const uniqueName = `blog_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
            targetFilePath = path.join(UPLOADS_DIR, uniqueName);
            const writeStream = fs.createWriteStream(targetFilePath);

            let bytesWritten = 0;

            fileStream.on('data', data => {
                bytesWritten += data.length;
                if (bytesWritten > MAX_BYTES) {
                    fileTooLarge = true;
                }
            });

            fileStream.on('limit', () => {
                fileTooLarge = true;
            });

            fileStream.pipe(writeStream);

            writeStream.on('finish', () => {
                writeStreamFinished = true;
                if (!fileTooLarge) {
                    uploadedFile = {
                        filename: uniqueName,
                        originalName: filename,
                        mimeType,
                        size: bytesWritten,
                        url: `/uploads/blogs/${uniqueName}`
                    };
                }
                checkComplete();
            });

            writeStream.on('error', err => {
                reject(err);
            });
        });

        busboy.on('error', err => {
            reject(err);
        });

        busboy.on('finish', () => {
            busboyFinished = true;
            checkComplete();
        });

        req.pipe(busboy);
    });
}

/**
 * Remove an uploaded image from server filesystem by relative URL
 */
export function deleteUploadedImage(relativeUrl) {
    if (!relativeUrl || !relativeUrl.startsWith('/uploads/blogs/')) {
        return false;
    }
    const filename = path.basename(relativeUrl);
    const fullPath = path.join(UPLOADS_DIR, filename);

    try {
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return true;
        }
    } catch (err) {
        console.error('Error deleting image file:', err);
    }
    return false;
}
