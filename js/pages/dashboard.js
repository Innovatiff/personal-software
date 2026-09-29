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
import { achievementsFor } from '../achievements.js';
import { levelFor, forecast, getGoals, setGoals, monthLabel } from '../insights.js';
import { recapMonthKey, recapSeen } from './recap.js';

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

  // ── Streaks, trophies, level, forecast, recap ──
  const ach = achievementsFor({ invoices, businesses });
  const freshIds = new Set(ach.fresh.map(m => m.id));
  const lv = levelFor(ach.stats.total);
  const fc = forecast({ invoices, businesses });
  const recapKey = recapMonthKey();
  const recapReady = paid.some(i => isoMonthKey(i.paidDate) === recapKey) && !recapSeen(recapKey);

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <!-- Hero -->
    <section class="hero">
      <div>
        <div class="hero-kicker">Your business. Always on track.${ach.streaks.growth > 0 ? `<span class="streak-chip hot">${icon('flame', 13, { strokeWidth: 2.2 })} ${ach.streaks.growth}-month streak</span>` : ''}</div>
        <h1 class="hero-title">Smarter billing for a <em>growing</em> business.</h1>
        <p class="hero-sub">Hi ${escHtml(firstName)} — track clients, register one-time jobs, generate polished invoices and watch revenue grow, all in one place.</p>
        <div class="hero-actions">
          <a href="#/invoices/new" class="btn btn-primary btn-lg">${icon('plus', 17)} New Invoice</a>
          <a href="#/businesses/add" class="btn btn-secondary btn-lg">${icon('building2', 17)} Add Client</a>
        </div>
        ${xpBar(lv)}
      </div>
      ${heroArt()}
    </section>

    ${recapReady ? `
    <a class="recap-banner" href="#/recap/${recapKey}">
      <span class="recap-icon">${icon('video', 20, { strokeWidth: 2 })}</span>
      <span class="recap-main">
        <b>Your ${monthLabel(recapKey, { month: 'long' })} recap is ready</b>
        <small>Total collected, MVP client, biggest job, trophies and more — in 30 seconds.</small>
      </span>
      <span class="btn btn-primary btn-sm">${icon('sparkle', 14)} Watch</span>
    </a>` : ''}

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
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-category">${formatCurrency(Object.values(revByMonth).reduce((s, v) => s + v, 0))} total</span>
            ${paid.length ? `<a href="#/recap/${revByMonth[recapKey] ? recapKey : nowKey}" class="btn btn-ghost btn-sm" title="Watch the monthly recap">${icon('video', 15)} Recap</a>` : ''}
          </div>
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
        ${streakChips(ach.streaks, lastMonthRev)}
        <div class="tm-lines">
          ${lineItem('Recurring payments', formatCurrency(recurringThisMonth))}
          ${lineItem('One-time services', formatCurrency(oneTimeThisMonth))}
          ${lineItem('Expected MRR', formatCurrency(activeMRR))}
          ${lineItem('Net (incl. assets − costs)', formatCurrency(netThisMonth), netThisMonth >= 0 ? 'var(--green)' : 'var(--red)')}
        </div>
        ${goalLadder(fc)}
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

    <!-- Trophies -->
    ${trophiesCard(ach, freshIds)}

    <!-- Projection + portfolio tie-in -->
    <div class="stats-grid">
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

// ── Streak chips (This Month card) ───────────────────────────
function streakChips(s, lastMonth) {
  const chips = [];
  if (s.growth > 0) {
    chips.push(`<span class="streak-chip hot" title="Consecutive months beating the month before">${icon('flame', 13, { strokeWidth: 2.2 })} ${s.growth}-month growth streak${s.growthLive ? '' : ` · ${formatCurrency(s.needed)} to keep it`}</span>`);
  } else if (lastMonth > 0 && s.needed > 0) {
    chips.push(`<span class="streak-chip" title="Beat last month to start a growth streak">${icon('flame', 13, { strokeWidth: 2.2 })} ${formatCurrency(s.needed)} more beats last month</span>`);
  }
  if (s.goal > 0) {
    chips.push(`<span class="streak-chip goal" title="Consecutive months at or above your goal">${icon('target', 13, { strokeWidth: 2.2 })} ${s.goal}-month goal streak</span>`);
  }
  return chips.length ? `<div class="streak-row">${chips.join('')}</div>` : '';
}

// ── Trophies strip ───────────────────────────────────────────
function trophiesCard(a, freshIds) {
  const { earned, locked, milestones } = a;
  const shown = earned.slice(0, 7);
  return `
    <div class="chart-card ach-card">
      <div class="section-header">
        <div>
          <div class="section-title">Trophies</div>
          <div class="section-sub">${earned.length} of ${milestones.length} unlocked${a.fresh.length ? ` · <span style="color:var(--red);font-weight:650">${a.fresh.length} new</span>` : ''}</div>
        </div>
        <a href="#/trophies" class="btn btn-ghost btn-sm">View all</a>
      </div>
      <div class="ach-row">
        <div class="ach-earned">
          ${shown.length ? shown.map((m, i) => `
            <a href="#/trophies" class="ach-badge ${freshIds.has(m.id) ? 'is-new' : ''}" title="${escHtml(m.title)} · ${formatShortDate(m.earnedAt)}" style="animation-delay:${i * 0.05}s">${icon(m.icon, 19, { strokeWidth: 2 })}</a>`).join('')
            : `<span class="ach-empty">${icon('trophy', 16)} Collect your first payment to unlock a trophy</span>`}
          ${earned.length > shown.length ? `<a href="#/trophies" class="ach-more">+${earned.length - shown.length}</a>` : ''}
        </div>
        <div class="ach-next">
          ${locked.slice(0, 2).map(m => `
            <div class="ach-next-item">
              <div class="ach-next-icon">${icon(m.icon, 15)}</div>
              <div class="ach-next-main">
                <div class="ach-next-head"><span>${escHtml(m.title)}</span><span class="num" style="color:var(--text-muted)">${m.pct}%</span></div>
                <div class="bar-track" style="height:6px"><div class="bar-fill" style="width:0%;background:var(--accent)" data-w="${m.pct}"></div></div>
                <div class="ach-next-sub">${m.hint ? escHtml(m.hint) : m.progress}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
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

// ── Level / XP bar (hero) ────────────────────────────────────
function xpBar(lv) {
  return `
    <a class="xp-card" href="#/trophies" title="Lifetime collected revenue is your XP">
      <div class="xp-head">
        <span class="xp-level">${icon('medal', 14, { strokeWidth: 2.2 })} Level ${lv.level} · ${lv.name}</span>
        <span class="xp-next num">${lv.next ? `${formatCurrency(lv.toNext)} to ${lv.next.name}` : 'Max level'}</span>
      </div>
      <div class="xp-track"><i data-w="${lv.pct}"></i></div>
      <div class="xp-sub"><span class="num">${formatCurrency(lv.xp)}</span> collected all time · every payment adds XP</div>
    </a>`;
}

// ── Goal ladder + forecast (goals stored on this device) ─────
function goalLadder(fc) {
  const { monthly, yearly } = fc;
  const s = (n) => (n === 1 ? '' : 's');
  const ladder = [];

  if (monthly) {
    let hint;
    if (monthly.reached) hint = `Goal reached 🎉 · ${formatCurrency(monthly.collected - monthly.goal)} over`;
    else {
      const parts = [];
      if (monthly.recurringDue > 0) parts.push(`${formatCurrency(monthly.recurringDue)} recurring still due`);
      if (monthly.afterRecurring <= 0) parts.push('recurring payments cover the rest');
      else if (monthly.jobs !== null) parts.push(`${monthly.jobs} more job${s(monthly.jobs)} like your ${formatCurrency(Math.round(monthly.avgJob))} average`);
      else parts.push(`${formatCurrency(monthly.afterRecurring)} more to go`);
      hint = parts.join(' · ');
    }
    ladder.push(goalRow('target', 'Monthly goal', monthly.goal, monthly.pct, hint, monthly.reached));
  }

  if (yearly) {
    let hint;
    if (yearly.reached) hint = `Yearly goal reached 🎉 · ${formatCurrency(yearly.ytd - yearly.goal)} over`;
    else if (yearly.onTrack) hint = `At this pace you'll hit ${formatCurrency(Math.round(yearly.projected))} by December`;
    else hint = `On pace for ${formatCurrency(Math.round(yearly.projected))} · need ${formatCurrency(Math.round(yearly.neededPerMonth))}/mo to hit it`;
    ladder.push(goalRow('calendar', `${fc.year} goal`, yearly.goal, yearly.pct, hint, yearly.reached));
  } else if (fc.ytd > 0) {
    ladder.push(`
      <div class="goal-forecast">${icon('trendingUp', 13)} At this pace you'll collect <b class="num">${formatCurrency(Math.round(fc.projected))}</b> in ${fc.year}</div>`);
  }

  if (!ladder.length) {
    return `
      <button class="btn btn-secondary btn-sm" id="goal-btn" style="margin-bottom:14px;align-self:flex-start">
        ${icon('target', 14)} Set goals
      </button>`;
  }
  return `<div class="goal-box" id="goal-btn" title="Tap to edit goals">${ladder.join('')}</div>`;
}

function goalRow(ic, label, goal, pct, hint, reached) {
  return `
    <div class="goal-row">
      <div class="goal-head">
        <span class="goal-name">${icon(ic, 13)} ${label} · ${formatCurrency(goal)}</span>
        <span class="goal-pct num" style="color:${reached ? 'var(--green)' : 'var(--accent)'}">${pct}%</span>
      </div>
      <div class="bar-track" style="height:8px">
        <div class="bar-fill" style="width:0%;background:${reached ? 'var(--green)' : 'linear-gradient(90deg,var(--accent-light),var(--accent))'}" data-w="${pct}"></div>
      </div>
      <div class="goal-hint">${hint}</div>
    </div>`;
}

function openGoalModal() {
  const goals = getGoals();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title" style="display:flex;align-items:center;gap:9px">${icon('target', 18)} Your goals</div>
      <div class="modal-desc">The dashboard tracks what you've collected toward each goal and forecasts where you'll land at your current pace.</div>
      <div class="form-group">
        <label class="form-label">Monthly goal ($)</label>
        <input class="form-control" type="number" id="goal-month" min="0" step="1" placeholder="e.g. 3000" value="${goals.monthly ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Yearly goal ($)</label>
        <input class="form-control" type="number" id="goal-year" min="0" step="1" placeholder="e.g. 30000" value="${goals.yearly ?? ''}" />
      </div>
      <div class="modal-actions">
        ${goals.monthly || goals.yearly ? '<button class="btn btn-ghost" id="goal-clear" style="margin-right:auto;color:var(--red)">Remove</button>' : ''}
        <button class="btn btn-secondary" id="goal-cancel">Cancel</button>
        <button class="btn btn-primary" id="goal-save">Save Goals</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const monthEl = overlay.querySelector('#goal-month');
  const yearEl = overlay.querySelector('#goal-year');
  monthEl.focus();

  const rebuild = () => { overlay.remove(); if (_cache) build(_cache.businesses, _cache.assets, _cache.platforms, _cache.invoices); };
  overlay.querySelector('#goal-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#goal-save').addEventListener('click', () => {
    const monthly = parseFloat(monthEl.value) || 0;
    const yearly = parseFloat(yearEl.value) || 0;
    if (!(monthly > 0) && !(yearly > 0)) { monthEl.focus(); return; }
    setGoals({ monthly, yearly });
    haptic(12);
    rebuild();
  });
  overlay.querySelector('#goal-clear')?.addEventListener('click', () => { setGoals({ monthly: 0, yearly: 0 }); rebuild(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// helpers
const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
