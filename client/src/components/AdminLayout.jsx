import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin/dashboard',   label: 'Dashboard' },
  { to: '/admin/categories',  label: 'Categories' },
  { to: '/admin/products',    label: 'Products' },
  { to: '/admin/import',      label: 'Import' },
  { to: '/admin/parties',     label: 'Parties' },
  { to: '/admin/quotations',  label: 'Quotations' },
  { to: '/admin/content',     label: 'Content' },
  { to: '/admin/media',       label: 'Media' },
];

export default function AdminLayout({ children }) {
  const { admin, adminLogout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !admin) navigate('/admin', { replace: true });
  }, [admin, loading, navigate]);

  if (loading || !admin) return null;

  async function handleLogout() {
    await adminLogout();
    navigate('/admin');
  }

  return (
    <div className="section-admin">
      <header className="admin-header">
        <div className="container">
          <NavLink className="logo" to="/admin/dashboard">
            <img className="logo-img" src="/logo.png" alt="Coral Gold Admin" />
          </NavLink>
          <nav className="admin-header-nav">
            {NAV.map(n => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--mid)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <nav className="admin-mobile-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => isActive ? 'active' : ''}>
            {n.label}
          </NavLink>
        ))}
        <button onClick={handleLogout}>Logout</button>
      </nav>
      <div className="admin-layout">
        <nav className="admin-sidebar">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
