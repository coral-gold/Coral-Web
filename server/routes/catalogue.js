'use strict';
const router  = require('express').Router();
const db      = require('../db');
const storage = require('../lib/storage');
const { requireParty } = require('../middleware/auth');

// GET /api/catalogue/preview — public, no login required.
// A teaser, not the real catalogue: a handful of categories, a few sample
// images each. Full details (jewel code, stock, amount) are wholesaler-only.
const PREVIEW_CATEGORIES = 6;
const PREVIEW_PER_CATEGORY = 4;

router.get('/preview', async (req, res) => {
    try {
        const [cats] = await db.query(
            `SELECT DISTINCT c.id, c.name FROM categories c
             JOIN products p ON p.category_id = c.id AND p.active = 1
             ORDER BY c.name LIMIT ?`,
            [PREVIEW_CATEGORIES]
        );

        const categories = [];
        for (const cat of cats) {
            const [rows] = await db.query(
                `SELECT id, design_number, image_path FROM products
                 WHERE category_id = ? AND active = 1
                 ORDER BY created_at DESC LIMIT ?`,
                [cat.id, PREVIEW_PER_CATEGORY]
            );
            categories.push({
                name: cat.name,
                products: rows.map(p => ({
                    id: p.id,
                    designNo: p.design_number,
                    image: storage.getPublicUrl(p.image_path),
                })),
            });
        }

        res.json({ ok: true, categories });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/catalogue?page=1&category=&search= — wholesaler-only, full
// catalogue with real server-side pagination (same page/pages/total shape
// as the admin panel, not infinite-scroll).
router.get('/', requireParty, async (req, res) => {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per      = 24;
    const offset   = (page - 1) * per;
    const category = (req.query.category || '').trim();
    const search   = (req.query.search   || '').trim();

    const conds  = ['p.active = 1'];
    const params = [];

    if (category) {
        conds.push('c.name = ?');
        params.push(category);
    }
    if (search) {
        conds.push('(p.design_number LIKE ? OR p.jewel_code LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like);
    }

    const where = 'WHERE ' + conds.join(' AND ');

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${where}`,
            params
        );
        const [rows] = await db.query(
            `SELECT p.id, p.design_number, p.jewel_code, p.gross_weight, p.net_weight,
                    p.quantity, p.amount, p.image_path, p.description, c.name AS category
             FROM products p JOIN categories c ON c.id = p.category_id
             ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );

        const products = rows.map(p => ({
            id:           p.id,
            designNo:     p.design_number,
            jewelCode:    p.jewel_code,
            grossWeight:  p.gross_weight,
            netWeight:    p.net_weight,
            amount:       p.amount,
            stock:        p.quantity,
            image:        storage.getPublicUrl(p.image_path),
            description:  p.description,
            category:     p.category,
        }));

        res.json({ ok: true, products, total, pages: Math.max(1, Math.ceil(total / per)) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/catalogue/categories — used by the wholesaler catalogue's filter
// buttons. Category names aren't sensitive, so this stays unauthenticated.
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT DISTINCT c.name FROM categories c JOIN products p ON p.category_id = c.id WHERE p.active = 1 ORDER BY c.name'
        );
        res.json({ ok: true, categories: rows.map(r => r.name) });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

module.exports = router;
