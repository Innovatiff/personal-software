import { getBusinesses, getAssets, getPlatforms } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { auth } from '../firebase-config.js';
import {
  formatCurrency, computeMRR, serviceMeta, businessStatusBadge,
  isThisMonth, BUSINESS_STATUSES
} from '../utils.js';
import { icon } from '../icons.js';

export async function renderDashboard() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <div class="main-content">
      ${renderTopbar('Dashboard', { addLabel: 'Add Business', addHash: '/businesses/add' })}
      <div class="page-content">
        ${headerHtml()}
        <div class="kpi-grid">${Array(4).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
        <div class="dash-row r2">
          <div class="skeleton" style="height:280px;border-radius:var(--radius-lg)"></div>
          <div class="skeleton" style="height:280px;border-radius:var(--radius-lg)"></div>
          <div class="skeleton" style="height:280px;border-radius:var(--radius-lg)"></div>
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let businesses = [], assets = [], platforms = [];
  try {
    [businesses, assets, platforms] = await Promise.all([
      getBusinesses(), getAssets(), getPlatforms()
    ]);
  } catch (err) { console.error(err); }

  build(businesses, assets, platforms);
}

function headerHtml() {
  const name = auth.currentUser?.displayName?.split(' ')[0] || 'there';
  return `
    <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-desc">Welcome back, ${name} — here's your revenue at a glance</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a href="#/businesses" class="btn btn-secondary">${icon('building2', 16)} View Clients</a>
      </div>
    </div>`;
}

function build(businesses, assets, platforms) {
  const activeBiz = businesses.filter(b => b.status === 'Active');
  const activeMRR = activeBiz.reduce((s, b) => s + computeMRR(b.price, b.period, b.users), 0);
  const setupThisMonth = businesses.filter(b => isThisMonth(b.createdAt)).reduce((s, b) => s + num(b.setupFee), 0);
  const totalThisMonth = activeMRR + setupThisMonth;
  const yearly = activeMRR * 12;

  const assetMonthly = assets.reduce((s, a) => s + num(a.monthlyIncome), 0);
  const expenses = platforms.reduce((s, p) => s + num(p.monthlyCost), 0);
  const netThisMonth = totalThisMonth + assetMonthly - expenses;

  // counts by status
  const counts = {};
  BUSINESS_STATUSES.forEach(s => { counts[s] = businesses.filter(b => b.status === s).length; });
  const activeRate = businesses.length ? Math.round((counts['Active'] / businesses.length) * 100) : 0;

  // top clients by MRR (for bars)
  const ranked = [...businesses]
    .map(b => ({ ...b, _mrr: computeMRR(b.price, b.period, b.users) }))
    .filter(b => b._mrr > 0)
    .sort((a, b) => b._mrr - a._mrr);
  const topBars = ranked.slice(0, 7);
  const maxMRR = topBars.length ? topBars[0]._mrr : 0;

  const recent = [...businesses].slice(0, 5);

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    ${headerHtml()}

    <div class="kpi-grid">
      ${kpiCard({ feature: true, label: 'Total Businesses', value: businesses.length,
        chip: `${counts['Active']} active`, arrow: '/businesses' })}
      ${kpiCard({ label: 'Recurring MRR', value: formatCurrency(activeMRR), sub: 'Active clients / month', arrow: '/businesses' })}
      ${kpiCard({ label: 'Made This Month', value: formatCurrency(totalThisMonth), sub: 'MRR + setup fees', arrow: '/monthly' })}
      ${kpiCard({ label: 'Yearly Projection', value: formatCurrency(yearly), sub: 'Recurring × 12', arrow: '/monthly' })}
    </div>

    <div class="dash-row r2">
      <!-- Revenue analytics -->
      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Revenue Analytics</div>
            <div class="section-sub">Monthly recurring revenue by client</div>
          </div>
        </div>
        ${topBars.length ? revBars(topBars, maxMRR, activeMRR) : miniEmpty('barChart', 'No revenue yet')}
      </div>

      <!-- This month -->
      <div class="best-asset-card" style="display:flex;flex-direction:column">
        <div class="best-asset-label">${icon('wallet', 14)} This Month</div>
        <div class="best-asset-income" style="font-size:32px">${formatCurrency(totalThisMonth)}</div>
        <div style="margin:16px 0;display:flex;flex-direction:column;gap:10px">
          ${lineItem('Recurring MRR', formatCurrency(activeMRR))}
          ${lineItem('Setup fees', formatCurrency(setupThisMonth))}
          ${lineItem('Net (incl. assets − expenses)', formatCurrency(netThisMonth), netThisMonth >= 0 ? 'var(--green)' : 'var(--red)')}
        </div>
        <a href="#/businesses/add" class="btn btn-primary btn-full" style="margin-top:auto">${icon('plus', 16)} Add Business</a>
      </div>

      <!-- Recent businesses -->
      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Recent Clients</div>
            <div class="section-sub">Latest additions</div>
          </div>
          ${businesses.length ? `<a href="#/businesses" class="kpi-arrow">${icon('arrowUpRight', 16)}</a>` : ''}
        </div>
        ${recent.length ? `<div class="mini-list">${recent.map(recentItem).join('')}</div>`
          : miniEmpty('building2', 'No clients yet')}
      </div>
    </div>

    <div class="dash-row r3">
      <!-- Client status breakdown -->
      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Client Status</div>
            <div class="section-sub">Breakdown by stage</div>
          </div>
        </div>
        ${businesses.length ? statusBreakdown(counts, businesses.length) : miniEmpty('users', 'No clients yet')}
      </div>

      <!-- Active rate gauge -->
      <div class="chart-card" style="display:flex;flex-direction:column">
        <div class="section-title" style="margin-bottom:4px">Active Rate</div>
        <div class="section-sub">Share of active clients</div>
        <div class="gauge" style="--v:${activeRate}">
          <div class="gauge-label">
            <div class="gauge-value">${activeRate}%</div>
            <div class="gauge-sub">${counts['Active']} of ${businesses.length}</div>
          </div>
        </div>
        <div class="gauge-legend">
          <span><i style="background:var(--accent)"></i> Active</span>
          <span><i style="background:rgba(255,255,255,0.1)"></i> Other</span>
        </div>
      </div>

      <!-- Projected yearly -->
      <div class="dark-card">
        <div class="dark-card-label">${icon('trendingUp', 14)} Projected Yearly</div>
        <div class="dark-card-value">${formatCurrency(yearly)}</div>
        <div class="dark-card-sub">Based on current recurring revenue</div>
      </div>
    </div>

    <!-- Portfolio tie-in -->
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-top:8px">
      ${snapshot('layers', 'purple', 'Assets', `${assets.length}`, `${formatCurrency(assetMonthly)} / mo income`, '/assets')}
      ${snapshot('server', 'red', 'Expenses', `${platforms.length}`, `${formatCurrency(expenses)} / mo cost`, '/platforms')}
      ${snapshot('wallet', 'green', 'Net This Month', formatCurrency(netThisMonth), 'Revenue − expenses', '/monthly', netThisMonth >= 0 ? 'green' : '')}
    </div>
  `;
}

function kpiCard({ feature, label, value, sub, chip, arrow }) {
  return `
    <div class="kpi-card ${feature ? 'feature' : ''}">
      <div class="kpi-top">
        <div class="kpi-label">${label}</div>
        <a href="#${arrow}" class="kpi-arrow">${icon('arrowUpRight', 16)}</a>
      </div>
      <div class="kpi-value num">${value}</div>
      <div class="kpi-delta ${chip ? '' : ''}">
        ${chip ? `<span class="kpi-chip">${icon('trendingUp', 12)} ${chip}</span>` : sub || ''}
      </div>
    </div>`;
}

function revBars(bars, maxMRR, totalMRR) {
  return `
    <div class="revbars">
      ${bars.map((b, i) => {
        const h = maxMRR ? Math.max(8, (b._mrr / maxMRR) * 100) : 8;
        const isTop = i === 0;
        const cls = isTop ? 'hi' : (i % 2 === 0 ? '' : 'striped');
        const share = totalMRR ? Math.round((b._mrr / totalMRR) * 100) : 0;
        return `
          <div class="revbar-col" title="${escAttr(b.name)} · ${formatCurrency(b._mrr)}/mo">
            <div class="revbar ${cls}" style="height:${h}%">
              ${isTop ? `<div class="revbar-pill">${share}%</div>` : ''}
            </div>
            <div class="revbar-label">${escHtml(shortName(b.name))}</div>
          </div>`;
      }).join('')}
    </div>`;
}

function statusBreakdown(counts, total) {
  const rows = [
    { label: 'Active', color: 'var(--green)', n: counts['Active'] || 0 },
    { label: 'Building', color: 'var(--yellow)', n: counts['Building'] || 0 },
    { label: 'Inactive', color: 'var(--text-muted)', n: counts['Inactive'] || 0 },
  ];
  return `
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:6px">
      ${rows.map(r => {
        const pct = total ? (r.n / total) * 100 : 0;
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
              <span style="font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px">
                <i style="width:9px;height:9px;border-radius:3px;background:${r.color};display:inline-block"></i>${r.label}
              </span>
              <span class="num" style="font-size:13px;font-weight:700">${r.n}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${r.color}"></div></div>
          </div>`;
      }).join('')}
    </div>`;
}

function recentItem(b) {
  const meta = serviceMeta(b.service);
  const mrr = computeMRR(b.price, b.period, b.users);
  return `
    <a class="mini-item" href="#/businesses/${b.id}/edit">
      <div class="mini-avatar" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 19)}</div>
      <div class="mini-main">
        <div class="mini-title">${escHtml(b.name)}</div>
        <div class="mini-sub">${b.service || '—'} · ${formatCurrency(mrr)}/mo</div>
      </div>
      <div class="mini-right">${businessStatusBadge(b.status)}</div>
    </a>`;
}

function snapshot(ic, color, label, value, sub, href, valueClass = '') {
  return `
    <a class="stat-card" href="#${href}" style="text-decoration:none;color:inherit;display:block">
      <div class="stat-icon ${color}">${icon(ic, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value ${valueClass}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </a>`;
}

function lineItem(label, value, color) {
  return `
    <div style="display:flex;justify-content:space-between;font-size:13px">
      <span style="color:var(--text-secondary)">${label}</span>
      <span class="num" style="font-weight:700;${color ? `color:${color}` : ''}">${value}</span>
    </div>`;
}

function miniEmpty(ic, msg) {
  return `
    <div class="empty-state" style="padding:34px 0">
      <div class="empty-icon" style="width:48px;height:48px;border-radius:14px">${icon(ic, 22)}</div>
      <div class="empty-desc" style="margin:0">${msg}</div>
    </div>`;
}

// helpers
const num = (v) => Number(v) || 0;
function shortName(name) {
  if (!name) return '—';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 6);
}
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str || '').replace(/'/g, '&#39;'); }
