import React, { useState } from 'react';
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
  { value: 'amount',       label: 'Amount (diamond/stone)' },
  { value: 'description',  label: 'Description' },
];

const STEP = { UPLOAD: 0, MAP: 1, RUNNING: 2, DONE: 3 };

const STRATEGIES = [
  { value: 'skip',    label: 'Skip Same (default)',        desc: 'If Style Number already exists, leave it unchanged.' },
  { value: 'fill',    label: 'Style By Default',           desc: 'Keep existing data; only fill in currently-blank fields.' },
  { value: 'merge',   label: 'Merge Style',                desc: 'New values overwrite existing where both are set.' },
  { value: 'replace', label: 'Add New Style, Old Delete',  desc: 'Delete existing record and create a fresh one from this row.' },
];

export default function Import() {
  const [step,        setStep]       = useState(STEP.UPLOAD);
  const [xlsxFile,    setXlsxFile]   = useState(null);
  const [strategy,    setStrategy]   = useState('skip');
  const [preview,     setPreview]    = useState(null);   // { fileId, headers, suggestions, rowCount }
  const [mapping,     setMapping]    = useState({});     // { header: fieldName | '' }
  const [result,      setResult]     = useState(null);
  const [runProgress, setRunProgress]= useState(null);   // { done, total, step }
  const { show } = useToast();

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
    setRunProgress(null);

    // Start background job — server responds immediately with jobId
    const d = await api.post('/admin/import/run', { fileId: preview.fileId, mapping, strategy });
    if (!d.ok) { show(d.error || 'Import failed', 'error'); setStep(STEP.MAP); return; }

    // Poll job status every 600ms until done
    let jobResult;
    while (true) {
      await new Promise(r => setTimeout(r, 600));
      let status;
      try { status = await api.get(`/admin/jobs/${d.jobId}`, { silent: true }); } catch (_) { continue; }
      if (!status || !status.ok) continue;
      if (status.progress) setRunProgress(status.progress);
      if (status.status === 'done') { jobResult = status.result; break; }
      if (status.status === 'error') { show(status.error || 'Import failed', 'error'); setStep(STEP.MAP); return; }
    }

    setResult(jobResult);
    show(`Done: ${jobResult.inserted} new, ${jobResult.updated} updated`);
    setStep(STEP.DONE);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setStep(STEP.UPLOAD);
    setXlsxFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <h1 className="admin-page-title">ERP Import</h1>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['1. Upload', STEP.UPLOAD], ['2. Map Columns', STEP.MAP], ['3. Results', STEP.DONE]].map(([label, s]) => (
          <span key={s} style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: step === s || (step === STEP.RUNNING && s === STEP.MAP)
              ? 'var(--garnet)' : 'rgba(0,0,0,0.06)',
            color: step === s || (step === STEP.RUNNING && s === STEP.MAP)
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
              <label>Duplicate Style Number strategy</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {STRATEGIES.map(s => (
                  <label key={s.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, border: `1px solid ${strategy === s.value ? 'var(--garnet)' : 'rgba(0,0,0,0.1)'}`, background: strategy === s.value ? 'rgba(139,0,0,0.04)' : 'transparent' }}>
                    <input type="radio" name="strategy" value={s.value} checked={strategy === s.value} onChange={() => setStrategy(s.value)} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>
                      <strong style={{ fontSize: 13 }}>{s.label}</strong>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--mid)' }}>{s.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
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
        <div className="admin-card" style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span className="spinner" style={{ width: 22, height: 22, borderWidth: 3, flexShrink: 0 }} />
            <span style={{ color: 'var(--mid)', fontSize: 14 }}>
              {runProgress ? runProgress.step : 'Starting import…'}
            </span>
          </div>
          {runProgress && runProgress.total > 0 && (
            <>
              <div style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', background: 'var(--garnet)', transition: 'width .3s',
                  width: `${Math.round((runProgress.done / runProgress.total) * 100)}%`
                }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--mid)', margin: 0 }}>
                {runProgress.done} / {runProgress.total} rows processed
              </p>
            </>
          )}
        </div>
      )}

      {/* ── STEP 4: Done ── */}
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
