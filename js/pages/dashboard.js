import { getBusinesses, getAssets, getPlatforms, getInvoices } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { auth } from '../firebase-config.js';
import {
  formatCurrency, computeMRR, serviceMeta, businessStatusBadge,
  BUSINESS_STATUSES, isThisMonthISO, isoMonthKey, tsMonthKey, lastMonths,
  sparkline, formatShortDate
} from '../utils.js';
import { icon } from '../icons.js';
import { countUps, animateCharts, haptic } from '../anim.js';

let _cache = null; // last-loaded data, for cheap rebuilds (e.g. after goal edits)

export async function renderDashboard() {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <div class="main-content">
      ${renderTopbar('Dashboard', { noAdd: true })}
      <div class="page-content">
        <div class="skeleton" style="height:200px;border-radius:22px;margin-bottom:20px"></div>
        <div class="spark-grid">${Array(4).fill('<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>').join('')}</div>
        <div class="dash-row a">
          <div class="skeleton" style="height:320px;border-radius:var(--radius-lg)"></div>
          <div class="skeleton" style="height:320px;border-radius:var(--radius-lg)"></div>
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let businesses = [], assets = [], platforms = [], invoices = [];
  try {
    [businesses, assets, platforms, invoices] = await Promise.all([
      getBusinesses(), getAssets(), getPlatforms(), getInvoices().catch(() => []),
    ]);
  } catch (err) { console.error(err); }

  _cache = { businesses, assets, platforms, invoices };
  build(businesses, assets, platforms, invoices);
}

function build(businesses, assets, platforms, invoices) {
  const firstName = auth.currentUser?.displayName?.split(' ')[0] || 'there';

  // ── Recurring & clients ──
  const activeBiz = businesses.filter(b => b.status === 'Active');
  const activeMRR = activeBiz.reduce((s, b) => s + computeMRR(b.price, b.period, b.users), 0);
  const counts = {};
  BUSINESS_STATUSES.forEach(s => { counts[s] = businesses.filter(b => b.status === s).length; });
  const activeRate = businesses.length ? Math.round((counts['Active'] / businesses.length) * 100) : 0;

  // ── Collected money (from paid invoices) ──
  const paid = invoices.filter(i => i.status !== 'Unpaid');
  const paidThisMonth = paid.filter(i => isThisMonthISO(i.paidDate));
  const collected = paidThisMonth.reduce((s, i) => s + num(i.amount), 0);
  const oneTimeThisMonth = paidThisMonth.filter(i => i.kind === 'one-time').reduce((s, i) => s + num(i.amount), 0);
  const recurringThisMonth = collected - oneTimeThisMonth;
  const unpaid = invoices.filter(i => i.status === 'Unpaid').reduce((s, i) => s + num(i.amount), 0);

  const assetMonthly = assets.reduce((s, a) => s + num(a.monthlyIncome), 0);
  const expenses = platforms.reduce((s, p) => s + num(p.monthlyCost), 0);
  const netThisMonth = collected + assetMonthly - expenses;
  const yearly = (activeMRR + assetMonthly) * 12;

  // ── Series (last 7 months) for sparklines + 12 for the chart ──
  const m7 = lastMonths(7), m12 = lastMonths(12);
  const revByMonth = {};
  paid.forEach(i => { const k = isoMonthKey(i.paidDate); if (k) revByMonth[k] = (revByMonth[k] || 0) + num(i.amount); });
  const invByMonth = {};
  invoices.forEach(i => { const k = isoMonthKey(i.issueDate); if (k) invByMonth[k] = (invByMonth[k] || 0) + 1; });
  const bizByMonth = {};
  businesses.forEach(b => { const k = tsMonthKey(b.createdAt); if (k) bizByMonth[k] = (bizByMonth[k] || 0) + 1; });
  const before = (map, firstKey) => Object.keys(map).filter(k => k < firstKey).reduce((s, k) => s + map[k], 0);

  const revSeries = m7.map(m => revByMonth[m.key] || 0);
  const invSeries = m7.map(m => invByMonth[m.key] || 0);
  let running = before(bizByMonth, m7[0].key);
  const clientSeries = m7.map(m => (running += bizByMonth[m.key] || 0));
  const mrrSeries = m7.map((m, i) => clientSeries[i] ? Math.round(activeMRR * clientSeries[i] / (clientSeries[6] || 1)) : 0);

  const lastMonthRev = revByMonth[m7[5].key] || 0;
  const revDelta = lastMonthRev > 0 ? Math.round(((collected - lastMonthRev) / lastMonthRev) * 100) : null;

  // ── Top clients (share of MRR) ──
  const ranked = [...businesses]
    .map(b => ({ ...b, _mrr: computeMRR(b.price, b.period, b.users) }))
    .filter(b => b._mrr > 0)
    .sort((a, b) => b._mrr - a._mrr);
  const topClients = ranked.slice(0, 5);
  const topMax = topClients.length ? topClients[0]._mrr : 0;

  const recentInvoices = [...invoices].slice(0, 5);
  const chartMax = Math.max(...m12.map(m => revByMonth[m.key] || 0), 1);
  const nowKey = tsMonthKey(new Date());

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <!-- Hero -->
    <section class="hero">
      <div>
        <div class="hero-kicker">Your business. Always on track.</div>
        <h1 class="hero-title">Smarter billing for a <em>growing</em> business.</h1>
        <p class="hero-sub">Hi ${escHtml(firstName)} — track clients, register one-time jobs, generate polished invoices and watch revenue grow, all in one place.</p>
        <div class="hero-actions">
          <a href="#/invoices/new" class="btn btn-primary btn-lg">${icon('plus', 17)} New Invoice</a>
          <a href="#/businesses/add" class="btn btn-secondary btn-lg">${icon('building2', 17)} Add Client</a>
        </div>
      </div>
      ${heroArt()}
    </section>

    <!-- Sparkline stats -->
    <div class="spark-grid">
      ${sparkCard('wallet', 'var(--green-soft)', 'var(--green)', formatCurrency(collected), collected, 'cur', 'Collected this month',
        revDelta === null ? 'vs last month' : `${revDelta >= 0 ? '↑' : '↓'} ${Math.abs(revDelta)}% vs last month`, revDelta === null ? '' : (revDelta >= 0 ? 'up' : 'down'), revSeries, 'var(--green)')}
      ${sparkCard('trendingUp', 'var(--purple-soft)', 'var(--accent)', formatCurrency(activeMRR), activeMRR, 'cur', 'Recurring MRR',
        `${counts['Active']} active client${counts['Active'] === 1 ? '' : 's'}`, 'up', mrrSeries, 'var(--accent)')}
      ${sparkCard('building2', 'var(--blue-soft)', 'var(--blue)', String(businesses.length), businesses.length, 'int', 'Total clients',
        `${activeRate}% active`, activeRate >= 50 ? 'up' : '', clientSeries, 'var(--blue)')}
      ${sparkCard('receipt', unpaid ? 'var(--yellow-soft)' : 'var(--subtle)', unpaid ? 'var(--yellow)' : 'var(--text-secondary)', String(invoices.length), invoices.length, 'int', 'Invoices',
        unpaid ? `${formatCurrency(unpaid)} outstanding` : 'All settled', unpaid ? 'down' : 'up', invSeries, unpaid ? 'var(--yellow)' : 'var(--text-muted)')}
    </div>

    <!-- Revenue overview + top clients -->
    <div class="dash-row a">
      <div class="chart-card">
        <div class="rev-head">
          <div>
            <div class="section-title">Revenue Overview</div>
            <div class="section-sub">Collected per month · last 12 months</div>
          </div>
          <span class="badge badge-category">${formatCurrency(Object.values(revByMonth).reduce((s, v) => s + v, 0))} total</span>
        </div>
        ${paid.length ? `
          <div class="rev-chart">
            ${m12.map(m => {
              const v = revByMonth[m.key] || 0;
              const h = Math.max(2, (v / chartMax) * 100);
              return `
                <div class="rev-col ${m.key === nowKey ? 'cur' : ''}">
                  <div class="rev-bar" style="height:2%" data-h="${h}">
                    <div class="rev-tip"><b>${formatCurrency(v)}</b>${m.full}</div>
                  </div>
                  <div class="rev-x">${m.label}</div>
                </div>`;
            }).join('')}
          </div>` : miniEmpty('barChart', 'Paid invoices will chart here')}
      </div>

      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Top Clients</div>
            <div class="section-sub">By monthly recurring revenue</div>
          </div>
          ${businesses.length ? `<a href="#/businesses" class="btn btn-ghost btn-sm">View all</a>` : ''}
        </div>
        ${topClients.length ? topClients.map((b, i) => {
          const meta = serviceMeta(b.service);
          return `
            <div class="top-item" style="animation-delay:${i * 0.05}s">
              <div class="top-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 17)}</div>
              <div class="top-main">
                <div class="top-name">${escHtml(b.name)}</div>
                <div class="top-sub">${b.service || 'Client'}${b.users > 1 ? ` · ${b.users} users` : ''}</div>
              </div>
              <div class="top-right">
                <div class="top-amt num">${formatCurrency(b._mrr)}</div>
                <div class="top-bar"><i data-w="${Math.round((b._mrr / topMax) * 100)}"></i></div>
              </div>
            </div>`;
        }).join('') : miniEmpty('users', 'No clients yet')}
      </div>
    </div>

    <!-- This month / recent invoices / status -->
    <div class="dash-row b">
      <div class="best-asset-card tm-card">
        <div class="best-asset-label">${icon('wallet', 14)} This Month</div>
        <div class="best-asset-income" data-count="${collected}" data-fmt="cur">${formatCurrency(collected)}</div>
        <div class="tm-lines">
          ${lineItem('Recurring payments', formatCurrency(recurringThisMonth))}
          ${lineItem('One-time services', formatCurrency(oneTimeThisMonth))}
          ${lineItem('Expected MRR', formatCurrency(activeMRR))}
          ${lineItem('Net (incl. assets − costs)', formatCurrency(netThisMonth), netThisMonth >= 0 ? 'var(--green)' : 'var(--red)')}
        </div>
        ${goalHtml(collected)}
        <a href="#/monthly" class="btn btn-secondary btn-full" style="margin-top:auto">${icon('barChart', 16)} View full report</a>
      </div>

      <div class="chart-card">
        <div class="section-header">
          <div>
            <div class="section-title">Recent Invoices</div>
            <div class="section-sub">Latest activity</div>
          </div>
          ${invoices.length ? `<a href="#/invoices" class="kpi-arrow">${icon('arrowUpRight', 16)}</a>` : ''}
        </div>
        ${recentInvoices.length ? `<div class="mini-list">${recentInvoices.map(invoiceItem).join('')}</div>`
          : miniEmpty('receipt', 'No invoices yet')}
      </div>

      <div class="chart-card" style="display:flex;flex-direction:column">
        <div class="section-header">
          <div>
            <div class="section-title">Client Status</div>
            <div class="section-sub">${counts['Active']} of ${businesses.length} active</div>
          </div>
        </div>
        ${businesses.length ? `
          <div class="gauge" style="--v:0;width:150px;height:150px;margin:4px auto 10px" data-gauge="${activeRate}">
            <div class="gauge-label">
              <div class="gauge-value" style="font-size:28px" data-count="${activeRate}" data-fmt="pct">${activeRate}%</div>
              <div class="gauge-sub">active</div>
            </div>
          </div>
          ${statusBreakdown(counts, businesses.length)}` : miniEmpty('users', 'No clients yet')}
      </div>
    </div>

    <!-- Projection + portfolio tie-in -->
    <div class="stats-grid" style="margin-top:4px">
      <div class="dark-card" style="padding:20px">
        <div class="dark-card-label">${icon('trendingUp', 14)} Projected yearly</div>
        <div class="dark-card-value" style="font-size:28px;margin-top:14px">${formatCurrency(yearly)}</div>
        <div class="dark-card-sub">Recurring + assets × 12</div>
      </div>
      ${snapshot('layers', 'yellow', 'Assets', `${assets.length}`, `${formatCurrency(assetMonthly)} / mo income`, '/assets')}
      ${snapshot('server', 'red', 'Expenses', `${platforms.length}`, `${formatCurrency(expenses)} / mo cost`, '/platforms')}
      ${snapshot('activity', 'green', 'Net This Month', formatCurrency(netThisMonth), 'Collected + assets − costs', '/monthly', netThisMonth >= 0 ? 'green' : '')}
    </div>
  `;

  countUps(content);
  animateCharts(content);
  const goalBtn = content.querySelector('#goal-btn');
  if (goalBtn) goalBtn.addEventListener('click', openGoalModal);
}

// ── Pieces ───────────────────────────────────────────────────

function sparkCard(ic, tint, color, value, raw, fmt, label, deltaText, deltaCls, series, lineColor) {
  return `
    <div class="spark-card">
      <div class="spark-top">
        <div class="spark-icon" style="background:${tint};color:${color}">${icon(ic, 18)}</div>
        <div class="spark-label">${label}</div>
      </div>
      <div class="spark-body">
        <div class="spark-main">
          <div class="spark-value num" data-count="${raw}" data-fmt="${fmt}">${value}</div>
          <div class="spark-delta ${deltaCls}">${deltaText}</div>
        </div>
        ${sparkline(series, { color: lineColor })}
      </div>
    </div>`;
}

function invoiceItem(inv) {
  const unpaid = inv.status === 'Unpaid';
  const oneTime = inv.kind === 'one-time';
  return `
    <a class="mini-item" href="#/invoices/${inv.id}">
      <div class="mini-avatar" style="background:${oneTime ? 'var(--yellow-soft)' : 'var(--purple-soft)'};color:${oneTime ? 'var(--yellow)' : 'var(--accent)'}">${icon(oneTime ? 'sparkle' : 'receipt', 18)}</div>
      <div class="mini-main">
        <div class="mini-title">${escHtml(inv.clientName)}</div>
        <div class="mini-sub">${inv.number || ''} · ${formatShortDate(inv.issueDate)}</div>
      </div>
      <div class="mini-right">
        <div class="num" style="font-weight:750;font-size:13px">${formatCurrency(num(inv.amount))}</div>
        <div style="font-size:11px;font-weight:650;color:${unpaid ? 'var(--yellow)' : 'var(--green)'}">${unpaid ? 'Unpaid' : 'Paid'}</div>
      </div>
    </a>`;
}

function statusBreakdown(counts, total) {
  const rows = [
    { label: 'Active', color: 'var(--green)', n: counts['Active'] || 0 },
    { label: 'Building', color: 'var(--yellow)', n: counts['Building'] || 0 },
    { label: 'Inactive', color: 'var(--text-muted)', n: counts['Inactive'] || 0 },
  ];
  return `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
      ${rows.map(r => `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px">
              <i style="width:9px;height:9px;border-radius:3px;background:${r.color};display:inline-block"></i>${r.label}
            </span>
            <span class="num" style="font-size:13px;font-weight:700">${r.n}</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:0%;background:${r.color}" data-w="${total ? (r.n / total) * 100 : 0}"></div></div>
        </div>`).join('')}
    </div>`;
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
    <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px">
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

/** Abstract hero illustration — black / white / royal blue */
function heroArt() {
  return `
    <svg class="hero-art" viewBox="0 0 340 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ha-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3b6df5"/><stop offset="1" stop-color="#1a3fb8"/></linearGradient>
        <linearGradient id="ha-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1b1d27"/><stop offset="1" stop-color="#07080b"/></linearGradient>
        <filter id="ha-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0c0c11" flood-opacity="0.18"/></filter>
      </defs>
      <circle cx="270" cy="48" r="70" fill="#2352e0" opacity="0.08"/>
      <circle cx="60" cy="190" r="46" fill="#0c0c11" opacity="0.05"/>
      <g filter="url(#ha-sh)">
        <rect x="40" y="46" width="200" height="132" rx="18" fill="#fff" stroke="#e5e7ee"/>
        <rect x="58" y="64" width="64" height="10" rx="5" fill="#0c0c11" opacity="0.85"/>
        <rect x="58" y="82" width="42" height="7" rx="3.5" fill="#9aa1b1" opacity="0.7"/>
        <rect x="60" y="150" width="18" height="12" rx="4" fill="#2352e0" opacity="0.35"/>
        <rect x="86" y="132" width="18" height="30" rx="4" fill="#2352e0" opacity="0.55"/>
        <rect x="112" y="118" width="18" height="44" rx="4" fill="#2352e0" opacity="0.75"/>
        <rect x="138" y="104" width="18" height="58" rx="4" fill="url(#ha-blue)"/>
        <rect x="164" y="124" width="18" height="38" rx="4" fill="#2352e0" opacity="0.6"/>
        <rect x="190" y="110" width="18" height="52" rx="4" fill="#2352e0" opacity="0.85"/>
      </g>
      <g filter="url(#ha-sh)">
        <rect x="196" y="18" width="118" height="64" rx="14" fill="url(#ha-ink)"/>
        <polygon points="212.5,31.5 220,42.5 227.5,31.5 220,39" fill="#fff"/>
        <rect x="236" y="32" width="58" height="8" rx="4" fill="#fff" opacity="0.9"/>
        <rect x="236" y="48" width="36" height="6" rx="3" fill="#fff" opacity="0.4"/>
        <rect x="214" y="60" width="86" height="8" rx="4" fill="#3b6df5"/>
      </g>
      <g filter="url(#ha-sh)">
        <rect x="222" y="134" width="96" height="56" rx="14" fill="#fff" stroke="#e5e7ee"/>
        <circle cx="244" cy="162" r="11" fill="#e7f7ef"/>
        <path d="M239 162l3.5 3.5 6.5-7" stroke="#0f9d58" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="262" y="152" width="44" height="8" rx="4" fill="#0c0c11" opacity="0.85"/>
        <rect x="262" y="166" width="30" height="6" rx="3" fill="#9aa1b1" opacity="0.7"/>
      </g>
    </svg>`;
}

// ── Monthly revenue goal (stored on this device) ─────────────

function getGoal() {
  try { const g = parseFloat(localStorage.getItem('pf-goal')); return g > 0 ? g : null; }
  catch { return null; }
}

function goalHtml(total) {
  const goal = getGoal();
  if (!goal) {
    return `
      <button class="btn btn-secondary btn-sm" id="goal-btn" style="margin-bottom:14px;align-self:flex-start">
        ${icon('target', 14)} Set monthly goal
      </button>`;
  }
  const pct = Math.min(100, Math.round((total / goal) * 100));
  return `
    <div class="goal-box" id="goal-btn" title="Tap to edit goal">
      <div class="goal-head">
        <span class="goal-name">${icon('target', 13)} Goal ${formatCurrency(goal)}</span>
        <span class="goal-pct num" style="color:${pct >= 100 ? 'var(--green)' : 'var(--accent)'}">${pct}%${pct >= 100 ? ' 🎉' : ''}</span>
      </div>
      <div class="bar-track" style="height:8px">
        <div class="bar-fill" style="width:0%;background:linear-gradient(90deg,var(--accent-light),var(--accent))" data-w="${pct}"></div>
      </div>
    </div>`;
}

function openGoalModal() {
  const goal = getGoal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title" style="display:flex;align-items:center;gap:9px">${icon('target', 18)} Monthly Goal</div>
      <div class="modal-desc">Set a revenue target for each month — the dashboard tracks what you've collected toward it.</div>
      <div class="form-group">
        <label class="form-label">Goal amount ($)</label>
        <input class="form-control" type="number" id="goal-input" min="1" step="1" placeholder="e.g. 2000" value="${goal ?? ''}" />
      </div>
      <div class="modal-actions">
        ${goal ? '<button class="btn btn-ghost" id="goal-clear" style="margin-right:auto;color:var(--red)">Remove</button>' : ''}
        <button class="btn btn-secondary" id="goal-cancel">Cancel</button>
        <button class="btn btn-primary" id="goal-save">Save Goal</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#goal-input');
  input.focus();

  const rebuild = () => { overlay.remove(); if (_cache) build(_cache.businesses, _cache.assets, _cache.platforms, _cache.invoices); };
  overlay.querySelector('#goal-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#goal-save').addEventListener('click', () => {
    const v = parseFloat(input.value);
    if (!(v > 0)) { input.focus(); return; }
    try { localStorage.setItem('pf-goal', String(v)); } catch {}
    haptic(12);
    rebuild();
  });
  overlay.querySelector('#goal-clear')?.addEventListener('click', () => {
    try { localStorage.removeItem('pf-goal'); } catch {}
    rebuild();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// helpers
const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
