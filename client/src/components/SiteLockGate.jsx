import React, { useState } from 'react';
import { useSiteContent } from '../context/SiteContentContext';
import api from '../api';

// Gates the public marketing site (Home/About/Catalog/Contact) behind a
// single shared password when Admin turns it on in Settings. Wholesaler and
// Admin routes never import this — their own logins are unaffected.
export default function SiteLockGate({ children }) {
  const { settings, locked, loaded, recheckLock } = useSiteContent();
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(false);

  if (!loaded) return null;
  if (!settings.siteLockEnabled || !locked) return children;

  async function submit(e) {
    e.preventDefault();
    setError(''); setChecking(true);
    const d = await api.post('/public/site-lock/verify', { password });
    setChecking(false);
    if (d.ok) { setPassword(''); recheckLock(); }
    else setError(d.error || 'Incorrect password.');
  }

  return (
    <div className="section-wholesaler" style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--pink-pale) 0%, var(--off-white) 60%)' }}>
      <div className="login-wrap">
        <div className="login-box">
          <img className="logo-img" src="/logo.png" alt="Coral Gold" style={{ height: 46, margin: '0 auto 6px' }} />
          <h2>This site is locked</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Password</label>
              <input
                className="form-control" type="password" required autoFocus
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={checking} style={{ width: '100%' }}>
              {checking ? <><span className="spinner" />Checking…</> : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
