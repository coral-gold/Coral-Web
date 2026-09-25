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

const NEW_PARENT = '__new__';

export default function Categories() {
  const [categories,    setCategories]    = useState([]); // current page only
  const [allCategories, setAllCategories] = useState([]); // full list, for mapping picker
  const [tree,          setTree]          = useState([]);
  const [treeLoading,   setTreeLoading]   = useState(true);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [total,         setTotal]         = useState(0);
  const [sort,          setSort]          = useState({ col: 'name', dir: 'asc' });
  const [name,          setName]          = useState('');
  const [editId,        setEditId]        = useState(null);
  const [editName,      setEditName]      = useState('');
  const [mapOpen,       setMapOpen]       = useState(false);
  const [mapParent,     setMapParent]     = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [mapSrcs,       setMapSrcs]       = useState(new Set());
  const [mapLoading,    setMapLoading]    = useState(false);
  const [mapSaving,     setMapSaving]     = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
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

  // Load More / infinite scroll (Batch 21 item 4) — appends the next page.
  async function loadMore() {
    if (page >= pages || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const d = await api.get(`/admin/categories?page=${nextPage}&sort=${sort.col}&order=${sort.dir}`);
    setLoadingMore(false);
    if (d.ok) {
      setCategories(prev => [...prev, ...d.categories]);
      setPage(nextPage);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    }
  }

  async function loadTree() {
    setTreeLoading(true);
    const d = await api.get('/admin/categories/tree');
    setTreeLoading(false);
    if (d.ok) setTree(d.tree);
  }

  useEffect(() => { load(1, sort); loadTree(); }, []);

  async function add(e) {
    e.preventDefault();
    const d = await api.post('/admin/categories', { name });
    if (d.ok) { setName(''); load(1, sort); loadTree(); show('Category added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function save(id) {
    const d = await api.put(`/admin/categories/${id}`, { name: editName });
    if (d.ok) { setEditId(null); load(page, sort); loadTree(); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this category? Any sub-categories mapped to it will become standalone again.')) return;
    const d = await api.del(`/admin/categories/${id}`);
    if (d.ok) { load(page, sort); loadTree(); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  async function unmap(id, catName) {
    if (!confirm(`Un-map "${catName}" from its Parent Category? It'll show under its own name again.`)) return;
    const d = await api.post(`/admin/categories/${id}/unmap`);
    if (d.ok) { load(page, sort); loadTree(); show('Un-mapped'); }
    else show(d.error || 'Failed', 'error');
  }

  // Category Mapping needs to see every category, not just the current page —
  // this is the non-destructive replacement for the old "Merge Categories"
  // (Batch 5 item 5 used to delete the source categories; this only points
  // their parent_id at the chosen Parent Category, item 6).
  async function openMap() {
    setMapParent('');
    setNewParentName('');
    setMapSrcs(new Set());
    setMapOpen(true);
    setMapLoading(true);
    const d = await api.get('/admin/categories?all=1');
    setMapLoading(false);
    if (d.ok) setAllCategories(d.categories);
  }

  function toggleSrc(id) {
    setMapSrcs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Top-level categories only (no parent of their own) are valid mapping
  // targets — keeps the hierarchy to a strict two levels.
  const topLevelCategories = allCategories.filter(c => !c.parent_id);
  // A category that already has sub-categories mapped to it can't also
  // become someone else's sub-category.
  const hasChildren = new Set(allCategories.map(c => c.parent_id).filter(Boolean));
  const mappableSources = allCategories.filter(c => !hasChildren.has(c.id));

  async function runMap(e) {
    e.preventDefault();
    let parentId = mapParent;
    if (parentId === NEW_PARENT) {
      const trimmed = newParentName.trim();
      if (!trimmed) return show('Enter a name for the new Parent Category.', 'error');
      const created = await api.post('/admin/categories', { name: trimmed });
      if (!created.ok) return show(created.error || 'Failed to create parent category', 'error');
      parentId = created.id;
    }
    if (!parentId) return show('Select or create a Parent Category.', 'error');
    const sourceIds = [...mapSrcs].filter(id => String(id) !== String(parentId));
    if (sourceIds.length === 0) return show('Select at least one category to map.', 'error');

    setMapSaving(true);
    let failed = 0;
    for (const id of sourceIds) {
      const d = await api.post(`/admin/categories/${id}/map`, { parentId: Number(parentId) });
      if (!d.ok) { failed++; show(d.error || `Failed to map category ${id}`, 'error'); }
    }
    setMapSaving(false);
    if (failed < sourceIds.length) {
      setMapOpen(false);
      load(1, sort);
      loadTree();
      show(`Mapped ${sourceIds.length - failed} categor${sourceIds.length - failed === 1 ? 'y' : 'ies'}.`);
    }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Categories</h1>
        <button className="btn btn-outline btn-sm" onClick={openMap}>Category Mapping</button>
      </div>

      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          className="form-control" placeholder="New category name" required
          value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 300 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">Add</button>
      </form>

      {/* Parent Category → its mapped sub-categories — Admin's own reference
          view (item 6); customers never see raw category codes anywhere. */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Category Structure</h3>
        <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 12 }}>
          What customers actually see is the Parent Category name — raw codes mapped underneath stay internal.
        </p>
        {treeLoading ? (
          <p style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tree.map(node => (
              <div key={node.id}>
                <strong style={{ color: 'var(--primary)' }}>{node.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--mid)' }}> ({node.product_count} products{node.children.length > 0 ? ' directly' : ''})</span>
                {node.children.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginLeft: 16 }}>
                    {node.children.map(child => (
                      <span key={child.id} className="badge badge-muted" title={`${child.product_count} products`}>
                        {child.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <Th col="name"          sort={sort} onSort={handleSort}>Name</Th>
              <th>Parent Category</th>
              <Th col="product_count" sort={sort} onSort={handleSort}>Products</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No categories yet.</td></tr>
            )}
            {categories.map(c => (
              <tr key={c.id}>
                <td>
                  {editId === c.id
                    ? <input className="form-control form-control-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                    : c.name
                  }
                </td>
                <td>
                  {c.parent_name
                    ? <span className="badge badge-muted">{c.parent_name}</span>
                    : <span style={{ color: 'var(--mid)' }}>—</span>}
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
                      {c.parent_name && (
                        <>
                          <button className="btn btn-sm btn-outline" onClick={() => unmap(c.id, c.name)}>Un-map</button>
                          {' '}
                        </>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => del(c.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} loadingMore={loadingMore} onChange={p => load(p, sort)} onLoadMore={loadMore} />

      {/* ── Category Mapping Modal ── */}
      {mapOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setMapOpen(false); }}>
          <div className="modal-box">
            <h2>Category Mapping</h2>
            <p style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 16 }}>
              Map raw category codes to a friendly Parent Category. Nothing is deleted or moved — products stay in
              their real category; customers just see the Parent Category name everywhere instead.
            </p>
            <form onSubmit={runMap}>
              <div className="form-group">
                <label>Parent Category</label>
                <select className="form-control" required value={mapParent} onChange={e => setMapParent(e.target.value)} disabled={mapLoading}>
                  <option value="">{mapLoading ? 'Loading categories…' : '— Select or create —'}</option>
                  <option value={NEW_PARENT}>+ Create new Parent Category…</option>
                  {topLevelCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.product_count} products)</option>
                  ))}
                </select>
                {mapParent === NEW_PARENT && (
                  <input
                    className="form-control" style={{ marginTop: 8 }} placeholder="New Parent Category name" required
                    value={newParentName} onChange={e => setNewParentName(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Map these raw categories to it</label>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                  {mapLoading && <p style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading…</p>}
                  {!mapLoading && mappableSources
                    .filter(c => String(c.id) !== String(mapParent))
                    .map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={mapSrcs.has(c.id)}
                          onChange={() => toggleSrc(c.id)}
                        />
                        <span>{c.name}</span>
                        {c.parent_name && <span style={{ fontSize: 11, color: 'var(--mid)' }}>(currently → {c.parent_name})</span>}
                        <span style={{ fontSize: 12, color: 'var(--mid)' }}>({c.product_count} products)</span>
                      </label>
                    ))
                  }
                </div>
                <p style={{ fontSize: 11, color: 'var(--mid)', marginTop: 4 }}>
                  A category already mapped will be re-mapped to the new parent. Categories that already have their own sub-categories aren't shown — un-map their children first.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setMapOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={mapSaving || !mapParent || mapSrcs.size === 0}>
                  {mapSaving ? <><span className="spinner" />…</> : 'Map Categories'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
