
/**
 * js/qrscanner.js
 * Lightweight QR scanner helper for Spetech Lost and Found Web
 *
 * Exposes global `qrScanner` with method:
 *   qrScanner.scan(callback)
 *
 * Behavior:
 * - Attempts to use Html5Qrcode (if already loaded) or dynamically load it from CDN.
 * - Opens a minimal modal overlay with camera preview and scans for QR.
 * - On successful scan, calls callback(locationName).
 * - Validates scanned text against allowed locations list.
 * - Provides graceful fallback: if camera not available or user denies permission, falls back to manual input prompt.
 * - Cleans up DOM and camera resources after use.
 *
 * Dependencies:
 * - notifier.js (notifier.info / notifier.success / notifier.error) — used for user feedback.
 *
 * Notes:
 * - Keep this file self-contained and defensive: it will not throw uncaught errors.
 */

(function (global) {
  const ALLOWED_LOCATIONS = [
    'Gedung A',
    'Gedung B',
    'Gedung C',
    'Lapangan Upacara',
    'Lapangan Basket',
    'Lapangan Tenis',
    'Koperasi',
    'Kantin'
  ];

  const CDN_HTML5QRCODE = 'https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js';

  let loadingScript = false;
  let html5QrcodeLoaded = !!global.Html5Qrcode;

  // Utility: inject script tag to load Html5Qrcode
  function loadHtml5Qrcode() {
    return new Promise((resolve, reject) => {
      if (html5QrcodeLoaded) return resolve(true);
      if (loadingScript) {
        // Poll until loaded
        const t = setInterval(() => {
          if (global.Html5Qrcode) {
            clearInterval(t);
            html5QrcodeLoaded = true;
            resolve(true);
          }
        }, 200);
        // timeout after 10s
        setTimeout(() => {
          clearInterval(t);
          if (!global.Html5Qrcode) reject(new Error('Timeout loading Html5Qrcode'));
        }, 10000);
        return;
      }

      loadingScript = true;
      const s = document.createElement('script');
      s.src = CDN_HTML5QRCODE;
      s.async = true;
      s.onload = () => {
        html5QrcodeLoaded = !!global.Html5Qrcode;
        loadingScript = false;
        if (html5QrcodeLoaded) resolve(true);
        else reject(new Error('Html5Qrcode failed to initialize'));
      };
      s.onerror = () => {
        loadingScript = false;
        reject(new Error('Failed to load Html5Qrcode script'));
      };
      document.head.appendChild(s);
    });
  }

  // Create modal overlay for scanner
  function createScannerOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'qr-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(2,6,23,0.75)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
      <div id="qr-modal" style="
        width: min(720px, 92%);
        max-width: 720px;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        color: #fff;
        display:flex;
        flex-direction:column;
        gap:8px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Scan QR Lokasi</strong>
          <button id="qr-close-btn" style="background:transparent;border:0;color:#fff;font-weight:700;cursor:pointer">Tutup</button>
        </div>
        <div id="qr-reader" style="width:100%;height:360px;background:#000;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center">
          <div style="color:var(--muted);font-size:14px">Memuat kamera...</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
          <div style="color:#9aa6b2;font-size:13px">Arahkan kamera ke QR code lokasi.</div>
          <div style="display:flex;gap:8px">
            <button id="qr-manual-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.06);padding:8px;border-radius:8px;color:#fff;cursor:pointer">Masukkan Manual</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  // Cleanup overlay and stop camera
  async function cleanup(overlay, html5ScannerInstance) {
    try {
      if (html5ScannerInstance && html5ScannerInstance.stop) {
        await html5ScannerInstance.stop().catch(()=>{});
        // clear camera preview element if any
      }
    } catch (e) {
      // ignore
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // Validate scanned text against allowed locations
  function validateLocation(text) {
    if (!text) return null;
    const normalized = String(text).trim();
    // direct match
    if (ALLOWED_LOCATIONS.includes(normalized)) return normalized;
    // try case-insensitive match
    const found = ALLOWED_LOCATIONS.find(l => l.toLowerCase() === normalized.toLowerCase());
    if (found) return found;
    // try contains (some QR may include extra info like "Lokasi: Gedung A")
    for (const loc of ALLOWED_LOCATIONS) {
      if (normalized.toLowerCase().includes(loc.toLowerCase())) return loc;
    }
    return null;
  }

  // Fallback manual input prompt
  function manualInputFlow(callback) {
    const manual = prompt('Masukkan nama lokasi pelaporan (contoh: Gedung A, Kantin):');
    if (!manual) {
      if (global.notifier && global.notifier.info) global.notifier.info('Scan dibatalkan.');
      return;
    }
    const valid = validateLocation(manual);
    if (valid) {
      if (global.notifier && global.notifier.success) global.notifier.success(`Lokasi terisi: ${valid}`);
      callback(valid);
    } else {
      if (global.notifier && global.notifier.error) global.notifier.error('Lokasi tidak dikenali. Pastikan memasukkan salah satu lokasi resmi.');
    }
  }

  // Main scan implementation using Html5Qrcode
  async function scanWithHtml5Qrcode(callback) {
    try {
      await loadHtml5Qrcode();
    } catch (err) {
      // loading failed -> fallback
      if (global.notifier && global.notifier.error) global.notifier.error('Tidak dapat memuat modul scanner. Gunakan input manual.');
      manualInputFlow(callback);
      return;
    }

    const overlay = createScannerOverlay();
    const closeBtn = overlay.querySelector('#qr-close-btn');
    const manualBtn = overlay.querySelector('#qr-manual-btn');
    const readerElem = overlay.querySelector('#qr-reader');

    let html5Scanner = null;
    let active = true;

    function stopAndCleanup() {
      active = false;
      cleanup(overlay, html5Scanner);
    }

    closeBtn.addEventListener('click', () => {
      if (global.notifier && global.notifier.info) global.notifier.info('Scanner ditutup.');
      stopAndCleanup();
    });

    manualBtn.addEventListener('click', () => {
      stopAndCleanup();
      manualInputFlow(callback);
    });

    // create scanner instance
    try {
      // Html5Qrcode requires an element id
      const readerId = 'html5qr-reader-' + Date.now();
      readerElem.id = readerId;

      html5Scanner = new global.Html5Qrcode(readerId, /* verbose= */ false);

      // choose camera: prefer environment (rear)
      const cameras = await global.Html5Qrcode.getCameras().catch(()=>[]);
      let cameraId = null;
      if (cameras && cameras.length) {
        // prefer camera with label containing 'back' or 'rear' or choose first
        const rear = cameras.find(c => /back|rear|environment/i.test(c.label));
        cameraId = (rear && rear.id) || cameras[0].id;
      }

      const config = { fps: 10, qrbox: { width: Math.min(320, readerElem.clientWidth - 20), height: Math.min(320, readerElem.clientWidth - 20) } };

      await html5Scanner.start(
        cameraId || { facingMode: 'environment' },
        config,
        (decodedText, decodedResult) => {
          if (!active) return;
          const valid = validateLocation(decodedText);
          if (valid) {
            if (global.notifier && global.notifier.success) global.notifier.success(`QR terdeteksi: ${valid}`);
            stopAndCleanup();
            callback(valid);
          } else {
            // show info but keep scanning
            if (global.notifier && global.notifier.info) global.notifier.info('QR terdeteksi, namun bukan lokasi pelaporan resmi.');
          }
        },
        (errorMessage) => {
          // scanning failure per frame - ignore silently
        }
      );
    } catch (err) {
      // camera start failed -> fallback to manual
      if (global.notifier && global.notifier.error) global.notifier.error('Tidak dapat mengakses kamera. Gunakan input manual.');
      stopAndCleanup();
      manualInputFlow(callback);
    }
  }

  // Public API
  const qrScanner = {
    /**
     * scan(callback)
     * Opens scanner UI and calls callback(locationName) on success.
     * If scanning cannot proceed, falls back to manual input.
     */
    scan(callback) {
      try {
        if (typeof callback !== 'function') {
          if (global.notifier && global.notifier.error) global.notifier.error('Callback tidak valid untuk qrScanner.scan');
          return;
        }

        // Quick check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (global.notifier && global.notifier.info) global.notifier.info('Perangkat tidak mendukung kamera. Menggunakan input manual.');
          manualInputFlow(callback);
          return;
        }

        // Start html5-qrcode flow
        scanWithHtml5Qrcode(callback);
      } catch (err) {
        console.error('qrScanner.scan error', err);
        if (global.notifier && global.notifier.error) global.notifier.error('Terjadi kesalahan scanner. Gunakan input manual.');
        manualInputFlow(callback);
      }
    },

    // Expose allowed locations for external use
    allowedLocations() {
      return ALLOWED_LOCATIONS.slice();
    }
  };

  // Attach to global
  global.qrScanner = qrScanner;

})(window);
