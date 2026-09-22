'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(session({
    secret:            process.env.SESSION_SECRET || 'cg-dev-secret-change-in-prod',
    resave:            false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// Static assets (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../assets/uploads')));

// API routes
app.use('/api/health',    require('./routes/health'));
app.use('/api/setup',     require('./routes/setup'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/public',    require('./routes/public'));
app.use('/api/catalogue', require('./routes/catalogue'));
app.use('/api/cart',      require('./routes/cart'));
app.use('/api/quotation', require('./routes/quotation'));
app.use('/api/admin',     require('./routes/admin'));

// Serve React production build
const distDir = path.join(__dirname, '../client/dist');
app.use(express.static(distDir));
app.get(/.*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Coral Gold server running on http://localhost:${PORT}`);

    const db = require('./db');
    if (!db.isConfigured()) {
        console.warn('[DB] Not configured — visit /setup to initialise the database.');
        return;
    }
    db.query('SELECT 1').then(() => {
        console.log('[DB] Connection OK');
    }).catch(e => {
        console.error('[DB] Connection FAILED:', e.message);
        if (e.code === 'ER_ACCESS_DENIED_ERROR' || e.code === 'ER_DBACCESS_DENIED_ERROR') {
            console.error('[DB] Fix: grant ALL PRIVILEGES on the database to the user in hPanel → MySQL Databases.');
        } else if (e.code === 'ECONNREFUSED') {
            console.error('[DB] Fix: check DB_HOST in .env — connection refused.');
        } else if (e.code === 'ER_BAD_DB_ERROR') {
            console.error('[DB] Fix: check DB_NAME in .env — database not found (use lowercase on Hostinger).');
        } else if (e.code === 'ER_NO_SUCH_TABLE') {
            console.error('[DB] Fix: visit /setup to initialise the schema.');
        }
    });
});
