<?php require '../functions.php'; session_start_custom();
if (!is_admin()) redirect('../public/home.php');
$stats = [
    'products' => db_one('SELECT COUNT(*) as c FROM products')['c'],
    'categories' => db_one('SELECT COUNT(*) as c FROM categories')['c'],
    'parties' => db_one('SELECT COUNT(*) as c FROM parties')['c'],
    'quotations' => db_one('SELECT COUNT(*) as c FROM quotations')['c']
];
?>
<!DOCTYPE html>
<html>
<head><title>Admin Dashboard</title>
<style>body{font-family:Georgia,serif;margin:20px;}</style>
</head>
<body>
<h1>Admin Dashboard</h1>
<a href="categories.php">Categories</a> | 
<a href="products.php">Products</a> | 
<a href="parties.php">Parties</a> | 
<a href="quotations.php">Quotations</a> | 
<a href="import.php">Import</a> | 
<a href="logout.php">Logout</a>
<hr>
<p>Products: <?= $stats['products'] ?> | Categories: <?= $stats['categories'] ?> | Parties: <?= $stats['parties'] ?> | Quotations: <?= $stats['quotations'] ?></p>
</body></html>
