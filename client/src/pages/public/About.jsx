import React, { useEffect, useState } from 'react';
import PublicLayout from '../../components/PublicLayout';
import api from '../../api';

export default function About() {
  const [content, setContent] = useState({});
  useEffect(() => {
    api.get('/public/content').then(d => { if (d.ok) setContent(d.content); }).catch(() => {});
  }, []);

  const text = content.about_text || 'Coral Gold is a premier wholesale jewellery house specialising in handcrafted gold ornaments. With decades of expertise, we bring the finest craftsmanship to wholesalers across India.';

  return (
    <PublicLayout>
      <section className="hero" style={{ padding: '64px 20px' }}>
        <div className="container">
          <h1>About Coral Gold</h1>
          <div className="gold-line" />
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="section-title">
            <h2>Our Story</h2>
            <div className="gold-line" />
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--mid)', whiteSpace: 'pre-line' }}>{text}</p>

          <div className="features-grid" style={{ marginTop: 48 }}>
            {[
              { icon: '🏆', title: 'Premium Quality',   desc: 'Only the finest gold and gemstones, sourced responsibly.' },
              { icon: '🤝', title: 'Trusted Partners',  desc: 'Long-standing relationships with wholesalers across India.' },
              { icon: '📐', title: 'Precise Weights',   desc: 'Every piece weighed and documented for complete transparency.' },
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
    </PublicLayout>
  );
}
