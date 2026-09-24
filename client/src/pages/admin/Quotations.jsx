import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
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
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [sort,       setSort]       = useState({ col: 'created_at', dir: 'desc' });
  const [loading,    setLoading]    = useState(false);

  async function load(opts = {}) {
    setLoading(true);
    const s = opts.sort || sort;
    const params = new URLSearchParams();
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    params.set('sort', s.col);
    params.set('order', s.dir);
    const d = await api.get(`/admin/quotations?${params}`);
    if (d.ok) setQuotations(d.quotations);
    setLoading(false);
  }

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    load({ sort: newSort });
  }

  useEffect(() => { load(); }, []);

  function openPdf(id, mode) {
    window.open(`/api/admin/quotations/${id}/pdf?mode=${mode}`, '_blank');
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Quotations</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>From</label>
          <input type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>To</label>
          <input type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => load()} disabled={loading}>Filter</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); setTimeout(() => load(), 0); }}>Clear</button>
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
              <th>Pcs</th>
              <th>Gross Wt.</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No quotations found.</td></tr>
            )}
            {quotations.map(q => (
              <tr key={q.id}>
                <td><strong>{q.quotation_number}</strong></td>
                <td>{q.company_name} <span style={{ color: 'var(--mid)', fontSize: 12 }}>({q.pid})</span></td>
                <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                <td>{q.item_count}</td>
                <td>{q.piece_count}</td>
                <td>{parseFloat(q.total_gross_weight || 0).toFixed(3)}g</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openPdf(q.id, 'text')} style={{ marginRight: 6 }}>PDF</button>
                  <button className="btn btn-sm btn-outline" onClick={() => openPdf(q.id, 'images')}>+ Images</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
