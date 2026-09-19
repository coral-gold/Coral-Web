<?php
/**
 * Public product feed for the static catalogue pages.
 *
 * Deliberately omits jewel_code, gross_weight and net_weight: those are
 * visible only inside the logged-in order section (SRS 3.3 / 4.3).
 */

require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$rows = db_all(
    'SELECT p.id, p.name, p.design_number, p.description, p.image_path, p.featured,
            c.name AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY c.sort_order, p.sort_order, p.name'
);

$products = array_map(static function (array $row): array {
    return [
        'id'           => (int) $row['id'],
        'title'        => $row['name'],
        'category'     => $row['category'] ?? 'Uncategorised',
        'designNumber' => $row['design_number'],
        'description'  => $row['description'],
        'image'        => $row['image_path'],
        'featured'     => (bool) $row['featured'],
    ];
}, $rows);

echo json_encode($products, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
