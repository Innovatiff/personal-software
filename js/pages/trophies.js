import { getInvoices, getBusinesses } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, formatShortDate } from '../utils.js';
import { icon } from '../icons.js';
import { achievementsFor, markSeen, GROUPS } from '../achievements.js';
import { levelFor } from '../insights.js';
import { animateCharts, countUps } from '../anim.js';

/**
 * Trophies: growth / goal streaks, best month, and every milestone badge
 * (earned with its date, or locked with progress toward it).
 */
export async function renderTrophies() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('trophies')}
    <div class="main-content">
      ${renderTopbar('Trophies', { noAdd: true })}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Trophies</h1>
          <p class="page-desc">Streaks, records and milestones on your way up</p>
        </div>
        <div class="streak-grid">${Array(3).fill('<div class="skeleton" style="height:92px;border-radius:var(--radius-lg)"></div>').join('')}</div>
        <div class="skeleton" style="height:84px;border-radius:var(--radius-lg);margin-bottom:26px"></div>
        <div class="badge-grid">${Array(6).fill('<div class="skeleton" style="height:96px;border-radius:var(--radius)"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let invoices = [], businesses = [];
  try {
    [invoices, businesses] = await Promise.all([getInvoices().catch(() => []), getBusinesses().catch(() => [])]);
  } catch (err) { console.error(err); }

  const a = achievementsFor({ invoices, businesses });
  const freshIds = new Set(a.fresh.map(m => m.id));
  markSeen(a.earned.map(m => m.id)); // everything is "seen" once you visit this page
  build(a, freshIds);
}

function build(a, freshIds) {
  const { stats, streaks, milestones, earned } = a;
  const total = milestones.length;
  const pct = total ? Math.round((earned.length / total) * 100) : 0;

  const growthSub = streaks.growth > 0
    ? (streaks.growthLive ? 'This month already beats last month' : `${formatCurrency(streaks.needed)} more this month keeps it alive`)
    : (stats.lastMonth > 0 ? `Beat last month's ${formatCurrency(stats.lastMonth)} to start one` : 'Grow revenue two months in a row');
  const goalSub = streaks.goalAmount
    ? (streaks.goalLive ? `Goal of ${formatCurrency(streaks.goalAmount)} reached this month` : `${formatCurrency(Math.max(0, streaks.goalAmount - stats.thisMonth))} to go this month`)
    : 'Set a monthly goal on the dashboard';
  const best = stats.bestMonth.total > 0 ? stats.bestMonth : null;
  const bestLabel = best ? new Date(Number(best.key.slice(0, 4)), Number(best.key.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'No payments yet';
  const lv = levelFor(stats.total);

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Trophies</h1>
      <p class="page-desc">${earned.length} of ${total} unlocked · streaks, records and milestones on your way up</p>
    </div>

    <div class="streak-grid">
      <div class="streak-card level-card">
        <div class="streak-icon level">${icon('medal', 24, { strokeWidth: 2 })}</div>
        <div style="min-width:0;flex:1">
          <div class="streak-value">Level ${lv.level}<small>${lv.name}</small></div>
          <div class="xp-track" style="margin:8px 0 6px"><i data-w="${lv.pct}"></i></div>
          <div class="streak-sub"><span class="num">${formatCurrency(lv.xp)}</span> XP${lv.next ? ` · ${formatCurrency(lv.toNext)} to ${lv.next.name}` : ' · max level'}</div>
        </div>
      </div>
      <div class="streak-card">
        <div class="streak-icon ${streaks.growth > 0 ? 'hot' : ''}">${icon('flame', 24, { strokeWidth: 2 })}</div>
        <div style="min-width:0">
          <div class="streak-value"><span data-count="${streaks.growth}" data-fmt="int">${streaks.growth}</span><small>month${streaks.growth === 1 ? '' : 's'}</small></div>
          <div class="streak-label">Growth streak</div>
          <div class="streak-sub">${growthSub}</div>
        </div>
      </div>
      <div class="streak-card" style="animation-delay:0.05s">
        <div class="streak-icon ${streaks.goal > 0 ? 'goal' : ''}">${icon('target', 24, { strokeWidth: 2 })}</div>
        <div style="min-width:0">
          <div class="streak-value"><span data-count="${streaks.goal}" data-fmt="int">${streaks.goal}</span><small>month${streaks.goal === 1 ? '' : 's'}</small></div>
          <div class="streak-label">Goal streak</div>
          <div class="streak-sub">${goalSub}</div>
        </div>
      </div>
      <div class="streak-card" style="animation-delay:0.1s">
        <div class="streak-icon best">${icon('trendingUp', 24, { strokeWidth: 2 })}</div>
        <div style="min-width:0">
          <div class="streak-value" data-count="${best ? best.total : 0}" data-fmt="cur">${formatCurrency(best ? best.total : 0)}</div>
          <div class="streak-label">Best month</div>
          <div class="streak-sub">${bestLabel}</div>
        </div>
      </div>
    </div>

    <div class="trophy-progress">
      <div class="tp-icon">${icon('trophy', 22, { strokeWidth: 2 })}</div>
      <div class="tp-main">
        <div class="tp-title">${headline(earned.length, total)}</div>
        <div class="tp-sub">${a.locked.length ? `Next up: ${escHtml(a.locked[0].title)} · ${a.locked[0].progress}` : 'Every trophy unlocked. Legend.'}</div>
        <div class="tp-bar"><i data-w="${pct}"></i></div>
      </div>
      <div class="tp-count num">${earned.length}<small>/${total}</small></div>
    </div>

    ${GROUPS.map(g => {
      const list = milestones.filter(m => m.group === g);
      const done = list.filter(m => m.earnedAt).length;
      return `
        <div class="badge-group">
          <div class="badge-group-title">${g} <span class="cnt">${done}/${list.length}</span></div>
          <div class="badge-grid">${list.map((m, i) => badgeCard(m, freshIds.has(m.id), i)).join('')}</div>
        </div>`;
    }).join('')}
  `;

  countUps(content);
  animateCharts(content);
}

function badgeCard(m, isNew, i) {
  const earned = !!m.earnedAt;
  return `
    <div class="badge-card ${earned ? 'earned' : 'locked'}" style="animation-delay:${Math.min(i, 8) * 0.04}s">
      <div class="badge-tile">${icon(earned ? m.icon : 'lock', 20, { strokeWidth: 2 })}</div>
      <div class="badge-main">
        <div class="badge-title">${escHtml(m.title)}${isNew ? '<span class="badge-new">NEW</span>' : ''}</div>
        <div class="badge-desc">${escHtml(m.desc)}</div>
        ${earned
          ? `<div class="badge-date">${icon('check', 12, { strokeWidth: 3 })} Earned ${formatShortDate(m.earnedAt)}</div>`
          : `<div class="badge-progress">
               <div class="bar-track"><div class="bar-fill" style="width:0%;background:var(--accent)" data-w="${m.pct}"></div></div>
               <div class="badge-progress-label"><span>${m.hint ? escHtml(m.hint) : m.progress}</span><span class="num">${m.pct}%</span></div>
             </div>`}
      </div>
    </div>`;
}

function headline(n, total) {
  if (n === 0) return 'Your trophy case is waiting';
  if (n < 5) return 'Off to a great start';
  if (n < total / 2) return 'Building momentum';
  if (n < total) return 'More than halfway there';
  return 'Trophy case complete';
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
