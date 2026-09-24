import React, { useRef, useEffect } from 'react';
import { useSiteContent } from '../context/SiteContentContext';

// After a page change, scroll back to the top of whichever list this
// pagination belongs to — otherwise the view stays wherever "Next" was
// tapped (often near the bottom on mobile), landing on an empty area
// instead of the new page's first item (Batch 20 item 9). Only relevant in
// classic mode — Load More/infinite scroll append in place, so there's
// nothing to jump back to. Handles both native page scroll (e.g. the
// public/wholesaler pages) and an app-shell's own internal scroll region
// (e.g. admin's .admin-main), by walking up for the nearest scrollable
// ancestor and resetting it, then falling back to the window.
function scrollListToTop(el) {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      node.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }
    node = node.parentElement;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Real server-side pagination control, one component shared by every
// paginated list (catalogue, admin tables) so Settings > Pagination Style
// (Batch 21 item 4) reads as one consistent behavior site-wide instead of a
// per-screen quirk. Three presentations of the same underlying page/pages:
//   - classic:   Prev/Next buttons, replacing the current page (unchanged
//                behavior from before this setting existed).
//   - load_more: a button that fetches the next page and appends it.
//   - infinite:  the same append, auto-triggered as a sentinel scrolls
//                into view, no button needed.
// onChange(p) replaces the list with page p (classic). onLoadMore() fetches
// page+1 and appends it (load_more/infinite) — callers must implement both,
// since only the caller knows how to merge results into its own list state.
export default function Pagination({ page, pages, total, onChange, onLoadMore, loadingMore }) {
  const { settings } = useSiteContent();
  const mode = settings.paginationMode || 'classic';
  const ref = useRef(null);
  const sentinelRef = useRef(null);
  const hasMore = page < pages;

  useEffect(() => {
    if (mode !== 'infinite' || !hasMore || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loadingMore) onLoadMore?.(); },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode, hasMore, loadingMore, onLoadMore]);

  if (pages <= 1) return null;

  if (mode === 'load_more' || mode === 'infinite') {
    return (
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        {mode === 'infinite' && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        {loadingMore ? (
          <p style={{ fontSize: 13, color: 'var(--mid)' }}><span className="spinner-dark" />Loading more…</p>
        ) : mode === 'load_more' && hasMore ? (
          <button className="btn btn-outline btn-sm" onClick={onLoadMore}>Load More</button>
        ) : !hasMore ? (
          <p style={{ fontSize: 12, color: 'var(--mid)' }}>
            {typeof total === 'number' ? `All ${total} loaded` : 'All loaded'}
          </p>
        ) : null}
      </div>
    );
  }

  async function go(p) {
    await onChange(p);
    // React's state update from that data is batched, so the DOM may not
    // have the new (shorter) list painted yet the instant the promise
    // resolves — wait a frame so the scroll target reflects the real page.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollListToTop(ref.current)));
  }

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
      <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => go(page - 1)}>
        ← Prev
      </button>
      <span style={{ fontSize: 13, color: 'var(--mid)' }}>
        Page {page} of {pages}{typeof total === 'number' ? ` (${total} total)` : ''}
      </span>
      <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next →
      </button>
    </div>
  );
}
