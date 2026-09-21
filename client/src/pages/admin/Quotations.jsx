import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

export default function AdminQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [loading,    setLoading]    = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    const d = await api.get(`/admin/quotations?${params}`);
    if (d.ok) setQuotations(d.quotations);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function downloadPdf(id) {
    const win = window.open('', '_blank');
    win.location.href = `/api/quotation/${id}/pdf`;
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
        <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>Filter</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setFrom(''); setTo(''); setTimeout(load, 0); }}>Clear</button>
      </div>

      {loading && <p style={{ color: 'var(--mid)' }}>Loading…</p>}

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Quotation No.</th>
              <th>Party</th>
              <th>Date</th>
              <th>Items</th>
              <th>Pieces</th>
              <th>Gross Wt.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotations.map(q => (
              <tr key={q.id}>
                <td><strong>{q.number}</strong></td>
                <td>{q.party_name} <span style={{ color: 'var(--mid)', fontSize: 12 }}>({q.party_id})</span></td>
                <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                <td>{q.item_count}</td>
                <td>{q.piece_count}</td>
                <td>{parseFloat(q.total_gross_weight).toFixed(3)}g</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => downloadPdf(q.id)}>PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && quotations.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--mid)', padding: '32px 0' }}>No quotations found.</p>
      )}
    </AdminLayout>
  );
}
