'use strict';
const PDFDocument = require('pdfkit');

function fmtW(v) {
    if (v == null || v === '') return '—';
    return parseFloat(parseFloat(v).toFixed(3)).toString();
}

function generateQuotationPDF(quotation, party, items) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
        doc.on('data',  c => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = 515; // usable width (595 - 40*2)
        const L = 40;  // left margin

        // ── Header ──────────────────────────────────────────────
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#8b0000')
           .text('✶ CORAL GOLD', L, 40, { width: W, align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(10).font('Helvetica').fillColor('#888888')
           .text('Premium Wholesale Gold Jewellery', { width: W, align: 'center' });

        const lineY = doc.y + 8;
        doc.moveTo(L, lineY).lineTo(L + W, lineY).lineWidth(2.5).strokeColor('#d4af37').stroke();

        // ── Meta ─────────────────────────────────────────────────
        const metaY = lineY + 14;
        doc.fontSize(10).font('Helvetica').fillColor('#333333');
        doc.text(`Party:    ${party.company_name}`,  L, metaY);
        doc.text(`Party ID: ${party.party_id}`,      L, metaY + 14);
        doc.text(`Phone:    ${party.phone || '—'}`, L, metaY + 28);
        doc.text(`Date:     ${new Date(quotation.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, L, metaY + 42);

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#d4af37')
           .text(quotation.quotation_number, L, metaY, { width: W, align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#888888')
           .text('QUOTATION', L, metaY + 24, { width: W, align: 'right' });

        // ── Table headers ────────────────────────────────────────
        const tY = metaY + 68;
        const ROW = 18;
        const cols = [L, L+90, L+195, L+270, L+345, L+410, L+W];

        doc.rect(L, tY, W, ROW).fillColor('#8b0000').fill();
        const heads = ['Design No.', 'Jewel Code', 'Gross Wt.', 'Net Wt.', 'Qty (Pcs)', 'Total Gross'];
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
        heads.forEach((h, i) => {
            doc.text(h, cols[i] + 3, tY + 5, { width: cols[i+1] - cols[i] - 4, lineBreak: false });
        });

        // ── Table rows ───────────────────────────────────────────
        let y = tY + ROW;
        let totalGross = 0, totalNet = 0, totalPcs = 0;

        items.forEach((it, idx) => {
            const rg = parseFloat(it.gross_weight || 0) * parseInt(it.quantity || 0);
            const rn = parseFloat(it.net_weight   || 0) * parseInt(it.quantity || 0);
            totalGross += rg; totalNet += rn;
            totalPcs   += parseInt(it.quantity || 0);

            if (idx % 2 === 1) {
                doc.rect(L, y, W, ROW).fillColor('#fdf8f0').fill();
            }
            doc.fontSize(8).font('Helvetica').fillColor('#333333');
            const row = [
                it.design_number || '—',
                it.jewel_code    || '—',
                fmtW(it.gross_weight) + 'g',
                fmtW(it.net_weight)   + 'g',
                String(it.quantity),
                fmtW(rg) + 'g',
            ];
            const bold = [false, false, true, false, false, true];
            row.forEach((cell, i) => {
                if (bold[i]) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
                doc.text(cell, cols[i] + 3, y + 5, { width: cols[i+1] - cols[i] - 4, lineBreak: false });
            });
            y += ROW;
        });

        // ── Totals ───────────────────────────────────────────────
        y += 12;
        doc.fontSize(10);
        [
            ['Total Pieces:',       String(totalPcs)],
            ['Total Gross Weight:', fmtW(totalGross) + 'g'],
            ['Total Net Weight:',   fmtW(totalNet)   + 'g'],
        ].forEach(([label, value]) => {
            doc.font('Helvetica-Bold').fillColor('#555555').text(label, L + 280, y, { continued: false });
            doc.font('Helvetica-Bold').fillColor('#8b0000').text(value, L + 420, y);
            y += 16;
        });

        // ── Notes ────────────────────────────────────────────────
        if (quotation.notes) {
            y += 8;
            doc.fontSize(9).font('Helvetica-Oblique').fillColor('#777777')
               .text(`Notes: ${quotation.notes}`, L, y, { width: W });
        }

        // ── Footer ───────────────────────────────────────────────
        doc.fontSize(8).font('Helvetica').fillColor('#aaaaaa')
           .text(
               `This is a computer generated quotation — Coral Gold © ${new Date().getFullYear()}`,
               L, 790, { width: W, align: 'center' }
           );

        doc.end();
    });
}

module.exports = { generateQuotationPDF };
