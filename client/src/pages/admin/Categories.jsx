import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

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

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [sort,       setSort]       = useState({ col: 'name', dir: 'asc' });
  const [name,       setName]       = useState('');
  const [editId,     setEditId]     = useState(null);
  const [editName,   setEditName]   = useState('');
  const [mergeOpen,  setMergeOpen]  = useState(false);
  const [mergeTarget,setMergeTarget]= useState('');
  const [mergeSrcs,  setMergeSrcs]  = useState(new Set());
  const { show } = useToast();

  function handleSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  const sorted = [...categories].sort((a, b) => {
    let va = a[sort.col], vb = b[sort.col];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
    else { va = va ?? 0; vb = vb ?? 0; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sort.dir === 'asc' ? cmp : -cmp;
  });

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

  function openMerge() {
    setMergeTarget('');
    setMergeSrcs(new Set());
    setMergeOpen(true);
  }

  function toggleSrc(id) {
    setMergeSrcs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runMerge(e) {
    e.preventDefault();
    if (!mergeTarget) return show('Select a target category.', 'error');
    const sourceIds = [...mergeSrcs].filter(id => String(id) !== String(mergeTarget));
    if (sourceIds.length === 0) return show('Select at least one source category to merge.', 'error');
    const targetName = categories.find(c => String(c.id) === String(mergeTarget))?.name;
    if (!confirm(`Merge ${sourceIds.length} category(ies) into "${targetName}"? This cannot be undone.`)) return;
    const d = await api.post('/admin/categories/merge', { targetId: Number(mergeTarget), sourceIds: sourceIds.map(Number) });
    if (d.ok) {
      setMergeOpen(false);
      load();
      show(`Merged ${sourceIds.length} category(ies) into "${targetName}"`);
    } else {
      show(d.error || 'Merge failed', 'error');
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Categories</h1>
        <button className="btn btn-outline btn-sm" onClick={openMerge}>Merge Categories</button>
      </div>

      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className="form-control" placeholder="New category name" required
          value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 300 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">Add</button>
      </form>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <Th col="name"          sort={sort} onSort={handleSort}>Name</Th>
              <Th col="product_count" sort={sort} onSort={handleSort}>Products</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
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

      {/* ── Merge Modal ── */}
      {mergeOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setMergeOpen(false); }}>
          <div className="modal-box">
            <h2>Merge Categories</h2>
            <p style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 16 }}>
              All products from the selected source categories will be moved to the target, then source categories will be deleted.
            </p>
            <form onSubmit={runMerge}>
              <div className="form-group">
                <label>Keep (target) category</label>
                <select className="form-control" required value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}>
                  <option value="">— Select target —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.product_count} products)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Merge these into it (tick to delete)</label>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '8px 12px' }}>
                  {categories
                    .filter(c => String(c.id) !== String(mergeTarget))
                    .map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mergeSrcs.has(c.id)}
                          onChange={() => toggleSrc(c.id)}
                        />
                        <span>{c.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--mid)' }}>({c.product_count} products)</span>
                      </label>
                    ))
                  }
                  {categories.filter(c => String(c.id) !== String(mergeTarget)).length === 0 && (
                    <p style={{ color: 'var(--mid)', fontSize: 13 }}>Select a target first.</p>
                  )}
                </div>
              </div>

              {mergeSrcs.size > 0 && mergeTarget && (
                <p style={{ fontSize: 13, color: '#c0392b', marginBottom: 12 }}>
                  ⚠ {mergeSrcs.size} categor{mergeSrcs.size > 1 ? 'ies' : 'y'} will be permanently deleted after merge.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setMergeOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={!mergeTarget || mergeSrcs.size === 0}>
                  Merge & Delete Sources
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
