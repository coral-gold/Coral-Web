'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const throttle = require('../lib/loginThrottle');

// The verbose Hostinger-specific hints below are only for the deployer
// setting the site up for the first time (surfaced right on the public
// login pages, since there's no admin session to gate them behind before
// setup runs). Once the database is genuinely configured, a login error is
// a live-site runtime problem, not a setup one — the previous, always-on
// version of this kept leaking DB host/error/code detail (down to the raw
// driver message on an unrecognized error) to any unauthenticated caller on
// every DB hiccup, forever, which the Batch 28 privacy/security audit
// flagged. Full detail always still goes to the server console via the
// console.error already at each call site below.
function dbErrorMessage(e) {
    if (db.isConfigured()) return 'Server error. Please try again shortly.';
    const m = e.message || '';
    if (m.startsWith('Database not configured'))
        return 'Database not configured. Set DB_HOST/DB_USER/DB_PASS/DB_NAME in the environment.';
    if (e.code === 'ECONNREFUSED')
        return `DB connection refused (${e.address || 'host'}). Check DB_HOST / DB_PORT.`;
    if (e.code === 'ER_ACCESS_DENIED_ERROR' || e.code === 'ER_DBACCESS_DENIED_ERROR')
        return `DB access denied (${e.code}). In Hostinger hPanel → Databases → MySQL Databases, add the user to the database and grant All Privileges. Also ensure DB_NAME matches the exact lowercase name shown in hPanel.`;
    if (e.code === 'ER_BAD_DB_ERROR')
        return `Database "${e.sqlMessage?.match(/'([^']+)'/)?.[1] || 'unknown'}" does not exist. Check DB_NAME — Hostinger database names are lowercase.`;
    if (e.code === 'ER_NO_SUCH_TABLE')
        return 'Database tables not found. Restart the server to recreate the schema.';
    return `Server error: ${m}`;
}

// ── Party ─────────────────────────────────────────────────────────────────────

router.get('/party/me', (req, res) => {
    if (!req.session.partyId) return res.json({ ok: false });
    res.json({ ok: true, party: req.session.party });
});

router.post('/party/login', async (req, res) => {
    const { partyId, password } = req.body;
    if (!partyId || !password) return res.json({ ok: false, error: 'Party ID and password required.' });

    // Real server-side throttle keyed by IP *and* by the account being
    // attempted — either one tripping blocks the request, so a scripted
    // attacker can't dodge the limit just by not sending a session cookie
    // (the previous req.session-based counter reset for every request that
    // did that), nor by rotating IPs against one target account.
    const ipKey   = `party_ip_${req.ip || 'x'}`;
    const acctKey = `party_acct_${String(partyId).toLowerCase()}`;
    if (throttle.isBlocked(ipKey) || throttle.isBlocked(acctKey)) {
        const mins = Math.max(throttle.minutesRemaining(ipKey), throttle.minutesRemaining(acctKey));
        return res.json({ ok: false, error: `Too many failed attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.` });
    }

    try {
        const [[wRow]] = await db.query("SELECT value FROM content WHERE key_name = 'wholesaler_enabled'").catch(() => [null]);
        if (wRow?.value === '0') {
            return res.json({ ok: false, error: 'The wholesaler ordering module is currently disabled.' });
        }

        const [rows] = await db.query('SELECT * FROM parties WHERE party_id = ?', [partyId]);
        const party  = rows[0];
        if (!party || !await bcrypt.compare(password, party.password_hash)) {
            throttle.recordFailure(ipKey);
            throttle.recordFailure(acctKey);
            return res.json({ ok: false, error: 'Invalid Party ID or password.' });
        }
        if (!party.is_active) {
            return res.json({ ok: false, error: 'This account has been disabled.' });
        }
        throttle.recordSuccess(ipKey);
        throttle.recordSuccess(acctKey);
        req.session.partyId = party.id;
        req.session.party   = { id: party.id, partyId: party.party_id, companyName: party.company_name };
        res.json({ ok: true });
    } catch (e) {
        console.error('[party/login]', e.message);
        const msg = dbErrorMessage(e);
        res.json({ ok: false, error: msg });
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

    // See the comment on /party/login above — same server-side, cookie-
    // independent throttle, keyed by IP and by the account being attempted.
    const ipKey   = `admin_ip_${req.ip || 'x'}`;
    const acctKey = `admin_acct_${String(username).toLowerCase()}`;
    if (throttle.isBlocked(ipKey) || throttle.isBlocked(acctKey)) {
        const mins = Math.max(throttle.minutesRemaining(ipKey), throttle.minutesRemaining(acctKey));
        return res.json({ ok: false, error: `Too many failed attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.` });
    }

    try {
        const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        const admin  = rows[0];
        if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
            throttle.recordFailure(ipKey);
            throttle.recordFailure(acctKey);
            return res.json({ ok: false, error: 'Invalid credentials.' });
        }
        throttle.recordSuccess(ipKey);
        throttle.recordSuccess(acctKey);
        req.session.adminId = admin.id;
        req.session.admin   = { id: admin.id, username: admin.username };
        res.json({ ok: true });
    } catch (e) {
        console.error('[admin/login]', e.message);
        const msg = dbErrorMessage(e);
        res.json({ ok: false, error: msg });
    }
});

router.post('/admin/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// Self-service password change — the admin account itself is bootstrapped
// from ADMIN_USERNAME/ADMIN_PASSWORD once, at first startup (Batch 29 item
// 1); this is how the password actually gets changed day to day afterward.
router.post('/admin/change-password', async (req, res) => {
    if (!req.session.adminId) return res.status(401).json({ ok: false, error: 'Not logged in.' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.json({ ok: false, error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
        return res.json({ ok: false, error: 'New password must be at least 6 characters.' });
    }
    try {
        const [[admin]] = await db.query('SELECT * FROM admins WHERE id = ?', [req.session.adminId]);
        if (!admin || !await bcrypt.compare(currentPassword, admin.password_hash)) {
            return res.json({ ok: false, error: 'Current password is incorrect.' });
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, admin.id]);
        res.json({ ok: true });
    } catch (e) {
        console.error('[admin/change-password]', e.message);
        res.json({ ok: false, error: dbErrorMessage(e) });
    }
});

module.exports = router;
