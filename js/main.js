
/**
 * frontend/js/main.js
 * Updated main.js (2026) — adapted to work with Cloudflare Workers (API_BASE)
 * - Frontend remains served from root
 * - Detects local dev (localhost/127.0.0.1) to use multipart FormData for file uploads
 * - For remote Worker API, converts file to base64 and sends JSON { photo: "<data>" }
 * - Uses API_BASE constant (replace with your Worker URL after deploy)
 */

/* ---------------------------
   Configuration
   --------------------------- */
// Replace this with your Worker URL after `wrangler publish` (no trailing slash).
// Example: "https://spetech-workers.abcd.workers.dev"
const API_BASE = "https://spetech-lnf.jiddanms.workers.dev"; // e.g. "https://...workers.dev" or "" to use relative /api

// Helper: detect local server (serve from same origin or explicit empty API_BASE)
function isLocalServer() {
  if (!API_BASE || API_BASE.trim() === "") return true;
  try {
    const u = new URL(API_BASE);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

/* ---------------------------
   DOM helpers
   --------------------------- */
const $ = (sel, ctx = document) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------------------------
   API helper
   --------------------------- */
async function apiFetch(path, opts = {}) {
  // path may start with /api or without; normalize
  const token = localStorage.getItem('sp_lnf_token');
  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Build URL
  let url;
  if (!API_BASE || API_BASE.trim() === "") {
    // relative to current origin
    url = `/api${path.startsWith('/') ? path : '/' + path}`;
  } else {
    url = `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  }

  const fetchOpts = Object.assign({}, opts, { headers, credentials: 'same-origin' });
  const res = await fetch(url, fetchOpts);
  let json = null;
  try { json = await res.json(); } catch (e) { /* ignore parse error */ }
  return Object.assign({}, json || {}, { __status: res.status, ok: res.ok });
}

/* ---------------------------
   App state
   --------------------------- */
const state = {
  currentPage: 'home',
  currentSub: null,
  user: null
};

/* ---------------------------
   Background utilities
   --------------------------- */
function getBgLayer() { return $('#bg-layer'); }
function normalizeBgName(name) {
  if (!name) return 'home';
  const s = String(name).trim();
  const allowed = [
    'home', 'Gedung A', 'Gedung B', 'Gedung C',
    'Lapangan Upacara', 'Lapangan Basket', 'Lapangan Tenis',
    'Koperasi', 'Kantin'
  ];
  if (allowed.includes(s)) return s;
  const found = allowed.find(a => a.toLowerCase() === s.toLowerCase());
  return found || 'home';
}
function setBackground(name, { persist = true } = {}) {
  try {
    const key = normalizeBgName(name);
    const layer = getBgLayer();
    if (!layer) return;
    const prev = layer.getAttribute('data-bg') || 'home';
    if (prev === key) return;
    layer.setAttribute('data-bg', key);
    layer.style.transition = 'opacity 360ms ease, filter 420ms ease';
    layer.style.opacity = '0';
    requestAnimationFrame(() => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--bg-opacity') || '0.55';
      layer.style.opacity = val;
    });
    if (persist) {
      try { localStorage.setItem('sp_lnf_bg', key); } catch (e) {}
    }
  } catch (err) { console.warn('[bg] setBackground error', err); }
}
function initBackground() {
  const layer = getBgLayer();
  if (!layer) return;
  layer.setAttribute('data-bg', 'home');
  layer.style.opacity = getComputedStyle(document.documentElement).getPropertyValue('--bg-opacity') || '0.55';
}

/* ---------------------------
   Navigation
   --------------------------- */
function showPage(pageId) {
  $$('.side-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
  const titleMap = { home: 'Home', lost: 'Lost', found: 'Found', admin: 'Admin', account: 'Account' };
  const titleEl = $('#page-title');
  if (titleEl) titleEl.textContent = titleMap[pageId] || 'Spetech LNF';
  $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === pageId));
  state.currentPage = pageId;

  switch (pageId) {
    case 'home': activateSub('home-short-lost'); break;
    case 'lost': activateSub('lost-list'); break;
    case 'found': activateSub('found-report'); break;
    case 'admin':
      activateSub('admin-form');
      if (state.user && state.user.role === 'admin') {
        loadAdminForms().catch(()=>{});
        loadAdminAccounts().catch(()=>{});
      }
      break;
    case 'account':
      const stored = localStorage.getItem('sp_lnf_user');
      activateSub(stored ? 'account-logout' : 'account-login');
      break;
  }
}
function activateSub(subId) {
  $$('.page-navbar .nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.sub === subId));
  const page = $(`#page-${state.currentPage}`);
  if (!page) return;
  $$('.subpage', page).forEach(sp => sp.classList.toggle('hidden', sp.id !== `sub-${subId}` && sp.id !== subId));
  $$('.subpage', page).forEach(sp => {
    const normalized = sp.id.replace(/^sub-/, '');
    sp.classList.toggle('hidden', normalized !== subId);
  });
  state.currentSub = subId;
  if (state.currentPage === 'account' && subId === 'account-logout') renderLogoutSubpage();
}
function initNavigation() {
  $$('.side-btn').forEach(btn => on(btn, 'click', () => showPage(btn.dataset.page)));
  $$('.page-navbar').forEach(nav => {
    on(nav, 'click', (e) => {
      const btn = e.target.closest('.nav-btn');
      if (!btn) return;
      const sub = btn.dataset.sub;
      if (state.currentPage === 'home' && sub && sub.startsWith('home-short-')) {
        const targetPage = sub.replace('home-short-', '');
        showPage(targetPage);
        return;
      }
      activateSub(sub);
    });
  });
  on($('#sidebar-toggle'), 'click', () => {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.toggle('collapsed');
  });
  showPage(state.currentPage);
}

/* ---------------------------
   Form handlers
   --------------------------- */
function bindForms() {
  // Lost submit (JSON)
  on($('#lost-submit'), 'click', async () => {
    const name = ($('#lost-name') && $('#lost-name').value || '').trim();
    const desc = ($('#lost-desc') && $('#lost-desc').value || '').trim();
    const location = ($('#lost-location') && $('#lost-location').value) || '';
    const contact = ($('#lost-contact') && $('#lost-contact').value || '').trim();

    if (!name || !desc || !location) { notifier.error('Isi semua field wajib pada laporan kehilangan.'); return; }

    try {
      // For both local and worker we send JSON for lost (no file)
      const res = await apiFetch('/account/health'); // quick ping to ensure API reachable (optional)
      const payload = { name, description: desc, location, contact, type: 'lost' };
      const r = await apiFetch('/lost/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r && (r.ok || r.__status === 200 || r.__status === 201)) {
        notifier.success('Laporan kehilangan berhasil dikirim.');
        const form = $('#form-lost-report'); if (form) form.reset();
        setBackground(location);
        await loadLostList(); await loadRecentLists();
      } else {
        notifier.error(r.message || 'Gagal mengirim laporan kehilangan.');
      }
    } catch (err) {
      console.error(err); notifier.error('Gagal mengirim laporan. Coba lagi.');
    }
  });

  // Lost location change updates background
  const lostLocationSelect = $('#lost-location');
  if (lostLocationSelect) on(lostLocationSelect, 'change', (e) => { const val = e.target.value; if (val) setBackground(val); });

  // Found submit (may include photo)
  on($('#found-submit'), 'click', async () => {
    const name = ($('#found-name') && $('#found-name').value || '').trim();
    const desc = ($('#found-desc') && $('#found-desc').value || '').trim();
    const location = ($('#found-location') && $('#found-location').value) || '';
    const photoInput = $('#found-photo');

    if (!name || !desc || !location) { notifier.error('Isi semua field wajib pada laporan penemuan.'); return; }

    try {
      // If local server (multer) -> send FormData; otherwise convert file to base64 and send JSON
      if (photoInput && photoInput.files && photoInput.files[0]) {
        const file = photoInput.files[0];
        if (isLocalServer()) {
          const fd = new FormData();
          fd.append('name', name);
          fd.append('description', desc);
          fd.append('location', location);
          fd.append('photo', file);
          const res = await fetch((!API_BASE ? '' : API_BASE) + '/found/add', { method: 'POST', body: fd, credentials: 'same-origin' });
          const json = await (async () => { try { return await res.json(); } catch (e) { return { ok: res.ok, __status: res.status }; } })();
          if (json && (json.ok || json.__status === 200 || json.__status === 201)) {
            notifier.success('Laporan penemuan berhasil dikirim.');
            const form = $('#form-found-report'); if (form) form.reset();
            setBackground(location);
            await loadFoundList(); await loadRecentLists();
          } else notifier.error(json.message || 'Gagal mengirim laporan penemuan.');
        } else {
          // Convert to base64 and send JSON (Workers expect photo as URL/base64)
          const base64 = await fileToBase64(file);
          const payload = { name, description: desc, location, photo: base64, type: 'found' };
          const r = await apiFetch('/found/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (r && (r.ok || r.__status === 200 || r.__status === 201)) {
            notifier.success('Laporan penemuan berhasil dikirim.');
            const form = $('#form-found-report'); if (form) form.reset();
            setBackground(location);
            await loadFoundList(); await loadRecentLists();
          } else notifier.error(r.message || 'Gagal mengirim laporan penemuan.');
        }
      } else {
        // No file: send JSON
        const payload = { name, description: desc, location, photo: null, type: 'found' };
        const r = await apiFetch('/found/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r && (r.ok || r.__status === 200 || r.__status === 201)) {
          notifier.success('Laporan penemuan berhasil dikirim.');
          const form = $('#form-found-report'); if (form) form.reset();
          setBackground(location);
          await loadFoundList(); await loadRecentLists();
        } else notifier.error(r.message || 'Gagal mengirim laporan penemuan.');
      }
    } catch (err) {
      console.error(err); notifier.error('Gagal mengirim laporan penemuan.');
    }
  });

  // Found location change updates background
  const foundLocationSelect = $('#found-location');
  if (foundLocationSelect) on(foundLocationSelect, 'change', (e) => { const val = e.target.value; if (val) setBackground(val); });

  // Login
  on($('#login-btn'), 'click', async () => {
    const username = ($('#login-username') && $('#login-username').value || '').trim();
    const password = ($('#login-password') && $('#login-password').value) || '';
    if (!username || !password) { notifier.error('Masukkan username dan password.'); return; }
    try {
      const res = await apiFetch('/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      if (res && (res.ok || res.__status === 200)) {
        state.user = res.user || res.data || res;
        localStorage.setItem('sp_lnf_user', JSON.stringify(state.user));
        if (res.token) localStorage.setItem('sp_lnf_token', res.token);
        updateUserBadge();
        notifier.success('Login berhasil.');
        showPage('home');
        if (state.user && state.user.role === 'admin') await Promise.all([loadAdminForms(), loadAdminAccounts()]);
      } else {
        notifier.error(res.message || 'Login gagal.');
      }
    } catch (err) { console.error(err); notifier.error('Terjadi kesalahan saat login.'); }
  });

  // Register
  on($('#register-btn'), 'click', async () => {
    const username = ($('#reg-username') && $('#reg-username').value || '').trim();
    const password = ($('#reg-password') && $('#reg-password').value) || '';
    const role = ($('#reg-role') && $('#reg-role').value) || 'user';
    if (!username || !password) { notifier.error('Isi username dan password untuk registrasi.'); return; }
    try {
      const res = await apiFetch('/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role }) });
      if (res && (res.ok || res.__status === 200 || res.__status === 201)) {
        notifier.success('Registrasi berhasil. Silakan login.');
        showPage('account'); activateSub('account-login');
      } else notifier.error(res.message || 'Registrasi gagal.');
    } catch (err) { console.error(err); notifier.error('Terjadi kesalahan saat registrasi.'); }
  });

  // Admin create account (uses admin endpoint)
  on($('#mgmt-create-btn'), 'click', async () => {
    if (!ensureAdmin()) return;
    const username = ($('#mgmt-username') && $('#mgmt-username').value || '').trim();
    const password = ($('#mgmt-password') && $('#mgmt-password').value) || '';
    const role = ($('#mgmt-role') && $('#mgmt-role').value) || 'user';
    if (!username || !password) { notifier.error('Isi username dan password untuk membuat akun.'); return; }
    try {
      const res = await apiFetch('/admin/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role }) });
      if (res && (res.ok || res.__status === 200 || res.__status === 201)) {
        notifier.success('Akun berhasil dibuat.');
        const form = $('#form-admin-create'); if (form) form.reset();
        await loadAdminAccounts();
      } else notifier.error(res.message || 'Gagal membuat akun.');
    } catch (err) { console.error(err); notifier.error('Terjadi kesalahan saat membuat akun.'); }
  });

  // Delegated admin & account controls
  on(document, 'click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Admin forms area
    if (btn.closest('#admin-forms-list') || btn.closest('#mgmt-forms-list')) {
      if (!ensureAdmin()) return;
      const action = btn.dataset.action;
      const itemId = btn.dataset.id;
      if (!action || !itemId) return;

      if (action === 'delete') {
        if (!confirm('Hapus form ini? Tindakan tidak dapat dibatalkan.')) return;
        try {
          const res = await apiFetch(`/admin/forms/${itemId}`, { method: 'DELETE' });
          if (res && (res.ok || res.__status === 200)) {
            notifier.success('Form dihapus.');
            await Promise.all([loadAdminForms(), loadLostList(), loadFoundList()]);
          } else notifier.error(res.message || 'Gagal menghapus form.');
        } catch (err) { console.error(err); notifier.error('Gagal menghapus form.'); }
      }

      if (action === 'set-status') {
        const select = document.querySelector(`#status-select-${itemId}`);
        if (!select) return;
        const newStatus = select.value;
        try {
          const res = await apiFetch(`/admin/forms/${itemId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
          if (res && (res.ok || res.__status === 200)) {
            notifier.success('Status diperbarui.');
            await Promise.all([loadAdminForms(), loadLostList(), loadFoundList()]);
          } else notifier.error(res.message || 'Gagal memperbarui status.');
        } catch (err) { console.error(err); notifier.error('Gagal memperbarui status.'); }
      }
    }

    // Account list actions
    if (btn.closest('#account-list')) {
      if (!ensureAdmin()) return;
      const userId = btn.dataset.id;
      const action = btn.dataset.action;
      if (!userId || !action) return;

      if (action === 'set-role') {
        const newRole = prompt('Masukkan role baru (user/admin):', btn.dataset.role || 'user');
        if (!newRole || !['user','admin'].includes(newRole)) { notifier.error('Role tidak valid.'); return; }
        try {
          const res = await apiFetch(`/admin/accounts/${userId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }) });
          if (res && (res.ok || res.__status === 200)) {
            notifier.success('Role diperbarui.');
            await loadAdminAccounts();
          } else notifier.error(res.message || 'Gagal memperbarui role.');
        } catch (err) { console.error(err); notifier.error('Gagal memperbarui role.'); }
      }

      if (action === 'delete-user') {
        if (!confirm('Hapus akun ini? Tindakan tidak dapat dibatalkan.')) return;
        try {
          const res = await apiFetch(`/admin/accounts/${userId}`, { method: 'DELETE' });
          if (res && (res.ok || res.__status === 200)) {
            notifier.success('Akun dihapus.');
            await loadAdminAccounts();
          } else notifier.error(res.message || 'Gagal menghapus akun.');
        } catch (err) { console.error(err); notifier.error('Gagal menghapus akun.'); }
      }
    }
  });

  // Admin forms filter binding
  const adminFilter = $('#admin-forms-filter') || document.querySelector('.admin-forms-filter');
  if (adminFilter) {
    on(adminFilter, 'change', (e) => {
      const val = e.target.value || '';
      loadAdminForms(val).catch(err => console.error('admin filter load error', err));
    });
  }
}

/* ---------------------------
   Data loaders & renderers
   --------------------------- */
function getContainer(primarySelector, fallbackSelectors = []) {
  let el = $(primarySelector);
  if (el) return el;
  for (const s of fallbackSelectors) {
    el = $(s);
    if (el) return el;
  }
  return null;
}

async function loadLostList() {
  try {
    const res = await apiFetch('/lost/list');
    const items = res && (res.items || res.data || res.list) ? (res.items || res.data || res.list) : (Array.isArray(res) ? res : []);
    const container = getContainer('#found-items-grid', ['#lost-items-grid', '#found-items', '#found-grid']);
    renderItemsGrid(container ? `#${container.id}` : '#found-items-grid', items || [], false, 'lost');
  } catch (err) { console.error('loadLostList error', err); }
}

async function loadFoundList() {
  try {
    const res = await apiFetch('/found/list');
    const items = res && (res.items || res.data || res.list) ? (res.items || res.data || res.list) : (Array.isArray(res) ? res : []);
    const container = getContainer('#lost-items-grid', ['#found-items-grid', '#lost-items', '#lost-grid']);
    renderItemsGrid(container ? `#${container.id}` : '#lost-items-grid', items || [], false, 'found');
  } catch (err) { console.error('loadFoundList error', err); }
}

async function loadRecentLists() {
  try {
    const [lost, found] = await Promise.all([apiFetch('/lost/recent'), apiFetch('/found/recent')]);
    const lostItems = lost && lost.items ? lost.items : [];
    const foundItems = found && found.items ? found.items : [];
    renderItemsGrid('#home-lost-recent', lostItems || [], false, 'lost');
    renderItemsGrid('#home-found-recent', foundItems || [], false, 'found');
  } catch (err) { console.error('loadRecentLists error', err); }
}

async function loadAdminForms(type = '') {
  try {
    const q = type ? `?type=${encodeURIComponent(type)}` : '';
    const res = await apiFetch(`/admin/forms${q}`);
    const items = res && (res.items || res.data || res.list) ? (res.items || res.data || res.list) : [];
    renderItemsGrid('#admin-forms-list', items || [], true);
    renderMgmtList('#mgmt-forms-list', items || []);
  } catch (err) { console.error('loadAdminForms error', err); }
}

async function loadAdminAccounts() {
  try {
    const res = await apiFetch('/admin/accounts');
    let users = [];
    if (!res) users = [];
    else if (Array.isArray(res)) users = res;
    else if (Array.isArray(res.users)) users = res.users;
    else if (Array.isArray(res.data)) users = res.data;
    else users = [];
    users = users.map(u => Object.assign({}, u, { id: u.id || u._id || u.username }));
    renderAccountList('#account-list', users || []);
  } catch (err) { console.error('loadAdminAccounts error', err); }
}

/* ---------------------------
   Render helpers
   --------------------------- */
function renderItemsGrid(containerSelectorOrEl, items = [], adminControls = false, forcedType = '') {
  const container = typeof containerSelectorOrEl === 'string' ? $(containerSelectorOrEl) : containerSelectorOrEl;
  if (!container) return;
  container.innerHTML = '';
  if (!items || !items.length) { container.innerHTML = `<div class="muted">Tidak ada data.</div>`; return; }

  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'grid-item';
    const id = it.id || it._id || it._uid || '';
    const type = forcedType || it.type || (it.isFound ? 'found' : (it.isLost ? 'lost' : 'unknown'));
    const photoUrl = it.photo || it.photoUrl || it.image || it.imageUrl || '';
    const photoHtml = photoUrl ? `<div class="thumb-wrap" style="width:100%;max-height:160px;overflow:hidden;border-radius:8px;margin-bottom:8px;"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(it.name||'')}" class="item-photo" style="width:100%;height:100%;object-fit:cover;display:block" /></div>` : '';
    const statusText = it.status ? ` • ${escapeHtml(it.status)}` : '';

    el.innerHTML = `
      ${photoHtml}
      <div class="title">${escapeHtml(it.name)}</div>
      <div class="meta">${escapeHtml(it.location || '')}${statusText}</div>
      <div class="meta">${escapeHtml(it.description || '')}</div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        ${adminControls ? adminControlHtml(it) : ''}
        <button class="btn secondary btn-detail" data-id="${escapeHtml(id)}" data-type="${escapeHtml(type)}">Detail</button>
      </div>
    `;
    container.appendChild(el);
  });
}

function adminControlHtml(item) {
  const statuses = ['pending', 'verified', 'completed', 'archived', 'deleted'];
  const options = statuses.map(s => `<option value="${s}" ${s===item.status?'selected':''}>${capitalize(s)}</option>`).join('');
  const id = item.id || item._id || '';
  return `
    <select id="status-select-${escapeHtml(id)}" class="select-status">${options}</select>
    <button class="btn primary" data-action="set-status" data-id="${escapeHtml(id)}">Simpan</button>
    <button class="btn danger" data-action="delete" data-id="${escapeHtml(id)}">Hapus</button>
  `;
}

function renderMgmtList(containerSelector, items = []) {
  const container = $(containerSelector);
  if (!container) return;
  container.innerHTML = '';
  if (!items.length) { container.innerHTML = `<div class="muted">Tidak ada form untuk dikelola.</div>`; return; }
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'grid-item';
    el.innerHTML = `
      <div class="title">${escapeHtml(it.name)}</div>
      <div class="meta">Tipe: ${escapeHtml(it.type || 'unknown')} • Lokasi: ${escapeHtml(it.location)}</div>
      <div class="meta">${escapeHtml(it.description || '')}</div>
      <div class="mgmt-controls" style="margin-top:8px">
        ${adminControlHtml(it)}
      </div>
    `;
    container.appendChild(el);
  });
}

function renderAccountList(containerSelector, users = []) {
  const container = $(containerSelector);
  if (!container) return;
  container.innerHTML = '';
  if (!users.length) { container.innerHTML = `<div class="muted">Tidak ada akun terdaftar.</div>`; return; }
  users.forEach(u => {
    const uid = u.id || u._id || u.username;
    const el = document.createElement('div');
    el.className = 'grid-item';
    el.innerHTML = `
      <div class="title">${escapeHtml(u.username)}</div>
      <div class="meta">Role: ${escapeHtml(u.role)} • Created: ${escapeHtml(u.createdAt || '')}</div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn primary" data-action="set-role" data-id="${escapeHtml(uid)}" data-role="${escapeHtml(u.role)}">Ubah Role</button>
        <button class="btn danger" data-action="delete-user" data-id="${escapeHtml(uid)}">Hapus</button>
      </div>
    `;
    container.appendChild(el);
  });
}

/* ---------------------------
   Utilities
   --------------------------- */
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function capitalize(s='') { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/* ---------------------------
   Detail modal
   --------------------------- */
function ensureDetailModal() {
  let modal = $('#detail-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'detail-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay" id="detail-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;">
      <div class="modal-content" style="background:var(--card);color:var(--white);border-radius:10px;max-width:820px;width:calc(100% - 40px);padding:18px;position:relative;box-shadow:0 10px 30px rgba(0,0,0,0.6);">
        <button id="modal-close" aria-label="Close" style="position:absolute;right:12px;top:8px;background:transparent;border:0;color:var(--muted);font-size:22px;cursor:pointer">×</button>
        <div id="modal-body"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  on($('#modal-close'), 'click', hideDetailModal);
  on($('#detail-modal-overlay'), 'click', (e) => {
    if (e.target && e.target.id === 'detail-modal-overlay') hideDetailModal();
  });
  return modal;
}
function showDetailModal(html) {
  const modal = ensureDetailModal();
  const body = $('#modal-body');
  if (body) body.innerHTML = html;
  modal.style.display = 'block';
}
function hideDetailModal() {
  const modal = $('#detail-modal');
  if (modal) modal.style.display = 'none';
}

async function viewDetails(id, type = '') {
  if (!id) { notifier.error('ID item tidak valid.'); return; }
  notifier.info('Memuat detail item...');
  try {
    // try typed endpoints then generic
    const endpoints = [];
    if (type === 'lost') endpoints.push((API_BASE ? API_BASE : '') + `/api/lost/${id}`);
    if (type === 'found') endpoints.push((API_BASE ? API_BASE : '') + `/api/found/${id}`);
    endpoints.push((API_BASE ? API_BASE : '') + `/api/items/${id}`);
    endpoints.push((API_BASE ? API_BASE : '') + `/api/found/${id}`, (API_BASE ? API_BASE : '') + `/api/lost/${id}`);

    let detail = null;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep);
        if (!r.ok) continue;
        const j = await r.json().catch(()=>null);
        if (!j) continue;
        if (j.item && typeof j.item === 'object') { detail = j.item; break; }
        if (j.data && typeof j.data === 'object' && !Array.isArray(j.data)) { detail = j.data; break; }
        if (j.items && Array.isArray(j.items) && j.items.length === 1) { detail = j.items[0]; break; }
        // if direct object
        if (j && j.id) { detail = j; break; }
      } catch (e) { /* ignore */ }
    }

    if (!detail) { notifier.error('Detail item tidak ditemukan.'); return; }

    const photoUrl = detail.photo || detail.photoUrl || detail.image || detail.imageUrl || '';
    const typeLabel = detail.type || type || (detail.isFound ? 'found' : (detail.isLost ? 'lost' : 'unknown'));
    const html = `
      <div style="display:flex;gap:16px;flex-direction:column;">
        ${photoUrl ? `<div style="width:100%;max-height:360px;overflow:hidden;border-radius:8px;margin-bottom:12px;"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(detail.name||'')}" style="width:100%;height:100%;object-fit:cover;display:block" /></div>` : ''}
        <h3 style="margin:0 0 8px 0;color:var(--accent)">${escapeHtml(detail.name || '—')}</h3>
        <div style="color:var(--muted);margin-bottom:8px">${escapeHtml(detail.location || '')} ${detail.status ? ' • ' + escapeHtml(detail.status) : ''} ${typeLabel ? ' • ' + escapeHtml(typeLabel) : ''}</div>
        <div style="margin-bottom:10px">${escapeHtml(detail.description || '')}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${detail.contact ? `<div><strong>Kontak:</strong> ${escapeHtml(detail.contact)}</div>` : ''}
          ${detail.reportedBy ? `<div><strong>Pelapor:</strong> ${escapeHtml(detail.reportedBy)}</div>` : ''}
          ${detail.createdAt ? `<div><strong>Tanggal:</strong> ${escapeHtml(detail.createdAt)}</div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn secondary" id="modal-close-btn">Tutup</button>
        </div>
      </div>
    `;
    showDetailModal(html);
    on($('#modal-close-btn'), 'click', hideDetailModal);
  } catch (err) {
    console.error(err); notifier.error('Gagal memuat detail item.');
  }
}

/* ---------------------------
   Auth helpers & UI
   --------------------------- */
function updateUserBadge() {
  const badge = $('#user-badge');
  if (!badge) return;
  const stored = localStorage.getItem('sp_lnf_user');
  if (!stored) { badge.textContent = 'Guest'; return; }
  try {
    const u = JSON.parse(stored);
    badge.textContent = u.username || 'User';
  } catch (e) { badge.textContent = 'User'; }
}
function ensureAdmin() {
  const stored = localStorage.getItem('sp_lnf_user');
  if (!stored) { notifier.error('Akses admin hanya untuk akun admin.'); return false; }
  try {
    const u = JSON.parse(stored);
    if (!u || u.role !== 'admin') { notifier.error('Akses admin hanya untuk akun admin.'); return false; }
    return true;
  } catch (e) { notifier.error('Akses admin hanya untuk akun admin.'); return false; }
}
function renderLogoutSubpage() {
  const el = $('#sub-account-logout');
  if (!el) return;
  const stored = localStorage.getItem('sp_lnf_user');
  if (!stored) { el.innerHTML = '<div class="muted">Belum login.</div>'; return; }
  try {
    const u = JSON.parse(stored);
    el.innerHTML = `<div>Anda login sebagai <strong>${escapeHtml(u.username)}</strong> (${escapeHtml(u.role)})</div><div style="margin-top:8px"><button id="logout-btn" class="btn danger">Logout</button></div>`;
    on($('#logout-btn'), 'click', async () => {
      try {
        const res = await apiFetch('/account/logout', { method: 'POST' });
        localStorage.removeItem('sp_lnf_user'); localStorage.removeItem('sp_lnf_token'); state.user = null;
        updateUserBadge(); notifier.success('Logged out'); showPage('home');
      } catch (err) { console.error(err); notifier.error('Gagal logout.'); }
    });
  } catch (e) { el.innerHTML = '<div class="muted">Belum login.</div>'; }
}

/* ---------------------------
   Init
   --------------------------- */
async function initApp() {
  initBackground();
  initNavigation();
  bindForms();
  updateUserBadge();
  // initial loads
  await Promise.all([loadLostList(), loadFoundList(), loadRecentLists()]);
  // attach delegated detail handler
  on(document, 'click', (e) => {
    const btn = e.target.closest('.btn-detail');
    if (!btn) return;
    const id = btn.dataset.id;
    const type = btn.dataset.type || '';
    viewDetails(id, type);
  });
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(err => console.error('initApp error', err));
});
