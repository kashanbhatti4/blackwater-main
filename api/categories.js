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

export default async function categoriesHandler(req, res, subPath) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const isAdminRoute = subPath.startsWith('/admin');

    // GET /api/categories or /api/admin/categories
    if (req.method === 'GET') {
        try {
            const [categories] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
            return res.status(200).json({ categories });
        } catch (err) {
            console.error('[Categories GET Error]', err);
            return res.status(500).json({ error: 'Failed to fetch categories.' });
        }
    }

    // Admin authorization required for POST/DELETE
    if (isAdminRoute) {
        const adminUser = requireAuth(req, res);
        if (!adminUser) return;
    }

    // POST /api/admin/categories
    if (isAdminRoute && req.method === 'POST') {
        const { name } = req.body || {};
        if (!name) {
            return res.status(400).json({ error: 'Category name is required.' });
        }

        const slug = slugify(name);
        try {
            const [result] = await pool.query(
                'INSERT INTO categories (name, slug) VALUES (?, ?)',
                [name.trim(), slug]
            );
            return res.status(201).json({
                message: 'Category created successfully.',
                category: { id: result.insertId, name: name.trim(), slug }
            });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Category with this name/slug already exists.' });
            }
            console.error('[Category Create Error]', err);
            return res.status(500).json({ error: 'Failed to create category.' });
        }
    }

    // DELETE /api/admin/categories/:id
    if (isAdminRoute && req.method === 'DELETE') {
        const id = parseInt(subPath.split('/').pop(), 10);
        try {
            await pool.query('DELETE FROM categories WHERE id = ?', [id]);
            return res.status(200).json({ message: 'Category deleted successfully.' });
        } catch (err) {
            console.error('[Category Delete Error]', err);
            return res.status(500).json({ error: 'Failed to delete category.' });
        }
    }

    return res.status(404).json({ error: 'Categories endpoint route not found.' });
}
