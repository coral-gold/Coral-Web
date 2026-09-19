<?php
require_once __DIR__ . '/../includes/bootstrap.php';

admin_logout();
flash('success', 'You have been signed out.');
redirect(url('admin/index.php'));
