import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function WholesalerLogin() {
  const [partyId,   setPartyId]   = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const { partyLogin, party } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (party) navigate('/wholesaler/catalogue', { replace: true });
  }, [party]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const d = await partyLogin(partyId, password);
      if (d.ok) navigate('/wholesaler/catalogue');
      else setError(d.error || 'Login failed.');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="section-wholesaler" style={{ minHeight: '100vh', background: 'var(--dark)' }}>
      <div className="login-wrap">
        <div className="login-box">
          <div className="logo">✦ Coral Gold</div>
          <h2>Wholesaler Portal</h2>
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
              <label>Party ID</label>
              <input className="form-control" required value={partyId} onChange={e => setPartyId(e.target.value)} autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-control" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" />Signing in…</> : 'Sign In'}
            </button>
          </form>
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--mid)' }}>
            <Link to="/">← Back to public site</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
