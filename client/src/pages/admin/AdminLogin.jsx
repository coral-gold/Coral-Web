import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSiteContent } from '../../context/SiteContentContext';
import { handleLogoError } from '../../utils/image';

export default function AdminLogin() {
  const { logoUrl } = useSiteContent();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { adminLogin, admin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) navigate('/admin/dashboard', { replace: true });
  }, [admin]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const d = await adminLogin(username, password);
      if (d.ok) navigate('/admin/dashboard');
      else setError(d.error || 'Login failed.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="section-wholesaler" style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--pink-pale) 0%, var(--off-white) 60%)' }}>
      <div className="admin-login-wrap">
        <div className="admin-login-box">
          <img className="logo-img" src={logoUrl} alt="Coral Gold" onError={handleLogoError} />
          <h1>Admin Panel</h1>
          {error && (
            <div className="alert alert-error">
              {error}
              {(error.includes('not configured') || error.includes('Server error') || error.includes('connection')) && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  → <a href="/api/health" target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>View Diagnostics</a>
                </div>
              )}
            </div>
          )}
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Username</label>
              <input className="form-control" required value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-control" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" />Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
