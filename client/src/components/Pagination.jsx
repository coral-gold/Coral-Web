import React from 'react';

// Real server-side pagination control: shows current page / total pages and
// Prev/Next buttons. Always renders one page of results at a time — no
// "load everything then paginate on the frontend."
export default function Pagination({ page, pages, onChange, total }) {
  if (pages <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
      <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Prev
      </button>
      <span style={{ fontSize: 13, color: 'var(--mid)' }}>
        Page {page} of {pages}{typeof total === 'number' ? ` (${total} total)` : ''}
      </span>
      <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}
