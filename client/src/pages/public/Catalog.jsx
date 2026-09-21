import React, { useEffect, useState, useCallback, useRef } from 'react';
import PublicLayout from '../../components/PublicLayout';
import api from '../../api';

export default function Catalog() {
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
      const d = await api.get(`/catalogue?mode=public&page=${p}&category=${encodeURIComponent(activeCat)}&search=${encodeURIComponent(search)}`);
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

  return (
    <PublicLayout>
      <section className="hero" style={{ padding: '48px 20px' }}>
        <div className="container">
          <h1 style={{ fontSize: 38 }}>Our Catalogue</h1>
          <div className="gold-line" />
          <p style={{ fontSize: 15 }}>Browse our collection — login as a wholesaler to place orders.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="search-bar mb-2">
            <input
              type="search"
              className="form-control"
              placeholder="Search by design number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="catalogue-filters mb-2">
            <button className={`filter-btn${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>
              All
            </button>
            {categories.map(c => (
              <button key={c} className={`filter-btn${activeCat === c ? ' active' : ''}`} onClick={() => setActiveCat(c)}>
                {c}
              </button>
            ))}
          </div>

          {loading && products.length === 0 && (
            <p style={{ color: 'var(--mid)', padding: '20px 0' }}>Loading…</p>
          )}

          <div className="catalog-grid">
            {products.map(p => (
              <div key={p.id} className="pub-card">
                {p.image
                  ? <img src={p.image} className="pub-card-img" alt={p.designNo} loading="lazy" />
                  : <div className="pub-card-img-placeholder">💍</div>
                }
                <div className="pub-card-body">
                  <div className="design-no">{p.designNo}</div>
                  <p style={{ fontSize: 13, color: 'var(--mid)' }}>{p.category}</p>
                  {p.description && <p style={{ fontSize: 13, marginTop: 4 }}>{p.description}</p>}
                </div>
              </div>
            ))}
          </div>

          {!loading && products.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0' }}>No products found.</p>
          )}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button className="btn btn-outline" onClick={() => load(false)} disabled={loading}>
                {loading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
