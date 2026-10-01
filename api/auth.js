import { query } from '../lib/db.js';
import { comparePassword, generateToken, authenticateAdmin } from '../lib/auth.js';

export default async function authHandler(req, res, pathname) {
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        try {
            const admins = await query(
                'SELECT * FROM admins WHERE username = ? OR email = ? LIMIT 1',
                [username, username]
            );

            if (admins.length === 0) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const admin = admins[0];
            const isValid = await comparePassword(password, admin.password_hash);

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const token = generateToken(admin);

            // Set secure cookie as well as returning in JSON
            res.setHeader(
                'Set-Cookie',
                `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
            );

            return res.status(200).json({
                message: 'Login successful',
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: 'Database error during authentication' });
        }
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
        const admin = authenticateAdmin(req);
        if (!admin) {
            return res.status(401).json({ authenticated: false, error: 'Unauthorized' });
        }
        return res.status(200).json({ authenticated: true, admin });
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        res.setHeader(
            'Set-Cookie',
            'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
        );
        return res.status(200).json({ message: 'Logged out successfully' });
    }

    return res.status(404).json({ error: 'Auth endpoint not found' });
}
