// Cloudflare Turnstile: server-side verification of the widget token.
// Turned on only when both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set,
// so local development and a half-configured server keep working.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function clean(value) {
    return (value || '').replace(/^['"]|['"]$/g, '').trim();
}

export function turnstileSiteKey() {
    const siteKey = clean(process.env.TURNSTILE_SITE_KEY);
    return siteKey && clean(process.env.TURNSTILE_SECRET_KEY) ? siteKey : null;
}

function clientIp(req) {
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return req.headers['cf-connecting-ip'] || forwarded || (req.socket && req.socket.remoteAddress) || '';
}

/**
 * @returns {Promise<{ success: boolean, skipped?: boolean, errors?: string[] }>}
 */
export async function verifyTurnstile(token, req) {
    const secret = clean(process.env.TURNSTILE_SECRET_KEY);
    if (!secret || !turnstileSiteKey()) return { success: true, skipped: true };
    if (!token || typeof token !== 'string') return { success: false, errors: ['missing-input-response'] };

    try {
        const body = new URLSearchParams({ secret, response: token });
        const ip = clientIp(req);
        if (ip) body.append('remoteip', ip);
        const response = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
        const data = await response.json();
        if (!data.success) console.warn('Turnstile rejected a submission:', (data['error-codes'] || []).join(', '));
        return { success: Boolean(data.success), errors: data['error-codes'] || [] };
    } catch (error) {
        console.error('Turnstile verification failed:', error.message);
        return { success: false, errors: ['verification-unavailable'] };
    }
}
