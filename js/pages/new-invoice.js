import { addInvoice, nextInvoiceNumber, getBusinesses } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { auth } from '../firebase-config.js';
import { formatCurrency, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../toast.js';
import { router } from '../router.js';
import { haptic } from '../anim.js';
import { celebrateCollection } from '../achievements.js';
import { originOf } from '../celebrate.js';

/**
 * Manual invoice for a one-time service
 * (e.g. "Restaurant menu design — $400").
 */
export async function renderNewInvoice() {
  document.getElementById('app').innerHTML = `
    ${renderSidebar('invoices')}
    <div class="main-content">
      ${renderTopbar('New Invoice', { noAdd: true })}
      <div class="page-content">
        <div class="page-header" style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="history.back()">${icon('arrowLeft', 16)}</button>
          <div>
            <h1 class="page-title">New Invoice</h1>
            <p class="page-desc">Register a one-time service you delivered</p>
          </div>
        </div>

        <div class="card form-card">
          <div class="form-intro">
            <div class="detail-icon" style="width:52px;height:52px;border-radius:14px;background:var(--purple-soft);color:var(--accent)">${icon('sparkle', 24)}</div>
            <div>
              <div class="form-intro-kicker">One-time service</div>
              <div class="form-intro-title" id="live-title">Untitled service</div>
            </div>
            <div class="form-intro-amount num" id="live-amount">$0</div>
          </div>

          <form id="inv-form">
            <div class="form-group">
              <label class="form-label">Client *</label>
              <input class="form-control" type="text" id="client" list="client-list" placeholder="e.g. Maria's Bistro" required autocomplete="off" />
              <datalist id="client-list"></datalist>
              <div class="form-hint">Pick an existing client or type a new name</div>
            </div>

            <div class="form-group">
              <label class="form-label">What did you do? *</label>
              <input class="form-control" type="text" id="description" placeholder="e.g. Restaurant menu design" required />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Amount ($) *</label>
                <input class="form-control" type="number" id="amount" placeholder="400" min="0" step="0.01" required />
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input class="form-control" type="date" id="date" value="${todayISO()}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Payment status</label>
              <div class="seg" id="status-seg">
                <button type="button" class="seg-btn active" data-v="Paid">${icon('check', 14)} Paid</button>
                <button type="button" class="seg-btn" data-v="Unpaid">${icon('clock', 14)} Unpaid</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes <span style="color:var(--text-muted);font-weight:400">(shown on the invoice)</span></label>
              <textarea class="form-control" id="notes" placeholder="Thanks for the opportunity! Payment via bank transfer." style="min-height:72px"></textarea>
            </div>

            <div id="form-error" class="form-error" style="display:none;margin-bottom:12px"></div>

            <div style="display:flex;gap:10px;margin-top:8px">
              <button class="btn btn-primary btn-lg" type="submit" id="submit-btn">${icon('receipt', 17)} Create Invoice</button>
              <button class="btn btn-secondary btn-lg" type="button" onclick="history.back()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  // Client suggestions from existing businesses
  let businesses = [];
  try {
    businesses = await getBusinesses();
    document.getElementById('client-list').innerHTML =
      businesses.map(b => `<option value="${escAttr(b.name)}"></option>`).join('');
  } catch {}

  const clientEl = document.getElementById('client');
  const descEl = document.getElementById('description');
  const amountEl = document.getElementById('amount');
  const dateEl = document.getElementById('date');
  const notesEl = document.getElementById('notes');
  let status = 'Paid';

  const live = () => {
    document.getElementById('live-title').textContent = descEl.value.trim() || 'Untitled service';
    document.getElementById('live-amount').textContent = formatCurrency(parseFloat(amountEl.value) || 0);
  };
  descEl.addEventListener('input', live);
  amountEl.addEventListener('input', live);

  document.querySelectorAll('#status-seg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      status = btn.dataset.v;
      document.querySelectorAll('#status-seg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      haptic(6);
    });
  });

  document.getElementById('inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const clientName = clientEl.value.trim();
    const description = descEl.value.trim();
    const amount = parseFloat(amountEl.value) || 0;
    const date = dateEl.value || todayISO();
    if (!clientName || !description || amount <= 0) {
      errEl.textContent = 'Please fill in the client, the service and an amount above $0.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const number = await nextInvoiceNumber();
      const match = businesses.find(b => (b.name || '').toLowerCase() === clientName.toLowerCase());
      const ref = await addInvoice({
        number,
        kind: 'one-time',
        businessId: match ? match.id : null,
        clientName,
        service: 'One-time service',
        description,
        items: [{ description, detail: 'One-time service', amount }],
        amount,
        issueDate: date,
        paidDate: status === 'Paid' ? date : '',
        status,
        notes: notesEl.value.trim(),
        issuerName: auth.currentUser?.displayName || '',
        issuerEmail: auth.currentUser?.email || '',
      });
      const origin = originOf(btn);
      toast(`Invoice ${number} created`, 'success');
      router.navigate(`/invoices/${ref.id}`);
      if (status === 'Paid') celebrateCollection({ amount, clientName, origin });
      else haptic(14);
    } catch (err) {
      console.error(err);
      errEl.textContent = err?.code === 'permission-denied'
        ? 'Blocked by Firestore rules — add the "invoices" rule.'
        : 'Failed to create the invoice. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = `${icon('receipt', 17)} Create Invoice`;
    }
  });
}

function escAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
