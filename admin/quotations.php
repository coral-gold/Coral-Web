<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$page   = max(1, get_int('page', 1));
$per    = 25;
$offset = ($page - 1) * $per;
$search = trim(get('q'));

$where  = '';
$params = [];
if ($search) {
    $where  = 'WHERE q.quotation_number LIKE ? OR p.company_name LIKE ?';
    $like   = '%' . $search . '%';
    $params = [$like, $like];
}

$total = (int)(db_one("SELECT COUNT(*) AS t FROM quotations q JOIN parties p ON p.id=q.party_id $where", $params)['t'] ?? 0);
$rows  = db_all("SELECT q.*, p.company_name, p.party_id AS pid FROM quotations q JOIN parties p ON p.id=q.party_id $where ORDER BY q.created_at DESC LIMIT ? OFFSET ?",
    array_merge($params, [$per, $offset]));
$pages = (int)ceil($total / $per);

admin_layout_head('Quotations');
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
    <h1>Quotations</h1>
    <form method="GET" class="d-flex gap-2 mb-2">
      <input type="text" name="q" class="form-control" style="max-width:260px" placeholder="Search quotation # or party…" value="<?= e($search) ?>">
      <button type="submit" class="btn btn-outline btn-sm">Search</button>
      <?php if ($search): ?><a href="quotations.php" class="btn btn-sm" style="color:#888">Clear</a><?php endif; ?>
    </form>
    <p style="font-size:13px;color:#888;margin-bottom:12px"><?= $total ?> quotation(s)</p>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Quotation #</th><th>Party</th><th>Party ID</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <?php foreach ($rows as $q): ?>
          <tr>
            <td style="font-weight:bold;color:var(--crimson)"><?= e($q['quotation_number']) ?></td>
            <td><?= e($q['company_name']) ?></td>
            <td><?= e($q['pid']) ?></td>
            <td><?= date('d M Y, g:i a', strtotime($q['created_at'])) ?></td>
            <td class="actions">
              <a href="quotation-view.php?id=<?= (int)$q['id'] ?>" class="btn btn-sm btn-outline">View</a>
              <a href="<?= url('api/admin-pdf.php') ?>?id=<?= (int)$q['id'] ?>" class="btn btn-sm btn-gold" target="_blank">⬇ PDF</a>
            </td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($rows)): ?><tr><td colspan="5" style="text-align:center;color:#888">No quotations.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
    <?php if ($pages > 1): ?>
    <div class="pagination mt-2">
      <?php for ($i=1;$i<=$pages;$i++): ?>
        <a href="?page=<?=$i?><?=$search?'&q='.urlencode($search):''?>" class="<?=$i===$page?'current':''?>"><?=$i?></a>
      <?php endfor; ?>
    </div>
    <?php endif; ?>
  </main>
</div>
</body>
</html>
