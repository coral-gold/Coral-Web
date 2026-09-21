import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(d => { if (d.ok) setStats(d.stats); });
  }, []);

  const cards = stats ? [
    { label: 'Products',      value: stats.products },
    { label: 'Active Parties', value: stats.activeParties },
    { label: 'Quotations',    value: stats.quotations },
    { label: 'This Month',    value: stats.quotationsThisMonth },
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
    </AdminLayout>
  );
}
