import { getAssets } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { auth } from '../firebase-config.js';
import { categoryMeta, statusBadge, formatCurrency, categoryIcon } from '../utils.js';

export async function renderDashboard() {
  const app = document.getElementById('app');
  const user = auth.currentUser;

  // Show skeleton while loading
  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <div class="main-content">
      ${renderTopbar('Dashboard')}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Good ${greeting()}, ${user?.displayName?.split(' ')[0] || 'there'} 👋</h1>
          <p class="page-desc">Here's your passive income overview</p>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)">
          Loading…
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try {
    const assets = await getAssets();
    buildDashboard(assets);
  } catch (err) {
    console.error(err);
  }
}

function buildDashboard(assets) {
  const totalInvested = assets.reduce((s, a) => s + (Number(a.totalCost) || 0), 0);
  const totalMonthly = assets.reduce((s, a) => s + (Number(a.monthlyIncome) || 0), 0);
  const totalYearly = totalMonthly * 12;
  const activeAssets = assets.filter(a => a.status === 'Active');
  const roi = totalInvested > 0 ? ((totalYearly / totalInvested) * 100).toFixed(1) : 0;
  const best = [...assets].sort((a, b) => (Number(b.monthlyIncome) || 0) - (Number(a.monthlyIncome) || 0))[0];

  // Category breakdown
  const categories = {};
  assets.forEach(a => {
    if (!categories[a.category]) categories[a.category] = { count: 0, income: 0 };
    categories[a.category].count++;
    categories[a.category].income += Number(a.monthlyIncome) || 0;
  });

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Good ${greeting()}, ${auth.currentUser?.displayName?.split(' ')[0] || 'there'} 👋</h1>
      <p class="page-desc">Here's your passive income overview</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon purple">◆</div>
        <div class="stat-label">Total Assets</div>
        <div class="stat-value">${assets.length}</div>
        <div class="stat-sub">${activeAssets.length} active</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">$</div>
        <div class="stat-label">Monthly Income</div>
        <div class="stat-value green">${formatCurrency(totalMonthly)}</div>
        <div class="stat-sub">Per month</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">↑</div>
        <div class="stat-label">Yearly Projection</div>
        <div class="stat-value accent">${formatCurrency(totalYearly)}</div>
        <div class="stat-sub">Annualized</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⬡</div>
        <div class="stat-label">Total Invested</div>
        <div class="stat-value">${formatCurrency(totalInvested)}</div>
        <div class="stat-sub">Capital deployed</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">%</div>
        <div class="stat-label">Portfolio ROI</div>
        <div class="stat-value accent">${roi}%</div>
        <div class="stat-sub">Annual return</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✓</div>
        <div class="stat-label">Active Assets</div>
        <div class="stat-value">${activeAssets.length}</div>
        <div class="stat-sub">Currently running</div>
      </div>
    </div>

    <!-- Best Asset + Chart Row -->
    <div class="grid-2 mb-24">
      ${best ? `
      <div class="best-asset-card">
        <div class="best-asset-label">⭐ Best Performer</div>
        <div class="best-asset-name">${best.name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">${best.category}</div>
        <div class="best-asset-income">${formatCurrency(Number(best.monthlyIncome) || 0)} <span>/month</span></div>
      </div>` : `
      <div class="best-asset-card">
        <div class="best-asset-label">⭐ Best Performer</div>
        <div class="best-asset-name" style="color:var(--text-muted)">No assets yet</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:8px">Add your first passive asset to see your best performer</div>
      </div>`}

      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Income by Category</div>
            <div class="section-sub">Monthly breakdown</div>
          </div>
        </div>
        ${Object.keys(categories).length > 0
          ? `<canvas id="category-chart"></canvas>`
          : `<div class="empty-state" style="padding:30px">
               <div class="empty-icon" style="font-size:28px">📊</div>
               <div class="empty-desc" style="margin:0">No data yet</div>
             </div>`
        }
      </div>
    </div>

    <!-- Recent Assets -->
    <div class="section-header">
      <div>
        <div class="section-title">Recent Assets</div>
        <div class="section-sub">Your latest passive income sources</div>
      </div>
      <a href="#/assets" class="btn btn-secondary btn-sm">View all</a>
    </div>

    ${assets.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
        <div class="empty-title">No passive assets yet</div>
        <div class="empty-desc">You don't have any passive assets yet. Add your first one to start tracking your income.</div>
        <a href="#/assets/add" class="btn btn-primary">+ Add First Asset</a>
      </div>
    ` : `
      <div class="assets-grid">
        ${assets.slice(0, 6).map(asset => assetCard(asset)).join('')}
      </div>
    `}
  `;

  // Render chart
  if (Object.keys(categories).length > 0) {
    const canvas = document.getElementById('category-chart');
    if (canvas) renderCategoryChart(canvas, categories);
  }
}

function assetCard(asset) {
  const meta = categoryMeta(asset.category);
  return `
    <div class="asset-card" onclick="location.hash='#/assets/${asset.id}'">
      <div class="asset-card-header">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0">
          <div class="asset-card-icon" style="background:${meta.bg}">${meta.icon}</div>
          <div style="min-width:0">
            <div class="asset-card-name">${asset.name}</div>
            <div class="badge badge-category">${asset.category}</div>
          </div>
        </div>
        ${statusBadge(asset.status)}
      </div>
      ${asset.description ? `<div class="asset-card-desc">${asset.description}</div>` : ''}
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

function renderCategoryChart(canvas, categories) {
  const labels = Object.keys(categories);
  const data = labels.map(k => categories[k].income);
  const colors = ['#7c5cfc','#22c55e','#3b82f6','#f59e0b','#ef4444','#a855f7'];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` $${ctx.raw.toLocaleString()}/mo`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8888a8', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8888a8',
            font: { size: 11 },
            callback: v => '$' + v.toLocaleString()
          }
        }
      }
    }
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
