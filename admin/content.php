<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$fields = [
    'home_hero_title'    => ['label' => 'Homepage Hero Title',     'type' => 'text'],
    'home_hero_subtitle' => ['label' => 'Homepage Hero Subtitle',  'type' => 'text'],
    'about_text'         => ['label' => 'About Us Text',           'type' => 'textarea'],
    'contact_email'      => ['label' => 'Contact Email',           'type' => 'email'],
    'contact_phone'      => ['label' => 'Contact Phone',           'type' => 'text'],
    'contact_address'    => ['label' => 'Contact Address',         'type' => 'textarea'],
    'primary_color'      => ['label' => 'Primary Colour (Garnet)', 'type' => 'color'],
    'accent_color'       => ['label' => 'Accent Colour (Gold)',    'type' => 'color'],
];

$err = '';

if (is_post()) {
    csrf_verify();
    foreach ($fields as $key => $cfg) {
        $val = trim(post($key));
        db_run('INSERT INTO content (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?', [$key, $val, $val]);
    }

    // Logo upload
    if (!empty($_FILES['site_logo']['name'])) {
        $file = $_FILES['site_logo'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['png','jpg','jpeg','gif','svg','webp'], true)) {
            $err = 'Logo must be an image file (PNG, JPG, GIF, SVG, WebP).';
        } elseif ($file['size'] > 2 * 1024 * 1024) {
            $err = 'Logo file must be under 2 MB.';
        } else {
            $dest = __DIR__ . '/../assets/uploads/logo.' . $ext;
            if (move_uploaded_file($file['tmp_name'], $dest)) {
                $path = 'assets/uploads/logo.' . $ext;
                db_run('INSERT INTO content (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?',
                    ['site_logo', $path, $path]);
            } else {
                $err = 'Failed to save logo. Check directory permissions.';
            }
        }
    }

    if (!$err) {
        flash('success', 'Content saved.');
        redirect(url('admin/content.php'));
    }
}

$values = [];
foreach (db_all('SELECT key_name, value FROM content') as $row) {
    $values[$row['key_name']] = $row['value'];
}

admin_layout_head('Content');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item active">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <h1>Site Content</h1>
    <?= flash_html() ?>
    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
    <div class="admin-card" style="max-width:600px">
      <form method="POST" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <?php foreach ($fields as $key => $cfg): ?>
        <div class="content-field">
          <label><?= e($cfg['label']) ?></label>
          <?php if ($cfg['type'] === 'textarea'): ?>
            <textarea name="<?= e($key) ?>" class="form-control" rows="4"><?= e($values[$key] ?? '') ?></textarea>
          <?php elseif ($cfg['type'] === 'color'): ?>
            <input type="color" name="<?= e($key) ?>" class="form-control" style="height:42px;padding:4px 6px;cursor:pointer"
                   value="<?= e($values[$key] ?: '#6A1A1A') ?>">
          <?php else: ?>
            <input type="<?= e($cfg['type']) ?>" name="<?= e($key) ?>" class="form-control" value="<?= e($values[$key] ?? '') ?>">
          <?php endif; ?>
        </div>
        <?php endforeach; ?>

        <div class="content-field">
          <label>Site Logo <small style="color:#999">(PNG/JPG/SVG, max 2 MB)</small></label>
          <?php if (!empty($values['site_logo'])): ?>
            <div style="margin-bottom:8px">
              <img src="<?= e(url($values['site_logo'])) ?>" alt="Current logo" style="max-height:60px;background:#f5f5f5;padding:6px;border-radius:4px">
            </div>
          <?php endif; ?>
          <input type="file" name="site_logo" accept="image/*" class="form-control">
        </div>

        <button type="submit" class="btn btn-primary">Save Changes</button>
      </form>
    </div>
  </main>
</div>
</body>
</html>
