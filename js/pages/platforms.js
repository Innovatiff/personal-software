import { getPlatforms, deletePlatform } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, hexToRgba } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../toast.js';

// Platform categories with icon + color
export const PLATFORM_META = {
  'Hosting':         { iconName: 'server',     color: '#60a5fa' },
  'Domain':          { iconName: 'globe',      color: '#34d399' },
  'Email Marketing': { iconName: 'mail',       color: '#fbbf24' },
  'Analytics':       { iconName: 'barChart',   color: '#4ade80' },
  'Design':          { iconName: 'palette',    color: '#e879f9' },
  'Tools':           { iconName: 'tool',       color: '#a78bfa' },
  'Payment':         { iconName: 'creditCard', color: '#38bdf8' },
  'Automation':      { iconName: 'zap',        color: '#fb7185' },
  'Storage':         { iconName: 'hardDrive',  color: '#818cf8' },
  'CDN':             { iconName: 'network',    color: '#2dd4bf' },
  'Advertising':     { iconName: 'trendingUp', color: '#fb923c' },
  'Other':           { iconName: 'sparkle',    color: '#94a3b8' },
};

export const PLATFORM_CATEGORIES = Object.keys(PLATFORM_META);

export function platformMeta(category) {
  const m = PLATFORM_META[category] || PLATFORM_META['Other'];
  return { ...m, bg: hexToRgba(m.color, 0.13) };
}

export async function renderPlatforms() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('platforms')}
    <div class="main-content">
      ${renderTopbar('Expenses', { addLabel: 'Add Platform', addHash: '/platforms/add' })}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Expenses</h1>
          <p class="page-desc">Platforms & services powering your assets</p>
        </div>
        <div class="stats-grid">${Array(3).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
        <div class="assets-grid">${Array(3).fill('<div class="skeleton skeleton-card" style="height:150px"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let platforms = [];
  try { platforms = await getPlatforms(); } catch (err) { console.error(err); }
  buildPlatformsPage(platforms, 'All');
}

function buildPlatformsPage(platforms, activeFilter) {
  const totalCost = platforms.reduce((s, p) => s + num(p.monthlyCost), 0);
  const filtered = activeFilter === 'All' ? platforms : platforms.filter(p => p.category === activeFilter);

  const counts = {};
  platforms.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const chips = ['All', ...PLATFORM_CATEGORIES.filter(c => counts[c])];

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Expenses</h1>
      <p class="page-desc">Platforms &amp; services powering your assets</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon purple">${icon('server', 19)}</div>
        <div class="stat-label">Total Platforms</div>
        <div class="stat-value">${platforms.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">${icon('wallet', 19)}</div>
        <div class="stat-label">Monthly Cost</div>
        <div class="stat-value" style="color:var(--red)">${formatCurrency(totalCost)}</div>
        <div class="stat-sub">Recurring per month</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">${icon('calendar', 19)}</div>
        <div class="stat-label">Yearly Cost</div>
        <div class="stat-value">${formatCurrency(totalCost * 12)}</div>
        <div class="stat-sub">Annualized</div>
      </div>
    </div>

    ${platforms.length > 0 ? `
    <div class="filters-bar">
      ${chips.map(cat => `
        <button class="filter-chip ${activeFilter === cat ? 'active' : ''}" data-filter="${escAttr(cat)}">
          ${cat}<span class="chip-count">${cat === 'All' ? platforms.length : counts[cat]}</span>
        </button>`).join('')}
    </div>` : ''}

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">${icon('server', 28)}</div>
        <div class="empty-title">${activeFilter === 'All' ? 'No platforms yet' : `No ${activeFilter} platforms`}</div>
        <div class="empty-desc">Add the tools and services you pay for to keep your assets running.</div>
        <a href="#/platforms/add" class="btn btn-primary">${icon('plus', 16)} Add Platform</a>
      </div>
    ` : `
      <div class="assets-grid">${filtered.map(platformCard).join('')}</div>
    `}
  `;

  content.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => buildPlatformsPage(platforms, btn.dataset.filter));
  });
  content.querySelectorAll('[data-delete-platform]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(btn.dataset.deletePlatform, btn.dataset.name, platforms, activeFilter);
    });
  });
}

function platformCard(p) {
  const meta = platformMeta(p.category);
  return `
    <div class="asset-card" style="cursor:default">
      <div class="asset-card-header">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0">
          <div class="asset-card-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 21)}</div>
          <div style="min-width:0">
            <div class="asset-card-name">${escHtml(p.name)}</div>
            <div class="badge badge-category">${p.category}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <a href="#/platforms/${p.id}/edit" class="btn btn-ghost btn-sm btn-icon" title="Edit">${icon('edit', 15)}</a>
          <button class="btn btn-danger btn-sm btn-icon" data-delete-platform="${p.id}" data-name="${escAttr(p.name)}" title="Delete">${icon('trash', 15)}</button>
        </div>
      </div>
      ${p.description ? `<div class="asset-card-desc">${escHtml(p.description)}</div>` : ''}
      <div class="asset-card-meta">
        <div class="asset-meta-item">
          <div class="asset-meta-label">Monthly Cost</div>
          <div class="asset-meta-value" style="color:var(--red)">${formatCurrency(num(p.monthlyCost))}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Yearly Cost</div>
          <div class="asset-meta-value">${formatCurrency(num(p.monthlyCost) * 12)}</div>
        </div>
      </div>
      ${p.website ? `
        <a href="${normalizeUrl(p.website)}" target="_blank" rel="noopener noreferrer"
           style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--accent-light);text-decoration:none;font-weight:500"
           onclick="event.stopPropagation()">
          ${icon('external', 13)} ${escHtml(displayUrl(p.website))}
        </a>` : ''}
    </div>`;
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
        <button class="btn btn-danger" id="confirm-del">${icon('trash', 15)} Remove</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-del').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-del').addEventListener('click', async () => {
    try {
      await deletePlatform(id);
      overlay.remove();
      toast('Platform removed', 'success');
      buildPlatformsPage(platforms.filter(p => p.id !== id), filter);
    } catch {
      toast('Failed to remove platform', 'error');
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const num = (v) => Number(v) || 0;
function normalizeUrl(url) { return /^https?:\/\//.test(url) ? url : 'https://' + url; }
function displayUrl(url) { return url.replace(/^https?:\/\//, '').replace(/\/$/, ''); }
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
