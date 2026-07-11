/**
 * main.js
 * Shared utilities: dark mode, toast notifications, helpers.
 * Loaded on every page.
 */

// ─────────────────────── Dark Mode ───────────────────────────
(function () {
  const html      = document.documentElement;
  const toggleBtn = document.getElementById('themeToggle');
  const icon      = document.getElementById('themeIcon');
  const PREF_KEY  = 'interview-theme';

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
    // Update Chart.js defaults when theme changes
    updateChartDefaults(theme);
  }

  function updateChartDefaults(theme) {
    if (typeof Chart === 'undefined') return;
    const textColor    = theme === 'dark' ? '#9ba3c7' : '#4a5178';
    const gridColor    = theme === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
    Chart.defaults.color                                     = textColor;
    Chart.defaults.scale.grid.color                          = gridColor;
    Chart.defaults.plugins.legend.labels.color               = textColor;
  }

  // Initialise from stored preference or system preference
  const stored  = localStorage.getItem(PREF_KEY);
  const system  = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(stored || system);

  // Toggle button
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem(PREF_KEY, next);
      applyTheme(next);
    });
  }
})();


// ─────────────────────── Toast System ────────────────────────
(function () {
  // Create container once
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  /**
   * showToast(message, type = 'info', duration = 4000)
   * type: 'success' | 'danger' | 'warning' | 'info'
   */
  window.showToast = function (message, type = 'info', duration = 4000) {
    const iconMap = {
      success: 'bi-check-circle-fill text-success',
      danger:  'bi-x-circle-fill text-danger',
      warning: 'bi-exclamation-triangle-fill text-warning',
      info:    'bi-info-circle-fill text-info',
    };
    const toast = document.createElement('div');
    toast.className = `toast-custom toast-${type}`;
    toast.innerHTML = `
      <i class="bi ${iconMap[type] || iconMap.info} flex-shrink-0 mt-1"></i>
      <span>${escapeHtml(message)}</span>
      <button class="btn-close btn-close-sm ms-auto" style="flex-shrink:0"></button>
    `;
    toast.querySelector('.btn-close').addEventListener('click', () => removeToast(toast));
    container.appendChild(toast);
    if (duration > 0) setTimeout(() => removeToast(toast), duration);
  };

  function removeToast(el) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateX(20px)';
    el.style.transition = 'opacity .25s, transform .25s';
    setTimeout(() => el.remove(), 260);
  }
})();


// ─────────────────────── Utilities ───────────────────────────
/**
 * Escape HTML to prevent XSS in injected content.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format an ISO timestamp to a short readable string.
 */
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Debounce — limits function call frequency.
 */
function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * Jinja2 `enumerate` filter polyfill for Jinja rendering
 * (used in history.html — handled server-side, this is just reference)
 */

// Auto-dismiss Bootstrap alerts after 6 s
document.querySelectorAll('.alert.alert-dismissible').forEach(el => {
  setTimeout(() => {
    const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
    if (bsAlert) bsAlert.close();
  }, 6000);
});
