import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const LightboxCtx = createContext(null);

// Every call site funnels into one internal shape: a list of "products"
// (each its own image or small gallery) plus a current product/image
// position. That's what makes the Tinder-style catalog swipe (item 2) and
// the older single-product gallery swipe (Batch 21 item 1) the same code
// path — a single-product call is just a products list of length 1.
//
// Accepted inputs:
//  - a plain URL string       → one product, one image
//  - an array of URL strings  → one product, its own swipeable gallery
//  - { images, index?, inCart?, onToggle? }
//        → one product (Batch 21 shape) — swipe/arrows move through ITS
//          images. Used where there's no "whole catalog" to page through:
//          admin thumbnails, the public preview, a cart line item.
//  - { products: [{ images, inCart?, ...}], index?, onToggle?, onLoadMore? }
//        → the catalog itself (Batch 22 item 2) — swipe/arrows step through
//          the current product's own images first, then continue seamlessly
//          into the next/previous product once those run out (Batch 23
//          item 5); the dots still jump straight to one of the current
//          product's images. onToggle(product) is called with whichever
//          product is currently showing. onLoadMore, when given, is called
//          when a forward swipe/arrow reaches the last currently-loaded
//          product — it should fetch the catalog's next page and resolve to
//          the newly available products (same shape as `products`), or a
//          falsy/empty result once there's genuinely nothing left to load.
//          Without this, swiping past whatever was in memory when the
//          preview opened would loop back to item 1 even though the
//          catalog had more pages server-side (Batch 26 item 1).
function normalize(arg) {
  if (!arg) return null;
  if (typeof arg === 'string') {
    return { products: [{ images: [arg] }], productIndex: 0, imageIndex: 0 };
  }
  if (Array.isArray(arg)) {
    const images = arg.filter(Boolean);
    return images.length ? { products: [{ images }], productIndex: 0, imageIndex: 0 } : null;
  }
  if (typeof arg === 'object') {
    if (Array.isArray(arg.products)) {
      const products = arg.products
        .map(p => ({ ...p, images: (p.images || []).filter(Boolean) }))
        .filter(p => p.images.length);
      if (!products.length) return null;
      const productIndex = Math.min(Math.max(arg.index || 0, 0), products.length - 1);
      return {
        products, productIndex, imageIndex: 0, onToggle: arg.onToggle,
        onLoadMore: arg.onLoadMore, loadingMore: false, exhausted: false,
      };
    }
    const images = (arg.images || []).filter(Boolean);
    if (!images.length) return null;
    const imageIndex = Math.min(Math.max(arg.index || 0, 0), images.length - 1);
    return {
      products: [{ images, inCart: !!arg.inCart }],
      productIndex: 0, imageIndex,
      onToggle: arg.onToggle ? () => arg.onToggle() : undefined,
    };
  }
  return null;
}

// Mounted once at the app root. Any component can call useLightbox() to get
// an openImage(arg) function — clicking a thumbnail anywhere in the app
// opens the same shared full-size preview overlay, with swipe/arrow
// navigation and, where the caller wires it up, an inline Add/Remove
// Quotation button — no need to close the preview first. Keeping every step
// inside one dialog matters most for less tech-comfortable customers: fewer
// taps, one place to look, swipe-swipe-tap-add and keep going.
export function ImageLightboxProvider({ children }) {
  const [state, setState] = useState(null);
  const dragStartX = useRef(null);
  const dragDeltaX  = useRef(0);
  const dragActive  = useRef(false);

  function openImage(arg) { setState(normalize(arg)); }
  function close() { setState(null); }

  // Swipe/arrows step through the CURRENT product's own images first; once
  // that runs out, the same gesture continues seamlessly into the next (or
  // previous) product rather than dead-ending (Batch 23 item 5) — one
  // continuous strip of images across the whole catalog, not two gestures
  // (swipe within a product, tap a dot between products) fighting for the
  // same finger motion. Single-product callers (Batch 21: admin thumbnails,
  // public preview, cart line item) have nowhere else to go, so they keep
  // wrapping within that one product's gallery exactly as before.
  //
  // Reads `state` directly (not the setState(s => ...) functional form) —
  // safe because go/onPointerUp/the keydown listener are all recreated
  // every render and always reference the latest `state`, and this needs a
  // plain read to decide, synchronously, whether to kick off an async page
  // fetch (which can't happen inside a setState updater).
  function go(delta) {
    if (!state) return;
    const currentImages = state.products[state.productIndex].images;
    const nextImageIndex = state.imageIndex + delta;

    if (nextImageIndex >= 0 && nextImageIndex < currentImages.length) {
      setState(s => s && { ...s, imageIndex: nextImageIndex });
      return;
    }

    if (state.products.length <= 1) {
      const n = currentImages.length;
      setState(s => s && { ...s, imageIndex: (nextImageIndex + n) % n });
      return;
    }

    const rawNextProductIndex = state.productIndex + delta;

    // Forward, past the last product currently in memory: pull in the
    // catalog's next page before looping back to the start (Batch 26 item
    // 1) — previously this wrapped immediately regardless of whether the
    // catalog actually had more pages left.
    if (delta > 0 && rawNextProductIndex >= state.products.length && state.onLoadMore && !state.exhausted) {
      if (!state.loadingMore) loadMoreAndAdvance();
      return;
    }

    const n = state.products.length;
    const productIndex = (rawNextProductIndex + n) % n;
    // Forward: land on the new product's first image. Backward: land on
    // its last, so swiping back feels like walking the strip in reverse
    // instead of always restarting at image 1.
    const imageIndex = delta > 0 ? 0 : state.products[productIndex].images.length - 1;
    setState(s => s && { ...s, productIndex, imageIndex });
  }

  async function loadMoreAndAdvance() {
    if (!state || !state.onLoadMore || state.loadingMore || state.exhausted) return;
    setState(s => s && { ...s, loadingMore: true });
    let added = [];
    try {
      added = (await state.onLoadMore()) || [];
    } catch {
      added = [];
    }
    setState(s => {
      if (!s) return s;
      if (!added.length) {
        // Genuinely nothing left on the server — complete this swipe by
        // looping back to the start instead of leaving it stuck.
        return { ...s, loadingMore: false, exhausted: true, productIndex: 0, imageIndex: 0 };
      }
      const oldLen = s.products.length;
      return {
        ...s,
        products: [...s.products, ...added],
        loadingMore: false,
        productIndex: oldLen, // first newly-loaded product
        imageIndex: 0,
      };
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

  // Pointer Events (not raw touch events) so the same handlers cover a
  // touchscreen swipe AND a mouse/trackpad drag — a bug fix (Batch 25 item
  // 1): the previous touch-only listeners meant swipe-through-the-catalog
  // only ever worked on an actual touchscreen, so anyone checking it with a
  // mouse (most desktop testing) saw nothing happen and arrow buttons were
  // the only thing that worked. Pointer Events unify touch, mouse and pen
  // through one API, supported by every evergreen browser this app targets.
  function onPointerDown(e) {
    dragStartX.current = e.clientX;
    dragDeltaX.current = 0;
    dragActive.current = true;
  }
  function onPointerMove(e) {
    if (!dragActive.current) return;
    dragDeltaX.current = e.clientX - dragStartX.current;
  }
  function onPointerUp() {
    if (!dragActive.current) return;
    if (Math.abs(dragDeltaX.current) > 40) go(dragDeltaX.current < 0 ? 1 : -1);
    dragActive.current = false;
    dragStartX.current = null;
    dragDeltaX.current = 0;
  }

  async function handleToggle() {
    if (!state?.onToggle || state.adding) return;
    const current = state.products[state.productIndex];
    setState(s => ({ ...s, adding: true }));
    const nextInCart = await state.onToggle(current);
    setState(s => {
      if (!s) return s;
      const products = s.products.slice();
      products[s.productIndex] = {
        ...products[s.productIndex],
        inCart: typeof nextInCart === 'boolean' ? nextInCart : products[s.productIndex].inCart,
      };
      return { ...s, products, adding: false };
    });
  }

  if (!state) {
    return <LightboxCtx.Provider value={openImage}>{children}</LightboxCtx.Provider>;
  }

  const multiProduct = state.products.length > 1;
  const current = state.products[state.productIndex];
  const canNavigate = multiProduct || current.images.length > 1;

  return (
    <LightboxCtx.Provider value={openImage}>
      {children}
      <div className="lightbox-backdrop" onClick={close}>
        <button className="lightbox-close" onClick={close} aria-label="Close">×</button>

        {multiProduct && (
          <div className="lightbox-product-counter" onClick={e => e.stopPropagation()}>
            {state.productIndex + 1} / {state.products.length}{state.onLoadMore && !state.exhausted ? '+' : ''}
            {current.label && <span className="lightbox-product-label">{current.label}</span>}
            {state.loadingMore && <span className="spinner" aria-label="Loading more" />}
          </div>
        )}

        <div
          className="lightbox-gallery"
          onClick={e => e.stopPropagation()}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onPointerCancel={onPointerUp}
        >
          {canNavigate && (
            <button
              className="lightbox-arrow lightbox-arrow-left" onClick={() => go(-1)}
              aria-label={multiProduct ? 'Previous product' : 'Previous image'}
            >‹</button>
          )}
          <img src={current.images[state.imageIndex]} alt="" className="lightbox-img" />
          {canNavigate && (
            <button
              className="lightbox-arrow lightbox-arrow-right" onClick={() => go(1)}
              aria-label={multiProduct ? 'Next product' : 'Next image'}
            >›</button>
          )}
        </div>

        {current.images.length > 1 && (
          <div className="lightbox-dots" onClick={e => e.stopPropagation()}>
            {current.images.map((_, i) => (
              <button
                key={i}
                className={`lightbox-dot${i === state.imageIndex ? ' active' : ''}`}
                onClick={() => setState(s => ({ ...s, imageIndex: i }))}
                aria-label={`Image ${i + 1} of ${current.images.length}`}
              />
            ))}
          </div>
        )}

        {state.onToggle && (
          <button
            type="button"
            className={`lightbox-add-btn${current.inCart ? ' in-cart' : ''}`}
            onClick={e => { e.stopPropagation(); handleToggle(); }}
            disabled={state.adding}
          >
            {state.adding
              ? <><span className="spinner" />…</>
              : current.inCart ? 'Remove from Quotation' : 'Add to Quotation'}
          </button>
        )}
      </div>
    </LightboxCtx.Provider>
  );
}

// Returns openImage(arg) — call it from an onClick to preview an image, an
// image array, a single product's gallery/add-to-quotation object, or the
// whole catalog to swipe product-to-product (see normalize above). A
// falsy/empty arg is a no-op, so callers don't need to guard for "no image
// yet".
export function useLightbox() {
  return useContext(LightboxCtx);
}
