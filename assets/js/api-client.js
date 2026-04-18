
/**
 * assets/js/api-client.js
 * Central API Client untuk Spetech Lost and Found.
 * Menangani fetch ke Cloudflare Workers dengan manajemen token otomatis.
 * UPDATE QoL 6.16: Fix Connection Bugs, Detail Sync, & Admin Delete Power.
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED.
 */

const apiClient = {
    // Base URL untuk API (Cloudflare Pages Functions menggunakan /api)
    baseUrl: '/api',

    /**
     * Helper utama untuk melakukan request ke backend.
     * Otomatis mengambil token dari localStorage jika ada.
     */
    fetch: async (endpoint, options = {}) => {
        const token = localStorage.getItem('sp_lnf_token');
        
        // Setup header default
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Jika token ada, masukkan ke header Authorization
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${apiClient.baseUrl}${endpoint}`, config);
            const data = await response.json();

            // Jika error 401 atau 403 (Unauthorized), arahkan ke login jika perlu
            if (response.status === 401 || response.status === 403) {
                console.warn("Sesi habis atau akses ditolak.");
            }

            return {
                status: response.status,
                ok: response.ok,
                data: data
            };
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            return {
                status: 500,
                ok: false,
                data: { error: "Terjadi kesalahan koneksi ke server." }
            };
        }
    },

    // --- AUTH API ---
    auth: {
        login: (credentials) => apiClient.fetch('/auth/login', { 
            method: 'POST', 
            body: JSON.stringify(credentials) 
        }),
        register: (userData) => apiClient.fetch('/auth/register', { 
            method: 'POST', 
            body: JSON.stringify(userData) 
        }),
        checkSession: () => apiClient.fetch('/auth/me', { method: 'GET' }),
        
        // QoL 6.15/6.16: Get Users untuk Admin Management
        getUsers: () => apiClient.fetch('/admin/users', { method: 'GET' }),
        
        // QoL 6.16: Delete User Fix
        deleteUser: (id) => apiClient.fetch('/admin/users', { 
            method: 'DELETE', 
            body: JSON.stringify({ id: parseInt(id) }) 
        })
    },

    // --- ITEMS API ---
    items: {
        getLost: () => apiClient.fetch('/items/lost', { method: 'GET' }),
        getFound: () => apiClient.fetch('/items/found', { method: 'GET' }),
        
        // Fix QoL 6.16: Detail Sync agar tidak gagal memuat
        getDetail: (id) => apiClient.fetch(`/items/detail?id=${id}`, { method: 'GET' }),
        
        // Lapor Kehilangan (Lost) - Fix Connection Error
        reportLost: (itemData) => apiClient.fetch('/items/lost', { 
            method: 'POST', 
            body: JSON.stringify(itemData) 
        }),
        
        // Lapor Penemuan (Found)
        reportFound: (itemData) => apiClient.fetch('/items/found', { 
            method: 'POST', 
            body: JSON.stringify(itemData) 
        }),

        // Admin Update Status
        updateStatus: (id, statusData) => apiClient.fetch('/admin/forms', { 
            method: 'PATCH', 
            body: JSON.stringify({ id: parseInt(id), ...statusData }) 
        }),

        // Admin Delete Item
        delete: (id) => apiClient.fetch('/admin/forms', { 
            method: 'DELETE', 
            body: JSON.stringify({ id: parseInt(id) }) 
        }),

        /**
         * Upload Gambar ke Cloudflare (R2 atau via Worker)
         * Menggunakan FormData karena mengirimkan file binary.
         */
        uploadImage: async (file) => {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('sp_lnf_token');
            const res = await fetch(`${apiClient.baseUrl}/items/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            return { ok: res.ok, data };
        }
    },

    // --- ADMIN API (Locations & Analytics) ---
    admin: {
        // Management Location
        getLocations: () => apiClient.fetch('/admin/locations', { method: 'GET' }),
        
        // Add New School Area
        addLocation: (locationData) => apiClient.fetch('/admin/locations', { 
            method: 'POST', 
            body: JSON.stringify(locationData) 
        }),
        
        // Fix QoL 6.16: Delete Area Fix
        deleteLocation: (id) => apiClient.fetch('/admin/locations', { 
            method: 'DELETE', 
            body: JSON.stringify({ id: parseInt(id) }) 
        })
    }
};

// Global export agar bisa diakses oleh main.js
window.apiClient = apiClient;
