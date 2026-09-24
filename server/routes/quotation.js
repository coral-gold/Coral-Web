'use strict';
const router = require('express').Router();
const path   = require('path');
const db     = require('../db');
const { requireParty } = require('../middleware/auth');
const { generateQuotationPDF } = require('../pdf');

const UPLOAD_DIR = path.join(__dirname, '../../assets/uploads');

router.use(requireParty);

async function nextNumber(conn) {
    const [[row]] = await conn.query(
        'SELECT quotation_number FROM quotations ORDER BY id DESC LIMIT 1'
    );
    if (!row) return 'CG-Q-0001';
    const n = parseInt((row.quotation_number || '').replace(/\D/g, ''), 10) || 0;
    return 'CG-Q-' + String(n + 1).padStart(4, '0');
}

// POST /api/quotation/generate  { notes }
router.post('/generate', async (req, res) => {
    const partyId = req.session.partyId;
    const notes   = (req.body.notes || '').trim().substring(0, 500);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [cartRows] = await conn.query(
            `SELECT ci.product_id, ci.quantity,
                    p.design_number, p.jewel_code, p.gross_weight, p.net_weight
             FROM cart_items ci JOIN products p ON p.id = ci.product_id
             WHERE ci.party_id = ?`,
            [partyId]
        );
        if (!cartRows.length) {
            await conn.rollback();
            return res.json({ ok: false, error: 'Cart is empty.' });
        }

        const qNum = await nextNumber(conn);
        const [result] = await conn.query(
            'INSERT INTO quotations (party_id, quotation_number, notes) VALUES (?,?,?)',
            [partyId, qNum, notes]
        );
        const qId = result.insertId;

        for (const row of cartRows) {
            await conn.query(
                `INSERT INTO quotation_items
                 (quotation_id, product_id, quantity, gross_weight, net_weight, design_number, jewel_code)
                 VALUES (?,?,?,?,?,?,?)`,
                [qId, row.product_id, row.quantity,
                 row.gross_weight, row.net_weight, row.design_number, row.jewel_code]
            );
        }
        await conn.query('DELETE FROM cart_items WHERE party_id = ?', [partyId]);
        await conn.commit();

        res.json({ ok: true, id: qId, number: qNum, pdfUrl: `/api/quotation/${qId}/pdf` });
    } catch (e) {
        await conn.rollback();
        console.error(e);
        res.status(500).json({ ok: false, error: 'Failed to generate quotation.' });
    } finally {
        conn.release();
    }
});

// GET /api/quotation   — list party's quotations
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT q.id, q.quotation_number, q.notes, q.created_at,
                    COUNT(qi.id) AS item_count,
                    COALESCE(SUM(qi.quantity), 0) AS piece_count,
                    COALESCE(SUM(qi.quantity * qi.gross_weight), 0) AS total_gross_weight
             FROM quotations q LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
             WHERE q.party_id = ?
             GROUP BY q.id ORDER BY q.created_at DESC`,
            [req.session.partyId]
        );
        res.json({ ok: true, quotations: rows });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

// GET /api/quotation/:id/pdf?mode=text|images
router.get('/:id/pdf', async (req, res) => {
    const withImages = req.query.mode === 'images';
    try {
        const [[q]] = await db.query(
            'SELECT * FROM quotations WHERE id = ? AND party_id = ?',
            [req.params.id, req.session.partyId]
        );
        if (!q) return res.status(404).json({ ok: false, error: 'Not found' });

        const [[party]] = await db.query('SELECT * FROM parties WHERE id = ?', [req.session.partyId]);
        const [items]   = await db.query(
            'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [q.id]
        );

        // If with-images mode, fetch current image_path for each product
        let itemImages = {};
        if (withImages) {
            const productIds = items.map(i => i.product_id).filter(Boolean);
            if (productIds.length) {
                const placeholders = productIds.map(() => '?').join(',');
                const [imgRows] = await db.query(
                    `SELECT id, image_path FROM products WHERE id IN (${placeholders})`,
                    productIds
                );
                for (const r of imgRows) {
                    if (r.image_path) itemImages[r.id] = r.image_path;
                }
            }
        }

        const pdfBuffer = await generateQuotationPDF(q, party, items, { withImages, itemImages });
        const suffix = withImages ? '-with-images' : '';
        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename="${q.quotation_number}${suffix}.pdf"`,
            'Content-Length':      pdfBuffer.length,
        });
        res.end(pdfBuffer);
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false });
    }
});

module.exports = router;
