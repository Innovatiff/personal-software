import { computeMRR, formatCurrency, PERIOD_TO_MONTHLY } from '../js/utils.js';

let fails = 0;
function eq(label, got, want) {
  const ok = Math.abs(got - want) < 0.01;
  if (!ok) { console.log('FAIL', label, 'got', got, 'want', want); fails++; }
  else console.log('ok  ', label, '=', got);
}

eq('monthly $100', computeMRR(100, 'Monthly'), 100);
eq('weekly $100', computeMRR(100, 'Weekly'), 100 * PERIOD_TO_MONTHLY['Weekly']);
eq('daily $10', computeMRR(10, 'Daily'), 10 * PERIOD_TO_MONTHLY['Daily']);
eq('biweekly $200', computeMRR(200, 'Bi-Weekly'), 200 * PERIOD_TO_MONTHLY['Bi-Weekly']);
eq('hourly $50', computeMRR(50, 'Per Hour'), 50 * 160);
eq('blank price', computeMRR('', 'Monthly'), 0);

console.log('format:', formatCurrency(1234.5), formatCurrency(1000), formatCurrency(99.9));
console.log(fails ? `\n${fails} FAIL` : '\nAll MRR logic tests pass ✓');
