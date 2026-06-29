import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from './router.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderAssets } from './pages/assets.js';
import { renderAddAsset } from './pages/add-asset.js';
import { renderAssetDetail } from './pages/asset-detail.js';
import { renderSettings } from './pages/settings.js';
import { renderPlatforms } from './pages/platforms.js';
import { renderAddPlatform } from './pages/add-platform.js';
import { renderMonthly } from './pages/monthly.js';
import { renderNotFound } from './pages/not-found.js';

// Wrap a route handler to require authentication
function guard(fn) {
  return (params) => {
    if (!auth.currentUser) {
      router.navigate('/login');
      return;
    }
    fn(params);
  };
}

// Wait for Firebase Auth to initialize before starting the router
onAuthStateChanged(auth, (user) => {
  // Fade out loading screen
  const loading = document.getElementById('loading-screen');
  if (loading) {
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 400);
  }

  router
    .on('/login', () => {
      if (user) { router.navigate('/dashboard'); return; }
      renderLogin();
    })
    .on('/register', () => {
      if (user) { router.navigate('/dashboard'); return; }
      renderRegister();
    })
    .on('/dashboard', guard(renderDashboard))
    .on('/assets', guard(renderAssets))
    .on('/assets/add', guard(() => renderAddAsset({})))
    .on('/assets/:id', guard(renderAssetDetail))
    .on('/assets/:id/edit', guard((p) => renderAddAsset(p)))
    .on('/platforms', guard(renderPlatforms))
    .on('/platforms/add', guard(() => renderAddPlatform({})))
    .on('/platforms/:id/edit', guard((p) => renderAddPlatform(p)))
    .on('/monthly', guard(renderMonthly))
    .on('/settings', guard(renderSettings))
    .on('/', () => {
      router.navigate(user ? '/dashboard' : '/login');
    })
    .on('*', renderNotFound);

  // Default route
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = user ? '#/dashboard' : '#/login';
  }

  router.start();
});
