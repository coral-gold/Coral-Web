'use strict';
const PDFDocument = require('pdfkit');
const storage = require('./lib/storage');

function fmtW(v) {
    if (v == null || v === '') return '—';
    return parseFloat(parseFloat(v).toFixed(3)).toString();
}

// ── Layout constants ───────────────────────────────────────────────────────────
const PAGE_H   = 841.89;  // A4 points
const MARGIN   = 40;
const W        = 515;     // usable width
const L        = MARGIN;
const FOOT_Y   = PAGE_H - MARGIN - 12; // footer baseline
const SAFE_BOT = PAGE_H - MARGIN - 30; // max row y before page break

function drawPageFooter(doc, quotation) {
    doc.fontSize(8).font('Helvetica').fillColor('#aaaaaa')
       .text(
           `${quotation.quotation_number}  —  Coral Gold © ${new Date().getFullYear()}  —  Computer generated`,
           L, FOOT_Y, { width: W, align: 'center' }
       );
}

function drawTableHeader(doc, y, withImages) {
    const ROW = 18;
    const cols = withImages
        ? [L, L+46, L+136, L+236, L+306, L+376, L+436, L+W]
        : [L, L+90, L+195, L+270, L+345, L+410, L+W];
    const heads = withImages
        ? ['', 'Design No.', 'Jewel Code', 'Gross Wt.', 'Net Wt.', 'Qty', 'Total Gross']
        : ['Design No.', 'Jewel Code', 'Gross Wt.', 'Net Wt.', 'Qty (Pcs)', 'Total Gross'];

    doc.rect(L, y, W, ROW).fillColor('#8b0000').fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
    heads.forEach((h, i) => {
        doc.text(h, cols[i] + 3, y + 5, { width: cols[i + 1] - cols[i] - 4, lineBreak: false });
    });
    return y + ROW;
}

// ── Main generator ────────────────────────────────────────────────────────────
async function generateQuotationPDF(quotation, party, items, options = {}) {
    const { withImages = false, itemImages = {} } = options;
    const ROW_H = withImages ? 50 : 18;

    // Column x-positions
    const cols = withImages
        ? [L, L+46, L+136, L+236, L+306, L+376, L+436, L+W]
        : [L, L+90, L+195, L+270, L+345, L+410, L+W];

    // Pre-fetch every needed image as a Buffer before drawing starts — PDFKit's
    // synchronous drawing loop can't await mid-stream, and storage.getBuffer()
    // (S3 or local) is async either way.
    const imageBuffers = {};
    if (withImages) {
        for (const it of items) {
            const key = itemImages[it.product_id];
            if (key && imageBuffers[it.product_id] === undefined) {
                imageBuffers[it.product_id] = await storage.getBuffer(key);
            }
        }
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true });
        doc.on('data',  c => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header ────────────────────────────────────────────────
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#8b0000')
           .text('✶ CORAL GOLD', L, MARGIN, { width: W, align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(10).font('Helvetica').fillColor('#888888')
           .text('Premium Wholesale Gold Jewellery', { width: W, align: 'center' });

        const lineY = doc.y + 8;
        doc.moveTo(L, lineY).lineTo(L + W, lineY).lineWidth(2.5).strokeColor('#d4af37').stroke();

        // ── Meta ──────────────────────────────────────────────────
        const metaY = lineY + 14;
        doc.fontSize(10).font('Helvetica').fillColor('#333333');
        doc.text(`Party:    ${party.company_name}`,  L, metaY);
        doc.text(`Party ID: ${party.party_id}`,      L, metaY + 14);
        doc.text(`Phone:    ${party.phone || '—'}`,  L, metaY + 28);
        doc.text(`Date:     ${new Date(quotation.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, L, metaY + 42);

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#d4af37')
           .text(quotation.quotation_number, L, metaY, { width: W, align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#888888')
           .text('QUOTATION', L, metaY + 24, { width: W, align: 'right' });
        if (withImages) {
            doc.fontSize(8).fillColor('#777777')
               .text('WITH PRODUCT IMAGES', L, metaY + 36, { width: W, align: 'right' });
        }

        // ── Table ─────────────────────────────────────────────────
        let y = drawTableHeader(doc, metaY + 68, withImages);

        let totalGross = 0, totalNet = 0, totalPcs = 0;

        items.forEach((it, idx) => {
            const rowQty = parseInt(it.quantity || 0);
            const rg     = parseFloat(it.gross_weight || 0) * rowQty;
            const rn     = parseFloat(it.net_weight   || 0) * rowQty;
            totalGross  += rg;
            totalNet    += rn;
            totalPcs    += rowQty;

            // Page break
            if (y + ROW_H > SAFE_BOT) {
                drawPageFooter(doc, quotation);
                doc.addPage();
                y = drawTableHeader(doc, MARGIN, withImages);
            }

            // Row background
            if (idx % 2 === 1) {
                doc.rect(L, y, W, ROW_H).fillColor('#fdf8f0').fill();
            }

            // Image column
            if (withImages) {
                const buf = imageBuffers[it.product_id];
                if (buf) {
                    try {
                        doc.image(buf, L + 3, y + 5, { fit: [38, 38] });
                    } catch (_) { /* unsupported format — skip */ }
                }
            }

            // Data cells
            const cellDefs = withImages
                ? [
                    { text: it.design_number || '—',       colIdx: 1, bold: false },
                    { text: it.jewel_code    || '—',       colIdx: 2, bold: false },
                    { text: fmtW(it.gross_weight) + 'g',   colIdx: 3, bold: true  },
                    { text: fmtW(it.net_weight) + 'g',     colIdx: 4, bold: false },
                    { text: String(rowQty),                colIdx: 5, bold: false },
                    { text: fmtW(rg) + 'g',                colIdx: 6, bold: true  },
                ]
                : [
                    { text: it.design_number || '—',       colIdx: 0, bold: false },
                    { text: it.jewel_code    || '—',       colIdx: 1, bold: false },
                    { text: fmtW(it.gross_weight) + 'g',   colIdx: 2, bold: true  },
                    { text: fmtW(it.net_weight) + 'g',     colIdx: 3, bold: false },
                    { text: String(rowQty),                colIdx: 4, bold: false },
                    { text: fmtW(rg) + 'g',                colIdx: 5, bold: true  },
                ];

            const cellY = y + (ROW_H > 18 ? (ROW_H - 10) / 2 : 5);
            doc.fontSize(8).fillColor('#333333');
            cellDefs.forEach(({ text, colIdx, bold }) => {
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
                   .text(text, cols[colIdx] + 3, cellY, {
                       width: cols[colIdx + 1] - cols[colIdx] - 4,
                       lineBreak: false,
                   });
            });

            y += ROW_H;
        });

        // ── Totals ────────────────────────────────────────────────
        if (y + 60 > SAFE_BOT) {
            drawPageFooter(doc, quotation);
            doc.addPage();
            y = MARGIN + 20;
        }

        y += 14;
        [
            ['Total Pieces:',       String(totalPcs)],
            ['Total Gross Weight:', fmtW(totalGross) + 'g'],
            ['Total Net Weight:',   fmtW(totalNet)   + 'g'],
        ].forEach(([label, value]) => {
            doc.fontSize(10)
               .font('Helvetica-Bold').fillColor('#555555').text(label, L + 280, y, { continued: false });
            doc.font('Helvetica-Bold').fillColor('#8b0000').text(value, L + 420, y);
            y += 16;
        });

        // ── Notes ─────────────────────────────────────────────────
        if (quotation.notes) {
            y += 8;
            doc.fontSize(9).font('Helvetica-Oblique').fillColor('#777777')
               .text(`Notes: ${quotation.notes}`, L, y, { width: W });
        }

        // ── Footer ────────────────────────────────────────────────
        drawPageFooter(doc, quotation);
        doc.end();
    });
}

module.exports = { generateQuotationPDF };
