// Uploaded images are stored as /uploads/blogs/<file> in the database. Some hosting setups only
// route /api/* to this Node app (static files come from Apache), so responses hand out
// /api/uploads/blogs/<file> instead, which the app serves itself. Saving maps them back.

const STORED = '/uploads/blogs/';
const SERVED = '/api/uploads/blogs/';

export function toServedUrl(url) {
    return typeof url === 'string' && url.startsWith(STORED) ? SERVED + url.slice(STORED.length) : url;
}

export function toStoredUrl(url) {
    return typeof url === 'string' && url.startsWith(SERVED) ? STORED + url.slice(SERVED.length) : url;
}

// Image src attributes inside article HTML
export function toServedHtml(html) {
    return typeof html === 'string' ? html.replace(/(src=["'])\/uploads\/blogs\//g, `$1${SERVED}`) : html;
}

export function toStoredHtml(html) {
    return typeof html === 'string' ? html.replace(/(src=["'])\/api\/uploads\/blogs\//g, `$1${STORED}`) : html;
}

export function servedBlog(blog) {
    if (!blog) return blog;
    if (blog.featured_image) blog.featured_image = toServedUrl(blog.featured_image);
    if (blog.content) blog.content = toServedHtml(blog.content);
    return blog;
}
