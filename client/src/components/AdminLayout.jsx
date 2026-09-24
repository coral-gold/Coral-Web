import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { handleLogoError } from '../utils/image';
import { useToast } from './Toast';
import api from '../api';

// Main section nav — lives in exactly one place, the sidebar (rendered as a
// horizontally-scrollable bar on mobile, see .admin-mobile-nav). Settings,
// Change Password, Logout and the Wholesaler Login shortcut are account/
// cross-portal actions, not sections, so they live only in the top bar —
// nothing here is duplicated between the two (Batch 19 item 7).
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

function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirm,         setConfirm]         = useState('');
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);
  const { show } = useToast();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('New passwords do not match.'); return; }
    setSaving(true);
    const d = await api.post('/auth/admin/change-password', { currentPassword, newPassword });
    setSaving(false);
    if (d.ok) { show('Password changed'); onClose(); }
    else setError(d.error || 'Failed to change password.');
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <h2>Change Password</h2>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Current Password *</label>
            <input className="form-control" type="password" required autoComplete="current-password"
                   value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input className="form-control" type="password" required autoComplete="new-password"
                   value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input className="form-control" type="password" required autoComplete="new-password"
                   value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" />Saving…</> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { admin, adminLogout, loading } = useAuth();
  const { logoUrl } = useSiteContent();
  const navigate = useNavigate();
  const [pwModal, setPwModal] = useState(false);

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
            <img className="logo-img" src={logoUrl} alt="Coral Gold Admin" onError={handleLogoError} />
          </NavLink>
          <nav className="admin-header-nav">
            <a href="/wholesaler/login" target="_blank" rel="noreferrer">Wholesaler Login</a>
            <NavLink to="/admin/settings">Settings</NavLink>
            <button onClick={() => setPwModal(true)}>Change Password</button>
            <button onClick={handleLogout}>Logout</button>
          </nav>
        </div>
      </header>
      {/* Same main-section nav as the sidebar, just rendered as a horizontally
          scrollable bar below ~900px instead of a fixed left column — one nav
          system, two responsive presentations (Batch 19 item 7). */}
      <nav className="admin-mobile-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => isActive ? 'active' : ''}>
            {n.label}
          </NavLink>
        ))}
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
      {pwModal && <ChangePasswordModal onClose={() => setPwModal(false)} />}
    </div>
  );
}
