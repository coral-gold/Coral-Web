<?php
/**
 * Schema upgrades for databases created before a change shipped.
 *
 * Each step checks the live schema through information_schema before acting,
 * so the whole set is safe to run repeatedly and works on both MySQL and
 * MariaDB (MySQL 8 has no "DROP COLUMN IF EXISTS", which is why this is PHP
 * rather than a .sql file).
 *
 * A fresh install never needs this — sql/schema.sql already describes the
 * current shape — but running it anyway is harmless.
 */

declare(strict_types=1);

function db_name(): string
{
    return (string) config('db.name', '');
}

function column_exists(string $table, string $column): bool
{
    $row = db_one(
        'SELECT COUNT(*) AS n FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [db_name(), $table, $column]
    );
    return (int) ($row['n'] ?? 0) > 0;
}

function index_exists(string $table, string $index): bool
{
    $row = db_one(
        'SELECT COUNT(*) AS n FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
        [db_name(), $table, $index]
    );
    return (int) ($row['n'] ?? 0) > 0;
}

function table_exists(string $table): bool
{
    $row = db_one(
        'SELECT COUNT(*) AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [db_name(), $table]
    );
    return (int) ($row['n'] ?? 0) > 0;
}

/**
 * Returns a list of human-readable descriptions of what was changed.
 * An empty list means the database was already up to date.
 */
function run_migrations(): array
{
    $done = [];

    if (!table_exists('products')) {
        return $done; // nothing installed yet
    }

    // -------------------------------------------- item 1: category is a name
    if (column_exists('categories', 'sort_order')) {
        db_run('ALTER TABLE categories DROP COLUMN sort_order');
        $done[] = 'Removed the ordering field from categories.';
    }

    // ----------------------------- item 2: party loses email + self-service
    foreach (['email', 'contact_person', 'must_change_password'] as $column) {
        if (column_exists('parties', $column)) {
            db_run('ALTER TABLE parties DROP COLUMN ' . $column);
            $done[] = 'Removed parties.' . $column . '.';
        }
    }

    // --------------------------------- items 3 & 6: product master fields
    if (column_exists('products', 'sort_order')) {
        db_run('ALTER TABLE products DROP COLUMN sort_order');
        $done[] = 'Removed the ordering field from products.';
    }

    if (!column_exists('products', 'quantity')) {
        db_run('ALTER TABLE products ADD COLUMN quantity INT UNSIGNED NULL AFTER net_weight');
        $done[] = 'Added the Quantity field to products.';
    }

    // ------------------------- item 5: indexed lookups, and the upsert key
    if (!index_exists('products', 'uq_products_jewel_code')) {
        // Blank codes become NULL first: a unique index rejects repeated ''
        // but allows any number of NULLs, so products entered by hand
        // without a jewel code still save.
        db_run("UPDATE products SET jewel_code = NULL WHERE jewel_code = ''");

        $dupes = db_all(
            'SELECT jewel_code, COUNT(*) AS n FROM products
              WHERE jewel_code IS NOT NULL
              GROUP BY jewel_code HAVING n > 1'
        );
        if ($dupes) {
            $codes = implode(', ', array_column($dupes, 'jewel_code'));
            throw new RuntimeException(
                'Cannot make Jewel Code unique — these codes appear more than once: ' . $codes .
                '. Fix the duplicates under Products, then run this again.'
            );
        }

        db_run('CREATE UNIQUE INDEX uq_products_jewel_code ON products (jewel_code)');
        $done[] = 'Made Jewel Code unique, so re-importing the stock file updates instead of duplicating.';
    }

    if (!index_exists('products', 'idx_products_category_active')) {
        db_run('CREATE INDEX idx_products_category_active ON products (category_id, is_active)');
        $done[] = 'Indexed products by category for faster catalogue loads.';
    }

    return $done;
}
