'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const XLSX    = require('xlsx');
const db      = require('../db');
const { requireAdmin }  = require('../middleware/auth');
const { imageUpload, xlsxUpload, saveImage } = require('../middleware/upload');
const { generateQuotationPDF }    = require('../pdf');

const UPLOAD_DIR = path.join(__dirname, '../../assets/uploads');

router.use(requireAdmin);

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

router.get('/categories', async (req, res) => {
    const [rows] = await db.query(
        'SELECT c.*, COUNT(p.id) AS product_count FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name'
    );
    res.json({ ok: true, categories: rows });
});

router.post('/categories', async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.json({ ok: false, error: 'Name required.' });
    try {
        const [r] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        res.json({ ok: false, error: 'Category name already exists.' });
    }
});

router.put('/categories/:id', async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.json({ ok: false, error: 'Name required.' });
    try {
        await db.query('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: 'Name already exists.' }); }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: 'Cannot delete — products exist in this category.' }); }
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

    const conds = [], params = [];
    if (search) {
        conds.push('(p.design_number LIKE ? OR p.jewel_code LIKE ? OR c.name LIKE ?)');
        const l = `%${search}%`;
        params.push(l, l, l);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );
        res.json({ ok: true, products: rows, total, pages: Math.ceil(total / per), hasMore: offset + rows.length < total });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/products/:id', async (req, res) => {
    const [[p]] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ ok: false });
    res.json({ ok: true, product: p });
});

router.post('/products', imageUpload.single('image'), async (req, res) => {
    const { category_id, design_number, jewel_code, gross_weight, net_weight, description, is_featured } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    try {
        const imgPath = req.file ? await saveImage(req.file) : null;
        const [r] = await db.query(
            'INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, image_path, description, is_featured) VALUES (?,?,?,?,?,?,?,?)',
            [category_id, design_number, jewel_code, gross_weight || null, net_weight || null,
             imgPath, description || null, is_featured ? 1 : 0]
        );
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        res.json({ ok: false, error: 'Design Number or Jewel Code already exists.' });
    }
});

router.put('/products/:id', imageUpload.single('image'), async (req, res) => {
    const { category_id, design_number, jewel_code, gross_weight, net_weight, description, is_featured } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    try {
        const sets  = ['category_id=?','design_number=?','jewel_code=?','gross_weight=?','net_weight=?','description=?','is_featured=?'];
        const vals  = [category_id, design_number, jewel_code, gross_weight || null, net_weight || null,
                       description || null, is_featured ? 1 : 0];
        if (req.file) {
            const imgPath = await saveImage(req.file);
            sets.push('image_path=?'); vals.push(imgPath);
        }
        await db.query(`UPDATE products SET ${sets.join(',')} WHERE id = ?`, [...vals, req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: 'Design Number or Jewel Code already exists.' }); }
});

router.delete('/products/:id', async (req, res) => {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
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

router.get('/media', (req, res) => {
    try {
        const IMAGE_RE = /\.(jpe?g|png|gif|webp|svg)$/i;
        const files = fs.readdirSync(UPLOAD_DIR)
            .filter(f => IMAGE_RE.test(f) && f !== '.gitkeep')
            .map(f => {
                const stat = fs.statSync(path.join(UPLOAD_DIR, f));
                return { filename: f, url: '/uploads/' + f, size: stat.size, mtime: stat.mtimeMs };
            })
            .sort((a, b) => b.mtime - a.mtime);
        res.json({ ok: true, files });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

router.delete('/media/:filename', (req, res) => {
    const fn = path.basename(req.params.filename); // prevent path traversal
    if (!fn || fn === '.gitkeep') return res.json({ ok: false, error: 'Invalid filename.' });
    const filepath = path.join(UPLOAD_DIR, fn);
    try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Step 2: Run import using admin-supplied column mapping
// Body: { fileId, mapping: { "Column Name": "field_name" | null, ... } }
router.post('/import/run', async (req, res) => {
    const { fileId, mapping } = req.body || {};
    if (!fileId || !mapping) return res.json({ ok: false, error: 'fileId and mapping required.' });

    const temp = importTemp.get(fileId);
    if (!temp) return res.json({ ok: false, error: 'File session expired (30 min). Please re-upload.' });

    // Build header → col index map from the actual file
    const wb   = XLSX.read(temp.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length < 2) return res.json({ ok: true, inserted: 0, updated: 0, skipped: 0, errors: [], imageMap: [] });

    const rawHeaders = data[0].map(h => String(h).trim());
    // col[fieldName] = column index
    const col = {};
    for (const [header, field] of Object.entries(mapping)) {
        if (!field) continue;
        const idx = rawHeaders.indexOf(header);
        if (idx !== -1) col[field] = idx;
    }

    if (col.jewel_code === undefined) {
        return res.json({ ok: false, error: 'Jewel Code column must be mapped before running import.' });
    }

    let inserted = 0, updated = 0, skipped = 0;
    const errors   = [];
    const imageMap = []; // [{jewel_code, filename}] — returned so client can upload images
    const catCache = {};

    for (let r = 1; r < data.length; r++) {
        const row      = data[r];
        const jewelCode = String(row[col.jewel_code] ?? '').trim();
        if (!jewelCode) { skipped++; continue; }

        const designNo  = col.design_number !== undefined ? String(row[col.design_number] ?? '').trim() : jewelCode;
        const catName   = col.category      !== undefined ? String(row[col.category]      ?? '').trim() : '';
        const grossWt   = col.gross_weight  !== undefined ? parseFloat(row[col.gross_weight])  || null  : null;
        const netWt     = col.net_weight    !== undefined ? parseFloat(row[col.net_weight])    || null  : null;
        const qty       = col.quantity      !== undefined ? parseInt(row[col.quantity])        || 0     : 0;
        const descr     = col.description   !== undefined ? String(row[col.description]   ?? '').trim() || null : null;

        // Always include in imageMap so client can match against selected folder
        // If an image_path column was mapped, also include the extracted filename as a hint
        const imgEntry = { jewel_code: jewelCode, design_number: designNo || jewelCode };
        if (col.image_path !== undefined) {
            const rawPath = String(row[col.image_path] ?? '').trim();
            const filename = extractImageFilename(rawPath);
            if (filename) imgEntry.filename = filename;
        }
        imageMap.push(imgEntry);

        try {
            let catId = catName ? catCache[catName] : null;
            if (!catId && catName) {
                await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', [catName]);
                const [[cat]] = await db.query('SELECT id FROM categories WHERE name = ?', [catName]);
                catId = cat?.id || null;
                catCache[catName] = catId;
            }
            if (!catId && !catName) {
                const [[def]] = await db.query('SELECT id FROM categories ORDER BY id LIMIT 1');
                catId = def?.id;
                if (!catId) {
                    await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', ['General']);
                    const [[cat]] = await db.query("SELECT id FROM categories WHERE name='General'");
                    catId = cat.id;
                }
                catCache[''] = catId;
            }

            const [r2] = await db.query(
                `INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, quantity, description)
                 VALUES (?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                   category_id   = VALUES(category_id),
                   design_number = VALUES(design_number),
                   gross_weight  = VALUES(gross_weight),
                   net_weight    = VALUES(net_weight),
                   quantity      = VALUES(quantity),
                   description   = VALUES(description)`,
                [catId, designNo || jewelCode, jewelCode, grossWt, netWt, qty, descr]
            );
            if (r2.affectedRows >= 2) updated++;
            else inserted++;
        } catch (e) {
            errors.push(`Row ${r + 1} (${jewelCode}): ${e.message}`);
            skipped++;
        }
    }

    importTemp.delete(fileId);
    res.json({ ok: true, inserted, updated, skipped, errors, imageMap });
});

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

// Step 3 (optional): Upload individual product image matched from local folder
router.post('/import/images', imageUpload.single('image'), async (req, res) => {
    const { jewel_code } = req.body;
    if (!jewel_code || !req.file) return res.json({ ok: false, error: 'jewel_code and image required.' });
    try {
        const filename = await saveImage(req.file);
        await db.query('UPDATE products SET image_path = ? WHERE jewel_code = ?', [filename, jewel_code]);
        res.json({ ok: true, filename });
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
    res.json({ ok: true, parties: rows, total, pages: Math.ceil(total / per) });
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
    } catch (e) { res.json({ ok: false, error: 'Party ID already exists.' }); }
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
    } catch (e) { res.json({ ok: false, error: 'Party ID already exists.' }); }
});

router.delete('/parties/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM parties WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: 'Cannot delete party.' }); }
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
                    COALESCE(SUM(qi.quantity), 0) AS piece_count,
                    COALESCE(SUM(qi.quantity * qi.gross_weight), 0) AS total_gross_weight
             FROM quotations q
             JOIN parties p ON p.id=q.party_id
             LEFT JOIN quotation_items qi ON qi.quotation_id=q.id
             ${where}
             GROUP BY q.id, p.company_name, p.party_id
             ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );
        res.json({ ok: true, quotations: rows, total, pages: Math.ceil(total / per) });
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
            const filename = await saveImage(req.file);
            const p = '/uploads/' + filename;
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
