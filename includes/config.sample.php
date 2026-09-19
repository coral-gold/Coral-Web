<?php
/**
 * Copy this file to includes/config.php and fill in the real values.
 *
 * config.php is git-ignored on purpose: database credentials must never be
 * committed. On Hostinger, create it once through hPanel → File Manager
 * (or SFTP) inside includes/ and it will survive future deploys.
 */

return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'YOUR_DATABASE_NAME',
        'user'    => 'YOUR_DATABASE_USER',
        'pass'    => 'YOUR_DATABASE_PASSWORD',
        'charset' => 'utf8mb4',
    ],

    'app' => [
        // Absolute URL of the site root, no trailing slash. Used for links
        // inside generated PDFs and redirects. Leave '' to auto-detect.
        'base_url'         => '',
        'quotation_prefix' => 'CG-Q-',
        'company_name'     => 'Coral Gold',
        'session_name'     => 'coral_session',
        // Idle minutes before a login is expired (SRS 6.1).
        'session_idle_minutes' => 120,
    ],

    'security' => [
        // Failed logins allowed per Party ID (and per IP) inside the window
        // before further attempts are refused (SRS 4.1).
        'max_login_attempts' => 5,
        'lockout_minutes'    => 15,
    ],
];
