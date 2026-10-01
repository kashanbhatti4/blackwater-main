import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'blackwater_blog';

async function seed() {
    console.log('----------------------------------------------------');
    console.log('Blackwater Blog CMS - Database Initialization Script');
    console.log('----------------------------------------------------');
    console.log(`Connecting to MySQL host: ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);

    let rootConnection;
    try {
        // Step 1: Connect to MySQL server (without selecting DB first)
        rootConnection = await mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD
        });

        // Step 2: Ensure Database exists
        console.log(`Checking database "${DB_NAME}"...`);
        await rootConnection.query(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        console.log(`Database "${DB_NAME}" is ready.`);
        await rootConnection.end();

        // Step 3: Connect to specific Database
        const db = await mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            multipleStatements: true
        });

        // Step 4: Run schema.sql
        console.log('Running database/schema.sql to create tables...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await db.query(schemaSql);
        console.log('Database tables created/verified successfully.');

        // Step 5: Create Default Admin User
        const defaultAdminUsername = 'admin';
        const defaultAdminEmail = 'admin@bwdigitalmarketing.ie';
        const defaultAdminPass = 'AdminPassword2026!';

        const [existingAdmins] = await db.query('SELECT id FROM admins WHERE username = ? LIMIT 1', [defaultAdminUsername]);
        if (existingAdmins.length === 0) {
            console.log(`Creating default admin user: "${defaultAdminUsername}"...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultAdminPass, salt);

            await db.query(
                'INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)',
                [defaultAdminUsername, defaultAdminEmail, hashedPassword]
            );
            console.log('Default admin created successfully:');
            console.log(`   Username: ${defaultAdminUsername}`);
            console.log(`   Password: ${defaultAdminPass}`);
            console.log('   (Change this password in the admin dashboard after initial setup)');
        } else {
            console.log(`Admin user "${defaultAdminUsername}" already exists. Skipped admin creation.`);
        }

        // Step 6: Create Default Categories
        const categories = [
            { name: 'Paid Ads', slug: 'paid-ads' },
            { name: 'SEO', slug: 'seo' },
            { name: 'Web Design', slug: 'web-design' },
            { name: 'AI Search', slug: 'ai-search' },
            { name: 'Creative Strategy', slug: 'creative-strategy' }
        ];

        console.log('Seeding default categories...');
        const categoryMap = new Map();
        for (const cat of categories) {
            await db.query(
                'INSERT INTO categories (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
                [cat.name, cat.slug]
            );
            const [rows] = await db.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [cat.slug]);
            if (rows.length > 0) {
                categoryMap.set(cat.name, rows[0].id);
            }
        }

        // Step 7: Seed Initial Articles from article-data.js if table is empty
        const [existingBlogs] = await db.query('SELECT COUNT(*) as count FROM blogs');
        if (existingBlogs[0].count === 0) {
            console.log('Seeding initial journal articles...');
            const articleDataPath = path.join(__dirname, '../assets/js/article-data.js');

            if (fs.existsSync(articleDataPath)) {
                // Dynamically import or parse article-data.js
                const fileContent = fs.readFileSync(articleDataPath, 'utf8');
                // Extract articles array
                const match = fileContent.match(/const\s+articles\s*=\s*(\[[\s\S]*?\]);/);
                if (match) {
                    try {
                        const parsedArticles = eval(match[1]);
                        for (const art of parsedArticles) {
                            const categoryId = categoryMap.get(art.category) || null;
                            const slug = art.title
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '');

                            await db.query(`
                                INSERT INTO blogs (
                                    title, slug, excerpt, content, featured_image,
                                    category_id, category_name, status, reading_time,
                                    meta_title, meta_description, published_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, NOW())
                            `, [
                                art.title,
                                slug,
                                art.excerpt || '',
                                art.body || '',
                                art.image || null,
                                categoryId,
                                art.category,
                                art.readingTime || '5 min',
                                art.title,
                                art.excerpt || ''
                            ]);
                            console.log(`   + Seeded article: "${art.title}"`);
                        }
                    } catch (e) {
                        console.warn('Note: Could not parse article-data.js automatically:', e.message);
                    }
                }
            }
        } else {
            console.log(`Blogs table already contains ${existingBlogs[0].count} articles. Skipped article seed.`);
        }

        await db.end();
        console.log('----------------------------------------------------');
        console.log('Database initialization completed successfully!');
        console.log('----------------------------------------------------');
    } catch (err) {
        console.error('Database initialization error:');
        console.error(err.message);
        console.log('\nTroubleshooting tips:');
        console.log('1. Ensure MySQL is running on port ' + DB_PORT);
        console.log('2. Check DB_USER and DB_PASSWORD in your .env file');
        console.log('3. If using XAMPP/WAMP, ensure the MySQL service is started');
        process.exit(1);
    }
}

seed();
