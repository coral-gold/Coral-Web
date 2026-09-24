import React, { useEffect, useState, useRef } from 'react';
import WholesalerLayout from '../../components/WholesalerLayout';
import Pagination from '../../components/Pagination';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { useLightbox } from '../../components/ImageLightbox';
import api from '../../api';

function ProductCard({ product, inCart }) {
  const { add, setPanelOpen } = useCart();
  const { show } = useToast();
  const openImage = useLightbox();
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    const d = await add(product.id);
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
        {/* Priority order: Net Weight (most prominent), Gross Weight, Amount */}
        <div className="weight-primary">{product.netWeight}g <span>net wt.</span></div>
        <div className="weight-secondary">{product.grossWeight}g gross wt.</div>
        {product.amount && <div className="product-amount">Amount: {product.amount}</div>}
        <div className="product-code">{product.designNo} &bull; {product.jewelCode}</div>
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

export default function WholesalerCatalogue() {
  const { cart } = useCart();
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat,  setActiveCat]  = useState('');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    api.get('/catalogue/categories').then(d => { if (d.ok) setCategories(d.categories); });
  }, []);

  // Real server-side pagination — fetches and renders one page at a time,
  // same approach as the admin panel (Batch 15 item 3).
  async function load(p, cat, s) {
    setLoading(true);
    try {
      const d = await api.get(
        `/catalogue?page=${p}&category=${encodeURIComponent(cat)}&search=${encodeURIComponent(s)}`
      );
      if (d.ok) {
        setProducts(d.products);
        setPage(p);
        setPages(d.pages || 1);
        setTotal(d.total || 0);
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1, activeCat, search); }, [activeCat]);
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { load(1, activeCat, search); }, 350);
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

      <Pagination page={page} pages={pages} total={total} onChange={p => load(p, activeCat, search)} />
    </WholesalerLayout>
  );
}
