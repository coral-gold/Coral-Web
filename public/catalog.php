<?php require '../functions.php'; 
$products = db_all('SELECT p.*, c.name as category FROM products p LEFT JOIN categories c ON p.category_id = c.id LIMIT 20');
?>
<!DOCTYPE html>
<html>
<head><title>Catalog</title>
<style>body{font-family:Georgia,serif;margin:20px;} .product{border:1px solid #ddd;padding:10px;margin:10px 0;}</style>
</head>
<body>
<h1>Catalog</h1>
<?php foreach($products as $p): ?>
<div class="product">
<strong><?= e($p['design_number']) ?></strong> - <?= e($p['category']) ?><br>
<small><?= e($p['jewel_code']) ?></small>
</div>
<?php endforeach; ?>
<p><a href="home.php">Back</a></p>
</body></html>
