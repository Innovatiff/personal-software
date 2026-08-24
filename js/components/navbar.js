import { auth } from '../firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from '../router.js';
import { toast } from '../toast.js';
import { icon, brandMark } from '../icons.js';
import { wireInstallButtons } from '../pwa.js';

export function renderSidebar(activePage) {
  const user = auth.currentUser;
  const initial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const name = user?.displayName || 'Portfolio Owner';
  const email = user?.email || '';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hash: '/dashboard' },
    { id: 'businesses', label: 'Businesses', icon: 'building2', hash: '/businesses' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt', hash: '/invoices' },
    { id: 'assets', label: 'My Assets', icon: 'layers', hash: '/assets' },
    { id: 'platforms', label: 'Expenses', icon: 'server', hash: '/platforms' },
    { id: 'monthly', label: 'Monthly Overview', icon: 'wallet', hash: '/monthly' },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: 'settings', hash: '/settings' },
  ];

  const navLink = (item) => `
    <a class="nav-item ${activePage === item.id ? 'active' : ''}" href="#${item.hash}">
      <span class="nav-icon">${icon(item.icon, 18)}</span>
      ${item.label}
    </a>`;

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <a class="sidebar-logo" href="#/dashboard">
          ${brandMark(30)}
          <span style="font-size:16px">Portfolio</span>
        </a>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Menu</div>
        ${navItems.map(navLink).join('')}
        <div class="nav-section-label">Account</div>
        ${bottomItems.map(navLink).join('')}
        <button class="nav-item" id="logout-btn">
          <span class="nav-icon">${icon('logout', 18)}</span>
          Sign Out
        </button>
      </nav>
      <div class="sidebar-footer">
        <button class="install-btn" data-install>
          ${icon('download', 16)} Install app
        </button>
        <div class="user-info" onclick="location.hash='#/settings'">
          <div class="user-avatar">${initial}</div>
          <div class="user-details">
            <div class="user-name">${name}</div>
            <div class="user-email">${email}</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    ${renderBottomNav(activePage)}
  `;
}

// Fixed bottom tab bar shown on phones for an app-like feel.
function renderBottomNav(activePage) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'dashboard', hash: '/dashboard' },
    { id: 'businesses', label: 'Clients', icon: 'building2', hash: '/businesses' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt', hash: '/invoices' },
    { id: 'platforms', label: 'Expenses', icon: 'server', hash: '/platforms' },
    { id: 'monthly', label: 'Monthly', icon: 'wallet', hash: '/monthly' },
  ];
  return `
    <nav class="bottom-nav">
      ${tabs.map(t => `
        <a class="bottom-nav-item ${activePage === t.id ? 'active' : ''}" href="#${t.hash}">
          <span class="bottom-nav-icon">${icon(t.icon, 21)}</span>
          <span class="bottom-nav-label">${t.label}</span>
        </a>`).join('')}
    </nav>`;
}

export function renderTopbar(title, opts = {}) {
  const addLabel = opts.addLabel || 'Add Asset';
  const addHash = opts.addHash || '/assets/add';
  const addBtn = opts.noAdd ? '' : `
        <button class="btn btn-primary btn-sm" onclick="location.hash='#${addHash}'">
          ${icon('plus', 15)} ${addLabel}
        </button>`;
  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="mobile-menu-btn" id="mobile-menu-btn">${icon('menu', 22)}</button>
        <div class="topbar-title">${title}</div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-secondary btn-sm" data-install style="display:none">
          ${icon('download', 15)} Install
        </button>
        ${addBtn}
      </div>
    </div>
  `;
}

export function attachNavbarEvents() {
  const logoutBtn = document.getElementById('logout-btn');
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      toast('Signed out successfully', 'success');
      router.navigate('/login');
    });
  }

  if (mobileBtn && sidebar && overlay) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Show/wire the "Install app" buttons if the browser allows installation
  wireInstallButtons();
}
