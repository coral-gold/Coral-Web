import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Pagination from '../../components/Pagination';
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
  const [categories,    setCategories]    = useState([]); // current page only
  const [allCategories, setAllCategories] = useState([]); // full list, for merge picker
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [total,         setTotal]         = useState(0);
  const [sort,          setSort]          = useState({ col: 'name', dir: 'asc' });
  const [name,          setName]          = useState('');
  const [editId,        setEditId]        = useState(null);
  const [editName,      setEditName]      = useState('');
  const [mergeOpen,     setMergeOpen]     = useState(false);
  const [mergeTarget,   setMergeTarget]   = useState('');
  const [mergeSrcs,     setMergeSrcs]     = useState(new Set());
  const { show } = useToast();

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    load(1, newSort);
  }

  // Real server-side pagination: fetch and render one page at a time.
  async function load(p = page, s = sort) {
    const d = await api.get(`/admin/categories?page=${p}&sort=${s.col}&order=${s.dir}`);
    if (d.ok) {
      if (d.categories.length === 0 && p > 1) return load(p - 1, s);
      setCategories(d.categories);
      setPage(p);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    }
  }

  useEffect(() => { load(1, sort); }, []);

  async function add(e) {
    e.preventDefault();
    const d = await api.post('/admin/categories', { name });
    if (d.ok) { setName(''); load(1, sort); show('Category added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function save(id) {
    const d = await api.put(`/admin/categories/${id}`, { name: editName });
    if (d.ok) { setEditId(null); load(page, sort); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this category?')) return;
    const d = await api.del(`/admin/categories/${id}`);
    if (d.ok) { load(page, sort); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  // Merge needs to see every category, not just the current page.
  async function openMerge() {
    const d = await api.get('/admin/categories?all=1');
    if (d.ok) setAllCategories(d.categories);
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
    const targetName = allCategories.find(c => String(c.id) === String(mergeTarget))?.name;
    if (!confirm(`Merge ${sourceIds.length} category(ies) into "${targetName}"? This cannot be undone.`)) return;
    const d = await api.post('/admin/categories/merge', { targetId: Number(mergeTarget), sourceIds: sourceIds.map(Number) });
    if (d.ok) {
      setMergeOpen(false);
      load(1, sort);
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
            {categories.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No categories yet.</td></tr>
            )}
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

      <Pagination page={page} pages={pages} total={total} onChange={p => load(p, sort)} />

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
                  {allCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.product_count} products)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Merge these into it (tick to delete)</label>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '8px 12px' }}>
                  {allCategories
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
                  {allCategories.filter(c => String(c.id) !== String(mergeTarget)).length === 0 && (
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
