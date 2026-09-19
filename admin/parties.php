<?php
/** Party account list with enable/disable — SRS 5.3. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

if (is_post()) {
    csrf_verify();
    $action = post_str('action');
    $id = post_int('id');

    if ($action === 'toggle') {
        db_run('UPDATE parties SET is_active = 1 - is_active WHERE id = ?', [$id]);
        flash('success', 'Party account updated.');
    }
    redirect(url('admin/parties.php'));
}

$parties = db_all(
    'SELECT p.*,
            (SELECT COUNT(*) FROM quotations q WHERE q.party_id = p.id) AS quotation_count
       FROM parties p
      ORDER BY p.company_name'
);

layout_header('Parties', 'admin', admin_nav(), 'parties');
?>

<div class="page-head">
  <div>
    <h1>Party Accounts</h1>
    <p>Wholesaler logins. Parties cannot register themselves — accounts are created here.</p>
  </div>
  <a class="btn btn-primary" href="<?= e(url('admin/party-edit.php')) ?>">+ Add party</a>
</div>

<div class="card">
  <?php if (!$parties): ?>
    <p class="empty-state">No party accounts yet. <a href="<?= e(url('admin/party-edit.php')) ?>">Create the first one</a>.</p>
  <?php else: ?>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Party ID</th><th>Company</th><th>Contact</th><th>Phone</th><th>Email</th><th>Quotations</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          <?php foreach ($parties as $party): ?>
            <tr>
              <td><strong><?= e($party['party_code']) ?></strong></td>
              <td>
                <?= e($party['company_name']) ?>
                <?php if ((int) $party['must_change_password'] === 1): ?>
                  <span class="badge badge-off">Must set password</span>
                <?php endif; ?>
              </td>
              <td><?= e(fmt_text($party['contact_person'])) ?></td>
              <td><?= e(fmt_text($party['phone'])) ?></td>
              <td><?= e(fmt_text($party['email'])) ?></td>
              <td><?= (int) $party['quotation_count'] ?></td>
              <td>
                <?php if ((int) $party['is_active'] === 1): ?>
                  <span class="badge badge-on">Active</span>
                <?php else: ?>
                  <span class="badge badge-off">Disabled</span>
                <?php endif; ?>
              </td>
              <td class="table-actions">
                <a class="btn btn-outline btn-sm" href="<?= e(url('admin/party-edit.php?id=' . (int) $party['id'])) ?>">Edit</a>
                <a class="btn btn-outline btn-sm" href="<?= e(url('admin/quotations.php?party=' . (int) $party['id'])) ?>">Quotations</a>
                <form method="post" class="inline-form">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="toggle">
                  <input type="hidden" name="id" value="<?= (int) $party['id'] ?>">
                  <button type="submit" class="btn btn-outline btn-sm">
                    <?= (int) $party['is_active'] === 1 ? 'Disable' : 'Enable' ?>
                  </button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php layout_footer(); ?>
