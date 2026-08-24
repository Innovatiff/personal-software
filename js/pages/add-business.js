import { addBusiness, getBusiness, updateBusiness } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { toast } from '../toast.js';
import { router } from '../router.js';
import {
  SERVICES, BUSINESS_PERIODS, BUSINESS_STATUSES, computeMRR, formatCurrency, serviceMeta
} from '../utils.js';
import { icon } from '../icons.js';

export async function renderAddBusiness(params) {
  const editId = params?.id || null;
  let existing = null;
  if (editId) { try { existing = await getBusiness(editId); } catch {} }

  document.getElementById('app').innerHTML = `
    ${renderSidebar('businesses')}
    <div class="main-content">
      ${renderTopbar(editId ? 'Edit Business' : 'Add Business', { addLabel: 'Add Business', addHash: '/businesses/add' })}
      <div class="page-content">
        <div class="page-header" style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="history.back()">${icon('arrowLeft', 16)}</button>
          <div>
            <h1 class="page-title">${editId ? 'Edit Business' : 'Register Business'}</h1>
            <p class="page-desc">${editId ? 'Update client details' : 'Add a client paying setup + recurring fees'}</p>
          </div>
        </div>

        <div class="card" style="max-width:660px;animation:fadeInUp 0.3s ease">
          <div id="cat-preview" style="display:flex;align-items:center;gap:14px;padding-bottom:22px;margin-bottom:22px;border-bottom:1px solid var(--border)">
            <div class="detail-icon" id="svc-icon" style="width:52px;height:52px;border-radius:14px"></div>
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${editId ? 'Editing' : 'New'} client</div>
              <div id="svc-name" style="font-size:16px;font-weight:700;letter-spacing:-0.02em;margin-top:2px"></div>
            </div>
          </div>

          <form id="biz-form">
            <div class="form-group">
              <label class="form-label">Business Name *</label>
              <input class="form-control" type="text" id="name" placeholder="e.g. Acme Dental Clinic" required value="${escAttr(existing?.name)}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Service *</label>
                <select class="form-control" id="service" required>
                  ${SERVICES.map(s => `<option value="${s}" ${existing?.service === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status *</label>
                <select class="form-control" id="status" required>
                  ${BUSINESS_STATUSES.map(s => `<option value="${s}" ${(existing?.status || 'Building') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Short Description</label>
              <input class="form-control" type="text" id="description" placeholder="e.g. Booking website + admin dashboard" value="${escAttr(existing?.description)}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Price per user ($) *</label>
                <input class="form-control" type="number" id="price" placeholder="0.00" min="0" step="0.01" required value="${existing?.price ?? ''}" />
                <div class="form-hint">Charge per user, per period</div>
              </div>
              <div class="form-group">
                <label class="form-label">Users</label>
                <input class="form-control" type="number" id="users" min="1" step="1" placeholder="1" value="${existing?.users ?? 1}" />
                <div class="form-hint">Set to 1 for flat pricing</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Billing Period *</label>
                <select class="form-control" id="period" required>
                  ${BUSINESS_PERIODS.map(p => `<option value="${p}" ${(existing?.period || 'Monthly') === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Due Day</label>
                <input class="form-control" type="number" id="dueDay" min="1" max="31" placeholder="e.g. 29" value="${existing?.dueDay ?? ''}" />
                <div class="form-hint">Day of each month it's due (1–31)</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Setup Fee ($)</label>
              <input class="form-control" type="number" id="setupFee" placeholder="0.00" min="0" step="0.01" value="${existing?.setupFee ?? ''}" />
              <div class="form-hint">One-time onboarding fee</div>
            </div>

            <div class="form-group">
              <div class="mrr-preview">
                <div>
                  <div class="mrr-preview-label">Monthly Recurring Revenue (MRR)</div>
                  <div class="form-hint" id="mrr-note" style="margin-top:4px"></div>
                </div>
                <div class="mrr-preview-value num" id="mrr-value">$0</div>
              </div>
            </div>

            <div id="form-error" class="form-error" style="display:none;margin-bottom:12px"></div>

            <div style="display:flex;gap:10px;margin-top:8px">
              <button class="btn btn-primary btn-lg" type="submit" id="submit-btn">
                ${icon(editId ? 'check' : 'plus', 17)} ${editId ? 'Save Changes' : 'Register Business'}
              </button>
              <button class="btn btn-secondary btn-lg" type="button" onclick="history.back()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  attachNavbarEvents();

  const serviceEl = document.getElementById('service');
  const priceEl = document.getElementById('price');
  const usersEl = document.getElementById('users');
  const periodEl = document.getElementById('period');
  const svcIcon = document.getElementById('svc-icon');
  const svcName = document.getElementById('svc-name');
  const mrrValue = document.getElementById('mrr-value');
  const mrrNote = document.getElementById('mrr-note');

  function updatePreview() {
    const meta = serviceMeta(serviceEl.value);
    svcIcon.style.background = meta.bg;
    svcIcon.style.color = meta.color;
    svcIcon.innerHTML = icon(meta.iconName, 24);
    svcName.textContent = serviceEl.value;

    const price = Number(priceEl.value) || 0;
    const users = Math.max(1, parseInt(usersEl.value, 10) || 1);
    const period = periodEl.value;
    mrrValue.textContent = formatCurrency(computeMRR(price, period, users));
    const seats = users > 1 ? `${users} users × ` : '';
    mrrNote.textContent = `${seats}${formatCurrency(price)} ${period.toLowerCase()}`;
  }
  updatePreview();
  serviceEl.addEventListener('change', updatePreview);
  priceEl.addEventListener('input', updatePreview);
  usersEl.addEventListener('input', updatePreview);
  periodEl.addEventListener('change', updatePreview);

  document.getElementById('biz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const data = {
      name: document.getElementById('name').value.trim(),
      service: serviceEl.value,
      status: document.getElementById('status').value,
      description: document.getElementById('description').value.trim(),
      price: parseFloat(priceEl.value) || 0,
      users: Math.max(1, parseInt(usersEl.value, 10) || 1),
      period: periodEl.value,
      setupFee: parseFloat(document.getElementById('setupFee').value) || 0,
      dueDay: parseInt(document.getElementById('dueDay').value, 10) || null,
      mrr: computeMRR(priceEl.value, periodEl.value, Math.max(1, parseInt(usersEl.value, 10) || 1)),
    };

    if (!data.name) {
      errEl.textContent = 'Please enter a business name.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = editId ? 'Saving…' : 'Registering…';

    try {
      if (editId) {
        await updateBusiness(editId, data);
        toast('Business updated!', 'success');
      } else {
        await addBusiness(data);
        toast('Business registered!', 'success');
      }
      router.navigate('/businesses');
    } catch {
      errEl.textContent = 'Failed to save. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = editId ? 'Save Changes' : 'Register Business';
    }
  });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str || '').replace(/'/g, '&#39;'); }
