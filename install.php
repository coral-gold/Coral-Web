<?php
declare(strict_types=1);

// Block if already installed
if (file_exists(__DIR__ . '/includes/config.php')) {
    die('<h2>Already installed.</h2><p>Delete includes/config.php to re-run the installer.</p>');
}

$err = '';
$done = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $db_host   = trim($_POST['db_host']   ?? 'localhost');
    $db_name   = trim($_POST['db_name']   ?? '');
    $db_user   = trim($_POST['db_user']   ?? '');
    $db_pass   = $_POST['db_pass']         ?? '';
    $base_url  = rtrim(trim($_POST['base_url'] ?? ''), '/');
    $adm_user  = trim($_POST['admin_user'] ?? '');
    $adm_pass  = $_POST['admin_pass']      ?? '';

    if (!$db_name || !$db_user || !$base_url || !$adm_user || !$adm_pass) {
        $err = 'All fields are required.';
    } elseif (strlen($adm_pass) < 6) {
        $err = 'Admin password must be at least 6 characters.';
    } else {
        try {
            $pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);

            // Run schema
            $schema = file_get_contents(__DIR__ . '/schema.sql');
            foreach (array_filter(array_map('trim', explode(';', $schema))) as $stmt) {
                if ($stmt) $pdo->exec($stmt);
            }

            // Create admin
            $hash = password_hash($adm_pass, PASSWORD_DEFAULT);
            $pdo->prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash=?')
                ->execute([$adm_user, $hash, $hash]);

            // Write config.php
            $config = "<?php\n"
                . "define('DB_HOST', " . var_export($db_host, true) . ");\n"
                . "define('DB_NAME', " . var_export($db_name, true) . ");\n"
                . "define('DB_USER', " . var_export($db_user, true) . ");\n"
                . "define('DB_PASS', " . var_export($db_pass, true) . ");\n"
                . "define('BASE_URL', " . var_export($base_url, true) . ");\n";

            if (file_put_contents(__DIR__ . '/includes/config.php', $config) === false) {
                $err = 'Cannot write includes/config.php. Check folder permissions.';
            } else {
                $done = true;
            }
        } catch (\PDOException $e) {
            $err = 'Database error: ' . htmlspecialchars($e->getMessage());
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coral Gold – Install</title>
<style>
  body{font-family:Georgia,serif;background:#f9f5ed;color:#333;margin:0;padding:20px}
  .box{max-width:480px;margin:40px auto;background:#fff;padding:36px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  h1{color:#8b0000;font-size:22px;margin-bottom:4px}
  .sub{color:#888;font-size:13px;margin-bottom:24px}
  label{display:block;font-size:13px;font-weight:bold;margin:12px 0 4px;color:#555}
  input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-size:14px}
  input:focus{outline:none;border-color:#d4af37}
  button{margin-top:16px;width:100%;padding:11px;background:#8b0000;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;font-family:inherit}
  button:hover{background:#6a0000}
  .err{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;padding:10px;border-radius:6px;margin-bottom:14px;font-size:14px}
  .ok{background:#d4edda;color:#155724;border:1px solid #c3e6cb;padding:12px;border-radius:6px;font-size:14px}
  .ok a{color:#155724;font-weight:bold}
</style>
</head>
<body>
<div class="box">
  <h1>✦ Coral Gold – Installer</h1>
  <div class="sub">First-time setup. This page disappears once config.php is written.</div>

  <?php if ($done): ?>
    <div class="ok">
      ✅ Installation complete!<br><br>
      <a href="admin/index.php">Go to Admin Panel →</a><br>
      <a href="public/home.php" style="margin-top:6px;display:inline-block">Go to Public Site →</a>
    </div>
  <?php else: ?>
    <?php if ($err): ?><div class="err"><?= $err ?></div><?php endif; ?>
    <form method="POST">
      <label>Database Host</label><input name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>">
      <label>Database Name</label><input name="db_name" required value="<?= htmlspecialchars($_POST['db_name'] ?? '') ?>">
      <label>Database User</label><input name="db_user" required value="<?= htmlspecialchars($_POST['db_user'] ?? '') ?>">
      <label>Database Password</label><input name="db_pass" type="password">
      <label>Base URL <small style="font-weight:normal">(e.g. https://coralgold.in)</small></label>
      <input name="base_url" required value="<?= htmlspecialchars($_POST['base_url'] ?? '') ?>">
      <label>Admin Username</label><input name="admin_user" required value="<?= htmlspecialchars($_POST['admin_user'] ?? '') ?>">
      <label>Admin Password <small style="font-weight:normal">(min 6 chars)</small></label>
      <input name="admin_pass" type="password" required>
      <button type="submit">Install Coral Gold</button>
    </form>
  <?php endif; ?>
</div>
</body>
</html>
