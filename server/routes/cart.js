'use strict';
const router = require('express').Router();
const db     = require('../db');
const { requireParty } = require('../middleware/auth');

router.use(requireParty);

async function cartPayload(partyId) {
    const [rows] = await db.query(
        `SELECT ci.id AS cartId, ci.product_id AS productId, ci.quantity,
                p.design_number AS designNo, p.jewel_code AS jewelCode,
                p.gross_weight AS grossWeight, p.net_weight AS netWeight,
                p.image_path AS image
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.party_id = ? ORDER BY ci.created_at`,
        [partyId]
    );
    const lines = rows.map(r => ({
        ...r,
        image: r.image ? '/uploads/' + r.image.replace(/^.*[\\/]/, '') : null,
    }));
    const itemCount  = lines.length;
    const pieceCount = lines.reduce((s, l) => s + l.quantity, 0);
    return { ok: true, lines, itemCount, pieceCount };
}

// GET /api/cart
router.get('/', async (req, res) => {
    try { res.json(await cartPayload(req.session.partyId)); }
    catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

// POST /api/cart  { action, productId, qty }
router.post('/', async (req, res) => {
    const { action, productId, qty } = req.body;
    const partyId = req.session.partyId;

    try {
        if (action === 'add') {
            const [[prod]] = await db.query('SELECT quantity FROM products WHERE id = ?', [productId]);
            if (!prod || prod.quantity < 1) {
                return res.json({ ok: false, error: 'Item out of stock.' });
            }
            const addQty = Math.max(1, parseInt(qty) || 1);
            await db.query(
                `INSERT INTO cart_items (party_id, product_id, quantity) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
                [partyId, productId, addQty, addQty]
            );
        } else if (action === 'set') {
            const setQty = Math.max(1, parseInt(qty) || 1);
            await db.query(
                'UPDATE cart_items SET quantity = ? WHERE party_id = ? AND product_id = ?',
                [setQty, partyId, productId]
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
