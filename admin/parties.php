<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

if (is_post()) {
    csrf_verify();
    $action = post('action');
    $id     = post_int('id');

    if ($action === 'toggle' && $id) {
        $p = db_one('SELECT is_active FROM parties WHERE id=?', [$id]);
        if ($p) {
            db_run('UPDATE parties SET is_active=? WHERE id=?', [$p['is_active'] ? 0 : 1, $id]);
            flash('success', $p['is_active'] ? 'Party disabled.' : 'Party enabled.');
        }
    } elseif ($action === 'reset_password' && $id) {
        $np = trim(post('new_password'));
        if (strlen($np) < 6) {
            flash('error', 'Password must be at least 6 characters.');
        } else {
            db_run('UPDATE parties SET password_hash=? WHERE id=?', [password_hash($np, PASSWORD_DEFAULT), $id]);
            flash('success', 'Password reset.');
        }
    }
    redirect(url('admin/parties.php'));
}

$page    = max(1, get_int('page', 1));
$per     = 25;
$offset  = ($page - 1) * $per;
$total   = (int)(db_one('SELECT COUNT(*) AS t FROM parties')['t'] ?? 0);
$parties = db_all('SELECT * FROM parties ORDER BY created_at DESC LIMIT ? OFFSET ?', [$per, $offset]);
$pages   = (int)ceil($total / $per);

admin_layout_head('Parties');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item active">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <div class="page-actions">
      <h1>Wholesale Parties</h1>
      <a href="party-edit.php" class="btn btn-primary btn-sm">+ Add Party</a>
    </div>
    <?= flash_html() ?>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Party ID</th><th>Company</th><th>Phone</th><th>Email</th><th>Status</th><th>Since</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <?php foreach ($parties as $p): ?>
          <tr>
            <td><?= e($p['party_id']) ?></td>
            <td><?= e($p['company_name']) ?></td>
            <td><?= e($p['phone'] ?? '') ?></td>
            <td><?= e($p['email'] ?? '') ?></td>
            <td><?= $p['is_active'] ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Disabled</span>' ?></td>
            <td><?= date('d M Y', strtotime($p['created_at'])) ?></td>
            <td class="actions">
              <a href="party-edit.php?id=<?= (int)$p['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
              <form method="POST" style="display:inline">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="toggle">
                <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                <button type="submit" class="btn btn-sm <?= $p['is_active'] ? 'btn-danger' : 'btn-gold' ?>">
                  <?= $p['is_active'] ? 'Disable' : 'Enable' ?>
                </button>
              </form>
            </td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($parties)): ?><tr><td colspan="7" style="text-align:center;color:#888">No parties yet.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
    <?php if ($pages > 1): ?>
    <div class="pagination mt-2">
      <?php for ($i=1;$i<=$pages;$i++): ?>
        <a href="?page=<?=$i?>" class="<?=$i===$page?'current':''?>"><?=$i?></a>
      <?php endfor; ?>
    </div>
    <?php endif; ?>
  </main>
</div>
</body>
</html>
