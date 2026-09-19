<?php
/**
 * Catalogue feed for the logged-in order section (batch 3, item 5) so
 * switching category does not reload the page.
 *
 * Unlike api/products.php (the public feed) this one includes jewel code,
 * weights and quantity, which are for signed-in wholesalers only.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/images.php';

header('Content-Type: application/json; charset=utf-8');

$party = current_party();
if (!$party) {
    http_response_code(401);
    echo json_encode(['error' => 'Your session has expired. Please sign in again.']);
    exit;
}

$categoryId = (int) get_str('category', '0');
$page = max(1, (int) get_str('page', '1'));
$perPage = 24;
$offset = ($page - 1) * $perPage;

$where = 'p.is_active = 1';
$params = [];
if ($categoryId > 0) {
    $where .= ' AND p.category_id = ?';
    $params[] = $categoryId;
}

$totalRow = db_one("SELECT COUNT(*) AS total FROM products p WHERE $where", $params);
$total = (int) ($totalRow['total'] ?? 0);

$rows = db_all(
    "SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE $where
      ORDER BY c.name, p.design_number, p.name
      LIMIT $perPage OFFSET $offset",
    $params
);

$products = array_map(static function (array $row): array {
    return [
        'id'          => (int) $row['id'],
        'name'        => $row['name'],
        'category'    => $row['category_name'],
        'designNo'    => $row['design_number'],
        'jewelCode'   => $row['jewel_code'],
        'grossWeight' => $row['gross_weight'],
        'netWeight'   => $row['net_weight'],
        'quantity'    => $row['quantity'],
        // Listing uses a thumbnail; the full photo is only for detail views.
        'image'       => $row['image_path'] !== '' ? url(thumb_path($row['image_path'], 400)) : '',
    ];
}, $rows);

echo json_encode([
    'products'   => $products,
    'total'      => $total,
    'page'       => $page,
    'totalPages' => max(1, (int) ceil($total / $perPage)),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
