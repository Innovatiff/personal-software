import { getAssets } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, statusBadge, formatCurrency, CATEGORIES } from '../utils.js';

export async function renderAssets() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('assets')}
    <div class="main-content">
      ${renderTopbar('My Assets')}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">My Assets</h1>
          <p class="page-desc">All your passive income sources in one place</p>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)">
          Loading…
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let assets = [];
  try {
    assets = await getAssets();
  } catch (err) {
    console.error(err);
  }

  renderAssetList(assets, 'All');
}

function renderAssetList(assets, activeFilter, sortKey = 'newest') {
  let filtered = assets;

  if (activeFilter !== 'All') {
    filtered = assets.filter(a => a.category === activeFilter);
  }

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortKey === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    if (sortKey === 'income-high') return (Number(b.monthlyIncome) || 0) - (Number(a.monthlyIncome) || 0);
    if (sortKey === 'income-low') return (Number(a.monthlyIncome) || 0) - (Number(b.monthlyIncome) || 0);
    if (sortKey === 'invest-high') return (Number(b.totalCost) || 0) - (Number(a.totalCost) || 0);
    return 0;
  });

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Assets</h1>
      <p class="page-desc">${assets.length} asset${assets.length !== 1 ? 's' : ''} tracked</p>
    </div>

    <div class="filters-bar">
      ${['All', ...CATEGORIES].map(cat => `
        <button class="filter-chip ${activeFilter === cat ? 'active' : ''}" data-filter="${cat}">${cat}</button>
      `).join('')}
      <select class="sort-select" id="sort-select">
        <option value="newest" ${sortKey === 'newest' ? 'selected' : ''}>Newest first</option>
        <option value="oldest" ${sortKey === 'oldest' ? 'selected' : ''}>Oldest first</option>
        <option value="income-high" ${sortKey === 'income-high' ? 'selected' : ''}>Highest income</option>
        <option value="income-low" ${sortKey === 'income-low' ? 'selected' : ''}>Lowest income</option>
        <option value="invest-high" ${sortKey === 'invest-high' ? 'selected' : ''}>Highest investment</option>
      </select>
    </div>

    ${sorted.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
        <div class="empty-title">${activeFilter === 'All' ? 'No passive assets yet' : `No ${activeFilter} assets`}</div>
        <div class="empty-desc">${activeFilter === 'All'
          ? "You don't have any passive assets yet. Add your first one."
          : `You don't have any ${activeFilter} assets. Try adding one.`}</div>
        <a href="#/assets/add" class="btn btn-primary">+ Add Asset</a>
      </div>
    ` : `
      <div class="assets-grid">
        ${sorted.map(asset => assetCard(asset)).join('')}
      </div>
    `}
  `;

  // Bind filters
  content.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      const sort = document.getElementById('sort-select')?.value || 'newest';
      renderAssetList(assets, filter, sort);
    });
  });

  content.querySelector('#sort-select')?.addEventListener('change', (e) => {
    renderAssetList(assets, activeFilter, e.target.value);
  });
}

function assetCard(asset) {
  const meta = categoryMeta(asset.category);
  return `
    <div class="asset-card" onclick="location.hash='#/assets/${asset.id}'">
      <div class="asset-card-header">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0">
          <div class="asset-card-icon" style="background:${meta.bg}">${meta.icon}</div>
          <div style="min-width:0">
            <div class="asset-card-name">${escHtml(asset.name)}</div>
            <div class="badge badge-category">${asset.category}</div>
          </div>
        </div>
        ${statusBadge(asset.status)}
      </div>
      ${asset.description ? `<div class="asset-card-desc">${escHtml(asset.description)}</div>` : ''}
      <div class="asset-card-meta">
        <div class="asset-meta-item">
          <div class="asset-meta-label">Monthly</div>
          <div class="asset-meta-value green">${formatCurrency(Number(asset.monthlyIncome) || 0)}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Invested</div>
          <div class="asset-meta-value">${formatCurrency(Number(asset.totalCost) || 0)}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Yearly</div>
          <div class="asset-meta-value">${formatCurrency((Number(asset.monthlyIncome) || 0) * 12)}</div>
        </div>
      </div>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
