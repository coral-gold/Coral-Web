import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WholesalerLayout from '../../components/WholesalerLayout';
import CatalogImage from '../../components/CatalogImage';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { useLightbox } from '../../components/ImageLightbox';
import { useSiteContent } from '../../context/SiteContentContext';
import api from '../../api';

function RemarkInput({ line, onSave }) {
  const [value, setValue] = useState(line.remark || '');
  const debounce = React.useRef(null);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => onSave(line.productId, v), 500);
  }

  return (
    <input
      type="text" className="panel-item-remark" placeholder="Remark (optional)…"
      value={value} onChange={handleChange} maxLength={500}
    />
  );
}

// Fetches the freshly generated PDF and hands it to the device's native
// share sheet when the browser supports sharing files (most mobile
// browsers); falls back to just opening it in a new tab otherwise (most
// desktop browsers) — Batch 19 item 6.
async function shareOrOpenPdf(pdfUrl, filename) {
  try {
    const resp = await fetch(pdfUrl);
    const blob = await resp.blob();
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename, text: 'Coral Gold Quotation' });
      return;
    }
  } catch (e) {
    // User cancelled the share sheet, or share/fetch failed — fall through to opening it directly.
  }
  window.open(pdfUrl, '_blank');
}

export default function Quotation() {
  const { cart, remark, remove, clear } = useCart();
  const { show } = useToast();
  const openImage = useLightbox();
  const { settings } = useSiteContent();
  const navigate = useNavigate();
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);

  const totalGross = cart.lines.reduce((s, l) => s + parseFloat(l.grossWeight || 0), 0);

  async function handleGenerate() {
    if (!cart.lines.length) { show('Your quotation list is empty', 'error'); return; }
    setLoading(true);
    try {
      const d = await api.post('/quotation/generate', { notes });
      if (d.ok) {
        show(`Quotation ${d.number} generated!`);
        clear();
        setNotes('');
        await shareOrOpenPdf(d.pdfUrl, `${d.number}.pdf`);
        navigate('/wholesaler/quotations');
      } else {
        show(d.error || 'Failed to generate quotation.', 'error');
      }
    } catch {
      show('Network error.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WholesalerLayout>
      <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, color: 'var(--garnet)', marginBottom: 20 }}>
        Build Your Quotation
      </h1>

      {cart.lines.length === 0 ? (
        <div className="quotation-empty">
          <div className="quotation-empty-icon">💍</div>
          <p>Your quotation list is empty.</p>
          <Link to="/wholesaler/catalogue" className="btn btn-primary">Browse Catalogue</Link>
        </div>
      ) : (
        <>
          <div className="quotation-build-list">
            {cart.lines.map(line => (
              <div key={line.cartId} className="panel-item quotation-build-item">
                <CatalogImage
                  src={line.image} alt=""
                  imgClassName="panel-item-img" placeholderClassName="panel-item-placeholder"
                  onClick={() => openImage(line.image)}
                />
                <div className="panel-item-info">
                  <div className="wt">
                    {settings.showNetWeight   && <>{line.netWeight}g <small>net</small></>}
                    {settings.showNetWeight && settings.showGrossWeight && <>&nbsp;&nbsp;</>}
                    {settings.showGrossWeight && <>{line.grossWeight}g <small>gross</small></>}
                  </div>
                  <div className="code">{line.designNo} · {line.jewelCode}</div>
                  <RemarkInput line={line} onSave={remark} />
                </div>
                <button className="panel-remove" onClick={() => remove(line.productId)} title="Remove">✕</button>
              </div>
            ))}
          </div>

          <div className="quotation-build-footer">
            <div className="panel-summary">
              <strong>{cart.itemCount}</strong> items
              {settings.showGrossWeight && <> &mdash; Total gross: <strong>{totalGross.toFixed(3)}g</strong></>}
            </div>
            <textarea
              className="quot-notes"
              placeholder="Notes for this quotation (optional)…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              className="btn btn-generate-quotation"
              onClick={handleGenerate}
              disabled={loading || !cart.lines.length}
            >
              {loading ? <><span className="spinner" />Generating…</> : 'Generate Quotation PDF'}
            </button>
          </div>
        </>
      )}
    </WholesalerLayout>
  );
}
