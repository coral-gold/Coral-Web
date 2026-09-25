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

const VIEW_KEY = 'cg_wholesaler_grid_cols';
const GRID_VIEWS = [1, 2, 3, 4];

function AddButton({ product, inCart, onToggle, className = '' }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    await onToggle(product, inCart);
    setLoading(false);
  }
  return (
    <button
      type="button" className={`btn btn-sm btn-add-cart${inCart ? ' btn-remove-cart' : ' btn-primary'} ${className}`}
      onClick={handleClick} disabled={loading}
    >
      {loading ? <><span className="spinner" />…</> : inCart ? 'Remove' : 'Add to Quotation'}
    </button>
  );
}

function ProductCard({ product, inCart, onToggle, onPreview }) {
  const { settings } = useSiteContent();

  return (
    <div className={`product-card${inCart ? ' in-cart' : ''}`}>
      <CatalogImage
        src={product.image} alt={product.designNo} loading="lazy"
        imgClassName="product-card-img" placeholderClassName="product-card-placeholder"
        onClick={() => onPreview(product.id)}
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
        <AddButton product={product} inCart={inCart} onToggle={onToggle} />
      </div>
    </div>
  );
}

function readStoredView() {
  try {
    const v = parseInt(localStorage.getItem(VIEW_KEY), 10);
    if (GRID_VIEWS.includes(v)) return v;
  } catch {}
  return 3;
}

export default function WholesalerCatalogue() {
  const { cart, add, remove } = useCart();
  const { settings } = useSiteContent();
  const { show } = useToast();
  const openImage = useLightbox();
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [view,       setView]       = useState(readStoredView);
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

  // Load More / infinite scroll (Batch 21 item 4) — fetches the next page
  // under the same active filters and appends rather than replacing.
  async function loadMore() {
    if (page >= pages || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: nextPage, search });
      if (activeCat) params.set('category', activeCat);
      if (activeTag) params.set('tag', activeTag);
      if (netMin !== '' && netMin != null) params.set('netMin', netMin);
      if (netMax !== '' && netMax != null) params.set('netMax', netMax);
      const d = await api.get(`/catalogue?${params}`);
      if (d.ok) {
        setProducts(prev => [...prev, ...d.products]);
        setPage(nextPage);
        setPages(d.pages || 1);
        setTotal(d.total || 0);
      }
    } finally { setLoadingMore(false); }
  }

  useEffect(() => { load(1, activeCat, activeTag, search, netMin, netMax); }, [activeCat, activeTag]);
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { load(1, activeCat, activeTag, search, netMin, netMax); }, 350);
  }, [search, netMin, netMax]);

  function changeView(v) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, String(v)); } catch {}
  }

  const inCartIds = new Set(cart.lines.map(l => l.productId));
  const activeFilterCount = (activeCat ? 1 : 0) + (activeTag ? 1 : 0) + (netMin !== '' || netMax !== '' ? 1 : 0);

  // Adding no longer auto-opens the quotation panel (Batch 19 item 6) — the
  // sticky "Generate Quotation" bar stays visible while browsing instead.
  // The button itself toggles Add ⇄ Remove once added (Batch 21 item 2),
  // shared by the card/row button and the lightbox's own button below.
  async function toggleCart(product, inCart) {
    const d = inCart ? await remove(product.id) : await add(product.id);
    if (d.ok) show(inCart ? 'Removed from quotation' : 'Added to quotation');
    else show(d.error || 'Could not update quotation.', 'error');
    return d.ok ? !inCart : inCart;
  }

  // Shapes a raw /catalogue product list into what the lightbox expects,
  // dropping anything with no image to show.
  function forLightbox(list) {
    return list
      .filter(p => (p.images && p.images.length) || p.image)
      .map(p => ({
        id: p.id,
        images: p.images && p.images.length ? p.images : [p.image],
        inCart: inCartIds.has(p.id),
        label: p.designNo,
      }));
  }

  // Opens the preview on the clicked product, primed with every other
  // currently-loaded product too — swiping right/left inside the preview
  // pages through the whole catalog Tinder-style, not just this one
  // product's own photos (item 2), and Add to Quotation works from there
  // without ever closing the dialog.
  //
  // onLoadMore fetches the catalog's next page under the same filters once
  // the swipe reaches whatever was already loaded when the preview opened
  // (Batch 26 item 1) — previously the preview only ever knew about the
  // page(s) already in `products`, so swiping past the end looped back to
  // item 1 even with more pages left on the server. Deliberately doesn't
  // touch the grid's own `products`/`page` state — the background list
  // keeps whatever pagination the party sees (classic Prev/Next, Load More,
  // or infinite scroll) unchanged by how far they swipe inside the preview.
  function openPreview(productId) {
    const withImages = forLightbox(products);
    const index = withImages.findIndex(p => p.id === productId);
    if (index === -1) return;

    let loadedPage = page;
    async function onLoadMore() {
      if (loadedPage >= pages) return null;
      const nextPage = loadedPage + 1;
      const params = new URLSearchParams({ page: nextPage, search });
      if (activeCat) params.set('category', activeCat);
      if (activeTag) params.set('tag', activeTag);
      if (netMin !== '' && netMin != null) params.set('netMin', netMin);
      if (netMax !== '' && netMax != null) params.set('netMax', netMax);
      const d = await api.get(`/catalogue?${params}`);
      if (!d.ok || !d.products || !d.products.length) return null;
      loadedPage = nextPage;
      return forLightbox(d.products);
    }

    openImage({
      products: withImages,
      index,
      onToggle: p => toggleCart(p, p.inCart),
      // Omit entirely when every page is already loaded — nothing to fetch,
      // and the lightbox then wraps around immediately on its own instead
      // of hinting at more (a "+") that doesn't actually exist.
      onLoadMore: page < pages ? onLoadMore : undefined,
    });
  }

  return (
    <WholesalerLayout wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, color: 'var(--garnet)', margin: 0 }}>
          Catalogue
        </h1>
        <div className="grid-cols-picker" role="group" aria-label="Catalogue view">
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
                  <button key={c.name} className={`filter-btn${activeCat === c.name ? ' active' : ''}`} onClick={() => setActiveCat(c.name)}>
                    {c.name} <span className="filter-count">({c.count})</span>
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

      <div className={`product-grid cols-${view}`}>
        {products.map(p => (
          <ProductCard key={p.id} product={p} inCart={inCartIds.has(p.id)} onToggle={toggleCart} onPreview={openPreview} />
        ))}
      </div>

      {!loading && products.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0' }}>No products found.</p>
      )}

      <Pagination
        page={page} pages={pages} total={total} loadingMore={loadingMore}
        onChange={p => load(p, activeCat, activeTag, search, netMin, netMax)}
        onLoadMore={loadMore}
      />

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
