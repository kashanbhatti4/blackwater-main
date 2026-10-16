import { turnstileSiteKey } from '../lib/turnstile.js';

/**
 * GET /api/turnstile-config - public site key for the Turnstile widget (null when not configured)
 */
export default async function turnstileConfigHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ siteKey: turnstileSiteKey() });
}
