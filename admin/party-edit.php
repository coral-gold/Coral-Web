<?php
/** Create / edit a party account and reset its password — SRS 5.3. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

$id = (int) get_str('id', '0');
$party = $id > 0 ? db_one('SELECT * FROM parties WHERE id = ?', [$id]) : null;

if ($id > 0 && !$party) {
    flash('error', 'Party account not found.');
    redirect(url('admin/parties.php'));
}

if (is_post()) {
    csrf_verify();
    $action = post_str('action', 'save');

    if ($action === 'reset_password' && $party) {
        $password = (string) ($_POST['new_password'] ?? '');
        $confirm  = (string) ($_POST['confirm_password'] ?? '');
        if (($problem = password_problem($password, $confirm)) !== null) {
            flash('error', $problem);
        } else {
            db_run(
                'UPDATE parties SET password_hash = ?, must_change_password = 1 WHERE id = ?',
                [hash_password($password), $id]
            );
            flash('success', 'Password reset. The party will be asked to set their own on next sign-in.');
        }
        redirect(url('admin/party-edit.php?id=' . $id));
    }

    $partyCode   = post_str('party_code');
    $companyName = post_str('company_name');
    $contact     = post_str('contact_person');
    $phone       = post_str('phone');
    $email       = post_str('email');
    $isActive    = isset($_POST['is_active']) ? 1 : 0;

    $error = null;
    if ($partyCode === '' || $companyName === '') {
        $error = 'Party ID and company name are both required.';
    }

    if ($error === null && !$party) {
        $password = (string) ($_POST['password'] ?? '');
        $confirm  = (string) ($_POST['confirm_password'] ?? '');
        $error = password_problem($password, $confirm);
    }

    if ($error !== null) {
        flash('error', $error);
        redirect(url('admin/party-edit.php' . ($id > 0 ? '?id=' . $id : '')));
    }

    try {
        if ($party) {
            db_run(
                'UPDATE parties SET party_code=?, company_name=?, contact_person=?, phone=?, email=?, is_active=?
                  WHERE id=?',
                [$partyCode, $companyName, $contact, $phone, $email, $isActive, $id]
            );
            flash('success', 'Party account updated.');
        } else {
            db_run(
                'INSERT INTO parties (party_code, password_hash, company_name, contact_person, phone, email, is_active, must_change_password)
                 VALUES (?,?,?,?,?,?,?,1)',
                [$partyCode, hash_password((string) $_POST['password']), $companyName, $contact, $phone, $email, $isActive]
            );
            flash('success', 'Party account created. Share the Party ID and temporary password with them.');
        }
        redirect(url('admin/parties.php'));
    } catch (PDOException $e) {
        flash('error', 'That Party ID is already in use. Please choose a different one.');
        redirect(url('admin/party-edit.php' . ($id > 0 ? '?id=' . $id : '')));
    }
}

$value = static fn(string $key, $fallback = '') => $party[$key] ?? $fallback;

layout_header($party ? 'Edit Party' : 'Add Party', 'admin', admin_nav(), 'parties');
?>

<div class="page-head">
  <div>
    <h1><?= $party ? 'Edit Party Account' : 'Add Party Account' ?></h1>
    <p>These are the credentials the wholesaler uses to sign in to the order section.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('admin/parties.php')) ?>">&larr; Back to parties</a>
</div>

<div class="card" style="max-width:700px;">
  <form method="post" novalidate>
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save">

    <div class="field-row">
      <div class="field">
        <label for="party_code">Party ID (login)</label>
        <input type="text" id="party_code" name="party_code" value="<?= e($value('party_code')) ?>" required>
        <span class="hint">What the wholesaler types to sign in, e.g. <code>CORAL-101</code>.</span>
      </div>
      <div class="field">
        <label for="company_name">Company name</label>
        <input type="text" id="company_name" name="company_name" value="<?= e($value('company_name')) ?>" required>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="contact_person">Contact person</label>
        <input type="text" id="contact_person" name="contact_person" value="<?= e($value('contact_person')) ?>">
      </div>
      <div class="field">
        <label for="phone">Phone</label>
        <input type="text" id="phone" name="phone" value="<?= e($value('phone')) ?>">
      </div>
    </div>

    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" value="<?= e($value('email')) ?>">
    </div>

    <?php if (!$party): ?>
      <div class="field-row">
        <div class="field">
          <label for="password">Temporary password</label>
          <input type="password" id="password" name="password" autocomplete="new-password" required>
          <span class="hint">At least 8 characters. They'll be asked to change it on first sign-in.</span>
        </div>
        <div class="field">
          <label for="confirm_password">Confirm password</label>
          <input type="password" id="confirm_password" name="confirm_password" autocomplete="new-password" required>
        </div>
      </div>
    <?php endif; ?>

    <div class="field">
      <label><input type="checkbox" name="is_active" value="1" <?= (int) $value('is_active', 1) === 1 ? 'checked' : '' ?>>
        Account active</label>
    </div>

    <button type="submit" class="btn btn-primary"><?= $party ? 'Save changes' : 'Create account' ?></button>
  </form>
</div>

<?php if ($party): ?>
  <div class="card" style="max-width:700px;">
    <h2>Reset password</h2>
    <p class="hint">
      Parties cannot reset their own password. Set a new one here and pass it on —
      they'll be prompted to choose their own after signing in.
    </p>
    <form method="post" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="reset_password">
      <div class="field-row">
        <div class="field">
          <label for="new_password">New password</label>
          <input type="password" id="new_password" name="new_password" autocomplete="new-password" required>
        </div>
        <div class="field">
          <label for="confirm_reset">Confirm password</label>
          <input type="password" id="confirm_reset" name="confirm_password" autocomplete="new-password" required>
        </div>
      </div>
      <button type="submit" class="btn btn-outline">Reset password</button>
    </form>
  </div>
<?php endif; ?>

<?php layout_footer(); ?>
