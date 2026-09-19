<?php
require_once 'config.php';

function db_query($sql, $params = []) {
    global $pdo;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function db_one($sql, $params = []) {
    return db_query($sql, $params)->fetch(PDO::FETCH_ASSOC);
}

function db_all($sql, $params = []) {
    return db_query($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
}

function session_start_custom() {
    session_start();
    if (empty($_SESSION['token'])) {
        $_SESSION['token'] = bin2hex(random_bytes(CSRF_TOKEN_LENGTH));
    }
    if (isset($_SESSION['last_activity']) && time() - $_SESSION['last_activity'] > SESSION_TIMEOUT) {
        session_destroy();
        return false;
    }
    $_SESSION['last_activity'] = time();
    return true;
}

function csrf_token() {
    return $_SESSION['token'] ?? '';
}

function verify_csrf($token) {
    return hash_equals(csrf_token(), $token ?? '');
}

function login_party($party_id, $password) {
    $party = db_one('SELECT * FROM parties WHERE party_id = ? AND is_active = 1', [$party_id]);
    if ($party && password_verify($password, $party['password_hash'])) {
        $_SESSION['party_id'] = $party['id'];
        $_SESSION['party'] = $party;
        return true;
    }
    return false;
}

function login_admin($username, $password) {
    if ($username === 'admin' && $password === getenv('ADMIN_PASS')) {
        $_SESSION['admin'] = true;
        return true;
    }
    return false;
}

function is_logged_in() {
    return isset($_SESSION['party_id']) || isset($_SESSION['admin']);
}

function current_party() {
    return $_SESSION['party'] ?? null;
}

function is_admin() {
    return $_SESSION['admin'] ?? false;
}

function redirect($url) {
    header("Location: $url");
    exit;
}

function json_response($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function get_quotation_number() {
    return 'CG-Q-' . str_pad(time() % 10000, 4, '0', STR_PAD_LEFT);
}

function e($text) {
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}
