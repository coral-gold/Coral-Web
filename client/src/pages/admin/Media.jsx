import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function SortTh({ col, sort, onSort, children, style }) {
  const active = sort.col === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        onClick={() => onSort(col)}>
      {children}
      <span style={{ marginLeft: 4, color: active ? 'var(--garnet)' : '#bbb', fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

export default function Media() {
  const [files,     setFiles]    = useState([]);
  const [sort,      setSort]     = useState({ col: 'mtime', dir: 'desc' });
  const [uploading, setUploading]= useState(false);
  const [copied,    setCopied]   = useState(null);
  const { show } = useToast();
  const uploadRef = useRef(null);

  async function load() {
    const d = await api.get('/admin/media');
    if (d.ok) setFiles(d.files);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const d = await api.form('/admin/content/logo', fd);
    setUploading(false);
    if (d.ok) { show('Uploaded'); load(); }
    else show(d.error || 'Upload failed', 'error');
    e.target.value = '';
  }

  async function del(filename) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    const d = await api.del(`/admin/media/${encodeURIComponent(filename)}`);
    if (d.ok) { show('Deleted'); load(); }
    else show(d.error || 'Failed', 'error');
  }

  function copyUrl(url) {
    const full = window.location.origin + url;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  function handleSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  const sorted = [...files].sort((a, b) => {
    let va = a[sort.col], vb = b[sort.col];
    if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase();
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Media Library</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn btn-primary btn-sm" onClick={() => uploadRef.current?.click()} disabled={uploading}>
            {uploading ? <><span className="spinner" />Uploading…</> : '+ Upload Image'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
        All uploaded images with permanent URLs. Links remain valid as long as the file exists.
      </p>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Preview</th>
              <SortTh col="filename" sort={sort} onSort={handleSort}>Filename</SortTh>
              <SortTh col="size"     sort={sort} onSort={handleSort}>Size</SortTh>
              <SortTh col="mtime"    sort={sort} onSort={handleSort}>Uploaded</SortTh>
              <th>URL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No images uploaded yet.</td></tr>
            )}
            {sorted.map(f => (
              <tr key={f.filename}>
                <td>
                  <img src={f.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                       onError={e => { e.target.style.display = 'none'; }} />
                </td>
                <td style={{ maxWidth: 200, wordBreak: 'break-all', fontSize: 12 }}>{f.filename}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtSize(f.size)}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(f.mtime).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ fontSize: 11, color: 'var(--mid)', maxWidth: 180, wordBreak: 'break-all' }}>
                  {window.location.origin + f.url}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => copyUrl(f.url)}
                    style={{ marginRight: 6 }}
                  >
                    {copied === f.url ? '✓ Copied' : 'Copy URL'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(f.filename)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
