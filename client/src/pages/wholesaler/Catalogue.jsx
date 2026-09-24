import React, { useEffect, useState, useCallback, useRef } from 'react';
import WholesalerLayout from '../../components/WholesalerLayout';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { useLightbox } from '../../components/ImageLightbox';
import api from '../../api';

function ProductCard({ product, inCart }) {
  const { add, cart, setPanelOpen } = useCart();
  const { show } = useToast();
  const openImage = useLightbox();
  const [qty,     setQty]     = useState(1);
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    const d = await add(product.id, qty);
    setLoading(false);
    if (d.ok) { show('Added to quotation'); setPanelOpen(true); }
    else show(d.error || 'Could not add item.', 'error');
  }

  return (
    <div className={`product-card${inCart ? ' in-cart' : ''}`}>
      {product.image
        ? <img src={product.image} className="product-card-img" alt={product.designNo} loading="lazy" onClick={() => openImage(product.image)} style={{ cursor: 'zoom-in' }} />
        : <div className="product-card-placeholder">💍</div>
      }
      <div className="product-card-body">
        <div className="weight-primary">{product.grossWeight}g <span>gross wt.</span></div>
        <div className="weight-net">{product.netWeight}g net wt.</div>
        <div className="product-code">{product.designNo} &bull; {product.jewelCode}</div>
        <div className="qty-stepper">
          <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <input
            type="number" min="1" value={qty}
            onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <button type="button" onClick={() => setQty(q => q + 1)}>+</button>
        </div>
        <button
          type="button" className="btn btn-primary btn-sm btn-add-cart"
          onClick={handleAdd} disabled={loading}
        >
          {loading ? <><span className="spinner" />Adding…</> : 'Add to Quotation'}
        </button>
      </div>
    </div>
  );
}

export default function WholesalerCatalogue() {
  const { cart } = useCart();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat,  setActiveCat]  = useState('');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    api.get('/catalogue/categories').then(d => { if (d.ok) setCategories(d.categories); });
  }, []);

  const load = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const d = await api.get(
        `/catalogue?page=${p}&category=${encodeURIComponent(activeCat)}&search=${encodeURIComponent(search)}`
      );
      if (d.ok) {
        setProducts(prev => reset ? d.products : [...prev, ...d.products]);
        setHasMore(d.hasMore);
        setPage(p + 1);
      }
    } finally { setLoading(false); }
  }, [activeCat, search, page, loading]);

  useEffect(() => { setPage(1); load(true); }, [activeCat]);
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(true); }, 350);
  }, [search]);

  const inCartIds = new Set(cart.lines.map(l => l.productId));

  return (
    <WholesalerLayout>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: 'var(--garnet)', marginBottom: 20 }}>
        Catalogue
      </h1>

      <div className="search-bar">
        <input
          type="search" className="form-control"
          placeholder="Search by design no. or jewel code…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="catalogue-filters">
        <button className={`filter-btn${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>All</button>
        {categories.map(c => (
          <button key={c} className={`filter-btn${activeCat === c ? ' active' : ''}`} onClick={() => setActiveCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading && products.length === 0 && (
        <p style={{ color: 'var(--mid)' }}>Loading…</p>
      )}

      <div className="product-grid">
        {products.map(p => (
          <ProductCard key={p.id} product={p} inCart={inCartIds.has(p.id)} />
        ))}
      </div>

      {!loading && products.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0' }}>No products found.</p>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button className="btn btn-outline" onClick={() => load(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </WholesalerLayout>
  );
}
