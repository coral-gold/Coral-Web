<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function session_boot(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.cookie_httponly', '1');
        ini_set('session.use_strict_mode', '1');
        session_start();
    }
    // Idle timeout: 2 hours
    if (isset($_SESSION['_last']) && time() - $_SESSION['_last'] > 7200) {
        session_unset(); session_destroy(); session_start();
    }
    $_SESSION['_last'] = time();
}

function current_party(): ?array {
    return $_SESSION['party'] ?? null;
}

function require_party(): array {
    $p = current_party();
    if (!$p) { redirect(url('wholesaler/login.php')); }
    return $p;
}

function is_admin(): bool {
    return !empty($_SESSION['is_admin']);
}

function require_admin(): void {
    if (!is_admin()) { redirect(url('admin/index.php')); }
}

function party_login(string $party_id, string $password): bool {
    // Throttle: max 5 attempts per 10 minutes per IP
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $key = 'login_fail_' . md5($ip);
    if (isset($_SESSION[$key]) && $_SESSION[$key]['count'] >= 5) {
        if (time() - $_SESSION[$key]['time'] < 600) return false;
        unset($_SESSION[$key]);
    }

    $row = db_one('SELECT * FROM parties WHERE party_id = ? AND is_active = 1', [$party_id]);
    if ($row && password_verify($password, $row['password_hash'])) {
        unset($_SESSION[$key]);
        session_regenerate_id(true);
        $_SESSION['party'] = $row;
        return true;
    }

    $_SESSION[$key]['count'] = ($_SESSION[$key]['count'] ?? 0) + 1;
    $_SESSION[$key]['time'] = time();
    return false;
}

function admin_login(string $username, string $password): bool {
    $row = db_one('SELECT * FROM admins WHERE username = ?', [$username]);
    if ($row && password_verify($password, $row['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['is_admin'] = true;
        $_SESSION['admin_user'] = $username;
        return true;
    }
    return false;
}

function logout(): void {
    session_unset(); session_destroy();
}
