import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'blackwater_dev_jwt_secret_key_2026_secure';
const TOKEN_EXPIRY = '7d';

export async function hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
}

export async function comparePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
}

export function generateToken(admin) {
    return jwt.sign(
        {
            id: admin.id,
            username: admin.username,
            email: admin.email
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Extract token from request Authorization header or Cookie
 */
export function extractToken(req) {
    // 1. Check Authorization header: Bearer <token>
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }

    // 2. Check Cookie header: admin_token=<token>
    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        for (const cookie of cookies) {
            if (cookie.startsWith('admin_token=')) {
                return decodeURIComponent(cookie.substring('admin_token='.length));
            }
        }
    }

    return null;
}

/**
 * Middleware-like check: returns admin object if authenticated, or null
 */
export function authenticateAdmin(req) {
    const token = extractToken(req);
    if (!token) return null;
    return verifyToken(token);
}
