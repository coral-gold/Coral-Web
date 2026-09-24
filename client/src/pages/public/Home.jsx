import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/PublicLayout';
import { useLightbox } from '../../components/ImageLightbox';
import CatalogImage from '../../components/CatalogImage';
import { useSiteContent } from '../../context/SiteContentContext';
import api from '../../api';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const { content, settings } = useSiteContent();
  const openImage = useLightbox();

  useEffect(() => {
    api.get('/catalogue/featured').then(d => {
      if (d.ok) setFeatured(d.products);
    }).catch(() => {});
  }, []);

  const heroTitle    = content.home_hero_title    || 'Premium Gold Jewellery';
  const heroSubtitle = content.home_hero_subtitle || 'Crafted with excellence for discerning wholesalers';

  return (
    <PublicLayout>
      <section className="hero">
        <div className="container">
          <h1>{heroTitle}</h1>
          <div className="gold-line" />
          <p>{heroSubtitle}</p>
          <div className="hero-buttons">
            <Link to="/catalog" className="btn btn-gold">Browse Catalogue</Link>
            {settings.wholesalerEnabled && (
              <Link to="/wholesaler/login" className="btn btn-outline">
                Wholesaler Login
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-title">
            <h2>Why Coral Gold?</h2>
            <div className="gold-line" />
          </div>
          <div className="features-grid">
            {[
              { icon: '✦', title: 'Handcrafted Quality', desc: 'Every piece is meticulously crafted by skilled artisans using traditional techniques.' },
              { icon: '⚖', title: 'Accurate Weights', desc: 'Gross and net weights displayed prominently for transparent wholesale pricing.' },
              { icon: '📋', title: 'Instant Quotations', desc: 'Build your order and generate a professional PDF quotation in seconds.' },
              { icon: '🔒', title: 'Secure Accounts', desc: 'Private wholesaler portal with dedicated Party ID and secure login.' },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Admin-curated Signature Items — hidden entirely until Admin marks at
          least one product as Featured (Products page), rather than showing
          an arbitrary/hardcoded selection. */}
      {featured.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <div className="section-title">
              <h2>Signature Items</h2>
              <div className="gold-line" />
            </div>
            <div className="catalog-grid">
              {featured.map(p => (
                <div key={p.id} className="pub-card">
                  <CatalogImage
                    src={p.image} alt={p.designNo} loading="lazy"
                    imgClassName="pub-card-img" placeholderClassName="pub-card-img-placeholder"
                    onClick={() => openImage(p.image)}
                  />
                  <div className="pub-card-body">
                    <div className="design-no">{p.designNo}</div>
                    {p.description && <p>{p.description}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Link to="/catalog" className="btn btn-outline">View Full Catalogue</Link>
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
