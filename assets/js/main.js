
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Integrasi Penuh: Backend Cloudflare Workers & D1 Database
 * Update QoL: Dynamic Background & Dual Selector Sync
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

    // LOGIKA QR OTOMATIS: Integrasi QR Lokasi Pelaporan
    const qrLocation = window.utils.getQueryParam('lokasi');
    if (qrLocation) {
        window.utils.showToast(`Lokasi QR Terdeteksi: ${qrLocation}`, 'info');
        switchPage('found');
        switchSubPage('found', 'report');
        
        // Mengisi otomatis input lokasi pelaporan
        setTimeout(() => {
            const locationInput = $('#found-location-input');
            if (locationInput) {
                locationInput.value = qrLocation;
                updateBackground(qrLocation); // Sync background dari data QR
            }
        }, 500);
    }
}

/**
 * 3. CORE SWITCHING LOGIC
 */
function switchPage(pageId) {
    state.currentPage = pageId;
    
    // UI Update Sidebar
    $$('.side-item').forEach(btn => btn.classList.remove('active'));
    $(`#btn-page-${pageId}`)?.classList.add('active');

    // UI Update Page Container
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${pageId}`)?.classList.remove('hidden');

    // Load data setiap pindah page
    loadPageData(pageId);
}

function switchSubPage(parentPage, subId) {
    state.currentSubPage[parentPage] = subId;

    // UI Update Tab Navbar
    $$(`#page-${parentPage} .nav-tab`).forEach(btn => btn.classList.remove('active'));
    $(`#page-${parentPage} .nav-tab[data-sub="${subId}"]`)?.classList.add('active');

    // UI Update Sub-page Content
    $$(`#page-${parentPage} .sub-container`).forEach(sp => sp.classList.add('hidden'));
    $(`#sub-${parentPage}-${subId}`)?.classList.remove('hidden');
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
                // Logic Admin dapat ditambahkan di sini
                break;
        }
    } catch (err) {
        console.error("Gagal sinkronisasi data backend:", err);
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
        container.innerHTML = `<div class="empty-state">Belum ada laporan ${type} saat ini.</div>`;
    }
}

function createItemCard(item) {
    const statusBadge = window.utils.getStatusBadge(item.status);
    return `
        <div class="item-card glass-card" onclick="viewDetail(${item.id})">
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
            </div>
        </div>
    `;
}

function createCompactItem(item) {
    return `
        <div class="compact-item" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
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

    const res = await window.apiClient.auth.login({ username, password });
    if (res.ok) {
        localStorage.setItem('sp_lnf_token', res.data.token);
        localStorage.setItem('sp_lnf_user', JSON.stringify(res.data.user));
        window.utils.showToast("Autentikasi Berhasil!", "success");
        setTimeout(() => location.reload(), 1000);
    } else {
        window.utils.showToast(res.data.error, "error");
    }
}

async function handleReport(type) {
    const form = $(`#form-${type}`);
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Upload Foto jika ada
    const fileInput = $(`#${type}-photo`);
    if (fileInput?.files[0]) {
        window.utils.showToast("Mengunggah gambar...", "info");
        const uploadRes = await window.apiClient.items.uploadImage(fileInput.files[0]);
        if (uploadRes.ok) payload.image_url = uploadRes.data.url;
    }

    const res = type === 'lost' ? await window.apiClient.items.reportLost(payload) : await window.apiClient.items.reportFound(payload);
    
    if (res.ok) {
        window.utils.showToast("Laporan terkirim ke database!", "success");
        form.reset();
        switchSubPage(type, 'list');
        renderItemsList(type);
    } else {
        window.utils.showToast(res.data.error, "error");
    }
}

/**
 * 6. DYNAMIC BACKGROUND ENGINE (QoL Updated)
 */
const updateBackground = (locationValue) => {
    const bgOverlay = document.getElementById('bg-overlay');
    if (!bgOverlay) return;

    // Jika user memilih default/kosong, kembalikan ke bg-home
    if (!locationValue || locationValue === "") {
        bgOverlay.style.backgroundImage = "url('assets/img/bg-home.jpg')";
        localStorage.removeItem('sp_current_bg');
        return;
    }

    const fileName = locationValue.toLowerCase().replace(/\s+/g, '-');
    const imgPath = `assets/img/bg-${fileName}.jpg`;

    bgOverlay.style.backgroundImage = `url('${imgPath}')`;
    localStorage.setItem('sp_current_bg', imgPath);
};

/**
 * 7. INITIAL LOAD & EVENT LISTENERS
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 7a. Muat Background (Memory atau Default Home)
    const savedBg = localStorage.getItem('sp_current_bg');
    if (savedBg) {
        $('#bg-overlay').style.backgroundImage = `url('${savedBg}')`;
    } else {
        $('#bg-overlay').style.backgroundImage = "url('assets/img/bg-home.jpg')";
    }

    // 7b. Cek Sesi Keamanan
    const session = await window.apiClient.auth.checkSession();
    if (session.ok && session.data.loggedIn) {
        state.user = session.data.user;
        if ($('#account-status-text')) $('#account-status-text').innerText = `Halo, ${state.user.username}`;
        if (state.user.role === 'admin') $('#btn-page-admin').classList.remove('hidden');
    }

    initNavigation();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 7c. Bind Buttons
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
    
    // 7d. Listener BG Change (Sync Dual Form: Lost & Found)
    document.addEventListener('change', (e) => {
        if (e.target.name === 'location_name' || e.target.classList.contains('location-selector')) {
            updateBackground(e.target.value);
        }
    });
});

function viewDetail(id) {
    window.apiClient.items.getDetail(id).then(res => {
        if (res.ok) console.log("Data Detail:", res.data);
    });
}
