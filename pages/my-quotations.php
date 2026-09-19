<?php
/** "My Quotations" history — SRS 4.6. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];

$quotations = db_all(
    'SELECT * FROM quotations WHERE party_id = ? ORDER BY created_at DESC, id DESC',
    [$partyId]
);

layout_header('My Quotations', 'order', order_nav($partyId), 'quotations');
?>

<div class="page-head">
  <div>
    <h1>My Quotations</h1>
    <p>Every quotation you've generated, newest first.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('pages/order-catalogue.php')) ?>">Browse catalogue</a>
</div>

<div class="card">
  <?php if (!$quotations): ?>
    <p class="empty-state">
      You haven't generated any quotations yet.<br>
      <a href="<?= e(url('pages/order-catalogue.php')) ?>">Add items to your order</a> to create one.
    </p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Quotation No.</th><th>Date</th><th>Items</th><th>Pieces</th><th></th></tr>
        </thead>
        <tbody>
          <?php foreach ($quotations as $quotation): ?>
            <tr>
              <td><strong><?= e($quotation['quotation_no']) ?></strong></td>
              <td><?= e(date('d M Y, H:i', strtotime((string) $quotation['created_at']))) ?></td>
              <td><?= (int) $quotation['item_count'] ?></td>
              <td><?= (int) $quotation['total_qty'] ?></td>
              <td class="table-actions">
                <a class="btn btn-outline btn-sm" href="<?= e(url('pages/quotation-view.php?id=' . (int) $quotation['id'])) ?>">View</a>
                <a class="btn btn-primary btn-sm" href="<?= e(url('order/quotation-pdf.php?id=' . (int) $quotation['id'])) ?>">PDF</a>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
