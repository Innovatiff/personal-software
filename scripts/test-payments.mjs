import { paymentInfo, ordinal, todayISO } from '../js/utils.js';

const today = new Date(); today.setHours(0, 0, 0, 0);
const day = today.getDate();
const yearAgo = new Date(today); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  console.log((ok ? 'ok  ' : 'FAIL') + ` ${label}: ${got}${ok ? '' : ' (want ' + want + ')'}`);
  if (!ok) fails++;
};

console.log('ordinal:', [1, 2, 3, 4, 11, 21, 22, 29, 31].map(ordinal).join(' '));

// Due today (established client, unpaid)
check('due-today key', paymentInfo(day, null, yearAgo).key, 'due');

if (day > 2) {
  // dueDay=1 already passed this month, unpaid, established → overdue
  check('overdue key', paymentInfo(1, null, yearAgo).key, 'overdue');
  // same but brand-new client (created today) → NOT overdue
  const k = paymentInfo(1, null, today).key;
  check('new-client not overdue', k === 'overdue' ? 'overdue' : 'ok/due', 'ok/due');
  // paid this cycle → Paid
  check('paid this cycle', paymentInfo(1, todayISO(), yearAgo).label, 'Paid');
}

// No due day set
check('no due day', paymentInfo(null, null, yearAgo).key, 'none');

// nextDue is a Date when a due day is set
const info = paymentInfo(day, null, yearAgo);
check('nextDue is Date', info.nextDue instanceof Date, true);

console.log(fails ? `\n${fails} FAIL` : '\nAll payment logic tests pass ✓');
