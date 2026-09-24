'use strict';
const db = require('../db');

// Gates the public marketing site (Home/About/Catalog/Contact) behind a
// single shared password when Admin enables it in Settings. Wholesaler and
// Admin have their own logins and are never affected by this — a wholesaler
// or admin can always get in, including to turn the lock back off.
async function requireSiteUnlocked(req, res, next) {
    try {
        const [[row]] = await db.query("SELECT value FROM content WHERE key_name = 'site_lock_enabled'");
        if (row?.value !== '1' || req.session.siteLockOk) return next();
        res.status(423).json({ ok: false, locked: true, error: 'This site is locked.' });
    } catch (e) {
        // DB not configured yet, or table missing — never let a broken lock
        // check take the whole public site down.
        next();
    }
}

module.exports = { requireSiteUnlocked };
