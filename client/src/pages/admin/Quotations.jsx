import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Pagination from '../../components/Pagination';
import api from '../../api';

function Th({ col, sort, onSort, children }) {
  const active = sort.col === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        onClick={() => onSort(col)}>
      {children}
      <span style={{ marginLeft: 4, color: active ? 'var(--garnet)' : '#bbb', fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

export default function AdminQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [total,      setTotal]      = useState(0);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState({ col: 'created_at', dir: 'desc' });
  const [loading,    setLoading]    = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounce = React.useRef(null);

  function buildParams(p, s) {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    params.set('page', p);
    params.set('sort', s.col);
    params.set('order', s.dir);
    return params;
  }

  // Real server-side pagination: fetch and render one page at a time.
  async function load(opts = {}) {
    setLoading(true);
    const p = opts.page || 1;
    const s = opts.sort || sort;
    const d = await api.get(`/admin/quotations?${buildParams(p, s)}`);
    setLoading(false);
    if (d.ok) {
      setQuotations(d.quotations);
      setPage(p);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    }
  }

  // Load More / infinite scroll (Batch 21 item 4) — appends the next page.
  async function loadMore() {
    if (page >= pages || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const d = await api.get(`/admin/quotations?${buildParams(nextPage, sort)}`);
    setLoadingMore(false);
    if (d.ok) {
      setQuotations(prev => [...prev, ...d.quotations]);
      setPage(nextPage);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
    }
  }

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    load({ page: 1, sort: newSort });
  }

  const mounted = React.useRef(false);
  useEffect(() => { load({ page: 1 }); mounted.current = true; }, []);

  useEffect(() => {
    if (!mounted.current) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load({ page: 1 }), 350);
  }, [search]);

  function openPdf(id) {
    window.open(`/api/admin/quotations/${id}/pdf`, '_blank');
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Quotations</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Quotation No. / Party</label>
          <input
            type="search" className="form-control form-control-sm" placeholder="e.g. CG-Q-0001"
            value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>From</label>
          <input type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>To</label>
          <input type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => load({ page: 1 })} disabled={loading}>Filter</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); setSearch(''); setTimeout(() => load({ page: 1 }), 0); }}>Clear</button>
      </div>

      {loading && <p style={{ color: 'var(--mid)' }}>Loading…</p>}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <Th col="quotation_number" sort={sort} onSort={handleSort}>Quotation No.</Th>
              <Th col="company_name"     sort={sort} onSort={handleSort}>Party</Th>
              <Th col="created_at"       sort={sort} onSort={handleSort}>Date</Th>
              <th>Items</th>
              <th>Gross Wt.</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No quotations found.</td></tr>
            )}
            {quotations.map(q => (
              <tr key={q.id}>
                <td><strong>{q.quotation_number}</strong></td>
                <td>{q.company_name} <span style={{ color: 'var(--mid)', fontSize: 12 }}>({q.pid})</span></td>
                <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                <td>{q.item_count}</td>
                <td>{parseFloat(q.total_gross_weight || 0).toFixed(3)}g</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openPdf(q.id)}>Download PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} loadingMore={loadingMore} onChange={p => load({ page: p, sort })} onLoadMore={loadMore} />
    </AdminLayout>
  );
}
