'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const path    = require('path');
const XLSX    = require('xlsx');
const db      = require('../db');
const { requireAdmin }  = require('../middleware/auth');
const { imageUpload, xlsxUpload } = require('../middleware/upload');
const { generateQuotationPDF }    = require('../pdf');

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

// ── Products ───────────────────────────────────────────────────────────────────

router.get('/products', async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const per    = 25;
    const offset = (page - 1) * per;
    const search = (req.query.q || '').trim();

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
            `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
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
    const { category_id, design_number, jewel_code, gross_weight, net_weight, quantity, description, is_featured } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    const imgPath = req.file ? req.file.filename : null;
    try {
        const [r] = await db.query(
            'INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, quantity, image_path, description, is_featured) VALUES (?,?,?,?,?,?,?,?,?)',
            [category_id, design_number, jewel_code, gross_weight || null, net_weight || null,
             parseInt(quantity) || 0, imgPath, description || null, is_featured ? 1 : 0]
        );
        res.json({ ok: true, id: r.insertId });
    } catch (e) {
        res.json({ ok: false, error: 'Design Number or Jewel Code already exists.' });
    }
});

router.put('/products/:id', imageUpload.single('image'), async (req, res) => {
    const { category_id, design_number, jewel_code, gross_weight, net_weight, quantity, description, is_featured } = req.body;
    if (!category_id || !design_number || !jewel_code) {
        return res.json({ ok: false, error: 'Category, Design Number and Jewel Code are required.' });
    }
    try {
        const sets  = ['category_id=?','design_number=?','jewel_code=?','gross_weight=?','net_weight=?','quantity=?','description=?','is_featured=?'];
        const vals  = [category_id, design_number, jewel_code, gross_weight || null, net_weight || null,
                       parseInt(quantity) || 0, description || null, is_featured ? 1 : 0];
        if (req.file) { sets.push('image_path=?'); vals.push(req.file.filename); }
        await db.query(`UPDATE products SET ${sets.join(',')} WHERE id = ?`, [...vals, req.params.id]);
        res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: 'Design Number or Jewel Code already exists.' }); }
});

router.delete('/products/:id', async (req, res) => {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});

// ── Excel Import ───────────────────────────────────────────────────────────────

const ERP_ALIASES = {
    'jewel code':   'jewel_code',
    'style no':     'design_number',
    'style no.':    'design_number',
    'category':     'category',
    'gr wt':        'gross_weight',
    'gross wt':     'gross_weight',
    'net wt':       'net_weight',
    'qty':          'quantity',
};

router.post('/import', xlsxUpload.single('xlsx'), async (req, res) => {
    if (!req.file) return res.json({ ok: false, error: 'No file uploaded.' });
    try {
        const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws    = wb.Sheets[wb.SheetNames[0]];
        const data  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (data.length < 2) return res.json({ ok: true, imported: 0, skipped: 0, errors: [] });

        const rawHeaders = data[0].map(h => String(h).toLowerCase().trim());
        const headers    = rawHeaders.map(h => ERP_ALIASES[h] || h);
        const col        = Object.fromEntries(headers.map((h, i) => [h, i]));

        if (col.jewel_code === undefined) {
            return res.json({ ok: false, error: 'Required column "Jewel Code" not found.' });
        }

        let imported = 0, skipped = 0;
        const errors = [];

        for (let r = 1; r < data.length; r++) {
            const row       = data[r];
            const jewelCode = String(row[col.jewel_code] ?? '').trim();
            if (!jewelCode) { skipped++; continue; }

            const designNo  = col.design_number !== undefined ? String(row[col.design_number] ?? '').trim() : jewelCode;
            const catName   = col.category !== undefined      ? String(row[col.category] ?? '').trim()      : '';
            const grossWt   = col.gross_weight !== undefined  ? parseFloat(row[col.gross_weight]) || null   : null;
            const netWt     = col.net_weight !== undefined    ? parseFloat(row[col.net_weight])   || null   : null;
            const qty       = col.quantity !== undefined      ? parseInt(row[col.quantity])        || 0      : 0;

            try {
                let catId = null;
                if (catName) {
                    await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', [catName]);
                    const [[cat]] = await db.query('SELECT id FROM categories WHERE name = ?', [catName]);
                    catId = cat?.id || null;
                }
                if (!catId) {
                    const [[def]] = await db.query('SELECT id FROM categories ORDER BY id LIMIT 1');
                    catId = def?.id;
                }
                if (!catId) {
                    await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', ['General']);
                    const [[cat]] = await db.query("SELECT id FROM categories WHERE name='General'");
                    catId = cat.id;
                }

                await db.query(
                    `INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, quantity)
                     VALUES (?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE
                       category_id = VALUES(category_id),
                       design_number = VALUES(design_number),
                       gross_weight  = VALUES(gross_weight),
                       net_weight    = VALUES(net_weight),
                       quantity      = VALUES(quantity)`,
                    [catId, designNo || jewelCode, jewelCode, grossWt, netWt, qty]
                );
                imported++;
            } catch (e) {
                errors.push(`Row ${r + 1} (${jewelCode}): ${e.message}`);
                skipped++;
            }
        }
        res.json({ ok: true, imported, skipped, errors });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: 'Failed to parse file: ' + e.message });
    }
});

// ── Parties ────────────────────────────────────────────────────────────────────

router.get('/parties', async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const per    = 25;
    const offset = (page - 1) * per;
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM parties');
    const [rows] = await db.query(
        'SELECT id, party_id, company_name, phone, is_active, created_at FROM parties ORDER BY created_at DESC LIMIT ? OFFSET ?',
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

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM quotations q JOIN parties p ON p.id=q.party_id ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT q.id, q.quotation_number, q.created_at, p.company_name, p.party_id AS pid
             FROM quotations q JOIN parties p ON p.id=q.party_id ${where}
             ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );
        res.json({ ok: true, quotations: rows, total, pages: Math.ceil(total / per) });
    } catch (e) { res.status(500).json({ ok: false }); }
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
    try {
        const [[q]] = await db.query(
            'SELECT q.*, p.company_name, p.party_id, p.phone FROM quotations q JOIN parties p ON p.id=q.party_id WHERE q.id=?',
            [req.params.id]
        );
        if (!q) return res.status(404).send('Not found');
        const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [q.id]);
        const buf     = await generateQuotationPDF(q, { company_name: q.company_name, party_id: q.party_id, phone: q.phone }, items);
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.quotation_number}.pdf"`, 'Content-Length': buf.length });
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
            const p = '/uploads/' + req.file.filename;
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
