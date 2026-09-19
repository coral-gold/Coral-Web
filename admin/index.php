<?php
/** Admin login — SRS 5.1. Separate from the party login. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

if (current_admin()) {
    redirect(url('admin/dashboard.php'));
}

// First run: no admin exists yet, so send the user to the one-time setup.
if (admin_count() === 0) {
    redirect(url('admin/setup.php'));
}

$username = '';

if (is_post()) {
    csrf_verify();
    $username = post_str('username');
    $password = (string) ($_POST['password'] ?? '');

    if ($username === '' || $password === '') {
        flash('error', 'Please enter your username and password.');
    } elseif (login_is_locked('admin', $username)) {
        flash('error', 'Too many failed attempts. Please wait a few minutes and try again.');
    } elseif (admin_attempt_login($username, $password)) {
        redirect(url('admin/dashboard.php'));
    } else {
        flash('error', 'Invalid username or password.');
    }
}

layout_auth_header('Admin Login');
?>
<h1>Admin Panel</h1>
<p class="auth-sub">Coral Gold staff sign-in.</p>

<form method="post" novalidate>
  <?= csrf_field() ?>
  <div class="field">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" value="<?= e($username) ?>" autocomplete="username" autofocus required>
  </div>
  <div class="field">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
  </div>
  <button type="submit" class="btn btn-primary btn-block">Sign In</button>
</form>

<p class="auth-note"><a href="<?= e(url('index.html')) ?>">&larr; Back to website</a></p>
<?php
layout_auth_footer();
