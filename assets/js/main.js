
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Menyatukan Navigation Logic, API Integration, dan QR Automation.
 */

// Konfigurasi State Aplikasi
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
 * 1. INISIALISASI NAVIGASI & ROUTING
 */
function initNavigation() {
    // Sidebar Navigation (Main Pages)
    $$('.side-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            switchPage(page);
        });
    });

    // Navbar Navigation (Sub Pages)
    $$('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const subPage = btn.getAttribute('data-sub');
            const parentPage = btn.closest('.page').id.replace('page-', '');
            switchSubPage(parentPage, subPage);
        });
    });

    // LOGIKA QR OTOMATIS: Deteksi parameter ?lokasi=
    const qrLocation = window.utils.getQueryParam('lokasi');
    if (qrLocation) {
        window.utils.showToast(`Lokasi terdeteksi: ${qrLocation}`, 'info');
        switchPage('found');
        switchSubPage('found', 'report');
        
        // Auto-fill input lokasi (pastikan ID input sesuai di index.html)
        setTimeout(() => {
            const locationInput = $('#found-location-input'); // Sesuaikan ID form kamu
            if (locationInput) locationInput.value = qrLocation;
        }, 500);
    }
}

/**
 * 2. CORE SWITCHING LOGIC
 */
function switchPage(pageId) {
    state.currentPage = pageId;
    
    // Toggle Class Active Sidebar
    $$('.side-btn').forEach(btn => btn.classList.remove('active'));
    $(`#btn-page-${pageId}`)?.classList.add('active');

    // Toggle Visibility Page Container
    $$('.page').forEach(p => p.classList.add('hidden'));
    $(`#page-${pageId}`)?.classList.remove('hidden');

    // Re-render data spesifik page
    loadPageData(pageId);
}

function switchSubPage(parentPage, subId) {
    state.currentSubPage[parentPage] = subId;

    // Toggle Navbar Active
    $$(`#page-${parentPage} .nav-btn`).forEach(btn => btn.classList.remove('active'));
    $(`#page-${parentPage} .nav-btn[data-sub="${subId}"]`)?.classList.add('active');

    // Toggle Sub-page Content
    $$(`#page-${parentPage} .subpage`).forEach(sp => sp.classList.add('hidden'));
    $(`#sub-${parentPage}-${subId}`)?.classList.remove('hidden');
}

/**
 * 3. DATA LOADING (Integrasi API Client)
 */
async function loadPageData(pageId) {
    try {
        switch(pageId) {
            case 'home':
                renderRecentItems();
                break;
            case 'lost':
                renderItemsList('lost');
                break;
            case 'found':
                renderItemsList('found');
                break;
            case 'admin':
                checkAdminAccess();
                break;
        }
    } catch (err) {
        console.error("Gagal memuat data:", err);
    }
}

async function renderItemsList(type) {
    const container = $(`#${type}-list-container`);
    if (!container) return;

    container.innerHTML = '<div class="loader">Memuat...</div>';
    
    const result = type === 'lost' ? await window.apiClient.items.getLost() : await window.apiClient.items.getFound();
    
    if (result.ok) {
        container.innerHTML = result.data.map(item => createItemCard(item)).join('');
    } else {
        container.innerHTML = `<p class="error">Gagal mengambil data ${type}.</p>`;
    }
}

function createItemCard(item) {
    return `
        <div class="card item-card" onclick="viewDetail(${item.id})">
            ${item.image_url ? `<img src="${item.image_url}" class="card-img" />` : '<div class="no-img">Tanpa Foto</div>'}
            <div class="card-body">
                <span class="badge ${item.type === 'lost' ? 'bg-danger' : 'bg-success'}">${item.type.toUpperCase()}</span>
                <h4>${item.item_name}</h4>
                <p><i class="icon-loc"></i> ${item.location_name}</p>
                <small>${window.utils.formatDate(item.created_at)}</small>
            </div>
        </div>
    `;
}

/**
 * 4. AUTHENTICATION & FORM HANDLERS
 */
async function handleLogin(e) {
    e.preventDefault();
    const username = $('#login-username').value;
    const password = $('#login-password').value;

    const res = await window.apiClient.auth.login({ username, password });
    if (res.ok) {
        localStorage.setItem('sp_lnf_token', res.data.token);
        localStorage.setItem('sp_lnf_user', JSON.stringify(res.data.user));
        window.utils.showToast(`Selamat datang, ${res.data.user.username}!`, 'success');
        location.reload(); // Refresh untuk update state global
    } else {
        window.utils.showToast(res.data.error, 'error');
    }
}

async function handleReport(type) {
    const form = $(`#form-${type}`);
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Jika ada file foto
    const fileInput = $(`#${type}-photo`);
    if (fileInput?.files[0]) {
        const uploadRes = await window.apiClient.items.uploadImage(fileInput.files[0]);
        if (uploadRes.ok) data.image_url = uploadRes.data.url;
    }

    const res = type === 'lost' ? await window.apiClient.items.reportLost(data) : await window.apiClient.items.reportFound(data);
    
    if (res.ok) {
        window.utils.showToast("Laporan berhasil dikirim!", "success");
        form.reset();
        switchSubPage(type, 'list');
    } else {
        window.utils.showToast(res.data.error, "error");
    }
}

/**
 * 5. INITIAL LOAD
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Cek Sesi User
    const sessionRes = await window.apiClient.auth.checkSession();
    if (sessionRes.ok && sessionRes.data.loggedIn) {
        state.user = sessionRes.data.user;
        updateUIForUser();
    }

    initNavigation();
    
    // Event Listeners untuk Form (Contoh)
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
});

function updateUIForUser() {
    if (state.user) {
        $('#account-status-text').innerText = `Logged in as: ${state.user.username}`;
        if (state.user.role === 'admin') {
            $('#btn-page-admin').classList.remove('hidden');
        }
    }
}

function viewDetail(id) {
    // Logika modal detail barang
    window.apiClient.items.getDetail(id).then(res => {
        if (res.ok) {
            // Tampilkan modal (logika modal bisa ditambahkan di sini)
            console.log("Detail Barang:", res.data);
        }
    });
}
