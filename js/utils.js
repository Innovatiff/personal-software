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
