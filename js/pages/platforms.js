import { getPlatforms, deletePlatform } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency } from '../utils.js';
import { toast } from '../toast.js';
import { router } from '../router.js';

export const PLATFORM_CATEGORIES = [
  'Hosting', 'Email Marketing', 'Analytics', 'Design', 'Tools',
  'Payment', 'Automation', 'Storage', 'CDN', 'Other'
];

export const PLATFORM_ICONS = {
  'Hosting': '🖥',
  'Email Marketing': '📧',
  'Analytics': '📊',
  'Design': '🎨',
  'Tools': '🔧',
  'Payment': '💳',
  'Automation': '⚡',
  'Storage': '☁',
  'CDN': '🌐',
  'Other': '◈',
};

export const PLATFORM_COLORS = {
  'Hosting': 'rgba(59,130,246,0.15)',
  'Email Marketing': 'rgba(245,158,11,0.15)',
  'Analytics': 'rgba(34,197,94,0.15)',
  'Design': 'rgba(168,85,247,0.15)',
  'Tools': 'rgba(124,92,252,0.15)',
  'Payment': 'rgba(34,197,94,0.15)',
  'Automation': 'rgba(239,68,68,0.15)',
  'Storage': 'rgba(59,130,246,0.15)',
  'CDN': 'rgba(136,136,168,0.15)',
  'Other': 'rgba(136,136,168,0.15)',
};

export async function renderPlatforms() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('platforms')}
    <div class="main-content">
      ${renderTopbar('Platforms')}
      <div class="page-content">
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)">
          Loading…
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let platforms = [];
  try {
    platforms = await getPlatforms();
  } catch (err) {
    console.error(err);
  }

  buildPlatformsPage(platforms, 'All');
}

function buildPlatformsPage(platforms, activeFilter) {
  const totalCost = platforms.reduce((s, p) => s + (Number(p.monthlyCost) || 0), 0);

  let filtered = activeFilter === 'All' ? platforms : platforms.filter(p => p.category === activeFilter);

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Platforms</h1>
        <p class="page-desc">Tools & services powering your passive assets</p>
      </div>
      <a href="#/platforms/add" class="btn btn-primary">+ Add Platform</a>
    </div>

    <!-- Summary strip -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:28px">
      <div class="stat-card" style="animation-delay:0.05s">
        <div class="stat-icon red">⬡</div>
        <div class="stat-label">Total Platforms</div>
        <div class="stat-value">${platforms.length}</div>
      </div>
      <div class="stat-card" style="animation-delay:0.1s">
        <div class="stat-icon red">$</div>
        <div class="stat-label">Monthly Cost</div>
        <div class="stat-value" style="color:var(--red)">${formatCurrency(totalCost)}</div>
        <div class="stat-sub">Per month</div>
      </div>
      <div class="stat-card" style="animation-delay:0.15s">
        <div class="stat-icon yellow">↑</div>
        <div class="stat-label">Yearly Cost</div>
        <div class="stat-value">${formatCurrency(totalCost * 12)}</div>
        <div class="stat-sub">Annualized</div>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filters-bar">
      ${['All', ...PLATFORM_CATEGORIES].map(cat => `
        <button class="filter-chip ${activeFilter === cat ? 'active' : ''}" data-filter="${cat}">${cat}</button>
      `).join('')}
    </div>

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">⬡</div>
        <div class="empty-title">${activeFilter === 'All' ? 'No platforms yet' : `No ${activeFilter} platforms`}</div>
        <div class="empty-desc">Add the tools and services you pay for to keep your assets running.</div>
        <a href="#/platforms/add" class="btn btn-primary">+ Add Platform</a>
      </div>
    ` : `
      <div class="assets-grid">
        ${filtered.map(p => platformCard(p)).join('')}
      </div>
    `}
  `;

  content.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => buildPlatformsPage(platforms, btn.dataset.filter));
  });

  // Bind delete buttons
  content.querySelectorAll('[data-delete-platform]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.deletePlatform;
      const name = btn.dataset.name;
      confirmDelete(id, name, platforms, activeFilter);
    });
  });
}

function platformCard(p) {
  const icon = PLATFORM_ICONS[p.category] || '◈';
  const bg = PLATFORM_COLORS[p.category] || 'rgba(136,136,168,0.15)';
  return `
    <div class="asset-card" style="cursor:default">
      <div class="asset-card-header">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0">
          <div class="asset-card-icon" style="background:${bg}">${icon}</div>
          <div style="min-width:0">
            <div class="asset-card-name">${escHtml(p.name)}</div>
            <div class="badge badge-category">${p.category}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <a href="#/platforms/${p.id}/edit" class="btn btn-ghost btn-sm" title="Edit" onclick="event.stopPropagation()">✏</a>
          <button class="btn btn-danger btn-sm" data-delete-platform="${p.id}" data-name="${escHtml(p.name)}" title="Delete">🗑</button>
        </div>
      </div>
      ${p.description ? `<div class="asset-card-desc">${escHtml(p.description)}</div>` : ''}
      <div class="asset-card-meta">
        <div class="asset-meta-item">
          <div class="asset-meta-label">Monthly Cost</div>
          <div class="asset-meta-value" style="color:var(--red)">${formatCurrency(Number(p.monthlyCost) || 0)}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Yearly Cost</div>
          <div class="asset-meta-value">${formatCurrency((Number(p.monthlyCost) || 0) * 12)}</div>
        </div>
      </div>
      ${p.website ? `<div style="font-size:12px;color:var(--text-muted);margin-top:-4px">🔗 ${escHtml(p.website)}</div>` : ''}
    </div>
  `;
}

function confirmDelete(id, name, platforms, filter) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Remove Platform</div>
      <div class="modal-desc">Remove <strong>${escHtml(name)}</strong> from your platforms list?</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancel-del">Cancel</button>
        <button class="btn btn-danger" id="confirm-del">Remove</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-del').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-del').addEventListener('click', async () => {
    try {
      await deletePlatform(id);
      overlay.remove();
      toast('Platform removed', 'success');
      const updated = platforms.filter(p => p.id !== id);
      buildPlatformsPage(updated, filter);
    } catch {
      toast('Failed to remove platform', 'error');
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
