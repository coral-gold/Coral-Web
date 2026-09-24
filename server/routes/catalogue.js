'use strict';
const router  = require('express').Router();
const db      = require('../db');
const storage = require('../lib/storage');
const { requireParty } = require('../middleware/auth');
const { requireSiteUnlocked } = require('../middleware/siteLock');

// GET /api/catalogue/preview — public, no login required.
// A teaser, not the real catalogue: a handful of categories, a few sample
// images each. Full details (jewel code, stock, amount) are wholesaler-only.
// Gated by the site lock (Home/Catalog only use this) — /categories and
// /tags below are shared with the wholesaler catalogue's own filters and
// must stay reachable even while the public site is locked.
const PREVIEW_CATEGORIES = 6;
const PREVIEW_PER_CATEGORY = 4;

// Batches a product_images lookup for a set of product ids into
// { [productId]: [url, ...] } — shared by every catalogue endpoint below so
// each can build a product's full swipeable gallery (primary image first,
// then any extra angles an admin has added — item 1).
async function galleryUrlsByProduct(ids) {
    if (!ids.length) return {};
    const ph = ids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT product_id, image_path FROM product_images WHERE product_id IN (${ph}) ORDER BY sort_order, id`,
        ids
    );
    const byProduct = {};
    for (const r of rows) (byProduct[r.product_id] ??= []).push(storage.getPublicUrl(r.image_path));
    return byProduct;
}

router.get('/preview', requireSiteUnlocked, async (req, res) => {
    try {
        const [cats] = await db.query(
            `SELECT DISTINCT c.id, c.name FROM categories c
             JOIN product_categories pc ON pc.category_id = c.id
             JOIN products p ON p.id = pc.product_id AND p.active = 1
             ORDER BY c.name LIMIT ?`,
            [PREVIEW_CATEGORIES]
        );

        const categories = [];
        for (const cat of cats) {
            const [rows] = await db.query(
                `SELECT DISTINCT p.id, p.design_number, p.image_path, p.created_at FROM products p
                 JOIN product_categories pc ON pc.product_id = p.id
                 WHERE pc.category_id = ? AND p.active = 1
                 ORDER BY p.created_at DESC LIMIT ?`,
                [cat.id, PREVIEW_PER_CATEGORY]
            );
            const extraByProduct = await galleryUrlsByProduct(rows.map(r => r.id));
            categories.push({
                name: cat.name,
                products: rows.map(p => ({
                    id: p.id,
                    designNo: p.design_number,
                    image: storage.getPublicUrl(p.image_path),
                    images: [storage.getPublicUrl(p.image_path), ...(extraByProduct[p.id] || [])].filter(Boolean),
                })),
            });
        }

        res.json({ ok: true, categories });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/catalogue/featured — public, no login required.
// Admin-curated "Signature Items" for the Home page (Batch 17 item 3) —
// pulls whatever Admin has flagged is_featured on the Products page,
// instead of an arbitrary slice of the preview teaser.
const FEATURED_LIMIT = 8;

router.get('/featured', requireSiteUnlocked, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, design_number, image_path, description FROM products
             WHERE active = 1 AND is_featured = 1
             ORDER BY created_at DESC LIMIT ?`,
            [FEATURED_LIMIT]
        );
        const extraByProduct = await galleryUrlsByProduct(rows.map(r => r.id));
        const products = rows.map(p => ({
            id:          p.id,
            designNo:    p.design_number,
            image:       storage.getPublicUrl(p.image_path),
            images:      [storage.getPublicUrl(p.image_path), ...(extraByProduct[p.id] || [])].filter(Boolean),
            description: p.description,
        }));
        res.json({ ok: true, products });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/catalogue?page=1&category=&tag=&search=&netMin=&netMax= —
// wholesaler-only, full catalogue with real server-side pagination (same
// page/pages/total shape as the admin panel, not infinite-scroll).
// category/tag match a product that belongs to ANY of the given values (a
// product can have several of each) — repeat the query param for more than
// one, e.g. category=Rings&category=Bangles. netMin/netMax filter by net
// weight (grams), either bound optional (Batch 19 item 3).
router.get('/', requireParty, async (req, res) => {
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const per      = 24;
    const offset   = (page - 1) * per;
    const search   = (req.query.search || '').trim();
    const categories = [].concat(req.query.category || []).map(s => s.trim()).filter(Boolean);
    const tags        = [].concat(req.query.tag      || []).map(s => s.trim()).filter(Boolean);
    const netMin = req.query.netMin !== undefined && req.query.netMin !== '' ? parseFloat(req.query.netMin) : null;
    const netMax = req.query.netMax !== undefined && req.query.netMax !== '' ? parseFloat(req.query.netMax) : null;

    const conds  = ['p.active = 1'];
    const params = [];

    if (categories.length) {
        conds.push(`p.id IN (SELECT pc.product_id FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE c.name IN (${categories.map(() => '?').join(',')}))`);
        params.push(...categories);
    }
    if (tags.length) {
        conds.push(`p.id IN (SELECT pt.product_id FROM product_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.name IN (${tags.map(() => '?').join(',')}))`);
        params.push(...tags.map(t => t.toLowerCase()));
    }
    if (search) {
        conds.push('(p.design_number LIKE ? OR p.jewel_code LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like);
    }
    if (netMin !== null && !isNaN(netMin)) { conds.push('p.net_weight >= ?'); params.push(netMin); }
    if (netMax !== null && !isNaN(netMax)) { conds.push('p.net_weight <= ?'); params.push(netMax); }

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

        // Batched category/tag lookup per row (for filter chips on the card),
        // same pattern as the admin product list.
        const ids = rows.map(r => r.id);
        let catsByProduct = {}, tagsByProduct = {};
        if (ids.length) {
            const ph = ids.map(() => '?').join(',');
            const [catRows] = await db.query(
                `SELECT pc.product_id, c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id IN (${ph})`,
                ids
            );
            const [tagRows] = await db.query(
                `SELECT pt.product_id, t.name FROM product_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.product_id IN (${ph})`,
                ids
            );
            for (const r of catRows) (catsByProduct[r.product_id] ??= []).push(r.name);
            for (const r of tagRows) (tagsByProduct[r.product_id] ??= []).push(r.name);
        }

        const extraByProduct = await galleryUrlsByProduct(ids);
        const products = rows.map(p => ({
            id:           p.id,
            designNo:     p.design_number,
            jewelCode:    p.jewel_code,
            grossWeight:  p.gross_weight,
            netWeight:    p.net_weight,
            amount:       p.amount,
            stock:        p.quantity,
            image:        storage.getPublicUrl(p.image_path),
            images:       [storage.getPublicUrl(p.image_path), ...(extraByProduct[p.id] || [])].filter(Boolean),
            description:  p.description,
            category:     p.category,
            categories:   catsByProduct[p.id] || [p.category],
            tags:         tagsByProduct[p.id] || [],
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
            `SELECT DISTINCT c.name FROM categories c
             JOIN product_categories pc ON pc.category_id = c.id
             JOIN products p ON p.id = pc.product_id WHERE p.active = 1 ORDER BY c.name`
        );
        res.json({ ok: true, categories: rows.map(r => r.name) });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

// GET /api/catalogue/tags — used by the wholesaler catalogue's Tag filter.
router.get('/tags', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT DISTINCT t.name FROM tags t
             JOIN product_tags pt ON pt.tag_id = t.id
             JOIN products p ON p.id = pt.product_id WHERE p.active = 1 ORDER BY t.name`
        );
        res.json({ ok: true, tags: rows.map(r => r.name) });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
});

module.exports = router;
