import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { handleImgError } from '../../utils/image';
import api from '../../api';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }} />
      <span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--mid)', marginTop: 2 }}>{hint}</span>}
      </span>
    </label>
  );
}

export default function Settings() {
  const [loading, setLoading]   = useState(true);
  const [s,       setS]         = useState(null); // settings object from server
  const [lockPassword, setLockPassword] = useState('');
  const [logoFile,     setLogoFile]     = useState(null);
  const [faviconFile,  setFaviconFile]  = useState(null);
  const [saving,   setSaving]   = useState(false);
  const { show } = useToast();

  useEffect(() => {
    api.get('/admin/settings').then(d => {
      if (d.ok) setS(d.settings);
      setLoading(false);
    });
  }, []);

  function set(key, value) { setS(prev => ({ ...prev, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.append('wholesaler_enabled', s.wholesalerEnabled ? '1' : '0');
    fd.append('site_lock_enabled',  s.siteLockEnabled   ? '1' : '0');
    fd.append('show_net_weight',    s.showNetWeight     ? '1' : '0');
    fd.append('show_gross_weight',  s.showGrossWeight   ? '1' : '0');
    fd.append('show_amount',        s.showAmount        ? '1' : '0');
    fd.append('pdf_layout',         s.pdfLayout);
    fd.append('product_image_fit',  s.productImageFit);
    fd.append('pagination_mode',    s.paginationMode);
    if (lockPassword) fd.append('site_lock_password', lockPassword);
    if (logoFile)     fd.append('logo', logoFile);
    if (faviconFile)  fd.append('favicon', faviconFile);

    const d = await api.form('/admin/settings', fd);
    setSaving(false);
    if (d.ok) {
      setLockPassword(''); setLogoFile(null); setFaviconFile(null);
      if (d.logo_url)    set('siteLogo', d.logo_url);
      if (d.favicon_url) set('siteFavicon', d.favicon_url);
      show('Settings saved');
    } else show(d.error || 'Failed', 'error');
  }

  if (loading || !s) {
    return (
      <AdminLayout>
        <h1 className="admin-page-title">Settings</h1>
        <p style={{ color: 'var(--mid)' }}><span className="spinner-dark" />Loading settings…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Settings</h1>

      <form onSubmit={submit} style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Wholesaler Module</h3>
          <Toggle
            checked={s.wholesalerEnabled} onChange={v => set('wholesalerEnabled', v)}
            label="Enable wholesaler ordering"
            hint="When off, wholesaler login and the entire ordering section are unavailable site-wide — existing sessions are also cut off immediately."
          />
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Website Lock</h3>
          <Toggle
            checked={s.siteLockEnabled} onChange={v => set('siteLockEnabled', v)}
            label="Require a password before the public site loads"
            hint="Gates Home / About / Catalogue / Contact behind a single shared password — a simple lock screen. Wholesaler and Admin logins are never affected."
          />
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Lock password {s.siteLockEnabled && <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(leave blank to keep the current one)</span>}</label>
            <input
              className="form-control" type="password" autoComplete="new-password"
              value={lockPassword} onChange={e => setLockPassword(e.target.value)}
              placeholder={s.siteLockEnabled ? '••••••••' : 'Set a password before enabling the lock'}
            />
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Field Visibility</h3>
          <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 4 }}>Hide fields you don't use across the catalogue and quotation PDF.</p>
          <Toggle checked={s.showGrossWeight} onChange={v => set('showGrossWeight', v)} label="Show Gross Weight" />
          <Toggle checked={s.showNetWeight}   onChange={v => set('showNetWeight', v)}   label="Show Net Weight" />
          <Toggle checked={s.showAmount}      onChange={v => set('showAmount', v)}      label="Show Amount (stone/diamond content)" />
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 12 }}>Quotation PDF Layout</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { v: 'grid2', label: '2 × 2 Grid', hint: 'Large photos, 2 per row' },
              { v: 'grid3', label: '3 × 3 Grid', hint: 'Compact photos, 3 per row' },
            ].map(opt => (
              <label
                key={opt.v}
                className={`category-picker-item${s.pdfLayout === opt.v ? ' checked' : ''}`}
                style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', gap: 2, minWidth: 130 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name="pdf_layout" checked={s.pdfLayout === opt.v} onChange={() => set('pdfLayout', opt.v)} />
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mid)', fontWeight: 400 }}>{opt.hint}</span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mid)', marginTop: 10 }}>
            Quotation PDFs always include product images, in this layout.
          </p>
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Product Card Image Fit</h3>
          <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 12 }}>
            How product photos are scaled to fill their card, everywhere a product card appears.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { v: 'cover',      label: 'Cover',    hint: 'Fills the card, cropping edges' },
              { v: 'contain',    label: 'Contain',  hint: 'Whole image visible, may letterbox' },
              { v: 'fill',       label: 'Stretch',  hint: 'Fills the card, may distort' },
              { v: 'scale-down', label: 'Fit',       hint: 'Shrinks to fit, never enlarges' },
            ].map(opt => (
              <label
                key={opt.v}
                className={`category-picker-item${s.productImageFit === opt.v ? ' checked' : ''}`}
                style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', gap: 2, minWidth: 150 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name="product_image_fit" value={opt.v} checked={s.productImageFit === opt.v} onChange={() => set('productImageFit', opt.v)} />
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mid)', fontWeight: 400 }}>{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 4 }}>Pagination Style</h3>
          <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 12 }}>
            How longer lists load further items — applies everywhere a list is paginated (catalogue, admin tables).
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { v: 'classic',   label: 'Classic',         hint: 'Prev / Next page buttons' },
              { v: 'load_more', label: 'Load More',       hint: 'A button appends the next page' },
              { v: 'infinite',  label: 'Infinite Scroll', hint: 'Auto-loads more while scrolling' },
            ].map(opt => (
              <label
                key={opt.v}
                className={`category-picker-item${s.paginationMode === opt.v ? ' checked' : ''}`}
                style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', gap: 2, minWidth: 150 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name="pagination_mode" value={opt.v} checked={s.paginationMode === opt.v} onChange={() => set('paginationMode', opt.v)} />
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--mid)', fontWeight: 400 }}>{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginBottom: 16 }}>Logo &amp; Favicon</h3>
          <div className="form-group">
            <label>Site Logo</label>
            {s.siteLogo && (
              <img src={s.siteLogo} alt="Logo" style={{ height: 40, objectFit: 'contain', display: 'block', marginBottom: 8, background: 'var(--off-white)', padding: 6, borderRadius: 6 }} onError={handleImgError} />
            )}
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
            <p style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>PNG with transparent background recommended.</p>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Favicon</label>
            {s.siteFavicon && (
              <img src={s.siteFavicon} alt="Favicon" style={{ height: 32, width: 32, objectFit: 'contain', display: 'block', marginBottom: 8, background: 'var(--off-white)', padding: 4, borderRadius: 6 }} onError={handleImgError} />
            )}
            <input type="file" accept="image/*" onChange={e => setFaviconFile(e.target.files[0])} />
            <p style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>Square image, ideally 256×256px or larger.</p>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? <><span className="spinner" />Saving…</> : 'Save Settings'}
        </button>
      </form>
    </AdminLayout>
  );
}
