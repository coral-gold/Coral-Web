import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const FIELDS = [
  { key: 'home_hero_title',    label: 'Home Hero Title' },
  { key: 'home_hero_subtitle', label: 'Home Hero Subtitle' },
  { key: 'about_text',         label: 'About Text', multiline: true },
  { key: 'contact_email',      label: 'Contact Email' },
  { key: 'contact_phone',      label: 'Contact Phone' },
  { key: 'contact_address',    label: 'Contact Address' },
];

export default function Content() {
  const [form,     setForm]    = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [saving,   setSaving]  = useState(false);
  const { show } = useToast();

  useEffect(() => {
    api.get('/admin/content').then(d => { if (d.ok) setForm(d.content); });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v || ''));
    if (logoFile) fd.append('logo', logoFile);
    const d = await api.form('/admin/content', fd);
    setSaving(false);
    if (d.ok) show('Content saved');
    else show(d.error || 'Failed', 'error');
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Site Content</h1>

      <form onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="admin-card">
          <h3 style={{ marginBottom: 16 }}>Text Content</h3>
          {FIELDS.map(f => (
            <div className="form-group" key={f.key}>
              <label>{f.label}</label>
              {f.multiline
                ? <textarea className="form-control" rows={4} value={form[f.key] || ''} onChange={set(f.key)} />
                : <input className="form-control" value={form[f.key] || ''} onChange={set(f.key)} />
              }
            </div>
          ))}
        </div>

        <div className="admin-card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Logo</h3>
          {form.logo_url && (
            <div style={{ marginBottom: 12 }}>
              <img src={form.logo_url} alt="Logo" style={{ height: 48, objectFit: 'contain', background: '#333', padding: 4 }} />
            </div>
          )}
          <div className="form-group">
            <label>Upload new logo (PNG/SVG recommended)</label>
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>
          {saving ? <><span className="spinner" />Saving…</> : 'Save Changes'}
        </button>
      </form>
    </AdminLayout>
  );
}
