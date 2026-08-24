import { getInvoices, deleteInvoice } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, formatShortDate, isThisMonth } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../toast.js';

let _all = [];

export async function renderInvoices() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar('invoices')}
    <div class="main-content">
      ${renderTopbar('Invoices', { noAdd: true })}
      <div class="page-content">
        <div class="page-header">
          <h1 class="page-title">Invoices</h1>
          <p class="page-desc">Auto-generated each time you mark a client as paid</p>
        </div>
        <div class="stats-grid">${Array(3).fill('<div class="skeleton skeleton-card"></div>').join('')}</div>
        <div class="invoice-list">${Array(4).fill('<div class="skeleton" style="height:70px;border-radius:var(--radius)"></div>').join('')}</div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  try { _all = await getInvoices(); } catch (err) { console.error(err); _all = []; }
  build();
}

function build() {
  const total = _all.reduce((s, i) => s + num(i.amount), 0);
  const thisMonth = _all.filter(i => isThisMonth(i.createdAt)).reduce((s, i) => s + num(i.amount), 0);

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Invoices</h1>
      <p class="page-desc">${_all.length} invoice${_all.length !== 1 ? 's' : ''} · auto-generated on payment</p>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      <div class="stat-card"><div class="stat-icon purple">${icon('receipt', 19)}</div><div class="stat-label">Total Invoices</div><div class="stat-value">${_all.length}</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('wallet', 19)}</div><div class="stat-label">Total Invoiced</div><div class="stat-value green">${formatCurrency(total)}</div></div>
      <div class="stat-card"><div class="stat-icon green">${icon('calendar', 19)}</div><div class="stat-label">This Month</div><div class="stat-value">${formatCurrency(thisMonth)}</div></div>
    </div>

    ${_all.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">${icon('receipt', 28)}</div>
        <div class="empty-title">No invoices yet</div>
        <div class="empty-desc">Invoices are created automatically when you tap <strong>Mark Paid</strong> on a client.</div>
        <a href="#/businesses" class="btn btn-primary">${icon('building2', 16)} Go to Clients</a>
      </div>
    ` : `
      <div class="invoice-list">${_all.map(row).join('')}</div>
    `}
  `;

  content.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(btn.dataset.del, btn.dataset.number); });
  });
}

function row(inv) {
  return `
    <a class="invoice-row" href="#/invoices/${inv.id}">
      <div class="invoice-row-icon">${icon('receipt', 19)}</div>
      <div class="invoice-row-main">
        <div class="invoice-row-number">${inv.number || 'Invoice'} · ${escHtml(inv.clientName)}</div>
        <div class="invoice-row-sub">Issued ${formatShortDate(inv.issueDate)}${inv.service ? ' · ' + inv.service : ''}</div>
      </div>
      <div class="invoice-row-right">
        <div class="invoice-row-amount num">${formatCurrency(num(inv.amount))}</div>
        <span class="badge badge-status-active"><span class="badge-dot"></span>Paid</span>
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
