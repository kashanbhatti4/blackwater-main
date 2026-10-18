// Which articles use which uploaded images: as the featured image, or inside the article text.
// Articles keep image paths as /uploads/blogs/<file> (lib/media.js); /api/uploads/blogs/<file>
// and full URLs on the live site are matched too.

import { query } from './db.js';

const IMAGE_PATH = /\/uploads\/blogs\/([A-Za-z0-9._-]+)/g;

function filenamesIn(text) {
    return typeof text === 'string' ? [...text.matchAll(IMAGE_PATH)].map(m => m[1]) : [];
}

// Map of filename -> [{ id, title, slug, status, featured, inline }]
export async function mediaUsage() {
    const blogs = await query('SELECT id, title, slug, status, featured_image, content FROM blogs');
    const usage = new Map();
    for (const blog of blogs) {
        const featured = new Set(filenamesIn(blog.featured_image));
        const inline = new Set(filenamesIn(blog.content));
        for (const filename of new Set([...featured, ...inline])) {
            if (!usage.has(filename)) usage.set(filename, []);
            usage.get(filename).push({
                id: blog.id,
                title: blog.title,
                slug: blog.slug,
                status: blog.status,
                featured: featured.has(filename),
                inline: inline.has(filename)
            });
        }
    }
    return usage;
}

// True when any article still uses the image at this path or URL
export async function isImageInUse(url) {
    const [filename] = filenamesIn(url);
    if (!filename) return false;
    return (await mediaUsage()).has(filename);
}
