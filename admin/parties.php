<?php require '../functions.php'; session_start_custom(); if (!is_admin()) die('Denied'); echo '<h1><?= ucfirst(parties) ?></h1>'; echo '<a href="dashboard.php">Back</a>'; ?>
