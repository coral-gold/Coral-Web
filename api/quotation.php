<?php require '../functions.php'; session_start_custom();
if (!isset($_SESSION['party_id'])) die(json_encode(['error' => 'Not logged in']));
$items = count($_SESSION['quotation'] ?? []);
$pieces = $items;
echo json_encode(['items' => $items, 'pieces' => $pieces]);
