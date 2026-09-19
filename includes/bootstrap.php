<?php
/**
 * Loaded by every PHP entry point. Sets up config, the database handle,
 * the session, and the shared helpers.
 */

declare(strict_types=1);

define('CORAL_ROOT', dirname(__DIR__));

// ------------------------------------------------------------------ config
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    exit('Configuration missing. Copy includes/config.sample.php to includes/config.php and fill in the database details.');
}
$GLOBALS['coral_config'] = require $configFile;

function config(string $path, $default = null)
{
    $value = $GLOBALS['coral_config'];
    foreach (explode('.', $path) as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }
        $value = $value[$segment];
    }
    return $value;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';

// ----------------------------------------------------------------- session
function coral_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name((string) config('app.session_name', 'coral_session'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'secure'   => $https,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Idle expiry (SRS 6.1).
    $idleLimit = (int) config('app.session_idle_minutes', 120) * 60;
    if (isset($_SESSION['last_activity']) && (time() - (int) $_SESSION['last_activity']) > $idleLimit) {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['flash_error'] = 'Your session expired. Please sign in again.';
    }
    $_SESSION['last_activity'] = time();
}

coral_start_session();
