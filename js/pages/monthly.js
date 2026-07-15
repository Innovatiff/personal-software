import { getAssets, getPlatforms } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, formatCurrency } from '../utils.js';
import { platformMeta } from './platforms.js';
import { icon } from '../icons.js';

export async function renderMonthly() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('monthly')}
    <div class="main-content">
      ${renderTopbar('Monthly Overview')}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Monthly Overview</h1>
          <p class="page-desc">Your complete financial picture for this month</p>
        </div>
        <div class="stats-grid">${Array(6).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let assets = [], platforms = [];
  try {
    [assets, platforms] = await Promise.all([getAssets(), getPlatforms()]);
  } catch (err) { console.error(err); }

  buildMonthlyPage(assets, platforms);
}

function buildMonthlyPage(assets, platforms) {
  const totalEarnings = sum(assets, 'monthlyIncome');
  const totalExpenses = sum(platforms, 'monthlyCost');
  const netIncome = totalEarnings - totalExpenses;
  const invested = sum(assets, 'totalCost');
  const netYearly = netIncome * 12;
  const roi = invested > 0 ? ((netYearly / invested) * 100).toFixed(1) : null;
  const expenseRatio = totalEarnings > 0 ? ((totalExpenses / totalEarnings) * 100).toFixed(0) : null;

  const topAssets = [...assets].filter(a => num(a.monthlyIncome) > 0)
    .sort((a, b) => num(b.monthlyIncome) - num(a.monthlyIncome));
  const topPlatforms = [...platforms].sort((a, b) => num(b.monthlyCost) - num(a.monthlyCost));

  const earningsByCat = groupSum(assets, 'category', 'monthlyIncome');
  const expensesByCat = groupSum(platforms, 'category', 'monthlyCost');

  const statCard = (ic, color, label, value, sub, valueStyle = '') => `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon(ic, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value" style="${valueStyle}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Monthly Overview</h1>
      <p class="page-desc">Your complete financial picture for this month</p>
    </div>

    <div class="stats-grid">
      ${statCard('trendingUp', 'green', 'Monthly Earnings', formatCurrency(totalEarnings), `From ${assets.length} asset${assets.length !== 1 ? 's' : ''}`, 'color:var(--green)')}
      ${statCard('trendingDown', 'red', 'Monthly Expenses', formatCurrency(totalExpenses), `From ${platforms.length} platform${platforms.length !== 1 ? 's' : ''}`, 'color:var(--red)')}
      ${statCard(netIncome >= 0 ? 'check' : 'alert', netIncome >= 0 ? 'green' : 'red', 'Net Monthly Income', formatCurrency(Math.abs(netIncome)), netIncome >= 0 ? 'Profit' : 'Running at a loss', `color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}`)}
      ${statCard('activity', 'blue', 'Yearly Projection', formatCurrency(netYearly), 'Net annualized', 'color:var(--accent-light)')}
      ${statCard('percent', 'purple', 'Net ROI', roi ? roi + '%' : '—', 'Based on invested capital')}
      ${statCard('pie', 'yellow', 'Expense Ratio', expenseRatio ? expenseRatio + '%' : '—', 'Expenses ÷ earnings')}
    </div>

    ${(totalEarnings > 0 || totalExpenses > 0) ? `
    <div class="chart-card" style="margin-bottom:24px">
      <div class="section-header">
        <div>
          <div class="section-title">Earnings vs Expenses</div>
          <div class="section-sub">Monthly comparison</div>
        </div>
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:18px">
        <div style="flex:1;min-width:220px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
            <span style="color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px">${icon('trendingUp', 14)} Earnings</span>
            <span class="num" style="color:var(--green);font-weight:700">${formatCurrency(totalEarnings)}</span>
          </div>
          <div class="bar-track" style="height:10px"><div class="bar-fill" style="width:100%;background:var(--green)"></div></div>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
            <span style="color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px">${icon('trendingDown', 14)} Expenses</span>
            <span class="num" style="color:var(--red);font-weight:700">${formatCurrency(totalExpenses)}</span>
          </div>
          <div class="bar-track" style="height:10px"><div class="bar-fill" style="width:${totalEarnings > 0 ? Math.min((totalExpenses / totalEarnings) * 100, 100) : 100}%;background:var(--red)"></div></div>
        </div>
      </div>
      <div style="padding:16px 18px;background:${netIncome >= 0 ? 'var(--green-soft)' : 'var(--red-soft)'};border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style="font-size:14px;color:var(--text-secondary);font-weight:550">Net monthly income</span>
        <span class="num" style="font-size:23px;font-weight:800;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${netIncome >= 0 ? '+' : '−'}${formatCurrency(Math.abs(netIncome))}
        </span>
      </div>
    </div>` : ''}

    <div class="grid-2" style="margin-bottom:24px">
      ${breakdownCard('Monthly Earnings', 'trendingUp', 'var(--green)', formatCurrency(totalEarnings),
        topAssets, totalEarnings, 'monthlyIncome', a => categoryMeta(a.category), earningsByCat, 'var(--green)',
        'No income yet — add assets with monthly income.')}

      ${breakdownCard('Monthly Expenses', 'trendingDown', 'var(--red)', formatCurrency(totalExpenses),
        topPlatforms, totalExpenses, 'monthlyCost', p => platformMeta(p.category), expensesByCat, 'var(--red)',
        'No platforms added yet — track your monthly tool costs.', true)}
    </div>

    <div class="chart-card">
      <div class="section-header">
        <div>
          <div class="section-title">Yearly Projection</div>
          <div class="section-sub">Current monthly figures × 12</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Line item</th>
              <th style="text-align:right;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Monthly</th>
              <th style="text-align:right;padding:10px 0;color:var(--text-muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Yearly</th>
            </tr>
          </thead>
          <tbody>
            ${tableRow('Total Earnings', formatCurrency(totalEarnings), formatCurrency(totalEarnings * 12), 'var(--green)')}
            ${tableRow('Total Expenses', '−' + formatCurrency(totalExpenses), '−' + formatCurrency(totalExpenses * 12), 'var(--red)')}
            ${tableRow('Capital Invested', '—', formatCurrency(invested), 'var(--text-secondary)', true)}
            <tr>
              <td style="padding:15px 0;font-weight:800;font-size:15px">Net Income</td>
              <td class="num" style="text-align:right;padding:15px 0;font-weight:800;font-size:16px;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">${netIncome >= 0 ? '+' : '−'}${formatCurrency(Math.abs(netIncome))}</td>
              <td class="num" style="text-align:right;padding:15px 0;font-weight:800;font-size:16px;color:${netIncome >= 0 ? 'var(--green)' : 'var(--red)'}">${netIncome >= 0 ? '+' : '−'}${formatCurrency(Math.abs(netYearly))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function breakdownCard(title, ic, color, total, items, totalVal, key, metaFn, byCat, barColor, emptyMsg, withAdd) {
  return `
    <div class="chart-card">
      <div class="section-header">
        <div>
          <div class="section-title" style="color:${color};display:flex;align-items:center;gap:7px">${icon(ic, 16)} ${title}</div>
          <div class="section-sub">${total} total</div>
        </div>
        ${withAdd ? `<a href="#/platforms/add" class="btn btn-secondary btn-sm">${icon('plus', 14)} Add</a>` : ''}
      </div>
      ${items.length === 0 ? `
        <div class="empty-state" style="padding:28px 0">
          <div class="empty-icon" style="width:48px;height:48px;border-radius:14px">${icon(ic, 22)}</div>
          <div class="empty-desc" style="margin:0">${emptyMsg}</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${items.slice(0, 8).map(it => {
            const meta = metaFn(it);
            const pct = totalVal > 0 ? (num(it[key]) / totalVal) * 100 : 0;
            return `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="display:flex;align-items:center;gap:9px;min-width:0">
                    <span style="color:${meta.color};display:flex;flex-shrink:0">${icon(meta.iconName, 15)}</span>
                    <span style="font-size:13px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(it.name)}</span>
                  </div>
                  <span class="num" style="font-size:13px;font-weight:700;color:${color};flex-shrink:0">${formatCurrency(num(it[key]))}</span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${barColor};opacity:0.85"></div></div>
              </div>`;
          }).join('')}
        </div>
        ${Object.keys(byCat).length > 0 ? `
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:11px">By category</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span style="color:var(--text-secondary)">${cat}</span>
                  <span class="num" style="font-weight:600;color:${color}">${formatCurrency(amt)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}
      `}
    </div>`;
}

function tableRow(label, monthly, yearly, color, muted) {
  return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:13px 0;color:${color};font-weight:${muted ? '400' : '600'};font-size:${muted ? '13px' : '14px'}">${label}</td>
      <td class="num" style="text-align:right;padding:13px 0;color:${color};font-weight:${muted ? '400' : '700'}">${monthly}</td>
      <td class="num" style="text-align:right;padding:13px 0;color:${color};font-weight:${muted ? '400' : '700'}">${yearly}</td>
    </tr>`;
}

// helpers
const num = (v) => Number(v) || 0;
const sum = (arr, key) => arr.reduce((s, x) => s + num(x[key]), 0);
function groupSum(arr, groupKey, valKey) {
  const out = {};
  arr.forEach(x => { out[x[groupKey]] = (out[x[groupKey]] || 0) + num(x[valKey]); });
  return out;
}
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
