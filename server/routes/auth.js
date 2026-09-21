'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');

// ── Party ─────────────────────────────────────────────────────────────────────

router.get('/party/me', (req, res) => {
    if (!req.session.partyId) return res.json({ ok: false });
    res.json({ ok: true, party: req.session.party });
});

router.post('/party/login', async (req, res) => {
    const { partyId, password } = req.body;
    if (!partyId || !password) return res.json({ ok: false, error: 'Party ID and password required.' });

    // Throttle: 5 attempts per 10 min per IP
    const ipKey = 'login_' + (req.ip || 'x');
    const now   = Date.now();
    if (!req.session._loginAttempts) req.session._loginAttempts = {};
    const att   = req.session._loginAttempts;
    att[ipKey]  = (att[ipKey] || []).filter(t => now - t < 10 * 60 * 1000);
    if (att[ipKey].length >= 5) {
        return res.json({ ok: false, error: 'Too many attempts. Please wait 10 minutes.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM parties WHERE party_id = ?', [partyId]);
        const party  = rows[0];
        if (!party || !await bcrypt.compare(password, party.password_hash)) {
            att[ipKey].push(now);
            return res.json({ ok: false, error: 'Invalid Party ID or password.' });
        }
        if (!party.is_active) {
            return res.json({ ok: false, error: 'This account has been disabled.' });
        }
        att[ipKey] = [];
        req.session.partyId = party.id;
        req.session.party   = { id: party.id, partyId: party.party_id, companyName: party.company_name };
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: 'Server error.' });
    }
});

router.post('/party/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

router.get('/admin/me', (req, res) => {
    if (!req.session.adminId) return res.json({ ok: false });
    res.json({ ok: true, admin: req.session.admin });
});

router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ ok: false, error: 'Username and password required.' });

    const ipKey = 'admin_' + (req.ip || 'x');
    const now   = Date.now();
    if (!req.session._adminAttempts) req.session._adminAttempts = {};
    const att   = req.session._adminAttempts;
    att[ipKey]  = (att[ipKey] || []).filter(t => now - t < 10 * 60 * 1000);
    if (att[ipKey].length >= 5) {
        return res.json({ ok: false, error: 'Too many attempts.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        const admin  = rows[0];
        if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
            att[ipKey].push(now);
            return res.json({ ok: false, error: 'Invalid credentials.' });
        }
        att[ipKey] = [];
        req.session.adminId = admin.id;
        req.session.admin   = { id: admin.id, username: admin.username };
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: 'Server error.' });
    }
});

router.post('/admin/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
