import { auth } from '../firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from '../router.js';
import { toast } from '../toast.js';
import { icon, brandMark } from '../icons.js';

export function renderSidebar(activePage) {
  const user = auth.currentUser;
  const initial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const name = user?.displayName || 'Portfolio Owner';
  const email = user?.email || '';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hash: '/dashboard' },
    { id: 'assets', label: 'My Assets', icon: 'layers', hash: '/assets' },
    { id: 'add', label: 'Add Asset', icon: 'plus', hash: '/assets/add' },
    { id: 'platforms', label: 'Platforms', icon: 'server', hash: '/platforms' },
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
          <span>Passive Asset<br>Portfolio</span>
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
  `;
}

export function renderTopbar(title) {
  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="mobile-menu-btn" id="mobile-menu-btn">${icon('menu', 22)}</button>
        <div class="topbar-title">${title}</div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-primary btn-sm" onclick="location.hash='#/assets/add'">
          ${icon('plus', 15)} Add Asset
        </button>
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
}
