<?php
declare(strict_types=1);

use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Import products from an Excel file.
 * Upserts by jewel_code. Returns array with counts.
 *
 * Expected columns (case-insensitive):
 *   design_number | jewel_code | category | gross_weight | net_weight | quantity | description
 */
function import_stock_xlsx(string $filepath): array {
    $spreadsheet = IOFactory::load($filepath);
    $sheet       = $spreadsheet->getActiveSheet();
    $rows        = $sheet->toArray(null, true, true, false);

    if (empty($rows)) return ['imported' => 0, 'skipped' => 0, 'errors' => ['Empty file']];

    // Normalise headers from first row
    $headers = array_map(fn($h) => strtolower(trim((string)$h)), $rows[0]);
    $col     = array_flip($headers);

    $required = ['jewel_code'];
    foreach ($required as $r) {
        if (!isset($col[$r])) {
            return ['imported' => 0, 'skipped' => 0, 'errors' => ["Missing required column: {$r}"]];
        }
    }

    $imported = 0;
    $skipped  = 0;
    $errors   = [];

    foreach (array_slice($rows, 1) as $idx => $row) {
        $line = $idx + 2; // human-readable row number

        $jewel_code = trim((string)($row[$col['jewel_code']] ?? ''));
        if ($jewel_code === '') { $skipped++; continue; }

        $design_number = trim((string)($row[$col['design_number'] ?? -1] ?? ''));
        $gross_weight  = isset($col['gross_weight']) ? (float)($row[$col['gross_weight']] ?? 0) : null;
        $net_weight    = isset($col['net_weight'])   ? (float)($row[$col['net_weight']]   ?? 0) : null;
        $quantity      = isset($col['quantity'])      ? (int)($row[$col['quantity']]       ?? 0) : 0;
        $description   = isset($col['description'])  ? trim((string)($row[$col['description']] ?? '')) : '';

        // Resolve category
        $category_name = isset($col['category']) ? trim((string)($row[$col['category']] ?? '')) : '';
        $category_id   = null;
        if ($category_name !== '') {
            $cat = db_one('SELECT id FROM categories WHERE name = ?', [$category_name]);
            if (!$cat) {
                db_run('INSERT IGNORE INTO categories (name) VALUES (?)', [$category_name]);
                $cat = db_one('SELECT id FROM categories WHERE name = ?', [$category_name]);
            }
            $category_id = $cat ? (int)$cat['id'] : null;
        }
        if (!$category_id) {
            // Use or create "Uncategorised"
            $cat = db_one('SELECT id FROM categories WHERE name = ?', ['Uncategorised']);
            if (!$cat) {
                db_run('INSERT IGNORE INTO categories (name) VALUES (?)', ['Uncategorised']);
                $cat = db_one('SELECT id FROM categories WHERE name = ?', ['Uncategorised']);
            }
            $category_id = $cat ? (int)$cat['id'] : 1;
        }

        // Use jewel_code as design_number if missing
        if ($design_number === '') $design_number = $jewel_code;

        try {
            $existing = db_one('SELECT id FROM products WHERE jewel_code = ?', [$jewel_code]);
            if ($existing) {
                db_run('UPDATE products SET
                    category_id   = ?,
                    design_number = ?,
                    gross_weight  = ?,
                    net_weight    = ?,
                    quantity      = ?,
                    description   = ?
                    WHERE jewel_code = ?',
                    [$category_id, $design_number, $gross_weight, $net_weight, $quantity, $description, $jewel_code]);
            } else {
                db_run('INSERT INTO products (category_id, design_number, jewel_code, gross_weight, net_weight, quantity, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$category_id, $design_number, $jewel_code, $gross_weight, $net_weight, $quantity, $description]);
            }
            $imported++;
        } catch (\Exception $e) {
            $errors[] = "Row {$line}: " . $e->getMessage();
            $skipped++;
        }
    }

    return ['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors];
}
