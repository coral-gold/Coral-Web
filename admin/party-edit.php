<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_admin();

$id    = get_int('id');
$party = $id ? db_one('SELECT * FROM parties WHERE id=?', [$id]) : null;
$err   = '';

if (is_post()) {
    csrf_verify();
    $pid      = trim(post('party_id'));
    $company  = trim(post('company_name'));
    $phone    = trim(post('phone'));
    $email    = trim(post('email'));
    $password = post('password');
    $active   = post_int('is_active', 1);

    if (!$pid || !$company) { $err = 'Party ID and Company Name are required.'; }
    elseif (!$party && !$password) { $err = 'Password is required for new parties.'; }
    elseif ($password && strlen($password) < 6) { $err = 'Password must be at least 6 characters.'; }
    else {
        try {
            if ($party) {
                $hash = $password ? password_hash($password, PASSWORD_DEFAULT) : $party['password_hash'];
                db_run('UPDATE parties SET party_id=?,company_name=?,phone=?,email=?,is_active=?,password_hash=? WHERE id=?',
                    [$pid, $company, $phone, $email, $active, $hash, $id]);
                flash('success', 'Party updated.');
            } else {
                db_run('INSERT INTO parties (party_id,company_name,phone,email,is_active,password_hash) VALUES (?,?,?,?,?,?)',
                    [$pid, $company, $phone, $email, $active, password_hash($password, PASSWORD_DEFAULT)]);
                flash('success', 'Party created.');
            }
            redirect(url('admin/parties.php'));
        } catch (\Exception $e) {
            $err = 'Party ID already exists.';
        }
    }
}

admin_layout_head($party ? 'Edit Party' : 'Add Party');
?>
<div class="admin-layout">
  <nav class="admin-sidebar">
    <a href="dashboard.php"  class="nav-item">Dashboard</a>
    <a href="categories.php" class="nav-item">Categories</a>
    <a href="products.php"   class="nav-item">Products</a>
    <a href="import.php"     class="nav-item">Import</a>
    <a href="parties.php"    class="nav-item active">Parties</a>
    <a href="quotations.php" class="nav-item">Quotations</a>
    <a href="content.php"    class="nav-item">Content</a>
    <a href="logout.php"     class="nav-item">Logout</a>
  </nav>
  <main class="admin-main">
    <div class="page-actions">
      <h1><?= $party ? 'Edit Party' : 'Add Party' ?></h1>
      <a href="parties.php" class="btn btn-outline btn-sm">← Back</a>
    </div>
    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
    <div class="admin-card" style="max-width:500px">
      <form method="POST">
        <?= csrf_field() ?>
        <div class="form-group">
          <label>Party ID * <small style="color:#999">(used for login)</small></label>
          <input type="text" name="party_id" class="form-control" required maxlength="20"
                 value="<?= e($party['party_id'] ?? post('party_id')) ?>">
        </div>
        <div class="form-group">
          <label>Company Name *</label>
          <input type="text" name="company_name" class="form-control" required maxlength="100"
                 value="<?= e($party['company_name'] ?? post('company_name')) ?>">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="text" name="phone" class="form-control" maxlength="20"
                 value="<?= e($party['phone'] ?? post('phone')) ?>">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control"
                 value="<?= e($party['email'] ?? post('email')) ?>">
        </div>
        <div class="form-group">
          <label><?= $party ? 'New Password <small style="color:#999">(leave blank to keep)</small>' : 'Password *' ?></label>
          <input type="password" name="password" class="form-control" <?= $party ? '' : 'required' ?> autocomplete="new-password">
        </div>
        <?php if ($party): ?>
        <div class="form-group">
          <label>
            <input type="checkbox" name="is_active" value="1" <?= $party['is_active'] ? 'checked' : '' ?>>
            Active (can log in)
          </label>
        </div>
        <?php endif; ?>
        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-primary"><?= $party ? 'Update Party' : 'Create Party' ?></button>
          <a href="parties.php" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    </div>
  </main>
</div>
</body>
</html>
