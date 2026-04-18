
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Integrasi Penuh: Backend Cloudflare Workers & D1 Database
 * UPDATE QoL 6.16: Bug Fix Modal, Form Lost Fix, & Admin Delete Active
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED
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
    // Sidebar Navigation (Main Pages)
    $$('.side-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            if (page) switchPage(page);
        });
    });

    // Navbar Navigation (Sub Pages)
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
            const locationInputs = $$('select[name="location_name"], .location-selector');
            locationInputs.forEach(input => {
                input.value = qrLocation;
            });
            updateBackground(qrLocation);
        }, 500);
    }
}

/**
 * 3. CORE SWITCHING LOGIC
 */
function switchPage(pageId) {
    state.currentPage = pageId;
    
    // Sidebar UI Sync
    $$('.side-item').forEach(btn => btn.classList.remove('active'));
    $(`#btn-page-${pageId}`)?.classList.add('active');

    // Page Visibility
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${pageId}`)?.classList.remove('hidden');

    // QoL Fix: Jika user sudah login, paksa tab Account ke view Logout
    if (pageId === 'account' && state.user) {
        switchSubPage('account', 'logout');
    }

    loadPageData(pageId);
}

function switchSubPage(parentPage, subId) {
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
 * 4. DATA LOADING & RENDERING
 */
async function loadPageData(pageId) {
    try {
        switch(pageId) {
            case 'home':
                await loadRecentLists();
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
        console.error("Gagal sinkronisasi data:", err);
    }
}

async function loadRecentLists() {
    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    
    if (resLost.ok && $('#recent-lost-list')) {
        $('#recent-lost-list').innerHTML = resLost.data.slice(0, 3).map(i => createCompactItem(i)).join('');
    }
    if (resFound.ok && $('#recent-found-list')) {
        $('#recent-found-list').innerHTML = resFound.data.slice(0, 3).map(i => createCompactItem(i)).join('');
    }
}

async function renderItemsList(type) {
    const container = $(`#${type}-items-container`) || $(`#${type}-list-container`);
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
 * 5. ACTION HANDLERS (Auth & Forms)
 */
async function handleLogin() {
    const username = $('#login-username').value;
    const password = $('#login-password').value;
    if(!username || !password) return window.utils.showToast("Lengkapi form!", "error");

    const res = await window.apiClient.auth.login({ username, password });
    if (res.ok) {
        localStorage.setItem('sp_lnf_token', res.data.token);
        localStorage.setItem('sp_lnf_user', JSON.stringify(res.data.user));
        window.utils.showToast("Selamat Datang!", "success");
        setTimeout(() => location.reload(), 800);
    } else {
        window.utils.showToast(res.data.error || "Gagal Login", "error");
    }
}

async function handleRegister() {
    const username = $('#reg-username').value;
    const password = $('#reg-password').value;
    if (!username || !password) return window.utils.showToast("Data tidak boleh kosong!", "error");
    
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
    window.utils.showToast("Berhasil Keluar", "info");
    setTimeout(() => location.reload(), 800);
}

// FIX QoL 6.16: Perbaikan Logika handleReport untuk Form Kehilangan agar tidak Error Koneksi
async function handleReport(type) {
    const form = $(`#form-${type}`);
    if (!form) return;
    
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (!payload.item_name || !payload.location_name || !payload.reporter_name) {
        return window.utils.showToast("Field utama wajib diisi!", "error");
    }

    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput?.files[0]) {
        window.utils.showToast("Mengunggah gambar...", "info");
        try {
            payload.image_url = await window.utils.fileToBase64(fileInput.files[0]);
        } catch (e) {
            console.error("Image error:", e);
        }
    }

    const res = type === 'lost' ? await window.apiClient.items.reportLost(payload) : await window.apiClient.items.reportFound(payload);
    if (res.ok) {
        window.utils.showToast("Laporan terkirim!", "success");
        form.reset();
        switchSubPage(type, 'list');
        renderItemsList(type);
    } else {
        window.utils.showToast(res.data.error || "Terjadi kesalahan koneksi ke server.", "error");
    }
}

/**
 * 6. ADMIN DASHBOARD LOGIC (Management Power)
 */
async function loadAdminDashboard() {
    if (!state.user || state.user.role !== 'admin') return;

    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    const allItems = [...(resLost.data || []), ...(resFound.data || [])];
    
    if ($('#admin-items-table')) {
        $('#admin-items-table').innerHTML = allItems.map(item => `
            <tr>
                <td>${item.item_name}</td>
                <td>${item.reporter_name}</td>
                <td><span class="badge">${item.type.toUpperCase()}</span></td>
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
                    <button class="btn-action-delete" onclick="deleteItem(${item.id})">Delete</button>
                    <button class="btn-action-edit" onclick="viewDetail(${item.id})" style="background:var(--accent); color:white; border:none; border-radius:6px; padding:5px 10px; font-size:0.75rem; cursor:pointer;">Detail</button>
                </td>
            </tr>
        `).join('');
    }

    const resUsers = await window.apiClient.auth.getUsers();
    if (resUsers.ok && $('#admin-users-table')) {
        $('#admin-users-table').innerHTML = resUsers.data.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>${window.utils.formatDate(u.created_at)}</td>
                <td><button class="btn-action-delete" onclick="deleteUser(${u.id})">Remove</button></td>
            </tr>
        `).join('');
    }

    const resLoc = await window.apiClient.admin.getLocations();
    if (resLoc.ok && $('#admin-locations-table')) {
        $('#admin-locations-table').innerHTML = resLoc.data.map(l => `
            <tr>
                <td>${l.name}</td>
                <td><code>${l.qr_code_payload}</code></td>
                <td><button class="btn-action-delete" onclick="deleteLocation(${l.id})">Delete</button></td>
            </tr>
        `).join('');
    }
}

async function updateItemStatus(id) {
    const newStatus = $(`#status-select-${id}`).value;
    window.utils.showToast("Memperbarui status...", "info");
    const res = await window.apiClient.items.updateStatus(id, { status: newStatus });
    if (res.ok) {
        window.utils.showToast("Status diperbarui!", "success");
        loadAdminDashboard();
    }
}

async function deleteItem(id) {
    if(!confirm("Hapus laporan ini secara permanen?")) return;
    const res = await window.apiClient.items.delete(id);
    if(res.ok) {
        window.utils.showToast("Laporan berhasil dihapus", "success");
        loadAdminDashboard();
    }
}

async function deleteUser(id) {
    if(!confirm("Hapus akun ini secara permanen?")) return;
    const res = await window.apiClient.auth.deleteUser(id);
    if(res.ok) {
        window.utils.showToast("Akun berhasil dihapus", "success");
        loadAdminDashboard();
    }
}

async function deleteLocation(id) {
    if(!confirm("Hapus lokasi ini?")) return;
    const res = await window.apiClient.admin.deleteLocation(id);
    if(res.ok) {
        window.utils.showToast("Lokasi berhasil dihapus", "success");
        loadAdminDashboard();
    }
}

async function handleAddLocation() {
    const name = $('#new-loc-name').value;
    const description = $('#new-loc-desc').value;
    if (!name) return window.utils.showToast("Nama lokasi wajib!", "error");

    const res = await window.apiClient.admin.addLocation({ name, description });
    if (res.ok) {
        window.utils.showToast("Lokasi ditambahkan", "success");
        $('#form-add-location').reset();
        loadAdminDashboard();
    } else {
        window.utils.showToast(res.data.error || "Gagal tambah lokasi", "error");
    }
}

/**
 * 7. MODAL DETAIL SYSTEM
 */
async function viewDetail(id) {
    if (!id) return;
    window.utils.showToast("Memuat detail...", "info");
    const res = await window.apiClient.items.getDetail(id);
    if (res.ok) {
        const item = res.data;
        const html = `
            <div style="text-align:center; margin-bottom:20px;">
                ${item.image_url ? `<img src="${item.image_url}" style="max-width:100%; border-radius:12px; max-height:300px;">` : '<div style="padding:40px; background:rgba(255,255,255,0.03); border-radius:12px;"><i data-lucide="image-off"></i> No Image Available</div>'}
            </div>
            <h3>${item.item_name}</h3>
            <div style="margin-top:15px; color:var(--text-dim); display:flex; flex-direction:column; gap:10px;">
                <p><strong>Status:</strong> ${window.utils.getStatusBadge(item.status)}</p>
                <p><strong>Lokasi:</strong> ${item.location_name}</p>
                <p><strong>Reporter:</strong> ${item.reporter_name}</p>
                <p><strong>Tipe Laporan:</strong> ${item.type.toUpperCase()}</p>
                <p><strong>Waktu:</strong> ${window.utils.formatDate(item.created_at)}</p>
                <p><strong>Deskripsi:</strong> ${item.description || '-'}</p>
            </div>
        `;
        window.utils.showModal(html);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        window.utils.showToast("Gagal memuat detail barang", "error");
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
    bgOverlay.style.backgroundImage = `url('assets/img/bg-${fileName}.jpg')`;
    localStorage.setItem('sp_current_bg', `assets/img/bg-${fileName}.jpg`);
};

document.addEventListener('DOMContentLoaded', async () => {
    // 8a. Background Logic
    const savedBg = localStorage.getItem('sp_current_bg');
    $('#bg-overlay').style.backgroundImage = savedBg ? `url('${savedBg}')` : "url('assets/img/bg-home.jpg')";

    // 8b. Session & UI Sync
    const session = await window.apiClient.auth.checkSession();
    if (session.ok && session.data.loggedIn) {
        state.user = session.data.user;
        
        const loginLabels = $$('#side-account-text, #tab-login-text');
        loginLabels.forEach(el => el.innerText = "Logout");
        
        if ($('#account-status-text')) $('#account-status-text').innerText = `Halo, ${state.user.username}`;
        if ($('#logged-username-display')) $('#logged-username-display').innerText = state.user.username;
        if (state.user.role === 'admin') $('#btn-page-admin').classList.remove('hidden');
        if (state.currentPage === 'account') switchSubPage('account', 'logout');
    }

    initNavigation();
    loadPageData('home');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 8c. Bind Buttons FIX QoL 6.16
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-register-action')?.addEventListener('click', handleRegister);
    $('#btn-logout-action')?.addEventListener('click', handleLogout);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
    $('#btn-add-location-action')?.addEventListener('click', handleAddLocation);
    
    // 8d. Listener BG Change & Selector Sync
    document.addEventListener('change', (e) => {
        if (e.target.name === 'location_name' || e.target.classList.contains('location-selector')) {
            updateBackground(e.target.value);
        }
    });
});

// Global Access untuk Onclick (TETAP ADA)
window.viewDetail = viewDetail;
window.updateItemStatus = updateItemStatus;
window.deleteItem = deleteItem;
window.deleteUser = deleteUser;
window.deleteLocation = deleteLocation;
window.switchPage = switchPage;
