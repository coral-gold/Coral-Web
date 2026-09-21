'use strict';
const router = require('express').Router();
const db     = require('../db');

// GET /api/catalogue?page=1&category=&search=&mode=public
router.get('/', async (req, res) => {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per      = 24;
    const offset   = (page - 1) * per;
    const category = (req.query.category || '').trim();
    const search   = (req.query.search   || '').trim();
    const mode     = req.query.mode === 'public' ? 'public' : 'wholesaler';

    const conds  = ['p.quantity > 0'];
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

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${where}`,
            params
        );
        const [rows] = await db.query(
            `SELECT p.id, p.design_number, p.jewel_code, p.gross_weight, p.net_weight,
                    p.quantity, p.image_path, p.description, c.name AS category
             FROM products p JOIN categories c ON c.id = p.category_id
             ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );

        const products = rows.map(p => ({
            id:           p.id,
            designNo:     p.design_number,
            jewelCode:    mode === 'public' ? undefined : p.jewel_code,
            grossWeight:  p.gross_weight,
            netWeight:    p.net_weight,
            stock:        mode === 'public' ? undefined : p.quantity,
            image:        p.image_path ? '/uploads/' + p.image_path.replace(/^.*[\\/]/, '') : null,
            description:  p.description,
            category:     p.category,
        }));

        res.json({ ok: true, products, total, hasMore: offset + per < total });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/catalogue/categories
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT DISTINCT c.name FROM categories c JOIN products p ON p.category_id = c.id WHERE p.quantity > 0 ORDER BY c.name'
        );
        res.json({ ok: true, categories: rows.map(r => r.name) });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

module.exports = router;
