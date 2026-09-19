<?php
/** Wholesaler ("party") login — SRS 4.1. Accounts are created by Admin only. */

require_once __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/layout.php';

if (current_party()) {
    redirect(url('order/index.php'));
}

$partyCode = '';

if (is_post()) {
    csrf_verify();
    $partyCode = post_str('party_code');
    $password  = (string) ($_POST['password'] ?? '');

    if ($partyCode === '' || $password === '') {
        flash('error', 'Please enter both your Party ID and password.');
    } elseif (login_is_locked('party', $partyCode)) {
        flash('error', 'Too many failed attempts. Please wait a few minutes and try again, or contact Coral Gold.');
    } elseif (party_attempt_login($partyCode, $password)) {
        redirect(url('order/index.php'));
    } else {
        // Deliberately generic: never reveal whether the ID exists.
        flash('error', 'Invalid Party ID or password.');
    }
}

layout_auth_header('Wholesaler Login');
?>
<h1>Wholesaler Login</h1>
<p class="auth-sub">Sign in to browse the catalogue and build a quotation.</p>

<form method="post" novalidate>
  <?= csrf_field() ?>
  <div class="field">
    <label for="party_code">Party ID</label>
    <input type="text" id="party_code" name="party_code" value="<?= e($partyCode) ?>" autocomplete="username" autofocus required>
  </div>
  <div class="field">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
  </div>
  <button type="submit" class="btn btn-primary btn-block">Sign In</button>
</form>

<p class="auth-note">
  Accounts are issued by Coral Gold. Forgotten your password?
  <a href="<?= e(url('contact.html')) ?>">Contact us</a> and we'll reset it.
</p>
<p class="auth-note"><a href="<?= e(url('index.html')) ?>">&larr; Back to website</a></p>
<?php
layout_auth_footer();
