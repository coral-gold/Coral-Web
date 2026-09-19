<?php
declare(strict_types=1);

/** HTML-escape for output. */
function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}

// ---------------------------------------------------------------- flash
function flash(string $type, string $message): void
{
    $_SESSION['flash_' . $type] = $message;
}

function take_flash(string $type): ?string
{
    $key = 'flash_' . $type;
    if (!isset($_SESSION[$key])) {
        return null;
    }
    $message = (string) $_SESSION[$key];
    unset($_SESSION[$key]);
    return $message;
}

// ----------------------------------------------------------------- CSRF
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

/** Verifies the posted token; aborts the request if it does not match. */
function csrf_verify(): void
{
    $posted = (string) ($_POST['csrf_token'] ?? '');
    if ($posted === '' || !hash_equals(csrf_token(), $posted)) {
        http_response_code(400);
        exit('Invalid or expired form token. Please go back, reload the page and try again.');
    }
}

// ------------------------------------------------------------- requests
function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function post_str(string $key, string $default = ''): string
{
    return trim((string) ($_POST[$key] ?? $default));
}

function get_str(string $key, string $default = ''): string
{
    return trim((string) ($_GET[$key] ?? $default));
}

function post_int(string $key, int $default = 0): int
{
    return (int) ($_POST[$key] ?? $default);
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

/** Weights display as a trimmed number, or an em dash when not yet filled in. */
function fmt_weight($value): string
{
    if ($value === null || $value === '') {
        return '—';
    }
    return rtrim(rtrim(number_format((float) $value, 3, '.', ''), '0'), '.');
}

function fmt_text($value): string
{
    $value = (string) $value;
    return $value === '' ? '—' : $value;
}

/** Site root URL path prefix, so links work in a subdirectory install too. */
function base_path(): string
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }
    $configured = (string) config('app.base_url', '');
    if ($configured !== '') {
        return $base = rtrim($configured, '/');
    }
    // Derive from the script location relative to the project root.
    $scriptDir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')));
    $depth = 0;
    $scriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
    if ($scriptPath !== false) {
        $relative = trim(str_replace(str_replace('\\', '/', CORAL_ROOT), '', str_replace('\\', '/', dirname($scriptPath))), '/');
        $depth = $relative === '' ? 0 : substr_count($relative, '/') + 1;
    }
    $base = rtrim($scriptDir, '/');
    for ($i = 0; $i < $depth; $i++) {
        $base = dirname($base);
    }
    $base = rtrim(str_replace('\\', '/', $base), '/');
    return $base === '.' ? '' : $base;
}

function url(string $path = ''): string
{
    return base_path() . '/' . ltrim($path, '/');
}

function site_content(string $key, string $default = ''): string
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db_all('SELECT content_key, content_value FROM site_content') as $row) {
            $cache[$row['content_key']] = $row['content_value'];
        }
    }
    return $cache[$key] ?? $default;
}
