import { getAssets } from '../db.js';
import { getPlatforms } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, formatCurrency, statusBadge } from '../utils.js';
import { PLATFORM_ICONS, PLATFORM_COLORS } from './platforms.js';

export async function renderMonthly() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('monthly')}
    <div class="main-content">
      ${renderTopbar('Monthly Overview')}
      <div class="page-content">
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)">
          Loading…
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let assets = [], platforms = [];
  try {
    [assets, platforms] = await Promise.all([getAssets(), getPlatforms()]);
  } catch (err) {
    console.error(err);
  }

  buildMonthlyPage(assets, platforms);
}

function buildMonthlyPage(assets, platforms) {
  const totalEarnings = assets.reduce((s, a) => s + (Number(a.monthlyIncome) || 0), 0);
  const totalExpenses = platforms.reduce((s, p) => s + (Number(p.monthlyCost) || 0), 0);
  const netIncome = totalEarnings - totalExpenses;
  const invested = assets.reduce((s, a) => s + (Number(a.totalCost) || 0), 0);
  const netYearly = netIncome * 12;
  const roi = invested > 0 ? ((netYearly / invested) * 100).toFixed(1) : null;

  // Top assets by income
  const topAssets = [...assets]
    .filter(a => Number(a.monthlyIncome) > 0)
    .sort((a, b) => (Number(b.monthlyIncome) || 0) - (Number(a.monthlyIncome) || 0))
    .slice(0, 8);

  // Top platforms by cost
  const topPlatforms = [...platforms]
    .sort((a, b) => (Number(b.monthlyCost) || 0) - (Number(a.monthlyCost) || 0));

  // Earnings by category
  const earningsByCategory = {};
  assets.forEach(a => {
    if (!earningsByCategory[a.category]) earningsByCategory[a.category] = 0;
    earningsByCategory[a.category] += Number(a.monthlyIncome) || 0;
  });

  // Expenses by category
  const expensesByCategory = {};
  platforms.forEach(p => {
    if (!expensesByCategory[p.category]) expensesByCategory[p.category] = 0;
    expensesByCategory[p.category] += Number(p.monthlyCost) || 0;
  });

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Monthly Overview</h1>
      <p class="page-desc">Your complete financial picture for this month</p>
    </div>

    <!-- Top-level summary cards -->
    <div class="stats-grid" style="margin-bottom:28px">
      <div class="stat-card" style="animation-delay:0.05s">
        <div class="stat-icon green">↑</div>
        <div class="stat-label">Monthly Earnings</div>
        <div class="stat-value green">${formatCurrency(totalEarnings)}</div>
        <div class="stat-sub">From ${assets.length} asset${assets.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card" style="animation-delay:0.1s">
        <div class="stat-icon red">↓</div>
        <div class="stat-label">Monthly Expenses</div>
        <div class="stat-value" style="color:var(--red)">${formatCurrency(totalExpenses)}</div>
        <div class="stat-sub">From ${platforms.length} platform${platforms.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card" style="animation-delay:0.15s;border-color:${netIncome >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}">
        <div class="stat-icon ${netIncome >= 0 ? 'green' : 'red'}">${netIncome >= 0 ? '✓' : '!'}</div>
        <div class="stat-label">Net Monthly Income</div>
        <div class="stat-value" style="color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">${formatCurrency(Math.abs(netIncome))}</div>
        <div class="stat-sub" style="color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${netIncome >= 0 ? 'Profit' : 'Running at a loss'}
        </div>
      </div>
      <div class="stat-card" style="animation-delay:0.2s">
        <div class="stat-icon blue">◆</div>
        <div class="stat-label">Yearly Projection</div>
        <div class="stat-value accent">${formatCurrency(netYearly)}</div>
        <div class="stat-sub">Net annualized</div>
      </div>
      <div class="stat-card" style="animation-delay:0.25s">
        <div class="stat-icon purple">%</div>
        <div class="stat-label">Net ROI</div>
        <div class="stat-value">${roi ? roi + '%' : '—'}</div>
        <div class="stat-sub">Based on invested capital</div>
      </div>
      <div class="stat-card" style="animation-delay:0.3s">
        <div class="stat-icon yellow">⬡</div>
        <div class="stat-label">Expense Ratio</div>
        <div class="stat-value">${totalEarnings > 0 ? ((totalExpenses / totalEarnings) * 100).toFixed(0) + '%' : '—'}</div>
        <div class="stat-sub">Expenses / earnings</div>
      </div>
    </div>

    <!-- Earnings vs Expenses visual bar -->
    ${totalEarnings > 0 || totalExpenses > 0 ? `
    <div class="chart-card mb-24" style="margin-bottom:24px">
      <div class="section-header">
        <div>
          <div class="section-title">Earnings vs Expenses</div>
          <div class="section-sub">Monthly comparison</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
            <span style="color:var(--text-secondary)">Earnings</span>
            <span style="color:var(--green);font-weight:700">${formatCurrency(totalEarnings)}</span>
          </div>
          <div style="height:10px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden">
            <div style="height:100%;background:var(--green);border-radius:6px;width:100%;transition:width 0.6s ease"></div>
          </div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
            <span style="color:var(--text-secondary)">Expenses</span>
            <span style="color:var(--red);font-weight:700">${formatCurrency(totalExpenses)}</span>
          </div>
          <div style="height:10px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden">
            <div style="height:100%;background:var(--red);border-radius:6px;width:${totalEarnings > 0 ? Math.min((totalExpenses/totalEarnings)*100, 100) : 100}%;transition:width 0.6s ease"></div>
          </div>
        </div>
      </div>
      <div style="padding:16px;background:${netIncome >= 0 ? 'var(--green-soft)' : 'var(--red-soft)'};border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style="font-size:14px;color:var(--text-secondary)">Net monthly income</span>
        <span style="font-size:22px;font-weight:800;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${netIncome >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netIncome))}
        </span>
      </div>
    </div>` : ''}

    <!-- Two-column: earnings breakdown + expenses breakdown -->
    <div class="grid-2" style="margin-bottom:28px">

      <!-- Monthly Earnings breakdown -->
      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title" style="color:var(--green)">↑ Monthly Earnings</div>
            <div class="section-sub">${formatCurrency(totalEarnings)} total</div>
          </div>
        </div>
        ${topAssets.length === 0 ? `
          <div class="empty-state" style="padding:32px">
            <div class="empty-icon" style="font-size:28px">💸</div>
            <div class="empty-desc" style="margin:0">No income yet. Add assets with monthly income.</div>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${topAssets.map(a => {
              const pct = totalEarnings > 0 ? ((Number(a.monthlyIncome) / totalEarnings) * 100).toFixed(0) : 0;
              const meta = categoryMeta(a.category);
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0">
                      <span style="font-size:14px">${meta.icon}</span>
                      <span style="font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${escHtml(a.name)}</span>
                    </div>
                    <span style="font-size:13px;font-weight:700;color:var(--green);flex-shrink:0">${formatCurrency(Number(a.monthlyIncome) || 0)}</span>
                  </div>
                  <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
                    <div style="height:100%;background:var(--green);border-radius:4px;width:${pct}%;opacity:0.8"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
        ${Object.keys(earningsByCategory).length > 0 ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">By category</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${Object.entries(earningsByCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span style="color:var(--text-secondary)">${cat}</span>
                  <span style="font-weight:600;color:var(--green)">${formatCurrency(amt)}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
      </div>

      <!-- Monthly Expenses breakdown -->
      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title" style="color:var(--red)">↓ Monthly Expenses</div>
            <div class="section-sub">${formatCurrency(totalExpenses)} total</div>
          </div>
          <a href="#/platforms/add" class="btn btn-secondary btn-sm">+ Add</a>
        </div>
        ${topPlatforms.length === 0 ? `
          <div class="empty-state" style="padding:32px">
            <div class="empty-icon" style="font-size:28px">🏷</div>
            <div class="empty-desc" style="margin:0">No platforms added yet. Track your monthly tool costs.</div>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${topPlatforms.map(p => {
              const pct = totalExpenses > 0 ? ((Number(p.monthlyCost) / totalExpenses) * 100).toFixed(0) : 0;
              const icon = PLATFORM_ICONS[p.category] || '◈';
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0">
                      <span style="font-size:14px">${icon}</span>
                      <span style="font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${escHtml(p.name)}</span>
                    </div>
                    <span style="font-size:13px;font-weight:700;color:var(--red);flex-shrink:0">${formatCurrency(Number(p.monthlyCost) || 0)}</span>
                  </div>
                  <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
                    <div style="height:100%;background:var(--red);border-radius:4px;width:${pct}%;opacity:0.7"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
        ${Object.keys(expensesByCategory).length > 0 ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">By category</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${Object.entries(expensesByCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span style="color:var(--text-secondary)">${cat}</span>
                  <span style="font-weight:600;color:var(--red)">${formatCurrency(amt)}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
      </div>
    </div>

    <!-- Yearly projection table -->
    <div class="chart-card" style="animation:fadeInUp 0.5s ease">
      <div class="section-header">
        <div>
          <div class="section-title">Yearly Projection</div>
          <div class="section-sub">Based on current monthly figures × 12</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Line item</th>
              <th style="text-align:right;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Monthly</th>
              <th style="text-align:right;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Yearly</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:12px 0;color:var(--green);font-weight:600">↑ Total Earnings</td>
              <td style="text-align:right;padding:12px 0;color:var(--green);font-weight:700">${formatCurrency(totalEarnings)}</td>
              <td style="text-align:right;padding:12px 0;color:var(--green);font-weight:700">${formatCurrency(totalEarnings * 12)}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:12px 0;color:var(--red);font-weight:600">↓ Total Expenses</td>
              <td style="text-align:right;padding:12px 0;color:var(--red);font-weight:700">-${formatCurrency(totalExpenses)}</td>
              <td style="text-align:right;padding:12px 0;color:var(--red);font-weight:700">-${formatCurrency(totalExpenses * 12)}</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:12px 0;color:var(--text-muted);font-size:13px">Capital Invested</td>
              <td style="text-align:right;padding:12px 0;color:var(--text-secondary)">—</td>
              <td style="text-align:right;padding:12px 0;color:var(--text-secondary)">${formatCurrency(invested)}</td>
            </tr>
            <tr>
              <td style="padding:14px 0;font-weight:800;font-size:15px">Net Income</td>
              <td style="text-align:right;padding:14px 0;font-weight:800;font-size:16px;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${netIncome >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netIncome))}
              </td>
              <td style="text-align:right;padding:14px 0;font-weight:800;font-size:16px;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${netIncome >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netYearly))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
