// ============================================
// Shared utilities: formatting + category/status metadata
// ============================================

/** Convert a hex color to an rgba() string. */
export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Format a number as USD. Whole numbers show no cents. */
export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  const hasCents = !Number.isInteger(n);
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

/** Compact currency for tight spaces: $1.2k, $3.4M */
export function formatCompact(amount) {
  const n = Number(amount) || 0;
  if (Math.abs(n) >= 1000) {
    return '$' + n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  }
  return formatCurrency(n);
}

// ── Asset categories ─────────────────────────────────────────
// Each has an icon (from icons.js) and a signature color.
export const CATEGORY_META = {
  'Business':           { iconName: 'briefcase',      color: '#818cf8' },
  'Creator':            { iconName: 'video',          color: '#f97316' },
  'AdSense Site':       { iconName: 'globe',          color: '#34d399' },
  'YouTube Channel':    { iconName: 'youtube',        color: '#fb7185' },
  'Digital Product':    { iconName: 'package',        color: '#fbbf24' },
  'Mobile App':         { iconName: 'smartphone',     color: '#a78bfa' },
  'SaaS':               { iconName: 'cloud',          color: '#38bdf8' },
  'E-commerce Store':   { iconName: 'shoppingBag',    color: '#fb923c' },
  'Affiliate Site':     { iconName: 'link',           color: '#2dd4bf' },
  'Newsletter':         { iconName: 'mail',           color: '#60a5fa' },
  'Online Course':      { iconName: 'graduationCap',  color: '#e879f9' },
  'Blog':               { iconName: 'fileText',       color: '#22d3ee' },
  'Print on Demand':    { iconName: 'shirt',          color: '#f472b6' },
  'Real Estate':        { iconName: 'building',       color: '#a3e635' },
  'Stocks & Dividends': { iconName: 'barChart',       color: '#4ade80' },
  'Crypto':             { iconName: 'coins',          color: '#facc15' },
  'Other':              { iconName: 'sparkle',        color: '#94a3b8' },
};

export const CATEGORIES = Object.keys(CATEGORY_META);

/** Return { iconName, color, bg } for a category (falls back to Other). */
export function categoryMeta(category) {
  const m = CATEGORY_META[category] || CATEGORY_META['Other'];
  return { ...m, bg: hexToRgba(m.color, 0.13) };
}

// ── Statuses ─────────────────────────────────────────────────
export const STATUSES = ['Idea', 'Building', 'Active', 'Paused', 'Sold'];

const STATUS_CLASS = {
  'Active': 'badge-status-active',
  'Idea': 'badge-status-idea',
  'Building': 'badge-status-building',
  'Paused': 'badge-status-paused',
  'Sold': 'badge-status-sold',
};

/** Render a status pill with a leading dot. */
export function statusBadge(status) {
  const cls = STATUS_CLASS[status] || 'badge-status-paused';
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${status}</span>`;
}

/** Format a Firestore timestamp (or Date/ms) as "Jun 29, 2026". */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Businesses (clients you provide software/websites to) ────

export const SERVICES = ['Website', 'Software'];

export const SERVICE_META = {
  'Website':  { iconName: 'globe', color: '#38bdf8' },
  'Software': { iconName: 'code',  color: '#38d996' },
};
export function serviceMeta(service) {
  const m = SERVICE_META[service] || SERVICE_META['Software'];
  return { ...m, bg: hexToRgba(m.color, 0.13) };
}

// Billing periods and how many of each occur in an average month.
export const BUSINESS_PERIODS = ['Per Hour', 'Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];

export const PERIOD_TO_MONTHLY = {
  'Per Hour': 160,      // ~ full-time billable hours per month
  'Daily': 30.4368,     // avg days per month (365.25 / 12)
  'Weekly': 4.348,      // avg weeks per month
  'Bi-Weekly': 2.174,   // every two weeks
  'Monthly': 1,
};

/**
 * Convert price × users × billing period into a monthly recurring amount.
 * `users` defaults to 1, so flat-priced businesses behave as before.
 */
export function computeMRR(price, period, users = 1) {
  const p = Number(price) || 0;
  const u = Math.max(1, Number(users) || 1);
  const mult = PERIOD_TO_MONTHLY[period] ?? 1;
  return Math.round(p * u * mult * 100) / 100;
}

export const BUSINESS_STATUSES = ['Active', 'Building', 'Inactive'];

const BIZ_STATUS_CLASS = {
  'Active': 'badge-status-active',
  'Building': 'badge-status-building',
  'Inactive': 'badge-status-paused',
};

/** Render a business status pill. */
export function businessStatusBadge(status) {
  const cls = BIZ_STATUS_CLASS[status] || 'badge-status-paused';
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${status}</span>`;
}

/** True if a Firestore timestamp falls within the current calendar month. */
export function isThisMonth(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ── Payment due-date tracking ────────────────────────────────

/** Today as a 'YYYY-MM-DD' string (local time). */
export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 1 → "1st", 2 → "2nd", 29 → "29th", etc. */
export function ordinal(n) {
  n = Number(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** The occurrence of a day-of-month in a given month, clamped to month length. */
function dayOccurrence(dueDay, year, monthIndex) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dueDay, lastDay));
}

/**
 * Payment info for a recurring monthly due day (1–31).
 * Uses the last-paid date and the business start date so brand-new
 * clients aren't flagged overdue for cycles before they existed.
 * → { key, label, cls, dueDay, nextDue, paidCurrent }
 */
export function paymentInfo(dueDay, lastPaidISO, sinceTs) {
  dueDay = Number(dueDay);
  if (!dueDay || dueDay < 1 || dueDay > 31) {
    return { key: 'none', label: 'No due day', cls: 'pay-none', dueDay: null, nextDue: null };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = today.getFullYear(), m = today.getMonth();
  const thisMonthDue = dayOccurrence(dueDay, y, m);

  let lastDue, upcomingDue;
  if (today.getTime() >= thisMonthDue.getTime()) {
    lastDue = thisMonthDue;
    upcomingDue = dayOccurrence(dueDay, y, m + 1);
  } else {
    lastDue = dayOccurrence(dueDay, y, m - 1);
    upcomingDue = thisMonthDue;
  }

  let since = null;
  if (sinceTs) { since = sinceTs.toDate ? sinceTs.toDate() : new Date(sinceTs); since.setHours(0, 0, 0, 0); }
  const obligated = !since || lastDue.getTime() >= since.getTime();

  const lastPaid = lastPaidISO ? parseISO(lastPaidISO) : null;
  const paidCurrent = obligated && !!lastPaid && lastPaid.getTime() >= lastDue.getTime();

  const effective = (!obligated || paidCurrent) ? upcomingDue : lastDue;
  const diff = Math.round((effective - today) / 86400000);

  let st;
  if (paidCurrent) st = { key: 'ok', label: 'Paid', cls: 'pay-ok' };
  else if (diff < 0) st = { key: 'overdue', label: 'Overdue', cls: 'pay-overdue' };
  else if (diff === 0) st = { key: 'due', label: 'Due today', cls: 'pay-due' };
  else if (diff <= 5) st = { key: 'due', label: `Due in ${diff}d`, cls: 'pay-due' };
  else st = { key: 'ok', label: 'Upcoming', cls: 'pay-ok' };

  return { ...st, dueDay, nextDue: effective, paidCurrent };
}

/** Format 'YYYY-MM-DD' or a Date as 'Aug 30, 2026'. */
export function formatShortDate(value) {
  const d = value instanceof Date ? value : parseISO(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
