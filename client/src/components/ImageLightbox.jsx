import React, { createContext, useContext, useState, useEffect } from 'react';

const LightboxCtx = createContext(null);

// Mounted once at the app root. Any component can call useLightbox() to get
// an openImage(url) function — clicking a thumbnail anywhere in the app
// opens the same shared full-size preview overlay.
export function ImageLightboxProvider({ children }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!src) return;
    function onKey(e) { if (e.key === 'Escape') setSrc(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src]);

  return (
    <LightboxCtx.Provider value={setSrc}>
      {children}
      {src && (
        <div className="lightbox-backdrop" onClick={() => setSrc(null)}>
          <button className="lightbox-close" onClick={() => setSrc(null)} aria-label="Close">×</button>
          <img src={src} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </LightboxCtx.Provider>
  );
}

// Returns openImage(url) — call it from an onClick to preview that image.
// Falsy url is a no-op, so callers don't need to guard for "no image yet".
export function useLightbox() {
  const setSrc = useContext(LightboxCtx);
  return (url) => { if (url) setSrc(url); };
}
