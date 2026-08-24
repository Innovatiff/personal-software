import { getAssets, getPlatforms, getBusinesses } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, serviceMeta, formatCurrency, computeMRR, isThisMonth } from '../utils.js';
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

  let assets = [], platforms = [], businesses = [];
  try {
    [assets, platforms, businesses] = await Promise.all([getAssets(), getPlatforms(), getBusinesses()]);
  } catch (err) { console.error(err); }

  build(assets, platforms, businesses);
}

function build(assets, platforms, businesses) {
  // Recurring earnings = active business MRR + asset monthly income
  const bizItems = businesses
    .filter(b => b.status === 'Active')
    .map(b => ({ name: b.name, amount: computeMRR(b.price, b.period, b.users), meta: serviceMeta(b.service), group: b.service }))
    .filter(x => x.amount > 0);
  const assetItems = assets
    .map(a => ({ name: a.name, amount: num(a.monthlyIncome), meta: categoryMeta(a.category), group: a.category }))
    .filter(x => x.amount > 0);
  const earnItems = [...bizItems, ...assetItems].sort((a, b) => b.amount - a.amount);

  const platItems = platforms
    .map(p => ({ name: p.name, amount: num(p.monthlyCost), meta: platformMeta(p.category), group: p.category }))
    .sort((a, b) => b.amount - a.amount);

  const totalEarnings = earnItems.reduce((s, x) => s + x.amount, 0);
  const totalExpenses = platItems.reduce((s, x) => s + x.amount, 0);
  const setupThisMonth = businesses.filter(b => isThisMonth(b.createdAt)).reduce((s, b) => s + num(b.setupFee), 0);
  const net = totalEarnings - totalExpenses;
  const madeThisMonth = totalEarnings + setupThisMonth;
  const invested = assets.reduce((s, a) => s + num(a.totalCost), 0);
  const yearlyNet = net * 12;
  const expenseRatio = totalEarnings > 0 ? ((totalExpenses / totalEarnings) * 100).toFixed(0) : null;

  const statCard = (ic, color, label, value, sub, style = '') => `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon(ic, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value" style="${style}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Monthly Overview</h1>
      <p class="page-desc">Your complete financial picture for this month</p>
    </div>

    <div class="stats-grid">
      ${statCard('trendingUp', 'green', 'Recurring Earnings', formatCurrency(totalEarnings), 'Businesses + assets / mo', 'color:var(--green)')}
      ${statCard('receipt', 'yellow', 'Setup Fees', formatCurrency(setupThisMonth), 'One-time, this month')}
      ${statCard('wallet', 'green', 'Made This Month', formatCurrency(madeThisMonth), 'Earnings + setup', 'color:var(--accent-light)')}
      ${statCard('trendingDown', 'red', 'Monthly Expenses', formatCurrency(totalExpenses), 'Platform costs', 'color:var(--red)')}
      ${statCard(net >= 0 ? 'check' : 'alert', net >= 0 ? 'green' : 'red', 'Net Monthly', formatCurrency(Math.abs(net)), net >= 0 ? 'Profit' : 'At a loss', `color:${net >= 0 ? 'var(--green)' : 'var(--red)'}`)}
      ${statCard('pie', 'blue', 'Expense Ratio', expenseRatio ? expenseRatio + '%' : '—', 'Expenses ÷ earnings')}
    </div>

    ${(totalEarnings > 0 || totalExpenses > 0) ? evseBar(totalEarnings, totalExpenses, net) : ''}

    <div class="grid-2" style="margin-bottom:24px">
      ${breakdownCard('Recurring Earnings', 'trendingUp', 'var(--green)', formatCurrency(totalEarnings),
        earnItems, totalEarnings, 'var(--green)', 'No earnings yet — add clients or assets.')}
      ${breakdownCard('Monthly Expenses', 'trendingDown', 'var(--red)', formatCurrency(totalExpenses),
        platItems, totalExpenses, 'var(--red)', 'No platforms yet — track your monthly tool costs.', true)}
    </div>

    <div class="chart-card">
      <div class="section-header">
        <div>
          <div class="section-title">Yearly Projection</div>
          <div class="section-sub">Recurring figures × 12</div>
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
            ${row('Recurring Earnings', formatCurrency(totalEarnings), formatCurrency(totalEarnings * 12), 'var(--green)')}
            ${row('Setup Fees (this month)', formatCurrency(setupThisMonth), '—', 'var(--text-secondary)', true)}
            ${row('Monthly Expenses', '−' + formatCurrency(totalExpenses), '−' + formatCurrency(totalExpenses * 12), 'var(--red)')}
            ${row('Capital Invested', '—', formatCurrency(invested), 'var(--text-secondary)', true)}
            <tr>
              <td style="padding:15px 0;font-weight:800;font-size:15px">Net Income</td>
              <td class="num" style="text-align:right;padding:15px 0;font-weight:800;font-size:16px;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}</td>
              <td class="num" style="text-align:right;padding:15px 0;font-weight:800;font-size:16px;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(yearlyNet))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function evseBar(earn, exp, net) {
  return `
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
            <span class="num" style="color:var(--green);font-weight:700">${formatCurrency(earn)}</span>
          </div>
          <div class="bar-track" style="height:10px"><div class="bar-fill" style="width:100%;background:var(--green)"></div></div>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
            <span style="color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px">${icon('trendingDown', 14)} Expenses</span>
            <span class="num" style="color:var(--red);font-weight:700">${formatCurrency(exp)}</span>
          </div>
          <div class="bar-track" style="height:10px"><div class="bar-fill" style="width:${earn > 0 ? Math.min((exp / earn) * 100, 100) : 100}%;background:var(--red)"></div></div>
        </div>
      </div>
      <div style="padding:16px 18px;background:${net >= 0 ? 'var(--green-soft)' : 'var(--red-soft)'};border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style="font-size:14px;color:var(--text-secondary);font-weight:550">Net monthly income</span>
        <span class="num" style="font-size:23px;font-weight:800;color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}</span>
      </div>
    </div>`;
}

function breakdownCard(title, ic, color, total, items, totalVal, barColor, emptyMsg, withAdd) {
  const byGroup = {};
  items.forEach(it => { byGroup[it.group] = (byGroup[it.group] || 0) + it.amount; });
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
            const pct = totalVal > 0 ? (it.amount / totalVal) * 100 : 0;
            return `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="display:flex;align-items:center;gap:9px;min-width:0">
                    <span style="color:${it.meta.color};display:flex;flex-shrink:0">${icon(it.meta.iconName, 15)}</span>
                    <span style="font-size:13px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(it.name)}</span>
                  </div>
                  <span class="num" style="font-size:13px;font-weight:700;color:${color};flex-shrink:0">${formatCurrency(it.amount)}</span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${barColor};opacity:0.85"></div></div>
              </div>`;
          }).join('')}
        </div>
        ${Object.keys(byGroup).length > 1 ? `
          <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:11px">By type</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([g, amt]) => `
                <div style="display:flex;justify-content:space-between;font-size:13px">
                  <span style="color:var(--text-secondary)">${g}</span>
                  <span class="num" style="font-weight:600;color:${color}">${formatCurrency(amt)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}
      `}
    </div>`;
}

function row(label, monthly, yearly, color, muted) {
  return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:13px 0;color:${color};font-weight:${muted ? '400' : '600'};font-size:${muted ? '13px' : '14px'}">${label}</td>
      <td class="num" style="text-align:right;padding:13px 0;color:${color};font-weight:${muted ? '400' : '700'}">${monthly}</td>
      <td class="num" style="text-align:right;padding:13px 0;color:${color};font-weight:${muted ? '400' : '700'}">${yearly}</td>
    </tr>`;
}

const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
