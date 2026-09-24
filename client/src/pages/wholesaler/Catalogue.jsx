import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import WholesalerLayout from '../../components/WholesalerLayout';
import Pagination from '../../components/Pagination';
import CatalogImage from '../../components/CatalogImage';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { useLightbox } from '../../components/ImageLightbox';
import { useSiteContent } from '../../context/SiteContentContext';
import api from '../../api';

const GRID_COLS_KEY = 'cg_wholesaler_grid_cols';

function ProductCard({ product, inCart }) {
  const { add } = useCart();
  const { show } = useToast();
  const openImage = useLightbox();
  const { settings } = useSiteContent();
  const [loading, setLoading] = useState(false);

  // Adding no longer auto-opens the quotation panel (item 6) — the sticky
  // "Generate Quotation" bar stays visible while browsing instead, so
  // adding several items in a row doesn't get interrupted each time.
  async function handleAdd() {
    setLoading(true);
    const d = await add(product.id);
    setLoading(false);
    if (d.ok) show('Added to quotation');
    else show(d.error || 'Could not add item.', 'error');
  }

  return (
    <div className={`product-card${inCart ? ' in-cart' : ''}`}>
      <CatalogImage
        src={product.image} alt={product.designNo} loading="lazy"
        imgClassName="product-card-img" placeholderClassName="product-card-placeholder"
        onClick={() => openImage(product.image)}
      />
      <div className="product-card-body">
        {/* Priority order: Net Weight (most prominent), Gross Weight, Amount —
            each hideable site-wide from Admin > Settings > Field Visibility. */}
        {settings.showNetWeight && <div className="weight-primary">{product.netWeight}g <span>net wt.</span></div>}
        {settings.showGrossWeight && <div className="weight-secondary">{product.grossWeight}g gross wt.</div>}
        {settings.showAmount && product.amount && <div className="product-amount">Amount: {product.amount}</div>}
        <div className="product-code">{product.designNo} &bull; {product.jewelCode}</div>
        {product.tags && product.tags.length > 0 && (
          <div className="product-tags">
            {product.tags.slice(0, 3).map(t => <span key={t} className="product-tag-chip">{t}</span>)}
          </div>
        )}
        <button
          type="button" className="btn btn-primary btn-sm btn-add-cart"
          onClick={handleAdd} disabled={loading || inCart}
        >
          {loading ? <><span className="spinner" />Adding…</> : inCart ? 'In Quotation' : 'Add to Quotation'}
        </button>
      </div>
    </div>
  );
}

function readStoredCols() {
  try {
    const v = parseInt(localStorage.getItem(GRID_COLS_KEY), 10);
    return [2, 3, 4].includes(v) ? v : 3;
  } catch { return 3; }
}

export default function WholesalerCatalogue() {
  const { cart } = useCart();
  const { settings } = useSiteContent();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags,        setTags]       = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [activeCat,  setActiveCat]  = useState('');
  const [activeTag,  setActiveTag]  = useState('');
  const [search,     setSearch]     = useState('');
  const [netMin,     setNetMin]     = useState('');
  const [netMax,     setNetMax]     = useState('');
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [gridCols,   setGridCols]   = useState(readStoredCols);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/catalogue/categories').then(d => { if (d.ok) setCategories(d.categories); }),
      api.get('/catalogue/tags').then(d => { if (d.ok) setTags(d.tags); }),
    ]).finally(() => setFiltersLoading(false));
  }, []);

  // Real server-side pagination — fetches and renders one page at a time,
  // same approach as the admin panel (Batch 15 item 3).
  async function load(p, cat, tag, s, min, max) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, search: s });
      if (cat) params.set('category', cat);
      if (tag) params.set('tag', tag);
      if (min !== '' && min != null) params.set('netMin', min);
      if (max !== '' && max != null) params.set('netMax', max);
      const d = await api.get(`/catalogue?${params}`);
      if (d.ok) {
        setProducts(d.products);
        setPage(p);
        setPages(d.pages || 1);
        setTotal(d.total || 0);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1, activeCat, activeTag, search, netMin, netMax); }, [activeCat, activeTag]);
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { load(1, activeCat, activeTag, search, netMin, netMax); }, 350);
  }, [search, netMin, netMax]);

  function changeGridCols(n) {
    setGridCols(n);
    try { localStorage.setItem(GRID_COLS_KEY, String(n)); } catch {}
  }

  const inCartIds = new Set(cart.lines.map(l => l.productId));
  const activeFilterCount = (activeCat ? 1 : 0) + (activeTag ? 1 : 0) + (netMin !== '' || netMax !== '' ? 1 : 0);

  return (
    <WholesalerLayout wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, color: 'var(--garnet)', margin: 0 }}>
          Catalogue
        </h1>
        <div className="grid-cols-picker" role="group" aria-label="Grid view">
          {[2, 3, 4].map(n => (
            <button
              key={n} type="button"
              className={`grid-cols-btn${gridCols === n ? ' active' : ''}`}
              onClick={() => changeGridCols(n)}
              title={`${n} × ${n} grid`}
            >
              {n}×{n}
            </button>
          ))}
        </div>
      </div>

      <div className="search-bar">
        <input
          type="search" className="form-control"
          placeholder="Search by design no. or jewel code…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {/* Category/Tag/weight-range stay hidden until opened — most visits
            don't need them, and keeping them collapsed by default declutters
            the catalogue on both mobile and desktop (item 3). */}
        <button
          type="button"
          className={`btn btn-outline filter-toggle-btn${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
        >
          Filter
          {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <div className="catalogue-filters-panel">
          {settings.showNetWeight && (
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
          )}

          <div className="catalogue-filters">
            {filtersLoading ? (
              <span style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading categories…</span>
            ) : (
              <>
                <button className={`filter-btn${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>All</button>
                {categories.map(c => (
                  <button key={c} className={`filter-btn${activeCat === c ? ' active' : ''}`} onClick={() => setActiveCat(c)}>
                    {c}
                  </button>
                ))}
              </>
            )}
          </div>

          {!filtersLoading && tags.length > 0 && (
            <div className="catalogue-filters catalogue-tag-filters">
              <span className="catalogue-filters-label">Tags:</span>
              <button className={`filter-btn filter-btn-tag${activeTag === '' ? ' active' : ''}`} onClick={() => setActiveTag('')}>All</button>
              {tags.map(t => (
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

      {loading && products.length === 0 && (
        <p style={{ color: 'var(--mid)' }}><span className="spinner-dark" />Loading…</p>
      )}

      <div className={`product-grid cols-${gridCols}`}>
        {products.map(p => (
          <ProductCard key={p.id} product={p} inCart={inCartIds.has(p.id)} />
        ))}
      </div>

      {!loading && products.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0' }}>No products found.</p>
      )}

      <Pagination page={page} pages={pages} total={total} onChange={p => load(p, activeCat, activeTag, search, netMin, netMax)} />

      {/* Clears the fixed sticky bar below so it never covers the last row. */}
      <div style={{ height: 76 }} />

      {/* Always visible while browsing — takes the party straight to the
          Quotation screen instead of auto-opening a panel on every add
          (item 2/6). */}
      <Link to="/wholesaler/quotation" className="sticky-quotation-bar">
        <span className="sticky-quotation-icon">🛒</span>
        Generate Quotation
        {cart.itemCount > 0 && <span className="sticky-quotation-count">{cart.itemCount}</span>}
      </Link>
    </WholesalerLayout>
  );
}
