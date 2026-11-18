// Black Friday 2026 claim form (black-friday.html): checks a claim and builds the email to the team.
// The page keeps its own copy of the closing time and the claimed count (window.BF_OFFER in its <head>).

// 11:59pm on Monday 30 November 2026, Irish time (Ireland is on GMT in winter)
export const BLACK_FRIDAY_CLOSES_AT = Date.parse('2026-12-01T00:00:00Z');

const VAT_RATE = 0.23;

const OPTIONS = {
    '1': { name: 'Starter Website', price: 750, normal: 1500 },
    '2': { name: 'Business Website', price: 1250, normal: 2500 },
    '3': { name: 'Online Store', price: 2500, normal: 5000 },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function text(body, key, maxLength) {
    const value = body && body[key];
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function euro(amount) {
    const cents = Math.round(amount * 100) % 100 !== 0;
    return '€' + amount.toLocaleString('en-IE', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

function row(label, valueHtml) {
    return `<p style="font-size: 15px; margin: 0 0 12px 0; color: #FFFCE1;"><strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 4px;">${label}</strong>${valueHtml}</p>`;
}

/**
 * @returns {{ status: number, error: string } | { subject: string, html: string, replyTo: string }}
 */
export function buildBlackFridayEmail(body, now = Date.now()) {
    if (now >= BLACK_FRIDAY_CLOSES_AT) {
        return { status: 410, error: 'The Black Friday offer closed at 11:59pm on Monday 30 November.' };
    }

    const option = OPTIONS[String(body && body.option)];
    const name = text(body, 'name', 120);
    const business = text(body, 'business', 160);
    const email = text(body, 'email', 200);
    const phone = text(body, 'phone', 40);
    const website = text(body, 'website', 300);
    const notes = text(body, 'notes', 3000);

    if (!option) return { status: 400, error: 'Please choose which website you want.' };
    if (!name || !business || !email || !phone) {
        return { status: 400, error: 'Please fill in your name, business name, email and phone number.' };
    }
    if (!EMAIL_PATTERN.test(email)) return { status: 400, error: 'Please check your email address.' };

    const optionNumber = String(body.option);
    const withVat = Math.round(option.price * (1 + VAT_RATE) * 100) / 100;
    const websiteHref = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const received = new Date(now).toLocaleString('en-IE', {
        timeZone: 'Europe/Dublin', dateStyle: 'full', timeStyle: 'short',
    });

    const subject = `Black Friday claim: Option ${optionNumber}, ${option.name} (${euro(option.price)} ex VAT) from ${business}`
        .replace(/[\r\n]+/g, ' ');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #2A2B25; border-radius: 8px; background-color: #0E100F; color: #FFFCE1;">
            <div style="border-bottom: 2px solid #FFE32A; padding-bottom: 14px; margin-bottom: 20px;">
                <h2 style="color: #FFE32A; margin: 0; font-size: 22px; letter-spacing: 0.5px;">New Black Friday claim</h2>
                <p style="color: #7C7C70; margin: 6px 0 0 0; font-size: 13px;">Received via the Black Friday page on ${escapeHtml(received)}</p>
            </div>
            <div style="background-color: #171918; padding: 18px; border-radius: 6px; margin-bottom: 20px;">
                ${row('Option', `Option ${optionNumber}: ${escapeHtml(option.name)}`)}
                ${row('Price', `${euro(option.price)} ex VAT (${euro(withVat)} with 23% VAT). Normally ${euro(option.normal)} ex VAT.`)}
            </div>
            <div style="background-color: #171918; padding: 18px; border-radius: 6px; margin-bottom: 20px;">
                ${row('Name', escapeHtml(name))}
                ${row('Business', escapeHtml(business))}
                ${row('Email', `<a href="mailto:${escapeHtml(email)}" style="color: #FFE32A; text-decoration: none;">${escapeHtml(email)}</a>`)}
                ${row('Phone', `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ''))}" style="color: #FFE32A; text-decoration: none;">${escapeHtml(phone)}</a>`)}
                ${row('Current website', website
                    ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener noreferrer" style="color: #FFE32A; text-decoration: underline;">${escapeHtml(website)}</a>`
                    : '<span style="color: #7C7C70;">None given</span>')}
            </div>
            ${notes ? `
            <div style="padding: 18px; background-color: #171918; border-left: 3px solid #FFE32A; border-radius: 4px; margin-bottom: 20px;">
                <strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 8px;">Notes</strong>
                <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #FFFCE1; white-space: pre-wrap;">${escapeHtml(notes)}</p>
            </div>` : ''}
            <p style="font-size: 13px; line-height: 1.6; margin: 0; color: #A0A092;">Next step: email ${escapeHtml(name)} the invoice and bank details. The place counts once payment reaches the account, so raise <code style="color: #FFE32A;">claimed</code> in black-friday.html then.</p>
        </div>
    `;

    return { subject, html, replyTo: email };
}
