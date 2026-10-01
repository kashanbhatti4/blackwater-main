import { query } from './db.js';

export function toSlug(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/['’]/g, '')               // remove apostrophes
        .replace(/[^a-z0-9]+/g, '-')         // replace non-alphanumeric chars with hyphens
        .replace(/^-+|-+$/g, '')             // remove leading & trailing hyphens
        .substring(0, 150);                  // cap length
}

/**
 * Generate a unique slug in the blogs table, optionally excluding a specific blog ID (for updates)
 */
export async function getUniqueSlug(baseTitleOrSlug, excludeBlogId = null) {
    let slug = toSlug(baseTitleOrSlug) || 'article';
    let candidate = slug;
    let counter = 1;

    while (true) {
        let sql = 'SELECT id FROM blogs WHERE slug = ?';
        let params = [candidate];

        if (excludeBlogId) {
            sql += ' AND id != ?';
            params.push(excludeBlogId);
        }

        const existing = await query(sql, params);
        if (existing.length === 0) {
            return candidate;
        }

        candidate = `${slug}-${counter}`;
        counter++;
    }
}
