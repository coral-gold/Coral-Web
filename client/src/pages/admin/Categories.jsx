import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const NEW_PARENT = '__new__';

// A single node in the Category Structure tree — a top-level category (with
// or without mapped children) or one of its mapped children. Exactly one
// Edit and one Delete action per node (plus Un-map for a mapped child) —
// previously the same category could appear once in a read-only tree card
// AND again as its own row in a separate flat table below, each with its
// own Edit/Delete, which looked like duplicated entries (Batch 24 item 1).
function CategoryNode({ node, depth, expanded, onToggle, editId, editName, setEditName,
                         onStartEdit, onSaveEdit, onCancelEdit, onDelete, onUnmap }) {
  const hasChildren = node.children && node.children.length > 0;
  const isEditing = editId === node.id;

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 6px', paddingLeft: 6 + depth * 26,
          borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
        }}
      >
        {hasChildren ? (
          <button
            type="button" onClick={() => onToggle(node.id)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mid)', fontSize: 11, width: 16, padding: 0 }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 16, display: 'inline-block' }} />
        )}

        {isEditing ? (
          <input
            className="form-control form-control-sm" style={{ maxWidth: 220 }}
            value={editName} onChange={e => setEditName(e.target.value)} autoFocus
          />
        ) : (
          <strong style={{ color: depth === 0 ? 'var(--primary)' : 'var(--near-black, #0f0f0f)' }}>{node.name}</strong>
        )}

        <span style={{ fontSize: 12, color: 'var(--mid)' }}>
          ({node.product_count} product{node.product_count === 1 ? '' : 's'})
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {isEditing ? (
            <>
              <button className="btn btn-sm btn-primary" onClick={() => onSaveEdit(node.id)}>Save</button>
              <button className="btn btn-sm btn-outline" onClick={onCancelEdit}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn btn-sm btn-outline" onClick={() => onStartEdit(node)}>Edit</button>
              {node.parent_id && (
                <button className="btn btn-sm btn-outline" onClick={() => onUnmap(node)}>Un-map</button>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(node)}>Delete</button>
            </>
          )}
        </div>
      </div>

      {hasChildren && expanded && node.children.map(child => (
        <CategoryNode
          key={child.id} node={child} depth={depth + 1}
          expanded={expanded} onToggle={onToggle}
          editId={editId} editName={editName} setEditName={setEditName}
          onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
          onDelete={onDelete} onUnmap={onUnmap}
        />
      ))}
    </>
  );
}

export default function Categories() {
  const [tree,          setTree]          = useState([]);
  const [treeLoading,   setTreeLoading]   = useState(true);
  const [expandedIds,   setExpandedIds]   = useState(new Set());
  const [allCategories, setAllCategories] = useState([]); // full flat list, for the mapping picker only
  const [name,          setName]          = useState('');
  const [editId,        setEditId]        = useState(null);
  const [editName,      setEditName]      = useState('');
  const [mapOpen,       setMapOpen]       = useState(false);
  const [mapParent,     setMapParent]     = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [mapSrcs,       setMapSrcs]       = useState(new Set());
  const [mapLoading,    setMapLoading]    = useState(false);
  const [mapSaving,     setMapSaving]     = useState(false);
  const { show } = useToast();

  async function loadTree() {
    setTreeLoading(true);
    const d = await api.get('/admin/categories/tree');
    setTreeLoading(false);
    if (d.ok) {
      setTree(d.tree);
      // Newly-mapped parents should show their children right away.
      setExpandedIds(prev => {
        const next = new Set(prev);
        for (const node of d.tree) if (node.children.length > 0) next.add(node.id);
        return next;
      });
    }
  }

  useEffect(() => { loadTree(); }, []);

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function add(e) {
    e.preventDefault();
    const d = await api.post('/admin/categories', { name });
    if (d.ok) { setName(''); loadTree(); show('Category added'); }
    else show(d.error || 'Failed', 'error');
  }

  function startEdit(node) { setEditId(node.id); setEditName(node.name); }
  function cancelEdit()   { setEditId(null); }

  async function saveEdit(id) {
    const d = await api.put(`/admin/categories/${id}`, { name: editName });
    if (d.ok) { setEditId(null); loadTree(); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(node) {
    const warn = node.children && node.children.length > 0
      ? ` Its ${node.children.length} mapped sub-categor${node.children.length === 1 ? 'y' : 'ies'} will become standalone again.`
      : '';
    if (!confirm(`Delete "${node.name}"?${warn}`)) return;
    const d = await api.del(`/admin/categories/${node.id}`);
    if (d.ok) { loadTree(); show('Deleted'); }
    else show(d.error || 'Failed', 'error');
  }

  async function unmap(node) {
    if (!confirm(`Un-map "${node.name}" from its Parent Category? It'll show under its own name again.`)) return;
    const d = await api.post(`/admin/categories/${node.id}/unmap`);
    if (d.ok) { loadTree(); show('Un-mapped'); }
    else show(d.error || 'Failed', 'error');
  }

  // Category Mapping needs to see every category, not just what's currently
  // expanded — this is the non-destructive replacement for the old "Merge
  // Categories" (Batch 5 item 5 used to delete the source categories; this
  // only points their parent_id at the chosen Parent Category, item 6).
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

      {/* Single tree — each Parent Category expands to reveal its mapped
          sub-categories, one Edit/Delete (and Un-map, for a child) per node.
          What customers actually see is the Parent Category name — raw
          codes mapped underneath stay internal to this view (item 6). */}
      <div className="admin-card">
        <h3 style={{ marginBottom: 4 }}>Category Structure</h3>
        <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 12 }}>
          What customers actually see is the Parent Category name — raw codes mapped underneath stay internal.
        </p>
        {treeLoading ? (
          <p style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading…</p>
        ) : tree.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--mid)', padding: '12px 0' }}>No categories yet.</p>
        ) : (
          <div>
            {tree.map(node => (
              <CategoryNode
                key={node.id} node={node} depth={0}
                expanded={expandedIds.has(node.id)} onToggle={toggleExpanded}
                editId={editId} editName={editName} setEditName={setEditName}
                onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={cancelEdit}
                onDelete={del} onUnmap={unmap}
              />
            ))}
          </div>
        )}
      </div>

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
