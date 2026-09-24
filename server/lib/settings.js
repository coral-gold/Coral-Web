'use strict';
const db = require('../db');

const PDF_LAYOUTS = ['grid2', 'grid3', 'list'];

// Small shared helper — every place that generates a quotation PDF (the
// wholesaler's own "Generate PDF" and Admin's PDF download) needs the same
// admin-configured layout + field-visibility settings.
async function getPdfSettings() {
    const [rows] = await db.query(
        "SELECT key_name, value FROM content WHERE key_name IN ('pdf_layout','show_net_weight','show_gross_weight','show_amount')"
    );
    const raw = Object.fromEntries(rows.map(r => [r.key_name, r.value]));
    return {
        layout:          PDF_LAYOUTS.includes(raw.pdf_layout) ? raw.pdf_layout : 'grid2',
        showNetWeight:   raw.show_net_weight   !== '0',
        showGrossWeight: raw.show_gross_weight !== '0',
        showAmount:      raw.show_amount       !== '0',
    };
}

module.exports = { getPdfSettings };
