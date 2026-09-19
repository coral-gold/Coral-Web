<?php
/**
 * Authentication for both audiences:
 *   - parties (wholesalers)  → the order section
 *   - admins  (Coral staff)  → the admin panel
 *
 * Passwords are always stored with password_hash() and checked with
 * password_verify() (SRS 6.1). Repeated failures are throttled (SRS 4.1).
 */

declare(strict_types=1);

// ------------------------------------------------------------- throttling
/**
 * Failed attempts inside the lockout window, counted separately for the
 * account and for the IP.
 *
 * They are deliberately not pooled: several wholesalers can share one
 * connection (an exhibition hall, an office NAT), so a handful of failures
 * from one address must not lock every other party out. The account
 * threshold stops guessing at a single login; the much higher IP threshold
 * stops someone spraying many accounts from one machine.
 */
function login_failure_counts(string $scope, string $identifier, string $ip): array
{
    $minutes = (int) config('security.lockout_minutes', 15);
    $row = db_one(
        'SELECT
            SUM(identifier = ?) AS by_identifier,
            SUM(ip_address = ?) AS by_ip
           FROM login_attempts
          WHERE scope = ?
            AND succeeded = 0
            AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
        [mb_strtolower($identifier), $ip, $scope, $minutes]
    );

    return [
        'identifier' => (int) ($row['by_identifier'] ?? 0),
        'ip'         => (int) ($row['by_ip'] ?? 0),
    ];
}

function login_is_locked(string $scope, string $identifier): bool
{
    $max = (int) config('security.max_login_attempts', 5);
    $counts = login_failure_counts($scope, $identifier, client_ip());

    return $counts['identifier'] >= $max || $counts['ip'] >= $max * 4;
}

function login_record_attempt(string $scope, string $identifier, bool $succeeded): void
{
    db_run(
        'INSERT INTO login_attempts (scope, identifier, ip_address, succeeded) VALUES (?, ?, ?, ?)',
        [$scope, mb_strtolower(substr($identifier, 0, 64)), client_ip(), $succeeded ? 1 : 0]
    );

    if ($succeeded) {
        db_run(
            'DELETE FROM login_attempts WHERE scope = ? AND identifier = ? AND succeeded = 0',
            [$scope, mb_strtolower(substr($identifier, 0, 64))]
        );
    }
}

// ----------------------------------------------------------------- party
function party_attempt_login(string $partyCode, string $password): bool
{
    $party = db_one('SELECT * FROM parties WHERE party_code = ?', [$partyCode]);

    // password_verify against a dummy hash keeps the timing similar whether
    // or not the account exists, so the form cannot be used to enumerate IDs.
    $hash = $party['password_hash'] ?? '$2y$12$usesomesillystringfoeoCXkJ9nB5cLqHrjZFeZO1ub6Z2fhB0Ge';
    $ok = password_verify($password, $hash);

    if (!$party || !$ok || (int) $party['is_active'] !== 1) {
        login_record_attempt('party', $partyCode, false);
        return false;
    }

    login_record_attempt('party', $partyCode, true);
    session_regenerate_id(true);
    $_SESSION['party_id'] = (int) $party['id'];
    $_SESSION['last_activity'] = time();
    return true;
}

function current_party(): ?array
{
    static $party = null;
    if ($party !== null) {
        return $party;
    }
    if (empty($_SESSION['party_id'])) {
        return null;
    }
    $found = db_one('SELECT * FROM parties WHERE id = ? AND is_active = 1', [(int) $_SESSION['party_id']]);
    if (!$found) {
        // Account disabled or removed mid-session.
        unset($_SESSION['party_id']);
        return null;
    }
    return $party = $found;
}

function require_party(): array
{
    $party = current_party();
    if (!$party) {
        flash('error', 'Please sign in to continue.');
        redirect(url('login.php'));
    }
    // A freshly created or reset account must set its own password first.
    $script = basename((string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    if ((int) $party['must_change_password'] === 1 && $script !== 'password.php' && $script !== 'logout.php') {
        redirect(url('order/password.php'));
    }
    return $party;
}

function party_logout(): void
{
    unset($_SESSION['party_id']);
    session_regenerate_id(true);
}

// ----------------------------------------------------------------- admin
function admin_attempt_login(string $username, string $password): bool
{
    $admin = db_one('SELECT * FROM admins WHERE username = ?', [$username]);
    $hash = $admin['password_hash'] ?? '$2y$12$usesomesillystringfoeoCXkJ9nB5cLqHrjZFeZO1ub6Z2fhB0Ge';
    $ok = password_verify($password, $hash);

    if (!$admin || !$ok) {
        login_record_attempt('admin', $username, false);
        return false;
    }

    login_record_attempt('admin', $username, true);
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['last_activity'] = time();
    return true;
}

function current_admin(): ?array
{
    static $admin = null;
    if ($admin !== null) {
        return $admin;
    }
    if (empty($_SESSION['admin_id'])) {
        return null;
    }
    $found = db_one('SELECT * FROM admins WHERE id = ?', [(int) $_SESSION['admin_id']]);
    if (!$found) {
        unset($_SESSION['admin_id']);
        return null;
    }
    return $admin = $found;
}

function require_admin(): array
{
    $admin = current_admin();
    if (!$admin) {
        flash('error', 'Please sign in to continue.');
        redirect(url('admin/index.php'));
    }
    return $admin;
}

function admin_logout(): void
{
    unset($_SESSION['admin_id']);
    session_regenerate_id(true);
}

function admin_count(): int
{
    $row = db_one('SELECT COUNT(*) AS total FROM admins');
    return (int) ($row['total'] ?? 0);
}

function hash_password(string $plain): string
{
    return password_hash($plain, PASSWORD_DEFAULT);
}

/** Shared password policy for both admins and parties. */
function password_problem(string $password, string $confirm): ?string
{
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters long.';
    }
    if ($password !== $confirm) {
        return 'The two passwords do not match.';
    }
    return null;
}
