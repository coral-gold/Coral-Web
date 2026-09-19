<?php
/**
 * Quotation-basket actions for the order section (batch 3, items 5 & 8).
 * Every add / quantity change / removal goes through here so nothing in the
 * catalogue causes a page reload.
 *
 * Party-scoped: the session decides whose basket is touched, never the
 * request body.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/order.php';
require_once __DIR__ . '/../includes/images.php';

header('Content-Type: application/json; charset=utf-8');

$party = current_party();
if (!$party) {
    http_response_code(401);
    echo json_encode(['error' => 'Your session has expired. Please sign in again.']);
    exit;
}
$partyId = (int) $party['id'];

if (!is_post()) {
    http_response_code(405);
    echo json_encode(['error' => 'POST required.']);
    exit;
}

// Same CSRF token as the rest of the site, sent as a header by the page JS.
$token = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '');
if ($token === '' || !hash_equals(csrf_token(), $token)) {
    http_response_code(400);
    echo json_encode(['error' => 'Your page is out of date. Please refresh and try again.']);
    exit;
}

/** The basket as the front-end needs it. */
function basket_payload(int $partyId): array
{
    $lines = [];
    $pieces = 0;

    foreach (cart_lines($partyId) as $line) {
        $pieces += (int) $line['cart_quantity'];
        $lines[] = [
            'productId'   => (int) $line['id'],
            'name'        => $line['name'],
            'designNo'    => $line['design_number'],
            'jewelCode'   => $line['jewel_code'],
            'grossWeight' => $line['gross_weight'],
            'netWeight'   => $line['net_weight'],
            'quantity'    => (int) $line['cart_quantity'],
            'image'       => $line['image_path'] !== '' ? url(thumb_path($line['image_path'], 160)) : '',
        ];
    }

    return ['lines' => $lines, 'itemCount' => count($lines), 'pieceCount' => $pieces];
}

$action = post_str('action', 'get');
$productId = post_int('product_id');
$quantity = post_int('quantity', 1);

switch ($action) {
    case 'add':
        cart_add($partyId, $productId, max(1, $quantity));
        break;

    case 'set':
        // Quantity is set against the product, not the cart row id, so the
        // front-end never has to know about internal row ids.
        $line = db_one('SELECT id FROM cart_items WHERE party_id = ? AND product_id = ?', [$partyId, $productId]);
        if ($line) {
            cart_set_quantity($partyId, (int) $line['id'], $quantity);
        } elseif ($quantity > 0) {
            cart_add($partyId, $productId, $quantity);
        }
        break;

    case 'remove':
        $line = db_one('SELECT id FROM cart_items WHERE party_id = ? AND product_id = ?', [$partyId, $productId]);
        if ($line) {
            cart_remove($partyId, (int) $line['id']);
        }
        break;

    case 'clear':
        cart_clear($partyId);
        break;

    case 'get':
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action.']);
        exit;
}

echo json_encode(basket_payload($partyId), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
