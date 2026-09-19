<?php
/**
 * Party changes its own password — SRS 4.2 (optional item, included for
 * basic hygiene). The Party ID itself can never be changed here.
 * Accounts flagged must_change_password land here until they set one.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];
$mustChange = (int) $party['must_change_password'] === 1;

if (is_post()) {
    csrf_verify();
    $current = (string) ($_POST['current_password'] ?? '');
    $new     = (string) ($_POST['new_password'] ?? '');
    $confirm = (string) ($_POST['confirm_password'] ?? '');

    if (!password_verify($current, (string) $party['password_hash'])) {
        flash('error', 'Your current password is not correct.');
    } elseif (($problem = password_problem($new, $confirm)) !== null) {
        flash('error', $problem);
    } elseif ($new === $current) {
        flash('error', 'Please choose a password different from your current one.');
    } else {
        db_run(
            'UPDATE parties SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [hash_password($new), $partyId]
        );
        flash('success', 'Your password has been updated.');
        redirect(url('order/index.php'));
    }
    redirect(url('order/password.php'));
}

layout_header('Change Password', 'order', order_nav($partyId), 'password');
?>

<div class="page-head">
  <div>
    <h1>Change Password</h1>
    <p>
      <?= $mustChange
            ? 'Please set your own password before continuing.'
            : 'Update the password used to sign in to the order section.' ?>
    </p>
  </div>
</div>

<div class="card" style="max-width:520px;">
  <form method="post" novalidate>
    <?= csrf_field() ?>
    <div class="field">
      <label for="current_password">Current password</label>
      <input type="password" id="current_password" name="current_password" autocomplete="current-password" required>
    </div>
    <div class="field">
      <label for="new_password">New password</label>
      <input type="password" id="new_password" name="new_password" autocomplete="new-password" required>
      <span class="hint">At least 8 characters.</span>
    </div>
    <div class="field">
      <label for="confirm_password">Confirm new password</label>
      <input type="password" id="confirm_password" name="confirm_password" autocomplete="new-password" required>
    </div>
    <button type="submit" class="btn btn-primary">Update password</button>
  </form>
  <p class="hint" style="margin-top:16px;">
    Your Party ID (<strong><?= e($party['party_code']) ?></strong>) cannot be changed here —
    contact Coral Gold if it needs updating.
  </p>
</div>

<?php layout_footer(); ?>
