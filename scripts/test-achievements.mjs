// Unit tests for streak + milestone logic (node scripts/test-achievements.mjs)
// db.js / celebrate.js are browser-only, so they are stubbed via a loader hook.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const stubs = {
  'db.js': 'export const getInvoices = async () => []; export const getBusinesses = async () => [];',
  'celebrate.js': 'export const payday = () => {}; export const originOf = () => null;',
};
register(
  'data:text/javascript,' + encodeURIComponent(`
    const stubs = ${JSON.stringify(stubs)};
    export async function resolve(spec, ctx, next) {
      for (const k of Object.keys(stubs)) if (spec.endsWith('/' + k) && ctx.parentURL?.includes('achievements.js')) {
        return { url: 'data:text/javascript,' + encodeURIComponent(stubs[k]), shortCircuit: true };
      }
      return next(spec, ctx);
    }
  `),
  pathToFileURL('./')
);

globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };

const { computeStats, computeStreaks, evaluateMilestones, unseenEarned, markSeen } = await import('../js/achievements.js');

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

const now = new Date();
const key = (offset) => { const d = new Date(now.getFullYear(), now.getMonth() - offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const paid = (monthsAgo, amount, extra = {}) => ({ status: 'Paid', paidDate: `${key(monthsAgo)}-10`, issueDate: `${key(monthsAgo)}-10`, amount, kind: 'recurring', ...extra });
const ts = (d) => ({ toDate: () => d });

// ── Streaks ──
{
  // 4 months of growth: 100, 200, 300, 400 (current month 400)
  const inv = [paid(3, 100), paid(2, 200), paid(1, 300), paid(0, 400)];
  const s = computeStreaks(computeStats({ invoices: inv }), null);
  eq('growth streak counts current month when it already beats last month', [s.growth, s.growthLive], [3, true]);
}
{
  // Current month (50) is below last month (300): streak judged from last completed month
  const inv = [paid(3, 100), paid(2, 200), paid(1, 300), paid(0, 50)];
  const s = computeStreaks(computeStats({ invoices: inv }), null);
  eq('early-month dip keeps last completed streak', [s.growth, s.growthLive, s.needed], [2, false, 250]);
}
{
  // Broken streak: 100, 300, 200 (last completed month fell)
  const inv = [paid(3, 100), paid(2, 300), paid(1, 200), paid(0, 0)];
  const s = computeStreaks(computeStats({ invoices: inv }), null);
  eq('streak resets when a month falls', [s.growth, s.bestGrowth], [0, 1]);
}
{
  // Goal streak with goal 250: months 300, 260, 400 (current)
  const inv = [paid(2, 300), paid(1, 260), paid(0, 400)];
  const s = computeStreaks(computeStats({ invoices: inv }), 250);
  eq('goal streak counts consecutive months at/above goal', [s.goal, s.goalLive, s.goalMonths], [3, true, 3]);
}
{
  const s = computeStreaks(computeStats({ invoices: [] }), null);
  eq('empty data → no streaks', [s.growth, s.goal, s.needed], [0, 0, 0]);
}

// ── Milestones ──
{
  const inv = [
    paid(2, 600, { kind: 'one-time' }),               // first job, first dollar
    paid(1, 500),
    paid(0, 1200, { kind: 'one-time' }),              // big job ≥ $1k; total 2300
    { status: 'Unpaid', issueDate: `${key(0)}-12`, amount: 850, kind: 'one-time' },
  ];
  const biz = [
    { name: 'A', createdAt: ts(new Date(now.getFullYear() - 2, 0, 15)) },
    { name: 'B', createdAt: ts(new Date(now.getFullYear(), now.getMonth(), 2)) },
  ];
  const stats = computeStats({ invoices: inv, businesses: biz });
  const ms = evaluateMilestones(stats, computeStreaks(stats, 1000));
  const by = Object.fromEntries(ms.map(m => [m.id, m]));

  eq('total-1 earned on first paid invoice', by['total-1'].earnedAt, `${key(2)}-10`);
  eq('total-1k earned when cumulative crosses $1,000', by['total-1k'].earnedAt, `${key(1)}-10`);
  eq('total-5k locked with progress', [by['total-5k'].earnedAt, by['total-5k'].pct, by['total-5k'].progress], [null, 46, '$2,300 / $5,000']);
  eq('month-1k earned in the $1,200 month', by['month-1k'].earnedAt, `${key(0)}-10`);
  eq('jobs-1 earned on first paid one-time job', by['jobs-1'].earnedAt, `${key(2)}-10`);
  eq('unpaid invoices do not count as jobs', by['jobs-5'].value, 2);
  eq('bigjob-1k earned', by['bigjob-1k'].earnedAt, `${key(0)}-10`);
  eq('clients-1 earned at first client createdAt', by['clients-1'].earnedAt, `${now.getFullYear() - 2}-01-15`);
  eq('clients-3 locked at 2/3', [by['clients-3'].earnedAt, by['clients-3'].progress], [null, '2 / 3']);
  eq('anniversary earned for a 2-year-old client', !!by['anniversary'].earnedAt, true);
  eq('inv-1 counts unpaid invoices too (issued)', by['inv-10'].value, 4);
  eq('goal-1 earned the day the goal was crossed', by['goal-1'].earnedAt, `${key(0)}-10`);
  eq('streak-2 not earned (600 → 500 → 1200 is one growing month)', by['streak-2'].earnedAt, null);
  eq('streak-2 progress shows current best run', by['streak-2'].progress, '1 / 2 months');
}
{
  const inv = [paid(3, 100), paid(2, 150), paid(1, 200), paid(0, 10)];
  const stats = computeStats({ invoices: inv });
  const ms = evaluateMilestones(stats, computeStreaks(stats, null));
  const by = Object.fromEntries(ms.map(m => [m.id, m]));
  eq('streak-2 earned in the month the run reached 2', by['streak-2'].earnedAt, `${key(1)}-01`);
  eq('streak-3 locked', by['streak-3'].earnedAt, null);

  // seen tracking
  const fresh = unseenEarned(ms);
  eq('all earned are fresh at first', fresh.length, ms.filter(m => m.earnedAt).length);
  markSeen(fresh.map(m => m.id));
  eq('nothing fresh after markSeen', unseenEarned(ms).length, 0);
}

console.log(fails ? `\n${fails} test(s) failed ✗` : '\nAll achievement tests pass ✓');
process.exit(fails ? 1 : 0);
