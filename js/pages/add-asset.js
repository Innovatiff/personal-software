import { addAsset, getAsset, updateAsset } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { toast } from '../toast.js';
import { router } from '../router.js';
import { CATEGORIES, STATUSES } from '../utils.js';

export async function renderAddAsset(params) {
  const editId = params?.id || null;
  let existing = null;

  if (editId) {
    try { existing = await getAsset(editId); } catch {}
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderSidebar(editId ? 'assets' : 'add')}
    <div class="main-content">
      ${renderTopbar(editId ? 'Edit Asset' : 'Add Asset')}
      <div class="page-content">
        <div class="page-header" style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
          <div>
            <h1 class="page-title">${editId ? 'Edit Asset' : 'Add New Asset'}</h1>
            <p class="page-desc">${editId ? 'Update asset details' : 'Track a new passive income source'}</p>
          </div>
        </div>

        <div class="card" style="max-width:640px;animation:fadeInUp 0.3s ease">
          <form id="asset-form">
            <div class="form-group">
              <label class="form-label">Asset Name *</label>
              <input class="form-control" type="text" id="name" placeholder="e.g. My Niche Blog" required value="${existing?.name || ''}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select class="form-control" id="category" required>
                  ${CATEGORIES.map(c => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Status *</label>
                <select class="form-control" id="status" required>
                  ${STATUSES.map(s => `<option value="${s}" ${(existing?.status || 'Idea') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" id="description" placeholder="What is this asset? What does it do?">${existing?.description || ''}</textarea>
            </div>

            <div class="form-group" id="site-url-group" style="display:none">
              <label class="form-label">Site URL</label>
              <input class="form-control" type="url" id="siteUrl" placeholder="https://yoursite.com" value="${existing?.siteUrl || ''}" />
              <div class="form-hint">The URL of your AdSense website</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Total Investment ($)</label>
                <input class="form-control" type="number" id="totalCost" placeholder="0.00" min="0" step="0.01" value="${existing?.totalCost || ''}" />
                <div class="form-hint">Total money spent building/buying this</div>
              </div>
              <div class="form-group">
                <label class="form-label">Monthly Income ($)</label>
                <input class="form-control" type="number" id="monthlyIncome" placeholder="0.00" min="0" step="0.01" value="${existing?.monthlyIncome || ''}" />
                <div class="form-hint">Average monthly passive income</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="notes" placeholder="Any additional notes, links, or thoughts…">${existing?.notes || ''}</textarea>
            </div>

            <div id="form-error" class="form-error" style="display:none;margin-bottom:12px"></div>

            <div style="display:flex;gap:10px;margin-top:8px">
              <button class="btn btn-primary btn-lg" type="submit" id="submit-btn">
                ${editId ? '✓ Save Changes' : '+ Add Asset'}
              </button>
              <button class="btn btn-secondary" type="button" onclick="history.back()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  attachNavbarEvents();

  // Show site URL field only for AdSense Site
  const categoryEl = document.getElementById('category');
  const urlGroup = document.getElementById('site-url-group');
  function toggleUrlField() {
    urlGroup.style.display = categoryEl.value === 'AdSense Site' ? 'block' : 'none';
  }
  toggleUrlField();
  categoryEl.addEventListener('change', toggleUrlField);

  document.getElementById('asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const data = {
      name: document.getElementById('name').value.trim(),
      category: document.getElementById('category').value,
      status: document.getElementById('status').value,
      description: document.getElementById('description').value.trim(),
      totalCost: parseFloat(document.getElementById('totalCost').value) || 0,
      monthlyIncome: parseFloat(document.getElementById('monthlyIncome').value) || 0,
      notes: document.getElementById('notes').value.trim(),
      siteUrl: document.getElementById('category').value === 'AdSense Site'
        ? document.getElementById('siteUrl').value.trim()
        : '',
    };

    if (!data.name) {
      errEl.textContent = 'Please enter an asset name.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = editId ? 'Saving…' : 'Adding…';

    try {
      if (editId) {
        await updateAsset(editId, data);
        toast('Asset updated!', 'success');
        router.navigate(`/assets/${editId}`);
      } else {
        const ref = await addAsset(data);
        toast('Asset added!', 'success');
        router.navigate(`/assets/${ref.id}`);
      }
    } catch (err) {
      errEl.textContent = 'Failed to save. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = editId ? '✓ Save Changes' : '+ Add Asset';
    }
  });
}
