<?php require '../functions.php'; session_start_custom();
if (!isset($_SESSION['party_id'])) die(json_encode(['error' => 'Not logged in']));
$product_id = $_POST['product_id'] ?? 0;
$party_id = $_SESSION['party_id'];
// Add to temp quotation (in real app, store in DB or session)
$_SESSION['quotation'][] = $product_id;
echo json_encode(['success' => true]);
