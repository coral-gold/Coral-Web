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
];

if (is_post()) {
    csrf_verify();
    foreach ($fields as $key => $cfg) {
        $val = trim(post($key));
        db_run('INSERT INTO content (key_name,value) VALUES (?,?) ON DUPLICATE KEY UPDATE value=?', [$key, $val, $val]);
    }
    flash('success', 'Content saved.');
    redirect(url('admin/content.php'));
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
    <div class="admin-card" style="max-width:600px">
      <form method="POST">
        <?= csrf_field() ?>
        <?php foreach ($fields as $key => $cfg): ?>
        <div class="content-field">
          <label><?= e($cfg['label']) ?></label>
          <?php if ($cfg['type'] === 'textarea'): ?>
            <textarea name="<?= e($key) ?>" class="form-control" rows="4"><?= e($values[$key] ?? '') ?></textarea>
          <?php else: ?>
            <input type="<?= e($cfg['type']) ?>" name="<?= e($key) ?>" class="form-control" value="<?= e($values[$key] ?? '') ?>">
          <?php endif; ?>
        </div>
        <?php endforeach; ?>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </form>
    </div>
  </main>
</div>
</body>
</html>
