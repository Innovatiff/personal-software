import { getAsset, deleteAsset } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, statusBadge, formatCurrency, formatDate } from '../utils.js';
import { toast } from '../toast.js';
import { router } from '../router.js';

export async function renderAssetDetail(params) {
  const { id } = params;
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderSidebar('assets')}
    <div class="main-content">
      ${renderTopbar('Asset Details')}
      <div class="page-content">
        <div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)">
          Loading…
        </div>
      </div>
    </div>
  `;
  attachNavbarEvents();

  let asset;
  try {
    asset = await getAsset(id);
  } catch (err) {
    showError('Failed to load asset.');
    return;
  }

  if (!asset) {
    showError('Asset not found.');
    return;
  }

  const meta = categoryMeta(asset.category);
  const monthly = Number(asset.monthlyIncome) || 0;
  const yearly = monthly * 12;
  const invested = Number(asset.totalCost) || 0;
  const roi = invested > 0 ? ((yearly / invested) * 100).toFixed(1) : null;
  const payback = monthly > 0 ? (invested / monthly).toFixed(1) : null;

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/assets'">← Back</button>
    </div>

    <div class="detail-hero">
      <div class="detail-hero-header">
        <div class="detail-icon" style="background:${meta.bg}">${meta.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
            <h1 class="detail-name">${escHtml(asset.name)}</h1>
            ${statusBadge(asset.status)}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge badge-category">${asset.category}</span>
            <span style="font-size:13px;color:var(--text-muted)">Created ${formatDate(asset.createdAt)}</span>
          </div>
        </div>
      </div>

      ${asset.description ? `<div class="detail-desc">${escHtml(asset.description)}</div>` : ''}

      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-label">Monthly Income</div>
          <div class="detail-stat-value green">${formatCurrency(monthly)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Yearly Projection</div>
          <div class="detail-stat-value accent">${formatCurrency(yearly)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Total Invested</div>
          <div class="detail-stat-value">${formatCurrency(invested)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Annual ROI</div>
          <div class="detail-stat-value ${roi ? 'green' : ''}">${roi ? roi + '%' : '—'}</div>
        </div>
        ${payback ? `
        <div class="detail-stat">
          <div class="detail-stat-label">Payback Period</div>
          <div class="detail-stat-value">${payback} months</div>
        </div>` : ''}
      </div>
    </div>

    ${asset.notes ? `
    <div class="detail-notes">
      <div class="detail-notes-title">Notes</div>
      <div class="detail-notes-text">${escHtml(asset.notes).replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <div class="detail-actions">
      <button class="btn btn-primary" onclick="location.hash='#/assets/${id}/edit'">✏ Edit Asset</button>
      <button class="btn btn-danger" id="delete-btn">🗑 Delete</button>
    </div>
  `;

  document.getElementById('delete-btn').addEventListener('click', () => {
    showConfirmDelete(id, asset.name);
  });
}

function showConfirmDelete(id, name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">Delete Asset</div>
      <div class="modal-desc">Are you sure you want to delete <strong>${escHtml(name)}</strong>? This action cannot be undone.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancel-delete">Cancel</button>
        <button class="btn btn-danger" id="confirm-delete">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#cancel-delete').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-delete').addEventListener('click', async () => {
    try {
      await deleteAsset(id);
      overlay.remove();
      toast('Asset deleted', 'success');
      router.navigate('/assets');
    } catch {
      toast('Failed to delete asset', 'error');
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function showError(msg) {
  const content = document.querySelector('.page-content');
  if (content) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">${msg}</div>
        <a href="#/assets" class="btn btn-secondary mt-16">← Back to Assets</a>
      </div>
    `;
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
