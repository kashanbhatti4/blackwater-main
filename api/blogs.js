import { query } from '../lib/db.js';
import { authenticateAdmin } from '../lib/auth.js';
import { getUniqueSlug, toSlug } from '../lib/slugify.js';
import { deleteUploadedImage } from '../lib/upload-handler.js';

// ---------------------------------------------------------
// SEO columns (focus_keyword, seo_score) are added on first use, so an existing
// database needs no manual migration. If the database user can't ALTER the table,
// blogs still save without them (see database/migrations/2026-10-16-seo-fields.sql).
// ---------------------------------------------------------
let seoColumns = { ready: null, checkedAt: 0 };

export async function hasSeoColumns() {
    const retryAfterMs = 10 * 60 * 1000;
    if (seoColumns.ready === true) return true;
    if (seoColumns.ready === false && Date.now() - seoColumns.checkedAt < retryAfterMs) return false;
    try {
        const columns = await query("SHOW COLUMNS FROM blogs WHERE Field IN ('focus_keyword', 'seo_score')");
        const have = new Set(columns.map(c => c.Field));
        if (!have.has('focus_keyword')) {
            await query('ALTER TABLE blogs ADD COLUMN focus_keyword VARCHAR(255) NULL AFTER meta_description');
        }
        if (!have.has('seo_score')) {
            await query('ALTER TABLE blogs ADD COLUMN seo_score TINYINT UNSIGNED NULL AFTER focus_keyword');
        }
        seoColumns = { ready: true, checkedAt: Date.now() };
    } catch (error) {
        console.error('SEO columns unavailable (run database/migrations/2026-10-16-seo-fields.sql):', error.message);
        seoColumns = { ready: false, checkedAt: Date.now() };
    }
    return seoColumns.ready;
}

function cleanKeyword(value) {
    if (typeof value !== 'string') return null;
    const keyword = value.trim().replace(/\s+/g, ' ').slice(0, 255);
    return keyword || null;
}

function cleanScore(value) {
    const score = parseInt(value, 10);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

// Excerpt = the article's first paragraph (blog cards cut it to three lines)
function decodeEntities(text) {
    return text
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, '&');
}

function shorten(text, max) {
    if (!text || text.length <= max) return text || '';
    const cut = text.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–]+$/, '') + '…';
}

function excerptFor(html) {
    for (const match of String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        const text = decodeEntities(match[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (text) return shorten(text, 220);
    }
    return null;
}

// "N min" from the article HTML (225 words a minute), used when the editor didn't send one
function readingTimeFor(html) {
    const words = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.round(words / 225))} min`;
}

/**
 * Main blogs API dispatcher
 */
export default async function blogsHandler(req, res, pathname, searchParams) {
    const admin = authenticateAdmin(req);

    // ---------------------------------------------------------
    // 1. GET /api/blogs/admin/all - Admin Fetch All Blogs & Stats
    // ---------------------------------------------------------
    if (pathname === '/api/blogs/admin/all' && req.method === 'GET') {
        if (!admin) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const blogs = await query(`
                SELECT b.*, c.name AS category_title
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                ORDER BY b.created_at DESC
            `);

            const total = blogs.length;
            const publishedCount = blogs.filter(b => b.status === 'published').length;
            const draftCount = blogs.filter(b => b.status === 'draft').length;

            return res.status(200).json({
                blogs,
                stats: { total, publishedCount, draftCount }
            });
        } catch (error) {
            console.error('Error fetching admin blogs:', error);
            return res.status(500).json({ error: 'Failed to fetch blogs' });
        }
    }

    // ---------------------------------------------------------
    // 2. GET /api/blogs - Public Fetch Published Blogs
    // ---------------------------------------------------------
    if (pathname === '/api/blogs' && req.method === 'GET') {
        const categorySlug = searchParams.get('category');
        const search = searchParams.get('search');
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '12', 10)));
        const offset = (page - 1) * limit;

        try {
            let whereClause = "WHERE b.status = 'published'";
            const params = [];

            if (categorySlug) {
                whereClause += " AND (c.slug = ? OR b.category_name = ?)";
                params.push(categorySlug, categorySlug);
            }

            if (search) {
                whereClause += " AND (b.title LIKE ? OR b.excerpt LIKE ? OR b.content LIKE ?)";
                const term = `%${search}%`;
                params.push(term, term, term);
            }

            // Total count
            const countResult = await query(
                `SELECT COUNT(b.id) as total FROM blogs b LEFT JOIN categories c ON b.category_id = c.id ${whereClause}`,
                params
            );
            const total = countResult[0]?.total || 0;

            // Blogs list
            const blogParams = [...params, limit, offset];
            const blogs = await query(`
                SELECT b.id, b.title, b.slug, b.excerpt, b.featured_image, b.category_id, 
                       COALESCE(c.name, b.category_name) as category,
                       b.status, b.reading_time, b.published_at, b.created_at
                FROM blogs b
                LEFT JOIN categories c ON b.category_id = c.id
                ${whereClause}
                ORDER BY b.published_at DESC, b.created_at DESC
                LIMIT ? OFFSET ?
            `, blogParams);

            return res.status(200).json({
                blogs,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Error fetching public blogs:', error);
            return res.status(500).json({ error: 'Failed to retrieve blogs' });
        }
    }

    // ---------------------------------------------------------
    // 3. POST /api/blogs - Admin Create Blog
    // ---------------------------------------------------------
    if (pathname === '/api/blogs' && req.method === 'POST') {
        if (!admin) {
            return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
        }

        const {
            title,
            slug: requestedSlug,
            excerpt,
            content,
            featured_image,
            category_id,
            category_name,
            status = 'draft',
            reading_time,
            meta_title,
            meta_description,
            focus_keyword,
            seo_score,
            published_at,
            tags = []
        } = req.body || {};

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Blog title is required' });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Blog content is required' });
        }

        try {
            const finalSlug = await getUniqueSlug(requestedSlug || title);
            const finalStatus = status === 'published' ? 'published' : 'draft';
            const finalPublishedAt = finalStatus === 'published'
                ? (published_at ? new Date(published_at) : new Date())
                : (published_at ? new Date(published_at) : null);

            const columns = [
                'title', 'slug', 'excerpt', 'content', 'featured_image',
                'category_id', 'category_name', 'status', 'reading_time',
                'meta_title', 'meta_description', 'published_at'
            ];
            const values = [
                title.trim(),
                finalSlug,
                excerpt || excerptFor(content),
                content,
                featured_image || null,
                category_id || null,
                category_name || null,
                finalStatus,
                reading_time || readingTimeFor(content),
                meta_title || title.trim(),
                meta_description || shorten(excerpt || excerptFor(content) || '', 158) || null,
                finalPublishedAt
            ];
            if (await hasSeoColumns()) {
                columns.push('focus_keyword', 'seo_score');
                values.push(cleanKeyword(focus_keyword), cleanScore(seo_score));
            }

            const result = await query(
                `INSERT INTO blogs (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
                values
            );

            const blogId = result.insertId;

            // Handle tags if provided
            if (Array.isArray(tags) && tags.length > 0) {
                await syncBlogTags(blogId, tags);
            }

            return res.status(201).json({
                message: 'Blog created successfully',
                id: blogId,
                slug: finalSlug,
                status: finalStatus
            });
        } catch (error) {
            console.error('Error creating blog:', error);
            return res.status(500).json({ error: error.message || 'Failed to create blog' });
        }
    }

    // Dynamic routing for /api/blogs/:slugOrId
    const match = pathname.match(/^\/api\/blogs\/([^\/]+)$/);
    if (match) {
        const identifier = decodeURIComponent(match[1]);

        // GET /api/blogs/:slugOrId
        if (req.method === 'GET') {
            try {
                const isNumericId = /^\d+$/.test(identifier);
                let sql = `
                    SELECT b.*, COALESCE(c.name, b.category_name) as category, c.slug as category_slug
                    FROM blogs b
                    LEFT JOIN categories c ON b.category_id = c.id
                    WHERE ${isNumericId ? 'b.id = ?' : 'b.slug = ?'}
                    LIMIT 1
                `;
                const rows = await query(sql, [identifier]);

                if (rows.length === 0) {
                    return res.status(404).json({ error: 'Blog not found' });
                }

                const blog = rows[0];

                // If not admin and not published, return 404
                if (blog.status !== 'published' && !admin) {
                    return res.status(404).json({ error: 'Blog not found' });
                }

                // Fetch tags for this blog
                const tagRows = await query(`
                    SELECT t.id, t.name, t.slug
                    FROM tags t
                    JOIN blog_tags bt ON bt.tag_id = t.id
                    WHERE bt.blog_id = ?
                `, [blog.id]);
                blog.tags = tagRows;

                return res.status(200).json({ blog });
            } catch (error) {
                console.error('Error fetching blog:', error);
                return res.status(500).json({ error: 'Failed to retrieve blog' });
            }
        }

        // PUT /api/blogs/:id - Update Blog
        if (req.method === 'PUT') {
            if (!admin) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const blogId = parseInt(identifier, 10);
            if (!blogId) {
                return res.status(400).json({ error: 'Invalid blog ID' });
            }

            const {
                title,
                slug: requestedSlug,
                excerpt,
                content,
                featured_image,
                category_id,
                category_name,
                status,
                reading_time,
                meta_title,
                meta_description,
                focus_keyword,
                seo_score,
                published_at,
                tags = [],
                delete_previous_image
            } = req.body || {};

            try {
                // Fetch existing blog
                const existing = await query('SELECT * FROM blogs WHERE id = ?', [blogId]);
                if (existing.length === 0) {
                    return res.status(404).json({ error: 'Blog not found' });
                }
                const oldBlog = existing[0];

                // Clean up previous image if replaced
                if (delete_previous_image && oldBlog.featured_image && oldBlog.featured_image !== featured_image) {
                    deleteUploadedImage(oldBlog.featured_image);
                }

                const finalSlug = requestedSlug
                    ? await getUniqueSlug(requestedSlug, blogId)
                    : oldBlog.slug;

                const finalStatus = status || oldBlog.status;
                let finalPublishedAt = oldBlog.published_at;
                if (status === 'published' && !oldBlog.published_at) {
                    finalPublishedAt = published_at ? new Date(published_at) : new Date();
                } else if (published_at) {
                    finalPublishedAt = new Date(published_at);
                }

                const finalContent = content !== undefined ? content : oldBlog.content;
                const assignments = {
                    title: title !== undefined ? title.trim() : oldBlog.title,
                    slug: finalSlug,
                    excerpt: excerpt || (content !== undefined ? excerptFor(finalContent) : oldBlog.excerpt),
                    content: finalContent,
                    featured_image: featured_image !== undefined ? featured_image : oldBlog.featured_image,
                    category_id: category_id !== undefined ? category_id : oldBlog.category_id,
                    category_name: category_name !== undefined ? category_name : oldBlog.category_name,
                    status: finalStatus,
                    reading_time: reading_time || (content !== undefined ? readingTimeFor(finalContent) : oldBlog.reading_time),
                    meta_title: meta_title !== undefined ? meta_title : oldBlog.meta_title,
                    meta_description: meta_description !== undefined ? meta_description : oldBlog.meta_description,
                    published_at: finalPublishedAt
                };
                if (await hasSeoColumns()) {
                    if (focus_keyword !== undefined) assignments.focus_keyword = cleanKeyword(focus_keyword);
                    if (seo_score !== undefined) assignments.seo_score = cleanScore(seo_score);
                }

                const fields = Object.keys(assignments);
                await query(
                    `UPDATE blogs SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
                    [...fields.map(f => assignments[f]), blogId]
                );

                if (Array.isArray(tags)) {
                    await syncBlogTags(blogId, tags);
                }

                return res.status(200).json({
                    message: 'Blog updated successfully',
                    id: blogId,
                    slug: finalSlug
                });
            } catch (error) {
                console.error('Error updating blog:', error);
                return res.status(500).json({ error: error.message || 'Failed to update blog' });
            }
        }

        // DELETE /api/blogs/:id - Delete Blog
        if (req.method === 'DELETE') {
            if (!admin) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const blogId = parseInt(identifier, 10);
            if (!blogId) {
                return res.status(400).json({ error: 'Invalid blog ID' });
            }

            try {
                const existing = await query('SELECT featured_image FROM blogs WHERE id = ?', [blogId]);
                if (existing.length > 0 && existing[0].featured_image) {
                    deleteUploadedImage(existing[0].featured_image);
                }

                await query('DELETE FROM blogs WHERE id = ?', [blogId]);
                return res.status(200).json({ message: 'Blog deleted successfully' });
            } catch (error) {
                console.error('Error deleting blog:', error);
                return res.status(500).json({ error: 'Failed to delete blog' });
            }
        }
    }

    // PATCH /api/blogs/:id/status - Toggle Status
    const statusMatch = pathname.match(/^\/api\/blogs\/([^\/]+)\/status$/);
    if (statusMatch && req.method === 'PATCH') {
        if (!admin) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const blogId = parseInt(statusMatch[1], 10);
        const { status } = req.body || {};

        if (!['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "draft" or "published"' });
        }

        try {
            const publishedAtSql = status === 'published' ? 'published_at = COALESCE(published_at, NOW())' : '';
            const sql = `UPDATE blogs SET status = ? ${publishedAtSql ? ', ' + publishedAtSql : ''} WHERE id = ?`;
            await query(sql, [status, blogId]);
            return res.status(200).json({ message: `Blog status updated to ${status}` });
        } catch (error) {
            console.error('Error toggling blog status:', error);
            return res.status(500).json({ error: 'Failed to update status' });
        }
    }

    return res.status(404).json({ error: 'Blog endpoint not found' });
}

/**
 * Synchronize tags for a given blog ID
 */
export async function syncBlogTags(blogId, tags) {
    await query('DELETE FROM blog_tags WHERE blog_id = ?', [blogId]);

    for (const rawTag of tags) {
        const tagName = typeof rawTag === 'string' ? rawTag.trim() : rawTag?.name?.trim();
        if (!tagName) continue;

        const tagSlug = toSlug(tagName);

        // Find or insert tag
        let tagRows = await query('SELECT id FROM tags WHERE slug = ?', [tagSlug]);
        let tagId;

        if (tagRows.length > 0) {
            tagId = tagRows[0].id;
        } else {
            const insertResult = await query(
                'INSERT INTO tags (name, slug) VALUES (?, ?)',
                [tagName, tagSlug]
            );
            tagId = insertResult.insertId;
        }

        // Link in junction table
        await query(
            'INSERT IGNORE INTO blog_tags (blog_id, tag_id) VALUES (?, ?)',
            [blogId, tagId]
        );
    }
}
