<?php
/** Product list with delete/toggle — SRS 5.2. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

if (is_post()) {
    csrf_verify();
    $action = post_str('action');
    $id = post_int('id');

    if ($action === 'delete') {
        db_run('DELETE FROM products WHERE id = ?', [$id]);
        flash('success', 'Product deleted.');
    } elseif ($action === 'toggle') {
        db_run('UPDATE products SET is_active = 1 - is_active WHERE id = ?', [$id]);
        flash('success', 'Product visibility updated.');
    }
    redirect(url('admin/products.php'));
}

$categoryFilter = (int) get_str('category', '0');
$where = '1=1';
$params = [];
if ($categoryFilter > 0) {
    $where .= ' AND p.category_id = ?';
    $params[] = $categoryFilter;
}

$categories = db_all('SELECT * FROM categories ORDER BY name');
$products = db_all(
    "SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE $where
      ORDER BY c.name, p.design_number, p.name",
    $params
);

layout_header('Products', 'admin', admin_nav(), 'products');
?>

<div class="page-head">
  <div>
    <h1>Products</h1>
    <p>One catalogue feeds both the public site and the wholesaler order section.</p>
  </div>
  <a class="btn btn-primary" href="<?= e(url('admin/product-edit.php')) ?>">+ Add product</a>
</div>

<div class="filter-bar">
  <a class="filter-pill<?= $categoryFilter === 0 ? ' is-active' : '' ?>" href="<?= e(url('admin/products.php')) ?>">All</a>
  <?php foreach ($categories as $category): ?>
    <a class="filter-pill<?= $categoryFilter === (int) $category['id'] ? ' is-active' : '' ?>"
       href="<?= e(url('admin/products.php?category=' . (int) $category['id'])) ?>"><?= e($category['name']) ?></a>
  <?php endforeach; ?>
</div>

<div class="card">
  <?php if (!$products): ?>
    <p class="empty-state">No products yet. <a href="<?= e(url('admin/product-edit.php')) ?>">Add the first one</a>.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th></th><th>Name</th><th>Category</th><th>Design No.</th><th>Jewel Code</th>
            <th>Gross Wt.</th><th>Net Wt.</th><th>Qty</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($products as $p): ?>
            <tr>
              <td>
                <?php if ($p['image_path'] !== ''): ?>
                  <img class="thumb" src="<?= e(url($p['image_path'])) ?>" alt="" loading="lazy">
                <?php endif; ?>
              </td>
              <td>
                <?= e($p['name']) ?>
                <?php if ((int) $p['featured'] === 1): ?><span class="badge badge-on">Featured</span><?php endif; ?>
              </td>
              <td><?= e(fmt_text($p['category_name'])) ?></td>
              <td><?= e(fmt_text($p['design_number'])) ?></td>
              <td><?= e(fmt_text($p['jewel_code'])) ?></td>
              <td class="wt-cell"><?= e(fmt_weight($p['gross_weight'])) ?></td>
              <td class="wt-cell"><?= e(fmt_weight($p['net_weight'])) ?></td>
              <td class="qty-cell"><?= e(fmt_text($p['quantity'])) ?></td>
              <td>
                <?php if ((int) $p['is_active'] === 1): ?>
                  <span class="badge badge-on">Visible</span>
                <?php else: ?>
                  <span class="badge badge-off">Hidden</span>
                <?php endif; ?>
              </td>
              <td class="table-actions">
                <a class="btn btn-outline btn-sm" href="<?= e(url('admin/product-edit.php?id=' . (int) $p['id'])) ?>">Edit</a>
                <form method="post" class="inline-form">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="toggle">
                  <input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
                  <button class="btn btn-outline btn-sm" type="submit"><?= (int) $p['is_active'] === 1 ? 'Hide' : 'Show' ?></button>
                </form>
                <form method="post" class="inline-form" onsubmit="return confirm('Delete this product permanently?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
                  <button class="btn btn-danger btn-sm" type="submit">Delete</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
