'use strict';
const db = require('./db');

// Lightweight idempotent migrations for columns added after initial launch.
// schema.sql's CREATE TABLE IF NOT EXISTS only applies to a brand-new
// database — an already-running production DB needs these ALTER TABLEs
// applied explicitly. Runs once at server startup; safe to run every time.
async function runMigrations() {
    if (!db.isConfigured()) return;
    try {
        await addColumnIfMissing('products', 'active', "TINYINT NOT NULL DEFAULT 1");
        await ensureIndex('products', 'idx_active', '(active)');
    } catch (e) {
        console.error('[migrations] failed:', e.message);
    }
}

async function addColumnIfMissing(table, column, definition) {
    const [[{ c }]] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
    );
    if (c > 0) return;
    console.log(`[migrations] Adding ${table}.${column}`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureIndex(table, indexName, columns) {
    const [[{ c }]] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
        [table, indexName]
    );
    if (c > 0) return;
    console.log(`[migrations] Adding index ${indexName} on ${table}`);
    await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${columns}`);
}

module.exports = { runMigrations };
