import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Busboy from 'busboy';
import dotenv from 'dotenv';
import { deleteMedia } from './media-store.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

// Where uploaded images used to be kept: inside the project, so deploys that replace the
// project files deleted them
export const LEGACY_UPLOADS_DIR = path.join(PROJECT_ROOT, 'public/uploads/blogs');

// Where uploaded images are kept: UPLOAD_DIR (in .env), or else a "blackwater-media" folder
// next to the project folder, where deploys can't reach it
const configuredDir = (process.env.UPLOAD_DIR || '').replace(/^['"]|['"]$/g, '').trim();

function prepareUploadsDir() {
    const dir = configuredDir
        ? path.resolve(PROJECT_ROOT, configuredDir)
        : path.resolve(PROJECT_ROOT, '..', 'blackwater-media');
    try {
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    } catch (error) {
        if (configuredDir) throw error;
        console.error(`Can't create the media folder ${dir} (${error.message}); using ${LEGACY_UPLOADS_DIR} instead. Set UPLOAD_DIR in .env to a folder outside the project.`);
        fs.mkdirSync(LEGACY_UPLOADS_DIR, { recursive: true });
        return LEGACY_UPLOADS_DIR;
    }
}

export const UPLOADS_DIR = prepareUploadsDir();

// Inside the project folder, files can be wiped by a deploy (the database copies still keep them)
export const UPLOADS_DIR_IN_PROJECT = !path.relative(PROJECT_ROOT, UPLOADS_DIR).startsWith('..');

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
    deleteMedia(filename);

    // Both folders: a copy left in the old one would be backed up into the library again
    let deleted = false;
    for (const dir of new Set([UPLOADS_DIR, LEGACY_UPLOADS_DIR])) {
        const fullPath = path.join(dir, filename);
        try {
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                deleted = true;
            }
        } catch (err) {
            console.error('Error deleting image file:', err);
        }
    }
    return deleted;
}
