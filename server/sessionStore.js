'use strict';
const session = require('express-session');
const db      = require('./db');

// Express's default MemoryStore does not survive process restarts and is
// inconsistent across multiple worker processes — the exact cause of
// intermittent "Admin login required" prompts on an already-logged-in
// session. This store persists sessions in the same MySQL database the
// app already uses, so login state survives restarts/redeploys and is
// shared across any number of worker processes.
class MySQLSessionStore extends session.Store {
    constructor() {
        super();
        this._tableReady = false;
        this._cleanupInterval = setInterval(() => {
            this._ensureTable()
                .then(() => db.query('DELETE FROM sessions WHERE expires < ?', [Date.now()]))
                .catch(() => {});
        }, 30 * 60 * 1000);
        if (this._cleanupInterval.unref) this._cleanupInterval.unref();
    }

    async _ensureTable() {
        if (this._tableReady) return;
        if (!db.isConfigured()) throw new Error('Database not configured');
        await db.query(
            `CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR(128) PRIMARY KEY,
                data LONGTEXT NOT NULL,
                expires BIGINT NOT NULL,
                INDEX idx_expires (expires)
            )`
        );
        this._tableReady = true;
    }

    get(sid, cb) {
        this._ensureTable()
            .then(() => db.query('SELECT data, expires FROM sessions WHERE session_id = ?', [sid]))
            .then(([rows]) => {
                const row = rows[0];
                if (!row) return cb(null, null);
                if (row.expires < Date.now()) {
                    this.destroy(sid, () => {});
                    return cb(null, null);
                }
                let parsed;
                try { parsed = JSON.parse(row.data); } catch { return cb(null, null); }
                cb(null, parsed);
            })
            // DB hiccup: fail open to "no session" rather than crash the request
            .catch(e => { console.error('[sessionStore.get]', e.message); cb(null, null); });
    }

    set(sid, sessionData, cb) {
        const maxAge  = sessionData?.cookie?.maxAge || 8 * 60 * 60 * 1000;
        const expires = Date.now() + maxAge;
        const data    = JSON.stringify(sessionData);
        this._ensureTable()
            .then(() => db.query(
                'INSERT INTO sessions (session_id, data, expires) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data = ?, expires = ?',
                [sid, data, expires, data, expires]
            ))
            .then(() => cb && cb(null))
            .catch(e => { console.error('[sessionStore.set]', e.message); cb && cb(e); });
    }

    destroy(sid, cb) {
        this._ensureTable()
            .then(() => db.query('DELETE FROM sessions WHERE session_id = ?', [sid]))
            .then(() => cb && cb(null))
            .catch(e => { console.error('[sessionStore.destroy]', e.message); cb && cb(null); });
    }

    touch(sid, sessionData, cb) {
        this.set(sid, sessionData, cb);
    }
}

module.exports = MySQLSessionStore;
