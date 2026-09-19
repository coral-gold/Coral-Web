<?php
/** Stock import from the ERP Excel export — batch 3, item 3. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';
require_once __DIR__ . '/../includes/stock_import.php';

require_admin();

$result = null;
$parsed = null;
$error = null;

if (is_post()) {
    csrf_verify();

    $file = $_FILES['sheet'] ?? null;
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        $error = 'Please choose a file to import.';
    } elseif ($file['error'] !== UPLOAD_ERR_OK) {
        $error = 'The file failed to upload. It may be larger than the server allows.';
    } elseif (strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION)) !== 'xlsx') {
        $error = 'Please upload the .xlsx export. Older .xls files need saving as .xlsx first.';
    } else {
        try {
            $parsed = parse_stock_file((string) $file['tmp_name']);
            if (!$parsed['rows']) {
                $error = 'No usable rows found. Check the sheet has a Jewel Code column.';
            } else {
                $result = import_stock_rows($parsed['rows']);
            }
        } catch (Throwable $e) {
            $error = 'Could not read the file: ' . $e->getMessage();
        }
    }
}

layout_header('Import Stock', 'admin', admin_nav(), 'import');
?>

<div class="page-head">
  <div>
    <h1>Import Stock</h1>
    <p>Upload the ERP stock export. Products are matched on Jewel Code, so re-importing updates rather than duplicates.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('admin/products.php')) ?>">View products</a>
</div>

<?php if ($error !== null): ?>
  <div class="alert alert-error"><?= e($error) ?></div>
<?php endif; ?>

<?php if ($result !== null): ?>
  <div class="card">
    <h2>Import finished</h2>
    <div class="stat-grid">
      <div class="stat"><span>Added</span><strong><?= (int) $result['inserted'] ?></strong></div>
      <div class="stat"><span>Updated</span><strong><?= (int) $result['updated'] ?></strong></div>
      <div class="stat"><span>Photos matched</span><strong><?= (int) $result['images'] ?></strong></div>
      <div class="stat"><span>Skipped</span><strong><?= (int) $result['skipped'] ?></strong></div>
    </div>

    <?php if ($parsed['found']): ?>
      <p class="hint">Columns used: <?= e(implode(', ', $parsed['found'])) ?>.</p>
    <?php endif; ?>
    <?php if ($parsed['ignored']): ?>
      <p class="hint">Ignored: <?= e(implode(', ', array_slice($parsed['ignored'], 0, 15))) ?><?= count($parsed['ignored']) > 15 ? '…' : '' ?></p>
    <?php endif; ?>

    <?php if ($result['problems']): ?>
      <h3 style="margin-top:18px">Rows that could not be imported</h3>
      <ul class="facility-list">
        <?php foreach (array_slice($result['problems'], 0, 25) as $problem): ?>
          <li><?= e($problem) ?></li>
        <?php endforeach; ?>
      </ul>
      <?php if (count($result['problems']) > 25): ?>
        <p class="hint"><?= count($result['problems']) - 25 ?> more not shown.</p>
      <?php endif; ?>
    <?php endif; ?>
  </div>
<?php endif; ?>

<div class="card" style="max-width:640px;">
  <form method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="field">
      <label for="sheet">Stock export (.xlsx)</label>
      <input type="file" id="sheet" name="sheet" accept=".xlsx" required>
    </div>
    <button type="submit" class="btn btn-primary">Import</button>
  </form>
</div>

<div class="card" style="max-width:640px;">
  <h2>What gets read</h2>
  <div class="table-wrap">
    <table class="data">
      <thead><tr><th>Column in your export</th><th>Becomes</th></tr></thead>
      <tbody>
        <tr><td>Jewel Code</td><td>Jewel Code <span class="badge badge-on">matched on</span></td></tr>
        <tr><td>Style No</td><td>Design Number</td></tr>
        <tr><td>Category</td><td>Category <span class="hint">(created if new)</span></td></tr>
        <tr><td>Gr Wt</td><td>Gross Weight</td></tr>
        <tr><td>Net Wt</td><td>Net Weight</td></tr>
        <tr><td>Qty</td><td>Quantity</td></tr>
      </tbody>
    </table>
  </div>
  <p class="hint" style="margin-top:14px">
    Every other column is ignored. Photos are matched by Style No — a file named
    after the Style No in <code>assets/products</code> or <code>assets/uploads</code>
    is attached automatically. Existing photos are kept when the import has none.
  </p>
</div>

<?php layout_footer(); ?>
