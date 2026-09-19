<?php
/** Quotation card/summary for the party that generated it — SRS 4.5. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];

// Scoped by party id: a party can never open another party's quotation.
$quotation = load_quotation((int) get_str('id', '0'), $partyId);
if (!$quotation) {
    flash('error', 'That quotation could not be found.');
    redirect(url('order/quotations.php'));
}

layout_header('Quotation ' . $quotation['quotation_no'], 'order', order_nav($partyId), 'quotations');
?>

<div class="page-head">
  <div>
    <h1>Quotation <?= e($quotation['quotation_no']) ?></h1>
    <p>Generated <?= e(date('d M Y, H:i', strtotime((string) $quotation['created_at']))) ?></p>
  </div>
  <div class="table-actions">
    <a class="btn btn-primary" href="<?= e(url('order/quotation-pdf.php?id=' . (int) $quotation['id'])) ?>">Download PDF</a>
    <a class="btn btn-outline" href="<?= e(url('order/quotations.php')) ?>">All quotations</a>
  </div>
</div>

<div class="card">
  <div class="quotation-meta">
    <div><span>Quotation No.</span><strong><?= e($quotation['quotation_no']) ?></strong></div>
    <div><span>Party</span><strong><?= e($quotation['company_name']) ?></strong></div>
    <div><span>Items</span><strong><?= (int) $quotation['item_count'] ?></strong></div>
    <div><span>Total pieces</span><strong><?= (int) $quotation['total_qty'] ?></strong></div>
  </div>

  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr>
          <th>#</th><th>Item</th><th>Design No.</th><th>Jewel Code</th>
          <th>Gross Wt.</th><th>Net Wt.</th><th>Qty</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($quotation['items'] as $i => $item): ?>
          <tr>
            <td><?= $i + 1 ?></td>
            <td><?= e($item['name']) ?></td>
            <td><?= e(fmt_text($item['design_number'])) ?></td>
            <td><?= e(fmt_text($item['jewel_code'])) ?></td>
            <td><?= e(fmt_weight($item['gross_weight'])) ?></td>
            <td><?= e(fmt_weight($item['net_weight'])) ?></td>
            <td><?= (int) $item['quantity'] ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php if (trim((string) $quotation['notes']) !== ''): ?>
    <p style="margin-top:18px;"><strong>Your notes:</strong><br><?= nl2br(e($quotation['notes'])) ?></p>
  <?php endif; ?>

  <p class="no-price-note" style="margin-top:18px;">
    No rates are shown — Coral Gold will confirm pricing with you separately.
  </p>
</div>

<?php layout_footer(); ?>
