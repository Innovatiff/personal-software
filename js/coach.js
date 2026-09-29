// ============================================
// Coach: client health, reminder copy, passive-vs-active balance,
// the weekly focus list and personal records. Pure functions over
// invoices / clients / assets (plus a little localStorage for the
// weekly check-offs).
// ============================================
import {
  paymentInfo, computeMRR, isoMonthKey, tsMonthKey, formatCurrency, formatShortDate,
  parseISO, dayOccurrence,
} from './utils.js';
import { nextMonthKey, monthLabel } from './insights.js';

const DAY = 86400000;
const num = v => Number(v) || 0;
const sum = list => list.reduce((s, i) => s + num(i.amount), 0);
const tsToDate = ts => (ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null);
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ── Client health ────────────────────────────────────────────

/**
 * 0–100 health score from the current payment status, on-time history
 * and missed months. Inactive clients are not scored.
 */
export function clientHealth(b, invoices = [], now = new Date()) {
  if (b.status === 'Inactive') return { score: null, label: 'Inactive', cls: 'off', notes: ['Inactive client'] };
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  let score = 100;
  const notes = [];

  const p = paymentInfo(b.dueDay, b.lastPaidDate, b.createdAt);
  if (p.key === 'overdue' && p.nextDue) {
    const days = Math.max(1, Math.round((today - p.nextDue) / DAY));
    score -= Math.min(45, 12 + days * 2);
    notes.push(`${plural(days, 'day')} overdue`);
  }

  const mine = invoices.filter(i => i.businessId === b.id && i.kind !== 'one-time' && i.status !== 'Unpaid' && i.paidDate);
  const dueDay = Number(b.dueDay);
  if (dueDay >= 1 && dueDay <= 31 && mine.length) {
    // Which billing cycle each payment covered, and how late it was
    const cycles = mine.map(i => {
      const paid = parseISO(i.paidDate);
      const y = paid.getFullYear(), m = paid.getMonth();
      const thisDue = dayOccurrence(dueDay, y, m);
      const lastDue = paid >= thisDue ? thisDue : dayOccurrence(dueDay, y, m - 1);
      const nextDue = paid >= thisDue ? dayOccurrence(dueDay, y, m + 1) : thisDue;
      const early = Math.round((nextDue - paid) / DAY) <= 7;     // paid ahead of the next cycle
      return { cycleKey: tsMonthKey(early ? nextDue : lastDue), lateDays: early ? 0 : Math.round((paid - lastDue) / DAY) };
    });
    const late = cycles.filter(c => c.lateDays > 3);            // 3-day grace
    if (late.length) {
      score -= Math.round(30 * late.length / cycles.length);
      const avg = Math.round(late.reduce((s, c) => s + c.lateDays, 0) / late.length);
      notes.push(`${late.length} of ${plural(cycles.length, 'payment')} late (avg ${avg}d)`);
    } else {
      notes.push(`${plural(cycles.length, 'on-time payment')}`);
    }
    // Completed cycles since the first one that have no payment
    const covered = new Set(cycles.map(c => c.cycleKey));
    const expected = [];
    let cursor = [...covered].sort()[0];
    while (cursor) {
      const [y, m] = cursor.split('-').map(Number);
      if (dayOccurrence(dueDay, y, m - 1) >= today) break;
      expected.push(cursor);
      cursor = nextMonthKey(cursor);
      if (expected.length > 60) break;
    }
    const missed = expected.filter(k => !covered.has(k)).length;
    if (missed) {
      score -= Math.min(24, missed * 8);
      notes.push(`${plural(missed, 'month')} without a payment`);
    }
  } else if (!mine.length) {
    const created = tsToDate(b.createdAt);
    const age = created ? Math.round((today - created) / DAY) : 0;
    if (age > 45 && b.status === 'Active') { score -= 20; notes.push('No payments recorded yet'); }
    else notes.push('No payment history yet');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Watch' : 'At risk';
  const cls = score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad';
  return { score, label, cls, notes };
}

// ── Reminder copy ────────────────────────────────────────────

export function reminderMessage({ clientName, amount, dueDate, number, service, issuer } = {}) {
  const what = service ? `${service.toLowerCase()} payment` : 'payment';
  const when = dueDate ? ` was due on ${formatShortDate(dueDate)}` : ' is now due';
  const body = [
    `Hi ${clientName || 'there'},`,
    '',
    `A friendly reminder from Innovatif: the ${what} of ${formatCurrency(num(amount))}${when}${number ? ` (invoice ${number})` : ''}.`,
    '',
    "If you've already sent it, thank you and please ignore this message. Otherwise, could you arrange the payment at your earliest convenience?",
    '',
    'Thanks so much,',
    issuer || 'Innovatif',
  ].join('\n');
  return { subject: `Payment reminder · ${formatCurrency(num(amount))} · Innovatif`, body };
}

// ── Passive vs active income ─────────────────────────────────

/**
 * Share of income over the last `days` that is passive (recurring
 * clients + asset income) versus active (one-time jobs), with the
 * change against the previous window.
 */
export function incomeBalance({ invoices = [], assets = [] } = {}, now = new Date(), days = 90) {
  const end = new Date(now); end.setDate(end.getDate() + 1);
  const cut = new Date(now); cut.setDate(cut.getDate() - days);
  const prevCut = new Date(now); prevCut.setDate(prevCut.getDate() - days * 2);
  const paid = invoices.filter(i => i.status !== 'Unpaid' && i.paidDate);
  const between = (from, to) => paid.filter(i => i.paidDate >= isoOf(from) && i.paidDate < isoOf(to));
  const split = list => ({ recurring: sum(list.filter(i => i.kind !== 'one-time')), oneTime: sum(list.filter(i => i.kind === 'one-time')) });

  const assetsIncome = assets.reduce((s, a) => s + num(a.monthlyIncome), 0) * (days / 30.4368);
  const cur = split(between(cut, end));
  const prev = split(between(prevCut, cut));

  const passive = cur.recurring + assetsIncome, active = cur.oneTime, total = passive + active;
  const pct = total > 0 ? Math.round((passive / total) * 100) : 0;
  const prevTotal = prev.recurring + assetsIncome + prev.oneTime;
  const prevPct = prevTotal > 0 ? Math.round(((prev.recurring + assetsIncome) / prevTotal) * 100) : null;

  return {
    days, passive, active, total, pct, prevPct,
    recurring: cur.recurring, assetsIncome, oneTime: cur.oneTime,
    delta: prevPct === null ? null : pct - prevPct,
    hasData: total > 0,
  };
}

// ── Weekly focus ─────────────────────────────────────────────

/** ISO week key, Monday-based: '2026-W40' */
export function weekKey(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weekRange(now = new Date()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  const start = new Date(d); start.setDate(d.getDate() - day + 1);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const f = x => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { start, end, label: `${f(start)} – ${f(end)}` };
}

/** Everything worth doing, most urgent first. */
export function focusCandidates({ businesses = [], invoices = [] } = {}, { streaks = null, forecast = null, locked = [] } = {}, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const items = [];

  businesses.forEach(b => {
    if (b.status === 'Inactive') return;
    const p = paymentInfo(b.dueDay, b.lastPaidDate, b.createdAt);
    const mrr = computeMRR(b.price, b.period, b.users);
    if (p.key === 'overdue' && p.nextDue) {
      const days = Math.max(1, Math.round((today - p.nextDue) / DAY));
      items.push({ id: `overdue:${b.id}`, prio: 100 + Math.min(days, 30), icon: 'alert', tone: 'red', title: `Chase ${b.name}`, sub: `${formatCurrency(mrr)} overdue by ${plural(days, 'day')}`, href: '#/businesses', cta: 'Remind', remind: b.id });
    } else if (p.key === 'due' && p.nextDue) {
      const days = Math.round((p.nextDue - today) / DAY);
      items.push({ id: `due:${b.id}`, prio: 70, icon: 'clock', tone: 'yellow', title: `Collect from ${b.name}`, sub: `${formatCurrency(mrr)} due ${days <= 0 ? 'today' : `in ${plural(days, 'day')}`}`, href: '#/businesses', cta: 'View' });
    }
    const last = invoices
      .filter(i => i.businessId === b.id && i.kind !== 'one-time')
      .sort((a, c) => ((c.issueDate || '') > (a.issueDate || '') ? 1 : -1))[0];
    if (last && num(b.users) > num(last.users) && num(last.users) > 0) {
      items.push({ id: `upsell:${b.id}`, prio: 60, icon: 'users', tone: 'blue', title: `${b.name} grew to ${b.users} users`, sub: `Last invoice covered ${last.users} — the next payment bills the new seats`, href: `#/businesses/${b.id}/edit`, cta: 'Review' });
    }
    const created = tsToDate(b.createdAt);
    if (b.status === 'Building' && created && (today - created) / DAY > 30) {
      items.push({ id: `launch:${b.id}`, prio: 55, icon: 'zap', tone: 'blue', title: `Launch ${b.name}?`, sub: `In Building for ${plural(Math.round((today - created) / DAY), 'day')} — set it Active once it's live`, href: `#/businesses/${b.id}/edit`, cta: 'Update' });
    }
  });

  invoices.filter(i => i.status === 'Unpaid').forEach(i => {
    const days = i.issueDate ? Math.max(0, Math.round((today - parseISO(i.issueDate)) / DAY)) : 0;
    items.push({ id: `unpaid:${i.id}`, prio: 90 + Math.min(days, 30), icon: 'receipt', tone: 'yellow', title: `Follow up on ${i.number || 'invoice'}`, sub: `${i.clientName || 'Client'} · ${formatCurrency(num(i.amount))} unpaid${days ? ` for ${plural(days, 'day')}` : ''}`, href: `#/invoices/${i.id}`, cta: 'Open', remindInvoice: i.id });
  });

  const jobDates = invoices.filter(i => i.kind === 'one-time' && i.issueDate).map(i => i.issueDate).sort();
  if (jobDates.length) {
    const since = Math.round((today - parseISO(jobDates[jobDates.length - 1])) / DAY);
    if (since >= 21) items.push({ id: 'job', prio: 50, icon: 'sparkle', tone: 'accent', title: 'Register a job you delivered', sub: `No one-time jobs in ${since} days — anything not invoiced yet?`, href: '#/invoices/new', cta: 'New invoice' });
  } else if (businesses.length) {
    items.push({ id: 'job', prio: 30, icon: 'sparkle', tone: 'accent', title: 'Register your first one-time job', sub: 'A logo, a landing page, a menu — bill it and it counts', href: '#/invoices/new', cta: 'New invoice' });
  }

  const m = forecast?.monthly;
  if (m && !m.reached) {
    const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
    items.push({ id: 'goal', prio: 45, icon: 'target', tone: 'accent', title: `${formatCurrency(m.remaining)} to your monthly goal`, sub: `${plural(daysLeft, 'day')} left${m.jobs ? ` · about ${plural(m.jobs, 'job')} like your ${formatCurrency(Math.round(m.avgJob))} average` : ''}`, href: '#/dashboard', cta: 'Track' });
  } else if (forecast && !forecast.monthly && !forecast.yearly && businesses.length) {
    items.push({ id: 'setgoal', prio: 25, icon: 'target', tone: 'accent', title: 'Set a monthly goal', sub: 'Goals unlock the forecast, goal streaks and two trophies', href: '#/dashboard', cta: 'Set goal' });
  }

  if (streaks && streaks.needed > 0 && !streaks.growthLive) {
    items.push({ id: 'streak', prio: streaks.growth > 0 ? 48 : 40, icon: 'flame', tone: 'hot', title: streaks.growth > 0 ? 'Keep the growth streak alive' : 'Start a growth streak', sub: `${formatCurrency(streaks.needed)} more this month beats last month`, href: '#/dashboard', cta: 'Track' });
  }

  const near = locked.find(t => t.pct >= 75 && !t.hint);
  if (near) items.push({ id: `trophy:${near.id}`, prio: 35, icon: 'trophy', tone: 'gold', title: `Unlock "${near.title}"`, sub: `${near.progress} · ${near.pct}% there`, href: '#/trophies', cta: 'Trophies' });

  if (!businesses.length) items.push({ id: 'client', prio: 80, icon: 'building2', tone: 'accent', title: 'Register your first client', sub: 'Recurring clients are the backbone of your MRR', href: '#/businesses/add', cta: 'Add client' });

  return items.sort((a, b) => b.prio - a.prio);
}

const focusStore = key => `inv-focus-${key}`;
const strip = ({ id, icon, tone, title, sub, href, cta, remind, remindInvoice }) => ({ id, icon, tone, title, sub, href, cta, remind, remindInvoice });

/**
 * This week's three items. The list is frozen when the week starts (so
 * items don't shuffle under you); an item that disappears from the data
 * (e.g. the overdue client paid) counts as resolved.
 */
export function weeklyFocus(data, extras = {}, now = new Date()) {
  const key = weekKey(now);
  const candidates = focusCandidates(data, extras, now);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(focusStore(key)) || 'null'); } catch {}
  if (!saved || !Array.isArray(saved.items)) saved = { items: [], done: [] };
  if (saved.items.length < 3) {
    const have = new Set(saved.items.map(i => i.id));
    candidates.filter(c => !have.has(c.id)).slice(0, 3 - saved.items.length).forEach(c => saved.items.push(strip(c)));
    try { localStorage.setItem(focusStore(key), JSON.stringify(saved)); } catch {}
  }
  const live = new Map(candidates.map(c => [c.id, c]));
  const items = saved.items.map(it => {
    const cur = live.get(it.id);
    const done = saved.done.includes(it.id);
    const state = done ? 'done' : cur ? 'open' : 'resolved';
    return { ...it, ...(cur ? strip(cur) : {}), state };
  });
  const completed = items.filter(i => i.state !== 'open').length;
  return { key, range: weekRange(now), items, completed, total: items.length, allDone: items.length > 0 && completed === items.length };
}

export function setFocusDone(key, id, done) {
  try {
    const saved = JSON.parse(localStorage.getItem(focusStore(key)) || '{"items":[],"done":[]}');
    saved.done = (saved.done || []).filter(x => x !== id);
    if (done) saved.done.push(id);
    localStorage.setItem(focusStore(key), JSON.stringify(saved));
  } catch {}
}

// ── Personal records ─────────────────────────────────────────

export const RECORD_LABELS = {
  month: 'Best month ever', day: 'Best day ever', payment: 'Biggest payment ever', job: 'Biggest job ever',
  payments: 'Most payments in a month', clients: 'Most clients in a month', streak: 'Longest growth streak',
};

export function computeRecords({ invoices = [] } = {}, streaks = null, now = new Date()) {
  const paid = invoices.filter(i => i.status !== 'Unpaid' && i.paidDate);
  const nowKey = tsMonthKey(now);
  const byMonth = {}, byDay = {}, payByMonth = {}, clientsByMonth = {};
  paid.forEach(i => {
    const k = isoMonthKey(i.paidDate);
    byMonth[k] = (byMonth[k] || 0) + num(i.amount);
    byDay[i.paidDate] = (byDay[i.paidDate] || 0) + num(i.amount);
    payByMonth[k] = (payByMonth[k] || 0) + 1;
    (clientsByMonth[k] = clientsByMonth[k] || new Set()).add(i.clientName || '');
  });
  const cbm = Object.fromEntries(Object.entries(clientsByMonth).map(([k, v]) => [k, v.size]));
  const top = obj => Object.keys(obj).sort((a, b) => obj[b] - obj[a] || (a > b ? -1 : 1))[0]; // ties → most recent
  const byAmount = (a, b) => num(b.amount) - num(a.amount) || ((b.paidDate || '') > (a.paidDate || '') ? 1 : -1);
  const best = top(byMonth), bestDay = top(byDay), mostPay = top(payByMonth), mostClients = top(cbm);
  const biggest = [...paid].sort(byAmount)[0];
  const bigJob = paid.filter(i => i.kind === 'one-time').sort(byAmount)[0];
  const growth = streaks ? Math.max(streaks.growth || 0, streaks.bestGrowth || 0) : 0;

  const rec = (id, icon, value, when, fmt, sub) => ({
    id, label: RECORD_LABELS[id], icon, value, when, fmt, sub,
    isNew: value > 0 && !!when && isoMonthKey(when) === nowKey,
  });
  return [
    rec('month', 'trendingUp', best ? byMonth[best] : 0, best ? `${best}-01` : '', 'cur', best ? monthLabel(best) : '—'),
    rec('day', 'zap', bestDay ? byDay[bestDay] : 0, bestDay || '', 'cur', bestDay ? formatShortDate(bestDay) : '—'),
    rec('payment', 'wallet', biggest ? num(biggest.amount) : 0, biggest?.paidDate || '', 'cur', biggest ? `${biggest.clientName || 'Client'} · ${formatShortDate(biggest.paidDate)}` : '—'),
    rec('job', 'sparkle', bigJob ? num(bigJob.amount) : 0, bigJob?.paidDate || '', 'cur', bigJob ? bigJob.description || bigJob.clientName || '' : '—'),
    rec('payments', 'receipt', mostPay ? payByMonth[mostPay] : 0, mostPay ? `${mostPay}-01` : '', 'int', mostPay ? monthLabel(mostPay) : '—'),
    rec('clients', 'users', mostClients ? cbm[mostClients] : 0, mostClients ? `${mostClients}-01` : '', 'int', mostClients ? monthLabel(mostClients) : '—'),
    rec('streak', 'flame', growth, streaks && streaks.growthLive && streaks.growth >= growth && growth > 0 ? `${nowKey}-01` : '', 'months', growth ? (streaks?.growth === growth ? 'Active now' : 'Personal best') : '—'),
  ];
}

/**
 * Records that a just-added invoice pushed past the previous best.
 * Period records (best month/day, most payments…) only count when this
 * payment makes the current period overtake an earlier one, so a record
 * month is not re-announced on every payment.
 */
export function newRecordsAfter(dataBefore, dataAfter, streaks = null, now = new Date()) {
  const before = Object.fromEntries(computeRecords(dataBefore, null, now).map(r => [r.id, r]));
  const periodOf = r => (r.id === 'day' ? r.when : isoMonthKey(r.when));
  const isPeriod = id => ['month', 'day', 'payments', 'clients'].includes(id);
  return computeRecords(dataAfter, streaks, now).filter(r => {
    if (r.id === 'streak' || r.value <= 0) return false;
    const b = before[r.id];
    if (!b || r.value <= b.value) return false;
    return !isPeriod(r.id) || !b.when || periodOf(b) !== periodOf(r);
  });
}

export function formatRecord(r) {
  if (r.fmt === 'cur') return formatCurrency(r.value);
  if (r.fmt === 'months') return `${r.value} mo`;
  return String(r.value);
}
