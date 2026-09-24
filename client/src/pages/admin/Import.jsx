import React, { useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import api from '../../api';

const PRODUCT_FIELDS = [
  { value: '',             label: '— skip —' },
  { value: 'jewel_code',   label: 'Jewel Code *' },
  { value: 'design_number',label: 'Design Number' },
  { value: 'category',     label: 'Category' },
  { value: 'gross_weight', label: 'Gross Weight' },
  { value: 'net_weight',   label: 'Net Weight' },
  { value: 'quantity',     label: 'Quantity' },
  { value: 'description',  label: 'Description' },
  { value: 'image_path',   label: 'Image Path (for matching)' },
];

const STEP = { UPLOAD: 0, MAP: 1, RUNNING: 2, DONE: 3, IMAGES: 4 };

export default function Import() {
  const [step,        setStep]       = useState(STEP.UPLOAD);
  const [xlsxFile,    setXlsxFile]   = useState(null);
  const [imgFolder,   setImgFolder]  = useState(null);   // FileList from folder picker
  const [preview,     setPreview]    = useState(null);   // { fileId, headers, suggestions, rowCount }
  const [mapping,     setMapping]    = useState({});     // { header: fieldName | '' }
  const [result,      setResult]     = useState(null);
  const [imgProgress, setImgProgress]= useState(null);   // { done, total, matched, skipped }
  const { show } = useToast();
  const folderRef = useRef(null);

  // ── Step 1: upload & preview ──────────────────────────────────────────────

  async function handlePreview(e) {
    e.preventDefault();
    if (!xlsxFile) return;
    const fd = new FormData();
    fd.append('file', xlsxFile);
    const d = await api.form('/admin/import/preview', fd);
    if (!d.ok) { show(d.error || 'Failed to read file', 'error'); return; }

    // Pre-fill mapping from suggestions
    const initMap = {};
    for (const h of d.headers) initMap[h] = d.suggestions[h] || '';
    setPreview(d);
    setMapping(initMap);
    setStep(STEP.MAP);
  }

  // ── Step 2: column mapping ────────────────────────────────────────────────

  function setMap(header, field) {
    setMapping(m => ({ ...m, [header]: field }));
  }

  async function handleRun(e) {
    e.preventDefault();
    const jewel = Object.values(mapping).includes('jewel_code');
    if (!jewel) { show('You must map a column to "Jewel Code" before importing.', 'error'); return; }
    setStep(STEP.RUNNING);

    const d = await api.post('/admin/import/run', { fileId: preview.fileId, mapping });
    if (!d.ok) { show(d.error || 'Import failed', 'error'); setStep(STEP.MAP); return; }

    setResult(d);
    show(`Done: ${d.inserted} new, ${d.updated} updated`);

    // If images folder selected and imageMap returned, go to image upload step
    if (imgFolder && d.imageMap && d.imageMap.length > 0) {
      setStep(STEP.IMAGES);
      await uploadImages(d.imageMap, imgFolder);
    } else {
      setStep(STEP.DONE);
    }
  }

  // ── Step 4: image upload ──────────────────────────────────────────────────

  async function uploadImages(imageMap, folderFiles) {
    // Build filename → File lookup (case-insensitive, all subfolders flattened by bare name)
    const fileIndex = {};
    for (const f of folderFiles) {
      fileIndex[f.name.toLowerCase()] = f;
    }

    let done = 0, matched = 0, skipped = 0;
    setImgProgress({ done: 0, total: imageMap.length, matched: 0, skipped: 0 });

    for (const { jewel_code, design_number } of imageMap) {
      // Match by design_number (= Style Number = image filename without extension)
      const dn = (design_number || jewel_code).toLowerCase();
      const file = fileIndex[dn + '.jpg']
        || fileIndex[dn + '.jpeg']
        || fileIndex[dn + '.png']
        || fileIndex[dn + '.webp']
        || fileIndex[dn + '.gif'];

      if (file) {
        const fd = new FormData();
        fd.append('jewel_code', jewel_code);
        fd.append('image', file);
        const r = await api.form('/admin/import/images', fd);
        if (r.ok) matched++;
        else skipped++;
      } else {
        skipped++;
      }
      done++;
      setImgProgress({ done, total: imageMap.length, matched, skipped });
    }
    setStep(STEP.DONE);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setStep(STEP.UPLOAD);
    setXlsxFile(null);
    setImgFolder(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setImgProgress(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasImageMap = result?.imageMap?.length > 0;

  return (
    <AdminLayout>
      <h1 className="admin-page-title">ERP Import</h1>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['1. Upload', STEP.UPLOAD], ['2. Map Columns', STEP.MAP], ['3. Results', STEP.DONE]].map(([label, s]) => (
          <span key={s} style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: step === s || (step === STEP.RUNNING && s === STEP.MAP) || (step === STEP.IMAGES && s === STEP.DONE)
              ? 'var(--garnet)' : 'rgba(0,0,0,0.06)',
            color: step === s || (step === STEP.RUNNING && s === STEP.MAP) || (step === STEP.IMAGES && s === STEP.DONE)
              ? '#fff' : 'var(--mid)',
          }}>{label}</span>
        ))}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === STEP.UPLOAD && (
        <div className="admin-card" style={{ maxWidth: 520 }}>
          <form onSubmit={handlePreview}>
            <div className="form-group">
              <label>Excel File (.xlsx / .xls)</label>
              <input type="file" accept=".xlsx,.xls,.ods" required
                onChange={e => setXlsxFile(e.target.files[0])} />
            </div>

            <div className="form-group">
              <label>
                Image Folder <span style={{ color: 'var(--mid)', fontWeight: 400 }}>(optional — for batch image upload)</span>
              </label>
              <input
                ref={folderRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                style={{ display: 'none' }}
                onChange={e => setImgFolder(e.target.files)}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => folderRef.current?.click()}>
                  Choose Folder
                </button>
                {imgFolder
                  ? <span style={{ fontSize: 13, color: 'var(--mid)' }}>{imgFolder.length} files selected</span>
                  : <span style={{ fontSize: 13, color: 'var(--mid)' }}>None selected</span>
                }
              </div>
              <p style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6 }}>
                Select the parent folder containing category subfolders (e.g. select "SavedImage" which contains "WTDC/", "BG/", etc.).
                Images are matched by filename = Design Number (Style Number).
              </p>
            </div>

            <button type="submit" className="btn btn-primary" disabled={!xlsxFile}>
              Read File →
            </button>
          </form>
        </div>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {step === STEP.MAP && preview && (
        <div className="admin-card" style={{ maxWidth: 640 }}>
          <p style={{ color: 'var(--mid)', marginBottom: 16, fontSize: 14 }}>
            Found <strong>{preview.headers.length}</strong> columns and <strong>{preview.rowCount}</strong> data rows.
            Map each column to a product field, or leave as "skip".
          </p>

          <form onSubmit={handleRun}>
            <div className="table-wrap" style={{ marginBottom: 20 }}>
              <table className="admin-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Excel Column</th>
                    <th>Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.map(h => (
                    <tr key={h}>
                      <td><code style={{ fontSize: 12 }}>{h}</code></td>
                      <td>
                        <select
                          className="form-control form-control-sm"
                          value={mapping[h] || ''}
                          onChange={e => setMap(h, e.target.value)}
                          style={{ minWidth: 180 }}
                        >
                          {PRODUCT_FIELDS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!Object.values(mapping).includes('jewel_code') && (
              <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>
                ⚠ Map at least one column to <strong>Jewel Code</strong> — it is required.
              </p>
            )}

            {imgFolder && (
              <p style={{ fontSize: 13, color: '#27ae60', marginBottom: 12 }}>
                ✓ {imgFolder.length} files in folder ready for upload. Images will be matched by Design Number (Style Number).
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setStep(STEP.UPLOAD)}>← Back</button>
              <button type="submit" className="btn btn-primary"
                disabled={!Object.values(mapping).includes('jewel_code')}>
                Run Import
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 3: Running ── */}
      {step === STEP.RUNNING && (
        <div className="admin-card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p style={{ marginTop: 16, color: 'var(--mid)' }}>Importing products…</p>
        </div>
      )}

      {/* ── STEP 4: Image upload progress ── */}
      {step === STEP.IMAGES && imgProgress && (
        <div className="admin-card" style={{ maxWidth: 400 }}>
          <h3 style={{ marginBottom: 12 }}>Uploading Images</h3>
          <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', background: 'var(--garnet)', transition: 'width .2s',
              width: `${Math.round((imgProgress.done / imgProgress.total) * 100)}%`
            }} />
          </div>
          <p style={{ fontSize: 14, color: 'var(--mid)' }}>
            {imgProgress.done} / {imgProgress.total} processed — {imgProgress.matched} uploaded, {imgProgress.skipped} not found
          </p>
        </div>
      )}

      {/* ── STEP 5: Done ── */}
      {step === STEP.DONE && result && (
        <>
          <div className="admin-card" style={{ maxWidth: 480 }}>
            <div className="alert alert-success" style={{ marginBottom: 0 }}>
              <strong>Import complete!</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
                <li>{result.inserted} new products added</li>
                <li>{result.updated} existing products updated</li>
                {result.skipped > 0 && <li>{result.skipped} rows skipped</li>}
              </ul>
            </div>

            {imgProgress && (
              <div className="alert alert-success" style={{ marginTop: 12, marginBottom: 0 }}>
                <strong>Images:</strong> {imgProgress.matched} uploaded, {imgProgress.skipped} not matched in folder.
              </div>
            )}

            {result.errors?.length > 0 && (
              <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                <strong>{result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, maxHeight: 160, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={reset}>
              Import Another File
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
