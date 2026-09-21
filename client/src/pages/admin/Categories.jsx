import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name,       setName]       = useState('');
  const [editId,     setEditId]     = useState(null);
  const [editName,   setEditName]   = useState('');
  const { show } = useToast();

  async function load() {
    const d = await api.get('/admin/categories');
    if (d.ok) setCategories(d.categories);
  }

  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const d = await api.post('/admin/categories', { name });
    if (d.ok) { setName(''); load(); show('Category added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function save(id) {
    const d = await api.put(`/admin/categories/${id}`, { name: editName });
    if (d.ok) { setEditId(null); load(); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this category?')) return;
    const d = await api.del(`/admin/categories/${id}`);
    if (d.ok) { load(); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Categories</h1>

      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className="form-control" placeholder="New category name" required
          value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 300 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">Add</button>
      </form>

      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id}>
                <td>
                  {editId === c.id
                    ? <input className="form-control form-control-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                    : c.name
                  }
                </td>
                <td>{c.product_count}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editId === c.id ? (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => save(c.id)}>Save</button>
                      {' '}
                      <button className="btn btn-sm btn-outline" onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-outline" onClick={() => { setEditId(c.id); setEditName(c.name); }}>Edit</button>
                      {' '}
                      <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
