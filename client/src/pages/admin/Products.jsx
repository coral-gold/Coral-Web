import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const EMPTY = { design_number: '', jewel_code: '', category_id: '', gross_weight: '', net_weight: '', description: '' };

function Th({ col, sort, onSort, children }) {
  const active = sort.col === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => onSort(col)}>
      {children}
      <span style={{ marginLeft: 4, color: active ? 'var(--garnet)' : '#bbb', fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

export default function Products() {
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState({ col: 'design_number', dir: 'asc' });
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [editId,     setEditId]     = useState(null);
  const [imageFile,  setImageFile]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const { show } = useToast();
  const debounce = useRef(null);

  async function load(reset = false, sortOpts) {
    const p = reset ? 1 : page;
    const s = sortOpts || sort;
    const d = await api.get(`/admin/products?page=${p}&q=${encodeURIComponent(search)}&sort=${s.col}&order=${s.dir}`);
    if (d.ok) {
      setProducts(prev => reset ? d.products : [...prev, ...d.products]);
      setHasMore(d.hasMore || false);
      setPage(p + 1);
    }
  }

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    setPage(1);
    load(true, newSort);
  }

  useEffect(() => {
    api.get('/admin/categories').then(d => { if (d.ok) setCategories(d.categories); });
    load(true);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(true); }, 350);
  }, [search]);

  function openAdd() { setForm(EMPTY); setEditId(null); setImageFile(null); setModal(true); }
  function openEdit(p) {
    setForm({
      design_number: p.design_number || '',
      jewel_code:    p.jewel_code    || '',
      category_id:   String(p.category_id || ''),
      gross_weight:  p.gross_weight  || '',
      net_weight:    p.net_weight    || '',
      description:   p.description   || '',
    });
    setEditId(p.id); setImageFile(null); setModal(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
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

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function imgUrl(path) {
    if (!path) return null;
    return '/uploads/' + path.replace(/^.*[\\/]/, '');
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 16 }}>
        <input type="search" className="form-control" placeholder="Search by design no., jewel code or category…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <Th col="design_number" sort={sort} onSort={handleSort}>Design No.</Th>
              <Th col="jewel_code"    sort={sort} onSort={handleSort}>Jewel Code</Th>
              <Th col="category_name" sort={sort} onSort={handleSort}>Category</Th>
              <Th col="gross_weight"  sort={sort} onSort={handleSort}>Gross Wt.</Th>
              <Th col="net_weight"    sort={sort} onSort={handleSort}>Net Wt.</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No products yet.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id}>
                <td>{imgUrl(p.image_path) ? <img src={imgUrl(p.image_path)} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} alt="" /> : '—'}</td>
                <td>{p.design_number}</td>
                <td>{p.jewel_code}</td>
                <td>{p.category_name}</td>
                <td>{p.gross_weight ? parseFloat(p.gross_weight).toFixed(3) + 'g' : '—'}</td>
                <td>{p.net_weight   ? parseFloat(p.net_weight).toFixed(3)   + 'g' : '—'}</td>
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
              <div className="form-group">
                <label>Category *</label>
                <select className="form-control" required value={form.category_id} onChange={setF('category_id')}>
                  <option value="">— Select category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categories.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--mid)', marginTop: 4 }}>No categories yet — add one in Categories first.</p>
                )}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Design No. *</label>
                  <input className="form-control" required value={form.design_number} onChange={setF('design_number')} />
                </div>
                <div className="form-group">
                  <label>Jewel Code *</label>
                  <input className="form-control" required value={form.jewel_code} onChange={setF('jewel_code')} />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Gross Weight (g) *</label>
                  <input className="form-control" type="number" step="0.001" required value={form.gross_weight} onChange={setF('gross_weight')} />
                </div>
                <div className="form-group">
                  <label>Net Weight (g) *</label>
                  <input className="form-control" type="number" step="0.001" required value={form.net_weight} onChange={setF('net_weight')} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={setF('description')} />
              </div>
              <div className="form-group">
                <label>Image {editId && <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
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
