import { getInvoice, deleteInvoice } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, formatShortDate, ordinal } from '../utils.js';
import { icon, brandMark } from '../icons.js';
import { toast } from '../toast.js';
import { router } from '../router.js';

export async function renderInvoiceDetail(params) {
  const { id } = params;
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderSidebar('invoices')}
    <div class="main-content">
      ${renderTopbar('Invoice', { noAdd: true })}
      <div class="page-content">
        <div class="skeleton" style="height:44px;width:140px;margin-bottom:20px"></div>
        <div class="skeleton" style="height:520px;max-width:820px;margin:0 auto;border-radius:18px"></div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let inv;
  try { inv = await getInvoice(id); } catch { showError('Failed to load invoice.'); return; }
  if (!inv) { showError('Invoice not found.'); return; }

  const users = Math.max(1, Number(inv.users) || 1);
  const period = (inv.period || 'monthly').toLowerCase();
  const issuer = inv.issuerName || inv.issuerEmail || '—';

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="invoice-actions no-print">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/invoices'">${icon('arrowLeft', 15)} Back</button>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="print-btn">${icon('download', 15)} Print / Save PDF</button>
        <button class="btn btn-danger btn-sm" id="del-btn">${icon('trash', 15)} Delete</button>
      </div>
    </div>

    <div class="invoice-paper">
      <div class="inv-head">
        <div class="inv-brand">
          ${brandMark(40)}
          <div>
            <div class="inv-brand-name">${escHtml(issuer)}</div>
            ${inv.issuerEmail ? `<div class="inv-issuer-email">${escHtml(inv.issuerEmail)}</div>` : ''}
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-title">INVOICE</div>
          <div class="inv-number">${escHtml(inv.number || '')}</div>
          <span class="inv-paid-badge">PAID</span>
        </div>
      </div>

      <div class="inv-parties">
        <div>
          <span class="inv-label">From</span>
          <div class="inv-strong">${escHtml(issuer)}</div>
          ${inv.issuerEmail ? `<div class="inv-muted">${escHtml(inv.issuerEmail)}</div>` : ''}
        </div>
        <div>
          <span class="inv-label">Bill To</span>
          <div class="inv-strong">${escHtml(inv.clientName)}</div>
          ${inv.description ? `<div class="inv-muted">${escHtml(inv.description)}</div>` : ''}
        </div>
        <div class="inv-dates">
          <div><span class="inv-label">Issue date</span><span>${formatShortDate(inv.issueDate)}</span></div>
          <div><span class="inv-label">Billing day</span><span>${inv.dueDay ? ordinal(inv.dueDay) + ' monthly' : '—'}</span></div>
          <div><span class="inv-label">Paid on</span><span>${formatShortDate(inv.paidDate)}</span></div>
        </div>
      </div>

      <table class="inv-table">
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          <tr>
            <td>
              <div class="inv-item-name">${escHtml(inv.service || 'Service')} — monthly service</div>
              <div class="inv-item-sub">${users > 1 ? users + ' users × ' : ''}${formatCurrency(num(inv.price))} ${period}</div>
            </td>
            <td class="num" style="text-align:right">${formatCurrency(num(inv.amount))}</td>
          </tr>
        </tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-total-row"><span>Subtotal</span><span class="num">${formatCurrency(num(inv.amount))}</span></div>
        <div class="inv-total-row grand"><span>Total</span><span class="num">${formatCurrency(num(inv.amount))}</span></div>
      </div>

      <div class="inv-footer">
        <div class="inv-paid-stamp">${icon('check', 16, { strokeWidth: 3 })} Paid on ${formatShortDate(inv.paidDate)}</div>
        <div class="inv-thanks">Thank you for your business.</div>
      </div>
    </div>
  `;

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('del-btn').addEventListener('click', () => confirmDelete(inv.id, inv.number));
}

function confirmDelete(id, number) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Delete Invoice</div>
      <div class="modal-desc">Delete <strong>${escHtml(number || '')}</strong>? This can't be undone.</div>
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
      router.navigate('/invoices');
    } catch { toast('Failed to delete', 'error'); }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function showError(msg) {
  const content = document.querySelector('.page-content');
  if (content) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('alert', 28)}</div>
        <div class="empty-title">${msg}</div>
        <a href="#/invoices" class="btn btn-secondary mt-16">${icon('arrowLeft', 15)} Back to Invoices</a>
      </div>`;
  }
}

const num = (v) => Number(v) || 0;
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
