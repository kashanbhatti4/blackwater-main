import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Accept a host pasted as a URL ("https://db.example.com/") as well as a bare host name
const dbHost = (process.env.DB_HOST || 'localhost').trim().replace(/^['"]|['"]$/g, '').replace(/^[a-z]+:\/\//i, '').split('/')[0];

const pool = mysql.createPool({
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blackwater_blog',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    charset: 'utf8mb4'
});

/**
 * Execute a query with parameters using the connection pool
 */
export async function query(sql, params = []) {
    const [results] = await pool.execute(sql, params);
    return results;
}

/**
 * Health check helper to test database connectivity
 */
export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

export default pool;
