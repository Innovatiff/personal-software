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

/** Convert a price + billing period into a monthly recurring amount (MRR). */
export function computeMRR(price, period) {
  const p = Number(price) || 0;
  const mult = PERIOD_TO_MONTHLY[period] ?? 1;
  return Math.round(p * mult * 100) / 100;
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
