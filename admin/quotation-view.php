<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$id = get_int('id');
$q  = db_one('SELECT q.*,p.company_name,p.party_id AS pid,p.phone FROM quotations q JOIN parties p ON p.id=q.party_id WHERE q.id=?', [$id]);
if (!$q) { flash('error','Quotation not found.'); redirect(url('admin/quotations.php')); }

$items = db_all('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY id', [$id]);

$total_gross = 0; $total_net = 0; $total_pcs = 0;
foreach ($items as $it) {
    $total_gross += (float)$it['gross_weight'] * (int)$it['quantity'];
    $total_net   += (float)$it['net_weight']   * (int)$it['quantity'];
    $total_pcs   += (int)$it['quantity'];
}

admin_layout_head('Quotation ' . $q['quotation_number']);
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item active">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <div class="page-actions">
      <h1><?= e($q['quotation_number']) ?></h1>
      <div>
        <a href="<?= url('api/admin-pdf.php') ?>?id=<?= (int)$q['id'] ?>" class="btn btn-gold btn-sm" target="_blank">⬇ Download PDF</a>
        <a href="quotations.php" class="btn btn-outline btn-sm">← Back</a>
      </div>
    </div>

    <div class="admin-card" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:14px">
        <div>
          <strong>Party:</strong> <?= e($q['company_name']) ?><br>
          <strong>Party ID:</strong> <?= e($q['pid']) ?><br>
          <?php if ($q['phone']): ?><strong>Phone:</strong> <?= e($q['phone']) ?><br><?php endif; ?>
        </div>
        <div>
          <strong>Date:</strong> <?= date('d M Y, g:i a', strtotime($q['created_at'])) ?><br>
          <?php if ($q['notes']): ?><strong>Notes:</strong> <?= e($q['notes']) ?><?php endif; ?>
        </div>
      </div>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Design No.</th><th>Jewel Code</th><th>Gross Wt.</th><th>Net Wt.</th><th>Qty (Pcs)</th><th>Total Gross</th></tr>
        </thead>
        <tbody>
          <?php foreach ($items as $i => $it): ?>
          <tr>
            <td><?= $i+1 ?></td>
            <td><?= e($it['design_number']) ?></td>
            <td><?= e($it['jewel_code']) ?></td>
            <td><strong><?= weight($it['gross_weight']) ?>g</strong></td>
            <td><?= weight($it['net_weight']) ?>g</td>
            <td><?= (int)$it['quantity'] ?></td>
            <td><strong><?= weight((float)$it['gross_weight'] * (int)$it['quantity']) ?>g</strong></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
        <tfoot>
          <tr style="background:#f9f5ed;font-weight:bold">
            <td colspan="5" style="text-align:right">TOTALS:</td>
            <td><?= $total_pcs ?> pcs</td>
            <td><?= weight($total_gross) ?>g gross</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p style="font-size:13px;color:#888;margin-top:8px">Total net weight: <?= weight($total_net) ?>g</p>
  </main>
</div>
</body>
</html>
