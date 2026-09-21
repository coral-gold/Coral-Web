<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/quotation_pdf.php';

require_admin();

$id = get_int('id');
if (!$id) { http_response_code(400); exit('Missing id'); }

$q = db_one('SELECT quotation_number FROM quotations WHERE id=?', [$id]);
if (!$q) { http_response_code(404); exit('Not found'); }

$content = generate_quotation_pdf($id);
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . $q['quotation_number'] . '.pdf"');
header('Content-Length: ' . strlen($content));
echo $content;
