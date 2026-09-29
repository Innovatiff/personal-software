// ============================================
// Insights: business levels (XP), monthly recap numbers and the
// goal ladder / forecast. Pure functions over invoices + clients.
// ============================================
import { isoMonthKey, tsMonthKey, computeMRR } from './utils.js';

const num = v => Number(v) || 0;
const sum = list => list.reduce((s, i) => s + num(i.amount), 0);

export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(key, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', opts);
}

// ── Levels ───────────────────────────────────────────────────
// Lifetime collected revenue is your XP. Thresholds are spaced so the
// bar keeps moving early on and the big names take real work.

export const LEVELS = [
  { name: 'Starter',    min: 0 },
  { name: 'Hustler',    min: 500 },
  { name: 'Freelancer', min: 2000 },
  { name: 'Pro',        min: 5000 },
  { name: 'Studio',     min: 12000 },
  { name: 'Agency',     min: 30000 },
  { name: 'Powerhouse', min: 60000 },
  { name: 'Empire',     min: 100000 },
  { name: 'Legend',     min: 250000 },
];

export function levelFor(total) {
  const xp = Math.max(0, num(total));
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1] || null;
  const span = next ? next.min - cur.min : 1;
  const pct = next ? Math.min(100, Math.floor(((xp - cur.min) / span) * 100)) : 100;
  return { index: i, level: i + 1, name: cur.name, min: cur.min, next, pct, toNext: next ? next.min - xp : 0, xp, max: LEVELS.length };
}

// ── Monthly recap ────────────────────────────────────────────

export function monthRecap({ invoices = [], businesses = [] } = {}, key) {
  const paidAll = invoices.filter(i => i.status !== 'Unpaid' && i.paidDate);
  const inMonth = paidAll.filter(i => isoMonthKey(i.paidDate) === key);
  const prev = paidAll.filter(i => isoMonthKey(i.paidDate) === prevMonthKey(key));
  const total = sum(inMonth), prevTotal = sum(prev);
  const oneTime = inMonth.filter(i => i.kind === 'one-time');
  const recurring = inMonth.filter(i => i.kind !== 'one-time');

  const byClient = {};
  inMonth.forEach(i => { const n = i.clientName || 'Client'; byClient[n] = (byClient[n] || 0) + num(i.amount); });
  const bestName = Object.keys(byClient).sort((a, b) => byClient[b] - byClient[a])[0];

  const byDay = {};
  inMonth.forEach(i => { byDay[i.paidDate] = (byDay[i.paidDate] || 0) + num(i.amount); });
  const bestDayKey = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0];

  const biggest = [...oneTime].sort((a, b) => num(b.amount) - num(a.amount))[0];
  const newClients = businesses.filter(b => tsMonthKey(b.createdAt) === key).length;

  // Lifetime total at the end of that month (for the level slide)
  const lifetimeThrough = sum(paidAll.filter(i => isoMonthKey(i.paidDate) <= key));

  return {
    key,
    monthName: monthLabel(key, { month: 'long' }),
    label: monthLabel(key),
    year: key.slice(0, 4),
    total, prevTotal,
    delta: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    payments: inMonth.length,
    oneTimeCount: oneTime.length, oneTimeTotal: sum(oneTime),
    recurringCount: recurring.length, recurringTotal: sum(recurring),
    clientsPaid: Object.keys(byClient).length,
    bestClient: bestName ? { name: bestName, amount: byClient[bestName], share: total ? Math.round((byClient[bestName] / total) * 100) : 0 } : null,
    biggestJob: biggest ? { description: biggest.description || 'One-time job', amount: num(biggest.amount), clientName: biggest.clientName || '' } : null,
    bestDay: bestDayKey ? { date: bestDayKey, amount: byDay[bestDayKey], count: inMonth.filter(i => i.paidDate === bestDayKey).length } : null,
    newClients,
    lifetimeThrough,
  };
}

// ── Goals (stored on this device) ────────────────────────────

export function getGoals() {
  const read = (k) => { try { const v = parseFloat(localStorage.getItem(k)); return v > 0 ? v : null; } catch { return null; } };
  return { monthly: read('pf-goal'), yearly: read('pf-goal-year') };
}
export function setGoals({ monthly, yearly }) {
  const write = (k, v) => { try { v > 0 ? localStorage.setItem(k, String(v)) : localStorage.removeItem(k); } catch {} };
  write('pf-goal', monthly);
  write('pf-goal-year', yearly);
}

// ── Forecast + goal ladder ───────────────────────────────────

/**
 * Year-end projection at the current pace, plus what it takes to hit
 * the monthly and yearly goals.
 */
export function forecast({ invoices = [], businesses = [] } = {}, goals = getGoals(), now = new Date()) {
  const year = now.getFullYear();
  const nowKey = tsMonthKey(now);
  const paid = invoices.filter(i => i.status !== 'Unpaid' && i.paidDate);
  const ytdList = paid.filter(i => i.paidDate.startsWith(String(year)));
  const ytd = sum(ytdList);
  const thisMonth = sum(paid.filter(i => isoMonthKey(i.paidDate) === nowKey));

  // Pace = average per active month this year (from the first paid month, current month pro-rated)
  const firstKey = ytdList.map(i => isoMonthKey(i.paidDate)).sort()[0] || nowKey;
  const firstMonth = Number(firstKey.slice(5, 7));
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthFrac = now.getDate() / daysInMonth;
  const activeMonths = Math.max(monthFrac, (now.getMonth() + 1 - firstMonth) + monthFrac);
  const avgMonthly = activeMonths > 0 ? ytd / activeMonths : 0;
  const monthsRemaining = (12 - (now.getMonth() + 1)) + (1 - monthFrac);
  const projected = ytd + avgMonthly * monthsRemaining;

  // Average one-time job → "N more jobs like that"
  const jobs = paid.filter(i => i.kind === 'one-time');
  const avgJob = jobs.length ? sum(jobs) / jobs.length : 0;

  // Recurring revenue from active clients that have not paid yet this month
  const recurringDue = businesses
    .filter(b => b.status === 'Active' && isoMonthKey(b.lastPaidDate || '') !== nowKey)
    .reduce((s, b) => s + computeMRR(b.price, b.period, b.users), 0);

  let monthly = null;
  if (goals.monthly) {
    const goal = goals.monthly;
    const remaining = Math.max(0, goal - thisMonth);
    const afterRecurring = Math.max(0, remaining - recurringDue);
    monthly = {
      goal, collected: thisMonth,
      pct: Math.min(100, Math.round((thisMonth / goal) * 100)),
      remaining, recurringDue: Math.min(recurringDue, remaining), afterRecurring,
      jobs: avgJob > 0 ? Math.ceil(afterRecurring / avgJob) : null,
      avgJob, reached: thisMonth >= goal,
    };
  }

  let yearly = null;
  if (goals.yearly) {
    const goal = goals.yearly;
    yearly = {
      goal, ytd,
      pct: Math.min(100, Math.round((ytd / goal) * 100)),
      remaining: Math.max(0, goal - ytd),
      projected, onTrack: projected >= goal,
      neededPerMonth: monthsRemaining > 0 ? Math.max(0, goal - ytd) / monthsRemaining : 0,
      reached: ytd >= goal,
    };
  }

  return { year, ytd, thisMonth, avgMonthly, projected, monthsRemaining, activeMonths, avgJob, recurringDue, monthly, yearly };
}
