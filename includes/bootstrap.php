<?php
declare(strict_types=1);

// Load config — created by install.php, never committed
$cfg = __DIR__ . '/config.php';
if (!file_exists($cfg)) {
    header('Location: ' . (str_contains($_SERVER['REQUEST_URI'] ?? '', 'install.php') ? '' : '/install.php'));
    exit;
}
require_once $cfg;

// Auto-load vendor
$auto = __DIR__ . '/../vendor/autoload.php';
if (file_exists($auto)) require_once $auto;

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';

session_boot();
