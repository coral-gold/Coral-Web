<?php
/**
 * One-time admin creation. This page only works while the admins table is
 * empty — once the first account exists it refuses to run, so it is safe to
 * leave deployed and there is no default password committed to the repo.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

if (admin_count() > 0) {
    http_response_code(403);
    flash('error', 'Setup has already been completed. Please sign in.');
    redirect(url('admin/index.php'));
}

if (is_post()) {
    csrf_verify();
    $username = post_str('username');
    $name     = post_str('name');
    $password = (string) ($_POST['password'] ?? '');
    $confirm  = (string) ($_POST['confirm_password'] ?? '');

    if ($username === '') {
        flash('error', 'Please choose a username.');
    } elseif (($problem = password_problem($password, $confirm)) !== null) {
        flash('error', $problem);
    } else {
        db_run(
            'INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)',
            [$username, hash_password($password), $name]
        );
        flash('success', 'Admin account created. Please sign in.');
        redirect(url('admin/index.php'));
    }
    redirect(url('admin/setup.php'));
}

layout_auth_header('Admin Setup');
?>
<h1>Create Admin Account</h1>
<p class="auth-sub">This one-time setup runs only while no admin exists.</p>

<form method="post" novalidate>
  <?= csrf_field() ?>
  <div class="field">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" autocomplete="username" autofocus required>
  </div>
  <div class="field">
    <label for="name">Your name</label>
    <input type="text" id="name" name="name" autocomplete="name">
  </div>
  <div class="field">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="new-password" required>
    <span class="hint">At least 8 characters.</span>
  </div>
  <div class="field">
    <label for="confirm_password">Confirm password</label>
    <input type="password" id="confirm_password" name="confirm_password" autocomplete="new-password" required>
  </div>
  <button type="submit" class="btn btn-primary btn-block">Create account</button>
</form>
<?php
layout_auth_footer();
