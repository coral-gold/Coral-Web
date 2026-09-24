'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const XLSX    = require('xlsx');
const db      = require('../db');
const { requireAdmin }  = require('../middleware/auth');
const { imageUpload, xlsxUpload, saveImage } = require('../middleware/upload');
const storage = require('../lib/storage');
const { generateQuotationPDF }    = require('../pdf');

router.use(requireAdmin);

// ── Background job store ───────────────────────────────────────────────────────
// Simple in-memory job store. Client polls GET /admin/jobs/:jobId for status.
const jobs = new Map(); // jobId → { status, progress, result, error, startedAt }
setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, j] of jobs) if (j.startedAt < cutoff) jobs.delete(id);
}, 15 * 60 * 1000);

router.get('/jobs/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.json({ ok: false, error: 'Job not found or expired.' });
    res.json({ ok: true, status: job.status, progress: job.progress, result: job.result, error: job.error });
});

// ── Dashboard ──────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
    try {
        const [[{ products }]]    = await db.query('SELECT COUNT(*) AS products FROM products');
        const [[{ categories }]]  = await db.query('SELECT COUNT(*) AS categories FROM categories');
        const [[{ parties }]]     = await db.query('SELECT COUNT(*) AS parties FROM parties');
        const [[{ quotations }]]  = await db.query('SELECT COUNT(*) AS quotations FROM quotations');
        const [recent] = await db.query(
            `SELECT q.quotation_number, q.created_at, p.company_name
             FROM quotations q JOIN parties p ON p.id = q.party_id
             ORDER BY q.created_at DESC LIMIT 5`
        );
        res.json({ ok: true, stats: { products, categories, parties, quotations }, recent });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// ── Categories ─────────────────────────────────────────────────────────────────

// ?all=1 returns the full unpaginated list — used by dropdowns/pickers
// (Add/Edit Product category select, bulk change-category, merge modal)
// which need every option visible, not just one page of them.
const CATEGORY_SORT_COLS = { name: 'c.name', product_count: 'product_count' };

router.get('/categories', async (req, res) => {
    try {
        if (req.query.all === '1') {
            const [rows] = await db.query(
                'SELECT c.*, COUNT(p.id) AS product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name'
            );
            return res.json({ ok: true, categories: rows });
        }
        const page    = Math.max(1, parseInt(req.query.page) || 1);
        const per     = 25;
        const offset  = (page - 1) * per;
        const sortCol = CATEGORY_SORT_COLS[req.query.sort] || 'c.name';
        const sortDir = req.query.order === 'desc' ? 'DESC' : 'ASC';
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM categories');
        const [rows] = await db.query(
            `SELECT c.*, COUNT(p.id) AS product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id
             GROUP BY c.id ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
            [per, offset]
        );
        res.json({ ok: true, categories: rows, total, pages: Math.max(1, Math.ceil(total / per)) });
    } catch (e) {
        console.error('[categories list]', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/categories', async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.json({ ok: false, error: 'Name required.' });
    try {
        const [r] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        console.error('[categories add]', e);
        res.json({ ok: false, error: e.code === 'ER_DUP_ENTRY' ? 'Category name already exists.' : e.message });
    }
});

router.put('/categories/:id', async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.json({ ok: false, error: 'Name required.' });
    try {
        const [r] = await db.query('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id]);
        if (r.affectedRows === 0) return res.json({ ok: false, error: 'Category not found.' });
        res.json({ ok: true });
    } catch (e) {
        console.error('[categories edit]', e);
        res.json({ ok: false, error: e.code === 'ER_DUP_ENTRY' ? 'Name already exists.' : e.message });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) {
        console.error('[categories delete]', e);
        res.json({ ok: false, error: e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED'
            ? 'Cannot delete — products exist in this category.' : e.message });
    }
});

// POST /admin/categories/merge  { targetId, sourceIds: [id, ...] }
router.post('/categories/merge', async (req, res) => {
    const { targetId, sourceIds } = req.body;
    if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
        return res.json({ ok: false, error: 'targetId and at least one sourceId required.' });
    }
    const ids = sourceIds.map(Number).filter(n => n && n !== Number(targetId));
    if (ids.length === 0) return res.json({ ok: false, error: 'No valid source categories.' });
    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.query(
            `UPDATE products SET category_id = ? WHERE category_id IN (${placeholders})`,
            [targetId, ...ids]
        );
        await db.query(`DELETE FROM categories WHERE id IN (${placeholders})`, ids);
        res.json({ ok: true, moved: ids.length });
    } catch (e) { console.error(e); res.json({ ok: false, error: e.message }); }
});

// ── Products ───────────────────────────────────────────────────────────────────

const PRODUCT_SORT_COLS = {
    design_number: 'p.design_number',
    jewel_code:    'p.jewel_code',
    category:      'c.name',
    gross_weight:  'p.gross_weight',
    net_weight:    'p.net_weight',
    created_at:    'p.created_at',
};

router.get('/products', async (req, res) => {
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const per     = 25;
    const offset  = (page - 1) * per;
    const search  = (req.query.q || '').trim();
    const sortCol = PRODUCT_SORT_COLS[req.query.sort] || 'p.created_at';
    const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const conds = ['p.active = 1'], params = [];
    if (search) {
        conds.push('(p.design_number LIKE ? OR p.jewel_code LIKE ? OR c.name LIKE ?)');
        const l = `%${search}%`;
        params.push(l, l, l);
    }
    const where = 'WHERE ' + conds.join(' AND ');
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );
        const products = rows.map(p => ({ ...p, image_url: storage.getPublicUrl(p.image_path) }));
        res.json({ ok: true, products, total, pages: Math.max(1, Math.ceil(total / per)), hasMore: offset + rows.length < total });
    } catch (e) { res.status(500).json({ ok: false }); }
});

// "Select all N matching" for bulk actions — returns every product id
// matching the current search, ignoring pagination, so the client can select
// products on pages it hasn't fetched yet.
router.get('/products/ids', async (req, res) => {
    const search = (req.query.q || '').trim();
    const conds = ['active = 1'], params = [];
    if (search) {
        conds.push('(design_number LIKE ? OR jewel_code LIKE ? OR category_id IN (SELECT id FROM categories WHERE name LIKE ?))');
        const l = `%${search}%`;
        params.push(l, l, l);
    }
    try {
        const [rows] = await db.query(`SELECT id FROM products WHERE ${conds.join(' AND ')}`, params);
        res.json({ ok: true, ids: rows.map(r => r.id) });
    } catch (e) {
        console.error('[products ids]', e);
        res.status(500).json({ ok: false });
    }
});

router.get('/products/:id', async (req, res) => {
    const [[p]] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ ok: false });
    res.json({ ok: true, product: p });
});

// Returns a friendly message for genuine duplicate-key violations, otherwise
// surfaces the real error — a hardcoded message on every failure previously
// masked unrelated causes (image save failures, DB issues) as "duplicate".
function productSaveError(e, action) {
    console.error(`[products ${action}]`, e);
    if (e.code === 'ER_DUP_ENTRY') return 'Design Number or Jewel Code already exists.';
    if (e.code === 'ER_NO_REFERENCED_ROW' || e.code === 'ER_NO_REFERENCED_ROW_2') return 'Selected category does not exist.';
    return `Failed to save product: ${e.message}`;
}

router.post('/products', imageUpload.single('image'), async (req, res) => {
    const { category_id, design_number, jewel_code, gross_weight, net_weight, description, is_featured, amount } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    try {
        const imgPath = req.file ? await saveImage(req.file) : null;
        const [r] = await db.query(
            'INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, image_path, description, is_featured, amount) VALUES (?,?,?,?,?,?,?,?,?)',
            [category_id, design_number, jewel_code, gross_weight || null, net_weight || null,
             imgPath, description || null, is_featured ? 1 : 0, amount || null]
        );
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        res.json({ ok: false, error: productSaveError(e, 'add') });
    }
});

// Only updates fields actually present in the request body. This matters
// because Quick Edit intentionally sends a subset of fields (Category,
// Design No., Jewel Code, Gross/Net Wt.) — previously any omitted field
// (description, is_featured) was silently overwritten with NULL/0 on every
// save, corrupting data without any error being shown.
router.put('/products/:id', imageUpload.single('image'), async (req, res) => {
    const { category_id, design_number, jewel_code, gross_weight, net_weight, description, is_featured, amount } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    try {
        const sets = ['category_id=?', 'design_number=?', 'jewel_code=?', 'gross_weight=?', 'net_weight=?'];
        const vals = [category_id, design_number, jewel_code, gross_weight || null, net_weight || null];
        if (description !== undefined) { sets.push('description=?');  vals.push(description || null); }
        if (is_featured !== undefined) { sets.push('is_featured=?');  vals.push(is_featured ? 1 : 0); }
        if (amount      !== undefined) { sets.push('amount=?');       vals.push(amount || null); }
        if (req.file) {
            const imgPath = await saveImage(req.file);
            sets.push('image_path=?'); vals.push(imgPath);
        }
        const [r] = await db.query(`UPDATE products SET ${sets.join(',')} WHERE id = ?`, [...vals, req.params.id]);
        if (r.affectedRows === 0) return res.json({ ok: false, error: 'Product not found.' });
        res.json({ ok: true });
    } catch (e) {
        res.json({ ok: false, error: productSaveError(e, 'edit') });
    }
});

// Products referenced by a past quotation can't be hard-deleted (FK
// constraint — quotation history must never break). Try a real delete first
// since most deleted products were never actually quoted; only fall back to
// soft-delete (active=0, hidden from catalogue/lists but kept for history)
// when the product genuinely has quotation history. Never surfaces the raw
// SQL/FK error to the admin.
router.delete('/products/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [[ref]] = await db.query('SELECT COUNT(*) AS c FROM quotation_items WHERE product_id = ?', [id]);
        if (ref.c > 0) {
            const [r] = await db.query('UPDATE products SET active = 0 WHERE id = ?', [id]);
            if (r.affectedRows === 0) return res.json({ ok: false, error: 'Product not found.' });
            return res.json({ ok: true, softDeleted: true });
        }
        const [r] = await db.query('DELETE FROM products WHERE id = ?', [id]);
        if (r.affectedRows === 0) return res.json({ ok: false, error: 'Product not found.' });
        res.json({ ok: true });
    } catch (e) {
        if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
            // Race: a quotation was created between the check above and the delete.
            const [r] = await db.query('UPDATE products SET active = 0 WHERE id = ?', [id]).catch(() => [{ affectedRows: 0 }]);
            if (r.affectedRows > 0) return res.json({ ok: true, softDeleted: true });
            return res.json({ ok: false, error: 'This product is used in past quotations and can\'t be permanently deleted.' });
        }
        console.error('[products delete]', e);
        res.json({ ok: false, error: 'Failed to delete product: ' + e.message });
    }
});

// ── Bulk product actions ───────────────────────────────────────────────────────

router.post('/products/bulk', async (req, res) => {
    const { action, ids, category_id } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.json({ ok: false, error: 'No products selected.' });
    const safeIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (!safeIds.length) return res.json({ ok: false, error: 'Invalid IDs.' });
    const ph = safeIds.map(() => '?').join(',');

    try {
        if (action === 'delete') {
            // Split: products with quotation history are soft-deleted (kept for
            // history, hidden from catalogue/lists); the rest are removed outright.
            const [refRows] = await db.query(
                `SELECT DISTINCT product_id FROM quotation_items WHERE product_id IN (${ph})`,
                safeIds
            );
            const referenced   = new Set(refRows.map(r => r.product_id));
            const softIds      = safeIds.filter(id => referenced.has(id));
            const hardIds      = safeIds.filter(id => !referenced.has(id));

            if (hardIds.length) {
                const hph = hardIds.map(() => '?').join(',');
                await db.query(`DELETE FROM products WHERE id IN (${hph})`, hardIds);
            }
            if (softIds.length) {
                const sph = softIds.map(() => '?').join(',');
                await db.query(`UPDATE products SET active = 0 WHERE id IN (${sph})`, softIds);
            }
            return res.json({ ok: true, affected: safeIds.length, hardDeleted: hardIds.length, softDeleted: softIds.length });
        }
        if (action === 'change_category') {
            const catId = Number(category_id);
            if (!catId) return res.json({ ok: false, error: 'category_id required.' });
            await db.query(`UPDATE products SET category_id = ? WHERE id IN (${ph})`, [catId, ...safeIds]);
            return res.json({ ok: true, affected: safeIds.length });
        }
        if (action === 'delete_image') {
            const [rows] = await db.query(
                `SELECT id, image_path FROM products WHERE id IN (${ph}) AND image_path IS NOT NULL AND image_path != ''`,
                safeIds
            );
            await Promise.all(rows.map(row => storage.delete(row.image_path)));
            await db.query(`UPDATE products SET image_path = NULL WHERE id IN (${ph})`, safeIds);
            return res.json({ ok: true, affected: safeIds.length });
        }
        return res.json({ ok: false, error: 'Unknown action.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ── Excel Import (two-step: preview → run) ────────────────────────────────────

// Known aliases for auto-suggesting column mappings
const FIELD_ALIASES = {
    'jewel code':     'jewel_code',
    'jewelcode':      'jewel_code',
    'code':           'jewel_code',
    'style no':       'design_number',
    'style no.':      'design_number',
    'styleno':        'design_number',
    'design number':  'design_number',
    'design no':      'design_number',
    'design no.':     'design_number',
    'category':       'category',
    'category name':  'category',
    'gr wt':          'gross_weight',
    'gross wt':       'gross_weight',
    'gross weight':   'gross_weight',
    'grosswt':        'gross_weight',
    'net wt':         'net_weight',
    'net weight':     'net_weight',
    'netwt':          'net_weight',
    'qty':            'quantity',
    'quantity':       'quantity',
    'amount':         'amount',
    'stone amount':   'amount',
    'diamond amount': 'amount',
    'stone':          'amount',
    'diamond':        'amount',
    'descr':          'description',
    'description':    'description',
    'remark':         'description',
    'image path':     'image_path',
    'imagepath':      'image_path',
    'image':          'image_path',
    'img path':       'image_path',
    'photo':          'image_path',
};

// Temp store for parsed Excel data (cleared after 30 min)
const importTemp = new Map();
setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, v] of importTemp) {
        if (v.ts < cutoff) importTemp.delete(id);
    }
}, 5 * 60 * 1000);

// Step 1: Upload file, parse headers, return to client for mapping
router.post('/import/preview', xlsxUpload.single('file'), async (req, res) => {
    if (!req.file) return res.json({ ok: false, error: 'No file uploaded.' });
    try {
        const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (data.length < 2) return res.json({ ok: false, error: 'File is empty or has no data rows.' });

        const headers = data[0].map(h => String(h).trim()).filter(Boolean);

        // Build auto-suggestions: header → suggested field
        const suggestions = {};
        for (const h of headers) {
            const key = h.toLowerCase().replace(/\s+/g, ' ').trim();
            if (FIELD_ALIASES[key]) suggestions[h] = FIELD_ALIASES[key];
        }

        const fileId = require('crypto').randomUUID();
        importTemp.set(fileId, { buffer: req.file.buffer, ts: Date.now() });

        res.json({ ok: true, fileId, headers, suggestions, rowCount: data.length - 1 });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: 'Failed to parse file: ' + e.message });
    }
});

// ── Media Library ──────────────────────────────────────────────────────────────

const MEDIA_SORT_COLS = ['filename', 'size', 'mtime'];

// Standalone upload for the Media Library's "+ Upload Image" button — just
// adds an image to the library, unrelated to the site logo (POST /content).
router.post('/media/upload', imageUpload.single('image'), async (req, res) => {
    if (!req.file) return res.json({ ok: false, error: 'image required.' });
    try {
        const key = await saveImage(req.file);
        res.json({ ok: true, key, url: storage.getPublicUrl(key) });
    } catch (e) {
        console.error('[media upload]', e);
        res.json({ ok: false, error: e.message });
    }
});

router.get('/media', async (req, res) => {
    try {
        const page    = Math.max(1, parseInt(req.query.page) || 1);
        const per     = 25;
        const sortCol = MEDIA_SORT_COLS.includes(req.query.sort) ? req.query.sort : 'mtime';
        const sortDir = req.query.order === 'asc' ? 1 : -1;

        const files = (await storage.list()).sort((a, b) => {
            let va = a[sortCol], vb = b[sortCol];
            if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return cmp * sortDir;
        });

        const total  = files.length;
        const offset = (page - 1) * per;
        res.json({
            ok: true, storageMode: storage.mode, storagePersistent: !!storage.publicUrlBase,
            files: files.slice(offset, offset + per), total, pages: Math.max(1, Math.ceil(total / per)),
        });
    } catch (e) {
        console.error('[media list]', e);
        res.json({ ok: false, error: e.message });
    }
});

// :key is the opaque storage key (e.g. "local:foo.jpg" or "s3:foo.jpg"), URL-encoded by the client
router.delete('/media/:key', async (req, res) => {
    const key = decodeURIComponent(req.params.key);
    if (!key) return res.json({ ok: false, error: 'Invalid key.' });
    try {
        await storage.delete(key);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Step 2: Start import as a background job — returns { ok, jobId } immediately.
// Client polls GET /admin/jobs/:jobId for progress and result.
// Body: { fileId, mapping, strategy: 'skip'|'fill'|'merge'|'replace' }
router.post('/import/run', async (req, res) => {
    const { fileId, mapping, strategy } = req.body || {};
    if (!fileId || !mapping) return res.json({ ok: false, error: 'fileId and mapping required.' });

    const STRATEGIES = ['skip', 'fill', 'merge', 'replace'];
    const strat = STRATEGIES.includes(strategy) ? strategy : 'skip';

    const temp = importTemp.get(fileId);
    if (!temp) return res.json({ ok: false, error: 'File session expired (30 min). Please re-upload.' });
    importTemp.delete(fileId); // consume immediately

    const wb   = XLSX.read(temp.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (data.length < 2) {
        const jobId = require('crypto').randomUUID();
        jobs.set(jobId, { status: 'done', progress: { done: 0, total: 0, step: 'Complete' }, result: { inserted: 0, updated: 0, skipped: 0, errors: [], imageMap: [] }, error: null, startedAt: Date.now() });
        return res.json({ ok: true, jobId });
    }

    const rawHeaders = data[0].map(h => String(h).trim());
    const col = {};
    for (const [header, field] of Object.entries(mapping)) {
        if (!field) continue;
        const idx = rawHeaders.indexOf(header);
        if (idx !== -1) col[field] = idx;
    }

    if (col.jewel_code === undefined) {
        return res.json({ ok: false, error: 'Jewel Code column must be mapped before running import.' });
    }

    const totalRows = data.length - 1;
    const jobId = require('crypto').randomUUID();
    jobs.set(jobId, {
        status: 'running',
        progress: { done: 0, total: totalRows, step: 'Starting…' },
        result: null, error: null, startedAt: Date.now()
    });

    // Fire-and-forget — client polls for progress
    runImportJob(jobId, data, col, strat, totalRows).catch(e => {
        const job = jobs.get(jobId);
        if (job) { job.status = 'error'; job.error = e.message; }
        console.error('[import/run job]', e);
    });

    res.json({ ok: true, jobId });
});

async function runImportJob(jobId, data, col, strat, totalRows) {
    const job = jobs.get(jobId);
    if (!job) return;

    let inserted = 0, updated = 0, skipped = 0;
    const errors     = [];
    const imageMap   = [];
    const catCache   = {};
    const seenInFile = new Set();

    for (let r = 1; r < data.length; r++) {
        job.progress = { done: r - 1, total: totalRows, step: `Row ${r} of ${totalRows}` };

        const row       = data[r];
        const jewelCode = String(row[col.jewel_code] ?? '').trim();
        if (!jewelCode) { skipped++; continue; }

        const designNo    = col.design_number !== undefined ? String(row[col.design_number] ?? '').trim() : '';
        const finalDesign = designNo || jewelCode;
        const styleKey    = finalDesign.toLowerCase();
        const catName     = col.category     !== undefined ? String(row[col.category]     ?? '').trim() : '';
        const grossWt     = col.gross_weight !== undefined ? parseFloat(row[col.gross_weight]) || null : null;
        const netWt       = col.net_weight   !== undefined ? parseFloat(row[col.net_weight])   || null : null;
        const descr       = col.description  !== undefined ? String(row[col.description]  ?? '').trim() || null : null;
        const amountVal   = col.amount       !== undefined ? String(row[col.amount]       ?? '').trim() || null : null;

        if (!seenInFile.has(styleKey)) {
            const imgEntry = { jewel_code: jewelCode, design_number: finalDesign };
            if (col.image_path !== undefined) {
                const rawPath = String(row[col.image_path] ?? '').trim();
                const fn = extractImageFilename(rawPath);
                if (fn) imgEntry.filename = fn;
            }
            imageMap.push(imgEntry);
        }

        if (seenInFile.has(styleKey)) { skipped++; continue; }
        seenInFile.add(styleKey);

        try {
            let catId = catName ? catCache[catName] : null;
            if (!catId && catName) {
                await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', [catName]);
                const [[cat]] = await db.query('SELECT id FROM categories WHERE name = ?', [catName]);
                catId = cat?.id || null;
                catCache[catName] = catId;
            }
            if (!catId) {
                if (!catCache['']) {
                    const [[def]] = await db.query('SELECT id FROM categories ORDER BY id LIMIT 1');
                    if (def) {
                        catCache[''] = def.id;
                    } else {
                        await db.query("INSERT IGNORE INTO categories (name) VALUES ('General')");
                        const [[cat]] = await db.query("SELECT id FROM categories WHERE name='General'");
                        catCache[''] = cat.id;
                    }
                }
                catId = catCache[''];
            }

            const [[existing]] = await db.query(
                'SELECT id, jewel_code, category_id, gross_weight, net_weight, description, amount FROM products WHERE design_number = ?',
                [finalDesign]
            );

            if (!existing) {
                await db.query(
                    `INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, description, amount)
                     VALUES (?,?,?,?,?,?,?)`,
                    [catId, finalDesign, jewelCode, grossWt, netWt, descr, amountVal]
                );
                inserted++;
            } else if (strat === 'skip') {
                skipped++;
            } else if (strat === 'fill') {
                const sets = [], vals = [];
                if (!existing.jewel_code   && jewelCode) { sets.push('jewel_code = ?');   vals.push(jewelCode); }
                if (!existing.category_id  && catId)     { sets.push('category_id = ?');  vals.push(catId); }
                if (!existing.gross_weight && grossWt)   { sets.push('gross_weight = ?'); vals.push(grossWt); }
                if (!existing.net_weight   && netWt)     { sets.push('net_weight = ?');   vals.push(netWt); }
                if (!existing.description  && descr)     { sets.push('description = ?');  vals.push(descr); }
                if (!existing.amount       && amountVal) { sets.push('amount = ?');       vals.push(amountVal); }
                if (sets.length) {
                    await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...vals, existing.id]);
                    updated++;
                } else { skipped++; }
            } else if (strat === 'merge') {
                await db.query(
                    `UPDATE products SET
                       jewel_code   = COALESCE(NULLIF(?, ''), jewel_code),
                       category_id  = COALESCE(?, category_id),
                       gross_weight = COALESCE(?, gross_weight),
                       net_weight   = COALESCE(?, net_weight),
                       description  = COALESCE(NULLIF(?, ''), description),
                       amount       = COALESCE(NULLIF(?, ''), amount)
                     WHERE id = ?`,
                    [jewelCode, catId || null, grossWt, netWt, descr, amountVal, existing.id]
                );
                updated++;
            } else if (strat === 'replace') {
                // Overwrite every field unconditionally — same end state as
                // delete+insert, but as an UPDATE-in-place: keeps the same row
                // (and id), so it can never hit the quotation_items foreign key
                // constraint even when this product has quotation history.
                await db.query(
                    `UPDATE products SET category_id = ?, jewel_code = ?, gross_weight = ?, net_weight = ?, description = ?, amount = ?
                     WHERE id = ?`,
                    [catId, jewelCode, grossWt, netWt, descr, amountVal, existing.id]
                );
                updated++;
            }
        } catch (e) {
            errors.push(`Row ${r + 1} (${jewelCode}): ${e.message}`);
            skipped++;
        }
    }

    job.status   = 'done';
    job.progress = { done: totalRows, total: totalRows, step: 'Complete' };
    job.result   = { inserted, updated, skipped, errors, imageMap };
}

// Extract the first filename from an ERP image path like \SavedImage\BG\BG0245.jpeg
function extractImageFilename(pathValue) {
    if (!pathValue) return null;
    const str = String(pathValue).trim();
    // Match the last component of the first \Folder\Filename.ext pattern
    const match = str.match(/\\[^\\]+\\([^\\]+\.[a-zA-Z0-9]+)/);
    if (match) return match[1];
    // Fallback: just get the last path component with an extension
    const parts = str.split(/[\\\/]/);
    const last  = parts.filter(Boolean).pop();
    return (last && /\.[a-zA-Z0-9]+$/.test(last)) ? last : null;
}

// Step 3 (optional): Upload individual product image, match by design_number.
// Send force=1 to overwrite an existing image (used by standalone Bulk Image Import).
// Without force, only attaches if product currently has no image (Excel import behavior).
router.post('/import/images', imageUpload.single('image'), async (req, res) => {
    const { design_number, force } = req.body;
    if (!design_number || !req.file) return res.json({ ok: false, error: 'design_number and image required.' });
    try {
        const filename = await saveImage(req.file);
        let affectedRows;
        if (force === '1' || force === 'true') {
            const [r] = await db.query(
                `UPDATE products SET image_path = ? WHERE design_number = ?`,
                [filename, design_number]
            );
            affectedRows = r.affectedRows;
        } else {
            const [r] = await db.query(
                `UPDATE products SET image_path = ? WHERE design_number = ? AND (image_path IS NULL OR image_path = '')`,
                [filename, design_number]
            );
            affectedRows = r.affectedRows;
        }
        // Remove orphan file when no product matched
        if (affectedRows === 0) {
            storage.delete(filename);
        }
        res.json({ ok: true, filename, matched: affectedRows > 0 });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: e.message });
    }
});

// ── Parties ────────────────────────────────────────────────────────────────────

const PARTY_SORT_COLS = {
    party_id:     'party_id',
    company_name: 'company_name',
    phone:        'phone',
    is_active:    'is_active',
    created_at:   'created_at',
};

router.get('/parties', async (req, res) => {
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const per     = 25;
    const offset  = (page - 1) * per;
    const sortCol = PARTY_SORT_COLS[req.query.sort] || 'created_at';
    const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM parties');
    const [rows] = await db.query(
        `SELECT id, party_id, company_name, phone, is_active, created_at FROM parties ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
        [per, offset]
    );
    res.json({ ok: true, parties: rows, total, pages: Math.max(1, Math.ceil(total / per)) });
});

router.post('/parties', async (req, res) => {
    const { party_id, company_name, phone, password, is_active } = req.body;
    if (!party_id || !company_name || !password) {
        return res.json({ ok: false, error: 'Party ID, Company Name and Password are required.' });
    }
    if (password.length < 6) return res.json({ ok: false, error: 'Password must be at least 6 characters.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const [r]  = await db.query(
            'INSERT INTO parties (party_id, company_name, phone, is_active, password_hash) VALUES (?,?,?,?,?)',
            [party_id, company_name, phone || null, is_active ? 1 : 1, hash]
        );
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        console.error('[parties add]', e);
        res.json({ ok: false, error: e.code === 'ER_DUP_ENTRY' ? 'Party ID already exists.' : e.message });
    }
});

router.put('/parties/:id', async (req, res) => {
    const { party_id, company_name, phone, password, is_active } = req.body;
    if (!party_id || !company_name) {
        return res.json({ ok: false, error: 'Party ID and Company Name are required.' });
    }
    try {
        const [[existing]] = await db.query('SELECT password_hash FROM parties WHERE id = ?', [req.params.id]);
        if (!existing) return res.json({ ok: false, error: 'Not found.' });

        let hash = existing.password_hash;
        if (password) {
            if (password.length < 6) return res.json({ ok: false, error: 'Password must be at least 6 characters.' });
            hash = await bcrypt.hash(password, 10);
        }
        await db.query(
            'UPDATE parties SET party_id=?,company_name=?,phone=?,is_active=?,password_hash=? WHERE id=?',
            [party_id, company_name, phone || null, is_active ? 1 : 0, hash, req.params.id]
        );
        res.json({ ok: true });
    } catch (e) {
        console.error('[parties edit]', e);
        res.json({ ok: false, error: e.code === 'ER_DUP_ENTRY' ? 'Party ID already exists.' : e.message });
    }
});

router.delete('/parties/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM parties WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) {
        console.error('[parties delete]', e);
        res.json({ ok: false, error: e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED'
            ? 'Cannot delete — this party has existing quotations.' : e.message });
    }
});

router.patch('/parties/:id/toggle', async (req, res) => {
    const [[p]] = await db.query('SELECT is_active FROM parties WHERE id = ?', [req.params.id]);
    if (!p) return res.json({ ok: false });
    await db.query('UPDATE parties SET is_active = ? WHERE id = ?', [p.is_active ? 0 : 1, req.params.id]);
    res.json({ ok: true, is_active: !p.is_active });
});

// ── Quotations ─────────────────────────────────────────────────────────────────

router.get('/quotations', async (req, res) => {
    const page      = Math.max(1, parseInt(req.query.page) || 1);
    const per       = 25;
    const offset    = (page - 1) * per;
    const search    = (req.query.q         || '').trim();
    const dateFrom  = (req.query.date_from || '').trim();
    const dateTo    = (req.query.date_to   || '').trim();

    const conds = [], params = [];
    if (search)    { conds.push('(q.quotation_number LIKE ? OR p.company_name LIKE ?)'); const l = `%${search}%`; params.push(l, l); }
    if (dateFrom)  { conds.push('DATE(q.created_at) >= ?'); params.push(dateFrom); }
    if (dateTo)    { conds.push('DATE(q.created_at) <= ?'); params.push(dateTo); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const sortCol = req.query.sort === 'company_name' ? 'p.company_name'
                  : req.query.sort === 'quotation_number' ? 'q.quotation_number'
                  : 'q.created_at';
    const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(DISTINCT q.id) AS total FROM quotations q JOIN parties p ON p.id=q.party_id ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT q.id, q.quotation_number, q.created_at, p.company_name, p.party_id AS pid,
                    COUNT(qi.id) AS item_count,
                    COALESCE(SUM(qi.gross_weight), 0) AS total_gross_weight
             FROM quotations q
             JOIN parties p ON p.id=q.party_id
             LEFT JOIN quotation_items qi ON qi.quotation_id=q.id
             ${where}
             GROUP BY q.id, p.company_name, p.party_id
             ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );
        res.json({ ok: true, quotations: rows, total, pages: Math.max(1, Math.ceil(total / per)) });
    } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

router.get('/quotations/:id', async (req, res) => {
    const [[q]] = await db.query(
        'SELECT q.*, p.company_name, p.party_id AS pid, p.phone FROM quotations q JOIN parties p ON p.id=q.party_id WHERE q.id=?',
        [req.params.id]
    );
    if (!q) return res.status(404).json({ ok: false });
    const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [q.id]);
    res.json({ ok: true, quotation: q, items });
});

router.get('/quotations/:id/pdf', async (req, res) => {
    const withImages = req.query.mode === 'images';
    try {
        const [[q]] = await db.query(
            'SELECT q.*, p.company_name, p.party_id, p.phone FROM quotations q JOIN parties p ON p.id=q.party_id WHERE q.id=?',
            [req.params.id]
        );
        if (!q) return res.status(404).send('Not found');
        const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [q.id]);

        let itemImages = {};
        if (withImages) {
            const productIds = items.map(i => i.product_id).filter(Boolean);
            if (productIds.length) {
                const ph = productIds.map(() => '?').join(',');
                const [imgRows] = await db.query(`SELECT id, image_path FROM products WHERE id IN (${ph})`, productIds);
                for (const r of imgRows) if (r.image_path) itemImages[r.id] = r.image_path;
            }
        }

        const buf    = await generateQuotationPDF(q, { company_name: q.company_name, party_id: q.party_id, phone: q.phone }, items, { withImages, itemImages });
        const suffix = withImages ? '-with-images' : '';
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.quotation_number}${suffix}.pdf"`, 'Content-Length': buf.length });
        res.end(buf);
    } catch (e) { console.error(e); res.status(500).send('Error'); }
});

// ── Content ────────────────────────────────────────────────────────────────────

router.get('/content', async (req, res) => {
    const [rows] = await db.query('SELECT key_name, value FROM content');
    const data   = Object.fromEntries(rows.map(r => [r.key_name, r.value]));
    res.json({ ok: true, content: data });
});

router.post('/content', imageUpload.single('site_logo'), async (req, res) => {
    const textFields = [
        'home_hero_title','home_hero_subtitle','about_text',
        'contact_email','contact_phone','contact_address',
        'primary_color','accent_color'
    ];
    try {
        for (const key of textFields) {
            if (req.body[key] !== undefined) {
                const val = String(req.body[key]).trim();
                await db.query(
                    'INSERT INTO content (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?',
                    [key, val, val]
                );
            }
        }
        let logo_url = null;
        if (req.file) {
            const key = await saveImage(req.file);
            // content.site_logo is read verbatim by the public site with no
            // server-side resolution step, so store the resolved URL here
            // (not the opaque storage key) — correct for both local and S3.
            const p = storage.getPublicUrl(key);
            await db.query(
                'INSERT INTO content (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?',
                ['site_logo', p, p]
            );
            logo_url = p;
        }
        res.json({ ok: true, logo_url });
    } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

module.exports = router;
