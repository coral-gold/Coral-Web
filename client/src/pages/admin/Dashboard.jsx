import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

export default function Dashboard() {
  const [stats,  setStats]  = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get('/admin/dashboard').then(d => {
      if (d.ok) { setStats(d.stats); setRecent(d.recent || []); }
    });
  }, []);

  const cards = stats ? [
    { label: 'Products',       value: stats.products },
    { label: 'Active Parties', value: stats.activeParties },
    { label: 'Quotations',     value: stats.quotations },
    { label: 'This Month',     value: stats.quotationsThisMonth },
  ] : [];

  return (
    <AdminLayout>
      <h1 className="admin-page-title">Dashboard</h1>

      {!stats && <p style={{ color: 'var(--mid)' }}>Loading…</p>}

      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="admin-card" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Recent Quotations</h3>
            <Link to="/admin/quotations" style={{ fontSize: 13, fontWeight: 600 }}>View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--mid)', fontSize: 14 }}>No quotations yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Quotation No.</th>
                    <th>Party</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(q => (
                    <tr key={q.id}>
                      <td><strong>{q.quotation_number}</strong></td>
                      <td>{q.company_name}</td>
                      <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
