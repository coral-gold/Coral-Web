import React, { useEffect, useState } from 'react';
import WholesalerLayout from '../../components/WholesalerLayout';
import { useSiteContent } from '../../context/SiteContentContext';
import api from '../../api';

export default function MyQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const { settings } = useSiteContent();

  useEffect(() => {
    api.get('/quotation').then(d => {
      if (d.ok) setQuotations(d.quotations);
      setLoading(false);
    });
  }, []);

  function openPdf(id) {
    window.open(`/api/quotation/${id}/pdf`, '_blank');
  }

  return (
    <WholesalerLayout>
      <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, color: 'var(--garnet)', marginBottom: 20 }}>
        My Quotations
      </h1>

      {loading && <p style={{ color: 'var(--mid)' }}>Loading…</p>}

      {!loading && quotations.length === 0 && (
        <p style={{ color: 'var(--mid)', padding: '40px 0', textAlign: 'center' }}>No quotations yet.</p>
      )}

      {quotations.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Date</th>
                <th>Items</th>
                {settings.showGrossWeight && <th>Gross Wt.</th>}
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id}>
                  <td><strong>{q.quotation_number}</strong></td>
                  <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                  <td>{q.item_count}</td>
                  {settings.showGrossWeight && <td>{parseFloat(q.total_gross_weight || 0).toFixed(3)}g</td>}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openPdf(q.id)}>
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WholesalerLayout>
  );
}
