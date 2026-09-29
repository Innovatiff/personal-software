// ============================================
// Global search (⌘K): clients, assets, invoices + quick actions
// ============================================
import { getBusinesses, getAssets, getInvoices } from './db.js';
import { icon } from './icons.js';
import { formatCurrency } from './utils.js';

let _cache = null, _cacheAt = 0;
let _docClick = null, _docKey = null; // page-level listeners (replaced on each render)

async function loadIndex() {
  if (_cache && Date.now() - _cacheAt < 60000) return _cache;
  const [businesses, assets, invoices] = await Promise.all([
    getBusinesses().catch(() => []), getAssets().catch(() => []), getInvoices().catch(() => []),
  ]);
  _cache = { businesses, assets, invoices };
  _cacheAt = Date.now();
  return _cache;
}

const ACTIONS = [
  { label: 'New invoice', sub: 'Register a one-time service', icon: 'receipt', hash: '/invoices/new' },
  { label: 'Add client', sub: 'A business paying recurring fees', icon: 'building2', hash: '/businesses/add' },
  { label: 'Add asset', sub: 'A passive income source', icon: 'layers', hash: '/assets/add' },
  { label: 'Add expense', sub: 'A platform or service you pay for', icon: 'server', hash: '/platforms/add' },
];

export function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const panel = document.getElementById('search-results');
  if (!input || !panel) return;

  let timer = null;
  const close = () => { panel.classList.remove('open'); panel.innerHTML = ''; };

  const render = async (q) => {
    const query = q.trim().toLowerCase();
    const groups = [];

    const actions = ACTIONS.filter(a => !query || a.label.toLowerCase().includes(query) || a.sub.toLowerCase().includes(query));
    if (actions.length) groups.push({ title: 'Quick actions', items: actions.map(a => ({ ...a, tint: 'var(--purple-soft)', color: 'var(--accent)' })) });

    if (query) {
      const { businesses, assets, invoices } = await loadIndex();
      const hit = (s) => (s || '').toLowerCase().includes(query);
      const biz = businesses.filter(b => hit(b.name) || hit(b.service) || hit(b.description)).slice(0, 4)
        .map(b => ({ label: b.name, sub: `${b.service || 'Client'} · ${b.status || ''}`, icon: 'building2', hash: `/businesses/${b.id}/edit`, tint: 'var(--blue-soft)', color: 'var(--blue)' }));
      const inv = invoices.filter(i => hit(i.number) || hit(i.clientName) || hit(i.description)).slice(0, 4)
        .map(i => ({ label: `${i.number} · ${i.clientName}`, sub: `${formatCurrency(Number(i.amount) || 0)} · ${i.status || 'Paid'}`, icon: 'receipt', hash: `/invoices/${i.id}`, tint: 'var(--green-soft)', color: 'var(--green)' }));
      const ast = assets.filter(a => hit(a.name) || hit(a.category)).slice(0, 3)
        .map(a => ({ label: a.name, sub: a.category || 'Asset', icon: 'layers', hash: `/assets/${a.id}`, tint: 'var(--yellow-soft)', color: 'var(--yellow)' }));
      if (biz.length) groups.push({ title: 'Clients', items: biz });
      if (inv.length) groups.push({ title: 'Invoices', items: inv });
      if (ast.length) groups.push({ title: 'Assets', items: ast });
    }

    if (!groups.length) {
      panel.innerHTML = `<div class="search-empty">No results for “${escHtml(q)}”</div>`;
    } else {
      panel.innerHTML = groups.map(g => `
        <div class="search-group">${g.title}</div>
        ${g.items.map(it => `
          <a class="search-item" href="#${it.hash}">
            <span class="search-item-icon" style="background:${it.tint};color:${it.color}">${icon(it.icon, 16)}</span>
            <span class="search-item-main"><span class="search-item-label">${escHtml(it.label)}</span><span class="search-item-sub">${escHtml(it.sub)}</span></span>
            ${icon('arrowUpRight', 14)}
          </a>`).join('')}`).join('');
    }
    panel.classList.add('open');
    panel.querySelectorAll('.search-item').forEach(a => a.addEventListener('click', () => { input.value = ''; close(); }));
  };

  input.addEventListener('focus', () => { loadIndex(); render(input.value); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => render(input.value), 120); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.blur(); close(); }
    if (e.key === 'Enter') { const first = panel.querySelector('.search-item'); if (first) first.click(); }
  });
  if (_docClick) document.removeEventListener('click', _docClick);
  if (_docKey) document.removeEventListener('keydown', _docKey);
  _docClick = (e) => { if (!e.target.closest('.topbar-search')) close(); };
  _docKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
  };
  document.addEventListener('click', _docClick);
  document.addEventListener('keydown', _docKey);
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
