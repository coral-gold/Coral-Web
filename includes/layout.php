<?php
declare(strict_types=1);

function layout_head(string $title, string $section = 'public'): void {
    $cssUrl = url('css/style.css');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold</title>
<link rel="stylesheet" href="{$cssUrl}">
</head>
<body class="section-{$section}">
HTML;
    // Public nav
    if ($section === 'public') {
        echo '<header class="site-header"><div class="container">';
        echo '<a class="logo" href="' . url() . '">✨ Coral Gold</a>';
        echo '<nav>';
        echo '<a href="' . url('public/home.php') . '">Home</a>';
        echo '<a href="' . url('public/about.php') . '">About</a>';
        echo '<a href="' . url('public/catalog.php') . '">Catalog</a>';
        echo '<a href="' . url('public/contact.php') . '">Contact</a>';
        echo '<a href="' . url('wholesaler/login.php') . '" class="btn-login">Wholesaler Login</a>';
        echo '</nav></div></header>';
    }
}

function layout_foot(): void {
    echo <<<HTML
<footer class="site-footer">
  <div class="container">
    <p>&copy; 2026 Coral Gold. All rights reserved.</p>
  </div>
</footer>
</body></html>
HTML;
}

function wholesaler_layout_head(string $title): void {
    $cssUrl = url('css/style.css');
    $party  = current_party();
    $count  = cart_count($party['id'] ?? 0);
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold</title>
<link rel="stylesheet" href="{$cssUrl}">
</head>
<body class="section-wholesaler">
<header class="site-header">
  <div class="container">
    <a class="logo" href="#">✨ Coral Gold</a>
    <nav>
      <a href="catalogue.php">Catalogue</a>
      <a href="my-quotations.php">My Quotations</a>
      <a href="logout.php">Logout</a>
    </nav>
  </div>
</header>
HTML;
}

function admin_layout_head(string $title): void {
    $cssUrl = url('css/style.css');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold Admin</title>
<link rel="stylesheet" href="{$cssUrl}">
</head>
<body class="section-admin">
<header class="admin-header">
  <div class="container">
    <a class="logo" href="dashboard.php">⚙ Coral Gold Admin</a>
    <nav>
      <a href="dashboard.php">Dashboard</a>
      <a href="categories.php">Categories</a>
      <a href="products.php">Products</a>
      <a href="import.php">Import</a>
      <a href="parties.php">Parties</a>
      <a href="quotations.php">Quotations</a>
      <a href="content.php">Content</a>
      <a href="logout.php">Logout</a>
    </nav>
  </div>
</header>
HTML;
}

function layout_foot_simple(): void {
    echo '</body></html>';
}
