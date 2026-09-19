import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiSendHandler from './api/send.js';
import authHandler from './api/auth.js';
import blogsHandler from './api/blogs.js';
import categoriesHandler from './api/categories.js';
import tagsHandler from './api/tags.js';
import uploadHandler from './api/upload.js';
import { initDatabase } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

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

function parseJsonBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

const server = http.createServer(async (req, res) => {
    let statusCode = 200;

    res.status = function(code) {
        statusCode = code;
        res.statusCode = code;
        return res;
    };

    res.json = function(data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
    };

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    const queryParams = {};
    parsedUrl.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    // -------------------------------------------------------------
    // API ROUTER
    // -------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
        // Multipart file upload route (no json body pre-parsing)
        if (pathname === '/api/admin/upload') {
            return uploadHandler(req, res);
        }

        // Standard JSON API body parsing
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            req.body = await parseJsonBody(req);
        } else {
            req.body = {};
        }

        try {
            if (pathname === '/api/send') {
                return await apiSendHandler(req, res);
            }

            if (pathname.startsWith('/api/auth')) {
                const subPath = pathname.replace('/api/auth', '');
                return await authHandler(req, res, subPath);
            }

            if (pathname.startsWith('/api/admin/blogs') || pathname.startsWith('/api/blogs')) {
                let subPath = pathname.replace('/api/blogs', '');
                if (pathname.startsWith('/api/admin/blogs')) {
                    subPath = pathname.replace('/api', '');
                }
                return await blogsHandler(req, res, subPath, queryParams);
            }

            if (pathname.startsWith('/api/admin/categories') || pathname.startsWith('/api/categories')) {
                let subPath = pathname.replace('/api/categories', '');
                if (pathname.startsWith('/api/admin/categories')) {
                    subPath = pathname.replace('/api', '');
                }
                return await categoriesHandler(req, res, subPath);
            }

            if (pathname.startsWith('/api/admin/tags') || pathname.startsWith('/api/tags')) {
                let subPath = pathname.replace('/api/tags', '');
                if (pathname.startsWith('/api/admin/tags')) {
                    subPath = pathname.replace('/api', '');
                }
                return await tagsHandler(req, res, subPath);
            }

            return res.status(404).json({ error: 'API endpoint not found' });
        } catch (err) {
            console.error('API Router Error:', err);
            if (!res.writableEnded) {
                return res.status(500).json({ error: err.message || 'Internal Server Error' });
            }
        }
        return;
    }

    // -------------------------------------------------------------
    // PUBLIC BLOG CLEAN ROUTING
    // -------------------------------------------------------------
    if (pathname === '/blog' || pathname === '/blog/') {
        const blogFilePath = path.join(__dirname, 'blog.html');
        if (fs.existsSync(blogFilePath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return fs.createReadStream(blogFilePath).pipe(res);
        }
    }

    if (pathname.startsWith('/blog/') && pathname !== '/blog/') {
        const slug = pathname.replace('/blog/', '').trim();
        if (slug) {
            const blogDetailPath = path.join(__dirname, 'blog-detail.html');
            if (fs.existsSync(blogDetailPath)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                return fs.createReadStream(blogDetailPath).pipe(res);
            }
        }
    }

    // -------------------------------------------------------------
    // STATIC FILES & ADMIN PORTAL SERVING
    // -------------------------------------------------------------
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }

    let filePath = path.join(__dirname, safePath);

    // Map /uploads/* requests to physical /public/uploads/* directory
    if (safePath.startsWith('/uploads/') || safePath.startsWith('\\uploads\\') || safePath.startsWith('uploads/') || safePath.startsWith('uploads\\')) {
        filePath = path.join(__dirname, 'public', safePath);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        }
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

// Initialize database tables if reachable, then start server
initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/`);
        console.log(`Admin Dashboard: http://localhost:${PORT}/admin/login.html`);
        console.log(`Public Blog: http://localhost:${PORT}/blog`);
    });
});

