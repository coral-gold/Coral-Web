<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$stats = [
    'products'    => (int)(db_one('SELECT COUNT(*) AS t FROM products'   )['t'] ?? 0),
    'categories'  => (int)(db_one('SELECT COUNT(*) AS t FROM categories' )['t'] ?? 0),
    'parties'     => (int)(db_one('SELECT COUNT(*) AS t FROM parties WHERE is_active=1')['t'] ?? 0),
    'quotations'  => (int)(db_one('SELECT COUNT(*) AS t FROM quotations' )['t'] ?? 0),
];

$recent_quots = db_all('SELECT q.*, p.company_name FROM quotations q JOIN parties p ON p.id=q.party_id ORDER BY q.created_at DESC LIMIT 5');

admin_layout_head('Dashboard');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item active">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <h1>Dashboard</h1>
    <div class="stats-grid">
      <div class="admin-card"><h3>Products</h3><div class="big-num"><?= $stats['products'] ?></div></div>
      <div class="admin-card"><h3>Categories</h3><div class="big-num"><?= $stats['categories'] ?></div></div>
      <div class="admin-card"><h3>Active Parties</h3><div class="big-num"><?= $stats['parties'] ?></div></div>
      <div class="admin-card"><h3>Quotations</h3><div class="big-num"><?= $stats['quotations'] ?></div></div>
    </div>

    <div class="admin-card">
      <h3 style="font-size:16px;font-weight:bold;color:var(--crimson);margin-bottom:12px">Recent Quotations</h3>
      <?php if (empty($recent_quots)): ?>
        <p style="color:#888;font-size:14px">No quotations yet.</p>
      <?php else: ?>
      <table class="data-table">
        <thead><tr><th>Quotation #</th><th>Party</th><th>Date</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($recent_quots as $q): ?>
          <tr>
            <td><?= e($q['quotation_number']) ?></td>
            <td><?= e($q['company_name']) ?></td>
            <td><?= date('d M Y', strtotime($q['created_at'])) ?></td>
            <td><a href="quotation-view.php?id=<?= (int)$q['id'] ?>" class="btn btn-sm btn-outline">View</a></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <?php endif; ?>
    </div>
  </main>
</div>
</body>
</html>
