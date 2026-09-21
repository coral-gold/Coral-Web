'use strict';
const router     = require('express').Router();
const nodemailer = require('nodemailer');
const db         = require('../db');

// GET /api/public/content — site content (no auth required for reading)
router.get('/content', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT key_name, value FROM content');
        const data   = Object.fromEntries(rows.map(r => [r.key_name, r.value]));
        res.json({ ok: true, content: data });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// POST /api/public/contact
router.post('/contact', async (req, res) => {
    const { name, company, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.json({ ok: false, error: 'Name, email and message are required.' });
    }

    try {
        const [[toRow]] = await db.query("SELECT value FROM content WHERE key_name='contact_email'").catch(() => [[null]]);
        const to = toRow?.value || process.env.CONTACT_TO || 'info@coralgold.in';

        if (process.env.SMTP_HOST) {
            const transporter = nodemailer.createTransport({
                host:   process.env.SMTP_HOST,
                port:   parseInt(process.env.SMTP_PORT) || 587,
                secure: false,
                auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
            await transporter.sendMail({
                from:    `"Coral Gold Website" <${process.env.SMTP_USER}>`,
                to,
                subject: `New enquiry from ${name}${company ? ' – ' + company : ''}`,
                text:    `Name: ${name}\nCompany: ${company || '—'}\nEmail: ${email}\nPhone: ${phone || '—'}\n\nMessage:\n${message}`,
            });
        } else {
            console.log('[contact]', { name, company, email, phone, message });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: 'Failed to send message.' });
    }
});

module.exports = router;
