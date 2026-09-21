import React, { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

export default function Import() {
  const [file,    setFile]    = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    const d = await api.form('/admin/import', fd);
    setLoading(false);
    if (d.ok) {
      setResult(d);
      show(`Import complete: ${d.inserted} inserted, ${d.updated} updated`);
    } else {
      show(d.error || 'Import failed', 'error');
    }
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">ERP Import</h1>
      <p style={{ color: 'var(--mid)', marginBottom: 20 }}>
        Upload an Excel (.xlsx) file exported from your ERP. Rows are matched by jewel code and upserted.
      </p>

      <div className="admin-card" style={{ maxWidth: 480 }}>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Excel File (.xlsx / .xls)</label>
            <input
              type="file" accept=".xlsx,.xls,.ods" required
              onChange={e => { setFile(e.target.files[0]); setResult(null); }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !file}>
            {loading ? <><span className="spinner" />Importing…</> : 'Import'}
          </button>
        </form>

        {result && (
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            <strong>Done!</strong> {result.inserted} new products added, {result.updated} existing updated.
            {result.skipped > 0 && ` ${result.skipped} rows skipped.`}
          </div>
        )}
      </div>

      <div className="admin-card" style={{ maxWidth: 560, marginTop: 24 }}>
        <h3>Expected Column Names</h3>
        <p style={{ color: 'var(--mid)', fontSize: 13 }}>The importer recognises these ERP column names (case-insensitive):</p>
        <table className="admin-table" style={{ fontSize: 13 }}>
          <thead><tr><th>ERP Column</th><th>Field</th></tr></thead>
          <tbody>
            {[
              ['jewel code', 'Jewel Code'],
              ['style no / style no.', 'Design Number'],
              ['category', 'Category'],
              ['gr wt / gross wt', 'Gross Weight'],
              ['net wt', 'Net Weight'],
              ['qty', 'Stock Quantity'],
            ].map(([erp, field]) => (
              <tr key={erp}><td><code>{erp}</code></td><td>{field}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
