import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const EMPTY = { party_id: '', company_name: '', password: '', phone: '' };

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(EMPTY);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const { show } = useToast();

  async function load() {
    const d = await api.get('/admin/parties');
    if (d.ok) setParties(d.parties);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm(EMPTY); setEditId(null); setModal(true); }
  function openEdit(p) {
    setForm({ party_id: p.party_id, company_name: p.company_name, password: '', phone: p.phone || '' });
    setEditId(p.id); setModal(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (editId && !payload.password) delete payload.password;
    const d = editId
      ? await api.put(`/admin/parties/${editId}`, payload)
      : await api.post('/admin/parties', payload);
    setSaving(false);
    if (d.ok) { setModal(false); load(); show(editId ? 'Updated' : 'Party added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function toggle(id) {
    const d = await api.patch(`/admin/parties/${id}/toggle`);
    if (d.ok) load();
    else show('Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this party?')) return;
    const d = await api.del(`/admin/parties/${id}`);
    if (d.ok) { load(); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Parties</h1>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Party</button>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Party ID</th><th>Company Name</th><th>Phone</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {parties.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No parties yet.</td></tr>
            )}
            {parties.map(p => (
              <tr key={p.id}>
                <td><strong>{p.party_id}</strong></td>
                <td>{p.company_name}</td>
                <td>{p.phone || '—'}</td>
                <td>
                  <span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => toggle(p.id)}>
                    {p.is_active ? 'Disable' : 'Enable'}
                  </button>
                  {' '}
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>Edit</button>
                  {' '}
                  <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box">
            <h2>{editId ? 'Edit Party' : 'Add Party'}</h2>
            <form onSubmit={submit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Party ID *</label>
                  <input className="form-control" required value={form.party_id} onChange={set('party_id')} disabled={!!editId} />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input className="form-control" required value={form.company_name} onChange={set('company_name')} />
                </div>
              </div>
              <div className="form-group">
                <label>Password {editId ? '(leave blank to keep)' : '*'}</label>
                <input className="form-control" type="password" required={!editId} value={form.password} onChange={set('password')} autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={form.phone} onChange={set('phone')} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" />Saving…</> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
