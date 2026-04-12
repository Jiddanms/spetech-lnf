
/**
 * js/notifier.js
 * Lightweight notification helper for Spetech Lost and Found Web
 *
 * Exposes global `notifier` with methods:
 *   notifier.success(message)
 *   notifier.info(message)
 *   notifier.error(message)
 *
 * Features:
 * - Toast stack in top-right corner
 * - Auto-dismiss with configurable durations per type
 * - Accessible (aria-live polite) and keyboard dismissible
 * - Minimal, dependency-free, defensive
 */

(function (global) {
  const DEFAULTS = {
    duration: { success: 3500, info: 3000, error: 5000 },
    containerId: 'notifier-container',
    maxToasts: 5
  };

  // Create container if not exists
  function ensureContainer() {
    let c = document.getElementById(DEFAULTS.containerId);
    if (c) return c;
    c = document.createElement('div');
    c.id = DEFAULTS.containerId;
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'false');
    Object.assign(c.style, {
      position: 'fixed',
      top: '18px',
      right: '18px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '360px',
      pointerEvents: 'none'
    });
    document.body.appendChild(c);
    return c;
  }

  // Create toast element
  function createToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `notifier-toast notifier-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('tabindex', '0');
    toast.style.pointerEvents = 'auto';
    toast.style.display = 'flex';
    toast.style.alignItems = 'flex-start';
    toast.style.gap = '10px';
    toast.style.padding = '10px 12px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 8px 20px rgba(2,6,23,0.6)';
    toast.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
    toast.style.color = '#fff';
    toast.style.fontWeight = 600;
    toast.style.fontSize = '14px';
    toast.style.border = '1px solid rgba(255,255,255,0.03)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    toast.style.transition = 'opacity .22s ease, transform .22s ease';

    // Icon
    const icon = document.createElement('div');
    icon.style.minWidth = '28px';
    icon.style.height = '28px';
    icon.style.borderRadius = '6px';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.flex = '0 0 28px';
    icon.style.fontSize = '14px';
    icon.style.fontWeight = 800;

    if (type === 'success') {
      icon.textContent = '✓';
      icon.style.background = 'linear-gradient(90deg,#2ecc71,#27ae60)';
      icon.style.color = '#07210a';
    } else if (type === 'error') {
      icon.textContent = '✕';
      icon.style.background = 'linear-gradient(90deg,#e74c3c,#c0392b)';
      icon.style.color = '#fff';
    } else {
      icon.textContent = 'i';
      icon.style.background = 'linear-gradient(90deg,#2ea6ff,#1e90ff)';
      icon.style.color = '#042033';
    }

    // Content
    const content = document.createElement('div');
    content.style.flex = '1 1 auto';
    content.style.lineHeight = '1.2';
    content.style.color = 'var(--white, #fff)';
    content.innerText = message || '';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Tutup notifikasi');
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: '0',
      color: 'rgba(255,255,255,0.7)',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '4px',
      marginLeft: '8px'
    });

    closeBtn.addEventListener('click', () => removeToast(toast));
    closeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') removeToast(toast);
    });

    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeBtn);

    // keyboard dismiss (Esc)
    toast.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') removeToast(toast);
    });

    return toast;
  }

  // Remove toast with fade
  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  }

  // Show toast
  function show(type, message) {
    try {
      const container = ensureContainer();
      // enforce max toasts
      while (container.children.length >= DEFAULTS.maxToasts) {
        // remove oldest (first child)
        container.removeChild(container.firstChild);
      }
      const toast = createToast(type, message);
      // insert at end (newest on bottom)
      container.appendChild(toast);
      // force reflow then animate in
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        toast.focus({ preventScroll: true });
      });

      // Auto-dismiss
      const dur = DEFAULTS.duration[type] || DEFAULTS.duration.info;
      const timer = setTimeout(() => removeToast(toast), dur);

      // Pause on hover/focus
      toast.addEventListener('mouseenter', () => clearTimeout(timer));
      toast.addEventListener('focusin', () => clearTimeout(timer));

      return toast;
    } catch (err) {
      // silent fail-safe
      console.error('notifier.show error', err);
    }
  }

  // Public API
  const notifier = {
    success(msg) { return show('success', String(msg || 'Sukses')); },
    info(msg) { return show('info', String(msg || 'Info')); },
    error(msg) { return show('error', String(msg || 'Terjadi kesalahan')); }
  };

  // Attach to global
  global.notifier = notifier;

})(window);
