// Shared cards: passive-vs-active balance dial and personal records.
import { icon } from '../icons.js';
import { formatCurrency } from '../utils.js';
import { formatRecord } from '../coach.js';

export function balanceCard(bal, { compact = false } = {}) {
  const note = !bal.hasData ? ''
    : bal.pct >= 60 ? 'Most of your income runs without new projects. Nice.'
    : bal.pct >= 40 ? 'Balanced — recurring work and one-time jobs pull equal weight.'
    : 'Your income leans on one-time jobs. Each new recurring client moves this dial.';
  const delta = bal.delta === null ? '' : `
    <span class="badge ${bal.delta >= 0 ? 'badge-status-active' : 'badge-status-building'}" title="vs the previous ${bal.days} days">
      ${bal.delta >= 0 ? '↑' : '↓'} ${Math.abs(bal.delta)} pt${Math.abs(bal.delta) === 1 ? '' : 's'}
    </span>`;
  const row = (label, value, color) => `
    <div class="bal-row">
      <span class="bal-dot" style="background:${color}"></span>
      <span class="bal-label">${label}</span>
      <span class="bal-amt num">${formatCurrency(Math.round(value))}</span>
    </div>`;
  return `
    <div class="chart-card bal-card">
      <div class="section-header">
        <div>
          <div class="section-title">Income Balance</div>
          <div class="section-sub">Passive vs active · last ${bal.days} days</div>
        </div>
        ${delta}
      </div>
      ${bal.hasData ? `
        <div class="bal-wrap ${compact ? 'compact' : ''}">
          <div class="gauge bal-gauge" style="--v:0" data-gauge="${bal.pct}">
            <div class="gauge-label">
              <div class="gauge-value" style="font-size:26px" data-count="${bal.pct}" data-fmt="pct">${bal.pct}%</div>
              <div class="gauge-sub">passive</div>
            </div>
          </div>
          <div class="bal-legend">
            ${row('Recurring clients', bal.recurring, 'var(--accent)')}
            ${row('Assets', bal.assetsIncome, '#6b93ff')}
            ${row('One-time jobs', bal.oneTime, 'var(--yellow)')}
          </div>
        </div>
        <div class="bal-note">${note}</div>`
      : `<div class="empty-state" style="padding:26px 0"><div class="empty-icon" style="width:48px;height:48px;border-radius:14px">${icon('pie', 22)}</div><div class="empty-desc" style="margin:0">Paid invoices and assets will balance here</div></div>`}
    </div>`;
}

export function recordsCard(records, { limit = 7 } = {}) {
  const fresh = records.filter(r => r.isNew).length;
  return `
    <div class="chart-card">
      <div class="section-header">
        <div>
          <div class="section-title">Personal Records</div>
          <div class="section-sub">${fresh ? `<span style="color:#a66a00;font-weight:650">${fresh} set this month</span>` : 'Your all-time bests'}</div>
        </div>
        ${icon('trophy', 18)}
      </div>
      <div class="rec-grid">
        ${records.slice(0, limit).map(r => `
          <div class="rec ${r.isNew ? 'new' : ''} ${r.value > 0 ? '' : 'empty'}">
            <div class="rec-icon">${icon(r.icon, 16)}</div>
            <div class="rec-main">
              <div class="rec-label">${r.label}${r.isNew ? '<span class="rec-tag">New record</span>' : ''}</div>
              <div class="rec-value num">${r.value > 0 ? formatRecord(r) : '—'}</div>
              <div class="rec-sub">${r.sub}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}
