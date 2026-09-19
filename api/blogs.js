import pool from '../config/db.js';
import { requireAuth } from '../lib/auth-utils.js';
import { deleteUploadedImage } from '../lib/upload-utils.js';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

async function makeUniqueSlug(slug, currentId = null) {
    let cleanSlug = slugify(slug);
    if (!cleanSlug) cleanSlug = 'blog-post';
    
    let candidate = cleanSlug;
    let count = 1;

    while (true) {
        let query = 'SELECT id FROM blogs WHERE slug = ?';
        let params = [candidate];
        if (currentId) {
            query += ' AND id != ?';
            params.push(currentId);
        }

        const [rows] = await pool.query(query, params);
        if (rows.length === 0) {
            return candidate;
        }
        candidate = `${cleanSlug}-${count}`;
        count++;
    }
}

export default async function blogsHandler(req, res, subPath, queryParams = {}) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const isAdminRoute = subPath.startsWith('/admin');

    // Authentication enforcement for admin endpoints
    if (isAdminRoute) {
        const adminUser = requireAuth(req, res);
        if (!adminUser) return;
    }

    // -------------------------------------------------------------
    // PUBLIC ENDPOINTS
    // -------------------------------------------------------------

    // GET /api/blogs (Public listing)
    if (!isAdminRoute && (subPath === '' || subPath === '/') && req.method === 'GET') {
        try {
            const page = parseInt(queryParams.page || '1', 10);
            const limit = parseInt(queryParams.limit || '10', 10);
            const offset = (page - 1) * limit;
            const categorySlug = queryParams.category || null;
            const search = queryParams.search || null;

            let sql = `
                SELECT 
                    b.id, b.title, b.slug, b.excerpt, b.featured_image, b.status, 
                    b.reading_time, b.published_at, b.created_at,
                    c.name as category_name, c.slug as category_slug,
                    GROUP_CONCAT(t.name) as tag_names,
                    GROUP_CONCAT(t.slug) as tag_slugs
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                LEFT JOIN blog_tags bt ON b.id = bt.blog_id
                LEFT JOIN tags t ON bt.tag_id = t.id
                WHERE b.status = 'published'
            `;

            const params = [];

            if (categorySlug) {
                sql += ` AND c.slug = ?`;
                params.push(categorySlug);
            }

            if (search) {
                sql += ` AND (b.title LIKE ? OR b.excerpt LIKE ? OR b.content LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            sql += ` GROUP BY b.id ORDER BY b.published_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [rows] = await pool.query(sql, params);

            // Count total
            let countSql = `
                SELECT COUNT(DISTINCT b.id) as total 
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                WHERE b.status = 'published'
            `;
            const countParams = [];

            if (categorySlug) {
                countSql += ` AND c.slug = ?`;
                countParams.push(categorySlug);
            }
            if (search) {
                countSql += ` AND (b.title LIKE ? OR b.excerpt LIKE ? OR b.content LIKE ?)`;
                countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const [countRows] = await pool.query(countSql, countParams);
            const total = countRows[0].total;

            return res.status(200).json({
                blogs: rows.map(r => ({
                    ...r,
                    tags: r.tag_names ? r.tag_names.split(',').map((name, i) => ({
                        name,
                        slug: r.tag_slugs.split(',')[i]
                    })) : []
                })),
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            console.error('[Public Blogs Error]', err);
            return res.status(500).json({ error: 'Failed to fetch public blogs.' });
        }
    }

    // GET /api/blogs/slug/:slug (Public Single Post Detail)
    if (!isAdminRoute && subPath.startsWith('/slug/') && req.method === 'GET') {
        const slug = subPath.replace('/slug/', '').trim();
        try {
            const sql = `
                SELECT 
                    b.*, 
                    c.name as category_name, c.slug as category_slug,
                    GROUP_CONCAT(t.name) as tag_names,
                    GROUP_CONCAT(t.slug) as tag_slugs
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                LEFT JOIN blog_tags bt ON b.id = bt.blog_id
                LEFT JOIN tags t ON bt.tag_id = t.id
                WHERE b.slug = ? AND b.status = 'published'
                GROUP BY b.id
                LIMIT 1
            `;
            const [rows] = await pool.query(sql, [slug]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Blog post not found or not published.' });
            }

            const blog = rows[0];
            blog.tags = blog.tag_names ? blog.tag_names.split(',').map((name, i) => ({
                name,
                slug: blog.tag_slugs.split(',')[i]
            })) : [];

            // Fetch related posts in same category
            const [related] = await pool.query(`
                SELECT id, title, slug, excerpt, featured_image, published_at, reading_time
                FROM blogs
                WHERE status = 'published' AND id != ? AND (category_id = ? OR category_id IS NULL)
                ORDER BY published_at DESC LIMIT 3
            `, [blog.id, blog.category_id || 0]);

            return res.status(200).json({ blog, related });
        } catch (err) {
            console.error('[Blog Detail Error]', err);
            return res.status(500).json({ error: 'Failed to fetch blog post details.' });
        }
    }

    // -------------------------------------------------------------
    // ADMIN PROTECTED ENDPOINTS
    // -------------------------------------------------------------

    // GET /api/admin/blogs (Admin List - includes drafts)
    if (isAdminRoute && (subPath === '/admin/blogs' || subPath === '/admin/blogs/') && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    b.id, b.title, b.slug, b.excerpt, b.featured_image, b.status, 
                    b.reading_time, b.published_at, b.created_at, b.updated_at,
                    c.name as category_name, c.id as category_id
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                ORDER BY b.updated_at DESC
            `;
            const [rows] = await pool.query(sql);
            return res.status(200).json({ blogs: rows });
        } catch (err) {
            console.error('[Admin Blogs Error]', err);
            return res.status(500).json({ error: 'Failed to fetch admin blog posts.' });
        }
    }

    // GET /api/admin/blogs/:id (Admin Single Post Detail)
    if (isAdminRoute && subPath.match(/^\/admin\/blogs\/\d+$/) && req.method === 'GET') {
        const id = parseInt(subPath.split('/').pop(), 10);
        try {
            const [rows] = await pool.query(`
                SELECT b.*, GROUP_CONCAT(bt.tag_id) as tag_ids
                FROM blogs b
                LEFT JOIN blog_tags bt ON b.id = bt.blog_id
                WHERE b.id = ?
                GROUP BY b.id
            `, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Blog post not found.' });
            }

            const blog = rows[0];
            blog.tag_ids = blog.tag_ids ? blog.tag_ids.split(',').map(tid => parseInt(tid, 10)) : [];

            return res.status(200).json({ blog });
        } catch (err) {
            console.error('[Admin Single Blog Error]', err);
            return res.status(500).json({ error: 'Failed to fetch blog post for editing.' });
        }
    }

    // POST /api/admin/blogs (Create Blog Post)
    if (isAdminRoute && (subPath === '/admin/blogs' || subPath === '/admin/blogs/') && req.method === 'POST') {
        const {
            title,
            slug,
            excerpt,
            content,
            featured_image,
            category_id,
            status,
            reading_time,
            meta_title,
            meta_description,
            tag_ids
        } = req.body || {};

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and Content are required fields.' });
        }

        try {
            const finalSlug = await makeUniqueSlug(slug || title);
            const postStatus = status === 'published' ? 'published' : 'draft';
            const publishedAt = postStatus === 'published' ? new Date() : null;

            const [result] = await pool.query(`
                INSERT INTO blogs (
                    title, slug, excerpt, content, featured_image, category_id, 
                    status, reading_time, meta_title, meta_description, published_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                title,
                finalSlug,
                excerpt || null,
                content,
                featured_image || null,
                category_id ? parseInt(category_id, 10) : null,
                postStatus,
                reading_time || '5 min read',
                meta_title || title,
                meta_description || excerpt || null,
                publishedAt
            ]);

            const newBlogId = result.insertId;

            // Associate tags
            if (Array.isArray(tag_ids) && tag_ids.length > 0) {
                const tagValues = tag_ids.map(tid => [newBlogId, parseInt(tid, 10)]);
                await pool.query('INSERT INTO blog_tags (blog_id, tag_id) VALUES ?', [tagValues]);
            }

            return res.status(201).json({
                message: 'Blog post created successfully.',
                blog: { id: newBlogId, slug: finalSlug, status: postStatus }
            });
        } catch (err) {
            console.error('[Create Blog Error]', err);
            return res.status(500).json({ error: err.message || 'Failed to create blog post.' });
        }
    }

    // PUT /api/admin/blogs/:id (Update Blog Post)
    if (isAdminRoute && subPath.match(/^\/admin\/blogs\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(subPath.split('/').pop(), 10);
        const {
            title,
            slug,
            excerpt,
            content,
            featured_image,
            category_id,
            status,
            reading_time,
            meta_title,
            meta_description,
            tag_ids
        } = req.body || {};

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and Content are required fields.' });
        }

        try {
            // Check existing post
            const [existingRows] = await pool.query('SELECT * FROM blogs WHERE id = ?', [id]);
            if (existingRows.length === 0) {
                return res.status(404).json({ error: 'Blog post not found.' });
            }

            const existingPost = existingRows[0];
            const finalSlug = await makeUniqueSlug(slug || title, id);
            const newStatus = status === 'published' ? 'published' : 'draft';

            let publishedAt = existingPost.published_at;
            if (newStatus === 'published' && !publishedAt) {
                publishedAt = new Date();
            }

            // Cleanup old image if replaced
            if (existingPost.featured_image && featured_image && existingPost.featured_image !== featured_image) {
                deleteUploadedImage(existingPost.featured_image);
            }

            await pool.query(`
                UPDATE blogs SET
                    title = ?,
                    slug = ?,
                    excerpt = ?,
                    content = ?,
                    featured_image = ?,
                    category_id = ?,
                    status = ?,
                    reading_time = ?,
                    meta_title = ?,
                    meta_description = ?,
                    published_at = ?
                WHERE id = ?
            `, [
                title,
                finalSlug,
                excerpt || null,
                content,
                featured_image || null,
                category_id ? parseInt(category_id, 10) : null,
                newStatus,
                reading_time || '5 min read',
                meta_title || title,
                meta_description || excerpt || null,
                publishedAt,
                id
            ]);

            // Update tags
            await pool.query('DELETE FROM blog_tags WHERE blog_id = ?', [id]);
            if (Array.isArray(tag_ids) && tag_ids.length > 0) {
                const tagValues = tag_ids.map(tid => [id, parseInt(tid, 10)]);
                await pool.query('INSERT INTO blog_tags (blog_id, tag_id) VALUES ?', [tagValues]);
            }

            return res.status(200).json({
                message: 'Blog post updated successfully.',
                blog: { id, slug: finalSlug, status: newStatus }
            });
        } catch (err) {
            console.error('[Update Blog Error]', err);
            return res.status(500).json({ error: 'Failed to update blog post.' });
        }
    }

    // DELETE /api/admin/blogs/:id (Delete Blog Post)
    if (isAdminRoute && subPath.match(/^\/admin\/blogs\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(subPath.split('/').pop(), 10);
        try {
            const [rows] = await pool.query('SELECT featured_image FROM blogs WHERE id = ?', [id]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Blog post not found.' });
            }

            const blog = rows[0];
            await pool.query('DELETE FROM blogs WHERE id = ?', [id]);

            // Delete associated featured image from server filesystem
            if (blog.featured_image) {
                deleteUploadedImage(blog.featured_image);
            }

            return res.status(200).json({ message: 'Blog post deleted successfully.' });
        } catch (err) {
            console.error('[Delete Blog Error]', err);
            return res.status(500).json({ error: 'Failed to delete blog post.' });
        }
    }

    // PATCH /api/admin/blogs/:id/status (Toggle Status)
    if (isAdminRoute && subPath.match(/^\/admin\/blogs\/\d+\/status$/) && req.method === 'PATCH') {
        const parts = subPath.split('/');
        const id = parseInt(parts[3], 10);
        const { status } = req.body || {};

        if (!['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: "Status must be 'draft' or 'published'." });
        }

        try {
            const publishedAt = status === 'published' ? new Date() : null;
            await pool.query(
                'UPDATE blogs SET status = ?, published_at = COALESCE(published_at, ?) WHERE id = ?',
                [status, publishedAt, id]
            );

            return res.status(200).json({ message: 'Blog status updated successfully.', status });
        } catch (err) {
            console.error('[Patch Status Error]', err);
            return res.status(500).json({ error: 'Failed to update blog status.' });
        }
    }

    return res.status(404).json({ error: 'Blog endpoint route not found.' });
}
