<?php
declare(strict_types=1);

function e(mixed $v): string {
    return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $url): never {
    header('Location: ' . $url); exit;
}

function url(string $path = ''): string {
    $base = rtrim(defined('BASE_URL') ? BASE_URL : '', '/');
    return $base . '/' . ltrim($path, '/');
}

function is_post(): bool { return $_SERVER['REQUEST_METHOD'] === 'POST'; }

function post(string $key, mixed $default = ''): string {
    return trim((string)($_POST[$key] ?? $default));
}

function post_int(string $key, int $default = 0): int {
    return (int)($_POST[$key] ?? $default);
}

function get(string $key, string $default = ''): string {
    return trim((string)($_GET[$key] ?? $default));
}

function get_int(string $key, int $default = 0): int {
    return (int)($_GET[$key] ?? $default);
}

function flash(string $type, string $msg): void {
    $_SESSION['flash'] = ['type' => $type, 'msg' => $msg];
}

function flash_html(): string {
    if (empty($_SESSION['flash'])) return '';
    $f = $_SESSION['flash'];
    unset($_SESSION['flash']);
    $cls = $f['type'] === 'success' ? 'alert-success' : 'alert-error';
    return '<div class="alert ' . $cls . '">' . e($f['msg']) . '</div>';
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_verify(): void {
    $token = post('_csrf') ?: ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!hash_equals(csrf_token(), $token)) {
        http_response_code(403); die('CSRF check failed.');
    }
}

function json_out(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function weight(mixed $v): string {
    if ($v === null || $v === '') return '—';
    $n = (float)$v;
    return rtrim(rtrim(number_format($n, 3), '0'), '.');
}
