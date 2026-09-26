'use strict';
const bcrypt = require('bcryptjs');
const db     = require('../db');

// Replaces the removed Setup wizard's one-time "create admin" step (Batch
// 29 item 1) — Admin credentials now come from ADMIN_USERNAME/
// ADMIN_PASSWORD in the environment instead of a first-run form, hashed
// and stored in the admins table exactly the same way any admin password
// is. Runs at every startup, but only ever INSERTs when the table is
// genuinely empty: an admin who changes their password afterward via
// Admin > Change Password keeps that change across restarts even if
// ADMIN_PASSWORD in .env still holds the original value — this only ever
// bootstraps the first admin, it never overwrites one that already exists.
async function bootstrapAdmin() {
    if (!db.isConfigured()) return;
    try {
        const [[{ c }]] = await db.query('SELECT COUNT(*) AS c FROM admins');
        if (c > 0) return;

        const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
        if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
            console.warn(
                '[Admin] No admin account exists yet, and ADMIN_USERNAME/ADMIN_PASSWORD ' +
                'are not set in the environment — set them and restart to create the first admin login.'
            );
            return;
        }

        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await db.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [ADMIN_USERNAME, hash]);
        console.log(`[Admin] Created admin account "${ADMIN_USERNAME}" from ADMIN_USERNAME/ADMIN_PASSWORD.`);
    } catch (e) {
        console.error('[Admin] Bootstrap failed:', e.message);
    }
}

module.exports = { bootstrapAdmin };
