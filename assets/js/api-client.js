
/**
 * assets/js/api-client.js
 * Central API Client untuk Spetech Lost and Found.
 * Menangani fetch ke Cloudflare Workers dengan manajemen token otomatis.
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
                data
            };
        } catch (error) {
            console.error("API Fetch Error:", error);
            return {
                status: 500,
                ok: false,
                data: { error: "Gagal terhubung ke server." }
            };
        }
    },

    // --- AUTHENTICATION API ---
    auth: {
        register: (userData) => apiClient.fetch('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
        login: (credentials) => apiClient.fetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
        logout: () => apiClient.fetch('/auth/logout', { method: 'POST' }),
        checkSession: () => apiClient.fetch('/auth/me', { method: 'GET' })
    },

    // --- ITEMS (LOST & FOUND) API ---
    items: {
        getLost: () => apiClient.fetch('/items/lost', { method: 'GET' }),
        getFound: () => apiClient.fetch('/items/found', { method: 'GET' }),
        getDetail: (id) => apiClient.fetch(`/items/${id}`, { method: 'GET' }),
        reportLost: (formData) => apiClient.fetch('/items/lost', { method: 'POST', body: JSON.stringify(formData) }),
        reportFound: (formData) => apiClient.fetch('/items/found', { method: 'POST', body: JSON.stringify(formData) }),
        uploadImage: (file) => {
            // Khusus upload menggunakan FormData, bukan JSON
            const formData = new FormData();
            formData.append('file', file);
            return apiClient.fetch('/items/upload', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': undefined } // Biarkan browser yang set boundary
            });
        }
    },

    // --- ADMIN API ---
    admin: {
        // Management Form (Items)
        getForms: (type) => apiClient.fetch(`/admin/forms${type ? `?type=${type}` : ''}`, { method: 'GET' }),
        updateStatus: (id, status) => apiClient.fetch('/admin/forms', { 
            method: 'PATCH', 
            body: JSON.stringify({ id, status }) 
        }),
        deleteForm: (id) => apiClient.fetch('/admin/forms', { 
            method: 'DELETE', 
            body: JSON.stringify({ id }) 
        }),

        // Management User
        getUsers: () => apiClient.fetch('/admin/users', { method: 'GET' }),
        createUser: (userData) => apiClient.fetch('/admin/users', { method: 'POST', body: JSON.stringify(userData) }),
        deleteUser: (id) => apiClient.fetch('/admin/users', { method: 'DELETE', body: JSON.stringify({ id }) }),

        // Management Location
        getLocations: () => apiClient.fetch('/admin/locations', { method: 'GET' }),
        addLocation: (locationData) => apiClient.fetch('/admin/locations', { method: 'POST', body: JSON.stringify(locationData) }),
        deleteLocation: (id) => apiClient.fetch('/admin/locations', { method: 'DELETE', body: JSON.stringify({ id }) })
    }
};

// Export ke window agar bisa diakses main.js
window.apiClient = apiClient;
