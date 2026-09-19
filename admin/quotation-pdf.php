<?php
/** Admin PDF download for any quotation — SRS 5.4. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/order.php';
require_once __DIR__ . '/../includes/quotation_pdf.php';

require_admin();

$quotation = load_quotation((int) get_str('id', '0'));
if (!$quotation) {
    http_response_code(404);
    exit('Quotation not found.');
}

quotation_pdf_stream($quotation);
