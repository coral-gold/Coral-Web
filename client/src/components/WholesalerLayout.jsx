import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSiteContent } from '../context/SiteContentContext';
import { handleLogoError } from '../utils/image';

export default function WholesalerLayout({ children, wide }) {
  const { party, partyLogout, loading } = useAuth();
  const { cart, refresh } = useCart();
  const { logoUrl, settings, loaded } = useSiteContent();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !party) navigate('/wholesaler/login', { replace: true });
  }, [party, loading, navigate]);

  // Admin can disable the wholesaler module at any time — cut an already-open
  // session off immediately rather than leaving it looking usable while every
  // API call quietly starts failing.
  useEffect(() => {
    if (loaded && !settings.wholesalerEnabled) navigate('/wholesaler/login', { replace: true });
  }, [loaded, settings.wholesalerEnabled, navigate]);

  useEffect(() => {
    if (party) refresh();
  }, [party]);

  if (loading || !party) return null;

  async function handleLogout() {
    await partyLogout();
    navigate('/wholesaler/login');
  }

  return (
    <div className="section-wholesaler">
      <header className="site-header">
        <div className="container">
          <Link className="logo" to="/wholesaler/catalogue">
            <img className="logo-img" src={logoUrl} alt="Coral Gold" onError={handleLogoError} />
          </Link>
          <nav>
            <Link to="/wholesaler/catalogue">Catalogue</Link>
            <Link to="/wholesaler/quotations">My Quotations</Link>
            <Link to="/wholesaler/quotation" className={`cart-badge ${cart.itemCount > 0 ? 'has-items' : ''}`}>
              🛒 <span>{cart.itemCount}</span>
            </Link>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--mid)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className={`wholesaler-main${wide ? ' wholesaler-main-wide' : ''}`}>
        {children}
      </main>
    </div>
  );
}
