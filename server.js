import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import apiSendHandler from './api/send.js';
import authHandler from './api/auth.js';
import blogsHandler from './api/blogs.js';
import categoriesHandler from './api/categories.js';
import uploadHandler from './api/upload.js';
import googleReviewsHandler from './api/google-reviews.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
    // Convenience helper methods
    res.status = function(code) {
        res.statusCode = code;
        return res;
    };

    res.json = function(data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
        return res;
    };

    // CORS & Options
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // =========================================================
    // 1. API ROUTES
    // =========================================================

    // Special case: File Upload (must stream directly, do not buffer JSON body)
    if (pathname === '/api/upload') {
        if (req.method === 'POST') {
            return uploadHandler(req, res);
        } else if (req.method === 'DELETE') {
            // Read body for delete URL
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try { req.body = body ? JSON.parse(body) : {}; } catch (e) { req.body = {}; }
                return uploadHandler(req, res);
            });
            return;
        }
    }

    // JSON Body collector for other API endpoints
    if (pathname.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                req.body = body ? JSON.parse(body) : {};
            } catch (e) {
                req.body = {};
            }

            try {
                // Existing Contact Handler
                if (pathname === '/api/send') {
                    return await apiSendHandler(req, res);
                }

                // Auth Routes
                if (pathname.startsWith('/api/auth/')) {
                    return await authHandler(req, res, pathname);
                }

                // Categories Routes
                if (pathname === '/api/categories') {
                    return await categoriesHandler(req, res, pathname);
                }

                // Blogs Routes
                if (pathname.startsWith('/api/blogs')) {
                    return await blogsHandler(req, res, pathname, parsedUrl.searchParams);
                }

                // Google Reviews Dynamic Endpoint
                if (pathname === '/api/google-reviews') {
                    return await googleReviewsHandler(req, res);
                }

                return res.status(404).json({ error: 'API route not found' });
            } catch (err) {
                console.error('Server Internal Error:', err);
                if (!res.writableEnded) {
                    res.status(500).json({ error: err.message || 'Internal Server Error' });
                }
            }
        });
        return;
    }

    // =========================================================
    // 2. PUBLIC UPLOADED ASSETS (/uploads/blogs/*)
    // =========================================================
    if (pathname.startsWith('/uploads/blogs/')) {
        const filename = path.basename(pathname);
        const filePath = path.join(__dirname, 'public/uploads/blogs', filename);

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Image not found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, immutable'
            });
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        });
        return;
    }

    // =========================================================
    // 3. ADMIN DASHBOARD ROUTING (/admin or /admin/*)
    // =========================================================
    if (pathname === '/admin/index.html') {
        res.writeHead(301, { 'Location': `/admin${parsedUrl.search || ''}` });
        res.end();
        return;
    }

    if (pathname === '/admin' || pathname === '/admin/') {
        const adminFile = path.join(__dirname, 'admin/index.html');
        return serveStaticFile(adminFile, res);
    }

    if (pathname.startsWith('/admin/')) {
        const relativePath = pathname.replace(/^\/admin\//, '');
        const adminStatic = path.join(__dirname, 'admin', relativePath);
        if (fs.existsSync(adminStatic) && fs.statSync(adminStatic).isFile()) {
            return serveStaticFile(adminStatic, res);
        }
        // Fallback for SPA routing in admin
        return serveStaticFile(path.join(__dirname, 'admin/index.html'), res);
    }

    // =========================================================
    // 4. CLEAN URL REDIRECTS (301 Permanent Redirects for SEO)
    // =========================================================
    const searchString = parsedUrl.search || '';

    // Redirect /index.html, /index, or /index/ -> /
    if (pathname === '/index.html' || pathname === '/index' || pathname === '/index/') {
        res.writeHead(301, { 'Location': `/${searchString}` });
        res.end();
        return;
    }

    // Legacy redirects for blog routes
    if (pathname === '/all-articles' || pathname === '/all-articles/' || pathname === '/all-articles.html') {
        res.writeHead(301, { 'Location': `/blogs${searchString}` });
        res.end();
        return;
    }
    if (pathname === '/blog.html') {
        res.writeHead(301, { 'Location': `/blogs${searchString}` });
        res.end();
        return;
    }

    // Redirect any *.html to clean URL (exclude iframe embeds in /animations/ and component templates in /components/)
    if (pathname.endsWith('.html') && !pathname.startsWith('/animations/') && !pathname.startsWith('/components/')) {
        const cleanPath = pathname.slice(0, -5);
        res.writeHead(301, { 'Location': `${cleanPath}${searchString}` });
        res.end();
        return;
    }

    // Remove trailing slashes for clean URLs (e.g. /work/ -> /work), excluding root '/'
    if (pathname.length > 1 && pathname.endsWith('/')) {
        const cleanPath = pathname.slice(0, -1);
        res.writeHead(301, { 'Location': `${cleanPath}${searchString}` });
        res.end();
        return;
    }

    // =========================================================
    // 5. PUBLIC BLOG DYNAMIC ROUTING
    // =========================================================
    // Listing page: /blogs
    if (pathname === '/blogs') {
        const blogsListFile = path.join(__dirname, 'blogs.html');
        return serveStaticFile(blogsListFile, res);
    }

    // Dynamic single article page: /blog/:slug
    if (pathname.startsWith('/blog/') || pathname === '/blog') {
        const blogDetailFile = path.join(__dirname, 'blog.html');
        return serveStaticFile(blogDetailFile, res);
    }

    // =========================================================
    // 6. STANDARD STATIC WEBSITE FILES & CLEAN URL FALLBACK
    // =========================================================
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }

    let filePath = path.join(__dirname, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        }
    }

    serveStaticFile(filePath, res);
});

function serveStaticFile(filePath, res) {
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1><p>The requested page could not be found.</p>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }

        res.writeHead(200, { 'Content-Type': contentType });
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
}

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Blog Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`Public Blogs: http://localhost:${PORT}/blogs`);
});
