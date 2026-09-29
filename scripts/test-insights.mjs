// Unit tests for levels, monthly recap and forecast (node scripts/test-insights.mjs)
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
const { levelFor, LEVELS, monthRecap, forecast, getGoals, setGoals, prevMonthKey, nextMonthKey } = await import('../js/insights.js');

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

// ── Levels ──
eq('level 1 at $0', [levelFor(0).level, levelFor(0).name, levelFor(0).pct], [1, 'Starter', 0]);
eq('level 2 at $500', [levelFor(500).level, levelFor(500).name], [2, 'Hustler']);
eq('halfway through Freelancer', [levelFor(3500).name, levelFor(3500).pct, levelFor(3500).toNext], ['Freelancer', 50, 1500]);
eq('max level', [levelFor(1e6).name, levelFor(1e6).next, levelFor(1e6).pct], ['Legend', null, 100]);
eq('thresholds ascend', LEVELS.every((l, i) => !i || l.min > LEVELS[i - 1].min), true);

// ── Month keys ──
eq('prevMonthKey crosses year', prevMonthKey('2026-01'), '2025-12');
eq('nextMonthKey crosses year', nextMonthKey('2026-12'), '2027-01');

// ── Recap ──
{
  const inv = [
    { status: 'Paid', paidDate: '2026-09-02', amount: 150, kind: 'recurring', clientName: 'Acme' },
    { status: 'Paid', paidDate: '2026-09-12', amount: 400, kind: 'one-time', clientName: "Maria's", description: 'Menu design' },
    { status: 'Paid', paidDate: '2026-09-12', amount: 1500, kind: 'recurring', clientName: 'PizzaHub' },
    { status: 'Paid', paidDate: '2026-09-20', amount: 850, kind: 'one-time', clientName: 'Studio', description: 'Brand kit' },
    { status: 'Unpaid', issueDate: '2026-09-21', amount: 999, kind: 'one-time', clientName: 'Nope' },
    { status: 'Paid', paidDate: '2026-08-15', amount: 1000, kind: 'recurring', clientName: 'Acme' },
  ];
  const biz = [{ name: 'New', createdAt: new Date(2026, 8, 5) }, { name: 'Old', createdAt: new Date(2026, 1, 5) }];
  const r = monthRecap({ invoices: inv, businesses: biz }, '2026-09');
  eq('recap total excludes unpaid', r.total, 2900);
  eq('recap delta vs previous month', r.delta, 190);
  eq('recap payment split', [r.payments, r.recurringCount, r.oneTimeCount, r.oneTimeTotal], [4, 2, 2, 1250]);
  eq('recap MVP client', [r.bestClient.name, r.bestClient.amount, r.bestClient.share], ['PizzaHub', 1500, 52]);
  eq('recap biggest one-time job', [r.biggestJob.description, r.biggestJob.amount], ['Brand kit', 850]);
  eq('recap best day sums same-day payments', [r.bestDay.date, r.bestDay.amount, r.bestDay.count], ['2026-09-12', 1900, 2]);
  eq('recap new clients that month', r.newClients, 1);
  eq('recap lifetime through month', r.lifetimeThrough, 3900);
  eq('recap labels', [r.monthName, r.label, r.year], ['September', 'September 2026', '2026']);
  const empty = monthRecap({ invoices: inv, businesses: biz }, '2026-05');
  eq('empty month', [empty.total, empty.payments, empty.bestClient, empty.delta], [0, 0, null, null]);
}

// ── Forecast ──
{
  // "Now" = Sep 15 2026 (30-day month → half way). Paid since March.
  const now = new Date(2026, 8, 15);
  const inv = [
    { status: 'Paid', paidDate: '2026-03-10', amount: 1000, kind: 'recurring' },
    { status: 'Paid', paidDate: '2026-06-10', amount: 2000, kind: 'recurring' },
    { status: 'Paid', paidDate: '2026-09-05', amount: 500, kind: 'one-time' },
    { status: 'Paid', paidDate: '2026-09-10', amount: 300, kind: 'one-time' },
    { status: 'Paid', paidDate: '2025-12-10', amount: 9999, kind: 'recurring' }, // last year, ignored
  ];
  const biz = [
    { name: 'A', status: 'Active', price: 200, period: 'Monthly', users: 1, lastPaidDate: '2026-08-20' }, // still due this month
    { name: 'B', status: 'Active', price: 100, period: 'Monthly', users: 1, lastPaidDate: '2026-09-02' }, // already paid
    { name: 'C', status: 'Inactive', price: 500, period: 'Monthly', users: 1 },
  ];
  const f = forecast({ invoices: inv, businesses: biz }, { monthly: 2000, yearly: 12000 }, now);
  eq('ytd only counts this year', f.ytd, 3800);
  eq('active months = Mar..Sep with half of Sep', f.activeMonths, 6.5);
  eq('months remaining = 3 + half of Sep', f.monthsRemaining, 3.5);
  eq('projected = ytd + pace × remaining', Math.round(f.projected), Math.round(3800 + (3800 / 6.5) * 3.5));
  eq('average one-time job', f.avgJob, 400);
  eq('recurring still due counts only unpaid active clients', f.recurringDue, 200);
  eq('monthly hint: remaining, after recurring, jobs needed', [f.monthly.remaining, f.monthly.afterRecurring, f.monthly.jobs], [1200, 1000, 3]);
  eq('monthly pct', f.monthly.pct, 40);
  eq('yearly goal: not on track, needed per month', [f.yearly.onTrack, Math.round(f.yearly.neededPerMonth)], [false, Math.round(8200 / 3.5)]);
  const g = forecast({ invoices: inv, businesses: biz }, { monthly: 700, yearly: 5000 }, now);
  eq('monthly goal reached', [g.monthly.reached, g.monthly.pct], [true, 100]);
  eq('yearly on track', g.yearly.onTrack, true);
  const none = forecast({ invoices: [], businesses: [] }, { monthly: null, yearly: null }, now);
  eq('no data → zero projection, no goals', [none.projected, none.monthly, none.yearly], [0, null, null]);
}

// ── Goal storage ──
setGoals({ monthly: 3000, yearly: 30000 });
eq('goals round-trip', getGoals(), { monthly: 3000, yearly: 30000 });
setGoals({ monthly: 0, yearly: 30000 });
eq('zero removes a goal', getGoals(), { monthly: null, yearly: 30000 });

console.log(fails ? `\n${fails} test(s) failed ✗` : '\nAll insight tests pass ✓');
process.exit(fails ? 1 : 0);
