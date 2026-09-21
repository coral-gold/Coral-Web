<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$id      = get_int('id');
$product = $id ? db_one('SELECT * FROM products WHERE id=?', [$id]) : null;
$cats    = db_all('SELECT * FROM categories ORDER BY name');
$err     = '';

if (is_post()) {
    csrf_verify();
    $data = [
        'category_id'   => post_int('category_id'),
        'design_number' => trim(post('design_number')),
        'jewel_code'    => trim(post('jewel_code')),
        'gross_weight'  => (float)post('gross_weight'),
        'net_weight'    => (float)post('net_weight'),
        'quantity'      => post_int('quantity'),
        'description'   => trim(post('description')),
        'is_featured'   => post_int('is_featured'),
    ];

    // Validate
    if (!$data['design_number'] || !$data['jewel_code'] || !$data['category_id']) {
        $err = 'Design number, jewel code and category are required.';
    } else {
        // Image upload
        $image_path = $product['image_path'] ?? null;
        if (!empty($_FILES['image']['name'])) {
            $file    = $_FILES['image'];
            $allowed = ['image/jpeg','image/png','image/webp','image/gif'];
            if (!in_array($file['type'], $allowed, true)) {
                $err = 'Only JPEG, PNG, WebP or GIF images allowed.';
            } elseif ($file['size'] > 4 * 1024 * 1024) {
                $err = 'Image must be under 4 MB.';
            } else {
                $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
                $filename = uniqid('img_', true) . '.' . strtolower($ext);
                $dest     = __DIR__ . '/../assets/uploads/' . $filename;
                if (move_uploaded_file($file['tmp_name'], $dest)) {
                    // Remove old image
                    if ($image_path && file_exists(__DIR__ . '/../assets/uploads/' . $image_path)) {
                        unlink(__DIR__ . '/../assets/uploads/' . $image_path);
                    }
                    $image_path = $filename;
                } else {
                    $err = 'Failed to upload image.';
                }
            }
        }

        if (!$err) {
            $data['image_path'] = $image_path;
            if ($product) {
                db_run('UPDATE products SET category_id=?,design_number=?,jewel_code=?,gross_weight=?,net_weight=?,quantity=?,description=?,is_featured=?,image_path=? WHERE id=?',
                    [$data['category_id'],$data['design_number'],$data['jewel_code'],$data['gross_weight'],$data['net_weight'],$data['quantity'],$data['description'],$data['is_featured'],$data['image_path'],$id]);
                flash('success', 'Product updated.');
            } else {
                db_run('INSERT INTO products (category_id,design_number,jewel_code,gross_weight,net_weight,quantity,description,is_featured,image_path) VALUES (?,?,?,?,?,?,?,?,?)',
                    [$data['category_id'],$data['design_number'],$data['jewel_code'],$data['gross_weight'],$data['net_weight'],$data['quantity'],$data['description'],$data['is_featured'],$data['image_path']]);
                flash('success', 'Product added.');
            }
            redirect(url('admin/products.php'));
        }
    }
} else {
    $data = $product ?? ['category_id'=>'','design_number'=>'','jewel_code'=>'','gross_weight'=>'','net_weight'=>'','quantity'=>0,'description'=>'','is_featured'=>0,'image_path'=>null];
}

admin_layout_head($product ? 'Edit Product' : 'Add Product');
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
      <h1><?= $product ? 'Edit Product' : 'Add Product' ?></h1>
      <a href="products.php" class="btn btn-outline btn-sm">← Back</a>
    </div>
    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>

    <div class="admin-card" style="max-width:600px">
      <form method="POST" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label>Design Number *</label>
            <input type="text" name="design_number" class="form-control" required value="<?= e($data['design_number']) ?>">
          </div>
          <div class="form-group">
            <label>Jewel Code *</label>
            <input type="text" name="jewel_code" class="form-control" required value="<?= e($data['jewel_code']) ?>">
          </div>
          <div class="form-group">
            <label>Gross Weight (g)</label>
            <input type="number" name="gross_weight" class="form-control" step="0.001" min="0" value="<?= e($data['gross_weight']) ?>">
          </div>
          <div class="form-group">
            <label>Net Weight (g)</label>
            <input type="number" name="net_weight" class="form-control" step="0.001" min="0" value="<?= e($data['net_weight']) ?>">
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select name="category_id" class="form-control" required>
              <option value="">Select…</option>
              <?php foreach ($cats as $c): ?>
                <option value="<?= $c['id'] ?>" <?= $data['category_id'] == $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" name="quantity" class="form-control" min="0" value="<?= (int)$data['quantity'] ?>">
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" class="form-control" rows="3"><?= e($data['description']) ?></textarea>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" name="is_featured" value="1" <?= $data['is_featured'] ? 'checked' : '' ?>>
            Featured on homepage
          </label>
        </div>
        <div class="form-group">
          <label>Product Image (JPEG/PNG/WebP, max 4 MB)</label>
          <?php if ($data['image_path']): ?>
            <div class="img-preview-wrap">
              <img src="<?= e(url('assets/uploads/' . $data['image_path'])) ?>" class="img-preview" alt="">
            </div>
          <?php endif; ?>
          <input type="file" name="image" class="form-control" accept="image/*">
        </div>
        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-primary"><?= $product ? 'Update Product' : 'Add Product' ?></button>
          <a href="products.php" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </div>
  </main>
</div>
</body>
</html>
