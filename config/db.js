import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blackwater_blog',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    multipleStatements: true
};

export const pool = mysql.createPool(dbConfig);

// Helper to check DB health and auto-create database & tables if missing
export async function initDatabase() {
    try {
        // Step 1: Connect without database specified to ensure DB exists
        const rootConnection = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password
        });

        await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await rootConnection.end();

        // Step 2: Connect via connection pool to the database
        const connection = await pool.getConnection();
        console.log(`[MySQL] Successfully connected to database '${dbConfig.database}' on ${dbConfig.host}:${dbConfig.port}`);
        
        // Execute schema.sql if tables do not exist
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await connection.query(schemaSql);
            console.log('[MySQL] Schema verification / initialization completed.');
        }

        // Check if admin user exists, if not run seed.sql
        const [users] = await connection.query('SELECT COUNT(*) as count FROM admin_users');
        if (users[0].count === 0) {
            const seedPath = path.join(__dirname, '../database/seed.sql');
            if (fs.existsSync(seedPath)) {
                const seedSql = fs.readFileSync(seedPath, 'utf8');
                await connection.query(seedSql);
                console.log('[MySQL] Seed data & initial admin user created.');
            }
        }

        connection.release();
        return true;
    } catch (err) {
        console.warn(`[MySQL Warning] Could not connect to database '${dbConfig.database}': ${err.message}`);
        console.warn('[MySQL Warning] The application will continue running, but database features will return server errors until MySQL is configured properly.');
        return false;
    }
}

export default pool;

