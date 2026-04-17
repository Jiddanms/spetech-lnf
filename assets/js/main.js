
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Integrasi Penuh: Backend Cloudflare Workers & D1 Database
 * Update QoL Final: Recent Home, Modal Detail, Register, & Admin Sync
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
            const locationInput = $('#found-location-input');
            if (locationInput) {
                locationInput.value = qrLocation;
                updateBackground(qrLocation);
            }
        }, 500);
    }
}

/**
 * 3. CORE SWITCHING LOGIC
 */
function switchPage(pageId) {
    state.currentPage = pageId;
    $$('.side-item').forEach(btn => btn.classList.remove('active'));
    $(`#btn-page-${pageId}`)?.classList.add('active');
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${pageId}`)?.classList.remove('hidden');
    loadPageData(pageId);
}

function switchSubPage(parentPage, subId) {
    state.currentSubPage[parentPage] = subId;
    $$(`#page-${parentPage} .nav-tab`).forEach(btn => btn.classList.remove('active'));
    $(`#page-${parentPage} .nav-tab[data-sub="${subId}"]`)?.classList.add('active');
    $$(`#page-${parentPage} .sub-container`).forEach(sp => sp.classList.add('hidden'));
    $(`#sub-${parentPage}-${subId}`)?.classList.remove('hidden');
}

/**
 * 4. DATA LOADING & RENDERING (QoL Updated)
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
    
    if (resLost.ok && $('#home-recent-lost')) {
        $('#home-recent-lost').innerHTML = resLost.data.slice(0, 3).map(i => createCompactItem(i)).join('');
    }
    if (resFound.ok && $('#home-recent-found')) {
        $('#home-recent-found').innerHTML = resFound.data.slice(0, 3).map(i => createCompactItem(i)).join('');
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
 * 5. ACTION HANDLERS (Auth & Forms Management)
 */
async function handleLogin() {
    const username = $('#login-username').value;
    const password = $('#login-password').value;
    const res = await window.apiClient.auth.login({ username, password });
    if (res.ok) {
        localStorage.setItem('sp_lnf_token', res.data.token);
        localStorage.setItem('sp_lnf_user', JSON.stringify(res.data.user));
        window.utils.showToast("Berhasil Masuk!", "success");
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
        window.utils.showToast("Akun berhasil dibuat! Silakan login.", "success");
        switchSubPage('account', 'login');
    } else {
        window.utils.showToast(res.data.error || "Gagal Register", "error");
    }
}

async function handleReport(type) {
    const form = $(`#form-${type}`);
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (!payload.item_name || !payload.location_name) {
        return window.utils.showToast("Nama barang & lokasi wajib diisi!", "error");
    }

    const fileInput = $(`#${type}-photo`);
    if (fileInput?.files[0]) {
        window.utils.showToast("Memproses gambar...", "info");
        payload.image_url = await window.utils.fileToBase64(fileInput.files[0]);
    }

    const res = type === 'lost' ? await window.apiClient.items.reportLost(payload) : await window.apiClient.items.reportFound(payload);
    if (res.ok) {
        window.utils.showToast("Laporan terkirim!", "success");
        form.reset();
        switchSubPage(type, 'list');
        renderItemsList(type);
    } else {
        window.utils.showToast(res.data.error || "Gagal mengirim laporan", "error");
    }
}

/**
 * 6. ADMIN DASHBOARD LOGIC (Fixing Empty Tab Bug)
 */
async function loadAdminDashboard() {
    if (!state.user || state.user.role !== 'admin') return;

    // Load Items Management
    const resItems = await window.apiClient.items.getLost(); // Admin biasanya melihat semua
    const resItems2 = await window.apiClient.items.getFound();
    const allItems = [...(resItems.data || []), ...(resItems2.data || [])];
    
    $('#admin-items-body').innerHTML = allItems.map(item => `
        <tr>
            <td>${item.item_name}</td>
            <td>${item.type.toUpperCase()}</td>
            <td>${item.reporter_name || item.owner_name}</td>
            <td>${window.utils.getStatusBadge(item.status)}</td>
            <td><button class="btn-primary" onclick="viewDetail(${item.id})">Cek</button></td>
        </tr>
    `).join('');

    // Load Locations Management
    const locations = ["Gedung A", "Gedung B", "Gedung C", "Kantin", "Koperasi", "Lapangan Upacara", "Lapangan Basket", "Lapangan Tenis"];
    $('#admin-locations-list').innerHTML = locations.map(loc => `<span class="tag">${loc}</span>`).join('');
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
                ${item.image_url ? `<img src="${item.image_url}" style="max-width:100%; border-radius:10px; max-height:250px;">` : '<div style="padding:40px; background:rgba(0,0,0,0.2); border-radius:10px;">No Image Available</div>'}
            </div>
            <h3>${item.item_name}</h3>
            <div style="margin-top:15px; color:var(--text-dim); display:flex; flex-direction:column; gap:10px;">
                <p><strong>Tipe:</strong> ${item.type.toUpperCase()}</p>
                <p><strong>Lokasi:</strong> ${item.location_name}</p>
                <p><strong>Pelapor/Pemilik:</strong> ${item.reporter_name || item.owner_name}</p>
                <p><strong>Waktu:</strong> ${window.utils.formatDate(item.created_at)}</p>
                <p><strong>Deskripsi:</strong> ${item.description || 'Tidak ada deskripsi tambahan.'}</p>
                <p><strong>Status:</strong> ${window.utils.getStatusBadge(item.status)}</p>
            </div>
        `;
        window.utils.showModal(html);
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
    // 8a. Muat Background Terakhir atau Home
    const savedBg = localStorage.getItem('sp_current_bg');
    $('#bg-overlay').style.backgroundImage = savedBg ? `url('${savedBg}')` : "url('assets/img/bg-home.jpg')";

    // 8b. Cek Sesi Keamanan
    const session = await window.apiClient.auth.checkSession();
    if (session.ok && session.data.loggedIn) {
        state.user = session.data.user;
        if ($('#account-status-text')) $('#account-status-text').innerText = `Halo, ${state.user.username}`;
        if (state.user.role === 'admin') $('#btn-page-admin').classList.remove('hidden');
    }

    initNavigation();
    loadPageData('home'); // Load data awal dashboard
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Bind Buttons
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-register-action')?.addEventListener('click', handleRegister);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
    
    // Listener BG Change
    document.addEventListener('change', (e) => {
        if (e.target.name === 'location_name') updateBackground(e.target.value);
    });
});
