<?php
require_once __DIR__ . '/includes/bootstrap.php';

party_logout();
flash('success', 'You have been signed out.');
redirect(url('login.php'));
