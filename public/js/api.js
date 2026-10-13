/**
 * Small client for the Bread Bar API.
 * - Access token is kept in memory only.
 * - Refresh token is kept in sessionStorage for this local demo so a page
 *   reload keeps you signed in. In the real React Native app, use
 *   expo-secure-store instead.
 * - Expired access tokens are refreshed automatically once, then retried.
 */
class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details || [];
  }
}

const SESSION_ENDED = ['AUTH_REQUIRED', 'SESSION_REVOKED', 'INVALID_REFRESH_TOKEN', 'INVALID_TOKEN'];

function createApi(kind) {
  const base = kind === 'staff' ? '/api/staff/auth' : '/api/customer/auth';
  const storeKey = `breadbar.${kind}.refresh`;
  let accessToken = null;
  let refreshing = null;

  const getRefresh = () => { try { return sessionStorage.getItem(storeKey); } catch { return null; } };
  const setRefresh = (t) => {
    try { t ? sessionStorage.setItem(storeKey, t) : sessionStorage.removeItem(storeKey); } catch { /* storage unavailable */ }
  };

  function saveSession(data) {
    accessToken = data.accessToken;
    setRefresh(data.refreshToken);
    return data.user;
  }

  async function send(method, path, body, token) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError('Can\'t reach the server. Check that "npm run dev" is still running.', 'NETWORK', 0);
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data.error || {};
      throw new ApiError(e.message || `Request failed (${res.status})`, e.code || 'ERROR', res.status, e.details);
    }
    return data;
  }

  function refresh() {
    const rt = getRefresh();
    if (!rt) return Promise.reject(new ApiError('Please log in to continue', 'AUTH_REQUIRED', 401));
    if (!refreshing) {
      refreshing = send('POST', `${base}/refresh`, { refreshToken: rt })
        .then(saveSession)
        .catch((err) => { setRefresh(null); accessToken = null; throw err; })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function authed(method, path, body) {
    if (!accessToken) await refresh();
    try {
      return await send(method, path, body, accessToken);
    } catch (err) {
      if (err.code !== 'TOKEN_EXPIRED') throw err;
      await refresh();
      return send(method, path, body, accessToken);
    }
  }

  return {
    register: async (body) => saveSession(await send('POST', `${base}/register`, body)),
    login: async (body) => saveSession(await send('POST', `${base}/login`, body)),
    setupOwner: async (body) => saveSession(await send('POST', '/api/staff/auth/setup-owner', body)),

    /** Restores a session after a page reload. Returns the user or null. */
    async resume() {
      if (!getRefresh()) return null;
      try { return await refresh(); } catch { return null; }
    },

    async logout() {
      const rt = getRefresh();
      accessToken = null;
      setRefresh(null);
      if (rt) await send('POST', `${base}/logout`, { refreshToken: rt }).catch(() => {});
    },

    get: (path) => authed('GET', path),
    post: (path, body) => authed('POST', path, body),
    patch: (path, body) => authed('PATCH', path, body),
  };
}

// ---------- UI helpers shared by both apps ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Builds DOM nodes. Text is always set with textContent, never innerHTML (XSS-safe). */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function formValues(form) {
  const values = {};
  for (const [key, value] of new FormData(form)) {
    const v = typeof value === 'string' ? value.trim() : value;
    if (v !== '') values[key] = key === 'password' ? value : v; // never trim passwords
  }
  return values;
}

function clearErrors(form) {
  $$('.field-error', form).forEach((n) => n.remove());
  $$('[aria-invalid]', form).forEach((n) => n.removeAttribute('aria-invalid'));
  const box = $('.form-error', form);
  if (box) { box.hidden = true; box.textContent = ''; }
}

function showErrors(form, err) {
  clearErrors(form);
  const box = $('.form-error', form);
  if (box) { box.textContent = err.message; box.hidden = false; }
  for (const d of err.details || []) {
    const input = form.elements[d.field];
    if (!(input instanceof Element)) continue;
    input.setAttribute('aria-invalid', 'true');
    input.closest('.field').append(el('p', { class: 'field-error', text: d.message }));
  }
}

/** Disables a button and swaps its label while `task` runs. */
async function busy(button, label, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { return await task(); } finally { button.disabled = false; button.textContent = original; }
}

/** Wires up chip tabs: <button role="tab" data-tab="x"> controls <... data-panel="x">. */
function setupTabs(root, onChange) {
  const tabs = $$('[role="tab"]', root);
  const select = (name) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('[data-panel]', root).forEach((p) => { p.hidden = p.dataset.panel !== name; });
    if (onChange) onChange(name);
  };
  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.tab)));
  return select;
}

const formatRand = (n) => `R${Number(n).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
const STATUS_LABELS = { OutForDelivery: 'Out for delivery' };
const statusLabel = (s) => STATUS_LABELS[s] || s;
