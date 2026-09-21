<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

if (current_party()) redirect(url('wholesaler/catalogue.php'));

$err = '';
if (is_post()) {
    csrf_verify();
    $pid  = trim(post('party_id'));
    $pass = post('password');
    if (party_login($pid, $pass)) {
        redirect(url('wholesaler/catalogue.php'));
    } else {
        $err = 'Invalid Party ID or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wholesaler Login – Coral Gold</title>
<link rel="stylesheet" href="<?= url('css/style.css') ?>">
</head>
<body class="section-wholesaler">
<div class="login-wrap">
  <div class="login-box">
    <div class="logo">✦ Coral Gold</div>
    <h2>Wholesaler Login</h2>
    <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
    <form method="POST">
      <?= csrf_field() ?>
      <div class="form-group">
        <label>Party ID</label>
        <input type="text" name="party_id" class="form-control" autocomplete="username" required value="<?= e(post('party_id')) ?>">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" class="form-control" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
    <p style="text-align:center;margin-top:16px;font-size:13px;color:#888">
      <a href="<?= url('public/home.php') ?>">← Back to site</a>
    </p>
  </div>
</div>
</body>
</html>
