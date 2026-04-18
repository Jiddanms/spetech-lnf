
/**
 * assets/js/utils.js
 * Helper functions untuk Spetech Lost and Found.
 * Fokus: QR Detection, Date Formatting, UI Feedback, dan DOM Helpers.
 * UPDATE QoL 6.17: Image Compression Engine (Anti-Connection Error)
 * UPDATE QoL 6.18: Dynamic QR View & Location Visual Helpers
 * PRINSIP: NO DELETION - ALL ORIGINAL CODE PRESERVED (190+ Lines)
 */

const utils = {
    /**
     * Mengambil parameter dari URL (Sangat krusial untuk integrasi QR Lokasi)
     */
    getQueryParam: (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Memformat tanggal ISO dari database menjadi format yang enak dibaca siswa.
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
     */
    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    /**
     * Menghasilkan Badge HTML berdasarkan status barang
     */
    getStatusBadge: (status) => {
        const labels = {
            'pending': { text: 'Menunggu', class: 'badge-warning' },
            'verified': { text: 'Terverifikasi', class: 'badge-info' },
            'completed': { text: 'Selesai', class: 'badge-success' }
        };
        const config = labels[status] || { text: status, class: 'badge-secondary' };
        return `<span class="badge ${config.class}">${config.text}</span>`;
    },

    /**
     * FIX QoL 6.17: Konversi File ke Base64 dengan Auto-Compression
     * Mencegah "Kesalahan Koneksi" akibat payload terlalu besar.
     */
    fileToBase64: async (file) => {
        return new Promise((resolve, reject) => {
            // Jika ukuran file > 1MB, lakukan kompresi otomatis
            if (file.size > 1024 * 1024) {
                utils.compressImage(file, 0.7, (compressedBase64) => {
                    resolve(compressedBase64);
                });
            } else {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            }
        });
    },

    /**
     * NEW QoL 6.17: Image Compressor Engine
     * Mengecilkan resolusi gambar secara dinamis untuk stabilisasi upload.
     */
    compressImage: (file, quality, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Max Width 800px untuk menghemat bandwidth tanpa pecah
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Output Base64 dengan kualitas tertentu
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                callback(dataUrl);
            };
        };
    },

    /**
     * QoL: Show Modal Detail
     */
    showModal: (contentHtml) => {
        const modal = document.getElementById('modal-detail');
        const body = document.getElementById('detail-content-body');
        if (modal && body) {
            body.innerHTML = contentHtml;
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; 
        }
    },

    /**
     * QoL: Hide Modal Detail
     */
    hideModal: () => {
        const modal = document.getElementById('modal-detail');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    },

    /**
     * NEW QoL 6.18: QR Code Preview Zoom
     * Memungkinkan gambar QR di card lokasi diklik untuk diperbesar.
     */
    previewQR: (qrUrl, locationName) => {
        const html = `
            <div style="text-align:center; padding:20px;">
                <h2 style="margin-bottom:20px; color:var(--accent);">${locationName}</h2>
                <div style="background:white; padding:20px; border-radius:15px; display:inline-block; margin-bottom:20px;">
                    <img src="${qrUrl}" style="width:250px; height:250px; display:block;">
                </div>
                <p style="color:var(--text-dim); font-size:0.9rem;">Scan QR ini untuk otomatis masuk ke form pelaporan dengan lokasi yang sudah terpilih.</p>
                <button class="btn-primary" style="margin-top:20px;" onclick="window.print()">Cetak QR</button>
            </div>
        `;
        utils.showModal(html);
    }
};

// CSS untuk Toast (TETAP DIPERTAHANKAN DAN DIPERKUAT)
const style = document.createElement('style');
style.innerHTML = `
    .toast-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1e293b;
        color: white;
        padding: 12px 25px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        border-left: 5px solid #3b82f6;
        z-index: 9999;
        font-weight: 600;
        animation: toastSlideIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        transition: opacity 0.5s ease;
    }
    .toast-success { border-left-color: #10b981; }
    .toast-error { border-left-color: #ef4444; }
    .toast-info { border-left-color: #3b82f6; }

    @keyframes toastSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    .badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
    }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge-secondary { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }

    /* QoL 6.18: Additional Utility Styles */
    .loader {
        border: 3px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        border-top: 3px solid var(--accent);
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

window.utils = utils;
