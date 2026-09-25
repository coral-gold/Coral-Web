import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { useLightbox } from '../../components/ImageLightbox';
import { handleImgError } from '../../utils/image';
import api from '../../api';

const EMPTY = { design_number: '', jewel_code: '', category_ids: [], gross_weight: '', net_weight: '', amount: '', description: '', is_featured: false, tags: '' };
const VIEW_KEY = 'cg_admin_products_view';
const GRID_VIEWS = [1, 2, 3, 4];

function readStoredView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'table') return 'table';
    const n = parseInt(v, 10);
    if (GRID_VIEWS.includes(n)) return n;
  } catch {}
  return 'table';
}

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
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [allTags,       setAllTags]       = useState([]);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [sort,          setSort]          = useState({ col: 'design_number', dir: 'asc' });
  // Grid/table view + Category/Tag/weight-range filters — same as the
  // wholesaler catalogue, for consistency (Batch 23 item 3). Filter option
  // lists are the customer-facing resolved names (Parent Category, not raw
  // ERP code), from the same unauthenticated endpoints the catalogue uses.
  const [view,           setView]           = useState(readStoredView);
  const [filterCats,     setFilterCats]     = useState([]);
  const [filterTags,     setFilterTags]     = useState([]);
  const [filterOptsLoading, setFilterOptsLoading] = useState(true);
  const [activeCat,      setActiveCat]      = useState('');
  const [activeTag,      setActiveTag]      = useState('');
  const [netMin,         setNetMin]         = useState('');
  const [netMax,         setNetMax]         = useState('');
  const [filtersOpen,    setFiltersOpen]    = useState(false);
  const [modal,         setModal]         = useState(false);
  const [form,          setForm]          = useState(EMPTY);
  const [editId,        setEditId]        = useState(null);
  const [imageFile,     setImageFile]     = useState(null);
  const [editImageUrl,  setEditImageUrl]  = useState(null);
  const [saving,        setSaving]        = useState(false);
  // Gallery: extra angle/close-up photos beyond the primary image, shown as
  // a swipeable preview on the customer side (item 1). Only editable once a
  // product has an id to attach them to — a brand-new "Add Product" has to
  // be saved first.
  const [galleryImages,    setGalleryImages]    = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryFileRef = useRef(null);
  // Bulk
  const [selected,      setSelected]      = useState(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false); // true once "select all N matching" is applied
  const [selectingAll,  setSelectingAll]  = useState(false);
  const [bulkAction,    setBulkAction]    = useState('');
  const [bulkCatId,     setBulkCatId]     = useState('');
  const [bulkSaving,    setBulkSaving]    = useState(false);
  // Quick edit
  const [qeId,          setQeId]          = useState(null);
  const [qeForm,        setQeForm]        = useState({});
  const [qeSaving,      setQeSaving]      = useState(false);
  const { show } = useToast();
  const openImage = useLightbox();
  const debounce = useRef(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  // Real server-side pagination: always fetches and renders exactly one page
  // (25 rows) at a time — never accumulates the whole catalog client-side.

  function buildParams(p, s) {
    const params = new URLSearchParams({ page: p, q: search, sort: s.col, order: s.dir });
    if (activeCat) params.set('category', activeCat);
    if (activeTag) params.set('tag', activeTag);
    if (netMin !== '' && netMin != null) params.set('netMin', netMin);
    if (netMax !== '' && netMax != null) params.set('netMax', netMax);
    return params;
  }

  async function load(p, s) {
    setLoading(true);
    const d = await api.get(`/admin/products?${buildParams(p, s)}`);
    setLoading(false);
    if (d.ok) {
      // A delete/bulk-delete can empty out the last page — step back one page automatically.
      if (d.products.length === 0 && p > 1) return load(p - 1, s);
      setProducts(d.products);
      setPage(p);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
      setSelected(new Set());
      setSelectAllMatching(false);
    }
  }

  // Load More / infinite scroll (Batch 21 item 4) — appends the next page
  // under the current search/sort instead of replacing, and leaves the
  // bulk-selection state alone (rows already selected stay selected).
  async function loadMore() {
    if (page >= pages || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const d = await api.get(`/admin/products?${buildParams(nextPage, sort)}`);
    setLoadingMore(false);
    if (d.ok) {
      setProducts(prev => [...prev, ...d.products]);
      setPage(nextPage);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    }
  }

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    load(1, newSort);
  }

  function goToPage(p) {
    return load(p, sort);
  }

  useEffect(() => {
    api.get('/admin/categories?all=1').then(d => { if (d.ok) setCategories(d.categories); setLoadingCategories(false); });
    api.get('/admin/tags').then(d => { if (d.ok) setAllTags(d.tags.map(t => t.name)); });
    // Same customer-facing filter option lists the wholesaler catalogue uses
    // (resolved Parent Category names, not raw ERP codes) — item 3.
    Promise.all([
      api.get('/catalogue/categories').then(d => { if (d.ok) setFilterCats(d.categories); }),
      api.get('/catalogue/tags').then(d => { if (d.ok) setFilterTags(d.tags); }),
    ]).finally(() => setFilterOptsLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { load(1, sort); }, 350);
  }, [search, netMin, netMax]);

  // Also covers the very first load (activeCat/activeTag start at '').
  useEffect(() => { load(1, sort); }, [activeCat, activeTag]);

  function changeView(v) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, String(v)); } catch {}
  }

  // ── Full edit modal ───────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY); setEditId(null); setImageFile(null); setEditImageUrl(null);
    setGalleryImages([]); setModal(true);
  }
  function openEdit(p) {
    setForm({
      design_number: p.design_number || '',
      jewel_code:    p.jewel_code    || '',
      category_ids:  (p.categories && p.categories.length ? p.categories.map(c => String(c.id)) : [String(p.category_id || '')]).filter(Boolean),
      gross_weight:  p.gross_weight  || '',
      net_weight:    p.net_weight    || '',
      amount:        p.amount        || '',
      description:   p.description   || '',
      is_featured:   !!p.is_featured,
      tags:          (p.tags || []).map(t => t.name).join(', '),
    });
    setEditId(p.id); setImageFile(null); setEditImageUrl(p.image_url || null); setModal(true);
    setGalleryImages([]);
    api.get(`/admin/products/${p.id}/images`).then(d => { if (d.ok) setGalleryImages(d.images); });
  }

  async function addGalleryImage(e) {
    const file = e.target.files?.[0];
    if (!file || !editId) return;
    setGalleryUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const d = await api.form(`/admin/products/${editId}/images`, fd);
    setGalleryUploading(false);
    if (d.ok) setGalleryImages(prev => [...prev, d.image]);
    else show(d.error || 'Failed to add image.', 'error');
    e.target.value = '';
  }

  async function deleteGalleryImage(imageId) {
    const d = await api.del(`/admin/products/${editId}/images/${imageId}`);
    if (d.ok) setGalleryImages(prev => prev.filter(img => img.id !== imageId));
    else show(d.error || 'Failed to delete image.', 'error');
  }

  function toggleFormCategory(id) {
    setForm(f => {
      const ids = f.category_ids.includes(id) ? f.category_ids.filter(x => x !== id) : [...f.category_ids, id];
      return { ...f, category_ids: ids };
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.category_ids.length) return show('Select at least one category.', 'error');
    setSaving(true);
    const fd = new FormData();
    fd.append('category_id', form.category_ids[0]);
    form.category_ids.forEach(id => fd.append('category_ids', id));
    fd.append('design_number', form.design_number);
    fd.append('jewel_code',    form.jewel_code);
    fd.append('gross_weight',  form.gross_weight);
    fd.append('net_weight',    form.net_weight);
    fd.append('amount',        form.amount ?? '');
    fd.append('description',   form.description ?? '');
    fd.append('is_featured',   form.is_featured ? '1' : '0');
    fd.append('tags',          form.tags ?? '');
    if (imageFile) fd.append('image', imageFile);
    const d = editId
      ? await api.formPut(`/admin/products/${editId}`, fd)
      : await api.form('/admin/products', fd);
    setSaving(false);
    if (d.ok) { setModal(false); load(editId ? page : 1, sort); show(editId ? 'Updated' : 'Product added'); }
    else show(d.error || 'Failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this product?')) return;
    const d = await api.del(`/admin/products/${id}`);
    if (d.ok) {
      load(page, sort);
      show(d.softDeleted ? 'Deleted — this product has past quotations, so its history was kept.' : 'Deleted');
    } else show(d.error || 'Failed', 'error');
  }

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function toggleFeatured(p) {
    const d = await api.patch(`/admin/products/${p.id}/featured`);
    if (d.ok) {
      setProducts(prev => prev.map(row => row.id === p.id ? { ...row, is_featured: d.is_featured ? 1 : 0 } : row));
      show(d.is_featured ? 'Marked as Featured' : 'Removed from Featured');
    } else show('Failed', 'error');
  }

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
    if (d.ok) { setQeId(null); load(page, sort); show('Saved'); }
    else show(d.error || 'Failed', 'error');
  }

  const setQeF = k => e => setQeForm(f => ({ ...f, [k]: e.target.value }));

  // ── Selection & bulk ──────────────────────────────────────────────────────
  // toggleAll only ever affects rows on the current page. Selecting every row
  // on a page (when more pages exist) surfaces a prompt to extend the
  // selection to every product matching the current search, across all pages.

  function toggleAll() {
    const pageIds = products.map(p => p.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
    setSelectAllMatching(false);
    if (allOnPageSelected) {
      setSelected(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => new Set([...prev, ...pageIds]));
    }
  }

  function toggleOne(id) {
    setSelectAllMatching(false);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function selectAllAcrossPages() {
    setSelectingAll(true);
    const d = await api.get(`/admin/products/ids?q=${encodeURIComponent(search)}`);
    setSelectingAll(false);
    if (d.ok) {
      setSelected(new Set(d.ids));
      setSelectAllMatching(true);
    } else {
      show('Failed to select all matching products.', 'error');
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectAllMatching(false);
  }

  // Export PDF returns a binary file, not the { ok, ... } JSON every other
  // bulk action uses, so it can't go through api.post — fetch it directly
  // and trigger a download from the returned blob.
  async function exportPdf(ids) {
    setBulkSaving(true);
    try {
      const resp = await fetch('/api/admin/products/export-pdf', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (HTTP ${resp.status}).`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'products-export.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBulkAction('');
      show(`Exported ${ids.length} product(s) to PDF.`);
    } catch (e) {
      show(e.message || 'Export failed', 'error');
    } finally {
      setBulkSaving(false);
    }
  }

  async function applyBulk() {
    if (!bulkAction) return show('Select an action.', 'error');
    const ids = [...selected];
    if (!ids.length) return;
    if (bulkAction === 'delete') {
      if (!confirm(`This will delete ${ids.length} product(s). This cannot be undone for products with no quotation history. Continue?`)) return;
    }
    if (bulkAction === 'change_category' && !bulkCatId) {
      return show('Select a target category.', 'error');
    }
    if (bulkAction === 'export_pdf') return exportPdf(ids);
    setBulkSaving(true);
    const payload = { action: bulkAction, ids };
    if (bulkAction === 'change_category') payload.category_id = Number(bulkCatId);
    const d = await api.post('/admin/products/bulk', payload);
    setBulkSaving(false);
    if (d.ok) {
      setBulkAction('');
      setBulkCatId('');
      load(1, sort);
      if (bulkAction === 'delete' && d.softDeleted > 0) {
        show(`Deleted ${d.hardDeleted} product(s); ${d.softDeleted} hidden (used in past quotations).`);
      } else {
        show(`Done: ${d.affected} product(s) updated.`);
      }
    } else {
      show(d.error || 'Failed', 'error');
    }
  }

  const pageIds = products.map(p => p.id);
  const allOnPageChecked = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const anySelected = selected.size > 0;
  const morePagesExist = total > products.length;
  const showSelectAllPrompt = allOnPageChecked && !selectAllMatching && morePagesExist;

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Products</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="grid-cols-picker" role="group" aria-label="Products view">
            <button
              type="button" className={`grid-cols-btn${view === 'table' ? ' active' : ''}`}
              onClick={() => changeView('table')} title="Table view"
            >
              ☰ Table
            </button>
            {GRID_VIEWS.map(n => (
              <button
                key={n} type="button"
                className={`grid-cols-btn${view === n ? ' active' : ''}`}
                onClick={() => changeView(n)}
                title={n === 1 ? 'Single column' : `${n} × ${n} grid`}
              >
                {n}×{n}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: 12 }}>
        <input type="search" className="form-control" placeholder="Search by design no., jewel code or category…"
               value={search} onChange={e => setSearch(e.target.value)} />
        {/* Category/Tag/weight-range — collapsed by default, same pattern as
            the wholesaler catalogue (item 3). */}
        <button
          type="button"
          className={`btn btn-outline filter-toggle-btn${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
        >
          Filter
          {(activeCat || activeTag || netMin !== '' || netMax !== '') && (
            <span className="filter-count-badge">
              {(activeCat ? 1 : 0) + (activeTag ? 1 : 0) + (netMin !== '' || netMax !== '' ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="catalogue-filters-panel">
          <div className="weight-range-filter">
            <span className="catalogue-filters-label">Net Wt. (g):</span>
            <input
              type="number" min="0" step="0.1" className="form-control form-control-sm"
              placeholder="Min" value={netMin} onChange={e => setNetMin(e.target.value)}
            />
            <span className="weight-range-sep">–</span>
            <input
              type="number" min="0" step="0.1" className="form-control form-control-sm"
              placeholder="Max" value={netMax} onChange={e => setNetMax(e.target.value)}
            />
            {(netMin !== '' || netMax !== '') && (
              <button type="button" className="btn-link-clear" onClick={() => { setNetMin(''); setNetMax(''); }}>
                Clear
              </button>
            )}
          </div>

          <div className="catalogue-filters">
            {filterOptsLoading ? (
              <span style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading categories…</span>
            ) : (
              <>
                <button className={`filter-btn${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>All</button>
                {filterCats.map(c => (
                  <button key={c} className={`filter-btn${activeCat === c ? ' active' : ''}`} onClick={() => setActiveCat(c)}>
                    {c}
                  </button>
                ))}
              </>
            )}
          </div>

          {!filterOptsLoading && filterTags.length > 0 && (
            <div className="catalogue-filters catalogue-tag-filters">
              <span className="catalogue-filters-label">Tags:</span>
              <button className={`filter-btn filter-btn-tag${activeTag === '' ? ' active' : ''}`} onClick={() => setActiveTag('')}>All</button>
              {filterTags.map(t => (
                <button key={t} className={`filter-btn filter-btn-tag${activeTag === t ? ' active' : ''}`} onClick={() => setActiveTag(t === activeTag ? '' : t)}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-primary btn-sm filter-panel-apply" onClick={() => setFiltersOpen(false)}>
            Apply Filters
          </button>
        </div>
      )}

      {/* Bulk toolbar */}
      {anySelected && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'rgba(139,0,0,0.05)', borderRadius: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--garnet)' }}>
              {selectAllMatching ? `All ${selected.size} product(s) selected` : `${selected.size} selected`}
            </span>
            <select className="form-control form-control-sm" value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkCatId(''); }}
                    style={{ width: 'auto', minWidth: 180 }}>
              <option value="">— Choose action —</option>
              <option value="delete">Delete</option>
              <option value="change_category">Change Category</option>
              <option value="delete_image">Delete Image</option>
              <option value="export_pdf">Export PDF</option>
            </select>
            {bulkAction === 'change_category' && (
              <select className="form-control form-control-sm" value={bulkCatId} onChange={e => setBulkCatId(e.target.value)}
                      disabled={loadingCategories} style={{ width: 'auto', minWidth: 160 }}>
                <option value="">{loadingCategories ? 'Loading categories…' : '— Select category —'}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={bulkSaving || !bulkAction}>
              {bulkSaving ? <><span className="spinner" />…</> : 'Apply'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={clearSelection}>Clear</button>
          </div>
          {showSelectAllPrompt && (
            <div style={{ fontSize: 13, padding: '6px 12px', color: 'var(--mid)' }}>
              All {products.length} products on this page are selected.{' '}
              <button
                className="btn-link"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--garnet)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={selectAllAcrossPages}
                disabled={selectingAll}
              >
                {selectingAll ? 'Selecting…' : `Select all ${total} products matching this search`}
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'table' ? (
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 32, padding: '8px 6px' }}>
                <input type="checkbox" checked={allOnPageChecked} onChange={toggleAll} title="Select all on this page" />
              </th>
              <th>Image</th>
              <Th col="design_number" sort={sort} onSort={handleSort}>Design No.</Th>
              <Th col="jewel_code"    sort={sort} onSort={handleSort}>Jewel Code</Th>
              <Th col="category_name" sort={sort} onSort={handleSort}>Category</Th>
              <Th col="gross_weight"  sort={sort} onSort={handleSort}>Gross Wt.</Th>
              <Th col="net_weight"    sort={sort} onSort={handleSort}>Net Wt.</Th>
              <th title="Shown in the Home page's Signature Items section">Featured</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No products yet.</td></tr>
            )}
            {products.map(p => (
              <React.Fragment key={p.id}>
                <tr style={{ background: selected.has(p.id) ? 'rgba(139,0,0,0.04)' : undefined }}>
                  <td style={{ padding: '8px 6px' }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                  </td>
                  <td>
                    {p.image_url
                      ? <img src={p.image_url} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in' }} alt="" onClick={() => openImage(p.image_url)} onError={handleImgError} />
                      : '—'}
                  </td>
                  <td>{p.design_number}</td>
                  <td>{p.jewel_code}</td>
                  <td>{p.categories && p.categories.length ? p.categories.map(c => c.name).join(', ') : p.category_name}</td>
                  <td>{p.gross_weight ? parseFloat(p.gross_weight).toFixed(3) + 'g' : '—'}</td>
                  <td>{p.net_weight   ? parseFloat(p.net_weight).toFixed(3)   + 'g' : '—'}</td>
                  <td>
                    <button
                      type="button" onClick={() => toggleFeatured(p)}
                      title={p.is_featured ? 'Remove from Signature Items' : 'Show in Signature Items on Home page'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2, color: p.is_featured ? 'var(--secondary)' : '#ccc' }}
                    >
                      {p.is_featured ? '★' : '☆'}
                    </button>
                  </td>
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
                  <tr style={{ background: 'var(--cream)' }}>
                    <td colSpan={9} style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                          <label style={{ fontSize: 11 }}>Primary Category</label>
                          <select className="form-control form-control-sm" value={qeForm.category_id} onChange={setQeF('category_id')}
                                  disabled={loadingCategories}>
                            <option value="">{loadingCategories ? 'Loading…' : '— select —'}</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          {p.categories && p.categories.length > 1 && (
                            <p style={{ fontSize: 10, color: 'var(--mid)', marginTop: 2 }}>
                              Also in: {p.categories.filter(c => String(c.id) !== qeForm.category_id).map(c => c.name).join(', ')} — use Edit for full category list.
                            </p>
                          )}
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
      ) : (
        <div className={`product-grid cols-${view}`}>
          {products.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0', gridColumn: '1 / -1' }}>No products yet.</p>
          )}
          {products.map(p => (
            <div key={p.id} className="product-card">
              {p.image_url
                ? <img src={p.image_url} className="product-card-img" alt="" style={{ cursor: 'zoom-in' }} onClick={() => openImage(p.image_url)} onError={handleImgError} />
                : <div className="product-card-placeholder">💍</div>}
              <div className="product-card-body">
                <div className="product-code">{p.design_number} &bull; {p.jewel_code}</div>
                <div style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 4 }}>
                  {p.categories && p.categories.length ? p.categories.map(c => c.name).join(', ') : p.category_name}
                </div>
                <div className="weight-secondary">
                  {p.net_weight ? parseFloat(p.net_weight).toFixed(3) + 'g net' : '—'}
                  {p.gross_weight ? ` · ${parseFloat(p.gross_weight).toFixed(3)}g gross` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => openEdit(p)}>Edit</button>
                  <button
                    type="button" onClick={() => toggleFeatured(p)}
                    title={p.is_featured ? 'Remove from Signature Items' : 'Show in Signature Items on Home page'}
                    style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 10px', color: p.is_featured ? 'var(--secondary)' : '#ccc' }}
                  >
                    {p.is_featured ? '★' : '☆'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} loadingMore={loadingMore} onChange={p => goToPage(p)} onLoadMore={loadMore} />

      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box">
            <h2>{editId ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={submit}>
              <div className="form-group">
                <label>Categories * <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(select one or more)</span></label>
                <div className="category-picker">
                  {loadingCategories ? (
                    <p style={{ fontSize: 13, color: 'var(--mid)', padding: 8 }}><span className="spinner-dark" />Loading categories…</p>
                  ) : categories.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--mid)', padding: 8 }}>No categories yet — add one in Categories first.</p>
                  ) : categories.map(c => {
                    const id = String(c.id);
                    const checked = form.category_ids.includes(id);
                    return (
                      <label key={c.id} className={`category-picker-item${checked ? ' checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFormCategory(id)} />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
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
                <label>Amount <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(diamond/stone content, e.g. "2.5ct" or "12 pcs")</span></label>
                <input className="form-control" value={form.amount} onChange={setF('amount')} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={setF('description')} />
              </div>
              <div className="form-group">
                <label>Tags <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(comma separated — used for wholesaler catalogue filtering)</span></label>
                <input
                  className="form-control" value={form.tags} onChange={setF('tags')}
                  placeholder="e.g. bridal, lightweight, new arrival"
                  list="product-tag-suggestions"
                />
                <datalist id="product-tag-suggestions">
                  {allTags.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={!!form.is_featured}
                    onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  Featured — show in "Signature Items" on the Home page
                </label>
              </div>
              <div className="form-group">
                <label>Image {editId && <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
                {editImageUrl && (
                  <img
                    src={editImageUrl} alt="Current"
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, display: 'block', marginBottom: 8, cursor: 'zoom-in' }}
                    onClick={() => openImage(editImageUrl)} onError={handleImgError}
                  />
                )}
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
              </div>
              <div className="form-group">
                <label>
                  Additional Images
                  <span style={{ color: 'var(--mid)', fontWeight: 400 }}> (extra angles — shown as a swipeable gallery in the customer preview)</span>
                </label>
                {!editId ? (
                  <p style={{ fontSize: 12, color: 'var(--mid)' }}>Save the product first, then add extra images here.</p>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {galleryImages.map(img => (
                      <div key={img.id} style={{ position: 'relative', width: 60, height: 60 }}>
                        <img
                          src={img.url} alt="" onClick={() => openImage(img.url)} onError={handleImgError}
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in', display: 'block' }}
                        />
                        <button
                          type="button" onClick={() => deleteGalleryImage(img.id)} title="Remove"
                          style={{
                            position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                            background: 'var(--primary)', color: '#fff', border: '2px solid #fff', cursor: 'pointer',
                            fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >×</button>
                      </div>
                    ))}
                    <button
                      type="button" className="btn btn-outline btn-sm" onClick={() => galleryFileRef.current?.click()}
                      disabled={galleryUploading}
                    >
                      {galleryUploading ? <><span className="spinner" />…</> : '+ Add Image'}
                    </button>
                    <input ref={galleryFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addGalleryImage} />
                  </div>
                )}
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
