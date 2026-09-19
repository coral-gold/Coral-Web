<?php
/**
 * Applies pending schema changes to an already-installed database.
 * Admin-only, and safe to run more than once.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';
require_once __DIR__ . '/../includes/migrations.php';

require_admin();

$applied = null;
$error = null;

if (is_post()) {
    csrf_verify();
    try {
        $applied = run_migrations();
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
}

layout_header('Database Upgrade', 'admin', admin_nav(), '');
?>

<div class="page-head">
  <div>
    <h1>Database Upgrade</h1>
    <p>Applies any schema changes shipped since this database was created.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('admin/dashboard.php')) ?>">&larr; Dashboard</a>
</div>

<div class="card" style="max-width:640px;">
  <?php if ($error !== null): ?>
    <div class="alert alert-error"><?= e($error) ?></div>
  <?php elseif (is_array($applied)): ?>
    <?php if ($applied): ?>
      <div class="alert alert-success">Upgrade complete.</div>
      <ul class="facility-list">
        <?php foreach ($applied as $line): ?>
          <li><?= e($line) ?></li>
        <?php endforeach; ?>
      </ul>
    <?php else: ?>
      <div class="alert alert-success">The database is already up to date — nothing to change.</div>
    <?php endif; ?>
  <?php else: ?>
    <p>
      This checks the live database and applies only what is missing. It is safe
      to run more than once, and it never deletes products, parties or quotations.
    </p>
  <?php endif; ?>

  <form method="post">
    <?= csrf_field() ?>
    <button type="submit" class="btn btn-primary">
      <?= is_array($applied) || $error !== null ? 'Run again' : 'Run upgrade' ?>
    </button>
  </form>
</div>

<?php layout_footer(); ?>
