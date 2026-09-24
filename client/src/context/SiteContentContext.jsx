import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const DEFAULT_SETTINGS = { wholesalerEnabled: true, siteLockEnabled: false, showNetWeight: true, showGrossWeight: true, showAmount: true };

const SiteContentCtx = createContext({ content: {}, settings: DEFAULT_SETTINGS, logoUrl: '/logo.png', locked: false, loaded: false, recheckLock: () => {} });

export function SiteContentProvider({ children }) {
  const [content,  setContent]  = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [locked,   setLocked]   = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  // /public/settings is never gated by the site lock (the lock screen itself
  // needs it to know whether to show up); /public/content is, so a 423 there
  // is how the app learns the visitor hasn't unlocked it yet.
  function load() {
    return Promise.all([
      api.get('/public/content').then(d => {
        if (d.ok) { setContent(d.content); setLocked(false); }
        else if (d.locked) setLocked(true);
      }).catch(() => {}),
      api.get('/public/settings').then(d => { if (d.ok) setSettings(d.settings); }).catch(() => {}),
    ]);
  }

  useEffect(() => { load().finally(() => setLoaded(true)); }, []);

  // Admin can upload a custom logo (Admin > Settings); fall back to the
  // default brand asset when none has been set.
  const logoUrl = content.site_logo || '/logo.png';

  return (
    <SiteContentCtx.Provider value={{ content, settings, logoUrl, locked, loaded, recheckLock: load }}>
      {children}
    </SiteContentCtx.Provider>
  );
}

export function useSiteContent() { return useContext(SiteContentCtx); }
