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
          <NavLink className="logo" to="/admin/dashboard">⚙ Coral Gold Admin</NavLink>
          <nav>
            {NAV.map(n => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#c8b8a8', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
              Logout
            </button>
          </nav>
        </div>
      </header>
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
