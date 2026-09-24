'use strict';
const router     = require('express').Router();
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const db         = require('../db');
const { requireSiteUnlocked } = require('../middleware/siteLock');

// GET /api/public/settings — always accessible, never gated by the site
// lock itself (the lock screen needs it to know whether to even show up),
// and never exposes the lock password hash or the admin-only PDF layout.
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT key_name, value FROM content WHERE key_name IN ('wholesaler_enabled','site_lock_enabled','show_net_weight','show_gross_weight','show_amount','product_image_fit','pagination_mode')"
        );
        const raw = Object.fromEntries(rows.map(r => [r.key_name, r.value]));
        const IMAGE_FIT_MODES = ['cover', 'contain', 'fill', 'scale-down'];
        const PAGINATION_MODES = ['classic', 'load_more', 'infinite'];
        res.json({
            ok: true,
            settings: {
                wholesalerEnabled: raw.wholesaler_enabled !== '0',
                siteLockEnabled:   raw.site_lock_enabled === '1',
                showNetWeight:     raw.show_net_weight   !== '0',
                showGrossWeight:   raw.show_gross_weight !== '0',
                showAmount:        raw.show_amount       !== '0',
                productImageFit:   IMAGE_FIT_MODES.includes(raw.product_image_fit) ? raw.product_image_fit : 'cover',
                paginationMode:    PAGINATION_MODES.includes(raw.pagination_mode) ? raw.pagination_mode : 'classic',
            },
        });
    } catch (e) {
        // Before first DB setup, or on an older DB pre-migration — the public
        // site should still render with sensible defaults, not break.
        res.json({ ok: true, settings: { wholesalerEnabled: true, siteLockEnabled: false, showNetWeight: true, showGrossWeight: true, showAmount: true, productImageFit: 'cover', paginationMode: 'classic' } });
    }
});

// POST /api/public/site-lock/verify  { password }
router.post('/site-lock/verify', async (req, res) => {
    const { password } = req.body;
    if (!password) return res.json({ ok: false, error: 'Password required.' });

    const ipKey = 'sitelock_' + (req.ip || 'x');
    const now   = Date.now();
    if (!req.session._siteLockAttempts) req.session._siteLockAttempts = {};
    const att   = req.session._siteLockAttempts;
    att[ipKey]  = (att[ipKey] || []).filter(t => now - t < 10 * 60 * 1000);
    if (att[ipKey].length >= 8) {
        return res.json({ ok: false, error: 'Too many attempts. Please wait 10 minutes.' });
    }

    try {
        const [[row]] = await db.query("SELECT value FROM content WHERE key_name = 'site_lock_password_hash'");
        if (!row?.value || !await bcrypt.compare(password, row.value)) {
            att[ipKey].push(now);
            return res.json({ ok: false, error: 'Incorrect password.' });
        }
        req.session.siteLockOk = true;
        res.json({ ok: true });
    } catch (e) {
        console.error('[site-lock/verify]', e.message);
        res.json({ ok: false, error: 'Server error.' });
    }
});

// GET /api/public/content — site content (no auth required for reading)
router.get('/content', requireSiteUnlocked, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT key_name, value FROM content');
        const data   = Object.fromEntries(rows.map(r => [r.key_name, r.value]));
        res.json({ ok: true, content: data });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// POST /api/public/contact
router.post('/contact', requireSiteUnlocked, async (req, res) => {
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
