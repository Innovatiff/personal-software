import { getAssets, getPlatforms } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { auth } from '../firebase-config.js';
import { categoryMeta, statusBadge, formatCurrency } from '../utils.js';
import { icon } from '../icons.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const user = auth.currentUser;
  const firstName = user?.displayName?.split(' ')[0] || 'there';

  // Shell + skeletons while loading
  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <div class="main-content">
      ${renderTopbar('Dashboard')}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Good ${greeting()}, ${firstName}</h1>
          <p class="page-desc">Here's your passive income overview</p>
        </div>
        <div class="stats-grid">
          ${Array(6).fill('<div class="skeleton skeleton-card"></div>').join('')}
        </div>
        <div class="grid-2 mb-24" style="margin-bottom:24px">
          <div class="skeleton" style="height:200px;border-radius:var(--radius-lg)"></div>
          <div class="skeleton" style="height:200px;border-radius:var(--radius-lg)"></div>
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try {
    const [assets, platforms] = await Promise.all([getAssets(), getPlatforms()]);
    buildDashboard(assets, platforms);
  } catch (err) {
    console.error(err);
  }
}

function buildDashboard(assets, platforms) {
  const firstName = auth.currentUser?.displayName?.split(' ')[0] || 'there';

  const totalInvested = sum(assets, 'totalCost');
  const totalMonthly = sum(assets, 'monthlyIncome');
  const totalExpenses = sum(platforms, 'monthlyCost');
  const netMonthly = totalMonthly - totalExpenses;
  const totalYearly = netMonthly * 12;
  const activeAssets = assets.filter(a => a.status === 'Active');
  const roi = totalInvested > 0 ? ((netMonthly * 12 / totalInvested) * 100).toFixed(1) : 0;
  const best = [...assets].sort((a, b) => num(b.monthlyIncome) - num(a.monthlyIncome))[0];

  // Category breakdown for the chart
  const categories = {};
  assets.forEach(a => {
    if (!categories[a.category]) categories[a.category] = { count: 0, income: 0 };
    categories[a.category].count++;
    categories[a.category].income += num(a.monthlyIncome);
  });
  const catEntries = Object.entries(categories).sort((a, b) => b[1].income - a[1].income);

  const statCard = (ic, color, label, value, sub, valueClass = '') => `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon(ic, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value ${valueClass}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Good ${greeting()}, ${firstName}</h1>
      <p class="page-desc">Here's your passive income overview</p>
    </div>

    <div class="stats-grid">
      ${statCard('layers', 'purple', 'Total Assets', assets.length, `${activeAssets.length} active`)}
      ${statCard('trendingUp', 'green', 'Monthly Income', formatCurrency(totalMonthly), 'Gross per month', 'green')}
      ${statCard('wallet', 'red', 'Net Monthly', formatCurrency(netMonthly), `after ${formatCurrency(totalExpenses)} costs`, netMonthly >= 0 ? 'green' : '')}
      ${statCard('activity', 'blue', 'Yearly Projection', formatCurrency(totalYearly), 'Net annualized', 'accent')}
      ${statCard('dollar', 'yellow', 'Total Invested', formatCurrency(totalInvested), 'Capital deployed')}
      ${statCard('percent', 'purple', 'Net ROI', roi + '%', 'Annual return', 'accent')}
    </div>

    <div class="grid-2" style="margin-bottom:24px">
      ${best ? bestAssetCard(best) : emptyBestCard()}

      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Income by Category</div>
            <div class="section-sub">Monthly breakdown across categories</div>
          </div>
        </div>
        ${catEntries.length > 0 ? categoryBars(catEntries, totalMonthly) : `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-icon" style="width:48px;height:48px;border-radius:14px">${icon('pie', 22)}</div>
            <div class="empty-desc" style="margin:0">No income data yet</div>
          </div>`}
      </div>
    </div>

    <div class="section-header">
      <div>
        <div class="section-title">Recent Assets</div>
        <div class="section-sub">Your latest passive income sources</div>
      </div>
      ${assets.length > 0 ? `<a href="#/assets" class="btn btn-secondary btn-sm">View all</a>` : ''}
    </div>

    ${assets.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">${icon('layers', 28)}</div>
        <div class="empty-title">No passive assets yet</div>
        <div class="empty-desc">You don't have any passive assets yet. Add your first one to start tracking your income.</div>
        <a href="#/assets/add" class="btn btn-primary">${icon('plus', 16)} Add First Asset</a>
      </div>
    ` : `
      <div class="assets-grid">
        ${assets.slice(0, 6).map(assetCard).join('')}
      </div>
    `}
  `;
}

function categoryBars(entries, total) {
  const top = entries.slice(0, 6);
  return `
    <div style="display:flex;flex-direction:column;gap:13px;margin-top:4px">
      ${top.map(([cat, data]) => {
        const meta = categoryMeta(cat);
        const pct = total > 0 ? (data.income / total) * 100 : 0;
        return `
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
              <div style="display:flex;align-items:center;gap:9px;min-width:0">
                <span style="color:${meta.color};display:flex">${icon(meta.iconName, 15)}</span>
                <span style="font-size:13px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat}</span>
              </div>
              <span class="num" style="font-size:13px;font-weight:700;flex-shrink:0">${formatCurrency(data.income)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:${meta.color}"></div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function bestAssetCard(best) {
  const meta = categoryMeta(best.category);
  return `
    <div class="best-asset-card">
      <div class="best-asset-label">${icon('star', 14, { fill: 'currentColor' })} Best Performer</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div class="asset-card-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 21)}</div>
        <div style="min-width:0">
          <div class="best-asset-name">${escHtml(best.name)}</div>
          <div style="font-size:13px;color:var(--text-muted)">${best.category}</div>
        </div>
      </div>
      <div class="best-asset-income">${formatCurrency(num(best.monthlyIncome))} <span>/ month</span></div>
      <div style="margin-top:6px;font-size:13px;color:var(--text-secondary)">
        ${formatCurrency(num(best.monthlyIncome) * 12)} projected yearly
      </div>
    </div>`;
}

function emptyBestCard() {
  return `
    <div class="best-asset-card">
      <div class="best-asset-label">${icon('star', 14)} Best Performer</div>
      <div class="best-asset-name" style="color:var(--text-muted)">No assets yet</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:8px">Add your first passive asset to see your top performer here.</div>
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

// helpers
const num = (v) => Number(v) || 0;
const sum = (arr, key) => arr.reduce((s, x) => s + num(x[key]), 0);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
