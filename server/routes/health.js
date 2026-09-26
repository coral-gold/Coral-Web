'use strict';
const router = require('express').Router();
const db     = require('../db');

// GET /api/health — diagnostic check (DB connection + schema + admin).
// Unauthenticated by necessity (there's no admin account to log in as
// before setup runs), and linked right on the public login pages as "View
// Diagnostics" — but that only needs to be this detailed while the site
// genuinely isn't configured yet. Once it is, it used to keep revealing
// DB_HOST/DB_USER/DB_NAME and raw DB error text to any unauthenticated
// visitor who clicked the link (found in the Batch 28 privacy/security
// audit); now it drops straight to a bare up/down signal instead.
router.get('/', async (req, res) => {
    if (!db.isConfigured()) {
        return res.json({
            env: {
                DB_HOST: process.env.DB_HOST || '(not set)',
                DB_USER: process.env.DB_USER || '(not set)',
                DB_PASS: process.env.DB_PASS ? '(set)' : '(not set)',
                DB_NAME: process.env.DB_NAME || '(not set)',
                SESSION_SECRET: process.env.SESSION_SECRET ? '(set)' : '(not set — using default)',
            },
            db_configured: false,
            db_connect:    false,
            schema_ok:     false,
            admin_exists:  false,
            error: 'No database config found. Set DB_HOST/DB_USER/DB_PASS/DB_NAME env vars, or visit /setup.',
        });
    }

    try {
        await db.query('SELECT 1 FROM admins LIMIT 1');
        res.json({ ok: true });
    } catch (e) {
        console.error('[health]', e.message);
        res.json({ ok: false });
    }
});

module.exports = router;
