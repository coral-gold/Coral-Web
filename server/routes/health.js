'use strict';
const router = require('express').Router();
const db     = require('../db');

// GET /api/health — diagnostic check (DB connection + schema + admin)
router.get('/', async (req, res) => {
    const report = {
        env: {
            DB_HOST: process.env.DB_HOST || '(not set)',
            DB_USER: process.env.DB_USER || '(not set)',
            DB_PASS: process.env.DB_PASS ? '(set)' : '(not set)',
            DB_NAME: process.env.DB_NAME || '(not set)',
            SESSION_SECRET: process.env.SESSION_SECRET ? '(set)' : '(not set — using default)',
        },
        db_configured: db.isConfigured(),
        db_connect:    false,
        schema_ok:     false,
        admin_exists:  false,
        error:         null,
    };

    if (!report.db_configured) {
        report.error = 'No database config found. Set DB_HOST/DB_USER/DB_PASS/DB_NAME env vars, or visit /setup.';
        return res.json(report);
    }

    try {
        await db.query('SELECT 1');
        report.db_connect = true;
    } catch (e) {
        const hint =
            e.code === 'ER_DBACCESS_DENIED_ERROR' || e.code === 'ER_ACCESS_DENIED_ERROR'
                ? ' → In Hostinger hPanel, add the DB user to the database and grant All Privileges. Also check DB_NAME is lowercase.'
                : e.code === 'ECONNREFUSED' ? ' → Check DB_HOST value.' : '';
        report.error = `DB connection failed (${e.code || 'ERR'}): ${e.message}${hint}`;
        return res.json(report);
    }

    try {
        await db.query('SELECT 1 FROM admins LIMIT 1');
        report.schema_ok = true;
    } catch (e) {
        report.error = 'Tables not found. Visit /setup to initialise the schema.';
        return res.json(report);
    }

    try {
        const [rows] = await db.query('SELECT COUNT(*) AS c FROM admins');
        report.admin_exists = rows[0].c > 0;
        if (!report.admin_exists) report.error = 'No admin user found. Visit /setup to create one.';
    } catch (e) {
        report.error = `Admin check failed: ${e.message}`;
    }

    res.json(report);
});

module.exports = router;
