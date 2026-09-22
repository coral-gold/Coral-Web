'use strict';
const router  = require('express').Router();
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');
const db      = require('../db');

const CONFIG_FILE = path.join(__dirname, '../config.json');
const SCHEMA_FILE = path.join(__dirname, '../../schema.sql');

// GET /api/setup/status
router.get('/status', async (req, res) => {
    if (!db.isConfigured()) {
        return res.json({ configured: false, reason: 'no_config' });
    }
    try {
        await db.query('SELECT 1');
        const [rows] = await db.query('SELECT COUNT(*) AS c FROM admins');
        if (rows[0].c === 0) {
            return res.json({ configured: false, reason: 'no_admin' });
        }
        res.json({ configured: true });
    } catch (e) {
        res.json({ configured: false, reason: 'db_error', detail: e.message });
    }
});

// POST /api/setup/test-db — test DB connection without saving anything
router.post('/test-db', async (req, res) => {
    const { host, user, password, database } = req.body;
    if (!host || !user || !database) {
        return res.json({ ok: false, error: 'Host, user and database are required.' });
    }
    let conn;
    try {
        conn = await mysql.createConnection({ host, user, password: password || '', database, connectTimeout: 8000 });
        await conn.ping();
        res.json({ ok: true });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    } finally {
        if (conn) conn.end().catch(() => {});
    }
});

// POST /api/setup/run — run full setup: schema + admin user + save config
router.post('/run', async (req, res) => {
    const { host, user, password, database, adminUser, adminPass } = req.body;
    if (!host || !user || !database || !adminUser || !adminPass) {
        return res.json({ ok: false, error: 'All fields are required.' });
    }
    let conn;
    try {
        conn = await mysql.createConnection({
            host, user, password: password || '', database,
            connectTimeout: 10000,
            multipleStatements: true,
        });

        // Run schema
        const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
        await conn.query(schema);

        // Create / update admin user
        const hash = await bcrypt.hash(adminPass, 10);
        await conn.query(
            'INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
            [adminUser, hash]
        );

        await conn.end();
        conn = null;

        // Persist config
        const cfg = { DB_HOST: host, DB_USER: user, DB_PASS: password || '', DB_NAME: database };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));

        // Reinitialise the live pool
        db.reinit({ host, user, password: password || '', database });

        res.json({ ok: true });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    } finally {
        if (conn) conn.end().catch(() => {});
    }
});

module.exports = router;
