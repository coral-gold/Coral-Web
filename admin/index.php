<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

if (is_admin()) redirect(url('admin/dashboard.php'));

$err = '';
if (is_post()) {
    csrf_verify();
    if (admin_login(post('username'), post('password'))) {
        redirect(url('admin/dashboard.php'));
    }
    $err = 'Invalid username or password.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login – Coral Gold</title>
<link rel="stylesheet" href="<?= url('css/style.css') ?>">
</head>
<body class="section-admin">
<div class="admin-login-wrap">
  <div class="admin-login-box">
    <h1>⚙ Admin Login</h1>
    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
    <form method="POST">
      <?= csrf_field() ?>
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="username" class="form-control" required autocomplete="username">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" class="form-control" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%">Login</button>
    </form>
  </div>
</div>
</body>
</html>
