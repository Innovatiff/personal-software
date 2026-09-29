// ============================================
// Achievements: growth / goal streaks + milestone badges.
//
// Everything here is derived from invoices and clients, so the same
// trophies show on every device. The only local state is the list of
// badges that were already celebrated (so the payday banner only
// announces genuinely new ones).
// ============================================
import { getInvoices, getBusinesses } from './db.js';
import { isoMonthKey, tsMonthKey, lastMonths, formatCurrency, todayISO } from './utils.js';
import { payday } from './celebrate.js';
import { levelFor } from './insights.js';
import { newRecordsAfter } from './coach.js';

const num = v => Number(v) || 0;
const SEEN_KEY = 'inv-badges-seen';
const DAY = 86400000;

export function getGoal() {
  try { const g = parseFloat(localStorage.getItem('pf-goal')); return g > 0 ? g : null; }
  catch { return null; }
}

/** 'YYYY-MM' one month before the given key. */
function prevKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function tsToDate(ts) { return ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null; }
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Stats ────────────────────────────────────────────────────

export function computeStats({ invoices = [], businesses = [] } = {}) {
  const paid = invoices
    .filter(i => i.status !== 'Unpaid' && i.paidDate)
    .sort((a, b) => (a.paidDate > b.paidDate ? 1 : a.paidDate < b.paidDate ? -1 : 0));

  const byMonth = {};
  paid.forEach(i => { const k = isoMonthKey(i.paidDate); if (k) byMonth[k] = (byMonth[k] || 0) + num(i.amount); });

  const nowKey = tsMonthKey(new Date());
  const bestMonth = Object.keys(byMonth).reduce((b, k) => (byMonth[k] > b.total ? { key: k, total: byMonth[k] } : b), { key: '', total: 0 });

  return {
    invoices, businesses, paid, byMonth, nowKey,
    thisMonth: byMonth[nowKey] || 0,
    lastMonth: byMonth[prevKey(nowKey)] || 0,
    total: paid.reduce((s, i) => s + num(i.amount), 0),
    bestMonth,
    oneTimePaid: paid.filter(i => i.kind === 'one-time'),
  };
}

// ── Streaks ──────────────────────────────────────────────────

/**
 * Growth streak: consecutive months that each beat the month before.
 * The current month joins the streak as soon as it beats last month;
 * until then the streak is judged from the last completed month, so an
 * early-month dip never wipes it out.
 */
export function computeStreaks(stats, goal = getGoal()) {
  const months = lastMonths(36);
  const totals = months.map(m => stats.byMonth[m.key] || 0);
  const last = totals.length - 1;

  // A month "grows" when it beats a previous month that had real revenue
  const grew = (k) => totals[k - 1] > 0 && totals[k] > totals[k - 1];

  const growthLive = grew(last);
  let i = growthLive ? last : last - 1;
  let growth = 0;
  while (i >= 1 && grew(i)) { growth++; i--; }

  // Longest growth run in history (badges stay earned even if a streak breaks)
  let bestGrowth = 0, run = 0;
  for (let k = 1; k < totals.length; k++) {
    run = grew(k) ? run + 1 : 0;
    bestGrowth = Math.max(bestGrowth, run);
  }

  let goalStreak = 0, goalLive = false, goalMonths = 0;
  if (goal) {
    goalLive = totals[last] >= goal;
    let j = goalLive ? last : last - 1;
    while (j >= 0 && totals[j] >= goal) { goalStreak++; j--; }
    goalMonths = totals.filter(t => t >= goal).length;
  }

  // What it takes to extend the streak this month
  const needed = Math.max(0, stats.lastMonth - stats.thisMonth);

  return { growth, growthLive, bestGrowth, goal: goalStreak, goalLive, goalMonths, goalAmount: goal, needed };
}

// ── Milestones ───────────────────────────────────────────────

const $ = v => formatCurrency(v);

export const MILESTONES = [
  // Revenue (lifetime collected)
  { id: 'total-1', group: 'Revenue', icon: 'wallet', title: 'First dollar', desc: 'Collect your very first payment', metric: 'total', target: 1 },
  { id: 'total-1k', group: 'Revenue', icon: 'coins', title: 'First $1k', desc: 'Collect $1,000 in total', metric: 'total', target: 1000 },
  { id: 'total-5k', group: 'Revenue', icon: 'coins', title: '$5k collected', desc: 'Collect $5,000 in total', metric: 'total', target: 5000 },
  { id: 'total-10k', group: 'Revenue', icon: 'trendingUp', title: 'Five figures', desc: 'Collect $10,000 in total', metric: 'total', target: 10000 },
  { id: 'total-25k', group: 'Revenue', icon: 'trendingUp', title: '$25k club', desc: 'Collect $25,000 in total', metric: 'total', target: 25000 },
  { id: 'total-50k', group: 'Revenue', icon: 'medal', title: 'Halfway to six', desc: 'Collect $50,000 in total', metric: 'total', target: 50000 },
  { id: 'total-100k', group: 'Revenue', icon: 'trophy', title: 'Six figures', desc: 'Collect $100,000 in total', metric: 'total', target: 100000 },

  // Momentum (single month, streaks, goals)
  { id: 'month-1k', group: 'Momentum', icon: 'activity', title: '$1k month', desc: 'Collect $1,000 in a single month', metric: 'month', target: 1000 },
  { id: 'month-2500', group: 'Momentum', icon: 'activity', title: '$2.5k month', desc: 'Collect $2,500 in a single month', metric: 'month', target: 2500 },
  { id: 'month-5k', group: 'Momentum', icon: 'zap', title: '$5k month', desc: 'Collect $5,000 in a single month', metric: 'month', target: 5000 },
  { id: 'month-10k', group: 'Momentum', icon: 'zap', title: '$10k month', desc: 'Collect $10,000 in a single month', metric: 'month', target: 10000 },
  { id: 'streak-2', group: 'Momentum', icon: 'flame', title: 'Heating up', desc: 'Grow revenue 2 months in a row', metric: 'streak', target: 2 },
  { id: 'streak-3', group: 'Momentum', icon: 'flame', title: 'On fire', desc: 'Grow revenue 3 months in a row', metric: 'streak', target: 3 },
  { id: 'streak-6', group: 'Momentum', icon: 'flame', title: 'Unstoppable', desc: 'Grow revenue 6 months in a row', metric: 'streak', target: 6 },
  { id: 'goal-1', group: 'Momentum', icon: 'target', title: 'Goal getter', desc: 'Hit your monthly goal', metric: 'goal', target: 1 },
  { id: 'goal-3', group: 'Momentum', icon: 'target', title: 'Hat-trick', desc: 'Hit your monthly goal 3 times', metric: 'goal', target: 3 },

  // Clients
  { id: 'clients-1', group: 'Clients', icon: 'building2', title: 'First client', desc: 'Register your first client', metric: 'clients', target: 1 },
  { id: 'clients-3', group: 'Clients', icon: 'building2', title: 'Trio', desc: 'Register 3 clients', metric: 'clients', target: 3 },
  { id: 'clients-5', group: 'Clients', icon: 'users', title: 'High five', desc: 'Register 5 clients', metric: 'clients', target: 5 },
  { id: 'clients-10', group: 'Clients', icon: 'users', title: 'Double digits', desc: 'Register 10 clients', metric: 'clients', target: 10 },
  { id: 'clients-25', group: 'Clients', icon: 'trophy', title: 'Agency scale', desc: 'Register 25 clients', metric: 'clients', target: 25 },
  { id: 'anniversary', group: 'Clients', icon: 'calendar', title: 'One-year client', desc: 'Keep a client for a full year', metric: 'anniversary', target: 365 },

  // Jobs (one-time services)
  { id: 'jobs-1', group: 'Jobs', icon: 'sparkle', title: 'First gig', desc: 'Get paid for a one-time job', metric: 'jobs', target: 1 },
  { id: 'jobs-5', group: 'Jobs', icon: 'sparkle', title: 'Side hustler', desc: 'Get paid for 5 one-time jobs', metric: 'jobs', target: 5 },
  { id: 'jobs-10', group: 'Jobs', icon: 'star', title: 'Ten jobs', desc: 'Get paid for 10 one-time jobs', metric: 'jobs', target: 10 },
  { id: 'jobs-25', group: 'Jobs', icon: 'star', title: 'Freelance pro', desc: 'Get paid for 25 one-time jobs', metric: 'jobs', target: 25 },
  { id: 'jobs-50', group: 'Jobs', icon: 'medal', title: 'Fifty jobs', desc: 'Get paid for 50 one-time jobs', metric: 'jobs', target: 50 },
  { id: 'bigjob-500', group: 'Jobs', icon: 'dollar', title: 'Big ticket', desc: 'A single job worth $500 or more', metric: 'bigJob', target: 500 },
  { id: 'bigjob-1k', group: 'Jobs', icon: 'dollar', title: 'Four-figure job', desc: 'A single job worth $1,000 or more', metric: 'bigJob', target: 1000 },

  // Invoices
  { id: 'inv-1', group: 'Invoices', icon: 'receipt', title: 'First invoice', desc: 'Create your first invoice', metric: 'invoices', target: 1 },
  { id: 'inv-10', group: 'Invoices', icon: 'receipt', title: 'Paper trail', desc: 'Create 10 invoices', metric: 'invoices', target: 10 },
  { id: 'inv-50', group: 'Invoices', icon: 'fileText', title: 'Fifty invoices', desc: 'Create 50 invoices', metric: 'invoices', target: 50 },
  { id: 'inv-100', group: 'Invoices', icon: 'trophy', title: 'Century', desc: 'Create 100 invoices', metric: 'invoices', target: 100 },
];

export const GROUPS = ['Revenue', 'Momentum', 'Clients', 'Jobs', 'Invoices'];

/** Date the cumulative sum of `list` (sorted) first reaches `target`. */
function crossedAt(list, target, amountOf, dateOf) {
  let cum = 0;
  for (const it of list) { cum += amountOf(it); if (cum >= target) return dateOf(it); }
  return null;
}

/** Evaluate every milestone → { ...def, earnedAt, value, pct, progress } */
export function evaluateMilestones(stats, streaks = computeStreaks(stats)) {
  const clients = [...stats.businesses]
    .map(b => ({ ...b, _d: tsToDate(b.createdAt) }))
    .filter(b => b._d)
    .sort((a, b) => a._d - b._d);
  const allInv = [...stats.invoices]
    .filter(i => i.issueDate)
    .sort((a, b) => (a.issueDate > b.issueDate ? 1 : -1));
  const now = new Date();
  const oldestAge = clients.length ? Math.floor((now - clients[0]._d) / DAY) : 0;
  const goal = streaks.goalAmount;

  // Months (in order) where the goal was reached, with the day it happened
  const goalHits = [];
  if (goal) {
    Object.keys(stats.byMonth).sort().forEach(k => {
      if (stats.byMonth[k] >= goal) {
        const inMonth = stats.paid.filter(i => isoMonthKey(i.paidDate) === k);
        goalHits.push(crossedAt(inMonth, goal, i => num(i.amount), i => i.paidDate) || `${k}-01`);
      }
    });
  }

  // Month (in order) where a growth streak of length n was first reached
  const months = lastMonths(36);
  const totals = months.map(m => stats.byMonth[m.key] || 0);
  const streakReached = (n) => {
    let run = 0;
    for (let k = 1; k < totals.length; k++) {
      run = totals[k - 1] > 0 && totals[k] > totals[k - 1] ? run + 1 : 0;
      if (run >= n) return `${months[k].key}-01`;
    }
    return null;
  };

  const metrics = {
    total: (t) => ({
      value: stats.total, earnedAt: crossedAt(stats.paid, t, i => num(i.amount), i => i.paidDate), fmt: 'cur',
    }),
    month: (t) => {
      let earnedAt = null;
      for (const k of Object.keys(stats.byMonth).sort()) {
        if (stats.byMonth[k] >= t) {
          earnedAt = crossedAt(stats.paid.filter(i => isoMonthKey(i.paidDate) === k), t, i => num(i.amount), i => i.paidDate);
          break;
        }
      }
      return { value: stats.bestMonth.total, earnedAt, fmt: 'cur' };
    },
    streak: (t) => ({ value: Math.max(streaks.growth, streaks.bestGrowth), earnedAt: streakReached(t), fmt: 'months' }),
    goal: (t) => ({ value: goalHits.length, earnedAt: goalHits[t - 1] || null, fmt: 'months', hint: goal ? '' : 'Set a monthly goal on the dashboard' }),
    clients: (t) => ({ value: clients.length, earnedAt: clients[t - 1] ? toISO(clients[t - 1]._d) : null, fmt: 'count' }),
    anniversary: (t) => ({
      value: Math.min(oldestAge, t),
      earnedAt: oldestAge >= t ? toISO(new Date(clients[0]._d.getTime() + t * DAY)) : null, fmt: 'days',
    }),
    jobs: (t) => ({ value: stats.oneTimePaid.length, earnedAt: stats.oneTimePaid[t - 1]?.paidDate || null, fmt: 'count' }),
    bigJob: (t) => {
      const hit = stats.oneTimePaid.find(i => num(i.amount) >= t);
      const max = stats.oneTimePaid.reduce((m, i) => Math.max(m, num(i.amount)), 0);
      return { value: max, earnedAt: hit ? hit.paidDate : null, fmt: 'cur' };
    },
    invoices: (t) => ({ value: allInv.length, earnedAt: allInv[t - 1]?.issueDate || null, fmt: 'count' }),
  };

  return MILESTONES.map(def => {
    const r = metrics[def.metric](def.target);
    const value = r.value || 0;
    const pct = r.earnedAt ? 100 : Math.min(99, Math.floor((value / def.target) * 100));
    return { ...def, earnedAt: r.earnedAt, value, pct, progress: progressLabel(value, def.target, r.fmt), hint: r.hint || '' };
  });
}

function progressLabel(value, target, fmt) {
  if (fmt === 'cur') return `${$(Math.min(value, target))} / ${$(target)}`;
  if (fmt === 'days') return `${Math.min(value, target)} / ${target} days`;
  if (fmt === 'months') return `${Math.min(value, target)} / ${target} months`;
  return `${Math.min(value, target)} / ${target}`;
}

// ── "Seen" tracking (per device) ─────────────────────────────

function seenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
export function unseenEarned(milestones) {
  const seen = seenSet();
  return milestones.filter(m => m.earnedAt && !seen.has(m.id));
}
export function markSeen(ids) {
  try {
    const seen = seenSet();
    ids.forEach(id => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

// ── Convenience: everything at once ──────────────────────────

export function achievementsFor(data) {
  const stats = computeStats(data);
  const streaks = computeStreaks(stats);
  const milestones = evaluateMilestones(stats, streaks);
  const earned = milestones.filter(m => m.earnedAt).sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1));
  const locked = milestones.filter(m => !m.earnedAt).sort((a, b) => b.pct - a.pct);
  return { stats, streaks, milestones, earned, locked, fresh: unseenEarned(milestones) };
}

/**
 * Called right after money is collected (Mark Paid, paid invoice created).
 * Reloads data, works out streaks + newly unlocked badges, then celebrates.
 */
export async function celebrateCollection({ amount, clientName, origin } = {}) {
  let data = { invoices: [], businesses: [] };
  try {
    const [invoices, businesses] = await Promise.all([getInvoices().catch(() => []), getBusinesses().catch(() => [])]);
    data = { invoices, businesses };
  } catch {}
  const a = achievementsFor(data);
  markSeen(a.fresh.map(m => m.id));
  const after = levelFor(a.stats.total);
  const before = levelFor(a.stats.total - (Number(amount) || 0));

  // Did this payment set a personal record? Compare against the data without it.
  const amt = Number(amount) || 0, today = todayISO();
  const idx = data.invoices.findIndex(i => i.status !== 'Unpaid' && i.paidDate === today && i.clientName === clientName && Math.abs((Number(i.amount) || 0) - amt) < 0.005);
  const records = idx >= 0
    ? newRecordsAfter({ invoices: data.invoices.filter((_, k) => k !== idx) }, { invoices: data.invoices }, a.streaks)
    : [];

  payday({
    amount, clientName, origin,
    monthTotal: a.stats.thisMonth,
    lastMonth: a.stats.lastMonth,
    streaks: a.streaks,
    badges: a.fresh,
    records,
    xp: { gained: amt, level: after, leveledUp: after.index > before.index },
  });
}
