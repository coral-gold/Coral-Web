'use strict';
const bcrypt = require('bcryptjs');
const db     = require('../db');

// Replaces the removed Setup wizard's one-time "create admin" step (Batch
// 29 item 1) — Admin credentials now come from ADMIN_USERNAME/
// ADMIN_PASSWORD in the environment instead of a first-run form, hashed and
// stored in the admins table exactly the same way any admin password is.
// Runs at every startup and keeps that account's password in sync with
// ADMIN_PASSWORD: if .env is changed and the server restarts, the login
// updates to match. Cheap no-op the rest of the time — bcrypt.compare is
// used to check whether an update is even needed, so a restart with an
// unchanged .env never rewrites the hash.
async function bootstrapAdmin() {
    if (!db.isConfigured()) return;
    try {
        const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
        if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
            const [[{ c }]] = await db.query('SELECT COUNT(*) AS c FROM admins');
            if (c === 0) {
                console.warn(
                    '[Admin] No admin account exists yet, and ADMIN_USERNAME/ADMIN_PASSWORD ' +
                    'are not set in the environment — set them and restart to create the first admin login.'
                );
            }
            return;
        }

        const [[existing]] = await db.query('SELECT id, password_hash FROM admins WHERE username = ?', [ADMIN_USERNAME]);
        if (!existing) {
            const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await db.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [ADMIN_USERNAME, hash]);
            console.log(`[Admin] Created admin account "${ADMIN_USERNAME}" from ADMIN_USERNAME/ADMIN_PASSWORD.`);
            return;
        }

        const matches = await bcrypt.compare(ADMIN_PASSWORD, existing.password_hash);
        if (matches) return;

        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, existing.id]);
        console.log(`[Admin] Updated password for "${ADMIN_USERNAME}" to match ADMIN_PASSWORD.`);
    } catch (e) {
        console.error('[Admin] Bootstrap failed:', e.message);
    }
}

module.exports = { bootstrapAdmin };
