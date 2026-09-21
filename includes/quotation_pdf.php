<?php
declare(strict_types=1);

use Dompdf\Dompdf;
use Dompdf\Options;

function generate_quotation_pdf(int $quotation_id): string {
    $q = db_one('SELECT q.*, p.company_name, p.party_id AS pid, p.phone
                 FROM quotations q JOIN parties p ON p.id = q.party_id
                 WHERE q.id = ?', [$quotation_id]);
    if (!$q) return '';

    $items = db_all('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id', [$quotation_id]);

    $total_gross = 0;
    $total_net   = 0;
    $total_pcs   = 0;
    $rows = '';
    foreach ($items as $i => $it) {
        $row_gross    = (float)$it['gross_weight'] * (int)$it['quantity'];
        $total_gross += $row_gross;
        $total_net   += (float)$it['net_weight'] * (int)$it['quantity'];
        $total_pcs   += (int)$it['quantity'];
        $bg = ($i % 2 === 0) ? '#ffffff' : '#fdf8f0';
        $rows .= '<tr style="background:' . $bg . '">
            <td>' . e($it['design_number']) . '</td>
            <td>' . e($it['jewel_code']) . '</td>
            <td style="font-weight:700">' . weight($it['gross_weight']) . 'g</td>
            <td>' . weight($it['net_weight']) . 'g</td>
            <td style="text-align:center">' . (int)$it['quantity'] . '</td>
            <td style="font-weight:700">' . weight($row_gross) . 'g</td>
        </tr>';
    }

    $date = date('d M Y', strtotime($q['created_at']));
    $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 20px; }
  .header { text-align: center; border-bottom: 3px solid #d4af37; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { font-size: 26px; color: #8b0000; font-weight: bold; letter-spacing: 2px; }
  .sub { font-size: 11px; color: #888; }
  .meta { display: table; width: 100%; margin-bottom: 16px; }
  .meta-left { display: table-cell; width: 60%; }
  .meta-right { display: table-cell; width: 40%; text-align: right; }
  .qnum { font-size: 18px; color: #d4af37; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #8b0000; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .totals { margin-top: 16px; text-align: right; }
  .totals table { width: auto; margin-left: auto; }
  .totals td { padding: 4px 12px; font-size: 12px; }
  .totals .label { font-weight: bold; color: #555; }
  .totals .value { color: #8b0000; font-weight: bold; }
  .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  .notes { margin-top: 12px; font-style: italic; color: #777; font-size: 10px; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">✦ CORAL GOLD</div>
  <div class="sub">Premium Wholesale Gold Jewellery</div>
</div>
<div class="meta">
  <div class="meta-left">
    <strong>Party:</strong> {$q['company_name']}<br>
    <strong>Party ID:</strong> {$q['pid']}<br>
    <strong>Phone:</strong> {$q['phone']}<br>
    <strong>Date:</strong> {$date}
  </div>
  <div class="meta-right">
    <div class="qnum">{$q['quotation_number']}</div>
    <div style="font-size:10px;color:#888;margin-top:4px">QUOTATION</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Design No.</th>
      <th>Jewel Code</th>
      <th>Gross Wt.</th>
      <th>Net Wt.</th>
      <th>Qty (Pcs)</th>
      <th>Total Gross</th>
    </tr>
  </thead>
  <tbody>
    {$rows}
  </tbody>
</table>
<div class="totals">
  <table>
    <tr><td class="label">Total Pieces:</td><td class="value">{$total_pcs}</td></tr>
    <tr><td class="label">Total Gross Weight:</td><td class="value">{$total_gross}g</td></tr>
    <tr><td class="label">Total Net Weight:</td><td class="value">{$total_net}g</td></tr>
  </table>
</div>
HTML;
    if ($q['notes']) {
        $html .= '<div class="notes"><strong>Notes:</strong> ' . e($q['notes']) . '</div>';
    }
    $html .= '<div class="footer">This is a computer generated quotation &mdash; Coral Gold &copy; ' . date('Y') . '</div></body></html>';

    $opts = new Options();
    $opts->set('isHtml5ParserEnabled', true);
    $opts->set('isRemoteEnabled', false);

    $pdf = new Dompdf($opts);
    $pdf->loadHtml($html);
    $pdf->setPaper('A4', 'portrait');
    $pdf->render();

    return $pdf->output();
}
