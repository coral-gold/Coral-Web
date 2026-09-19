<?php
/** Order summary: adjust quantities, remove items, generate quotation — SRS 4.4/4.5. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];

if (is_post()) {
    csrf_verify();
    $action = post_str('action');

    if ($action === 'update') {
        foreach ((array) ($_POST['quantity'] ?? []) as $cartId => $quantity) {
            cart_set_quantity($partyId, (int) $cartId, (int) $quantity);
        }
        flash('success', 'Order updated.');
    } elseif ($action === 'remove') {
        cart_remove($partyId, post_int('cart_id'));
        flash('success', 'Item removed from your order.');
    } elseif ($action === 'clear') {
        cart_clear($partyId);
        flash('success', 'Order cleared.');
    } elseif ($action === 'generate') {
        $quotationId = create_quotation_from_cart($partyId, post_str('notes'));
        if ($quotationId === null) {
            flash('error', 'Your order is empty, so there is nothing to quote.');
        } else {
            flash('success', 'Quotation generated.');
            redirect(url('order/quotation.php?id=' . $quotationId));
        }
    }

    redirect(url('order/cart.php'));
}

$lines = cart_lines($partyId);
$totalQty = 0;
foreach ($lines as $line) {
    $totalQty += (int) $line['quantity'];
}

layout_header('My Order', 'order', order_nav($partyId), 'cart');
?>

<div class="page-head">
  <div>
    <h1>My Order</h1>
    <p>Review your selections, then generate a quotation.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('order/index.php')) ?>">&larr; Continue browsing</a>
</div>

<?php if (!$lines): ?>
  <div class="card">
    <p class="empty-state">
      Your order list is empty.<br>
      <a href="<?= e(url('order/index.php')) ?>">Browse the catalogue</a> to add items.
    </p>
  </div>
<?php else: ?>
  <div class="summary-bar">
    <span><strong><?= count($lines) ?></strong> item<?= count($lines) === 1 ? '' : 's' ?> &middot; <strong><?= $totalQty ?></strong> piece<?= $totalQty === 1 ? '' : 's' ?> total</span>
    <span class="no-price-note">Pricing is agreed separately — this is an item request list, not an invoice.</span>
  </div>

  <div class="card">
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="update">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th></th>
              <th>Item</th>
              <th>Design No.</th>
              <th>Jewel Code</th>
              <th>Gross Wt.</th>
              <th>Net Wt.</th>
              <th>Qty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($lines as $line): ?>
              <tr>
                <td>
                  <?php if ($line['image_path'] !== ''): ?>
                    <img class="thumb" src="<?= e(url($line['image_path'])) ?>" alt="" loading="lazy">
                  <?php endif; ?>
                </td>
                <td><?= e($line['name']) ?></td>
                <td><?= e(fmt_text($line['design_number'])) ?></td>
                <td><?= e(fmt_text($line['jewel_code'])) ?></td>
                <td><?= e(fmt_weight($line['gross_weight'])) ?></td>
                <td><?= e(fmt_weight($line['net_weight'])) ?></td>
                <td>
                  <input class="qty-input" type="number" min="1" max="9999"
                         name="quantity[<?= (int) $line['cart_id'] ?>]"
                         value="<?= (int) $line['quantity'] ?>"
                         aria-label="Quantity for <?= e($line['name']) ?>">
                </td>
                <td>
                  <button type="submit" class="btn btn-outline btn-sm"
                          form="remove-<?= (int) $line['cart_id'] ?>">Remove</button>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <div class="table-actions" style="margin-top:18px;">
        <button type="submit" class="btn btn-outline btn-sm">Update quantities</button>
      </div>
    </form>

    <?php foreach ($lines as $line): ?>
      <form id="remove-<?= (int) $line['cart_id'] ?>" method="post" class="inline-form">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="remove">
        <input type="hidden" name="cart_id" value="<?= (int) $line['cart_id'] ?>">
      </form>
    <?php endforeach; ?>
  </div>

  <div class="card">
    <h2>Generate Quotation</h2>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="generate">
      <div class="field">
        <label for="notes">Notes for Coral Gold (optional)</label>
        <textarea id="notes" name="notes" rows="3" placeholder="Anything we should know about this request…"></textarea>
      </div>
      <div class="table-actions">
        <button type="submit" class="btn btn-primary">Generate Quotation</button>
        <button type="submit" class="btn btn-outline" form="clear-order">Clear order</button>
      </div>
    </form>
    <form id="clear-order" method="post" class="inline-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="clear">
    </form>
  </div>
<?php endif; ?>

<?php layout_footer(); ?>
