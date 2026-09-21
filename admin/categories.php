<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

// Handle actions
if (is_post()) {
    csrf_verify();
    $action = post('action');
    $name   = trim(post('name'));
    $id     = post_int('id');

    if ($action === 'add' && $name !== '') {
        try { db_run('INSERT INTO categories (name) VALUES (?)', [$name]); flash('success', 'Category added.'); }
        catch (\Exception $e) { flash('error', 'Name already exists.'); }
    } elseif ($action === 'edit' && $id && $name !== '') {
        try { db_run('UPDATE categories SET name=? WHERE id=?', [$name, $id]); flash('success', 'Category updated.'); }
        catch (\Exception $e) { flash('error', 'Name already exists.'); }
    } elseif ($action === 'delete' && $id) {
        $used = (int)(db_one('SELECT COUNT(*) AS t FROM products WHERE category_id=?', [$id])['t'] ?? 0);
        if ($used > 0) { flash('error', "Cannot delete: $used product(s) use this category."); }
        else { db_run('DELETE FROM categories WHERE id=?', [$id]); flash('success', 'Category deleted.'); }
    }
    redirect(url('admin/categories.php'));
}

$categories = db_all('SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id=c.id) AS prod_count FROM categories c ORDER BY c.name');
$edit = isset($_GET['edit']) ? db_one('SELECT * FROM categories WHERE id=?', [get_int('edit')]) : null;

admin_layout_head('Categories');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item active">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <h1>Categories</h1>
    <?= flash_html() ?>

    <div class="admin-card" style="max-width:420px;margin-bottom:24px">
      <h3 style="font-size:15px;font-weight:bold;margin-bottom:12px"><?= $edit ? 'Edit Category' : 'Add Category' ?></h3>
      <form method="POST">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="<?= $edit ? 'edit' : 'add' ?>">
        <?php if ($edit): ?><input type="hidden" name="id" value="<?= (int)$edit['id'] ?>"><?php endif; ?>
        <div class="form-group">
          <label>Category Name</label>
          <input type="text" name="name" class="form-control" required maxlength="100"
                 value="<?= $edit ? e($edit['name']) : '' ?>">
        </div>
        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-primary btn-sm"><?= $edit ? 'Update' : 'Add' ?></button>
          <?php if ($edit): ?><a href="categories.php" class="btn btn-outline btn-sm">Cancel</a><?php endif; ?>
        </div>
      </form>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Name</th><th>Products</th><th>Actions</th></tr></thead>
        <tbody>
          <?php foreach ($categories as $c): ?>
          <tr>
            <td><?= (int)$c['id'] ?></td>
            <td><?= e($c['name']) ?></td>
            <td><?= (int)$c['prod_count'] ?></td>
            <td class="actions">
              <a href="?edit=<?= (int)$c['id'] ?>" class="btn btn-sm btn-outline">Edit</a>
              <form method="POST" style="display:inline" onsubmit="return confirm('Delete this category?')">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
                <button type="submit" class="btn btn-sm btn-danger">Delete</button>
              </form>
            </td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($categories)): ?>
            <tr><td colspan="4" style="text-align:center;color:#888">No categories yet.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </main>
</div>
</body>
</html>
