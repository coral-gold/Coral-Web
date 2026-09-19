<?php
/**
 * Create / edit a party account and set its password.
 *
 * Party ID and password are set by Admin only and cannot be changed by the
 * party (batch 3, item 2). Passwords stay hashed, so an existing one can
 * never be read back — the admin sets a new one and it is shown here once,
 * ready to pass on to the wholesaler.
 */

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

    if ($action === 'set_password' && $party) {
        $password = (string) ($_POST['new_password'] ?? '');
        if (strlen($password) < 8) {
            flash('error', 'Password must be at least 8 characters long.');
        } else {
            db_run('UPDATE parties SET password_hash = ? WHERE id = ?', [hash_password($password), $id]);
            // Shown once on the next render so it can be passed to the party.
            $_SESSION['shown_password'] = ['id' => $id, 'value' => $password];
            flash('success', 'Password updated for ' . $party['company_name'] . '.');
        }
        redirect(url('admin/party-edit.php?id=' . $id));
    }

    $partyCode   = post_str('party_code');
    $companyName = post_str('company_name');
    $phone       = post_str('phone');
    $isActive    = isset($_POST['is_active']) ? 1 : 0;

    $error = null;
    if ($partyCode === '' || $companyName === '') {
        $error = 'Party ID and company name are both required.';
    }

    $newPassword = (string) ($_POST['password'] ?? '');
    if ($error === null && !$party && strlen($newPassword) < 8) {
        $error = 'Password must be at least 8 characters long.';
    }

    if ($error !== null) {
        flash('error', $error);
        redirect(url('admin/party-edit.php' . ($id > 0 ? '?id=' . $id : '')));
    }

    try {
        if ($party) {
            db_run(
                'UPDATE parties SET party_code=?, company_name=?, phone=?, is_active=? WHERE id=?',
                [$partyCode, $companyName, $phone, $isActive, $id]
            );
            flash('success', 'Party account updated.');
            redirect(url('admin/parties.php'));
        }

        db_run(
            'INSERT INTO parties (party_code, password_hash, company_name, phone, is_active)
             VALUES (?,?,?,?,?)',
            [$partyCode, hash_password($newPassword), $companyName, $phone, $isActive]
        );
        $newId = (int) db()->lastInsertId();
        $_SESSION['shown_password'] = ['id' => $newId, 'value' => $newPassword];
        flash('success', 'Party account created.');
        redirect(url('admin/party-edit.php?id=' . $newId));
    } catch (PDOException $e) {
        flash('error', 'That Party ID is already in use. Please choose a different one.');
        redirect(url('admin/party-edit.php' . ($id > 0 ? '?id=' . $id : '')));
    }
}

// A password is displayed only on the render immediately after it was set.
$shownPassword = null;
if ($party && isset($_SESSION['shown_password']) && (int) $_SESSION['shown_password']['id'] === $id) {
    $shownPassword = (string) $_SESSION['shown_password']['value'];
    unset($_SESSION['shown_password']);
}

$value = static fn(string $key, $fallback = '') => $party[$key] ?? $fallback;

layout_header($party ? 'Edit Party' : 'Add Party', 'admin', admin_nav(), 'parties');
?>

<div class="page-head">
  <div>
    <h1><?= $party ? 'Edit Party Account' : 'Add Party Account' ?></h1>
    <p>The Party ID and password the wholesaler signs in with. They cannot change either themselves.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('admin/parties.php')) ?>">&larr; Back to parties</a>
</div>

<?php if ($shownPassword !== null): ?>
  <div class="card credential-card">
    <h2>Give these to <?= e($party['company_name']) ?></h2>
    <p class="hint">Shown once. Note it down now — passwords are stored encrypted and cannot be displayed again.</p>
    <dl class="credential-pair">
      <dt>Party ID</dt><dd><?= e($party['party_code']) ?></dd>
      <dt>Password</dt><dd><?= e($shownPassword) ?></dd>
    </dl>
  </div>
<?php endif; ?>

<div class="card" style="max-width:640px;">
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

    <div class="field">
      <label for="phone">Phone</label>
      <input type="text" id="phone" name="phone" value="<?= e($value('phone')) ?>">
    </div>

    <?php if (!$party): ?>
      <div class="field">
        <label for="password">Password</label>
        <input type="text" id="password" name="password" autocomplete="off" required>
        <span class="hint">At least 8 characters. Shown back to you once after saving, so you can pass it on.</span>
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
  <div class="card" style="max-width:640px;">
    <h2>Set a new password</h2>
    <p class="hint">
      The current password cannot be displayed — it is stored encrypted, which is what keeps
      it safe if the database is ever copied. Set a new one here and it appears above once,
      ready to read out to the party.
    </p>
    <form method="post" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="set_password">
      <div class="field">
        <label for="new_password">New password</label>
        <input type="text" id="new_password" name="new_password" autocomplete="off" required>
        <span class="hint">At least 8 characters.</span>
      </div>
      <button type="submit" class="btn btn-outline">Set password</button>
    </form>
  </div>
<?php endif; ?>

<?php layout_footer(); ?>
