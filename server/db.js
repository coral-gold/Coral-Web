'use strict';
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

let _pool = null;

function readFileConfig() {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(raw);
    } catch { return null; }
}

function buildPoolConfig() {
    if (process.env.DB_HOST) {
        return {
            host:     process.env.DB_HOST,
            user:     process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'coralgold',
        };
    }
    const cfg = readFileConfig();
    if (cfg && cfg.DB_HOST) {
        return {
            host:     cfg.DB_HOST,
            user:     cfg.DB_USER || 'root',
            password: cfg.DB_PASS || '',
            database: cfg.DB_NAME || 'coralgold',
        };
    }
    return null;
}

function createPool(cfg) {
    _pool = mysql.createPool({
        host:               cfg.host,
        user:               cfg.user,
        password:           cfg.password,
        database:           cfg.database,
        waitForConnections: true,
        connectionLimit:    10,
        decimalNumbers:     true,
    });
    return _pool;
}

function getPool() {
    if (_pool) return _pool;
    const cfg = buildPoolConfig();
    if (!cfg) return null;
    return createPool(cfg);
}

// Attempt init at startup
const _startCfg = buildPoolConfig();
if (_startCfg) createPool(_startCfg);

module.exports = {
    query(...args) {
        const p = getPool();
        if (!p) throw new Error('Database not configured. Set DB_HOST/DB_USER/DB_PASS/DB_NAME in the environment.');
        return p.query(...args);
    },
    getConnection(...args) {
        const p = getPool();
        if (!p) throw new Error('Database not configured. Set DB_HOST/DB_USER/DB_PASS/DB_NAME in the environment.');
        return p.getConnection(...args);
    },
    reinit(cfg) {
        if (_pool) { _pool.end().catch(() => {}); _pool = null; }
        return createPool(cfg);
    },
    isConfigured() { return !!getPool(); },
    // The resolved {host,user,password,database} — used by schemaInit.js to
    // open its own one-off connection (with multipleStatements enabled just
    // for that) without duplicating this file's env-var/config.json logic.
    getRawConfig: buildPoolConfig,
};
