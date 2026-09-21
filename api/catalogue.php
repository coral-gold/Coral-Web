<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';

$party = current_party();
if (!$party) json_out(['ok' => false, 'error' => 'Unauthenticated'], 401);

$page     = max(1, get_int('page', 1));
$per_page = 20;
$offset   = ($page - 1) * $per_page;
$cat_id   = get_int('category');
$search   = trim(get('search'));

$where  = 'WHERE p.quantity > 0';
$params = [];

if ($cat_id > 0) {
    $where .= ' AND p.category_id = ?';
    $params[] = $cat_id;
}
if ($search !== '') {
    $where .= ' AND (p.design_number LIKE ? OR p.jewel_code LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
}

$total = (int)(db_one("SELECT COUNT(*) AS t FROM products p $where", $params)['t'] ?? 0);

$products = db_all(
    "SELECT p.*, c.name AS cat_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     $where
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?",
    array_merge($params, [$per_page, $offset])
);

$list = [];
foreach ($products as $p) {
    $list[] = [
        'id'          => (int)$p['id'],
        'designNo'    => $p['design_number'],
        'jewelCode'   => $p['jewel_code'],
        'grossWeight' => weight($p['gross_weight']),
        'netWeight'   => weight($p['net_weight']),
        'stock'       => (int)$p['quantity'],
        'category'    => $p['cat_name'] ?? '',
        'image'       => $p['image_path'] ? url('assets/uploads/' . $p['image_path']) : '',
    ];
}

json_out([
    'ok'       => true,
    'products' => $list,
    'total'    => $total,
    'page'     => $page,
    'hasMore'  => ($offset + $per_page) < $total,
]);
