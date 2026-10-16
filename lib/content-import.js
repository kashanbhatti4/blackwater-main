// Publishes blog posts kept as JSON files in database/posts/ (one file per post).
// Runs when the server starts and via `npm run import-posts`. Each file is imported once:
// it is recorded in the content_imports table, so a post deleted in the admin later
// is not brought back. If a post with the same slug already exists, the file is just
// marked as done.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { toSlug } from './slugify.js';
import { hasSeoColumns, syncBlogTags } from '../api/blogs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, '../database/posts');

async function categoryId(name) {
    if (!name) return null;
    const slug = toSlug(name);
    const rows = await query('SELECT id FROM categories WHERE slug = ? OR name = ? LIMIT 1', [slug, name]);
    if (rows.length) return rows[0].id;
    const result = await query('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
    return result.insertId;
}

export async function importPendingPosts({ log = console.log } = {}) {
    if (!fs.existsSync(POSTS_DIR)) return { imported: 0, skipped: 0 };
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json')).sort();
    if (!files.length) return { imported: 0, skipped: 0 };

    await query(`
        CREATE TABLE IF NOT EXISTS content_imports (
            file VARCHAR(191) PRIMARY KEY,
            blog_id INT NULL,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const done = new Set((await query('SELECT file FROM content_imports')).map(r => r.file));
    const pending = files.filter(f => !done.has(f));
    if (!pending.length) return { imported: 0, skipped: 0 };

    const withSeo = await hasSeoColumns();
    const now = Date.now();
    let imported = 0;
    let skipped = 0;

    for (const file of pending) {
        const post = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
        const existing = await query('SELECT id FROM blogs WHERE slug = ? LIMIT 1', [post.slug]);
        if (existing.length) {
            await query('INSERT INTO content_imports (file, blog_id) VALUES (?, ?)', [file, existing[0].id]);
            log(`Blog import: "${post.slug}" already exists, skipped`);
            skipped++;
            continue;
        }

        const catId = await categoryId(post.category);
        const status = post.status === 'draft' ? 'draft' : 'published';
        // Without a fixed date, posts are spaced a minute apart so "order": 1 is the newest
        const publishedAt = post.published_at ? new Date(post.published_at) : new Date(now - (post.order || 0) * 60 * 1000);

        const columns = ['title', 'slug', 'excerpt', 'content', 'featured_image', 'category_id', 'category_name',
            'status', 'reading_time', 'meta_title', 'meta_description', 'published_at'];
        const values = [post.title, post.slug, post.excerpt || null, post.content, post.featured_image || null,
            catId, post.category || null, status, post.reading_time || '5 min',
            post.meta_title || post.title, post.meta_description || post.excerpt || null, publishedAt];
        if (withSeo) {
            columns.push('focus_keyword', 'seo_score');
            values.push(post.focus_keyword || null, Number.isFinite(post.seo_score) ? post.seo_score : null);
        }

        const result = await query(
            `INSERT INTO blogs (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
            values
        );
        if (Array.isArray(post.tags) && post.tags.length) await syncBlogTags(result.insertId, post.tags);
        await query('INSERT INTO content_imports (file, blog_id) VALUES (?, ?)', [file, result.insertId]);
        log(`Blog import: published "${post.title}"`);
        imported++;
    }

    return { imported, skipped };
}
