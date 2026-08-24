// ============================================
// PWA: service worker + install prompt handling
// ============================================

let deferredPrompt = null;

/** Register the service worker and capture the install prompt. */
export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    wireInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    wireInstallButtons();
  });
}

export function canInstall() {
  return !!deferredPrompt;
}

async function promptInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch {}
  deferredPrompt = null;
  wireInstallButtons();
}

/**
 * Show/hide and wire every [data-install] button currently in the DOM.
 * Safe to call on every page render.
 */
export function wireInstallButtons() {
  const show = canInstall();
  document.querySelectorAll('[data-install]').forEach(el => {
    el.style.display = show ? 'flex' : 'none';
    if (!el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('click', promptInstall);
    }
  });
}
