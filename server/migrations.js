'use strict';
const db = require('./db');

// Lightweight idempotent migrations for columns added after initial launch.
// schema.sql's CREATE TABLE IF NOT EXISTS only applies to a brand-new
// database — an already-running production DB needs these ALTER TABLEs
// applied explicitly. Runs once at server startup; safe to run every time.
async function runMigrations() {
    if (!db.isConfigured()) return;
    try {
        await addColumnIfMissing('products', 'active', "TINYINT NOT NULL DEFAULT 1");
        await ensureIndex('products', 'idx_active', '(active)');
        // Admin-curated "Signature Items" flag for the Home page (Batch 17) —
        // already in schema.sql for new installs, but an existing production
        // DB needs it added explicitly.
        await addColumnIfMissing('products', 'is_featured', "TINYINT DEFAULT 0");
        await ensureIndex('products', 'idx_featured', '(is_featured)');
        // Static per-product diamond/stone amount (e.g. "2.5ct", "12 pcs") —
        // distinct from order quantity, which is being removed in favor of remark.
        await addColumnIfMissing('products', 'amount', "VARCHAR(50) NULL");
        // Free-text note a party can attach per item, replacing order quantity.
        await addColumnIfMissing('cart_items', 'remark', "TEXT NULL");
        await addColumnIfMissing('quotation_items', 'remark', "TEXT NULL");

        // Batch 18: multi-category + tags (already in schema.sql for new
        // installs; an existing production DB needs these created explicitly).
        await db.query(`
            CREATE TABLE IF NOT EXISTS product_categories (
                product_id INT NOT NULL,
                category_id INT NOT NULL,
                PRIMARY KEY (product_id, category_id),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(50) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS product_tags (
                product_id INT NOT NULL,
                tag_id INT NOT NULL,
                PRIMARY KEY (product_id, tag_id),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        `);
        // Backfill: every product's existing primary category also becomes a
        // row here, so filtering/display code only ever needs to read
        // product_categories, never products.category_id directly.
        await db.query(`
            INSERT IGNORE INTO product_categories (product_id, category_id)
            SELECT id, category_id FROM products
        `);

        // Batch 21: extra gallery photos beyond products.image_path, feeding
        // the swipeable image preview (item 1).
        await db.query(`
            CREATE TABLE IF NOT EXISTS product_images (
                id INT PRIMARY KEY AUTO_INCREMENT,
                product_id INT NOT NULL,
                image_path VARCHAR(255) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                INDEX idx_product (product_id)
            )
        `);

        // Batch 18: Settings module — defaults for an already-deployed DB
        // (schema.sql's INSERT IGNORE only runs for a brand-new database).
        const SETTINGS_DEFAULTS = {
            wholesaler_enabled:      '1',
            site_lock_enabled:       '0',
            site_lock_password_hash: '',
            show_net_weight:         '1',
            show_gross_weight:       '1',
            show_amount:             '1',
            pdf_layout:              'grid2',
            product_image_fit:       'cover',
            pagination_mode:         'classic',
        };
        for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
            await db.query('INSERT IGNORE INTO content (key_name, value) VALUES (?, ?)', [key, value]);
        }
    } catch (e) {
        console.error('[migrations] failed:', e.message);
    }
}

async function addColumnIfMissing(table, column, definition) {
    const [[{ c }]] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
    );
    if (c > 0) return;
    console.log(`[migrations] Adding ${table}.${column}`);
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureIndex(table, indexName, columns) {
    const [[{ c }]] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
        [table, indexName]
    );
    if (c > 0) return;
    console.log(`[migrations] Adding index ${indexName} on ${table}`);
    await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${columns}`);
}

module.exports = { runMigrations };
