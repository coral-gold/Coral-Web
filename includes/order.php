<?php
/**
 * Order-section helpers: the saved cart and quotation creation.
 * Every query here is scoped by party_id — a party can only ever touch
 * its own rows (SRS 6.1).
 */

declare(strict_types=1);

function cart_count(int $partyId): int
{
    $row = db_one('SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_items WHERE party_id = ?', [$partyId]);
    return (int) ($row['total'] ?? 0);
}

function cart_lines(int $partyId): array
{
    // The basket quantity is aliased because products now has its own
    // "quantity" column too — with a plain "p.*" the product's value
    // silently overwrites the basket's in the fetched row.
    return db_all(
        'SELECT p.*, c.id AS cart_id, c.quantity AS cart_quantity
           FROM cart_items c
           JOIN products p ON p.id = c.product_id
          WHERE c.party_id = ?
          ORDER BY p.design_number, p.name',
        [$partyId]
    );
}

function cart_add(int $partyId, int $productId, int $quantity = 1): void
{
    $quantity = max(1, $quantity);
    $product = db_one('SELECT id FROM products WHERE id = ? AND is_active = 1', [$productId]);
    if (!$product) {
        return;
    }
    db_run(
        'INSERT INTO cart_items (party_id, product_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
        [$partyId, $productId, $quantity]
    );
}

function cart_set_quantity(int $partyId, int $cartId, int $quantity): void
{
    if ($quantity < 1) {
        cart_remove($partyId, $cartId);
        return;
    }
    db_run('UPDATE cart_items SET quantity = ? WHERE id = ? AND party_id = ?', [$quantity, $cartId, $partyId]);
}

function cart_remove(int $partyId, int $cartId): void
{
    db_run('DELETE FROM cart_items WHERE id = ? AND party_id = ?', [$cartId, $partyId]);
}

function cart_clear(int $partyId): void
{
    db_run('DELETE FROM cart_items WHERE party_id = ?', [$partyId]);
}

/** Next quotation number, e.g. CG-Q-0007. */
function next_quotation_no(): string
{
    $prefix = (string) config('app.quotation_prefix', 'CG-Q-');
    $row = db_one('SELECT MAX(id) AS max_id FROM quotations');
    $next = ((int) ($row['max_id'] ?? 0)) + 1;
    return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
}

/**
 * Turns the party's current cart into a saved quotation and empties the cart.
 * Product details are snapshotted so history stays accurate after catalogue
 * edits. Returns the new quotation id, or null when the cart is empty.
 */
function create_quotation_from_cart(int $partyId, string $notes = ''): ?int
{
    $lines = cart_lines($partyId);
    if (!$lines) {
        return null;
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $totalQty = 0;
        foreach ($lines as $line) {
            $totalQty += (int) $line['cart_quantity'];
        }

        // Retry on the rare race where two parties generate at the same moment.
        $attempts = 0;
        while (true) {
            try {
                db_run(
                    'INSERT INTO quotations (quotation_no, party_id, item_count, total_qty, notes)
                     VALUES (?, ?, ?, ?, ?)',
                    [next_quotation_no(), $partyId, count($lines), $totalQty, $notes]
                );
                break;
            } catch (PDOException $e) {
                if (++$attempts >= 5 || $e->getCode() !== '23000') {
                    throw $e;
                }
            }
        }

        $quotationId = (int) $pdo->lastInsertId();

        foreach ($lines as $line) {
            db_run(
                'INSERT INTO quotation_items
                   (quotation_id, product_id, name, design_number, jewel_code, gross_weight, net_weight, quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $quotationId,
                    (int) $line['id'],
                    (string) $line['name'],
                    $line['design_number'],
                    $line['jewel_code'],
                    $line['gross_weight'],
                    $line['net_weight'],
                    (int) $line['cart_quantity'],
                ]
            );
        }

        cart_clear($partyId);
        $pdo->commit();
        return $quotationId;
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('Quotation creation failed: ' . $e->getMessage());
        return null;
    }
}

/** Loads a quotation, optionally restricted to one party. */
function load_quotation(int $quotationId, ?int $partyId = null): ?array
{
    $sql = 'SELECT q.*, p.company_name, p.party_code, p.phone
              FROM quotations q
              JOIN parties p ON p.id = q.party_id
             WHERE q.id = ?';
    $params = [$quotationId];

    if ($partyId !== null) {
        $sql .= ' AND q.party_id = ?';
        $params[] = $partyId;
    }

    $quotation = db_one($sql, $params);
    if (!$quotation) {
        return null;
    }

    $quotation['items'] = db_all(
        'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id',
        [$quotationId]
    );

    return $quotation;
}

/** Nav definition shared by every order-section page. */
function order_nav(int $partyId): array
{
    // The in-progress quotation lives in the on-page panel (batch 3, item 8),
    // so there is no "My Order" entry — "My Quotations" is the history.
    return [
        'catalogue'  => ['href' => url('order/index.php'), 'label' => 'Catalogue'],
        'quotations' => ['href' => url('order/quotations.php'), 'label' => 'My Quotations'],
    ];
}
