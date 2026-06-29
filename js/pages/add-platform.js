import { addPlatform, getPlatform, updatePlatform } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { toast } from '../toast.js';
import { router } from '../router.js';
import { PLATFORM_CATEGORIES } from './platforms.js';

export async function renderAddPlatform(params) {
  const editId = params?.id || null;
  let existing = null;

  if (editId) {
    try { existing = await getPlatform(editId); } catch {}
  }

  document.getElementById('app').innerHTML = `
    ${renderSidebar('platforms')}
    <div class="main-content">
      ${renderTopbar(editId ? 'Edit Platform' : 'Add Platform')}
      <div class="page-content">
        <div class="page-header" style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
          <div>
            <h1 class="page-title">${editId ? 'Edit Platform' : 'Add Platform'}</h1>
            <p class="page-desc">${editId ? 'Update platform details' : 'Track a tool or service you pay for'}</p>
          </div>
        </div>

        <div class="card" style="max-width:580px;animation:fadeInUp 0.3s ease">
          <form id="platform-form">
            <div class="form-group">
              <label class="form-label">Platform Name *</label>
              <input class="form-control" type="text" id="name" placeholder="e.g. Netlify, ConvertKit, Canva Pro" required value="${existing?.name || ''}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select class="form-control" id="category" required>
                  ${PLATFORM_CATEGORIES.map(c => `
                    <option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Monthly Cost ($) *</label>
                <input class="form-control" type="number" id="monthlyCost" placeholder="0.00" min="0" step="0.01" required value="${existing?.monthlyCost ?? ''}" />
                <div class="form-hint">What you pay per month</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-control" id="description" placeholder="What does this platform do for your assets?">${existing?.description || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Website / URL</label>
              <input class="form-control" type="text" id="website" placeholder="e.g. netlify.com" value="${existing?.website || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="notes" placeholder="Plan details, renewal date, etc.">${existing?.notes || ''}</textarea>
            </div>

            <div id="form-error" class="form-error" style="display:none;margin-bottom:12px"></div>

            <div style="display:flex;gap:10px;margin-top:8px">
              <button class="btn btn-primary btn-lg" type="submit" id="submit-btn">
                ${editId ? '✓ Save Changes' : '+ Add Platform'}
              </button>
              <button class="btn btn-secondary" type="button" onclick="history.back()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  attachNavbarEvents();

  document.getElementById('platform-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const errEl = document.getElementById('form-error');
    errEl.style.display = 'none';

    const data = {
      name: document.getElementById('name').value.trim(),
      category: document.getElementById('category').value,
      monthlyCost: parseFloat(document.getElementById('monthlyCost').value) || 0,
      description: document.getElementById('description').value.trim(),
      website: document.getElementById('website').value.trim(),
      notes: document.getElementById('notes').value.trim(),
    };

    if (!data.name) {
      errEl.textContent = 'Please enter a platform name.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = editId ? 'Saving…' : 'Adding…';

    try {
      if (editId) {
        await updatePlatform(editId, data);
        toast('Platform updated!', 'success');
      } else {
        await addPlatform(data);
        toast('Platform added!', 'success');
      }
      router.navigate('/platforms');
    } catch {
      errEl.textContent = 'Failed to save. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = editId ? '✓ Save Changes' : '+ Add Platform';
    }
  });
}
