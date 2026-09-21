import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from './Toast';
import api from '../api';

export default function QuotationPanel() {
  const { cart, set, remove, clear, panelOpen, setPanelOpen } = useCart();
  const { show } = useToast();
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  const totalGross = cart.lines.reduce(
    (s, l) => s + parseFloat(l.grossWeight || 0) * l.quantity, 0
  );

  async function handleGenerate() {
    if (!cart.lines.length) { show('Cart is empty', 'error'); return; }
    setLoading(true);
    // Pre-open window in the user-gesture call stack to avoid popup blockers
    const win = window.open('', '_blank');
    try {
      const d = await api.post('/quotation/generate', { notes });
      if (d.ok) {
        setPanelOpen(false);
        setNotes('');
        if (win) win.location.href = d.pdfUrl;
        else window.location.href = d.pdfUrl;
        show(`Quotation ${d.number} generated!`);
        // Reload cart (now empty)
        await api.get('/cart').then(r => { if (r.ok) clear(); }).catch(() => {});
      } else {
        if (win) win.close();
        show(d.error || 'Failed to generate quotation.', 'error');
      }
    } catch {
      if (win) win.close();
      show('Network error.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {panelOpen && (
        <div className="panel-overlay" onClick={() => setPanelOpen(false)} />
      )}

      <div className={`quot-panel ${panelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h3>Quotation List ({cart.pieceCount} pcs)</h3>
          <button className="panel-close" onClick={() => setPanelOpen(false)}>✕</button>
        </div>

        <div className="panel-body">
          {cart.lines.length === 0 ? (
            <p className="panel-empty">Your quotation list is empty.</p>
          ) : (
            cart.lines.map(line => (
              <div key={line.cartId} className="panel-item">
                {line.image
                  ? <img src={line.image} className="panel-item-img" alt="" />
                  : <div className="panel-item-placeholder">💍</div>
                }
                <div className="panel-item-info">
                  <div className="wt">{line.grossWeight}g <small>gross</small></div>
                  <div className="code">{line.designNo} · {line.jewelCode}</div>
                </div>
                <div className="panel-item-qty">
                  <button onClick={() => set(line.productId, Math.max(1, line.quantity - 1))}>−</button>
                  <input
                    type="number" min="1" value={line.quantity}
                    onChange={e => set(line.productId, Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button onClick={() => set(line.productId, line.quantity + 1)}>+</button>
                </div>
                <button className="panel-remove" onClick={() => remove(line.productId)} title="Remove">✕</button>
              </div>
            ))
          )}
        </div>

        <div className="panel-footer">
          {cart.lines.length > 0 && (
            <div className="panel-summary">
              <strong>{cart.pieceCount}</strong> pcs &mdash; Total gross:{' '}
              <strong>{totalGross.toFixed(3)}g</strong>
            </div>
          )}
          <textarea
            className="quot-notes"
            placeholder="Notes for this quotation (optional)…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleGenerate}
            disabled={loading || !cart.lines.length}
          >
            {loading ? <><span className="spinner" />Generating…</> : 'Generate Quotation PDF'}
          </button>
        </div>
      </div>
    </>
  );
}
