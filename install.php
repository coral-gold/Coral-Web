<?php
/**
 * One-time web installer.
 *
 * Lets Coral Gold set the site up entirely from a browser: enter the MySQL
 * details, and this writes includes/config.php on the server, creates the
 * tables and loads the starting data.
 *
 * It exists so the database password never has to be committed to the
 * repository — it is typed here and stored only on the server.
 *
 * The page refuses to run once includes/config.php exists, so it becomes
 * inert the moment installation succeeds.
 */

declare(strict_types=1);

define('CORAL_ROOT', __DIR__);

$configFile = __DIR__ . '/includes/config.php';
$installed  = is_file($configFile);

$errors = [];
$notices = [];
$generatedConfig = null;

/** Splits a .sql file into individual statements. */
function sql_statements(string $path): array
{
    $sql = (string) file_get_contents($path);
    $lines = preg_split('/\r?\n/', $sql) ?: [];
    $clean = [];
    foreach ($lines as $line) {
        $trimmed = ltrim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '--')) {
            continue;
        }
        $clean[] = $line;
    }
    $statements = explode(';', implode("\n", $clean));
    return array_values(array_filter(array_map('trim', $statements), static fn($s) => $s !== ''));
}

function config_contents(array $db, string $baseUrl): string
{
    return "<?php\n"
        . "/**\n"
        . " * Written by install.php. Holds live database credentials —\n"
        . " * deliberately excluded from git via .gitignore.\n"
        . " */\n\n"
        . "return [\n"
        . "    'db' => [\n"
        . "        'host'    => " . var_export($db['host'], true) . ",\n"
        . "        'name'    => " . var_export($db['name'], true) . ",\n"
        . "        'user'    => " . var_export($db['user'], true) . ",\n"
        . "        'pass'    => " . var_export($db['pass'], true) . ",\n"
        . "        'charset' => 'utf8mb4',\n"
        . "    ],\n\n"
        . "    'app' => [\n"
        . "        'base_url'             => " . var_export($baseUrl, true) . ",\n"
        . "        'quotation_prefix'     => 'CG-Q-',\n"
        . "        'company_name'         => 'Coral Gold',\n"
        . "        'session_name'         => 'coral_session',\n"
        . "        'session_idle_minutes' => 120,\n"
        . "    ],\n\n"
        . "    'security' => [\n"
        . "        'max_login_attempts' => 5,\n"
        . "        'lockout_minutes'    => 15,\n"
        . "    ],\n"
        . "];\n";
}

$form = [
    'host'     => $_POST['host']     ?? 'localhost',
    'name'     => trim((string) ($_POST['name'] ?? '')),
    'user'     => trim((string) ($_POST['user'] ?? '')),
    'pass'     => (string) ($_POST['pass'] ?? ''),
    'base_url' => trim((string) ($_POST['base_url'] ?? '')),
];

if (!$installed && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if ($form['name'] === '' || $form['user'] === '') {
        $errors[] = 'Please fill in the database name and username.';
    }

    if (!$errors) {
        try {
            $pdo = new PDO(
                sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $form['host'], $form['name']),
                $form['user'],
                $form['pass'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
        } catch (PDOException $e) {
            $pdo = null;
            $errors[] = 'Could not connect to the database. Check the four values and try again. '
                . 'MySQL said: ' . $e->getMessage();
        }

        if (isset($pdo) && $pdo instanceof PDO) {
            // schema.sql uses CREATE TABLE IF NOT EXISTS and seed.sql uses
            // INSERT IGNORE / ON DUPLICATE KEY, so re-running is harmless.
            foreach (['schema', 'seed'] as $file) {
                $path = __DIR__ . '/sql/' . $file . '.sql';
                if (!is_file($path)) {
                    $errors[] = 'Missing sql/' . $file . '.sql — the deploy looks incomplete.';
                    break;
                }
                try {
                    foreach (sql_statements($path) as $statement) {
                        $pdo->exec($statement);
                    }
                    $notices[] = $file === 'schema' ? 'Tables created.' : 'Starting catalogue and website text loaded.';
                } catch (PDOException $e) {
                    $errors[] = 'Error running sql/' . $file . '.sql: ' . $e->getMessage();
                    break;
                }
            }
        }
    }

    if (!$errors) {
        $baseUrl = rtrim($form['base_url'], '/');
        $contents = config_contents($form, $baseUrl);

        if (@file_put_contents($configFile, $contents) !== false) {
            @chmod($configFile, 0640);
            header('Location: admin/setup.php');
            exit;
        }

        // Could not write — hand them the file contents to paste instead.
        $generatedConfig = $contents;
        $errors[] = 'The database is ready, but this page could not write includes/config.php '
            . '(the folder is not writable). Create that file yourself using the text below, then reload this page.';
    }
}

$selfUrl = htmlspecialchars((string) ($_SERVER['PHP_SELF'] ?? '/install.php'), ENT_QUOTES);
function h($v): string { return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Set up Coral Gold</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/app.css">
</head>
<body class="auth-page">
<div class="auth-card" style="max-width:520px">
  <a class="auth-logo" href="index.html">
    <img src="assets/logo.png" alt="Coral — A Signature Touch of Coral" width="900" height="341">
  </a>

<?php if ($installed): ?>
  <h1>Already set up</h1>
  <p class="auth-sub">
    This site is configured, so the installer is switched off.
  </p>
  <p class="auth-note">
    <a href="admin/">Go to the admin panel</a> &middot; <a href="index.html">View the website</a>
  </p>
  <p class="auth-note">
    To run the installer again you would have to delete
    <code>includes/config.php</code> on the server first.
  </p>

<?php else: ?>
  <h1>Set up Coral Gold</h1>
  <p class="auth-sub">
    Enter your MySQL details once. They are saved on this server only — never
    in the code repository.
  </p>

  <?php foreach ($errors as $error): ?>
    <div class="alert alert-error"><?= h($error) ?></div>
  <?php endforeach; ?>
  <?php foreach ($notices as $notice): ?>
    <div class="alert alert-success"><?= h($notice) ?></div>
  <?php endforeach; ?>

  <?php if ($generatedConfig !== null): ?>
    <p style="font-size:.86rem">Create <code>includes/config.php</code> in File Manager and paste this in:</p>
    <textarea readonly rows="12" style="width:100%;font-family:monospace;font-size:.78rem"><?= h($generatedConfig) ?></textarea>
  <?php endif; ?>

  <form method="post" novalidate>
    <div class="field">
      <label for="host">Database host</label>
      <input type="text" id="host" name="host" value="<?= h($form['host']) ?>" required>
      <span class="hint">On Hostinger this is <code>localhost</code>.</span>
    </div>
    <div class="field">
      <label for="name">Database name</label>
      <input type="text" id="name" name="name" value="<?= h($form['name']) ?>" placeholder="u000000000_coral" required>
    </div>
    <div class="field">
      <label for="user">Database username</label>
      <input type="text" id="user" name="user" value="<?= h($form['user']) ?>" placeholder="u000000000_admin" required>
    </div>
    <div class="field">
      <label for="pass">Database password</label>
      <input type="password" id="pass" name="pass" value="<?= h($form['pass']) ?>" autocomplete="off">
    </div>
    <div class="field">
      <label for="base_url">Website address</label>
      <input type="text" id="base_url" name="base_url" value="<?= h($form['base_url']) ?>" placeholder="https://coralgold.in">
      <span class="hint">Optional — leave empty and it is detected automatically.</span>
    </div>

    <button type="submit" class="btn btn-primary btn-block">Connect and create tables</button>
  </form>

  <p class="auth-note">
    This creates the nine tables, loads the four categories and five product
    photos, then takes you on to create your admin login.
  </p>
<?php endif; ?>
</div>
</body>
</html>
