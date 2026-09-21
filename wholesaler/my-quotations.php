<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$page  = max(1, get_int('page', 1));
$per   = 20;
$off   = ($page - 1) * $per;

$total  = (int)(db_one('SELECT COUNT(*) AS t FROM quotations WHERE party_id=?', [$party['id']])['t'] ?? 0);
$quots  = db_all('SELECT * FROM quotations WHERE party_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [$party['id'], $per, $off]);
$pages  = (int)ceil($total / $per);

wholesaler_layout_head('My Quotations');
?>
<div class="ws-layout">
  <nav class="ws-sidebar">
    <a href="catalogue.php" class="nav-item">📦 Catalogue</a>
    <a href="my-quotations.php" class="nav-item active">📋 My Quotations</a>
    <a href="logout.php" class="nav-item">🚪 Logout</a>
  </nav>
  <main class="ws-main">
    <h1>My Quotations</h1>
    <?php if (empty($quots)): ?>
      <p style="color:var(--mid)">No quotations yet. <a href="catalogue.php">Browse catalogue</a> to create one.</p>
    <?php else: ?>
    <div class="data-table-wrap">
      <table class="quot-table">
        <thead>
          <tr>
            <th>Quotation #</th>
            <th>Date</th>
            <th>Items</th>
            <th>Notes</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($quots as $q): ?>
          <?php
            $item_count = (int)(db_one('SELECT COUNT(*) AS t FROM quotation_items WHERE quotation_id=?', [$q['id']])['t'] ?? 0);
          ?>
          <tr>
            <td class="quot-num"><?= e($q['quotation_number']) ?></td>
            <td><?= date('d M Y, g:i a', strtotime($q['created_at'])) ?></td>
            <td><?= $item_count ?> items</td>
            <td style="max-width:200px;font-size:13px"><?= $q['notes'] ? e(mb_strimwidth($q['notes'],0,60,'…')) : '—' ?></td>
            <td>
              <a href="<?= url('api/quotation.php') ?>?action=pdf&id=<?= (int)$q['id'] ?>" class="btn btn-sm btn-gold" target="_blank">⬇ PDF</a>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php if ($pages > 1): ?>
    <div class="pagination mt-2">
      <?php for ($i = 1; $i <= $pages; $i++): ?>
        <a href="?page=<?= $i ?>" class="<?= $i === $page ? 'current' : '' ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
    <?php endif; ?>
    <?php endif; ?>
  </main>
</div>
</body>
</html>
