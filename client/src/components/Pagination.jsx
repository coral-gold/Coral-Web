import React, { useRef } from 'react';

// After a page change, scroll back to the top of whichever list this
// pagination belongs to — otherwise the view stays wherever "Next" was
// tapped (often near the bottom on mobile), landing on an empty area
// instead of the new page's first item (item 9). Handles both native page
// scroll (e.g. the public/wholesaler pages) and an app-shell's own internal
// scroll region (e.g. admin's .admin-main), by walking up for the nearest
// scrollable ancestor and resetting it, then falling back to the window.
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

// Real server-side pagination control: shows current page / total pages and
// Prev/Next buttons. Always renders one page of results at a time — no
// "load everything then paginate on the frontend."
export default function Pagination({ page, pages, onChange, total }) {
  const ref = useRef(null);
  if (pages <= 1) return null;

  async function go(p) {
    // Wait for the new page's data (and re-render) before scrolling — doing
    // it immediately on click races the still-shorter old page's DOM: mid
    // fade from the old (longer) list to the new one, the browser can clamp
    // an in-flight smooth-scroll to whatever max scroll the shrinking
    // document allows at that instant, landing short of the actual top.
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
