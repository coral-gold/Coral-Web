const BASE = '/api';

// Tracks in-flight requests so a global loading indicator can show on any
// module load / list fetch / action, without every page having to wire up
// its own loading state. Pass { silent: true } to exclude a call (e.g.
// background job-status polling that already has its own progress UI).
let activeCount = 0;
const listeners = new Set();
function notify() { listeners.forEach(fn => fn(activeCount)); }

// Always resolves to a { ok, ... } object, never throws/rejects — every page
// in the app follows the same `if (d.ok) … else show(d.error)` pattern, and
// this used to break that contract for any non-2xx status outside a small
// exempted list (a stray fetch()/JSON error would reject uncaught, leaving
// a "Saving…" button stuck forever with nothing shown — e.g. Add/Edit
// Product whenever a rejected upload, like a phone's HEIC photos, made
// multer respond with anything other than 200).
async function req(method, url, body, isForm = false, opts = {}) {
  const silent = !!opts.silent;
  if (!silent) { activeCount++; notify(); }
  try {
    const fetchOpts = { method, credentials: 'same-origin' };
    if (body) {
      if (isForm) {
        fetchOpts.body = body; // FormData
      } else {
        fetchOpts.headers = { 'Content-Type': 'application/json' };
        fetchOpts.body = JSON.stringify(body);
      }
    }
    const r = await fetch(BASE + url, fetchOpts);
    let data;
    try {
      data = await r.json();
    } catch {
      return { ok: false, error: `Server returned an unexpected response (HTTP ${r.status}).` };
    }
    if (data && typeof data === 'object' && data.ok === undefined) data.ok = r.ok;
    return data;
  } catch (e) {
    return { ok: false, error: e.message || 'Network error.' };
  } finally {
    if (!silent) { activeCount--; notify(); }
  }
}

const api = {
  get:    (url, opts)       => req('GET',    url, undefined, false, opts),
  post:   (url, body, opts) => req('POST',   url, body, false, opts),
  put:    (url, body, opts) => req('PUT',    url, body, false, opts),
  patch:  (url, body, opts) => req('PATCH',  url, body, false, opts),
  del:    (url, opts)       => req('DELETE', url, undefined, false, opts),
  form:   (url, fd, opts)   => req('POST',   url, fd, true, opts),
  formPut:(url, fd, opts)   => req('PUT',    url, fd, true, opts),
  // Subscribe to the in-flight request count; returns an unsubscribe fn.
  subscribeLoading: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};

export default api;
