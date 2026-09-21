<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function cart_lines(int $party_id): array {
    return db_all('
        SELECT ci.id AS cart_id, ci.quantity AS cart_qty,
               p.id, p.design_number, p.jewel_code,
               p.gross_weight, p.net_weight, p.image_path, p.quantity AS stock
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.party_id = ?
        ORDER BY ci.created_at', [$party_id]);
}

function cart_count(int $party_id): int {
    return (int)(db_one('SELECT SUM(quantity) AS t FROM cart_items WHERE party_id = ?', [$party_id])['t'] ?? 0);
}

function cart_item_count(int $party_id): int {
    return (int)(db_one('SELECT COUNT(*) AS t FROM cart_items WHERE party_id = ?', [$party_id])['t'] ?? 0);
}

function cart_add(int $party_id, int $product_id, int $qty = 1): void {
    $existing = db_one('SELECT id, quantity FROM cart_items WHERE party_id = ? AND product_id = ?', [$party_id, $product_id]);
    if ($existing) {
        db_run('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [$qty, $existing['id']]);
    } else {
        db_run('INSERT INTO cart_items (party_id, product_id, quantity) VALUES (?, ?, ?)', [$party_id, $product_id, $qty]);
    }
}

function cart_set(int $party_id, int $product_id, int $qty): void {
    if ($qty <= 0) {
        cart_remove_by_product($party_id, $product_id);
        return;
    }
    $existing = db_one('SELECT id FROM cart_items WHERE party_id = ? AND product_id = ?', [$party_id, $product_id]);
    if ($existing) {
        db_run('UPDATE cart_items SET quantity = ? WHERE id = ?', [$qty, $existing['id']]);
    } else {
        db_run('INSERT INTO cart_items (party_id, product_id, quantity) VALUES (?, ?, ?)', [$party_id, $product_id, $qty]);
    }
}

function cart_remove_by_product(int $party_id, int $product_id): void {
    db_run('DELETE FROM cart_items WHERE party_id = ? AND product_id = ?', [$party_id, $product_id]);
}

function cart_clear(int $party_id): void {
    db_run('DELETE FROM cart_items WHERE party_id = ?', [$party_id]);
}

function cart_payload(int $party_id): array {
    $lines  = [];
    $pieces = 0;
    foreach (cart_lines($party_id) as $row) {
        $pieces += (int)$row['cart_qty'];
        $lines[] = [
            'productId'   => (int)$row['id'],
            'cartId'      => (int)$row['cart_id'],
            'designNo'    => $row['design_number'],
            'jewelCode'   => $row['jewel_code'],
            'grossWeight' => $row['gross_weight'],
            'netWeight'   => $row['net_weight'],
            'quantity'    => (int)$row['cart_qty'],
            'image'       => $row['image_path'] ? url('assets/uploads/' . $row['image_path']) : '',
        ];
    }
    return ['lines' => $lines, 'itemCount' => count($lines), 'pieceCount' => $pieces];
}

function next_quotation_number(): string {
    $last = db_one('SELECT quotation_number FROM quotations ORDER BY id DESC LIMIT 1');
    if ($last) {
        preg_match('/(\d+)$/', $last['quotation_number'], $m);
        $n = ((int)($m[1] ?? 0)) + 1;
    } else {
        $n = 1;
    }
    return 'CG-Q-' . str_pad((string)$n, 4, '0', STR_PAD_LEFT);
}

function create_quotation(int $party_id, string $notes = ''): ?int {
    $lines = cart_lines($party_id);
    if (empty($lines)) return null;

    $number = next_quotation_number();
    $qid = db_insert(
        'INSERT INTO quotations (party_id, quotation_number, notes) VALUES (?, ?, ?)',
        [$party_id, $number, $notes]
    );

    foreach ($lines as $line) {
        db_run(
            'INSERT INTO quotation_items (quotation_id, product_id, quantity, gross_weight, net_weight, design_number, jewel_code)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$qid, $line['id'], $line['cart_qty'], $line['gross_weight'], $line['net_weight'], $line['design_number'], $line['jewel_code']]
        );
    }

    cart_clear($party_id);
    return $qid;
}
