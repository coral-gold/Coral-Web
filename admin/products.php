<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

// Delete
if (is_post() && post('action') === 'delete') {
    csrf_verify();
    $id = post_int('id');
    $p  = db_one('SELECT image_path FROM products WHERE id=?', [$id]);
    if ($p && $p['image_path']) {
        $img = __DIR__ . '/../assets/uploads/' . $p['image_path'];
        if (file_exists($img)) unlink($img);
    }
    db_run('DELETE FROM products WHERE id=?', [$id]);
    flash('success', 'Product deleted.');
    redirect(url('admin/products.php'));
}

$page    = max(1, get_int('page', 1));
$per     = 30;
$offset  = ($page - 1) * $per;
$search  = trim(get('q'));
$cat_id  = get_int('cat');

$where  = 'WHERE 1=1';
$params = [];
if ($search) {
    $where .= ' AND (p.design_number LIKE ? OR p.jewel_code LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like; $params[] = $like;
}
if ($cat_id) { $where .= ' AND p.category_id=?'; $params[] = $cat_id; }

$total      = (int)(db_one("SELECT COUNT(*) AS t FROM products p $where", $params)['t'] ?? 0);
$products   = db_all("SELECT p.*, c.name AS cat_name FROM products p LEFT JOIN categories c ON c.id=p.category_id $where ORDER BY p.id DESC LIMIT ? OFFSET ?",
    array_merge($params, [$per, $offset]));
$categories = db_all('SELECT * FROM categories ORDER BY name');
$pages      = (int)ceil($total / $per);

admin_layout_head('Products');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item active">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <div class="page-actions">
      <h1>Products</h1>
      <a href="product-edit.php" class="btn btn-primary btn-sm">+ Add Product</a>
    </div>
    <?= flash_html() ?>

    <form method="GET" class="d-flex gap-2 mb-2 flex-wrap" style="align-items:center">
      <input type="text" name="q" class="form-control" style="width:200px" placeholder="Search…" value="<?= e($search) ?>">
      <select name="cat" class="form-control" style="width:160px">
        <option value="">All Categories</option>
        <?php foreach ($categories as $c): ?>
          <option value="<?= $c['id'] ?>" <?= $cat_id === (int)$c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn btn-outline btn-sm">Filter</button>
      <a href="products.php" class="btn btn-sm" style="color:#888">Clear</a>
    </form>

    <p style="font-size:13px;color:#888;margin-bottom:12px"><?= $total ?> product(s)</p>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Design No.</th>
            <th>Jewel Code</th>
            <th>Category</th>
            <th>Gross Wt.</th>
            <th>Net Wt.</th>
            <th>Qty</th>
            <th>Featured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($products as $p): ?>
          <tr>
            <td>
              <?php if ($p['image_path']): ?>
                <img src="<?= e(url('assets/uploads/' . $p['image_path'])) ?>" class="prod-thumb" alt="">
              <?php else: ?>
                <div class="prod-thumb-placeholder">💍</div>
              <?php endif; ?>
            </td>
            <td><?= e($p['design_number']) ?></td>
            <td><?= e($p['jewel_code']) ?></td>
            <td><?= e($p['cat_name'] ?? '') ?></td>
            <td><strong><?= weight($p['gross_weight']) ?>g</strong></td>
            <td><?= weight($p['net_weight']) ?>g</td>
            <td><?= (int)$p['quantity'] ?></td>
            <td><?= $p['is_featured'] ? '<span class="badge badge-gold">Yes</span>' : '—' ?></td>
            <td class="actions">
              <a href="product-edit.php?id=<?= (int)$p['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
              <form method="POST" style="display:inline" onsubmit="return confirm('Delete product?')">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                <button type="submit" class="btn btn-sm btn-danger">Del</button>
              </form>
            </td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($products)): ?>
            <tr><td colspan="9" style="text-align:center;color:#888;padding:30px">No products found.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>

    <?php if ($pages > 1): ?>
    <div class="pagination mt-2">
      <?php for ($i = 1; $i <= $pages; $i++): ?>
        <a href="?page=<?= $i ?><?= $search ? '&q='.urlencode($search) : '' ?><?= $cat_id ? '&cat='.$cat_id : '' ?>"
           class="<?= $i === $page ? 'current' : '' ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
    <?php endif; ?>
  </main>
</div>
</body>
</html>
