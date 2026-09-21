<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/order.php';

$party = current_party();
if (!$party) json_out(['ok' => false, 'error' => 'Unauthenticated'], 401);

$pid = (int)$party['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = get('action', 'get');
    if ($action === 'get') {
        $payload = cart_payload($pid);
        json_out(array_merge(['ok' => true], $payload));
    }
    json_out(['ok' => false, 'error' => 'Unknown action'], 400);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    match ($action) {
        'add' => (function() use ($pid, $body) {
            $product_id = (int)($body['productId'] ?? 0);
            $qty = max(1, (int)($body['qty'] ?? 1));
            if (!$product_id) json_out(['ok' => false, 'error' => 'Missing productId'], 400);
            $stock = (int)(db_one('SELECT quantity FROM products WHERE id=?', [$product_id])['quantity'] ?? 0);
            if ($stock <= 0) json_out(['ok' => false, 'error' => 'Out of stock'], 400);
            cart_add($pid, $product_id, $qty);
            $payload = cart_payload($pid);
            json_out(array_merge(['ok' => true], $payload));
        })(),
        'set' => (function() use ($pid, $body) {
            $product_id = (int)($body['productId'] ?? 0);
            $qty = (int)($body['qty'] ?? 0);
            if (!$product_id) json_out(['ok' => false, 'error' => 'Missing productId'], 400);
            cart_set($pid, $product_id, $qty);
            $payload = cart_payload($pid);
            json_out(array_merge(['ok' => true], $payload));
        })(),
        'remove' => (function() use ($pid, $body) {
            $product_id = (int)($body['productId'] ?? 0);
            if (!$product_id) json_out(['ok' => false, 'error' => 'Missing productId'], 400);
            cart_remove_by_product($pid, $product_id);
            $payload = cart_payload($pid);
            json_out(array_merge(['ok' => true], $payload));
        })(),
        'clear' => (function() use ($pid) {
            cart_clear($pid);
            json_out(['ok' => true, 'lines' => [], 'itemCount' => 0, 'pieceCount' => 0]);
        })(),
        default => json_out(['ok' => false, 'error' => 'Unknown action'], 400),
    };
}

json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
