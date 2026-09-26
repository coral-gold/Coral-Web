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
        // Group by the resolved display name, not the raw category id — two
        // raw categories mapped to the same Parent Category (e.g. WTDC and
        // LRDC both → "Watch") must show as one section, never two, and
        // never under their raw code (Batch 23 item 6).
        // A disabled category (or one mapped under a disabled parent) is
        // excluded outright — Enable/Disable is a visibility toggle, not a
        // delete, so re-enabling it brings the section straight back
        // without needing to touch any product (Batch 30 item 1).
        const [catRows] = await db.query(
            `SELECT c.id, COALESCE(parentc.name, c.name) AS display_name
             FROM categories c
             LEFT JOIN categories parentc ON parentc.id = c.parent_id
             JOIN product_categories pc ON pc.category_id = c.id
             JOIN products p ON p.id = pc.product_id AND p.active = 1
             JOIN categories pcat ON pcat.id = p.category_id
             LEFT JOIN categories pparent ON pparent.id = pcat.parent_id
             WHERE c.is_active = 1 AND (parentc.id IS NULL OR parentc.is_active = 1)
               AND pcat.is_active = 1 AND (pparent.id IS NULL OR pparent.is_active = 1)`
        );
        const idsByName = {};
        for (const r of catRows) (idsByName[r.display_name] ??= new Set()).add(r.id);
        const names = Object.keys(idsByName).sort().slice(0, PREVIEW_CATEGORIES);

        const categories = [];
        for (const name of names) {
            const ids = [...idsByName[name]];
            const ph = ids.map(() => '?').join(',');
            // Also requires the product's OWN (primary) category to be
            // active — otherwise a product whose primary category is
            // disabled could still surface here via an active *secondary*
            // category association, contradicting the count above (which
            // already excludes it) and the main catalogue list (Batch 30
            // item 1's own consistency, not just this section's).
            const [rows] = await db.query(
                `SELECT DISTINCT p.id, p.design_number, p.image_path, p.created_at FROM products p
                 JOIN product_categories pc ON pc.product_id = p.id
                 JOIN categories pcat ON pcat.id = p.category_id
                 LEFT JOIN categories pparent ON pparent.id = pcat.parent_id
                 WHERE pc.category_id IN (${ph}) AND p.active = 1
                   AND pcat.is_active = 1 AND (pparent.id IS NULL OR pparent.is_active = 1)
                 ORDER BY p.created_at DESC LIMIT ?`,
                [...ids, PREVIEW_PER_CATEGORY]
            );
            const extraByProduct = await galleryUrlsByProduct(rows.map(r => r.id));
            categories.push({
                name,
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
        // Excludes a featured product whose (primary) category, or that
        // category's Parent Category, has been disabled — Batch 30 item 1:
        // a disabled category hides its products everywhere customer-facing,
        // Signature Items included, without un-featuring anything.
        const [rows] = await db.query(
            `SELECT p.id, p.design_number, p.image_path, p.description FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN categories parentc ON parentc.id = c.parent_id
             WHERE p.active = 1 AND p.is_featured = 1
               AND c.is_active = 1 AND (parentc.id IS NULL OR parentc.is_active = 1)
             ORDER BY p.created_at DESC LIMIT ?`,
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

    // A disabled category (or one mapped under a disabled parent) hides its
    // products here unconditionally — not just by leaving its name out of
    // the filter chips, since a hand-built ?category= request could
    // otherwise still reach them (Batch 30 item 1).
    const conds  = ['p.active = 1', 'c.is_active = 1', '(parentc.id IS NULL OR parentc.is_active = 1)'];
    const params = [];

    if (categories.length) {
        // Filtering by a Parent Category name (what the customer actually
        // sees) must match every raw category mapped to it, not just a raw
        // category literally named that (item 6).
        conds.push(`p.id IN (
            SELECT pc.product_id FROM product_categories pc
            JOIN categories c2 ON c2.id = pc.category_id
            LEFT JOIN categories parentc2 ON parentc2.id = c2.parent_id
            WHERE COALESCE(parentc2.name, c2.name) IN (${categories.map(() => '?').join(',')})
              AND c2.is_active = 1 AND (parentc2.id IS NULL OR parentc2.is_active = 1)
        )`);
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
            `SELECT COUNT(*) AS total FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN categories parentc ON parentc.id = c.parent_id
             ${where}`,
            params
        );
        const [rows] = await db.query(
            `SELECT p.id, p.design_number, p.jewel_code, p.gross_weight, p.net_weight,
                    p.quantity, p.amount, p.image_path, p.description,
                    COALESCE(parentc.name, c.name) AS category
             FROM products p
             JOIN categories c ON c.id = p.category_id
             LEFT JOIN categories parentc ON parentc.id = c.parent_id
             ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
            [...params, per, offset]
        );

        // Batched category/tag lookup per row (for filter chips on the card),
        // same pattern as the admin product list. Categories are resolved to
        // their Parent Category name and de-duplicated — a product in both
        // WTDC and LRDC (both → "Watch") shows "Watch" once, not twice.
        const ids = rows.map(r => r.id);
        let catsByProduct = {}, tagsByProduct = {};
        if (ids.length) {
            const ph = ids.map(() => '?').join(',');
            const [catRows] = await db.query(
                `SELECT pc.product_id, COALESCE(parentc.name, c.name) AS name
                 FROM product_categories pc
                 JOIN categories c ON c.id = pc.category_id
                 LEFT JOIN categories parentc ON parentc.id = c.parent_id
                 WHERE pc.product_id IN (${ph})
                   AND c.is_active = 1 AND (parentc.id IS NULL OR parentc.is_active = 1)`,
                ids
            );
            const [tagRows] = await db.query(
                `SELECT pt.product_id, t.name FROM product_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.product_id IN (${ph})`,
                ids
            );
            const catSetByProduct = {};
            for (const r of catRows) (catSetByProduct[r.product_id] ??= new Set()).add(r.name);
            for (const [pid, set] of Object.entries(catSetByProduct)) catsByProduct[pid] = [...set];
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
// buttons (and reused by Admin's own Products filters). Category names
// aren't sensitive, so this stays unauthenticated. Each entry carries a
// product count (COUNT(DISTINCT p.id), not a row count — two raw categories
// mapped to the same Parent, e.g. WTDC and LRDC both → "Watch", must not
// double-count a product that happens to sit in both) so the wholesaler
// catalogue can show "Watch (24)" next to the name (Batch 24 item 2).
router.get('/categories', async (req, res) => {
    try {
        // Resolved to Parent Category name (item 6) — a customer never sees
        // a raw ERP code like "WTDC", only "Watch". A disabled category (or
        // one mapped under a disabled parent) is left out entirely — it's
        // a pure visibility toggle, so re-enabling it brings it straight
        // back with no other change needed (Batch 30 item 1). Also requires
        // the product's OWN (primary) category to be active, not just the
        // category this row is being counted under — otherwise a product
        // whose primary category is disabled but that also carries an
        // active *secondary* category association would still get counted
        // here even though the main catalogue list (gated by the primary
        // category alone) never actually shows it.
        const [rows] = await db.query(
            `SELECT COALESCE(parentc.name, c.name) AS name, COUNT(DISTINCT p.id) AS count
             FROM categories c
             LEFT JOIN categories parentc ON parentc.id = c.parent_id
             JOIN product_categories pc ON pc.category_id = c.id
             JOIN products p ON p.id = pc.product_id
             JOIN categories pcat ON pcat.id = p.category_id
             LEFT JOIN categories pparent ON pparent.id = pcat.parent_id
             WHERE p.active = 1
               AND c.is_active = 1 AND (parentc.id IS NULL OR parentc.is_active = 1)
               AND pcat.is_active = 1 AND (pparent.id IS NULL OR pparent.is_active = 1)
             GROUP BY COALESCE(parentc.name, c.name) ORDER BY name`
        );
        res.json({ ok: true, categories: rows.map(r => ({ name: r.name, count: r.count })) });
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
