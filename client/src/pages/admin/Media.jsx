import React, { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import api from '../../api';

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function SortTh({ col, sort, onSort, children }) {
  const active = sort.col === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => onSort(col)}>
      {children}
      <span style={{ marginLeft: 4, color: active ? 'var(--garnet)' : '#bbb', fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// ── Library tab ────────────────────────────────────────────────────────────────

function LibraryTab() {
  const [files,     setFiles]    = useState([]);
  const [page,      setPage]     = useState(1);
  const [pages,     setPages]    = useState(1);
  const [total,     setTotal]    = useState(0);
  const [storageMode, setStorageMode] = useState(null); // 'local' | 's3'
  const [storagePersistent, setStoragePersistent] = useState(false);
  const [sort,      setSort]     = useState({ col: 'mtime', dir: 'desc' });
  const [uploading, setUploading]= useState(false);
  const [copied,    setCopied]   = useState(null);
  const { show } = useToast();
  const uploadRef = useRef(null);

  // Real server-side pagination: fetch and render one page at a time.
  async function load(p = page, s = sort) {
    const d = await api.get(`/admin/media?page=${p}&sort=${s.col}&order=${s.dir}`);
    if (d.ok) {
      if (d.files.length === 0 && p > 1) return load(p - 1, s);
      setFiles(d.files);
      setPage(p);
      setPages(d.pages || 1);
      setTotal(d.total || 0);
      setStorageMode(d.storageMode || null);
      setStoragePersistent(!!d.storagePersistent);
    }
  }

  useEffect(() => { load(1, sort); }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const d = await api.form('/admin/media/upload', fd);
    setUploading(false);
    if (d.ok) { show('Uploaded'); load(1, sort); }
    else show(d.error || 'Upload failed', 'error');
    e.target.value = '';
  }

  async function del(key, filename) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    const d = await api.del(`/admin/media/${encodeURIComponent(key)}`);
    if (d.ok) { show('Deleted'); load(page, sort); }
    else show(d.error || 'Failed', 'error');
  }

  // url is already an absolute permanent link (S3, or a configured
  // IMAGES_PUBLIC_URL) or a same-origin relative path (/uploads/…) —
  // only the latter needs the origin prefixed.
  function absoluteUrl(url) {
    return /^https?:\/\//i.test(url) ? url : window.location.origin + url;
  }

  function copyUrl(url) {
    navigator.clipboard.writeText(absoluteUrl(url)).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  function handleSort(col) {
    const newSort = { col, dir: sort.col === col && sort.dir === 'asc' ? 'desc' : 'asc' };
    setSort(newSort);
    load(1, newSort);
  }

  return (
    <>
      {storageMode && (
        storageMode === 's3' ? (
          <div className="alert alert-success" style={{ marginBottom: 16, fontSize: 13 }}>
            <strong>Storage: Object storage (S3).</strong> Images live outside the app and survive every code deploy.
          </div>
        ) : storagePersistent ? (
          <div className="alert alert-success" style={{ marginBottom: 16, fontSize: 13 }}>
            <strong>Storage: Persistent local folder.</strong> New uploads are saved outside the app's deploy path and survive redeploys.
          </div>
        ) : (
          <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: 13 }}>
            <strong>Storage: Local disk inside the app folder — at risk.</strong> New uploads can be lost on the next redeploy.
            Set <code>IMAGES_DIR</code> + <code>IMAGES_PUBLIC_URL</code> to a persistent folder, or configure S3
            (<code>S3_BUCKET</code>, <code>S3_ACCESS_KEY_ID</code>, <code>S3_SECRET_ACCESS_KEY</code>) for the most robust option.
          </div>
        )
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="btn btn-primary btn-sm" onClick={() => uploadRef.current?.click()} disabled={uploading}>
          {uploading ? <><span className="spinner" />Uploading…</> : '+ Upload Image'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 16 }}>
        All uploaded images. Links remain valid as long as the file exists in storage.
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
            {files.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--mid)', padding: 24 }}>No images uploaded yet.</td></tr>
            )}
            {files.map(f => (
              <tr key={f.key}>
                <td>
                  <img src={f.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                       onError={e => { e.target.style.display = 'none'; }} />
                </td>
                <td style={{ maxWidth: 200, wordBreak: 'break-all', fontSize: 12 }}>{f.filename}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtSize(f.size)}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {new Date(f.mtime).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ fontSize: 11, color: 'var(--mid)', maxWidth: 180, wordBreak: 'break-all' }}>
                  {absoluteUrl(f.url)}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => copyUrl(f.url)} style={{ marginRight: 6 }}>
                    {copied === f.url ? '✓ Copied' : 'Copy URL'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(f.key, f.filename)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pages} total={total} onChange={p => load(p, sort)} />
    </>
  );
}

// ── Bulk Import tab ────────────────────────────────────────────────────────────

function BulkImportTab() {
  const [folderFiles, setFolderFiles] = useState(null);
  const [force,       setForce]       = useState(true);
  const [running,     setRunning]     = useState(false);
  const [progress,    setProgress]    = useState(null); // { done, total, matched, unmatched }
  const [results,     setResults]     = useState(null); // { matched: [], unmatched: [] }
  const [showUnmatched, setShowUnmatched] = useState(false);
  const folderRef = useRef(null);
  const { show } = useToast();

  async function start() {
    if (!folderFiles || folderFiles.length === 0) return show('Select a folder first.', 'error');

    // Index unique stems; keep original-case stem for sending to server
    const fileIndex = {}; // lowercase key → { file, originalStem }
    for (const f of folderFiles) {
      const originalStem = f.name.replace(/\.[^.]+$/, '');
      const key = originalStem.toLowerCase();
      if (key && !fileIndex[key]) fileIndex[key] = { file: f, originalStem };
    }

    const entries = Object.values(fileIndex);
    setRunning(true);
    setResults(null);
    setProgress({ done: 0, total: entries.length, matched: 0, unmatched: 0 });

    const matchedList = [], unmatchedList = [];
    let done = 0, matched = 0, unmatched = 0;

    for (const { file, originalStem } of entries) {
      const fd = new FormData();
      fd.append('design_number', originalStem);
      fd.append('image', file);
      if (force) fd.append('force', '1');

      try {
        const r = await api.form('/admin/import/images', fd);
        if (r.ok && r.matched) { matched++; matchedList.push(originalStem); }
        else { unmatched++; unmatchedList.push(originalStem); }
      } catch (_) { unmatched++; unmatchedList.push(originalStem); }

      done++;
      setProgress({ done, total: entries.length, matched, unmatched });
    }

    setRunning(false);
    setResults({ matched: matchedList, unmatched: unmatchedList });
    show(`Done: ${matched} matched, ${unmatched} unmatched.`);
  }

  function reset() {
    setFolderFiles(null); setProgress(null); setResults(null);
    setShowUnmatched(false);
    if (folderRef.current) folderRef.current.value = '';
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 20 }}>
        Select a folder of product images. Each image is matched to a product by its filename (without extension) against the product's Style Number (Design Number). Subfolder names are ignored — only the filename matters.
      </p>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label>Image Folder</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={folderRef}
              type="file"
              // @ts-ignore
              webkitdirectory="true"
              directory="true"
              multiple
              style={{ display: 'none' }}
              onChange={e => { setFolderFiles(e.target.files); setResults(null); setProgress(null); }}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => folderRef.current?.click()} disabled={running}>
              Choose Folder
            </button>
            {folderFiles
              ? <span style={{ fontSize: 13, color: 'var(--mid)' }}>{folderFiles.length} files selected</span>
              : <span style={{ fontSize: 13, color: 'var(--mid)' }}>None selected</span>
            }
          </div>
          <p style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6 }}>
            You can reuse the same folder used for the Android app (parent folder with BG/, RG/, WTDC/ subfolders). Images inside any subfolder are found automatically.
          </p>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
            <span>
              <strong>Overwrite existing images</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--mid)' }}>
                When checked, replaces images already attached to products. Uncheck to only fill products that have no image yet.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={start} disabled={running || !folderFiles}>
          {running ? <><span className="spinner" />Importing…</> : 'Start Import'}
        </button>
        {results && <button className="btn btn-outline" onClick={reset}>Import Another Folder</button>}
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="admin-card" style={{ marginBottom: 20 }}>
          <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', background: 'var(--garnet)', transition: 'width .2s',
              width: `${pct}%`
            }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--mid)', margin: 0 }}>
            {progress.done} / {progress.total} processed
            {progress.done > 0 && (
              <> — <span style={{ color: '#27ae60' }}>{progress.matched} matched</span>
              {progress.unmatched > 0 && <>, <span style={{ color: '#e67e22' }}>{progress.unmatched} unmatched</span></>}
              </>
            )}
          </p>
        </div>
      )}

      {/* Results */}
      {results && !running && (
        <div className="admin-card">
          <div className="alert alert-success" style={{ marginBottom: results.unmatched.length > 0 ? 12 : 0 }}>
            <strong>Import complete!</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
              <li>{results.matched.length} image{results.matched.length !== 1 ? 's' : ''} matched and imported</li>
              {results.unmatched.length > 0 && (
                <li style={{ color: '#c0392b' }}>{results.unmatched.length} file{results.unmatched.length !== 1 ? 's' : ''} had no matching product</li>
              )}
            </ul>
          </div>

          {results.unmatched.length > 0 && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowUnmatched(v => !v)}
                style={{ marginBottom: 8 }}
              >
                {showUnmatched ? 'Hide' : 'Show'} unmatched files ({results.unmatched.length})
              </button>
              {showUnmatched && (
                <div style={{ maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,0.03)', borderRadius: 6, padding: '8px 12px' }}>
                  {results.unmatched.map(name => (
                    <div key={name} style={{ fontSize: 13, padding: '2px 0', color: 'var(--mid)' }}>{name}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

export default function Media() {
  const [tab, setTab] = useState('library');

  const tabStyle = active => ({
    padding: '7px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    color: active ? 'var(--garnet)' : 'var(--mid)',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--garnet)' : '2px solid transparent',
  });

  return (
    <AdminLayout>
      <h1 className="admin-page-title" style={{ marginBottom: 16 }}>Media</h1>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(0,0,0,0.1)', marginBottom: 24 }}>
        <button style={tabStyle(tab === 'library')} onClick={() => setTab('library')}>Media Library</button>
        <button style={tabStyle(tab === 'import')}  onClick={() => setTab('import')}>Bulk Image Import</button>
      </div>

      {tab === 'library' && <LibraryTab />}
      {tab === 'import'  && <BulkImportTab />}
    </AdminLayout>
  );
}
