<?php
/** Admin view of any quotation — SRS 5.4. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';
require_once __DIR__ . '/../includes/order.php';

require_admin();

// No party scoping here: admins may open any quotation.
$quotation = load_quotation((int) get_str('id', '0'));
if (!$quotation) {
    flash('error', 'Quotation not found.');
    redirect(url('admin/quotations.php'));
}

layout_header('Quotation ' . $quotation['quotation_no'], 'admin', admin_nav(), 'quotations');
?>

<div class="page-head">
  <div>
    <h1>Quotation <?= e($quotation['quotation_no']) ?></h1>
    <p><?= e($quotation['company_name']) ?> &middot; <?= e(date('d M Y, H:i', strtotime((string) $quotation['created_at']))) ?></p>
  </div>
  <div class="table-actions">
    <a class="btn btn-primary" href="<?= e(url('admin/quotation-pdf.php?id=' . (int) $quotation['id'])) ?>">Download PDF</a>
    <a class="btn btn-outline" href="<?= e(url('admin/quotations.php')) ?>">All quotations</a>
  </div>
</div>

<div class="card">
  <div class="quotation-meta">
    <div><span>Party ID</span><strong><?= e($quotation['party_code']) ?></strong></div>
    <div><span>Contact</span><strong><?= e(fmt_text($quotation['contact_person'])) ?></strong></div>
    <div><span>Phone</span><strong><?= e(fmt_text($quotation['phone'])) ?></strong></div>
    <div><span>Email</span><strong><?= e(fmt_text($quotation['email'])) ?></strong></div>
    <div><span>Items</span><strong><?= (int) $quotation['item_count'] ?></strong></div>
    <div><span>Total pieces</span><strong><?= (int) $quotation['total_qty'] ?></strong></div>
  </div>

  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr><th>#</th><th>Item</th><th>Design No.</th><th>Jewel Code</th><th>Gross Wt.</th><th>Net Wt.</th><th>Qty</th></tr>
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
    <p style="margin-top:18px;"><strong>Notes from party:</strong><br><?= nl2br(e($quotation['notes'])) ?></p>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
