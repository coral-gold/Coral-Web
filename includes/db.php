<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = defined('DB_HOST') ? DB_HOST : 'localhost';
        $name = defined('DB_NAME') ? DB_NAME : '';
        $user = defined('DB_USER') ? DB_USER : '';
        $pass = defined('DB_PASS') ? DB_PASS : '';
        $pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function db_one(string $sql, array $p = []): ?array {
    $s = db()->prepare($sql); $s->execute($p);
    return $s->fetch() ?: null;
}

function db_all(string $sql, array $p = []): array {
    $s = db()->prepare($sql); $s->execute($p);
    return $s->fetchAll();
}

function db_run(string $sql, array $p = []): PDOStatement {
    $s = db()->prepare($sql); $s->execute($p);
    return $s;
}

function db_insert(string $sql, array $p = []): int {
    db_run($sql, $p);
    return (int) db()->lastInsertId();
}
