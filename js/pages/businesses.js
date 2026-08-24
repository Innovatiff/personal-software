import { getBusinesses, deleteBusiness, updateBusiness } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import {
  formatCurrency, computeMRR, serviceMeta, businessStatusBadge,
  isThisMonth, BUSINESS_STATUSES, paymentInfo, ordinal,
  formatShortDate, formatDate, todayISO
} from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../toast.js';

let _all = [];
let _state = { status: 'All', search: '' };

export async function renderBusinesses() {
  const app = document.getElementById('app');
  _state = { status: 'All', search: '' };

  app.innerHTML = `
    ${renderSidebar('businesses')}
    <div class="main-content">
      ${renderTopbar('Businesses', { addLabel: 'Add Business', addHash: '/businesses/add' })}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Businesses</h1>
          <p class="page-desc">Clients you provide websites &amp; software to</p>
        </div>
        <div class="stats-grid">${Array(5).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
        <div class="biz-table">${Array(4).fill('<div class="skeleton" style="height:64px;border-radius:var(--radius)"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try { _all = await getBusinesses(); } catch (err) { console.error(err); _all = []; }
  renderList();
}

function renderList() {
  const { status, search } = _state;

  const activeMRR = _all.filter(b => b.status === 'Active')
    .reduce((s, b) => s + computeMRR(b.price, b.period, b.users), 0);
  const setupThisMonth = _all.filter(b => isThisMonth(b.createdAt))
    .reduce((s, b) => s + num(b.setupFee), 0);
  const totalThisMonth = activeMRR + setupThisMonth;
  const activeCount = _all.filter(b => b.status === 'Active').length;
  const overdueCount = _all.filter(b => paymentInfo(b.dueDay, b.lastPaidDate, b.createdAt).key === 'overdue').length;

  let rows = _all;
  if (status !== 'All') rows = rows.filter(b => b.status === status);
  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.service || '').toLowerCase().includes(q));
  }

  const counts = { All: _all.length };
  BUSINESS_STATUSES.forEach(s => { counts[s] = _all.filter(b => b.status === s).length; });

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Businesses</h1>
      <p class="page-desc">${_all.length} client${_all.length !== 1 ? 's' : ''} · ${activeCount} active</p>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
      ${statBox('building2', 'purple', 'Total Businesses', _all.length, `${activeCount} active`)}
      ${statBox('trendingUp', 'green', 'Recurring MRR', formatCurrency(activeMRR), 'Active clients / month', 'green')}
      ${statBox('receipt', 'yellow', 'Setup Fees', formatCurrency(setupThisMonth), 'Collected this month')}
      ${statBox('wallet', 'green', 'Total This Month', formatCurrency(totalThisMonth), 'MRR + setup fees', 'accent')}
      ${statBox(overdueCount ? 'alert' : 'check', overdueCount ? 'red' : 'green', 'Overdue Payments', overdueCount, overdueCount ? 'Need collecting' : 'All up to date', overdueCount ? '' : 'green')}
    </div>

    <div class="filters-bar">
      ${['All', ...BUSINESS_STATUSES].map(s => `
        <button class="filter-chip ${status === s ? 'active' : ''}" data-status="${s}">
          ${s}<span class="chip-count">${counts[s] || 0}</span>
        </button>`).join('')}
      <div class="search-wrap" style="margin-left:auto">
        ${icon('search', 16)}
        <input class="search-input" id="biz-search" type="text" placeholder="Search clients…" value="${escAttr(search)}" />
      </div>
    </div>

    ${rows.length === 0 ? emptyState(status, search) : `
      <div class="table-scroll">
        <div class="biz-table">
          <div class="biz-row biz-head biz-cols">
            <div class="biz-cell">Business</div>
            <div class="biz-cell">Service</div>
            <div class="biz-cell">Price</div>
            <div class="biz-cell">Period</div>
            <div class="biz-cell">MRR</div>
            <div class="biz-cell">Payment</div>
            <div class="biz-cell">Status</div>
            <div class="biz-cell" style="text-align:right">Actions</div>
          </div>
          ${rows.map(bizRow).join('')}
        </div>
      </div>
    `}
  `;

  content.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => { _state.status = btn.dataset.status; renderList(); });
  });
  const searchEl = content.querySelector('#biz-search');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => { _state.search = e.target.value; renderList(); });
    searchEl.focus();
    const len = searchEl.value.length;
    searchEl.setSelectionRange(len, len);
  }
  content.querySelectorAll('[data-paid]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); markPaid(btn.dataset.paid); });
  });
  content.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDelete(btn.dataset.del, btn.dataset.name); });
  });
}

function bizRow(b) {
  const meta = serviceMeta(b.service);
  const users = Math.max(1, Number(b.users) || 1);
  const mrr = computeMRR(b.price, b.period, users);
  const p = paymentInfo(b.dueDay, b.lastPaidDate, b.createdAt);
  return `
    <div class="biz-row biz-cols">
      <div class="biz-cell biz-cell-name">
        <div class="biz-name">
          <div class="biz-name-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 18)}</div>
          <span class="biz-name-text">${escHtml(b.name)}</span>
        </div>
      </div>
      <div class="biz-cell" data-label="Service">
        <span class="biz-clabel">Service</span>
        <span class="biz-service" style="color:${meta.color}">${icon(meta.iconName, 14)} ${b.service || '—'}</span>
      </div>
      <div class="biz-cell" data-label="Price">
        <span class="biz-clabel">Price</span>
        <div style="min-width:0">
          <span class="biz-price num">${formatCurrency(num(b.price))}</span>
          ${users > 1 ? `<div class="pay-sub">× ${users} users</div>` : ''}
        </div>
      </div>
      <div class="biz-cell" data-label="Period">
        <span class="biz-clabel">Period</span>
        <span class="biz-period">${b.period || '—'}</span>
      </div>
      <div class="biz-cell" data-label="MRR">
        <span class="biz-clabel">MRR</span>
        <span class="biz-mrr num">${formatCurrency(mrr)}</span>
      </div>
      <div class="biz-cell" data-label="Payment">
        <span class="biz-clabel">Payment</span>
        <div style="min-width:0">
          <div class="pay-date">${b.dueDay ? 'Due ' + ordinal(b.dueDay) + ' monthly' : '—'}</div>
          <div class="pay-status ${p.cls}"><span class="badge-dot"></span>${p.label}</div>
          ${p.nextDue ? `<div class="pay-sub">Next: ${formatDate(p.nextDue)}</div>` : ''}
          <button class="btn btn-sm btn-paid" data-paid="${b.id}" style="margin-top:7px">${icon('check', 14)} Mark Paid</button>
          ${b.lastPaidDate ? `<div class="pay-sub">Last paid ${formatShortDate(b.lastPaidDate)}</div>` : ''}
        </div>
      </div>
      <div class="biz-cell" data-label="Status">
        <span class="biz-clabel">Status</span>
        ${businessStatusBadge(b.status)}
      </div>
      <div class="biz-cell biz-actions">
        <a href="#/businesses/${b.id}/edit" class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="event.stopPropagation()">${icon('edit', 15)}</a>
        <button class="btn btn-danger btn-sm btn-icon" data-del="${b.id}" data-name="${escAttr(b.name)}" title="Delete">${icon('trash', 15)}</button>
      </div>
    </div>`;
}

async function markPaid(id) {
  const b = _all.find(x => x.id === id);
  if (!b) return;
  const upd = { lastPaidDate: todayISO(), paymentsCount: (b.paymentsCount || 0) + 1 };
  try {
    await updateBusiness(id, upd);
    Object.assign(b, upd);
    const p = paymentInfo(b.dueDay, b.lastPaidDate, b.createdAt);
    toast(p.nextDue ? `Payment recorded · next due ${formatDate(p.nextDue)}` : 'Payment recorded', 'success');
    renderList();
  } catch {
    toast('Failed to record payment', 'error');
  }
}

function statBox(ic, color, label, value, sub, valueClass = '') {
  return `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon(ic, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value ${valueClass}">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}

function emptyState(status, search) {
  const msg = search.trim()
    ? `No clients match "${escHtml(search)}".`
    : status === 'All'
      ? "You haven't registered any businesses yet. Add your first client to start tracking revenue."
      : `No ${status} businesses yet.`;
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(search.trim() ? 'search' : 'building2', 28)}</div>
      <div class="empty-title">${status === 'All' && !search.trim() ? 'No businesses yet' : 'Nothing found'}</div>
      <div class="empty-desc">${msg}</div>
      <a href="#/businesses/add" class="btn btn-primary">${icon('plus', 16)} Add Business</a>
    </div>`;
}

function confirmDelete(id, name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Delete Business</div>
      <div class="modal-desc">Remove <strong>${escHtml(name)}</strong> from your businesses? This cannot be undone.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancel-del">Cancel</button>
        <button class="btn btn-danger" id="confirm-del">${icon('trash', 15)} Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-del').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-del').addEventListener('click', async () => {
    try {
      await deleteBusiness(id);
      overlay.remove();
      toast('Business deleted', 'success');
      _all = _all.filter(b => b.id !== id);
      renderList();
    } catch {
      toast('Failed to delete', 'error');
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
