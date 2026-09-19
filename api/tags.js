import pool from '../config/db.js';
import { requireAuth } from '../lib/auth-utils.js';

function slugify(text) {
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export default async function tagsHandler(req, res, subPath) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const isAdminRoute = subPath.startsWith('/admin');

    // GET /api/tags or /api/admin/tags
    if (req.method === 'GET') {
        try {
            const [tags] = await pool.query('SELECT * FROM tags ORDER BY name ASC');
            return res.status(200).json({ tags });
        } catch (err) {
            console.error('[Tags GET Error]', err);
            return res.status(500).json({ error: 'Failed to fetch tags.' });
        }
    }

    // Admin authorization required for POST/DELETE
    if (isAdminRoute) {
        const adminUser = requireAuth(req, res);
        if (!adminUser) return;
    }

    // POST /api/admin/tags
    if (isAdminRoute && req.method === 'POST') {
        const { name } = req.body || {};
        if (!name) {
            return res.status(400).json({ error: 'Tag name is required.' });
        }

        const slug = slugify(name);
        try {
            const [result] = await pool.query(
                'INSERT INTO tags (name, slug) VALUES (?, ?)',
                [name.trim(), slug]
            );
            return res.status(201).json({
                message: 'Tag created successfully.',
                tag: { id: result.insertId, name: name.trim(), slug }
            });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Tag with this name/slug already exists.' });
            }
            console.error('[Tag Create Error]', err);
            return res.status(500).json({ error: 'Failed to create tag.' });
        }
    }

    // DELETE /api/admin/tags/:id
    if (isAdminRoute && req.method === 'DELETE') {
        const id = parseInt(subPath.split('/').pop(), 10);
        try {
            await pool.query('DELETE FROM tags WHERE id = ?', [id]);
            return res.status(200).json({ message: 'Tag deleted successfully.' });
        } catch (err) {
            console.error('[Tag Delete Error]', err);
            return res.status(500).json({ error: 'Failed to delete tag.' });
        }
    }

    return res.status(404).json({ error: 'Tags endpoint route not found.' });
}
