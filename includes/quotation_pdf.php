<?php
/**
 * Renders a saved quotation to PDF with DomPDF.
 * Deliberately contains no price/rate column (SRS 4.5) — it is an item
 * request list that Coral Gold prices separately.
 */

declare(strict_types=1);

require_once CORAL_ROOT . '/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

function quotation_pdf_html(array $quotation): string
{
    $logoPath = CORAL_ROOT . '/assets/logo.png';
    $logoTag = is_file($logoPath)
        ? '<img src="' . $logoPath . '" style="height:46px;">'
        : '<div style="font-family:serif;font-size:26px;color:#6D073C;">CORAL</div>';

    $rows = '';
    $totalQty = 0;
    foreach ($quotation['items'] as $index => $item) {
        $totalQty += (int) $item['quantity'];
        $stripe = $index % 2 === 1 ? ' style="background:#FFF5F7;"' : '';
        $rows .= '<tr' . $stripe . '>'
            . '<td>' . ($index + 1) . '</td>'
            . '<td>' . e($item['name']) . '</td>'
            . '<td>' . e(fmt_text($item['design_number'])) . '</td>'
            . '<td>' . e(fmt_text($item['jewel_code'])) . '</td>'
            . '<td class="num">' . e(fmt_weight($item['gross_weight'])) . '</td>'
            . '<td class="num">' . e(fmt_weight($item['net_weight'])) . '</td>'
            . '<td class="num">' . (int) $item['quantity'] . '</td>'
            . '</tr>';
    }

    $notes = trim((string) ($quotation['notes'] ?? ''));
    $notesBlock = $notes === '' ? '' :
        '<div class="notes"><strong>Notes from party:</strong><br>' . nl2br(e($notes)) . '</div>';

    $generated = date('d M Y, H:i', strtotime((string) $quotation['created_at']));

    return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { margin: 26px 30px; }
      body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #2B1420; }
      .head { border-bottom: 2px solid #6D073C; padding-bottom: 10px; margin-bottom: 14px; }
      .head td { vertical-align: top; }
      .title { font-size: 19px; color: #6D073C; font-weight: bold; }
      .muted { color: #7A5566; font-size: 9px; }
      .meta { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
      .meta td { padding: 6px 8px; background: #FFEAEC; }
      .meta .label { color: #7A5566; font-size: 8px; text-transform: uppercase; letter-spacing: .5px; }
      .meta .value { font-size: 11px; color: #6D073C; font-weight: bold; }
      table.items { width: 100%; border-collapse: collapse; }
      table.items th { background: #6D073C; color: #FFFCED; padding: 7px 6px; text-align: left; font-size: 9px; }
      table.items td { padding: 6px; border-bottom: 1px solid #F1DDE3; }
      table.items .num { text-align: right; }
      .totals { margin-top: 12px; text-align: right; font-size: 11px; color: #6D073C; font-weight: bold; }
      .notes { margin-top: 14px; padding: 10px; background: #FBDCE2; border-radius: 4px; }
      .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #F1DDE3; color: #7A5566; font-size: 8.5px; }
    </style></head><body>

    <table class="head" width="100%"><tr>
      <td>' . $logoTag . '<div class="muted">A Signature Touch of Coral</div></td>
      <td align="right">
        <div class="title">QUOTATION</div>
        <div class="muted">' . e((string) $quotation['quotation_no']) . '</div>
      </td>
    </tr></table>

    <table class="meta"><tr>
      <td width="34%"><div class="label">Party</div><div class="value">' . e((string) $quotation['company_name']) . '</div>
        <div class="muted">ID: ' . e((string) $quotation['party_code']) . '</div></td>
      <td width="33%"><div class="label">Generated</div><div class="value">' . e($generated) . '</div></td>
      <td width="33%"><div class="label">Items / Pieces</div><div class="value">' . count($quotation['items']) . ' / ' . $totalQty . '</div></td>
    </tr></table>

    <table class="items">
      <thead><tr>
        <th width="4%">#</th><th width="30%">Item</th><th width="16%">Design No.</th>
        <th width="16%">Jewel Code</th><th width="11%" class="num">Gross Wt.</th>
        <th width="11%" class="num">Net Wt.</th><th width="8%" class="num">Qty</th>
      </tr></thead>
      <tbody>' . $rows . '</tbody>
    </table>

    <div class="totals">Total pieces: ' . $totalQty . '</div>
    ' . $notesBlock . '

    <div class="foot">
      This quotation lists requested items only. Rates are not included and are
      confirmed separately by Coral Gold. Generated automatically from the
      wholesaler order portal.
    </div>
    </body></html>';
}

/** Streams the PDF to the browser as a download. */
function quotation_pdf_stream(array $quotation): void
{
    $options = new Options();
    $options->set('isRemoteEnabled', false);
    $options->set('chroot', CORAL_ROOT);
    $options->set('defaultFont', 'DejaVu Sans');

    $dompdf = new Dompdf($options);
    $dompdf->loadHtml(quotation_pdf_html($quotation), 'UTF-8');
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();
    $dompdf->stream((string) $quotation['quotation_no'] . '.pdf', ['Attachment' => true]);
    exit;
}
