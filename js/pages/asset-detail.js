import { getAsset, deleteAsset } from '../db.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { categoryMeta, statusBadge, formatCurrency, formatDate } from '../utils.js';
import { icon } from '../icons.js';
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
        <div class="skeleton" style="height:44px;width:120px;margin-bottom:24px"></div>
        <div class="skeleton" style="height:260px;border-radius:var(--radius-lg)"></div>
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
  if (!asset) { showError('Asset not found.'); return; }

  const meta = categoryMeta(asset.category);
  const monthly = num(asset.monthlyIncome);
  const yearly = monthly * 12;
  const invested = num(asset.totalCost);
  const roi = invested > 0 ? ((yearly / invested) * 100).toFixed(1) : null;
  const payback = monthly > 0 ? (invested / monthly).toFixed(1) : null;

  const content = document.querySelector('.page-content');
  content.innerHTML = `
    <div style="margin-bottom:22px">
      <button class="btn btn-ghost btn-sm" onclick="location.hash='#/assets'">${icon('arrowLeft', 15)} Back to Assets</button>
    </div>

    <div class="detail-hero">
      <div class="detail-hero-header">
        <div class="detail-icon" style="background:${meta.bg};color:${meta.color}">${icon(meta.iconName, 27)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:8px">
            <h1 class="detail-name">${escHtml(asset.name)}</h1>
            ${statusBadge(asset.status)}
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="badge badge-category">${asset.category}</span>
            <span style="font-size:13px;color:var(--text-muted);display:inline-flex;align-items:center;gap:5px">
              ${icon('calendar', 13)} Created ${formatDate(asset.createdAt)}
            </span>
          </div>
        </div>
      </div>

      ${asset.description ? `<div class="detail-desc">${escHtml(asset.description)}</div>` : ''}

      ${asset.siteUrl ? `
      <a href="${escAttr(asset.siteUrl)}" target="_blank" rel="noopener noreferrer"
         style="display:inline-flex;align-items:center;gap:7px;margin-top:14px;font-size:13px;color:var(--accent-light);text-decoration:none;font-weight:550;padding:7px 12px;background:var(--purple-soft);border-radius:8px;transition:all 0.15s ease"
         onmouseover="this.style.background='rgba(124,108,255,0.2)'" onmouseout="this.style.background='var(--purple-soft)'">
        ${icon('external', 14)} ${escHtml(displayUrl(asset.siteUrl))}
      </a>` : ''}

      <div class="detail-stats">
        ${statBlock('Monthly Income', formatCurrency(monthly), 'green')}
        ${statBlock('Yearly Projection', formatCurrency(yearly), 'accent')}
        ${statBlock('Total Invested', formatCurrency(invested))}
        ${statBlock('Annual ROI', roi ? roi + '%' : '—', roi ? 'green' : '')}
        ${payback ? statBlock('Payback Period', payback + ' mo') : ''}
      </div>
    </div>

    ${asset.notes ? `
    <div class="detail-notes">
      <div class="detail-notes-title">Notes</div>
      <div class="detail-notes-text">${escHtml(asset.notes).replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <div class="detail-actions">
      <button class="btn btn-primary" onclick="location.hash='#/assets/${id}/edit'">${icon('edit', 16)} Edit Asset</button>
      <button class="btn btn-danger" id="delete-btn">${icon('trash', 16)} Delete</button>
    </div>
  `;

  document.getElementById('delete-btn').addEventListener('click', () => showConfirmDelete(id, asset.name));
}

function statBlock(label, value, cls = '') {
  return `
    <div class="detail-stat">
      <div class="detail-stat-label">${label}</div>
      <div class="detail-stat-value ${cls}">${value}</div>
    </div>`;
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
        <button class="btn btn-danger" id="confirm-delete">${icon('trash', 15)} Delete</button>
      </div>
    </div>`;
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
        <div class="empty-icon">${icon('alert', 28)}</div>
        <div class="empty-title">${msg}</div>
        <a href="#/assets" class="btn btn-secondary mt-16">${icon('arrowLeft', 15)} Back to Assets</a>
      </div>`;
  }
}

const num = (v) => Number(v) || 0;

function displayUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) { return escHtml(str).replace(/'/g, '&#39;'); }
