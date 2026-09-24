const BASE = '/api';

// Tracks in-flight requests so a global loading indicator can show on any
// module load / list fetch / action, without every page having to wire up
// its own loading state. Pass { silent: true } to exclude a call (e.g.
// background job-status polling that already has its own progress UI).
let activeCount = 0;
const listeners = new Set();
function notify() { listeners.forEach(fn => fn(activeCount)); }

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
    if (!r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404) {
      const txt = await r.text().catch(() => '');
      throw new Error(txt || `HTTP ${r.status}`);
    }
    return await r.json();
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
