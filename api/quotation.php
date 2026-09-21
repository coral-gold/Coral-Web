<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/order.php';
require_once __DIR__ . '/../includes/quotation_pdf.php';

$party = current_party();
if (!$party) {
    // Allow GET download (party must be logged in via session)
    header('Location: ' . url('wholesaler/login.php'));
    exit;
}
$pid = (int)$party['id'];

// GET: download PDF
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = get('action');
    $qid    = get_int('id');
    if ($action === 'pdf' && $qid > 0) {
        // Verify ownership
        $q = db_one('SELECT * FROM quotations WHERE id=? AND party_id=?', [$qid, $pid]);
        if (!$q) {
            http_response_code(404);
            exit('Quotation not found.');
        }
        $content = generate_quotation_pdf($qid);
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . e($q['quotation_number']) . '.pdf"');
        header('Content-Length: ' . strlen($content));
        echo $content;
        exit;
    }
    json_out(['ok' => false, 'error' => 'Unknown action'], 400);
}

// POST: generate new quotation
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'generate') {
        $notes = trim((string)($body['notes'] ?? ''));
        $qid   = create_quotation($pid, $notes);
        if (!$qid) {
            json_out(['ok' => false, 'error' => 'Cart is empty.']);
        }
        $q = db_one('SELECT quotation_number FROM quotations WHERE id=?', [$qid]);
        json_out([
            'ok'     => true,
            'id'     => $qid,
            'number' => $q['quotation_number'],
            'pdfUrl' => url('api/quotation.php') . '?action=pdf&id=' . $qid,
        ]);
    }

    json_out(['ok' => false, 'error' => 'Unknown action'], 400);
}

json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
