<?php
/** Landing-page copy and contact details — SRS 5.5. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/admin_nav.php';

require_admin();

/** Grouped so the form reads like the site rather than a list of keys. */
$groups = [
    'Home page' => [
        'home_hero_eyebrow'        => ['Hero eyebrow', 'text'],
        'home_hero_heading'        => ['Hero heading', 'text'],
        'home_hero_subtext'        => ['Hero paragraph', 'textarea'],
        'home_hero_badge_number'   => ['Badge number', 'text'],
        'home_hero_badge_label'    => ['Badge label', 'text'],
        'home_cta_primary_label'   => ['Primary button label', 'text'],
        'home_cta_secondary_label' => ['Secondary button label', 'text'],
    ],
    'About Us page' => [
        'about_hero_eyebrow'        => ['Eyebrow', 'text'],
        'about_hero_heading'        => ['Heading', 'text'],
        'about_story'               => ['Brand story', 'textarea'],
        'about_mission_draft'       => ['Mission statement', 'textarea'],
        'about_vision_draft'        => ['Vision statement', 'textarea'],
        'about_facility_highlights' => ['Manufacturing highlights (one per line)', 'textarea'],
    ],
    'Wholesale page' => [
        'wholesale_hero_eyebrow' => ['Eyebrow', 'text'],
        'wholesale_hero_heading' => ['Heading', 'text'],
        'wholesale_intro'        => ['Intro paragraph', 'textarea'],
        'wholesale_min_order'    => ['Minimum order expectations', 'textarea'],
        'wholesale_capacity'     => ['Manufacturing capacity', 'textarea'],
        'wholesale_how_to_start' => ['How to start', 'textarea'],
        'wholesale_cta_label'    => ['Call-to-action button label', 'text'],
    ],
    'Contact details' => [
        'contact_address'    => ['Address', 'textarea'],
        'contact_phone'      => ['Phone (displayed)', 'text'],
        'contact_phone_href' => ['Phone link (tel:+91…)', 'text'],
        'contact_email'      => ['Email', 'text'],
        'contact_whatsapp'   => ['WhatsApp link (https://wa.me/…)', 'text'],
        'contact_hours'      => ['Business hours', 'text'],
        'contact_instagram'  => ['Instagram URL', 'text'],
        'contact_facebook'   => ['Facebook URL', 'text'],
    ],
];

if (is_post()) {
    csrf_verify();
    $values = (array) ($_POST['content'] ?? []);
    $allowed = [];
    foreach ($groups as $fields) {
        foreach ($fields as $key => $meta) {
            $allowed[$key] = true;
        }
    }

    foreach ($values as $key => $value) {
        if (!isset($allowed[$key])) {
            continue; // ignore anything not in the known field list
        }
        db_run(
            'INSERT INTO site_content (content_key, content_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE content_value = VALUES(content_value)',
            [(string) $key, (string) $value]
        );
    }

    flash('success', 'Site content updated. Changes are live immediately.');
    redirect(url('admin/content.php'));
}

$current = [];
foreach (db_all('SELECT content_key, content_value FROM site_content') as $row) {
    $current[$row['content_key']] = $row['content_value'];
}

layout_header('Site Content', 'admin', admin_nav(), 'content');
?>

<div class="page-head">
  <div>
    <h1>Site Content</h1>
    <p>Text shown on the public pages. Saving publishes straight away.</p>
  </div>
</div>

<form method="post">
  <?= csrf_field() ?>
  <?php foreach ($groups as $groupLabel => $fields): ?>
    <div class="card">
      <h2><?= e($groupLabel) ?></h2>
      <?php foreach ($fields as $key => [$label, $type]): ?>
        <div class="field">
          <label for="f_<?= e($key) ?>"><?= e($label) ?></label>
          <?php if ($type === 'textarea'): ?>
            <textarea id="f_<?= e($key) ?>" name="content[<?= e($key) ?>]" rows="3"><?= e($current[$key] ?? '') ?></textarea>
          <?php else: ?>
            <input type="text" id="f_<?= e($key) ?>" name="content[<?= e($key) ?>]" value="<?= e($current[$key] ?? '') ?>">
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endforeach; ?>

  <button type="submit" class="btn btn-primary">Save all content</button>
</form>

<?php layout_footer(); ?>
