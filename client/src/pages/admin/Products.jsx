import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const EMPTY = { designNo: '', jewelCode: '', category: '', grossWeight: '', netWeight: '', stock: '', description: '' };

export default function Products() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [editId,     setEditId]     = useState(null);
  const [imageFile,  setImageFile]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const { show } = useToast();
  const debounce = useRef(null);

  async function load(reset = false) {
    const p = reset ? 1 : page;
    const d = await api.get(`/admin/products?page=${p}&search=${encodeURIComponent(search)}`);
    if (d.ok) {
      setProducts(prev => reset ? d.products : [...prev, ...d.products]);
      setHasMore(d.hasMore);
      setPage(p + 1);
    }
  }

  useEffect(() => {
    api.get('/catalogue/categories').then(d => { if (d.ok) setCategories(d.categories); });
    load(true);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(true); }, 350);
  }, [search]);

  function openAdd() { setForm(EMPTY); setEditId(null); setImageFile(null); setModal(true); }
  function openEdit(p) {
    setForm({
      designNo: p.designNo, jewelCode: p.jewelCode, category: p.category,
      grossWeight: p.grossWeight, netWeight: p.netWeight, stock: p.stock,
      description: p.description || '',
    });
    setEditId(p.id); setImageFile(null); setModal(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (imageFile) fd.append('image', imageFile);
    const d = editId
      ? await api.formPut(`/admin/products/${editId}`, fd)
      : await api.form('/admin/products', fd);
    setSaving(false);
    if (d.ok) { setModal(false); setPage(1); load(true); show(editId ? 'Updated' : 'Product added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this product?')) return;
    const d = await api.del(`/admin/products/${id}`);
    if (d.ok) { setPage(1); load(true); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <input type="search" className="form-control" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Image</th><th>Design No.</th><th>Jewel Code</th><th>Category</th><th>Gross Wt.</th><th>Net Wt.</th><th>Stock</th><th></th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.image ? <img src={p.image} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} alt="" /> : '—'}</td>
                <td>{p.designNo}</td>
                <td>{p.jewelCode}</td>
                <td>{p.category}</td>
                <td>{parseFloat(p.grossWeight).toFixed(3)}g</td>
                <td>{parseFloat(p.netWeight).toFixed(3)}g</td>
                <td>{p.stock}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>Edit</button>
                  {' '}
                  <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => load(false)}>Load More</button>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box">
            <h2>{editId ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={submit}>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Design No. *</label>
                  <input className="form-control" required value={form.designNo} onChange={set('designNo')} />
                </div>
                <div className="form-group">
                  <label>Jewel Code *</label>
                  <input className="form-control" required value={form.jewelCode} onChange={set('jewelCode')} />
                </div>
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select className="form-control" required value={form.category} onChange={set('category')}>
                  <option value="">— Select —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Gross Weight (g) *</label>
                  <input className="form-control" type="number" step="0.001" required value={form.grossWeight} onChange={set('grossWeight')} />
                </div>
                <div className="form-group">
                  <label>Net Weight (g) *</label>
                  <input className="form-control" type="number" step="0.001" required value={form.netWeight} onChange={set('netWeight')} />
                </div>
              </div>
              <div className="form-group">
                <label>Stock *</label>
                <input className="form-control" type="number" min="0" required value={form.stock} onChange={set('stock')} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={set('description')} />
              </div>
              <div className="form-group">
                <label>Image {editId && '(leave blank to keep current)'}</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
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
