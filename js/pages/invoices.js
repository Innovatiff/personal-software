import { getInvoices, deleteInvoice } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, formatShortDate, isThisMonthISO } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../toast.js';

let _all = [];
let _filter = 'All';

export async function renderInvoices() {
  const app = document.getElementById('app');
  _filter = 'All';
  app.innerHTML = `
    ${renderSidebar('invoices')}
    <div class="main-content">
      ${renderTopbar('Invoices', { addLabel: 'New Invoice', addHash: '/invoices/new' })}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Invoices</h1>
          <p class="page-desc">One-time services and recurring payments</p>
        </div>
        <div class="stats-grid">${Array(4).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
        <div class="invoice-list">${Array(4).fill('<div class="skeleton" style="height:70px;border-radius:var(--radius)"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try { _all = await getInvoices(); } catch (err) { console.error(err); _all = []; }
  build();
}

function build() {
  const paid = _all.filter(i => i.status !== 'Unpaid');
  const unpaid = _all.filter(i => i.status === 'Unpaid');
  const total = paid.reduce((s, i) => s + num(i.amount), 0);
  const thisMonth = paid.filter(i => isThisMonthISO(i.paidDate)).reduce((s, i) => s + num(i.amount), 0);
  const outstanding = unpaid.reduce((s, i) => s + num(i.amount), 0);

  const rows = _filter === 'All' ? _all
    : _filter === 'Paid' ? paid
    : _filter === 'Unpaid' ? unpaid
    : _all.filter(i => (i.kind || 'recurring') === _filter);

  const counts = { All: _all.length, Paid: paid.length, Unpaid: unpaid.length,
    'one-time': _all.filter(i => i.kind === 'one-time').length,
    'recurring': _all.filter(i => (i.kind || 'recurring') === 'recurring').length };
  const chips = [['All', 'All'], ['Paid', 'Paid'], ['Unpaid', 'Unpaid'], ['one-time', 'One-time'], ['recurring', 'Recurring']];

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Invoices</h1>
      <p class="page-desc">${_all.length} invoice${_all.length !== 1 ? 's' : ''} · ${unpaid.length ? unpaid.length + ' awaiting payment' : 'all settled'}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon purple">${icon('receipt', 19)}</div><div class="stat-label">Total Invoices</div><div class="stat-value">${_all.length}</div><div class="stat-sub">${counts['one-time']} one-time · ${counts.recurring} recurring</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('wallet', 19)}</div><div class="stat-label">Collected This Month</div><div class="stat-value green">${formatCurrency(thisMonth)}</div><div class="stat-sub">Paid invoices</div></div>
      <div class="stat-card"><div class="stat-icon blue">${icon('trendingUp', 19)}</div><div class="stat-label">Total Collected</div><div class="stat-value">${formatCurrency(total)}</div><div class="stat-sub">All time</div></div>
      <div class="stat-card"><div class="stat-icon ${outstanding ? 'yellow' : 'green'}">${icon(outstanding ? 'clock' : 'check', 19)}</div><div class="stat-label">Outstanding</div><div class="stat-value" style="${outstanding ? 'color:var(--yellow)' : ''}">${formatCurrency(outstanding)}</div><div class="stat-sub">${unpaid.length} unpaid</div></div>
    </div>

    <div class="filters-bar">
      ${chips.map(([k, label]) => `
        <button class="filter-chip ${_filter === k ? 'active' : ''}" data-f="${k}">${label}<span class="chip-count">${counts[k] || 0}</span></button>`).join('')}
    </div>

    ${rows.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">${icon('receipt', 28)}</div>
        <div class="empty-title">${_all.length ? 'Nothing here' : 'No invoices yet'}</div>
        <div class="empty-desc">Create an invoice for a one-time job, or tap <strong>Mark Paid</strong> on a client to generate one automatically.</div>
        <a href="#/invoices/new" class="btn btn-primary">${icon('plus', 16)} New Invoice</a>
      </div>
    ` : `
      <div class="invoice-list">${rows.map(row).join('')}</div>
    `}
  `;

  content.querySelectorAll('.filter-chip').forEach(btn => btn.addEventListener('click', () => { _filter = btn.dataset.f; build(); }));
  content.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(btn.dataset.del, btn.dataset.number); });
  });
}

function row(inv) {
  const unpaid = inv.status === 'Unpaid';
  const oneTime = inv.kind === 'one-time';
  return `
    <a class="invoice-row" href="#/invoices/${inv.id}">
      <div class="invoice-row-icon ${oneTime ? 'one-time' : ''}">${icon(oneTime ? 'sparkle' : 'receipt', 19)}</div>
      <div class="invoice-row-main">
        <div class="invoice-row-number">${inv.number || 'Invoice'} · ${escHtml(inv.clientName)}</div>
        <div class="invoice-row-sub">${escHtml(oneTime ? inv.description : (inv.service || 'Recurring'))} · ${formatShortDate(inv.issueDate)}</div>
      </div>
      <div class="invoice-row-right">
        <div class="invoice-row-amount num">${formatCurrency(num(inv.amount))}</div>
        <span class="badge ${unpaid ? 'badge-status-building' : 'badge-status-active'}"><span class="badge-dot"></span>${unpaid ? 'Unpaid' : 'Paid'}</span>
      </div>
      <button class="btn btn-danger btn-sm btn-icon no-print" data-del="${inv.id}" data-number="${escAttr(inv.number || '')}" title="Delete">${icon('trash', 15)}</button>
    </a>`;
}

function confirmDelete(id, number) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Delete Invoice</div>
      <div class="modal-desc">Delete <strong>${escHtml(number)}</strong>? This can't be undone.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancel-del">Cancel</button>
        <button class="btn btn-danger" id="confirm-del">${icon('trash', 15)} Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-del').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-del').addEventListener('click', async () => {
    try {
      await deleteInvoice(id);
      overlay.remove();
      toast('Invoice deleted', 'success');
      _all = _all.filter(i => i.id !== id);
      build();
    } catch { toast('Failed to delete', 'error'); }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
