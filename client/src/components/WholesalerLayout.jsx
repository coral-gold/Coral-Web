import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import QuotationPanel from './QuotationPanel';

export default function WholesalerLayout({ children }) {
  const { party, partyLogout, loading } = useAuth();
  const { cart, refresh, setPanelOpen, panelOpen } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !party) navigate('/wholesaler/login', { replace: true });
  }, [party, loading, navigate]);

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
          <span className="logo">✦ Coral Gold</span>
          <nav>
            <Link to="/wholesaler/catalogue">Catalogue</Link>
            <Link to="/wholesaler/quotations">My Quotations</Link>
            <button
              className={`cart-badge ${cart.pieceCount > 0 ? 'has-items' : ''}`}
              onClick={() => setPanelOpen(true)}
            >
              🛒 <span>{cart.pieceCount}</span> pcs
            </button>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#c8b8a8', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>
      <QuotationPanel />
    </div>
  );
}
