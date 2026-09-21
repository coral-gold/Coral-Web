import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [party, setParty]       = useState(null);
  const [admin, setAdmin]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/auth/party/me').catch(() => ({ ok: false })),
      api.get('/auth/admin/me').catch(() => ({ ok: false })),
    ]).then(([p, a]) => {
      if (p.ok) setParty(p.party);
      if (a.ok) setAdmin(a.admin);
    }).finally(() => setLoading(false));
  }, []);

  async function partyLogin(partyId, password) {
    const d = await api.post('/auth/party/login', { partyId, password });
    if (d.ok) {
      const me = await api.get('/auth/party/me');
      if (me.ok) setParty(me.party);
    }
    return d;
  }

  async function partyLogout() {
    await api.post('/auth/party/logout');
    setParty(null);
  }

  async function adminLogin(username, password) {
    const d = await api.post('/auth/admin/login', { username, password });
    if (d.ok) {
      const me = await api.get('/auth/admin/me');
      if (me.ok) setAdmin(me.admin);
    }
    return d;
  }

  async function adminLogout() {
    await api.post('/auth/admin/logout');
    setAdmin(null);
  }

  return (
    <AuthCtx.Provider value={{ party, admin, loading, partyLogin, partyLogout, adminLogin, adminLogout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
