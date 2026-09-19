<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

$stats = [
    'products'   => (int) (db_one('SELECT COUNT(*) AS c FROM products WHERE is_active = 1')['c'] ?? 0),
    'categories' => (int) (db_one('SELECT COUNT(*) AS c FROM categories')['c'] ?? 0),
    'parties'    => (int) (db_one('SELECT COUNT(*) AS c FROM parties WHERE is_active = 1')['c'] ?? 0),
    'quotations' => (int) (db_one('SELECT COUNT(*) AS c FROM quotations')['c'] ?? 0),
];

$recent = db_all(
    'SELECT q.*, p.company_name
       FROM quotations q
       JOIN parties p ON p.id = q.party_id
      ORDER BY q.created_at DESC, q.id DESC
      LIMIT 8'
);

$incomplete = (int) (db_one(
    "SELECT COUNT(*) AS c FROM products
      WHERE is_active = 1
        AND (design_number IS NULL OR design_number = ''
          OR jewel_code IS NULL OR jewel_code = ''
          OR gross_weight IS NULL OR net_weight IS NULL)"
)['c'] ?? 0);

layout_header('Dashboard', 'admin', admin_nav(), 'dashboard');
?>

<div class="page-head">
  <div>
    <h1>Dashboard</h1>
    <p>Catalogue, party accounts and quotation activity at a glance.</p>
  </div>
</div>

<div class="stat-grid">
  <div class="stat-card"><span>Active products</span><strong><?= $stats['products'] ?></strong></div>
  <div class="stat-card"><span>Categories</span><strong><?= $stats['categories'] ?></strong></div>
  <div class="stat-card"><span>Active parties</span><strong><?= $stats['parties'] ?></strong></div>
  <div class="stat-card"><span>Quotations</span><strong><?= $stats['quotations'] ?></strong></div>
</div>

<?php if ($incomplete > 0): ?>
  <div class="alert alert-error">
    <?= $incomplete ?> active product<?= $incomplete === 1 ? '' : 's' ?> still
    missing a design number, jewel code or weight — wholesalers see a dash for those fields.
    <a href="<?= e(url('admin/products.php')) ?>">Fill them in</a>.
  </div>
<?php endif; ?>

<div class="card">
  <div class="card-header">
    <h2>Recent quotations</h2>
    <a class="btn btn-outline btn-sm" href="<?= e(url('admin/quotations.php')) ?>">View all</a>
  </div>

  <?php if (!$recent): ?>
    <p class="empty-state">No quotations have been generated yet.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Quotation No.</th><th>Party</th><th>Date</th><th>Items</th><th>Pieces</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($recent as $q): ?>
            <tr>
              <td><strong><?= e($q['quotation_no']) ?></strong></td>
              <td><?= e($q['company_name']) ?></td>
              <td><?= e(date('d M Y, H:i', strtotime((string) $q['created_at']))) ?></td>
              <td><?= (int) $q['item_count'] ?></td>
              <td><?= (int) $q['total_qty'] ?></td>
              <td class="table-actions">
                <a class="btn btn-outline btn-sm" href="<?= e(url('admin/quotation-view.php?id=' . (int) $q['id'])) ?>">View</a>
                <a class="btn btn-primary btn-sm" href="<?= e(url('admin/quotation-pdf.php?id=' . (int) $q['id'])) ?>">PDF</a>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
