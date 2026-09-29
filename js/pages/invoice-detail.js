import { getInvoice, deleteInvoice, updateInvoice } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { formatCurrency, formatShortDate, ordinal, todayISO } from '../utils.js';
import { icon, brandMark } from '../icons.js';
import { toast } from '../toast.js';
import { router } from '../router.js';
import { celebrateCollection } from '../achievements.js';
import { originOf } from '../celebrate.js';
import { openReminder } from '../reminders.js';

export async function renderInvoiceDetail(params) {
  const { id } = params;
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderSidebar('invoices')}
    <div class="main-content">
      ${renderTopbar('Invoice', { noAdd: true, noFab: true })}
      <div class="page-content">
        <div class="skeleton" style="height:44px;width:140px;margin-bottom:20px"></div>
        <div class="skeleton" style="height:560px;max-width:840px;margin:0 auto;border-radius:18px"></div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let inv;
  try { inv = await getInvoice(id); } catch { showError('Failed to load invoice.'); return; }
  if (!inv) { showError('Invoice not found.'); return; }
  render(inv);
}

/** Line items — new invoices store `items`; older ones are rebuilt from flat fields. */
function lineItems(inv) {
  if (Array.isArray(inv.items) && inv.items.length) return inv.items;
  const users = Math.max(1, Number(inv.users) || 1);
  return [{
    description: `${inv.service || 'Service'} — monthly service`,
    detail: `${users > 1 ? users + ' users × ' : ''}${formatCurrency(num(inv.price))} ${(inv.period || 'monthly').toLowerCase()}`,
    amount: num(inv.amount),
  }];
}

function render(inv) {
  const paid = inv.status !== 'Unpaid';
  const items = lineItems(inv);
  const total = items.reduce((s, it) => s + num(it.amount), 0) || num(inv.amount);
  const issuer = inv.issuerName || inv.issuerEmail || '—';
  const oneTime = inv.kind === 'one-time';

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div class="invoice-actions no-print">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/invoices'">${icon('arrowLeft', 15)} Back</button>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${!paid ? `<button class="btn btn-paid btn-sm" id="paid-btn">${icon('check', 15)} Mark as paid</button>
        <button class="btn btn-secondary btn-sm" id="remind-btn" title="${inv.lastReminder?.date ? 'Reminded ' + formatShortDate(inv.lastReminder.date) : 'Send a payment reminder'}">${icon('bell', 15)} Remind${inv.lastReminder?.date ? ' again' : ''}</button>` : ''}
        ${navigator.share ? `<button class="btn btn-secondary btn-sm" id="share-btn">${icon('share', 15)} Share</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="print-btn">${icon('download', 15)} Print / PDF</button>
        <button class="btn btn-danger btn-sm btn-icon" id="del-btn" title="Delete">${icon('trash', 15)}</button>
      </div>
    </div>

    <div class="invoice-paper ${paid ? '' : 'is-unpaid'}">
      <div class="inv-topline"></div>

      <div class="inv-head">
        <div class="inv-brand">
          ${brandMark(44)}
          <div>
            <div class="inv-brand-name">Innovatif</div>
            <div class="inv-brand-tag">Design · Software · Websites</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-title">Invoice</div>
          <div class="inv-number">${escHtml(inv.number || '')}</div>
          <span class="inv-status ${paid ? 'paid' : 'due'}">${paid ? 'PAID' : 'UNPAID'}</span>
        </div>
      </div>

      <div class="inv-parties">
        <div class="inv-party">
          <span class="inv-label">From</span>
          <div class="inv-strong">${escHtml(issuer)}</div>
          <div class="inv-muted">Innovatif</div>
          ${inv.issuerEmail ? `<div class="inv-muted">${escHtml(inv.issuerEmail)}</div>` : ''}
        </div>
        <div class="inv-party">
          <span class="inv-label">Bill to</span>
          <div class="inv-strong">${escHtml(inv.clientName)}</div>
          ${!oneTime && inv.description ? `<div class="inv-muted">${escHtml(inv.description)}</div>` : ''}
        </div>
        <div class="inv-dates">
          <div><span class="inv-label">Invoice date</span><span>${formatShortDate(inv.issueDate)}</span></div>
          ${oneTime
            ? `<div><span class="inv-label">Type</span><span>One-time service</span></div>`
            : `<div><span class="inv-label">Billing day</span><span>${inv.dueDay ? ordinal(inv.dueDay) + ' monthly' : '—'}</span></div>`}
          <div><span class="inv-label">${paid ? 'Paid on' : 'Status'}</span><span>${paid ? formatShortDate(inv.paidDate) : 'Awaiting payment'}</span></div>
        </div>
      </div>

      <table class="inv-table">
        <thead><tr><th>Description</th><th class="inv-th-right">Amount</th></tr></thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td>
                <div class="inv-item-name">${escHtml(it.description)}</div>
                ${it.detail ? `<div class="inv-item-sub">${escHtml(it.detail)}</div>` : ''}
              </td>
              <td class="num inv-td-right">${formatCurrency(num(it.amount))}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div class="inv-bottom">
        <div class="inv-notes">
          ${inv.notes ? `<span class="inv-label">Notes</span><div class="inv-notes-text">${escHtml(inv.notes).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
        <div class="inv-totals">
          <div class="inv-total-row"><span>Subtotal</span><span class="num">${formatCurrency(total)}</span></div>
          <div class="inv-total-row"><span>Tax</span><span class="num">$0</span></div>
          <div class="inv-total-box">
            <span>${paid ? 'Total paid' : 'Total due'}</span>
            <span class="num">${formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div class="inv-footer">
        <div class="inv-stamp ${paid ? 'paid' : 'due'}">
          ${paid ? `${icon('check', 15, { strokeWidth: 3 })} Paid on ${formatShortDate(inv.paidDate)}` : `${icon('clock', 15)} Payment pending`}
        </div>
        <div class="inv-thanks">Thank you for your business — Innovatif</div>
      </div>
    </div>
  `;

  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('del-btn').addEventListener('click', () => confirmDelete(inv.id, inv.number));
  document.getElementById('share-btn')?.addEventListener('click', () => {
    navigator.share({
      title: `Invoice ${inv.number || ''} · Innovatif`.trim(),
      text: `Invoice ${inv.number} · ${inv.clientName} · ${formatCurrency(total)} — ${paid ? 'PAID' : 'UNPAID'}`,
    }).catch(() => {});
  });
  document.getElementById('remind-btn')?.addEventListener('click', () => {
    openReminder({
      clientName: inv.clientName, amount: total, dueDate: inv.issueDate, number: inv.number,
      service: oneTime ? '' : inv.service, issuer: inv.issuerName || '',
      onSent: async (channel) => {
        const lastReminder = { date: todayISO(), channel };
        try { await updateInvoice(inv.id, { lastReminder }); } catch {}
        render({ ...inv, lastReminder });
      },
    });
  });
  document.getElementById('paid-btn')?.addEventListener('click', async (e) => {
    const origin = originOf(e.currentTarget);
    try {
      const upd = { status: 'Paid', paidDate: todayISO() };
      await updateInvoice(inv.id, upd);
      render({ ...inv, ...upd });
      celebrateCollection({ amount: total, clientName: inv.clientName, origin });
    } catch { toast('Could not update invoice', 'error'); }
  });
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
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
