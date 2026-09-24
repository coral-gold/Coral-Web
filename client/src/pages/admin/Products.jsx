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
  const [products,      setProducts]      = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [sort,          setSort]          = useState({ col: 'design_number', dir: 'asc' });
  const [modal,         setModal]         = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [editId,        setEditId]        = useState(null);
  const [imageFile,     setImageFile]     = useState(null);
  const [saving,        setSaving]        = useState(false);
  // Bulk
  const [selected,      setSelected]      = useState(new Set());
  const [bulkAction,    setBulkAction]    = useState('');
  const [bulkCatId,     setBulkCatId]     = useState('');
  const [bulkSaving,    setBulkSaving]    = useState(false);
  // Quick edit
  const [qeId,          setQeId]          = useState(null);
  const [qeForm,        setQeForm]        = useState({});
  const [qeSaving,      setQeSaving]      = useState(false);
  const { show } = useToast();
  const debounce = useRef(null);

  // ── Data loading ──────────────────────────────────────────────────────────

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

  // ── Full edit modal ───────────────────────────────────────────────────────

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

  // ── Quick edit ────────────────────────────────────────────────────────────

  function openQe(p) {
    setQeId(p.id);
    setQeForm({
      design_number: p.design_number || '',
      jewel_code:    p.jewel_code    || '',
      category_id:   String(p.category_id || ''),
      gross_weight:  p.gross_weight  || '',
      net_weight:    p.net_weight    || '',
    });
  }

  async function saveQe(id) {
    setQeSaving(true);
    const fd = new FormData();
    Object.entries(qeForm).forEach(([k, v]) => fd.append(k, v ?? ''));
    const d = await api.formPut(`/admin/products/${id}`, fd);
    setQeSaving(false);
    if (d.ok) { setQeId(null); setPage(1); load(true); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  const setQeF = k => e => setQeForm(f => ({ ...f, [k]: e.target.value }));

  // ── Selection & bulk ──────────────────────────────────────────────────────

  function toggleAll() {
    if (selected.size === products.length && products.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map(p => p.id)));
    }
  }

  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    if (!bulkAction) return show('Select an action.', 'error');
    const ids = [...selected];
    if (!ids.length) return;
    if (bulkAction === 'delete') {
      if (!confirm(`Permanently delete ${ids.length} product(s)?`)) return;
    }
    if (bulkAction === 'change_category' && !bulkCatId) {
      return show('Select a target category.', 'error');
    }
    setBulkSaving(true);
    const payload = { action: bulkAction, ids };
    if (bulkAction === 'change_category') payload.category_id = Number(bulkCatId);
    const d = await api.post('/admin/products/bulk', payload);
    setBulkSaving(false);
    if (d.ok) {
      setSelected(new Set());
      setBulkAction('');
      setBulkCatId('');
      setPage(1);
      load(true);
      show(`Done: ${d.affected} product(s) updated.`);
    } else {
      show(d.error || 'Failed', 'error');
    }
  }

  function imgUrl(path) {
    if (!path) return null;
    return '/uploads/' + path.replace(/^.*[\\/]/, '');
  }

  const allChecked = products.length > 0 && selected.size === products.length;
  const anySelected = selected.size > 0;

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 12 }}>
        <input type="search" className="form-control" placeholder="Search by design no., jewel code or category…"
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Bulk toolbar */}
      {anySelected && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'rgba(139,0,0,0.05)', borderRadius: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--garnet)' }}>{selected.size} selected</span>
          <select className="form-control form-control-sm" value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkCatId(''); }}
                  style={{ width: 'auto', minWidth: 180 }}>
            <option value="">— Choose action —</option>
            <option value="delete">Delete</option>
            <option value="change_category">Change Category</option>
            <option value="delete_image">Delete Image</option>
          </select>
          {bulkAction === 'change_category' && (
            <select className="form-control form-control-sm" value={bulkCatId} onChange={e => setBulkCatId(e.target.value)}
                    style={{ width: 'auto', minWidth: 160 }}>
              <option value="">— Select category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={bulkSaving || !bulkAction}>
            {bulkSaving ? <><span className="spinner" />…</> : 'Apply'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 32, padding: '8px 6px' }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} title="Select all" />
              </th>
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
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No products yet.</td></tr>
            )}
            {products.map(p => (
              <React.Fragment key={p.id}>
                <tr style={{ background: selected.has(p.id) ? 'rgba(139,0,0,0.04)' : undefined }}>
                  <td style={{ padding: '8px 6px' }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                  </td>
                  <td>
                    {imgUrl(p.image_path)
                      ? <img src={imgUrl(p.image_path)} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} alt="" />
                      : '—'}
                  </td>
                  <td>{p.design_number}</td>
                  <td>{p.jewel_code}</td>
                  <td>{p.category_name}</td>
                  <td>{p.gross_weight ? parseFloat(p.gross_weight).toFixed(3) + 'g' : '—'}</td>
                  <td>{p.net_weight   ? parseFloat(p.net_weight).toFixed(3)   + 'g' : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)} style={{ marginRight: 4 }}>Edit</button>
                    <button className="btn btn-sm btn-outline" onClick={() => qeId === p.id ? setQeId(null) : openQe(p)} style={{ marginRight: 4 }}>
                      {qeId === p.id ? 'Close' : 'Quick Edit'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>Del</button>
                  </td>
                </tr>

                {/* Quick Edit inline row */}
                {qeId === p.id && (
                  <tr style={{ background: '#fffbe6' }}>
                    <td colSpan={8} style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                          <label style={{ fontSize: 11 }}>Category</label>
                          <select className="form-control form-control-sm" value={qeForm.category_id} onChange={setQeF('category_id')}>
                            <option value="">— select —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, minWidth: 110 }}>
                          <label style={{ fontSize: 11 }}>Design No.</label>
                          <input className="form-control form-control-sm" value={qeForm.design_number} onChange={setQeF('design_number')} />
                        </div>
                        <div className="form-group" style={{ margin: 0, minWidth: 110 }}>
                          <label style={{ fontSize: 11 }}>Jewel Code</label>
                          <input className="form-control form-control-sm" value={qeForm.jewel_code} onChange={setQeF('jewel_code')} />
                        </div>
                        <div className="form-group" style={{ margin: 0, width: 90 }}>
                          <label style={{ fontSize: 11 }}>Gross Wt.</label>
                          <input className="form-control form-control-sm" type="number" step="0.001" value={qeForm.gross_weight} onChange={setQeF('gross_weight')} />
                        </div>
                        <div className="form-group" style={{ margin: 0, width: 90 }}>
                          <label style={{ fontSize: 11 }}>Net Wt.</label>
                          <input className="form-control form-control-sm" type="number" step="0.001" value={qeForm.net_weight} onChange={setQeF('net_weight')} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveQe(p.id)} disabled={qeSaving}>
                            {qeSaving ? <><span className="spinner" />…</> : 'Save'}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => setQeId(null)}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
