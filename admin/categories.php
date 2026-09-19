<?php
/** Category management — SRS 5.2. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

function slugify(string $text): string
{
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $text) ?? '', '-'));
    return $slug === '' ? 'category-' . bin2hex(random_bytes(3)) : $slug;
}

if (is_post()) {
    csrf_verify();
    $action = post_str('action');

    if ($action === 'create') {
        $name = post_str('name');
        if ($name === '') {
            flash('error', 'Please enter a category name.');
        } else {
            try {
                db_run(
                    'INSERT INTO categories (name, slug) VALUES (?, ?)',
                    [$name, slugify($name)]
                );
                flash('success', 'Category added.');
            } catch (PDOException $e) {
                flash('error', 'A category with that name already exists.');
            }
        }
    } elseif ($action === 'update') {
        $name = post_str('name');
        if ($name !== '') {
            db_run('UPDATE categories SET name = ? WHERE id = ?', [$name, post_int('id')]);
            flash('success', 'Category updated.');
        }
    } elseif ($action === 'delete') {
        // Products keep existing; their category simply becomes unset.
        db_run('DELETE FROM categories WHERE id = ?', [post_int('id')]);
        flash('success', 'Category deleted. Any products in it are now uncategorised.');
    }

    redirect(url('admin/categories.php'));
}

$categories = db_all(
    'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ORDER BY c.name'
);

layout_header('Categories', 'admin', admin_nav(), 'categories');
?>

<div class="page-head">
  <div>
    <h1>Categories</h1>
    <p>A category is just a name. Products are grouped by it on the public catalogue and in the order section.</p>
  </div>
</div>

<div class="card">
  <h2>Add a category</h2>
  <form method="post" class="filter-form">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="create">
    <div class="field">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" required>
    </div>
    <button type="submit" class="btn btn-primary">Add</button>
  </form>
</div>

<div class="card">
  <?php if (!$categories): ?>
    <p class="empty-state">No categories yet.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Name</th><th>Products</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($categories as $category): $cid = (int) $category['id']; ?>
            <tr>
              <td><input type="text" name="name" form="cat-save-<?= $cid ?>" value="<?= e($category['name']) ?>"></td>
              <td><?= (int) $category['product_count'] ?></td>
              <td class="table-actions">
                <button type="submit" class="btn btn-outline btn-sm" form="cat-save-<?= $cid ?>">Save</button>
                <button type="submit" class="btn btn-danger btn-sm" form="cat-delete-<?= $cid ?>">Delete</button>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <?php foreach ($categories as $category): $cid = (int) $category['id']; ?>
      <form id="cat-save-<?= $cid ?>" method="post" class="inline-form">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="id" value="<?= $cid ?>">
      </form>
      <form id="cat-delete-<?= $cid ?>" method="post" class="inline-form"
            onsubmit="return confirm('Delete this category? Products in it become uncategorised.');">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="delete">
        <input type="hidden" name="id" value="<?= $cid ?>">
      </form>
    <?php endforeach; ?>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
