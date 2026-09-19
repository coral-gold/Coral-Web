<?php
/** PDF download of a quotation, restricted to the party that owns it. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/order.php';
require_once __DIR__ . '/../includes/quotation_pdf.php';

$party = require_party();

$quotation = load_quotation((int) get_str('id', '0'), (int) $party['id']);
if (!$quotation) {
    http_response_code(404);
    exit('Quotation not found.');
}

quotation_pdf_stream($quotation);
