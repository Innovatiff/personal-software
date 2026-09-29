import { auth } from '../firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from '../router.js';
import { toast } from '../toast.js';
import { icon, brandMark } from '../icons.js';
import { wireInstallButtons } from '../pwa.js';
import { currentTheme, toggleTheme } from '../theme.js';
import { haptic } from '../anim.js';
import { initGlobalSearch } from '../search.js';

export function renderSidebar(activePage) {
  const user = auth.currentUser;
  const initial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const name = user?.displayName || 'Innovatif';
  const email = user?.email || '';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hash: '/dashboard' },
    { id: 'businesses', label: 'Clients', icon: 'building2', hash: '/businesses' },
    { id: 'invoices', label: 'Invoices', icon: 'receipt', hash: '/invoices' },
    { id: 'assets', label: 'Assets', icon: 'layers', hash: '/assets' },
    { id: 'platforms', label: 'Expenses', icon: 'server', hash: '/platforms' },
    { id: 'monthly', label: 'Reports', icon: 'barChart', hash: '/monthly' },
    { id: 'trophies', label: 'Trophies', icon: 'trophy', hash: '/trophies' },
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
          ${brandMark(36)}
          <span class="brand-text">
            <span class="brand-name">Innovatif</span>
            <span class="brand-tag">Design. Build. Bill.</span>
          </span>
        </a>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map(navLink).join('')}
        <button class="nav-item" id="logout-btn">
          <span class="nav-icon">${icon('logout', 18)}</span>
          Sign Out
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="install-card" data-install role="button" tabindex="0">
          <div class="ic-icon">${icon('download', 17)}</div>
          <div class="ic-title">Get the app</div>
          <div class="ic-sub">Install Innovatif on your phone or desktop for the full experience.</div>
          <span class="ic-btn">Install</span>
        </div>
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
    { id: 'trophies', label: 'Trophies', icon: 'trophy', hash: '/trophies' },
    { id: 'monthly', label: 'Reports', icon: 'barChart', hash: '/monthly' },
  ];
  return `
    <nav class="bottom-nav">
      ${tabs.map(t => `
        <a class="bottom-nav-item ${activePage === t.id ? 'active' : ''}" href="#${t.hash}">
          <span class="bottom-nav-icon">${icon(t.icon, 21)}</span>
          <span class="bottom-nav-label">${t.label}</span>
        </a>`).join('')}
    </nav>
    <button class="fab" id="quick-add" title="Quick add">${icon('plus', 24, { strokeWidth: 2.2 })}</button>`;
}

// Slide-up quick-add action sheet (opened from the FAB)
function openQuickAdd() {
  haptic(10);
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  const item = (ic, color, bg, label, sub, hash) => `
    <a class="sheet-item" href="#${hash}">
      <span class="sheet-icon" style="background:${bg};color:${color}">${icon(ic, 20)}</span>
      <span>${label}<div class="sheet-sub">${sub}</div></span>
    </a>`;
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Quick add</div>
      ${item('receipt', 'var(--accent)', 'var(--purple-soft)', 'Invoice', 'A one-time job you delivered', '/invoices/new')}
      ${item('building2', 'var(--blue)', 'var(--blue-soft)', 'Client', 'A business paying recurring fees', '/businesses/add')}
      ${item('layers', 'var(--yellow)', 'var(--yellow-soft)', 'Asset', 'A passive income source', '/assets/add')}
      ${item('server', 'var(--red)', 'var(--red-soft)', 'Expense', 'A platform or service you pay for', '/platforms/add')}
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 220);
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('.sheet-item').forEach(a => a.addEventListener('click', () => { haptic(8); close(); }));
}

export function renderTopbar(title, opts = {}) {
  const addLabel = opts.addLabel || 'New Invoice';
  const addHash = opts.addHash || '/invoices/new';
  const addBtn = opts.noAdd ? '' : `
        <button class="btn btn-primary btn-sm" onclick="location.hash='#${addHash}'">
          ${icon('plus', 15)} <span class="add-label">${addLabel}</span>
        </button>`;
  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="mobile-menu-btn" id="mobile-menu-btn">${icon('menu', 22)}</button>
        <div class="topbar-title">${title}</div>
      </div>
      <div class="topbar-search">
        ${icon('search', 16)}
        <input class="search-input" id="global-search" type="text" placeholder="Search clients, invoices, assets…" autocomplete="off" />
        <span class="search-kbd">⌘K</span>
        <div class="search-results" id="search-results"></div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-secondary btn-sm btn-icon" id="theme-btn" title="Toggle light / dark">
          ${icon(currentTheme() === 'dark' ? 'sun' : 'moon', 16)}
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

  // Theme toggle
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      haptic(8);
      const t = toggleTheme();
      themeBtn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 16);
    });
  }

  // Quick-add FAB (phones)
  const fab = document.getElementById('quick-add');
  if (fab) fab.addEventListener('click', openQuickAdd);

  // Global search (⌘K)
  initGlobalSearch();

  // Show/wire the install card if the browser allows installation
  wireInstallButtons();
}
