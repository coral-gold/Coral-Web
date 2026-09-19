<?php require '../functions.php'; session_start_custom();
if (!is_logged_in() || !isset($_SESSION['party_id'])) redirect('login.php');
$products = db_all('SELECT * FROM products LIMIT 50');
?>
<!DOCTYPE html>
<html>
<head><title>Catalogue</title>
<style>body{font-family:Georgia,serif;margin:20px;} .product{border:1px solid #ddd;padding:10px;margin:10px 0;} .weights{font-size:18px;font-weight:bold;color:#8b0000;} .qty{font-size:12px;}</style>
</head>
<body>
<h1>Catalog - Weights First</h1>
<a href="logout.php">Logout</a> | <a href="my-quotations.php">My Quotations</a> | <a href="#" onclick="showQuotation()">View Quotation</a>
<hr>
<?php foreach($products as $p): ?>
<div class="product">
<strong><?= e($p['design_number']) ?></strong><br>
<div class="weights">Gross: <?= e($p['gross_weight']) ?>g | Net: <?= e($p['net_weight']) ?>g</div>
<small><?= e($p['jewel_code']) ?></small><br>
<span class="qty">Qty: <?= e($p['quantity']) ?></span><br>
<button onclick="addToQuotation(<?= $p['id'] ?>)">Add</button>
</div>
<?php endforeach; ?>
<script>
function addToQuotation(id) {
  fetch('api/add-to-quotation.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'product_id=' + id
  }).then(r => r.json()).then(d => alert('Added!'));
}
function showQuotation() {
  fetch('api/quotation.php').then(r => r.json()).then(d => {
    alert('Items: ' + d.items + '\nPieces: ' + d.pieces);
  });
}
</script>
</body></html>
