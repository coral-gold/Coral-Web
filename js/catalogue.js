/**
 * Coral Gold – Wholesaler Catalogue AJAX
 * Handles: category filter, search, add-to-cart, quotation panel.
 */

'use strict';

const Cart = (() => {
    let state = { lines: [], itemCount: 0, pieceCount: 0 };

    function updateBadge() {
        const el = document.getElementById('cart-count');
        if (el) el.textContent = state.pieceCount;
        const btn = document.getElementById('cart-btn');
        if (btn) btn.classList.toggle('has-items', state.pieceCount > 0);
    }

    function renderPanel() {
        const body = document.getElementById('panel-body');
        const summary = document.getElementById('panel-summary');
        const empty = document.getElementById('panel-empty');
        if (!body) return;

        if (state.lines.length === 0) {
            body.innerHTML = '';
            if (empty) empty.style.display = 'block';
            if (summary) summary.textContent = 'Your quotation is empty.';
            return;
        }
        if (empty) empty.style.display = 'none';

        let totalPcs = 0, totalGross = 0;
        let html = '';
        state.lines.forEach(line => {
            totalPcs   += line.quantity;
            totalGross += parseFloat(line.grossWeight || 0) * line.quantity;
            const img = line.image
                ? `<img src="${line.image}" class="panel-item-img" alt="">`
                : `<div class="panel-item-img-placeholder">💍</div>`;
            html += `<div class="panel-item" data-cart="${line.cartId}" data-pid="${line.productId}">
                ${img}
                <div class="panel-item-info">
                    <div class="wt">${line.grossWeight}g <small>gross</small></div>
                    <div class="code">${line.designNo}</div>
                </div>
                <div class="panel-item-qty">
                    <button onclick="Cart.stepPanel(${line.cartId},${line.productId},-1)">−</button>
                    <input type="number" min="1" value="${line.quantity}" style="width:40px"
                           onchange="Cart.setPanel(${line.cartId},${line.productId},this.value)">
                    <button onclick="Cart.stepPanel(${line.cartId},${line.productId},1)">+</button>
                </div>
                <button class="panel-remove" onclick="Cart.removePanel(${line.cartId},${line.productId})" title="Remove">✕</button>
            </div>`;
        });
        body.innerHTML = html;
        if (summary) summary.innerHTML =
            `<strong>${totalPcs}</strong> pcs &mdash; Total gross: <strong>${totalGross.toFixed(3)}g</strong>`;

        // Sync card states
        document.querySelectorAll('.product-card').forEach(card => {
            const pid = parseInt(card.dataset.pid);
            const inCart = state.lines.some(l => l.productId === pid);
            card.classList.toggle('in-cart', inCart);
        });
    }

    async function load() {
        try {
            const r = await fetch('/api/cart.php?action=get');
            const d = await r.json();
            if (d.ok) { state = d; renderPanel(); updateBadge(); }
        } catch {}
    }

    async function api(body) {
        const r = await fetch('/api/cart.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.ok) { state = d; renderPanel(); updateBadge(); }
        return d;
    }

    return {
        load,
        add(productId, qty = 1) {
            return api({ action: 'add', productId, qty });
        },
        set(productId, qty) {
            return api({ action: 'set', productId, qty });
        },
        remove(productId) {
            return api({ action: 'remove', productId });
        },
        stepPanel(cartId, productId, delta) {
            const line = state.lines.find(l => l.cartId === cartId);
            const newQty = Math.max(1, (line ? line.quantity : 1) + delta);
            return api({ action: 'set', productId, qty: newQty });
        },
        setPanel(cartId, productId, val) {
            const qty = Math.max(1, parseInt(val) || 1);
            return api({ action: 'set', productId, qty });
        },
        removePanel(cartId, productId) {
            return api({ action: 'remove', productId });
        }
    };
})();

// ── Panel open/close
function openPanel() {
    document.getElementById('quot-panel').classList.add('open');
    document.getElementById('panel-overlay').classList.add('show');
}
function closePanel() {
    document.getElementById('quot-panel').classList.remove('open');
    document.getElementById('panel-overlay').classList.remove('show');
}

// ── Catalogue loading
let cataloguePage = 1;
let catalogueCategory = '';
let catalogueSearch = '';
let catalogueLoading = false;

async function loadCatalogue(reset = false) {
    if (catalogueLoading) return;
    if (reset) { cataloguePage = 1; }
    catalogueLoading = true;

    const grid = document.getElementById('product-grid');
    if (reset && grid) grid.innerHTML = '<div style="padding:20px;color:#888;text-align:center"><span class="spinner"></span> Loading…</div>';

    try {
        const params = new URLSearchParams({
            page: cataloguePage,
            category: catalogueCategory,
            search: catalogueSearch
        });
        const r = await fetch(`/api/catalogue.php?${params}`);
        const d = await r.json();
        if (!d.ok) return;

        let html = '';
        d.products.forEach(p => {
            const img = p.image
                ? `<img src="${p.image}" class="product-card-img" alt="${p.designNo}" loading="lazy">`
                : `<div class="product-card-placeholder">💍</div>`;
            const inCart = '';  // will be set by renderPanel
            html += `<div class="product-card${inCart}" data-pid="${p.id}">
                ${img}
                <div class="product-card-body">
                    <div class="weight-primary">${p.grossWeight}g <span>gross wt.</span></div>
                    <div class="weight-net">${p.netWeight}g net wt.</div>
                    <div class="product-code">${p.designNo} &bull; ${p.jewelCode}</div>
                    <div class="qty-stepper">
                        <button onclick="stepQty(${p.id},-1)" type="button">−</button>
                        <input id="qty-${p.id}" type="number" min="1" max="${p.stock}" value="1">
                        <button onclick="stepQty(${p.id},1)" type="button">+</button>
                    </div>
                    <button class="btn btn-primary btn-sm btn-add-cart" onclick="addToCart(${p.id})" type="button">Add to Quotation</button>
                </div>
            </div>`;
        });

        if (reset) { if (grid) grid.innerHTML = html || '<p style="color:#888;padding:20px">No products found.</p>'; }
        else { if (grid) grid.insertAdjacentHTML('beforeend', html); }

        // Update load-more button
        const more = document.getElementById('load-more');
        if (more) more.style.display = d.hasMore ? 'block' : 'none';

        cataloguePage++;
        // Sync cart state on newly rendered cards
        Cart.load();

    } catch (err) {
        console.error(err);
    } finally {
        catalogueLoading = false;
    }
}

function stepQty(productId, delta) {
    const inp = document.getElementById(`qty-${productId}`);
    if (!inp) return;
    inp.value = Math.max(1, parseInt(inp.value || 1) + delta);
}

async function addToCart(productId) {
    const inp = document.getElementById(`qty-${productId}`);
    const qty = inp ? Math.max(1, parseInt(inp.value || 1)) : 1;
    const btn = document.querySelector(`.product-card[data-pid="${productId}"] .btn-add-cart`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Adding…'; }
    await Cart.add(productId, qty);
    if (btn) { btn.disabled = false; btn.textContent = 'Add to Quotation'; }
}

// ── Generate quotation
async function generateQuotation() {
    const notes = document.getElementById('quot-notes')?.value || '';
    const btn = document.getElementById('gen-quot-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…'; }

    try {
        const r = await fetch('/api/quotation.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate', notes })
        });
        const d = await r.json();
        if (d.ok && d.pdfUrl) {
            closePanel();
            Cart.load();
            window.open(d.pdfUrl, '_blank');
            showToast('Quotation generated! PDF opened.');
        } else {
            showToast(d.error || 'Failed to generate quotation.', true);
        }
    } catch {
        showToast('Network error.', true);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Generate Quotation PDF'; }
    }
}

// ── Toast
function showToast(msg, isError = false) {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:6px;font-size:14px;z-index:9999;font-family:Georgia,serif;transition:opacity .3s';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isError ? '#c0392b' : '#27ae60';
    t.style.color = '#fff';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
    Cart.load();
    loadCatalogue(true);

    // Category filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            catalogueCategory = btn.dataset.cat || '';
            loadCatalogue(true);
        });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                catalogueSearch = searchInput.value.trim();
                loadCatalogue(true);
            }, 350);
        });
    }

    // Load more
    const moreBtn = document.getElementById('load-more');
    if (moreBtn) moreBtn.addEventListener('click', () => loadCatalogue(false));

    // Panel events
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) cartBtn.addEventListener('click', openPanel);
    document.getElementById('panel-close')?.addEventListener('click', closePanel);
    document.getElementById('panel-overlay')?.addEventListener('click', closePanel);
    document.getElementById('gen-quot-btn')?.addEventListener('click', generateQuotation);
});
