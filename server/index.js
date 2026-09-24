'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Persistent, DB-backed session store — survives process restarts and works
// correctly across multiple worker processes (Express's default MemoryStore
// does neither, which is what caused spurious "Admin login required" prompts
// on an already-logged-in admin).
const MySQLSessionStore = require('./sessionStore');
app.use(session({
    store:             new MySQLSessionStore(),
    secret:            process.env.SESSION_SECRET || 'cg-dev-secret-change-in-prod',
    resave:            false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// Static assets — serves local-disk images at both /images/* (the requested
// permanent URL path, e.g. https://coralgold.in/images/<filename>) and the
// older /uploads/* path (kept for any DB rows still using the pre-Batch-13
// storage scheme). Both serve the exact same directory. In S3 mode, images
// are fetched directly from the bucket's public URL instead, so neither
// route is used for those images — this stays harmless either way.
const storage = require('./lib/storage');
app.use('/images',  express.static(storage.localDir));
app.use('/uploads', express.static(storage.localDir));

// API routes
app.use('/api/health',    require('./routes/health'));
app.use('/api/setup',     require('./routes/setup'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/public',    require('./routes/public'));
app.use('/api/catalogue', require('./routes/catalogue'));
app.use('/api/cart',      require('./routes/cart'));
app.use('/api/quotation', require('./routes/quotation'));
app.use('/api/admin',     require('./routes/admin'));

// Serve React production build.
// index.html must never be cached — each build ships a fresh content-hashed
// JS/CSS filename and deletes the old one, so a cached index.html pointing
// at a bundle that no longer exists breaks the SPA (looks like "navigation
// keeps reloading / breaking" until the admin does a hard refresh).
// The hashed asset files themselves are safe to cache long-term.
const distDir = path.join(__dirname, '../client/dist');
app.use(express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));
app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distDir, 'index.html'));
});

// Catches any error thrown/passed to next() in an /api route — most
// importantly multer's upload middleware (unsupported file type, file too
// large), which otherwise reaches Express's default handler and returns an
// HTML stack-trace page. The client always expects JSON back; parsing that
// HTML as JSON threw uncaught, which is why Add/Edit Product's "Saving…"
// button could get stuck forever with no error shown whenever a file the
// image filter rejected was picked (e.g. a phone's HEIC photos).
app.use((err, req, res, next) => {
    console.error('[error]', req.method, req.originalUrl, err.message);
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    res.status(status).json({ ok: false, error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Coral Gold server running on http://localhost:${PORT}`);

    const db = require('./db');
    if (!db.isConfigured()) {
        console.warn('[DB] Not configured — visit /setup to initialise the database.');
        return;
    }
    db.query('SELECT 1').then(async () => {
        console.log('[DB] Connection OK');
        await require('./migrations').runMigrations();
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
