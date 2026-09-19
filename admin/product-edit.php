<?php
/** Add / edit a product, including photo upload — SRS 5.2. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

$id = (int) get_str('id', '0');
$product = $id > 0 ? db_one('SELECT * FROM products WHERE id = ?', [$id]) : null;

if ($id > 0 && !$product) {
    flash('error', 'Product not found.');
    redirect(url('admin/products.php'));
}

$categories = db_all('SELECT * FROM categories ORDER BY name');

if (is_post()) {
    csrf_verify();

    $data = [
        'name'          => post_str('name'),
        'category_id'   => post_int('category_id') ?: null,
        'design_number' => post_str('design_number') ?: null,
        'jewel_code'    => post_str('jewel_code') ?: null,
        'gross_weight'  => post_str('gross_weight') === '' ? null : (float) post_str('gross_weight'),
        'net_weight'    => post_str('net_weight') === '' ? null : (float) post_str('net_weight'),
        'description'   => post_str('description'),
        'featured'      => isset($_POST['featured']) ? 1 : 0,
        'is_active'     => isset($_POST['is_active']) ? 1 : 0,
        'quantity'      => post_str('quantity') === '' ? null : (int) post_str('quantity'),
    ];

    $error = null;
    if ($data['name'] === '') {
        $error = 'Please enter a product name.';
    }

    $imagePath = $product['image_path'] ?? '';
    if ($error === null) {
        try {
            $uploaded = handle_image_upload('image');
            if ($uploaded !== null) {
                $imagePath = $uploaded;
            }
        } catch (RuntimeException $e) {
            $error = $e->getMessage();
        }
    }

    if ($error !== null) {
        flash('error', $error);
    } else {
        try {
            if ($product) {
            db_run(
                'UPDATE products SET name=?, category_id=?, design_number=?, jewel_code=?,
                        gross_weight=?, net_weight=?, quantity=?, description=?, image_path=?,
                        featured=?, is_active=?
                  WHERE id=?',
                [
                    $data['name'], $data['category_id'], $data['design_number'], $data['jewel_code'],
                    $data['gross_weight'], $data['net_weight'], $data['quantity'], $data['description'],
                    $imagePath, $data['featured'], $data['is_active'], $id,
                ]
            );
            flash('success', 'Product updated.');
        } else {
            db_run(
                'INSERT INTO products (name, category_id, design_number, jewel_code, gross_weight,
                        net_weight, quantity, description, image_path, featured, is_active)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [
                    $data['name'], $data['category_id'], $data['design_number'], $data['jewel_code'],
                    $data['gross_weight'], $data['net_weight'], $data['quantity'], $data['description'],
                    $imagePath, $data['featured'], $data['is_active'],
                ]
            );
            flash('success', 'Product added.');
        }
        redirect(url('admin/products.php'));
        } catch (PDOException $e) {
            // Jewel Code is unique — it is what the stock import upserts on.
            flash('error', 'Jewel Code "' . $data['jewel_code'] . '" is already used by another product. '
                . 'Each Jewel Code can only appear once.');
        }
    }

    redirect(url('admin/product-edit.php' . ($id > 0 ? '?id=' . $id : '')));
}

$value = static fn(string $key, $fallback = '') => $product[$key] ?? $fallback;

layout_header($product ? 'Edit Product' : 'Add Product', 'admin', admin_nav(), 'products');
?>

<div class="page-head">
  <div>
    <h1><?= $product ? 'Edit Product' : 'Add Product' ?></h1>
    <p>Jewel code and weights appear only inside the wholesaler order section, never publicly.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('admin/products.php')) ?>">&larr; Back to products</a>
</div>

<div class="card" style="max-width:760px;">
  <form method="post" enctype="multipart/form-data" novalidate>
    <?= csrf_field() ?>

    <div class="field">
      <label for="name">Product name</label>
      <input type="text" id="name" name="name" value="<?= e($value('name')) ?>" required>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="category_id">Category</label>
        <select id="category_id" name="category_id">
          <option value="">— none —</option>
          <?php foreach ($categories as $category): ?>
            <option value="<?= (int) $category['id'] ?>"
              <?= (int) $value('category_id') === (int) $category['id'] ? ' selected' : '' ?>>
              <?= e($category['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="quantity">Quantity</label>
        <input type="number" id="quantity" name="quantity" min="0" value="<?= e($value('quantity')) ?>">
        <span class="hint">Optional. Secondary to the weights.</span>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="design_number">Design number</label>
        <input type="text" id="design_number" name="design_number" value="<?= e($value('design_number')) ?>">
      </div>
      <div class="field">
        <label for="jewel_code">Jewel code</label>
        <input type="text" id="jewel_code" name="jewel_code" value="<?= e($value('jewel_code')) ?>">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="gross_weight">Gross weight</label>
        <input type="number" step="0.001" min="0" id="gross_weight" name="gross_weight" value="<?= e($value('gross_weight')) ?>">
      </div>
      <div class="field">
        <label for="net_weight">Net weight</label>
        <input type="number" step="0.001" min="0" id="net_weight" name="net_weight" value="<?= e($value('net_weight')) ?>">
      </div>
    </div>

    <div class="field">
      <label for="description">Short description</label>
      <textarea id="description" name="description" rows="3"><?= e($value('description')) ?></textarea>
      <span class="hint">Shown on the public catalogue.</span>
    </div>

    <div class="field">
      <label for="image">Photo</label>
      <?php if ($value('image_path') !== ''): ?>
        <img class="thumb" style="width:110px;height:110px;margin-bottom:10px;"
             src="<?= e(url($value('image_path'))) ?>" alt="Current photo">
      <?php endif; ?>
      <input type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp">
      <span class="hint">JPG, PNG or WebP, up to 6 MB. Leave empty to keep the current photo.</span>
    </div>

    <div class="field">
      <label><input type="checkbox" name="featured" value="1" <?= (int) $value('featured', 0) === 1 ? 'checked' : '' ?>>
        Feature on the home page</label>
    </div>
    <div class="field">
      <label><input type="checkbox" name="is_active" value="1" <?= (int) $value('is_active', 1) === 1 ? 'checked' : '' ?>>
        Visible in catalogue</label>
    </div>

    <button type="submit" class="btn btn-primary"><?= $product ? 'Save changes' : 'Add product' ?></button>
  </form>
</div>

<?php layout_footer(); ?>
