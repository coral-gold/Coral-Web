'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet  = require('helmet');
const path    = require('path');

const app = express();

// Hostinger (and most Node hosts) terminates TLS at a reverse proxy in
// front of this process and forwards plain HTTP internally — without this,
// req.secure/req.protocol always read "http" even over a real HTTPS
// connection, and req.ip would be the proxy's own address rather than the
// visitor's (breaking the login throttle below, which is keyed by IP).
app.set('trust proxy', 1);

// Standard security headers (Batch 28 item 2). CSP is left off: this is a
// single-origin SPA that also pulls Google Fonts, and a wrong CSP silently
// breaks the site rather than failing loudly — the other headers below
// (clickjacking, MIME-sniffing, HSTS, referrer leakage) are the practical
// win and carry no such risk. Cross-Origin-Resource-Policy must allow
// cross-origin, not helmet's "same-origin" default — product images are
// served from media.coralgold.in (a different origin) and embedded via
// <img> on coralgold.in itself (item 1); "same-origin" here would make the
// browser refuse to display every one of them.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Redirect any plain-HTTP request to HTTPS in production. Skipped locally
// (and whenever DISABLE_HTTPS_REDIRECT is set) since dev/test servers here
// have no TLS in front of them at all.
if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_HTTPS_REDIRECT) {
    app.use((req, res, next) => {
        if (req.secure) return next();
        res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    });
}

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

// A dedicated media host (e.g. media.coralgold.in) is just this same app
// with a second (sub)domain pointed at it — Hostinger's Node.js hosting
// binds every domain assigned to an app to the one process, and Express
// itself never distinguishes hostnames. So a request for that host's bare
// "/" fell through /images, /uploads, every /api route and the SPA's own
// static files, landing on the catch-all below — which served the site's
// own index.html. That subdomain only exists to serve individual image
// files (e.g. /images/<file>.jpg, already handled above), so redirect just
// its root to the real site instead (Batch 28 item 1). Every other path,
// on any host, is completely untouched by this.
const mediaHostname = storage.getMediaHostname();
const mainSiteUrl = (process.env.MAIN_SITE_URL || 'https://coralgold.in').replace(/\/$/, '');
const mainHostname = (() => { try { return new URL(mainSiteUrl).hostname; } catch { return null; } })();
// Only when images are served from a genuinely different (sub)domain than
// the main site — an older single-domain setup (IMAGES_PUBLIC_URL under
// coralgold.in/images itself) must never redirect the main site's own root
// away from itself.
if (mediaHostname && mediaHostname !== mainHostname) {
    app.get('/', (req, res, next) => {
        if (req.hostname === mediaHostname) return res.redirect(302, mainSiteUrl + '/');
        next();
    });
}

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
