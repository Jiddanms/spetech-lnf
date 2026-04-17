
/**
 * assets/js/utils.js
 * Helper functions untuk Spetech Lost and Found.
 * Fokus: QR Detection, Date Formatting, UI Feedback, dan DOM Helpers.
 */

const utils = {
    /**
     * Mengambil parameter dari URL (Sangat krusial untuk integrasi QR Lokasi)
     * Contoh: ?lokasi=Kantin -> akan mengembalikan "Kantin"
     */
    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Memformat tanggal ISO dari database menjadi format yang enak dibaca siswa.
     * Contoh: 2026-04-17T... -> 17 Apr 2026, 10:30
     */
    formatDate: (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Notifikasi (Toast) Custom - Sesuai tema Dark Mode.
     * Membuat feedback yang simple tapi powerful tanpa perlu library eksternal berat.
     */
    showToast: (message, type = 'info') => {
        // Hapus toast lama jika ada
        const oldToast = document.querySelector('.toast-notification');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Animasi keluar setelah 3 detik
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    /**
     * Helper untuk menangani upload gambar & merubahnya menjadi base64 (client-side preview)
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    },

    /**
     * Truncate text untuk card agar layout tetap rapi
     */
    truncateText: (text, limit = 60) => {
        if (!text) return "";
        return text.length > limit ? text.substring(0, limit) + "..." : text;
    },

    /**
     * Generate badge HTML berdasarkan status barang
     */
    getStatusBadge: (status) => {
        const statusMap = {
            'pending': { label: 'Menunggu', class: 'badge-pending' },
            'verified': { label: 'Terverifikasi', class: 'badge-success' },
            'completed': { label: 'Selesai', class: 'badge-info' },
            'archived': { label: 'Arsip', class: 'badge-muted' }
        };
        const s = statusMap[status] || { label: status, class: '' };
        return `<span class="badge ${s.class}">${s.label}</span>`;
    }
};

// CSS untuk Toast (Akan disinkronkan dengan style.css nanti)
const style = document.createElement('style');
style.innerHTML = `
    .toast-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--panel, #1b2430);
        color: white;
        padding: 12px 20px;
        border-radius: var(--radius, 10px);
        box-shadow: var(--shadow, 0 6px 18px rgba(0,0,0,0.5));
        border-left: 5px solid var(--accent, #2ea6ff);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    }
    .toast-success { border-left-color: var(--success, #2ecc71); }
    .toast-error { border-left-color: var(--danger, #e74c3c); }
    .toast-content { display: flex; align-items: center; gap: 10px; }
    .fade-out { opacity: 0; transition: opacity 0.5s ease; }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Export agar bisa digunakan di file lain
window.utils = utils;
