
/**
 * assets/js/main.js
 * Konduktor Utama Frontend - Spetech Lost and Found
 * Integrasi Penuh: Backend Cloudflare Workers & D1 Database
 * UPDATE QoL 6.18: Total Location Management & Dynamic Background Switch
 * UPDATE QoL 6.19: Dynamic Stats, Search Engine & Auth Text Fix
 * UPDATE QoL 6.24: The Great Logic Swap (Lost searches Found, Found searches Lost)
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED (630+ Lines)
 */

// 1. Konfigurasi State Aplikasi
const state = {
    user: null,
    currentPage: 'home',
    currentSubPage: {
        home: 'dashboard',
        lost: 'list',
        found: 'report',
        lokasi: 'list',
        admin: 'forms',
        account: 'login'
    },
    locations: [], // Cache data lokasi dari DB
    items: {
        lost: [],
        found: []
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

    // LOGIKA QR OTOMATIS (Update QoL 6.18)
    const qrLocationId = window.utils.getQueryParam('lokasi');
    if (qrLocationId) {
        window.utils.showToast(`Mendeteksi lokasi QR...`, 'info');
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
    
    // QoL 6.24: Reload data saat pindah tab untuk memastikan list terbaru
    if (targetSub === 'list') {
        loadPageData(parentPage);
    }
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
                // QoL 6.24: Di page Lost, kita merender list barang temuan (found)
                await renderItemsList('found'); 
                break;
            case 'found':
                // QoL 6.24: Di page Found, kita merender list laporan kehilangan (lost)
                await renderItemsList('lost');
                break;
            case 'lokasi':
                await renderLocationGrid();
                break;
            case 'admin':
                await loadAdminDashboard();
                break;
        }
    } catch (err) {
        console.error("Gagal sinkronisasi data:", err);
    }
}

// QoL 6.18: Load Data Lokasi Dinamis & Sinkronisasi Selector
async function syncLocations() {
    const res = await window.apiClient.admin.getLocations();
    if (res.ok) {
        state.locations = res.data;
        
        const selectors = $$('.location-selector');
        selectors.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Pilih Lokasi...</option>' + 
                state.locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
            select.value = currentVal;
        });

        const qrId = window.utils.getQueryParam('lokasi');
        if (qrId) {
            const foundLoc = state.locations.find(l => l.id == qrId);
            if (foundLoc) {
                switchPage('found');
                switchSubPage('found', 'report');
                setTimeout(() => {
                    $$('.location-selector').forEach(s => s.value = foundLoc.name);
                    updateBackground(foundLoc.name);
                    window.utils.showToast(`Lokasi Terdeteksi: ${foundLoc.name}`, 'success');
                }, 500);
            }
        }
    }
}

async function renderLocationGrid() {
    const container = $('#location-public-grid');
    if (!container) return;
    
    container.innerHTML = state.locations.map(loc => `
        <div class="glass-card location-card">
            <div class="location-img-wrapper">
                <img src="${loc.image_url || 'assets/img/bg-home.jpg'}" loading="lazy">
                <div class="location-qr-preview">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + loc.qr_code_payload)}" alt="QR">
                </div>
            </div>
            <div class="location-info-box">
                <h3>${loc.name}</h3>
                <p>${loc.description || 'Tidak ada deskripsi.'}</p>
            </div>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// FIX QoL 6.19: Dashboard Stats Dynamic Update
async function loadRecentLists() {
    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    
    if (resLost.ok) {
        state.items.lost = resLost.data;
        if ($('#stat-lost')) $('#stat-lost').innerText = resLost.data.length;
        if ($('#recent-lost-list')) {
            $('#recent-lost-list').innerHTML = resLost.data.slice(0, 3).map(i => createCompactItem(i)).join('');
        }
    }
    
    if (resFound.ok) {
        state.items.found = resFound.data;
        if ($('#stat-found')) $('#stat-found').innerText = resFound.data.length;
        if ($('#recent-found-list')) {
            $('#recent-found-list').innerHTML = resFound.data.slice(0, 3).map(i => createCompactItem(i)).join('');
        }
    }
}

async function renderItemsList(type, filterData = null) {
    // QoL 6.24: Target grid sekarang statis sesuai tipe data, meskipun diletakkan di page yang berbeda
    const container = $(`#${type}-items-grid`);
    if (!container) return;
    
    container.innerHTML = '<div class="loader"> </div>';
    
    let items = [];
    if (filterData) {
        items = filterData;
    } else {
        const result = type === 'lost' ? await window.apiClient.items.getLost() : await window.apiClient.items.getFound();
        if (result.ok) {
            items = result.data;
            state.items[type] = items;
        }
    }
    
    if (items.length > 0) {
        container.innerHTML = items.map(item => createItemCard(item)).join('');
    } else {
        container.innerHTML = `<div class="empty-state">Belum ada data ${type === 'lost' ? 'kehilangan' : 'barang temuan'} yang tersedia.</div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function createItemCard(item) {
    const statusBadge = window.utils.getStatusBadge(item.status);
    return `
        <div class="item-card glass-card">
            <div class="item-img-wrapper">
                ${item.image_url ? `<img src="${item.image_url}" class="item-img" loading="lazy">` : '<div class="no-img-placeholder"><i data-lucide="image-off"></i></div>'}
                <div class="item-badge">${statusBadge}</div>
            </div>
            <div class="item-info">
                <h3>${item.item_name}</h3>
                <div class="item-meta">
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

async function handleReport(type) {
    const form = $(`#form-${type}`);
    if (!form) return;
    
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (!payload.item_name || !payload.location_name || !payload.reporter_name) {
        return window.utils.showToast("Field utama wajib diisi!", "error");
    }

    payload.created_at = new Date().toISOString();

    const btn = $(`#btn-submit-${type}`);
    btn.disabled = true; btn.innerText = "Mengompresi...";

    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput?.files[0]) {
        window.utils.showToast("Memproses gambar...", "info");
        try {
            payload.image_url = await window.utils.fileToBase64(fileInput.files[0]);
        } catch (e) {
            console.error("Image error:", e);
            window.utils.showToast("Gagal memproses gambar", "error");
            btn.disabled = false; btn.innerText = "Kirim Laporan";
            return;
        }
    }

    btn.innerText = "Mengirim...";
    const res = type === 'lost' ? await window.apiClient.items.reportLost(payload) : await window.apiClient.items.reportFound(payload);
    
    if (res.ok) {
        window.utils.showToast("Laporan terkirim!", "success");
        form.reset();
        // QoL 6.24: Setelah lapor, tetap arahkan ke tab list yang relevan
        switchSubPage(type, 'list');
        loadPageData(type); 
    } else {
        window.utils.showToast(res.data.error || "Terjadi kesalahan koneksi ke server.", "error");
    }
    btn.disabled = false; btn.innerText = "Kirim Laporan";
}

// FIX QoL 6.19/6.24: SEARCH ENGINE LOGIC
async function handleSearch(type) {
    // Tipe di sini adalah tipe data yang sedang dicari (lost/found)
    const inputId = type === 'found' ? 'search-found-in-lost' : 'search-lost-in-found';
    const query = $(`#${inputId}`)?.value.toLowerCase();
    
    if (!query) return renderItemsList(type);
    
    const filtered = state.items[type].filter(item => 
        item.item_name.toLowerCase().includes(query) || 
        item.location_name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
    );
    
    renderItemsList(type, filtered);
}

/**
 * 6. ADMIN DASHBOARD LOGIC (Location Grid 2 Col Fix)
 */
async function loadAdminDashboard() {
    if (!state.user || state.user.role !== 'admin') return;

    const resLost = await window.apiClient.items.getLost();
    const resFound = await window.apiClient.items.getFound();
    const allItems = [...(resLost.data || []), ...(resFound.data || [])];
    
    if ($('#table-admin-items tbody')) {
        $('#table-admin-items tbody').innerHTML = allItems.map(item => `
            <tr>
                <td>${item.item_name}</td>
                <td>${item.type}</td>
                <td>${item.location_name}</td>
                <td>${window.utils.getStatusBadge(item.status)}</td>
                <td>
                    <select id="status-select-${item.id}" class="status-select-admin">
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="verified" ${item.status === 'verified' ? 'selected' : ''}>Verified</option>
                        <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    <button class="btn-save-status" onclick="updateItemStatus(${item.id})">Save</button>
                    <button class="btn-action-delete" onclick="deleteItem(${item.id})">Del</button>
                </td>
            </tr>
        `).join('');
    }

    const resUsers = await window.apiClient.auth.getUsers();
    if (resUsers.ok && $('#table-admin-users tbody')) {
        $('#table-admin-users tbody').innerHTML = resUsers.data.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td><button class="btn-action-delete" onclick="deleteUser(${u.id})">Hapus</button></td>
            </tr>
        `).join('');
    }

    if ($('#admin-locations-grid')) {
        $('#admin-locations-grid').innerHTML = state.locations.map(loc => `
            <div class="glass-card location-card">
                <div class="location-img-wrapper">
                    <img src="${loc.image_url || 'assets/img/bg-home.jpg'}" loading="lazy">
                </div>
                <div class="location-info-box">
                    <h3>${loc.name}</h3>
                    <p>${loc.description || '-'}</p>
                    <button class="btn-delete-loc" onclick="deleteLocation(${loc.id})"><i data-lucide="trash-2"></i> Hapus Lokasi</button>
                </div>
            </div>
        `).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function updateItemStatus(id) {
    const newStatus = $(`#status-select-${id}`).value;
    const res = await window.apiClient.items.updateStatus(id, { status: newStatus });
    if (res.ok) {
        window.utils.showToast("Status diperbarui!", "success");
        loadAdminDashboard();
    }
}

async function deleteItem(id) {
    if(!confirm("Hapus laporan ini?")) return;
    const res = await window.apiClient.items.delete(id);
    if(res.ok) {
        window.utils.showToast("Data dihapus", "success");
        loadAdminDashboard();
    }
}

async function deleteUser(id) {
    if(!confirm("Hapus akun ini?")) return;
    const res = await window.apiClient.auth.deleteUser(id);
    if(res.ok) {
        window.utils.showToast("Akun dihapus", "success");
        loadAdminDashboard();
    }
}

async function deleteLocation(id) {
    if(!confirm("Hapus lokasi ini? Semua QR terkait akan mati.")) return;
    const res = await window.apiClient.admin.deleteLocation(id);
    if(res.ok) {
        window.utils.showToast("Lokasi berhasil dihapus", "success");
        await syncLocations();
        loadAdminDashboard();
    }
}

async function handleAddLocation() {
    const name = $('#new-loc-name').value;
    const description = $('#new-loc-desc').value;
    const fileInput = $('#new-loc-image');
    
    if (!name) return window.utils.showToast("Nama lokasi wajib!", "error");

    const payload = { name, description };
    if (fileInput?.files[0]) {
        window.utils.showToast("Mengunggah foto lokasi...", "info");
        payload.image_url = await window.utils.fileToBase64(fileInput.files[0]);
    }

    const res = await window.apiClient.admin.addLocation(payload);
    if (res.ok) {
        window.utils.showToast("Lokasi & QR Berhasil Terbuat!", "success");
        $('#form-add-location').reset();
        await syncLocations();
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
                ${item.image_url ? `<img src="${item.image_url}" style="max-width:100%; border-radius:12px; max-height:300px;">` : '<div style="padding:40px; background:rgba(255,255,255,0.03); border-radius:12px;"><i data-lucide="image-off"></i> No Image</div>'}
            </div>
            <h3>${item.item_name}</h3>
            <div style="margin-top:15px; color:var(--text-dim); display:flex; flex-direction:column; gap:10px;">
                <p><strong>Status:</strong> ${window.utils.getStatusBadge(item.status)}</p>
                <p><strong>Tipe Laporan:</strong> ${item.type}</p>
                <p><strong>Lokasi:</strong> ${item.location_name}</p>
                <p><strong>Reporter:</strong> ${item.reporter_name}</p>
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
 * 8. DYNAMIC BACKGROUND ENGINE (QoL 6.18)
 */
const updateBackground = (locationName) => {
    const bgOverlay = document.getElementById('bg-overlay');
    if (!bgOverlay) return;

    if (!locationName || locationName === "") {
        bgOverlay.style.backgroundImage = "url('assets/img/bg-home.jpg')";
        return;
    }

    const foundLoc = state.locations.find(l => l.name === locationName);
    if (foundLoc && foundLoc.image_url) {
        bgOverlay.style.backgroundImage = `url('${foundLoc.image_url}')`;
        localStorage.setItem('sp_current_bg', foundLoc.image_url);
    } else {
        bgOverlay.style.backgroundImage = "url('assets/img/bg-home.jpg')";
    }
};

/**
 * 9. INITIAL LOAD
 */
document.addEventListener('DOMContentLoaded', async () => {
    // QoL 6.33: Reset background cache jika tidak valid atau paksa ke default saat startup
    localStorage.removeItem('sp_current_bg'); // Hapus cache lama agar tidak jadi hantu
    $('#bg-overlay').style.backgroundImage = "url('assets/img/bg-home.jpg')"; // Paksa ke default

    const session = await window.apiClient.auth.checkSession();
    if (session.ok && session.data.loggedIn) {
        state.user = session.data.user;
        
        const sideAccount = $('#side-account-text');
        if (sideAccount) sideAccount.innerText = "Logout";
        
        $$('.nav-tab[data-sub="login"]').forEach(el => el.innerText = "Logout");
        
        if ($('#account-status-text')) $('#account-status-text').innerText = `Halo, ${state.user.username}`;
        if ($('#logged-username-display')) $('#logged-username-display').innerText = state.user.username;
        if (state.user.role === 'admin') $('#btn-page-admin').classList.remove('hidden');
        if (state.currentPage === 'account') switchSubPage('account', 'logout');
    }

    await syncLocations();
    initNavigation();
    loadPageData('home');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 9d. Event Bindings
    $('#btn-login-action')?.addEventListener('click', handleLogin);
    $('#btn-register-action')?.addEventListener('click', handleRegister);
    $('#btn-logout-action')?.addEventListener('click', handleLogout);
    $('#btn-submit-lost')?.addEventListener('click', () => handleReport('lost'));
    $('#btn-submit-found')?.addEventListener('click', () => handleReport('found'));
    $('#btn-add-location-action')?.addEventListener('click', handleAddLocation);
    
    // QoL 6.24: Search Bindings dengan ID Baru yang di-Swap di index.html
    $('#search-found-in-lost')?.addEventListener('input', () => handleSearch('found'));
    $('#search-lost-in-found')?.addEventListener('input', () => handleSearch('lost'));
    
    document.addEventListener('change', (e) => {
        if (e.target.name === 'location_name' || e.target.classList.contains('location-selector')) {
            updateBackground(e.target.value);
        }
    });
});

window.viewDetail = viewDetail;
window.updateItemStatus = updateItemStatus;
window.deleteItem = deleteItem;
window.deleteUser = deleteUser;
window.deleteLocation = deleteLocation;
window.switchPage = switchPage;
