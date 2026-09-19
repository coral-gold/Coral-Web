<?php
/**
 * Stock import from the ERP's Excel export (batch 3, item 3).
 *
 * Only these columns are read; everything else in the sheet is ignored:
 *
 *   Jewel Code → jewel_code       Gr Wt  → gross_weight
 *   Style No   → design_number    Net Wt → net_weight
 *   Category   → category         Qty    → quantity
 *
 * Rows are upserted on Jewel Code, so re-importing the same export updates
 * the existing products instead of creating duplicates.
 */

declare(strict_types=1);

require_once CORAL_ROOT . '/vendor/autoload.php';

use OpenSpout\Reader\XLSX\Reader;

/** Header text → our field name. Keys are normalised (lowercase, alphanumeric only). */
const STOCK_COLUMN_MAP = [
    'jewelcode'    => 'jewel_code',
    'styleno'      => 'design_number',
    'style'        => 'design_number',
    'designno'     => 'design_number',
    'designnumber' => 'design_number',
    'category'     => 'category',
    'grwt'         => 'gross_weight',
    'grosswt'      => 'gross_weight',
    'grossweight'  => 'gross_weight',
    'netwt'        => 'net_weight',
    'netweight'    => 'net_weight',
    'qty'          => 'quantity',
    'quantity'     => 'quantity',
];

/** Strips spacing/punctuation so "Gr Wt", "GR. WT" and "grwt" all match. */
function normalise_header(string $header): string
{
    return preg_replace('/[^a-z0-9]/', '', strtolower(trim($header))) ?? '';
}

function parse_weight($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        return (float) $value;
    }
    $cleaned = preg_replace('/[^0-9.\-]/', '', (string) $value) ?? '';
    return $cleaned === '' || !is_numeric($cleaned) ? null : (float) $cleaned;
}

function cell_text($value): string
{
    if ($value instanceof DateTimeInterface) {
        return $value->format('Y-m-d');
    }
    if (is_float($value) && floor($value) === $value) {
        return (string) (int) $value; // 1042.0 → "1042", not "1042.0"
    }
    return trim((string) $value);
}

/**
 * Reads the spreadsheet into rows keyed by our field names.
 * Returns ['rows' => [...], 'found' => [matched source headers], 'ignored' => [...]].
 */
function parse_stock_file(string $path): array
{
    $reader = new Reader();
    $reader->open($path);

    $columns = [];
    $found = [];
    $ignored = [];
    $rows = [];

    foreach ($reader->getSheetIterator() as $sheet) {
        foreach ($sheet->getRowIterator() as $rowIndex => $row) {
            $cells = $row->toArray();

            if ($rowIndex === 1 || !$columns) {
                // First non-empty row is the header.
                $hasHeader = false;
                foreach ($cells as $i => $cell) {
                    $key = normalise_header(cell_text($cell));
                    if ($key === '') {
                        continue;
                    }
                    $hasHeader = true;
                    if (isset(STOCK_COLUMN_MAP[$key])) {
                        $columns[$i] = STOCK_COLUMN_MAP[$key];
                        $found[] = cell_text($cell);
                    } else {
                        $ignored[] = cell_text($cell);
                    }
                }
                if ($hasHeader) {
                    continue;
                }
            }

            $record = [];
            foreach ($columns as $i => $field) {
                $record[$field] = $cells[$i] ?? null;
            }

            $jewel = cell_text($record['jewel_code'] ?? '');
            $design = cell_text($record['design_number'] ?? '');
            if ($jewel === '' && $design === '') {
                continue; // blank row
            }

            $rows[] = [
                'jewel_code'    => $jewel,
                'design_number' => $design,
                'category'      => cell_text($record['category'] ?? ''),
                'gross_weight'  => parse_weight($record['gross_weight'] ?? null),
                'net_weight'    => parse_weight($record['net_weight'] ?? null),
                'quantity'      => ($q = cell_text($record['quantity'] ?? '')) === '' ? null : (int) round((float) $q),
            ];
        }
        break; // first sheet only
    }

    $reader->close();

    return ['rows' => $rows, 'found' => $found, 'ignored' => $ignored];
}

/** Finds a category by name, creating it if it does not exist yet. */
function category_id_for(string $name): ?int
{
    $name = trim($name);
    if ($name === '') {
        return null;
    }

    $existing = db_one('SELECT id FROM categories WHERE name = ?', [$name]);
    if ($existing) {
        return (int) $existing['id'];
    }

    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $name) ?? '', '-'));
    if ($slug === '') {
        $slug = 'category-' . bin2hex(random_bytes(3));
    }
    // Two categories could normalise to the same slug; keep slugs unique.
    if (db_one('SELECT id FROM categories WHERE slug = ?', [$slug])) {
        $slug .= '-' . bin2hex(random_bytes(2));
    }

    db_run('INSERT INTO categories (name, slug) VALUES (?, ?)', [$name, $slug]);
    return (int) db()->lastInsertId();
}

/**
 * Looks for a product photo named after the Style No, matching the ERP's
 * folder convention.
 *
 * NOTE: pending confirmation of Coral Gold's exact convention (batch 3,
 * item 4 — the Android app's matching code has not been shared yet). Today
 * it matches "<Style No>.<ext>", case-insensitively, under assets/products
 * then assets/uploads.
 */
function image_for_style(string $styleNo): ?string
{
    $styleNo = trim($styleNo);
    if ($styleNo === '') {
        return null;
    }

    foreach (['assets/products', 'assets/uploads'] as $dir) {
        $full = CORAL_ROOT . '/' . $dir;
        if (!is_dir($full)) {
            continue;
        }
        foreach ((array) scandir($full) as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $base = pathinfo($file, PATHINFO_FILENAME);
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (strcasecmp($base, $styleNo) === 0 && in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
                return $dir . '/' . $file;
            }
        }
    }

    return null;
}

/**
 * Upserts parsed rows by Jewel Code.
 * Returns counts plus any per-row problems.
 */
function import_stock_rows(array $rows): array
{
    $result = ['inserted' => 0, 'updated' => 0, 'skipped' => 0, 'images' => 0, 'problems' => []];

    foreach ($rows as $index => $row) {
        $jewel = $row['jewel_code'];
        if ($jewel === '') {
            $result['skipped']++;
            $result['problems'][] = 'Row ' . ($index + 2) . ': no Jewel Code, so there is nothing to match on.';
            continue;
        }

        $categoryId = category_id_for($row['category']);
        $image = image_for_style($row['design_number']);
        $existing = db_one('SELECT * FROM products WHERE jewel_code = ?', [$jewel]);

        if ($existing) {
            // Keep the existing photo and name unless the import supplies better.
            $imagePath = $image ?? $existing['image_path'];
            if ($image !== null && $image !== $existing['image_path']) {
                $result['images']++;
            }

            db_run(
                'UPDATE products
                    SET design_number = ?, category_id = ?, gross_weight = ?, net_weight = ?,
                        quantity = ?, image_path = ?
                  WHERE id = ?',
                [
                    $row['design_number'] !== '' ? $row['design_number'] : $existing['design_number'],
                    $categoryId ?? $existing['category_id'],
                    $row['gross_weight'], $row['net_weight'], $row['quantity'],
                    $imagePath, (int) $existing['id'],
                ]
            );
            $result['updated']++;
            continue;
        }

        if ($image !== null) {
            $result['images']++;
        }

        // A new product needs a display name for the public catalogue; the
        // Style No is the most recognisable thing the export gives us.
        $name = $row['design_number'] !== '' ? $row['design_number'] : $jewel;

        db_run(
            'INSERT INTO products
               (jewel_code, design_number, category_id, gross_weight, net_weight, quantity,
                name, image_path, is_active)
             VALUES (?,?,?,?,?,?,?,?,1)',
            [
                $jewel, $row['design_number'] !== '' ? $row['design_number'] : null, $categoryId,
                $row['gross_weight'], $row['net_weight'], $row['quantity'],
                $name, $image ?? '',
            ]
        );
        $result['inserted']++;
    }

    return $result;
}
