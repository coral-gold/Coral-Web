import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/setup';

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(1); // 1=DB, 2=Admin, 3=Done
  const [db, setDb]           = useState({ host: 'localhost', user: '', password: '', database: 'coralgold' });
  const [admin, setAdmin]     = useState({ username: 'admin', password: '', confirm: '' });
  const [status, setStatus]   = useState('');   // 'testing' | 'ok' | 'error'
  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);

  function dbChange(e) { setDb(p => ({ ...p, [e.target.name]: e.target.value })); setStatus(''); }
  function adChange(e) { setAdmin(p => ({ ...p, [e.target.name]: e.target.value })); }

  async function testDb() {
    setLoading(true); setStatus('testing'); setMsg('');
    try {
      const r = await fetch(`${API}/test-db`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db),
      });
      const d = await r.json();
      if (d.ok) { setStatus('ok'); setMsg('Connection successful!'); }
      else      { setStatus('error'); setMsg(d.error || 'Connection failed.'); }
    } catch { setStatus('error'); setMsg('Network error.'); }
    finally { setLoading(false); }
  }

  async function runSetup() {
    if (admin.password !== admin.confirm) { setMsg('Passwords do not match.'); return; }
    if (admin.password.length < 6)        { setMsg('Password must be at least 6 characters.'); return; }
    setLoading(true); setMsg('');
    try {
      const r = await fetch(`${API}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...db, adminUser: admin.username, adminPass: admin.password }),
      });
      const d = await r.json();
      if (d.ok) { setStep(3); }
      else      { setMsg(d.error || 'Setup failed.'); }
    } catch { setMsg('Network error.'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--gold2)', fontSize: 26, fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>✦ Coral Gold</div>
          <div style={{ fontSize: 13, color: 'var(--mid)' }}>First-Run Setup Wizard</div>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: step >= n ? 'var(--gold)' : 'var(--border)',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        {/* Step 1 — Database */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 17, marginBottom: 20, color: 'var(--dark)' }}>Step 1 — Database Connection</h2>

            {['host','user','database'].map(k => (
              <div className="form-group" key={k}>
                <label style={{ textTransform: 'capitalize' }}>{k === 'host' ? 'DB Host' : k === 'user' ? 'DB Username' : 'Database Name'}</label>
                <input className="form-control" name={k} value={db[k]} onChange={dbChange} placeholder={k === 'host' ? 'localhost' : k === 'database' ? 'coralgold' : ''} />
              </div>
            ))}
            <div className="form-group">
              <label>DB Password <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(leave blank if none)</span></label>
              <input className="form-control" name="password" type="password" value={db.password} onChange={dbChange} autoComplete="new-password" />
            </div>

            {msg && (
              <div className={`alert ${status === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>{msg}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={testDb} disabled={loading || !db.host || !db.user || !db.database}>
                {loading && status === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              <button className="btn btn-primary" onClick={() => { setMsg(''); setStep(2); }} disabled={status !== 'ok'} style={{ flex: 1 }}>
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Admin Account */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 17, marginBottom: 20, color: 'var(--dark)' }}>Step 2 — Admin Account</h2>

            <div className="form-group">
              <label>Admin Username</label>
              <input className="form-control" name="username" value={admin.username} onChange={adChange} autoComplete="username" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="form-control" name="password" type="password" value={admin.password} onChange={adChange} autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input className="form-control" name="confirm" type="password" value={admin.confirm} onChange={adChange} autoComplete="new-password" />
            </div>

            {msg && <div className="alert alert-error">{msg}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => { setMsg(''); setStep(1); }} style={{ minWidth: 80 }}>← Back</button>
              <button className="btn btn-primary" onClick={runSetup} disabled={loading || !admin.username || !admin.password} style={{ flex: 1 }}>
                {loading ? 'Setting up…' : 'Complete Setup'}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 style={{ fontSize: 20, marginBottom: 10, color: 'var(--dark)' }}>Setup Complete!</h2>
            <p style={{ color: 'var(--mid)', marginBottom: 28, lineHeight: 1.6 }}>
              Database configured and admin account created. You can now sign in to the admin panel.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/admin')}>
              Go to Admin Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
