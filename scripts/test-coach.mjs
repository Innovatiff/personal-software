// Unit tests for client health, balance, weekly focus and records (node scripts/test-coach.mjs)
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
const {
  clientHealth, reminderMessage, incomeBalance, weekKey, weekRange, focusCandidates, weeklyFocus, setFocusDone,
  computeRecords, newRecordsAfter,
} = await import('../js/coach.js');

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const today = daysAgo(0);
const ts = (d) => ({ toDate: () => d });

// ── Client health ──
{
  // Paid today on today's due day, two on-time payments in history
  const b = { id: 'b1', status: 'Active', dueDay: today.getDate(), lastPaidDate: iso(today), createdAt: ts(daysAgo(120)) };
  const inv = [
    { businessId: 'b1', kind: 'recurring', status: 'Paid', paidDate: iso(today), amount: 100 },
    { businessId: 'b1', kind: 'recurring', status: 'Paid', paidDate: iso(daysAgo(30)), amount: 100 },
  ];
  const h = clientHealth(b, inv);
  eq('healthy client scores high', [h.score >= 80, h.label, h.cls], [true, 'Healthy', 'good']);
}
{
  // Due yesterday, last paid two months ago → overdue
  const y = daysAgo(1);
  const b = { id: 'b2', status: 'Active', dueDay: y.getDate(), lastPaidDate: iso(daysAgo(60)), createdAt: ts(daysAgo(200)) };
  const h = clientHealth(b, []);
  eq('overdue client is penalised', [h.score < 100, h.notes[0]], [true, '1 day overdue']);
}
{
  // Late payer: due on the 1st, paid on the 20th, twice (dates in past months)
  const m1 = new Date(today.getFullYear(), today.getMonth() - 2, 20), m2 = new Date(today.getFullYear(), today.getMonth() - 1, 20);
  const b = { id: 'b3', status: 'Active', dueDay: 1, lastPaidDate: iso(today), createdAt: ts(daysAgo(120)) };
  const inv = [
    { businessId: 'b3', kind: 'recurring', status: 'Paid', paidDate: iso(m1), amount: 50 },
    { businessId: 'b3', kind: 'recurring', status: 'Paid', paidDate: iso(m2), amount: 50 },
  ];
  const h = clientHealth(b, inv);
  eq('late history lowers the score', [h.score <= 70, h.notes.some(n => n.includes('late'))], [true, true]);
}
eq('inactive clients are not scored', clientHealth({ status: 'Inactive' }, []).score, null);
{
  const old = { id: 'b4', status: 'Active', dueDay: null, createdAt: ts(daysAgo(90)) };
  eq('active client with no payments after 45 days', clientHealth(old, []).notes[0], 'No payments recorded yet');
}

// ── Reminder copy ──
{
  const m = reminderMessage({ clientName: 'Acme', amount: 150, dueDate: '2026-09-29', number: 'INV-0005', service: 'Website', issuer: 'Alam' });
  eq('reminder subject', m.subject, 'Payment reminder · $150 · Innovatif');
  eq('reminder body mentions amount, date and number', [m.body.includes('$150'), m.body.includes('Sep 29, 2026'), m.body.includes('INV-0005'), m.body.includes('website payment'), m.body.endsWith('Alam')], [true, true, true, true, true]);
}

// ── Income balance ──
{
  const inv = [
    { status: 'Paid', paidDate: iso(daysAgo(10)), amount: 600, kind: 'recurring' },
    { status: 'Paid', paidDate: iso(daysAgo(20)), amount: 400, kind: 'one-time' },
    { status: 'Paid', paidDate: iso(daysAgo(100)), amount: 1000, kind: 'one-time' }, // previous window
    { status: 'Unpaid', issueDate: iso(daysAgo(5)), amount: 999, kind: 'one-time' },
  ];
  const b = incomeBalance({ invoices: inv, assets: [] });
  eq('balance splits recurring vs one-time', [b.recurring, b.oneTime, b.pct], [600, 400, 60]);
  eq('balance delta vs previous window', [b.prevPct, b.delta], [0, 60]);
  const withAssets = incomeBalance({ invoices: inv, assets: [{ monthlyIncome: 100 }] });
  eq('assets count as passive (~3 months of income)', [Math.round(withAssets.assetsIncome), withAssets.pct > b.pct], [296, true]);
  eq('empty balance has no data', incomeBalance({}).hasData, false);
}

// ── Week helpers ──
eq('ISO week key format', /^\d{4}-W\d{2}$/.test(weekKey()), true);
eq('week key: Jan 1 2026 is week 1', weekKey(new Date(2026, 0, 1)), '2026-W01');
eq('week range starts Monday', weekRange(new Date(2026, 8, 30)).start.getDay(), 1);
eq('week range label', weekRange(new Date(2026, 8, 30)).label, 'Sep 28 – Oct 4');

// ── Focus candidates ──
{
  const y = daysAgo(1);
  const businesses = [
    { id: 'o', name: 'Overdue Co', status: 'Active', price: 100, period: 'Monthly', users: 1, dueDay: y.getDate(), lastPaidDate: iso(daysAgo(60)), createdAt: ts(daysAgo(200)) },
    { id: 'g', name: 'Grown Co', status: 'Active', price: 10, period: 'Monthly', users: 3, dueDay: today.getDate(), lastPaidDate: iso(today), createdAt: ts(daysAgo(200)) },
    { id: 'b', name: 'Build Co', status: 'Building', price: 10, period: 'Monthly', users: 1, createdAt: ts(daysAgo(45)) },
  ];
  const invoices = [
    { id: 'u', status: 'Unpaid', issueDate: iso(daysAgo(5)), amount: 850, kind: 'one-time', clientName: 'Studio', number: 'INV-0004' },
    { id: 'r', businessId: 'g', status: 'Paid', paidDate: iso(today), issueDate: iso(today), amount: 20, kind: 'recurring', users: 2 },
  ];
  const c = focusCandidates({ businesses, invoices }, { streaks: { needed: 300, growthLive: false, growth: 2 }, forecast: { monthly: { reached: false, remaining: 500, jobs: 2, avgJob: 400 } }, locked: [{ id: 'x', title: 'Big', pct: 80, progress: '4/5' }] });
  const ids = c.map(i => i.id);
  eq('overdue first, unpaid next', ids.slice(0, 2), ['overdue:o', 'unpaid:u']);
  eq('grown users, launch, goal, streak and trophy suggestions present', ['upsell:g', 'launch:b', 'goal', 'streak', 'trophy:x'].every(id => ids.includes(id)), true);
  eq('overdue item carries a remind action', c[0].remind, 'o');
  eq('priorities descend', c.every((it, i) => !i || c[i - 1].prio >= it.prio), true);

  // Weekly focus freezes 3 items and tracks done / resolved
  const wf = weeklyFocus({ businesses, invoices }, {});
  eq('weekly focus picks three', wf.items.length, 3);
  setFocusDone(wf.key, wf.items[0].id, true);
  const wf2 = weeklyFocus({ businesses, invoices }, {});
  eq('done item is remembered', [wf2.items[0].state, wf2.completed], ['done', 1]);
  // Pay the overdue client → its item resolves on its own
  businesses[0].lastPaidDate = iso(today); businesses[0].dueDay = today.getDate();
  const wf3 = weeklyFocus({ businesses, invoices }, {});
  eq('paid overdue client resolves its item', wf3.items.find(i => i.id === 'overdue:o').state, 'done');
  setFocusDone(wf.key, wf.items[0].id, false);
  const wf4 = weeklyFocus({ businesses, invoices }, {});
  eq('unchecked but gone from data → resolved', wf4.items.find(i => i.id === 'overdue:o').state, 'resolved');
}

// ── Records ──
{
  const inv = [
    { status: 'Paid', paidDate: '2026-08-10', amount: 300, kind: 'recurring', clientName: 'A' },
    { status: 'Paid', paidDate: '2026-08-10', amount: 200, kind: 'one-time', clientName: 'B', description: 'Logo' },
    { status: 'Paid', paidDate: iso(today), amount: 900, kind: 'one-time', clientName: 'C', description: 'Site' },
  ];
  const r = Object.fromEntries(computeRecords({ invoices: inv }, { growth: 1, bestGrowth: 2, growthLive: true }).map(x => [x.id, x]));
  eq('best month is this month', [r.month.value, r.month.isNew], [900, true]);
  eq('best day (sum of same-day payments)', [r.day.value, r.day.isNew], [900, true]);
  eq('biggest payment / job', [r.payment.value, r.job.value, r.job.sub], [900, 900, 'Site']);
  eq('most payments in a month = August (2)', [r.payments.value, r.payments.isNew], [2, false]);
  eq('most clients in a month', r.clients.value, 2);
  eq('longest streak uses best run', r.streak.value, 2);

  const before = { invoices: inv.slice(0, 2) };
  const fresh = newRecordsAfter(before, { invoices: inv }).map(x => x.id);
  eq('new payment sets month/day/payment/job records', fresh, ['month', 'day', 'payment', 'job']);
  eq('a small payment inside a record month announces nothing', newRecordsAfter({ invoices: inv }, { invoices: [...inv, { status: 'Paid', paidDate: iso(today), amount: 5, kind: 'one-time', clientName: 'C' }] }).map(x => x.id), []);
  eq('a bigger payment inside a record month is still a payment record', newRecordsAfter({ invoices: inv }, { invoices: [...inv, { status: 'Paid', paidDate: iso(today), amount: 950, kind: 'recurring', clientName: 'C' }] }).map(x => x.id), ['payment']);
}

console.log(fails ? `\n${fails} test(s) failed ✗` : '\nAll coach tests pass ✓');
process.exit(fails ? 1 : 0);
