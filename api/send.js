export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { name, email, service, message } = req.body;
    
    if (!name || !email || !service || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        return res.status(500).json({ error: 'Resend API key is not configured on the server' });
    }
    
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Blackwater Digital <onboarding@resend.dev>';
    const toEmail = process.env.CONTACT_TO_EMAIL || 'info@blackwaterdigital.ie';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: fromEmail,
                to: toEmail,
                subject: `New Lead: ${service} from ${name}`,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #2A2B25; border-radius: 8px; background-color: #0E100F; color: #FFFCE1;">
                        <div style="border-bottom: 2px solid #FFE32A; padding-bottom: 14px; margin-bottom: 20px;">
                            <h2 style="color: #FFE32A; margin: 0; font-size: 22px; letter-spacing: 0.5px;">New Website Lead Submission</h2>
                            <p style="color: #7C7C70; margin: 6px 0 0 0; font-size: 13px;">Received via Blackwater Digital contact form</p>
                        </div>
                        <div style="background-color: #171918; padding: 18px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="font-size: 15px; margin: 0 0 10px 0; color: #FFFCE1;"><strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 4px;">Name</strong>${name}</p>
                            <p style="font-size: 15px; margin: 0 0 10px 0; color: #FFFCE1;"><strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 4px;">Email</strong><a href="mailto:${email}" style="color: #FFE32A; text-decoration: none;">${email}</a></p>
                            <p style="font-size: 15px; margin: 0; color: #FFFCE1;"><strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 4px;">Service Requested</strong>${service}</p>
                        </div>
                        <div style="padding: 18px; background-color: #171918; border-left: 3px solid #FFE32A; border-radius: 4px;">
                            <strong style="color: #7C7C70; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 8px;">Message</strong>
                            <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #FFFCE1; white-space: pre-wrap;">${message}</p>
                        </div>
                    </div>
                `
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return res.status(200).json({ message: 'Email sent successfully', id: data.id });
        } else {
            return res.status(response.status).json({ error: data.message || 'Failed to send email' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
