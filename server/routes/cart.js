'use strict';
const router  = require('express').Router();
const db      = require('../db');
const storage = require('../lib/storage');
const { requireParty } = require('../middleware/auth');

router.use(requireParty);

async function cartPayload(partyId) {
    const [rows] = await db.query(
        `SELECT ci.id AS cartId, ci.product_id AS productId, ci.remark,
                p.design_number AS designNo, p.jewel_code AS jewelCode,
                p.gross_weight AS grossWeight, p.net_weight AS netWeight,
                p.amount, p.image_path AS image
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.party_id = ? AND p.active = 1 ORDER BY ci.created_at`,
        [partyId]
    );
    const lines = rows.map(r => ({
        ...r,
        image: storage.getPublicUrl(r.image),
    }));
    return { ok: true, lines, itemCount: lines.length };
}

// GET /api/cart
router.get('/', async (req, res) => {
    try { res.json(await cartPayload(req.session.partyId)); }
    catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

// POST /api/cart  { action, productId, remark? }
// No quantity — adding a product just puts one line in the cart. Each line
// can optionally carry a free-text remark instead.
router.post('/', async (req, res) => {
    const { action, productId, remark } = req.body;
    const partyId = req.session.partyId;

    try {
        if (action === 'add') {
            const [[prod]] = await db.query('SELECT id FROM products WHERE id = ? AND active = 1', [productId]);
            if (!prod) return res.json({ ok: false, error: 'Product not found.' });
            await db.query(
                `INSERT INTO cart_items (party_id, product_id, quantity) VALUES (?,?,1)
                 ON DUPLICATE KEY UPDATE id = id`, // already in cart — no-op
                [partyId, productId]
            );
        } else if (action === 'remark') {
            await db.query(
                'UPDATE cart_items SET remark = ? WHERE party_id = ? AND product_id = ?',
                [(remark || '').substring(0, 500), partyId, productId]
            );
        } else if (action === 'remove') {
            await db.query(
                'DELETE FROM cart_items WHERE party_id = ? AND product_id = ?',
                [partyId, productId]
            );
        } else if (action === 'clear') {
            await db.query('DELETE FROM cart_items WHERE party_id = ?', [partyId]);
        } else {
            return res.json({ ok: false, error: 'Unknown action' });
        }
        res.json(await cartPayload(partyId));
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

module.exports = router;
