import { query } from '../lib/db.js';
import { authenticateAdmin } from '../lib/auth.js';
import { toSlug } from '../lib/slugify.js';

export default async function categoriesHandler(req, res, pathname) {
    // GET /api/categories: Public
    if (req.method === 'GET') {
        try {
            const categories = await query(`
                SELECT c.*, COUNT(b.id) AS blog_count
                FROM categories c
                LEFT JOIN blogs b ON b.category_id = c.id AND b.status = 'published'
                GROUP BY c.id
                ORDER BY c.name ASC
            `);
            return res.status(200).json({ categories });
        } catch (error) {
            console.error('Error fetching categories:', error);
            return res.status(500).json({ error: 'Failed to retrieve categories' });
        }
    }

    // POST /api/categories: Admin only
    if (req.method === 'POST') {
        const admin = authenticateAdmin(req);
        if (!admin) {
            return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
        }

        const { name } = req.body || {};
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const slug = toSlug(name);
        try {
            const result = await query(
                'INSERT INTO categories (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
                [name.trim(), slug]
            );
            return res.status(201).json({
                message: 'Category saved',
                id: result.insertId || null,
                name: name.trim(),
                slug
            });
        } catch (error) {
            console.error('Error saving category:', error);
            return res.status(500).json({ error: error.message || 'Failed to save category' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
