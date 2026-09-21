<?php
declare(strict_types=1);

function _font_link(): string {
    return '<link rel="preconnect" href="https://fonts.googleapis.com">'
         . '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap">';
}

function _custom_styles(): string {
    $garnet = get_content('primary_color');
    $gold   = get_content('accent_color');
    $css    = '';
    if ($garnet) $css .= '--garnet:' . e($garnet) . ';--garnet2:' . e($garnet) . ';';
    if ($gold)   $css .= '--gold:'   . e($gold)   . ';--gold2:'   . e($gold)   . ';';
    return $css ? "<style>:root{{$css}}</style>" : '';
}

function _logo_html(string $fallback, string $href): string {
    $logo = get_content('site_logo');
    if ($logo) {
        $src = url(ltrim($logo, '/'));
        return '<a class="logo" href="' . $href . '"><img src="' . e($src) . '" alt="Coral Gold" style="height:40px;vertical-align:middle"></a>';
    }
    return '<a class="logo" href="' . $href . '">' . $fallback . '</a>';
}

function layout_head(string $title, string $section = 'public'): void {
    $cssUrl  = url('css/style.css');
    $fonts   = _font_link();
    $customs = _custom_styles();
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold</title>
{$fonts}
<link rel="stylesheet" href="{$cssUrl}">
{$customs}
</head>
<body class="section-{$section}">
HTML;
    if ($section === 'public') {
        echo '<header class="site-header"><div class="container">';
        echo _logo_html('✦ Coral Gold', url());
        echo '<nav>';
        echo '<a href="' . url('public/home.php') . '">Home</a>';
        echo '<a href="' . url('public/about.php') . '">About</a>';
        echo '<a href="' . url('public/catalog.php') . '">Catalogue</a>';
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
    $cssUrl  = url('css/style.css');
    $fonts   = _font_link();
    $customs = _custom_styles();
    $party   = current_party();
    $count   = cart_count((int)($party['id'] ?? 0));
    $logoHtml = _logo_html('✦ Coral Gold', 'catalogue.php');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold</title>
{$fonts}
<link rel="stylesheet" href="{$cssUrl}">
{$customs}
</head>
<body class="section-wholesaler">
<header class="site-header">
  <div class="container">
    {$logoHtml}
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
    $fonts  = _font_link();
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title} – Coral Gold Admin</title>
{$fonts}
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
