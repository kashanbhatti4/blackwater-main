// npm run import-posts: publish any new posts from database/posts/ (each file only once)
import pool from '../lib/db.js';
import { importPendingPosts } from '../lib/content-import.js';

try {
    const { imported, skipped } = await importPendingPosts();
    console.log(`Done: ${imported} published, ${skipped} skipped (already on the site).`);
} catch (error) {
    console.error('Import failed:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
