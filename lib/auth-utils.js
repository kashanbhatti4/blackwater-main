import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_blackwater_2026';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

export function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}

export function requireAuth(req, res) {
    let token = null;

    // Check Authorization header first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    // Check Cookie header if no bearer token
    if (!token) {
        const cookies = parseCookies(req);
        token = cookies.admin_token;
    }

    if (!token) {
        res.status(401).json({ error: 'Unauthorized. Authentication token missing.' });
        return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
        return null;
    }

    return decoded;
}
