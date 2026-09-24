import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const SiteContentCtx = createContext({ content: {}, logoUrl: '/logo.png', loaded: false });

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState({});
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    api.get('/public/content').then(d => {
      if (d.ok) setContent(d.content);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // Admin can upload a custom logo (Admin > Content); fall back to the
  // default brand asset when none has been set.
  const logoUrl = content.site_logo || '/logo.png';

  return (
    <SiteContentCtx.Provider value={{ content, logoUrl, loaded }}>
      {children}
    </SiteContentCtx.Provider>
  );
}

export function useSiteContent() { return useContext(SiteContentCtx); }
