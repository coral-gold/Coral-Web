'use strict';
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
const db    = require('../db');

const SCHEMA_FILE = path.join(__dirname, '../../schema.sql');

// Creates any tables schema.sql defines that don't exist yet. Every
// statement in it is CREATE TABLE IF NOT EXISTS, so running this on every
// startup is safe even against an existing, populated database — a brand
// new one gets its tables, an existing one is untouched.
//
// This replaces the removed Setup wizard's "Run Setup" button (Batch 29
// item 1), which used to be the only thing that ever ran schema.sql. A
// one-off connection with multipleStatements enabled is used instead of
// the shared pool (which doesn't set that flag) purely to execute this
// multi-statement file in one go, exactly as the wizard's backend did.
async function ensureSchema() {
    if (!db.isConfigured()) return;
    const cfg = db.getRawConfig();
    if (!cfg) return;
    const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
    try {
        const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
        await conn.query(schema);
    } finally {
        await conn.end().catch(() => {});
    }
}

module.exports = { ensureSchema };
