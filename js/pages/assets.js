import { getAssets } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, statusBadge, formatCurrency, CATEGORIES } from '../utils.js';
import { icon } from '../icons.js';

let _all = [];
let _state = { filter: 'All', sort: 'newest', search: '' };

export async function renderAssets() {
  const app = document.getElementById('app');
  _state = { filter: 'All', sort: 'newest', search: '' };

  app.innerHTML = `
    ${renderSidebar('assets')}
    <div class="main-content">
      ${renderTopbar('My Assets')}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">My Assets</h1>
          <p class="page-desc">All your passive income sources in one place</p>
        </div>
        <div class="assets-grid">
          ${Array(6).fill('<div class="skeleton skeleton-card" style="height:150px"></div>').join('')}
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try {
    _all = await getAssets();
  } catch (err) {
    console.error(err);
    _all = [];
  }

  renderList();
}

function renderList() {
  const { filter, sort, search } = _state;

  let filtered = _all;
  if (filter !== 'All') filtered = filtered.filter(a => a.category === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q));
  }

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'newest': return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case 'oldest': return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      case 'income-high': return num(b.monthlyIncome) - num(a.monthlyIncome);
      case 'income-low': return num(a.monthlyIncome) - num(b.monthlyIncome);
      case 'invest-high': return num(b.totalCost) - num(a.totalCost);
      default: return 0;
    }
  });

  // Only show category chips that have assets (plus All)
  const counts = {};
  _all.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
  const chips = ['All', ...CATEGORIES.filter(c => counts[c])];

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">My Assets</h1>
        <p class="page-desc">${_all.length} asset${_all.length !== 1 ? 's' : ''} tracked</p>
      </div>
      <div class="search-wrap">
        ${icon('search', 16)}
        <input class="search-input" id="asset-search" type="text" placeholder="Search assets…" value="${escAttr(search)}" />
      </div>
    </div>

    <div class="filters-bar">
      ${chips.map(cat => `
        <button class="filter-chip ${filter === cat ? 'active' : ''}" data-filter="${escAttr(cat)}">
          ${cat}
          <span class="chip-count">${cat === 'All' ? _all.length : counts[cat]}</span>
        </button>
      `).join('')}
      <select class="sort-select" id="sort-select">
        <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest first</option>
        <option value="oldest" ${sort === 'oldest' ? 'selected' : ''}>Oldest first</option>
        <option value="income-high" ${sort === 'income-high' ? 'selected' : ''}>Highest income</option>
        <option value="income-low" ${sort === 'income-low' ? 'selected' : ''}>Lowest income</option>
        <option value="invest-high" ${sort === 'invest-high' ? 'selected' : ''}>Highest investment</option>
      </select>
    </div>

    ${sorted.length === 0 ? emptyState(filter, search) : `
      <div class="assets-grid">${sorted.map(assetCard).join('')}</div>
    `}
  `;

  // Bind events
  content.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => { _state.filter = btn.dataset.filter; renderList(); });
  });
  content.querySelector('#sort-select')?.addEventListener('change', (e) => {
    _state.sort = e.target.value; renderList();
  });
  const searchEl = content.querySelector('#asset-search');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => { _state.search = e.target.value; renderList(); });
    // Keep focus + caret after re-render
    searchEl.focus();
    const len = searchEl.value.length;
    searchEl.setSelectionRange(len, len);
  }
}

function emptyState(filter, search) {
  const msg = search.trim()
    ? `No assets match "${escHtml(search)}".`
    : filter === 'All'
      ? "You don't have any passive assets yet. Add your first one."
      : `You don't have any ${filter} assets yet.`;
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(search.trim() ? 'search' : 'layers', 28)}</div>
      <div class="empty-title">${filter === 'All' && !search.trim() ? 'No passive assets yet' : 'Nothing found'}</div>
      <div class="empty-desc">${msg}</div>
      <a href="#/assets/add" class="btn btn-primary">${icon('plus', 16)} Add Asset</a>
    </div>`;
}

function assetCard(asset) {
  const meta = categoryMeta(asset.category);
  return `
    <div class="asset-card" onclick="location.hash='#/assets/${asset.id}'">
      <div class="asset-card-header">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0">
          <div class="asset-card-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 21)}</div>
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
          <div class="asset-meta-value green">${formatCurrency(num(asset.monthlyIncome))}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Invested</div>
          <div class="asset-meta-value">${formatCurrency(num(asset.totalCost))}</div>
        </div>
        <div class="asset-meta-item">
          <div class="asset-meta-label">Yearly</div>
          <div class="asset-meta-value">${formatCurrency(num(asset.monthlyIncome) * 12)}</div>
        </div>
      </div>
    </div>`;
}

const num = (v) => Number(v) || 0;

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
