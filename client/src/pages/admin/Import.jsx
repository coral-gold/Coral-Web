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
      show(`Done: ${d.inserted} new, ${d.updated} updated`);
    } else {
      show(d.error || 'Import failed', 'error');
    }
  }

  return (
    <AdminLayout>
      <h1 className="admin-page-title">ERP Import</h1>
      <p style={{ color: 'var(--mid)', marginBottom: 20 }}>
        Upload the <strong>Jewelry Stock As On Date</strong> Excel file exported from your ERP.
        Products are matched by Jewel Code and upserted — existing products are updated, new ones are added.
      </p>

      <div className="admin-card" style={{ maxWidth: 480 }}>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Excel File (.xlsx)</label>
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
            <strong>Import complete!</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
              <li>{result.inserted} new products added</li>
              <li>{result.updated} existing products updated</li>
              {result.skipped > 0 && <li>{result.skipped} rows skipped (blank or error)</li>}
            </ul>
          </div>
        )}

        {result?.errors?.length > 0 && (
          <div className="alert alert-warning" style={{ marginTop: 8 }}>
            <strong>{result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="admin-card" style={{ maxWidth: 560, marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Columns read from the ERP file</h3>
        <div className="table-wrap">
          <table className="admin-table" style={{ fontSize: 13 }}>
            <thead><tr><th>ERP Column</th><th>Saved as</th><th>Required</th></tr></thead>
            <tbody>
              {[
                ['Jewel Code',  'Jewel Code',    true],
                ['Style No',    'Design Number', false],
                ['Category',    'Category',      false],
                ['Gr Wt',       'Gross Weight',  false],
                ['Net Wt',      'Net Weight',    false],
                ['Qty',         'Quantity',      false],
                ['Descr',       'Description',   false],
              ].map(([erp, field, req]) => (
                <tr key={erp}>
                  <td><code>{erp}</code></td>
                  <td>{field}</td>
                  <td>{req ? '✓ Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mid)', marginTop: 10 }}>
          All other columns in the file are ignored. Column names are matched case-insensitively.
        </p>
      </div>
    </AdminLayout>
  );
}
