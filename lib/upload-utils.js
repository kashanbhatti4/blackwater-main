import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_DIR = path.join(__dirname, '../public/uploads/blogs');

// Ensure upload directory exists
export function ensureUploadDirExists() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024;

export function validateImage(filename, mimeType, size) {
    const ext = path.extname(filename).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return { valid: false, error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.' };
    }

    if (size && size > MAX_SIZE_BYTES) {
        return { valid: false, error: `File size exceeds maximum limit of ${process.env.MAX_FILE_SIZE_MB || 5}MB.` };
    }

    return { valid: true };
}

export function generateSafeFilename(originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    const nameWithoutExt = path.basename(originalFilename, ext);
    const sanitizedBase = nameWithoutExt
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${sanitizedBase || 'blog-image'}-${timestamp}-${random}${ext}`;
}

export function deleteUploadedImage(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return;
    
    // Ignore external URLs if any
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return;

    try {
        const cleanPath = relativePath.replace(/^\//, '');
        const absolutePath = path.join(__dirname, '../public', cleanPath);
        
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            console.log(`[Uploads] Deleted old image file: ${absolutePath}`);
        }
    } catch (err) {
        console.error(`[Uploads Error] Failed to delete image file '${relativePath}':`, err.message);
    }
}
