<?php
/**
 * Shared chrome for the two authenticated areas (order section + admin).
 * Uses the same brand tokens as the public site so everything looks like
 * one product (SRS 2.2).
 */

declare(strict_types=1);

function layout_header(string $title, string $area = 'order', array $nav = [], string $activeKey = ''): void
{
    $party = $area === 'order' ? current_party() : null;
    $admin = $area === 'admin' ? current_admin() : null;
    ?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> | Coral</title>
<link rel="icon" type="image/svg+xml" href="<?= e(url('assets/favicon.svg')) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('css/app.css')) ?>">
</head>
<body class="app app-<?= e($area) ?>">
<header class="app-header">
  <div class="app-header-inner">
    <a class="app-brand" href="<?= e(url($area === 'admin' ? 'admin/dashboard.php' : 'order/index.php')) ?>">
      <img src="<?= e(url('assets/logo.png')) ?>" alt="Coral" width="900" height="341">
      <span class="app-area-tag"><?= $area === 'admin' ? 'Admin' : 'Wholesaler' ?></span>
    </a>

    <button class="app-nav-toggle" id="appNavToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="appNav">
      <span></span><span></span><span></span>
    </button>

    <nav class="app-nav" id="appNav">
      <?php foreach ($nav as $key => $item): ?>
        <a href="<?= e($item['href']) ?>"<?= $key === $activeKey ? ' class="is-active"' : '' ?>>
          <?= e($item['label']) ?>
          <?php if (!empty($item['badge'])): ?><span class="app-badge"><?= e($item['badge']) ?></span><?php endif; ?>
        </a>
      <?php endforeach; ?>
      <span class="app-user">
        <?php if ($party): ?>
          <?= e($party['company_name']) ?>
        <?php elseif ($admin): ?>
          <?= e($admin['name'] !== '' ? $admin['name'] : $admin['username']) ?>
        <?php endif; ?>
      </span>
      <a class="app-logout" href="<?= e(url($area === 'admin' ? 'admin/logout.php' : 'logout.php')) ?>">Sign out</a>
    </nav>
  </div>
</header>

<main class="app-main">
  <div class="app-container">
<?php
    $error = take_flash('error');
    $success = take_flash('success');
    if ($error !== null) {
        echo '<div class="alert alert-error" role="alert">' . e($error) . '</div>';
    }
    if ($success !== null) {
        echo '<div class="alert alert-success" role="status">' . e($success) . '</div>';
    }
}

function layout_footer(): void
{
    ?>
  </div>
</main>

<footer class="app-footer">
  <div class="app-container">
    <p>&copy; <?= date('Y') ?> Coral. A Signature Touch of Coral.</p>
  </div>
</footer>

<script>
(function () {
  var toggle = document.getElementById('appNavToggle');
  var nav = document.getElementById('appNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();
</script>
</body>
</html>
<?php
}

/** Minimal chrome for the two login screens. */
function layout_auth_header(string $title): void
{
    ?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> | Coral</title>
<link rel="icon" type="image/svg+xml" href="<?= e(url('assets/favicon.svg')) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('css/app.css')) ?>">
</head>
<body class="auth-page">
<div class="auth-card">
  <a class="auth-logo" href="<?= e(url('index.html')) ?>">
    <img src="<?= e(url('assets/logo.png')) ?>" alt="Coral — A Signature Touch of Coral" width="900" height="341">
  </a>
<?php
    $error = take_flash('error');
    $success = take_flash('success');
    if ($error !== null) {
        echo '<div class="alert alert-error" role="alert">' . e($error) . '</div>';
    }
    if ($success !== null) {
        echo '<div class="alert alert-success" role="status">' . e($success) . '</div>';
    }
}

function layout_auth_footer(): void
{
    ?>
</div>
</body>
</html>
<?php
}
