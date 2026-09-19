import pool from '../config/db.js';
import { comparePassword, generateToken, requireAuth, parseCookies } from '../lib/auth-utils.js';

export default async function authHandler(req, res, subPath) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POST /api/auth/login
    if (subPath === '/login' && req.method === 'POST') {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: 'Username/Email and Password are required.' });
        }

        try {
            const [rows] = await pool.query(
                'SELECT * FROM admin_users WHERE username = ? OR email = ? LIMIT 1',
                [username, username]
            );

            if (rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials.' });
            }

            const user = rows[0];
            const isMatch = await comparePassword(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials.' });
            }

            const tokenPayload = {
                id: user.id,
                username: user.username,
                email: user.email
            };

            const token = generateToken(tokenPayload);

            // Set HTTP-Only Cookie
            res.setHeader('Set-Cookie', `admin_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);

            return res.status(200).json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            });
        } catch (err) {
            console.error('[Auth Error]', err);
            return res.status(500).json({ error: 'Database error during authentication.' });
        }
    }

    // POST /api/auth/logout
    if (subPath === '/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0');
        return res.status(200).json({ message: 'Logged out successfully.' });
    }

    // GET /api/auth/me
    if (subPath === '/me' && req.method === 'GET') {
        const user = requireAuth(req, res);
        if (!user) return; // Response sent by requireAuth

        return res.status(200).json({ user });
    }

    return res.status(404).json({ error: 'Auth endpoint not found.' });
}
