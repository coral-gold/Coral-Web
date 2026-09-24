import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const LightboxCtx = createContext(null);

// Accepts every shape existing call sites already use, plus the new
// gallery/add-to-quotation shape (item 1):
//  - a plain URL string            → single-image preview, no Add button
//  - an array of URL strings       → swipeable gallery, no Add button
//  - { images, index?, canAdd?, inCart?, onToggle? } → full gallery + the
//    inline Add/Remove toggle, used by the wholesaler catalogue card
function normalize(arg) {
  if (!arg) return null;
  if (typeof arg === 'string') return { images: [arg], index: 0 };
  if (Array.isArray(arg)) {
    const images = arg.filter(Boolean);
    return images.length ? { images, index: 0 } : null;
  }
  if (typeof arg === 'object') {
    const images = (arg.images || []).filter(Boolean);
    if (!images.length) return null;
    const index = Math.min(Math.max(arg.index || 0, 0), images.length - 1);
    return { images, index, canAdd: !!arg.onToggle, inCart: !!arg.inCart, onToggle: arg.onToggle };
  }
  return null;
}

// Mounted once at the app root. Any component can call useLightbox() to get
// an openImage(arg) function — clicking a thumbnail anywhere in the app
// opens the same shared full-size preview overlay, now with swipe/arrow
// navigation through a product's whole gallery and, where the caller wires
// it up, an inline Add/Remove Quotation button — no need to close the
// preview first (item 1/2). Keeping every step inside one dialog matters
// most for less tech-comfortable customers: fewer taps, one place to look.
export function ImageLightboxProvider({ children }) {
  const [state, setState] = useState(null);
  const touchStartX = useRef(null);
  const touchDeltaX  = useRef(0);

  function openImage(arg) { setState(normalize(arg)); }
  function close() { setState(null); }
  function go(delta) {
    setState(s => {
      if (!s) return s;
      const n = s.images.length;
      return { ...s, index: (s.index + delta + n) % n };
    });
  }

  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; }
  function onTouchMove(e)  { if (touchStartX.current != null) touchDeltaX.current = e.touches[0].clientX - touchStartX.current; }
  function onTouchEnd() {
    if (Math.abs(touchDeltaX.current) > 40) go(touchDeltaX.current < 0 ? 1 : -1);
    touchStartX.current = null; touchDeltaX.current = 0;
  }

  async function handleToggle() {
    if (!state?.onToggle || state.adding) return;
    setState(s => ({ ...s, adding: true }));
    const nextInCart = await state.onToggle();
    setState(s => (s ? { ...s, adding: false, inCart: typeof nextInCart === 'boolean' ? nextInCart : s.inCart } : s));
  }

  return (
    <LightboxCtx.Provider value={openImage}>
      {children}
      {state && (
        <div className="lightbox-backdrop" onClick={close}>
          <button className="lightbox-close" onClick={close} aria-label="Close">×</button>

          <div
            className="lightbox-gallery"
            onClick={e => e.stopPropagation()}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          >
            {state.images.length > 1 && (
              <button className="lightbox-arrow lightbox-arrow-left" onClick={() => go(-1)} aria-label="Previous image">‹</button>
            )}
            <img src={state.images[state.index]} alt="" className="lightbox-img" />
            {state.images.length > 1 && (
              <button className="lightbox-arrow lightbox-arrow-right" onClick={() => go(1)} aria-label="Next image">›</button>
            )}
          </div>

          {state.images.length > 1 && (
            <div className="lightbox-dots" onClick={e => e.stopPropagation()}>
              {state.images.map((_, i) => (
                <button
                  key={i}
                  className={`lightbox-dot${i === state.index ? ' active' : ''}`}
                  onClick={() => setState(s => ({ ...s, index: i }))}
                  aria-label={`Image ${i + 1} of ${state.images.length}`}
                />
              ))}
            </div>
          )}

          {state.canAdd && (
            <button
              type="button"
              className={`lightbox-add-btn${state.inCart ? ' in-cart' : ''}`}
              onClick={e => { e.stopPropagation(); handleToggle(); }}
              disabled={state.adding}
            >
              {state.adding
                ? <><span className="spinner" />…</>
                : state.inCart ? 'Remove from Quotation' : 'Add to Quotation'}
            </button>
          )}
        </div>
      )}
    </LightboxCtx.Provider>
  );
}

// Returns openImage(arg) — call it from an onClick to preview an image, an
// image array, or the full gallery/add-to-quotation object (see normalize
// above). A falsy/empty arg is a no-op, so callers don't need to guard for
// "no image yet".
export function useLightbox() {
  return useContext(LightboxCtx);
}
