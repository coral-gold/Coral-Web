import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/PublicLayout';
import { useLightbox } from '../../components/ImageLightbox';
import api from '../../api';

// Public catalog is a preview, not the real catalogue: a limited set of
// categories with a few sample images each, meant to invite wholesalers to
// log in for the full listing (Batch 15 item 3) rather than serve as a
// browsable/searchable product listing.
export default function Catalog() {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const openImage = useLightbox();

  useEffect(() => {
    api.get('/catalogue/preview').then(d => {
      if (d.ok) setCategories(d.categories);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      <section className="hero" style={{ padding: '48px 20px' }}>
        <div className="container">
          <h1 style={{ fontSize: 38 }}>Our Catalogue</h1>
          <div className="gold-line" />
          <p style={{ fontSize: 15 }}>A preview of our collection — log in as a wholesaler to browse the full catalogue and place orders.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {loading && <p style={{ color: 'var(--mid)', padding: '20px 0' }}>Loading…</p>}

          {!loading && categories.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '40px 0' }}>No products available yet.</p>
          )}

          {categories.map(cat => (
            <div key={cat.name} style={{ marginBottom: 40 }}>
              <div className="section-title" style={{ textAlign: 'left', marginBottom: 16 }}>
                <h2 style={{ fontSize: 22 }}>{cat.name}</h2>
                <div className="gold-line" style={{ margin: '6px 0 0' }} />
              </div>
              <div className="catalog-grid">
                {cat.products.map(p => (
                  <div key={p.id} className="pub-card">
                    {p.image
                      ? <img src={p.image} className="pub-card-img" alt={p.designNo} loading="lazy" onClick={() => openImage(p.image)} style={{ cursor: 'zoom-in' }} />
                      : <div className="pub-card-img-placeholder">💍</div>
                    }
                    <div className="pub-card-body">
                      <div className="design-no">{p.designNo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!loading && categories.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 20, padding: '32px 20px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
              <p style={{ marginBottom: 16, color: 'var(--mid)' }}>
                This is a preview — log in as a wholesaler to see the full catalogue, weights, and place orders.
              </p>
              <Link to="/wholesaler/login" className="btn btn-primary">Wholesaler Login</Link>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
