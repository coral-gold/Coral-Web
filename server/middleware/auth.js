'use strict';
const db = require('../db');

async function requireParty(req, res, next) {
    if (!req.session.partyId) {
        return res.status(401).json({ ok: false, error: 'Login required' });
    }
    // Admin can disable the whole wholesaler module (Settings) at any time —
    // check on every request so an already-open session is cut off
    // immediately too, not just new logins.
    try {
        const [[row]] = await db.query("SELECT value FROM content WHERE key_name = 'wholesaler_enabled'");
        if (row?.value === '0') {
            return res.status(423).json({ ok: false, error: 'The wholesaler ordering module is currently disabled.' });
        }
    } catch (e) { /* DB hiccup — don't lock everyone out over it */ }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ ok: false, error: 'Admin login required' });
    }
    next();
}

module.exports = { requireParty, requireAdmin };
