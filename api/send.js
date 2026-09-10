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
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: 'Blackwater Website <onboarding@resend.dev>', // Change to your verified Resend domain once configured
                to: 'info@bwdigitalmarketing.ie', // Receive lead submissions here
                subject: `New Lead: ${service} from ${name}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                        <h2 style="color: #131615; border-bottom: 2px solid #87BAB2; padding-bottom: 10px;">New Contact Lead Submission</h2>
                        <p style="font-size: 16px; line-height: 1.5;"><strong>Name:</strong> ${name}</p>
                        <p style="font-size: 16px; line-height: 1.5;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        <p style="font-size: 16px; line-height: 1.5;"><strong>Service Requested:</strong> ${service}</p>
                        <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #F17752;">
                            <p style="font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
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
