const BASE = '/api';

async function req(method, url, body, isForm = false) {
  const opts = { method, credentials: 'same-origin' };
  if (body) {
    if (isForm) {
      opts.body = body; // FormData
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
  }
  const r = await fetch(BASE + url, opts);
  if (!r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404) {
    const txt = await r.text().catch(() => '');
    throw new Error(txt || `HTTP ${r.status}`);
  }
  return r.json();
}

const api = {
  get:    (url)        => req('GET',    url),
  post:   (url, body)  => req('POST',   url, body),
  put:    (url, body)  => req('PUT',    url, body),
  patch:  (url, body)  => req('PATCH',  url, body),
  del:    (url)        => req('DELETE', url),
  form:   (url, fd)    => req('POST',   url, fd, true),
  formPut:(url, fd)    => req('PUT',    url, fd, true),
};

export default api;
