<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$result = null;
$err    = '';

if (is_post()) {
    csrf_verify();
    if (empty($_FILES['xlsx']['name'])) {
        $err = 'Please select an Excel file to upload.';
    } else {
        $file = $_FILES['xlsx'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['xlsx','xls','ods'], true)) {
            $err = 'Only .xlsx, .xls or .ods files are accepted.';
        } elseif ($file['size'] > 10 * 1024 * 1024) {
            $err = 'File must be under 10 MB.';
        } else {
            $tmp = $file['tmp_name'];
            require_once __DIR__ . '/../includes/stock_import.php';
            $result = import_stock_xlsx($tmp);
        }
    }
}

admin_layout_head('Import Stock');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item active">Import</a>
    <a href="parties.php"    class="nav-item">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <h1>Import Stock</h1>

    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
    <?php if ($result): ?>
      <div class="alert <?= $result['imported'] > 0 ? 'alert-success' : 'alert-warning' ?>">
        <strong>Import complete:</strong>
        <?= $result['imported'] ?> row(s) imported/updated,
        <?= $result['skipped'] ?> skipped.
        <?php if ($result['errors']): ?>
          <ul style="margin:8px 0 0;padding-left:20px">
            <?php foreach (array_slice($result['errors'], 0, 10) as $e_msg): ?>
              <li><?= e($e_msg) ?></li>
            <?php endforeach; ?>
            <?php if (count($result['errors']) > 10): ?>
              <li>… and <?= count($result['errors']) - 10 ?> more errors.</li>
            <?php endif; ?>
          </ul>
        <?php endif; ?>
      </div>
    <?php endif; ?>

    <div class="admin-card" style="max-width:500px">
      <h3 style="margin-bottom:16px;font-size:15px;font-weight:bold">Upload Excel File</h3>
      <form method="POST" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <div class="import-zone">
          <p>📊 Drop your .xlsx file here or click to select</p>
          <input type="file" name="xlsx" accept=".xlsx,.xls,.ods" style="margin-top:12px" required>
        </div>
        <button type="submit" class="btn btn-primary">Import</button>
      </form>
    </div>

    <div class="admin-card" style="max-width:500px;margin-top:20px">
      <h3 style="margin-bottom:8px;font-size:15px;font-weight:bold">Expected Column Format</h3>
      <p style="font-size:13px;color:#666;margin-bottom:10px">First row must be column headers (case-insensitive):</p>
      <table class="data-table" style="font-size:13px">
        <thead><tr><th>Column</th><th>Required?</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>jewel_code</code></td><td><span class="badge badge-red">Required</span></td><td>Unique product identifier (upsert key)</td></tr>
          <tr><td><code>design_number</code></td><td>Optional</td><td>Falls back to jewel_code</td></tr>
          <tr><td><code>category</code></td><td>Optional</td><td>Auto-created if new</td></tr>
          <tr><td><code>gross_weight</code></td><td>Optional</td><td>In grams (decimal)</td></tr>
          <tr><td><code>net_weight</code></td><td>Optional</td><td>In grams (decimal)</td></tr>
          <tr><td><code>quantity</code></td><td>Optional</td><td>Integer</td></tr>
          <tr><td><code>description</code></td><td>Optional</td><td>Free text</td></tr>
        </tbody>
      </table>
    </div>
  </main>
</div>
</body>
</html>
