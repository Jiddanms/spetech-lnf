
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Integrasi Penuh: Backend Cloudflare Workers & D1 Database
 * UPDATE BESAR: CRUD Admin, State Management Fix, & Mobile Logic
 */

// 1. Konfigurasi State Aplikasi
const state = {
    user: null,
    currentPage: 'home',
    currentSubPage: {
        home: 'dashboard',
        lost: 'list',
        found: 'report',
        admin: 'forms',
        account: 'login'
    }
};

// Helper DOM Selector
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/**
 * 2. INISIALISASI NAVIGASI & ROUTING
 */
function initNavigation() {
    // Sidebar Navigation
    $$('.side-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            if (page) switchPage(page);
        });
    });

    // Navbar Navigation
    $$('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const subPage = btn.getAttribute('data-sub');
            const parentPage = btn.closest('.page').id.replace('page-', '');
            switchSubPage(parentPage, subPage);
        });
    });

    // Modal Close Button
    $('.btn-close-modal')?.addEventListener('click', () => window.utils.hideModal());

    // LOGIKA QR OTOMATIS
    const qrLocation = window.utils.getQueryParam('lokasi');
    if (qrLocation) {
        window.utils.showToast(`Lokasi QR: ${qrLocation}`, 'info');
        switchPage('found');
        switchSubPage('found', 'report');
        setTimeout(() => {
            const locationInput = $('#found-location-input');
            if (locationInput) {
                locationInput.value = qrLocation;
                updateBackground(qrLocation);
            }
        }, 500);
    }
}

/**
 * 3. CORE SWITCHING LOGIC (Fixed State Bug)
 */
function switchPage(pageId) {
    state.currentPage = pageId;
    
    // Sidebar UI Sync
    $$('.side-item').forEach(btn => btn.classList.remove('active'));
    $(`#btn-page-${pageId}`)?.classList.add('active');

    // Page Visibility
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${pageId}`)?.classList.remove('hidden');

    // QoL Fix: Jika kembali ke page account saat sudah login, pastikan tab logout tampil
    if (pageId === 'account' && state.user) {
        switchSubPage('account', 'logout');
    }

    loadPageData(pageId);
}

function switchSubPage(parentPage, subId) {
    // QoL Fix: Cegah kembali ke login jika user sudah ada di state
    let targetSub = subId;
    if (parentPage === 'account' && state.user && subId === 'login') {
        targetSub = 'logout';
    }

    state.currentSubPage[parentPage] = targetSub;

    // Tab Navbar UI Sync
    $$(`#page-${parentPage} .nav-tab`).forEach(btn => btn.classList.remove('active'));
    $(`#page-${parentPage} .nav-tab[data-sub="${targetSub}"]`)?.classList.add('active');

    // Content Visibility
    $$(`#page-${parentPage} .sub-container`).forEach(sp => sp.classList.add('hidden'));
    $(`#sub-${parentPage}-${targetSub}`)?.classList.remove('hidden');
}

/**
 * 4. DATA LOADING & RENDERING (Full CRUD Admin Support)
 */
async function loadPageData(pageId) {
    try {
        switch(pageId) {
            case 'home':
                await loadRecentLists();
                renderHomeLocations();
                break;
            case 'lost':
                await renderItemsList('lost');
                break;
            case 'found':
                await renderItemsList('found');
                break;
            case 'admin':
                await loadAdminDashboard();
                break;
        }
    } catch (err) {
        console.error("Sync Error:", err);
    }
}

async function loadRecentLists() {
    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    if (resLost.ok && $('#home-recent-lost')) {
        $('#home-recent-lost').innerHTML = resLost.data.slice(0, 3).map(i => createCompactItem(i)).join('');
    }
    if (resFound.ok && $('#home-recent-found')) {
        $('#home-recent-found').innerHTML = resFound.data.slice(0, 3).map(i => createCompactItem(i)).join('');
    }
}

function renderHomeLocations() {
    const locations = ["Gedung A", "Gedung B", "Gedung C", "Lapangan Upacara", "Lapangan Basket", "Lapangan Tenis", "Koperasi", "Kantin"];
    const container = $('#home-locations-list');
    if (container) {
        container.innerHTML = locations.map(loc => `<span class="tag">${loc}</span>`).join('');
    }
}

async function renderItemsList(type) {
    const container = $(`#${type}-list-container`);
    if (!container) return;
    container.innerHTML = '<div class="loader">Menghubungkan ke database...</div>';
    
    const result = type === 'lost' ? await window.apiClient.items.getLost() : await window.apiClient.items.getFound();
    if (result.ok && result.data.length > 0) {
        container.innerHTML = result.data.map(item => createItemCard(item)).join('');
    } else {
        container.innerHTML = `<div class="empty-state">Belum ada laporan ${type}.</div>`;
    }
}

function createItemCard(item) {
    const statusBadge = window.utils.getStatusBadge(item.status);
    return `
        <div class="item-card glass-card">
            <div class="card-img-wrapper">
                ${item.image_url ? `<img src="${item.image_url}" loading="lazy">` : '<i data-lucide="image-off"></i>'}
            </div>
            <div class="card-content">
                ${statusBadge}
                <h4>${item.item_name}</h4>
                <div class="card-meta">
                    <span><i data-lucide="map-pin"></i> ${item.location_name}</span>
                    <span><i data-lucide="calendar"></i> ${window.utils.formatDate(item.created_at)}</span>
                </div>
                <button class="btn-primary" style="margin-top:15px; width:100%; padding:8px;" onclick="viewDetail(${item.id})">Detail Info</button>
            </div>
        </div>
    `;
}

function createCompactItem(item) {
    return `
        <div class="compact-item" onclick="viewDetail(${item.id})" style="cursor:pointer; display: flex; align-items: center; gap: 10px; margin-bottom: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent);"></div>
            <div class="info">
                <div style="font-weight: 600; font-size: 0.9rem;">${item.item_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${item.location_name}</div>
            </div>
        </div>
    `;
}

/**
 * 5. ACTION HANDLERS (Auth & Form Fix)
 */
async function handleLogin() {
    const username = $('#login-username').value;
    const password = $('#login-password').value;
    if (!username || !password) return window.utils.showToast("Lengkapi form!", "error");

    const res = await window.apiClient.auth.login({ username, password });
    if (res.ok) {
        localStorage.setItem('sp_lnf_token', res.data.token);
        localStorage.setItem('sp_lnf_user', JSON.stringify(res.data.user));
        window.utils.showToast("Login Berhasil!", "success");
        setTimeout(() => location.reload(), 800);
    } else {
        window.utils.showToast(res.data.error || "Gagal Login", "error");
    }
}

async function handleRegister() {
    const username = $('#reg-username').value;
    const password = $('#reg-password').value;
    if (!username || !password) return window.utils.showToast("Lengkapi data!", "error");
    
    const res = await window.apiClient.auth.register({ username, password });
    if (res.ok) {
        window.utils.showToast("Registrasi Berhasil! Silakan Login.", "success");
        switchSubPage('account', 'login');
    } else {
        window.utils.showToast(res.data.error || "Gagal Register", "error");
    }
}

async function handleLogout() {
    localStorage.removeItem('sp_lnf_token');
    localStorage.removeItem('sp_lnf_user');
    window.utils.showToast("Logout Berhasil", "info");
    setTimeout(() => location.reload(), 800);
}

// FIX: handleReport sekarang mengambil data form secara dinamis (Cegah Missing Fields)
async function handleReport(type) {
    const form = $(`#form-${type}`);
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Validasi Dasar agar API tidak menolak
    if (!payload.item_name || !payload.location_name) {
        return window.utils.showToast("Barang dan lokasi wajib diisi!", "error");
    }

    const fileInput = $(`#${type}-photo`);
    if (fileInput?.files[0]) {
        window.utils.showToast("Memproses gambar...", "info");
        payload.image_url = await window.utils.fileToBase64(fileInput.files[0]);
    }

    const res = type === 'lost' ? await window.apiClient.items.reportLost(payload) : await window.apiClient.items.reportFound(payload);
    if (res.ok) {
        window.utils.showToast("Laporan Berhasil Terkirim!", "success");
        form.reset();
        switchSubPage(type, 'list');
        renderItemsList(type);
    } else {
        window.utils.showToast(res.data.error || "Gagal Mengirim", "error");
    }
}

/**
 * 6. GG ADMIN MANAGEMENT (CRUD POWER)
 */
async function loadAdminDashboard() {
    if (!state.user || state.user.role !== 'admin') return;

    // 6a. Admin Forms (Update & Delete Item)
    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    const allItems = [...(resLost.data || []), ...(resFound.data || [])];
    
    $('#admin-items-body').innerHTML = allItems.map(item => `
        <tr>
            <td>${item.item_name}</td>
            <td>${window.utils.getStatusBadge(item.status)}</td>
            <td>
                <select id="status-select-${item.id}" class="status-select-admin">
                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="verified" ${item.status === 'verified' ? 'selected' : ''}>Verified</option>
                    <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
                <button class="btn-save-status" onclick="updateItemStatus(${item.id})">Save</button>
            </td>
            <td>
                <button class="btn-text" style="color:var(--danger)" onclick="deleteItem(${item.id})">Delete</button>
                <button class="btn-primary" style="padding:5px 8px;" onclick="viewDetail(${item.id})">Detail</button>
            </td>
        </tr>
    `).join('');

    // 6b. Admin Accounts (Delete User)
    const resUsers = await window.apiClient.auth.getUsers();
    if (resUsers.ok) {
        $('#admin-accounts-body').innerHTML = resUsers.data.map(u => `
            <tr>
                <td>${u.username}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-info' : ''}">${u.role}</span></td>
                <td>
                    <button class="btn-text" style="color:var(--danger)" onclick="deleteUser(${u.id})">Delete Account</button>
                </td>
            </tr>
        `).join('');
    }

    // 6c. Admin Locations (Add/Delete)
    renderAdminLocations();
}

async function updateItemStatus(id) {
    const newStatus = $(`#status-select-${id}`).value;
    window.utils.showToast("Memperbarui status...", "info");
    const res = await window.apiClient.items.updateStatus(id, { status: newStatus });
    if (res.ok) {
        window.utils.showToast("Status Terupdate!", "success");
        loadAdminDashboard();
    } else {
        window.utils.showToast("Gagal Update", "error");
    }
}

async function deleteItem(id) {
    if (!confirm("Hapus laporan ini permanen?")) return;
    const res = await window.apiClient.items.delete(id);
    if (res.ok) {
        window.utils.showToast("Laporan Dihapus", "success");
        loadAdminDashboard();
    }
}

async function deleteUser(id) {
    if (id === state.user.id) return window.utils.showToast("Tidak bisa menghapus diri sendiri!", "error");
    if (!confirm("Hapus akun ini permanen?")) return;
    const res = await window.apiClient.auth.deleteUser(id);
    if (res.ok) {
        window.utils.showToast("Akun Dihapus", "success");
        loadAdminDashboard();
    }
}

function renderAdminLocations() {
    const locations = ["Gedung A", "Gedung B", "Gedung C", "Lapangan Upacara", "Lapangan Basket", "Lapangan Tenis", "Koperasi", "Kantin"];
    $('#admin-locations-grid').innerHTML = locations.map(loc => `
        <div class="tag" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <span>${loc}</span>
            <i data-lucide="trash-2" style="width:14px; cursor:pointer; color:var(--danger)" onclick="window.utils.showToast('Logic delete lokasi mengikuti DB','info')"></i>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * 7. MODAL DETAIL SYSTEM
 */
async function viewDetail(id) {
    const res = await window.apiClient.items.getDetail(id);
    if (res.ok) {
        const item = res.data;
        const html = `
            <div style="text-align:center; margin-bottom:20px;">
                ${item.image_url ? `<img src="${item.image_url}" style="max-width:100%; border-radius:12px; max-height:280px; border:1px solid var(--glass-border);">` : '<div style="padding:50px; background:rgba(255,255,255,0.03); border-radius:12px;"><i data-lucide="image-off"></i> No Image</div>'}
            </div>
            <h2 style="margin-bottom:10px;">${item.item_name}</h2>
            <div style="display:flex; flex-direction:column; gap:12px; border-top:1px solid var(--glass-border); padding-top:15px;">
                <p><strong>Status:</strong> ${window.utils.getStatusBadge(item.status)}</p>
                <p><strong>Lokasi:</strong> ${item.location_name}</p>
                <p><strong>Pelapor:</strong> ${item.reporter_name || item.owner_name}</p>
                <p><strong>Waktu:</strong> ${window.utils.formatDate(item.created_at)}</p>
                <p><strong>Deskripsi:</strong> ${item.description || '-'}</p>
            </div>
        `;
        window.utils.showModal(html);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * 8. INITIAL LOAD & DYNAMIC BACKGROUND
 */
const updateBackground = (locationValue) => {
    const bgOverlay = document.getElementById('bg-overlay');
    if (!bgOverlay) return;
    if (!locationValue || locationValue === "") {
        bgOverlay.style.backgroundImage = "url('assets/img/bg-home.jpg')";
        return;
    }
    const fileName = locationValue.toLowerCase().replace(/\s+/g, '-');
    const path = `assets/img/bg-${fileName}.jpg`;
    bgOverlay.style.backgroundImage = `url('${path}')`;
    localStorage.setItem('sp_current_bg', path);
};

document.addEventListener('DOMContentLoaded', async () => {
    // 8a. Background Logic
    const savedBg = localStorage.getItem('sp_current_bg');
    $('#bg-overlay').style.backgroundImage = savedBg ? `url('${savedBg}')` : "url('assets/img/bg-home.jpg')";

    // 8b. Session & UI Sync (Kunci State Logout)
    const session = await window.apiClient.auth.checkSession();
    if (session.ok && session.data.loggedIn) {
        state.user = session.data.user;
        $('#side-account-text').innerText = "Logout";
        $('#logged-username-display').innerText = state.user.username;
        if (state.user.role === 'admin') $('#btn-page-admin').classList.remove('hidden');
        
        // Pastikan halaman account mengarah ke Logout View
        if (state.currentPage === 'account') switchSubPage('account', 'logout');
    }

    initNavigation();
    loadPageData('home');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 8c. Event Bindings
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-register-action')?.addEventListener('click', handleRegister);
    $('#btn-logout-action')?.addEventListener('click', handleLogout);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
    
    document.addEventListener('change', (e) => {
        if (e.target.name === 'location_name') updateBackground(e.target.value);
    });
});
