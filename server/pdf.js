'use strict';
const PDFDocument = require('pdfkit');
const storage = require('./lib/storage');

// ── Brand palette (Batch 16/18) ──────────────────────────────────────────────
const PRIMARY         = '#6D073C';
const PRIMARY_HOVER    = '#722343';
const SECONDARY        = '#A8476E';
const SECONDARY_LIGHT  = '#FFBCD1';
const PINK_LIGHT       = '#FBDCE2';
const PINK_PALE        = '#FFEAEC';
const OFF_WHITE        = '#F8F6F2';
const NEAR_BLACK       = '#0F0F0F';
const MID              = '#8C5568';
const BORDER           = '#F0D9E0';

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
    doc.fontSize(8).font('Helvetica').fillColor('#9a8a90')
       .text(
           `${quotation.quotation_number}  —  Coral Gold © ${new Date().getFullYear()}  —  Computer generated`,
           L, FOOT_Y, { width: W, align: 'center' }
       );
}

// ── Shared header (brand mark + party/quotation meta) ────────────────────────
function drawHeader(doc, quotation, party, withImages) {
    doc.fontSize(22).font('Helvetica-Bold').fillColor(PRIMARY)
       .text('CORAL GOLD', L, MARGIN, { width: W, align: 'center', characterSpacing: 1.5 });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').fillColor(MID)
       .text('Premium Wholesale Gold Jewellery', { width: W, align: 'center' });

    const lineY = doc.y + 8;
    doc.moveTo(L, lineY).lineTo(L + W, lineY).lineWidth(2).strokeColor(SECONDARY).stroke();

    const metaY = lineY + 14;
    doc.fontSize(10).font('Helvetica').fillColor(NEAR_BLACK);
    doc.text(`Party:    ${party.company_name}`,  L, metaY);
    doc.text(`Party ID: ${party.party_id}`,      L, metaY + 14);
    doc.text(`Phone:    ${party.phone || '—'}`,  L, metaY + 28);
    doc.text(`Date:     ${new Date(quotation.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, L, metaY + 42);

    doc.fontSize(20).font('Helvetica-Bold').fillColor(PRIMARY)
       .text(quotation.quotation_number, L, metaY, { width: W, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor(MID)
       .text('QUOTATION', L, metaY + 24, { width: W, align: 'right' });
    if (withImages) {
        doc.fontSize(8).fillColor(MID)
           .text('WITH PRODUCT IMAGES', L, metaY + 36, { width: W, align: 'right' });
    }

    return metaY + 68;
}

function drawTotalsAndNotes(doc, quotation, items, y, fields) {
    let totalGross = 0, totalNet = 0;
    items.forEach(it => {
        totalGross += parseFloat(it.gross_weight || 0);
        totalNet   += parseFloat(it.net_weight   || 0);
    });

    if (y + 80 > SAFE_BOT) {
        drawPageFooter(doc, quotation);
        doc.addPage();
        y = MARGIN + 10;
    }

    const lineY = y + 6;
    doc.moveTo(L, lineY).lineTo(L + W, lineY).lineWidth(1).strokeColor(BORDER).stroke();
    y = lineY + 14;

    const rows = [['Total Items:', String(items.length)]];
    if (fields.showGrossWeight) rows.push(['Total Gross Weight:', fmtW(totalGross) + 'g']);
    if (fields.showNetWeight)   rows.push(['Total Net Weight:',   fmtW(totalNet)   + 'g']);

    rows.forEach(([label, value]) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(MID).text(label, L + 280, y, { continued: false });
        doc.font('Helvetica-Bold').fillColor(PRIMARY).text(value, L + 420, y);
        y += 16;
    });

    if (quotation.notes) {
        y += 8;
        doc.fontSize(9).font('Helvetica-Oblique').fillColor(MID)
           .text(`Notes: ${quotation.notes}`, L, y, { width: W });
    }
}

// ── List layout (no images) ──────────────────────────────────────────────────
function drawListHeader(doc, y) {
    const ROW = 20;
    const cols = [L, L+90, L+195, L+280, L+365, L+W];
    const heads = ['Design No.', 'Jewel Code', 'Gross Wt.', 'Net Wt.', 'Remark'];

    doc.roundedRect(L, y, W, ROW, 3).fillColor(PRIMARY).fill();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
    heads.forEach((h, i) => {
        doc.text(h, cols[i] + 4, y + 6, { width: cols[i + 1] - cols[i] - 6, lineBreak: false });
    });
    return { y: y + ROW, cols };
}

function drawListBody(doc, quotation, items, startY, fields) {
    const ROW_H = 24;
    let { y, cols } = drawListHeader(doc, startY);

    items.forEach((it, idx) => {
        if (y + ROW_H > SAFE_BOT) {
            drawPageFooter(doc, quotation);
            doc.addPage();
            ({ y, cols } = drawListHeader(doc, MARGIN));
        }
        if (idx % 2 === 1) {
            doc.rect(L, y, W, ROW_H).fillColor(PINK_PALE).fill();
        }

        const cellY = y + 6;
        doc.fontSize(8.5).fillColor(NEAR_BLACK);
        doc.font('Helvetica').text(it.design_number || '—', cols[0] + 4, cellY, { width: cols[1]-cols[0]-6, lineBreak: false });
        doc.font('Helvetica').text(it.jewel_code    || '—', cols[1] + 4, cellY, { width: cols[2]-cols[1]-6, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(PRIMARY)
           .text(fields.showGrossWeight ? fmtW(it.gross_weight) + 'g' : '—', cols[2] + 4, cellY, { width: cols[3]-cols[2]-6, lineBreak: false });
        doc.font('Helvetica').fillColor(NEAR_BLACK)
           .text(fields.showNetWeight ? fmtW(it.net_weight) + 'g' : '—', cols[3] + 4, cellY, { width: cols[4]-cols[3]-6, lineBreak: false });
        if (it.remark) {
            doc.font('Helvetica-Oblique').fillColor(MID)
               .text(it.remark, cols[4] + 4, y + 4, { width: cols[5]-cols[4]-6, height: ROW_H - 6, ellipsis: true });
        }
        y += ROW_H;
    });

    drawTotalsAndNotes(doc, quotation, items, y, fields);
}

// ── Grid layout (image-forward, catalog-style cards) ─────────────────────────
function drawGridBody(doc, quotation, items, startY, cols, imageBuffers, fields) {
    const GAP    = 12;
    const cardW  = (W - GAP * (cols - 1)) / cols;
    const imgH   = cols === 2 ? 150 : 100;
    const textH  = 58;
    const pad    = 8;
    const cardH  = imgH + textH + pad * 2;

    let y = startY;
    let col = 0;

    items.forEach((it) => {
        if (col === 0 && y + cardH > SAFE_BOT) {
            drawPageFooter(doc, quotation);
            doc.addPage();
            y = MARGIN;
        }
        const x = L + col * (cardW + GAP);

        // Card shell
        doc.roundedRect(x, y, cardW, cardH, 6).fillColor('#ffffff').fill();
        doc.roundedRect(x, y, cardW, cardH, 6).lineWidth(1).strokeColor(BORDER).stroke();

        // Image (or placeholder swatch)
        const buf = imageBuffers[it.product_id];
        const imgX = x + pad, imgY = y + pad, imgW = cardW - pad * 2;
        if (buf) {
            try {
                doc.save();
                doc.roundedRect(imgX, imgY, imgW, imgH, 4).clip();
                doc.image(buf, imgX, imgY, { fit: [imgW, imgH], align: 'center', valign: 'center' });
                doc.restore();
            } catch (_) {
                doc.roundedRect(imgX, imgY, imgW, imgH, 4).fillColor(PINK_LIGHT).fill();
            }
        } else {
            doc.roundedRect(imgX, imgY, imgW, imgH, 4).fillColor(PINK_LIGHT).fill();
            doc.fontSize(8).font('Helvetica').fillColor(SECONDARY)
               .text('No Image', imgX, imgY + imgH / 2 - 4, { width: imgW, align: 'center' });
        }

        // Caption block
        let ty = imgY + imgH + 6;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(PRIMARY)
           .text(it.design_number || '—', x + pad, ty, { width: cardW - pad * 2, lineBreak: false });
        doc.fontSize(7.5).font('Helvetica').fillColor(MID)
           .text(it.jewel_code || '—', x + pad, ty + 12, { width: cardW - pad * 2, lineBreak: false });

        const weightParts = [];
        if (fields.showGrossWeight) weightParts.push(`${fmtW(it.gross_weight)}g gross`);
        if (fields.showNetWeight)   weightParts.push(`${fmtW(it.net_weight)}g net`);
        if (weightParts.length) {
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(NEAR_BLACK)
               .text(weightParts.join('  ·  '), x + pad, ty + 24, { width: cardW - pad * 2, lineBreak: false });
        }
        if (it.remark) {
            doc.fontSize(7).font('Helvetica-Oblique').fillColor(SECONDARY)
               .text(it.remark, x + pad, ty + 36, { width: cardW - pad * 2, height: 16, ellipsis: true });
        }

        col++;
        if (col >= cols) { col = 0; y += cardH + GAP; }
    });
    if (col !== 0) y += cardH + GAP;

    drawTotalsAndNotes(doc, quotation, items, y, fields);
}

// ── Main generator ────────────────────────────────────────────────────────────
// options.layout: 'grid2' | 'grid3' | 'list' — the admin Settings choice.
// A 'list' layout (or no images requested at all) always renders the plain
// table, regardless of withImages; grid2/grid3 only apply when withImages.
async function generateQuotationPDF(quotation, party, items, options = {}) {
    const { withImages = false, itemImages = {}, layout = 'grid2' } = options;
    const fields = {
        showGrossWeight: options.showGrossWeight !== false,
        showNetWeight:   options.showNetWeight   !== false,
        showAmount:      options.showAmount      !== false,
    };
    const useGrid = withImages && layout !== 'list';
    const gridCols = layout === 'grid3' ? 3 : 2;

    // Pre-fetch every needed image as a Buffer before drawing starts — PDFKit's
    // synchronous drawing loop can't await mid-stream, and storage.getBuffer()
    // (S3 or local) is async either way. A missing/failed fetch just leaves
    // that item's buffer undefined — drawGridBody renders a placeholder swatch
    // for it instead of erroring.
    const imageBuffers = {};
    if (useGrid) {
        for (const it of items) {
            const key = itemImages[it.product_id];
            if (key && imageBuffers[it.product_id] === undefined) {
                imageBuffers[it.product_id] = await storage.getBuffer(key).catch(() => null);
            }
        }
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: true });
        doc.on('data',  c => chunks.push(c));
        doc.on('end',   () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const bodyStartY = drawHeader(doc, quotation, party, useGrid);

        if (useGrid) {
            drawGridBody(doc, quotation, items, bodyStartY, gridCols, imageBuffers, fields);
        } else {
            drawListBody(doc, quotation, items, bodyStartY, fields);
        }

        drawPageFooter(doc, quotation);
        doc.end();
    });
}

module.exports = { generateQuotationPDF };
