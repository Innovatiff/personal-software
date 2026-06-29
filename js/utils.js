// Shared utility functions used across pages

export function formatCurrency(amount) {
  if (amount >= 1000) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return '$' + Number(amount).toFixed(2);
}

export function categoryMeta(category) {
  const map = {
    'Business': { icon: '🏢', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    'AdSense Site': { icon: '🌐', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    'YouTube Channel': { icon: '▶', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    'Digital Product': { icon: '📦', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'App': { icon: '📱', bg: 'rgba(124,92,252,0.15)', color: '#7c5cfc' },
    'Other': { icon: '◈', bg: 'rgba(136,136,168,0.15)', color: '#8888a8' },
  };
  return map[category] || map['Other'];
}

export function categoryIcon(category) {
  return categoryMeta(category).icon;
}

export function statusBadge(status) {
  const map = {
    'Active': 'badge-status-active',
    'Idea': 'badge-status-idea',
    'Building': 'badge-status-building',
    'Paused': 'badge-status-paused',
    'Sold': 'badge-status-sold',
  };
  const cls = map[status] || 'badge-status-paused';
  const dot = { Active: '●', Idea: '○', Building: '◑', Paused: '◌', Sold: '◉' };
  return `<span class="badge ${cls}">${dot[status] || '○'} ${status}</span>`;
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const CATEGORIES = ['Business', 'AdSense Site', 'YouTube Channel', 'Digital Product', 'App', 'Other'];
export const STATUSES = ['Idea', 'Building', 'Active', 'Paused', 'Sold'];
