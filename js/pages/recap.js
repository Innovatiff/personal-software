import { getInvoices, getBusinesses } from '../db.js';
import { auth } from '../firebase-config.js';
import { router } from '../router.js';
import { formatCurrency, formatShortDate, tsMonthKey } from '../utils.js';
import { icon } from '../icons.js';
import { countUps, animateCharts, haptic } from '../anim.js';
import { achievementsFor } from '../achievements.js';
import { monthRecap, levelFor, prevMonthKey, nextMonthKey, monthLabel } from '../insights.js';
import { toast } from '../toast.js';

const SEEN_KEY = 'inv-recap-seen';
const SLIDE_MS = 6500;
let _keyHandler = null;

/** Last completed month with the recap ready to watch. */
export function recapMonthKey() { return prevMonthKey(tsMonthKey(new Date())); }
export function recapSeen(key) { try { return (localStorage.getItem(SEEN_KEY) || '') >= key; } catch { return true; } }
function markRecapSeen(key) { try { if (!recapSeen(key)) localStorage.setItem(SEEN_KEY, key); } catch {} }

/**
 * Full-screen, swipeable monthly recap (story format).
 * Route: /recap (last month) or /recap/YYYY-MM
 */
export async function renderRecap(params = {}) {
  const key = /^\d{4}-\d{2}$/.test(params.key || '') ? params.key : recapMonthKey();
  const app = document.getElementById('app');
  app.innerHTML = `<div class="story"><div class="story-bg ink"></div><div class="story-slide" style="align-items:center"><div class="loading-spinner"></div></div></div>`;

  let invoices = [], businesses = [];
  try {
    [invoices, businesses] = await Promise.all([getInvoices().catch(() => []), getBusinesses().catch(() => [])]);
  } catch (err) { console.error(err); }

  const data = { invoices, businesses };
  const r = monthRecap(data, key);
  const ach = achievementsFor(data);
  const trophies = ach.milestones.filter(m => m.earnedAt && m.earnedAt.startsWith(key));
  const lv = levelFor(r.lifetimeThrough);
  if (key <= recapMonthKey()) markRecapSeen(key);

  const slides = buildSlides(r, lv, trophies, ach);
  mountStory(app, slides, { r, lv, trophies });
}

// ── Slides ───────────────────────────────────────────────────

function buildSlides(r, lv, trophies, ach) {
  const firstName = auth.currentUser?.displayName?.split(' ')[0] || 'there';
  const s = (n) => (n === 1 ? '' : 's');
  const slides = [];

  slides.push({ bg: 'ink', html: `
    <div class="story-kicker">Innovatif · Monthly recap</div>
    <div class="story-title">${r.monthName}<br><span class="dim">${r.year}</span></div>
    <p class="story-sub">Here's how your month went, ${escHtml(firstName)}.</p>
    <p class="story-hint">Tap to continue · swipe to go back</p>` });

  if (!r.payments) {
    slides.push({ bg: 'blue', last: true, html: `
      <div class="story-kicker">Quiet month</div>
      <div class="story-title">Nothing collected in ${r.monthName}</div>
      <p class="story-sub">Every payment you record shows up here. Mark a client paid or register a one-time job and next month's recap will have a story to tell.</p>` });
    return slides;
  }

  const deltaChip = r.delta !== null
    ? `<span class="story-chip ${r.delta >= 0 ? 'up' : 'down'}">${icon(r.delta >= 0 ? 'trendingUp' : 'trendingDown', 15)} ${r.delta >= 0 ? '+' : ''}${r.delta}% vs ${monthLabel(prevMonthKey(r.key), { month: 'long' })}</span>`
    : `<span class="story-chip">${icon('sparkle', 15)} Your first month on record</span>`;
  slides.push({ bg: 'blue', html: `
    <div class="story-kicker">You collected</div>
    <div class="story-big num" data-count="${r.total}" data-fmt="cur">${formatCurrency(r.total)}</div>
    <div>${deltaChip}</div>
    <p class="story-sub" style="margin-top:18px">${r.payments} payment${s(r.payments)} from ${r.clientsPaid} client${s(r.clientsPaid)}</p>` });

  const recPct = r.total ? Math.round((r.recurringTotal / r.total) * 100) : 0;
  slides.push({ bg: 'ink', html: `
    <div class="story-kicker">Where it came from</div>
    <div class="story-title">${r.payments} payment${s(r.payments)}</div>
    <div class="story-split"><i data-w="${recPct}"></i></div>
    <div class="story-split-legend"><span>${recPct}% recurring</span><span>${100 - recPct}% one-time</span></div>
    <div class="story-list">
      <div class="story-row"><span>${icon('receipt', 16)} Recurring · ${r.recurringCount}</span><b class="num">${formatCurrency(r.recurringTotal)}</b></div>
      <div class="story-row"><span>${icon('sparkle', 16)} One-time jobs · ${r.oneTimeCount}</span><b class="num">${formatCurrency(r.oneTimeTotal)}</b></div>
      ${r.newClients ? `<div class="story-row"><span>${icon('building2', 16)} New clients</span><b>${r.newClients}</b></div>` : ''}
    </div>` });

  if (r.bestClient) {
    slides.push({ bg: 'royal', html: `
      <div class="story-kicker">MVP client</div>
      <div class="story-avatar">${escHtml(r.bestClient.name[0].toUpperCase())}</div>
      <div class="story-title">${escHtml(r.bestClient.name)}</div>
      <p class="story-sub"><b class="num">${formatCurrency(r.bestClient.amount)}</b> · ${r.bestClient.share}% of your month</p>` });
  }

  if (r.biggestJob) {
    slides.push({ bg: 'ink', html: `
      <div class="story-kicker">Biggest job</div>
      <div class="story-big num" data-count="${r.biggestJob.amount}" data-fmt="cur">${formatCurrency(r.biggestJob.amount)}</div>
      <div class="story-title sm">${escHtml(r.biggestJob.description)}</div>
      ${r.biggestJob.clientName ? `<p class="story-sub">for ${escHtml(r.biggestJob.clientName)}</p>` : ''}` });
  }

  if (r.bestDay && r.bestDay.count > 1) {
    slides.push({ bg: 'green', html: `
      <div class="story-kicker">Best day</div>
      <div class="story-title">${formatShortDate(r.bestDay.date)}</div>
      <div class="story-big num" data-count="${r.bestDay.amount}" data-fmt="cur">${formatCurrency(r.bestDay.amount)}</div>
      <p class="story-sub">${r.bestDay.count} payment${s(r.bestDay.count)} landed in a single day</p>` });
  }

  if (trophies.length) {
    slides.push({ bg: 'gold', html: `
      <div class="story-kicker">Unlocked this month</div>
      <div class="story-title">${trophies.length} troph${trophies.length === 1 ? 'y' : 'ies'}</div>
      <div class="story-list">
        ${trophies.slice(0, 4).map(m => `
          <div class="story-row">
            <span class="story-badge">${icon(m.icon, 18, { strokeWidth: 2 })}</span>
            <span style="flex:1;min-width:0"><b>${escHtml(m.title)}</b><small>${escHtml(m.desc)}</small></span>
          </div>`).join('')}
        ${trophies.length > 4 ? `<div class="story-hint" style="padding:0">+${trophies.length - 4} more in your trophy case</div>` : ''}
      </div>` });
  } else if (ach.locked.length) {
    const n = ach.locked[0];
    slides.push({ bg: 'gold', html: `
      <div class="story-kicker">Next trophy</div>
      <div class="story-badge lg">${icon(n.icon, 30, { strokeWidth: 2 })}</div>
      <div class="story-title">${escHtml(n.title)}</div>
      <p class="story-sub">${escHtml(n.desc)}</p>
      <div class="story-xp"><i data-w="${n.pct}"></i></div>
      <p class="story-sub" style="font-size:14px">${n.hint ? escHtml(n.hint) : n.progress} · ${n.pct}%</p>` });
  }

  slides.push({ bg: 'blue', last: true, html: `
    <div class="story-kicker">Your level</div>
    <div class="story-title">Level ${lv.level} · ${lv.name}</div>
    <div class="story-xp"><i data-w="${lv.pct}"></i></div>
    <p class="story-sub"><b class="num">${formatCurrency(lv.xp)}</b> collected all time${lv.next ? ` · ${formatCurrency(lv.toNext)} to ${lv.next.name}` : ' · max level'}</p>
    <p class="story-sub" style="margin-top:26px;color:#fff;font-weight:650">On to ${monthLabel(nextMonthKey(r.key), { month: 'long' })}. Keep it going.</p>` });

  return slides;
}

// ── Story player ─────────────────────────────────────────────

function mountStory(app, slides, ctx) {
  app.innerHTML = `
    <div class="story" id="story">
      <div class="story-bg ${slides[0].bg}" id="story-bg"></div>
      <div class="story-bars">${slides.map(() => '<div class="story-bar"><i></i></div>').join('')}</div>
      <div class="story-head">
        <div class="story-brand">${icon('sparkle', 14)} ${escHtml(ctx.r.label)}</div>
        <button class="story-close" id="story-close" aria-label="Close">${icon('x', 16)}</button>
      </div>
      <div class="story-slide" id="story-slide"></div>
      <div class="story-tap l" id="tap-l"></div>
      <div class="story-tap r" id="tap-r"></div>
      <div class="story-foot" id="story-foot">
        <button class="btn btn-white btn-lg" id="story-share">${icon('share', 17)} Share</button>
        <button class="btn btn-lg btn-ghost-white" id="story-done">Done</button>
      </div>
    </div>`;

  const bg = document.getElementById('story-bg');
  const slideEl = document.getElementById('story-slide');
  const foot = document.getElementById('story-foot');
  const bars = [...document.querySelectorAll('.story-bar')];
  let i = 0, anim = null;

  const show = (n) => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    const sl = slides[i];
    bg.className = 'story-bg ' + sl.bg;
    slideEl.innerHTML = sl.html;
    slideEl.classList.remove('in'); void slideEl.offsetWidth; slideEl.classList.add('in');
    countUps(slideEl); animateCharts(slideEl);
    bars.forEach((b, k) => { b.querySelector('i').style.width = k < i ? '100%' : '0%'; });
    if (anim) { anim.cancel(); anim = null; }
    foot.style.display = sl.last ? 'flex' : 'none';
    const fill = bars[i].querySelector('i');
    if (sl.last) { fill.style.width = '100%'; return; }
    anim = fill.animate([{ width: '0%' }, { width: '100%' }], { duration: SLIDE_MS, fill: 'forwards', easing: 'linear' });
    anim.onfinish = () => show(i + 1);
  };
  const next = () => { haptic(5); if (i < slides.length - 1) show(i + 1); };
  const prev = () => { haptic(5); show(i - 1); };
  const close = () => {
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    if (history.length > 1) history.back(); else router.navigate('/dashboard');
  };

  // Tap / hold / swipe
  let downX = 0, downT = 0;
  const onDown = (e) => { downX = e.clientX; downT = Date.now(); anim?.pause(); };
  const onUp = (side) => (e) => {
    const dx = e.clientX - downX, held = Date.now() - downT;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); return; }
    if (held < 260) { side === 'l' ? prev() : next(); return; }
    anim?.play();
  };
  ['l', 'r'].forEach(side => {
    const el = document.getElementById('tap-' + side);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp(side));
    el.addEventListener('pointercancel', () => anim?.play());
  });
  document.getElementById('story-close').addEventListener('click', close);
  document.getElementById('story-done').addEventListener('click', close);
  document.getElementById('story-share').addEventListener('click', (e) => shareRecap(ctx, e.currentTarget));

  if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
  _keyHandler = (e) => {
    if (!document.getElementById('story')) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; return; }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', _keyHandler);

  show(0);
}

// ── Share image (1080×1920 story card) ───────────────────────

async function shareRecap({ r, lv, trophies }, btn) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const font = (w, size) => `${w} ${size}px Inter, system-ui, -apple-system, sans-serif`;

  // Background
  x.fillStyle = '#07080b'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(200, 300, 0, 200, 300, 900);
  g.addColorStop(0, 'rgba(59,109,245,0.55)'); g.addColorStop(1, 'rgba(59,109,245,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const g2 = x.createRadialGradient(980, 1500, 0, 980, 1500, 700);
  g2.addColorStop(0, 'rgba(35,82,224,0.35)'); g2.addColorStop(1, 'rgba(35,82,224,0)');
  x.fillStyle = g2; x.fillRect(0, 0, W, H);

  // Brand
  roundRect(x, 80, 96, 96, 96, 26, '#0c0c11', 'rgba(255,255,255,0.14)');
  x.fillStyle = '#fff';
  x.beginPath();
  [[4.5, 7.6], [16, 24.4], [27.5, 7.6], [16, 19.1]].forEach(([px, py], k) => { const X = 80 + px * 3, Y = 96 + py * 3; k ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.closePath(); x.fill();
  x.fillStyle = '#fff'; x.font = font(800, 46); x.fillText('Innovatif', 200, 140);
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = font(700, 24); x.fillText('MONTHLY RECAP', 200, 178);

  // Month + total
  x.fillStyle = '#fff'; x.font = font(800, 88); x.fillText(r.label, 80, 420);
  x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = font(600, 34); x.fillText('You collected', 80, 540);
  x.fillStyle = '#fff'; x.font = font(800, 150); x.fillText(formatCurrency(r.total), 74, 690);
  if (r.delta !== null) {
    const up = r.delta >= 0;
    const label = `${up ? '▲' : '▼'} ${Math.abs(r.delta)}% vs ${monthLabel(prevMonthKey(r.key), { month: 'long' })}`;
    x.font = font(700, 30);
    const w = x.measureText(label).width + 56;
    roundRect(x, 80, 730, w, 62, 31, up ? 'rgba(52,211,153,0.22)' : 'rgba(251,113,133,0.22)');
    x.fillStyle = up ? '#6ee7b7' : '#fda4af'; x.fillText(label, 108, 772);
  }

  // Stat rows
  const rows = [
    ['Payments', `${r.payments}`, `${r.recurringCount} recurring · ${r.oneTimeCount} one-time`],
    r.bestClient ? ['MVP client', r.bestClient.name, `${formatCurrency(r.bestClient.amount)} · ${r.bestClient.share}% of the month`] : null,
    r.biggestJob ? ['Biggest job', formatCurrency(r.biggestJob.amount), r.biggestJob.description] : null,
    trophies.length ? ['Trophies unlocked', `${trophies.length}`, trophies.slice(0, 2).map(t => t.title).join(' · ')] : null,
  ].filter(Boolean);
  let y = 880;
  rows.forEach(([label, value, sub]) => {
    roundRect(x, 80, y, W - 160, 150, 28, 'rgba(255,255,255,0.08)');
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = font(700, 24); x.fillText(label.toUpperCase(), 116, y + 52);
    x.fillStyle = '#fff'; x.font = font(800, 46); x.fillText(clip(x, value, W - 260), 116, y + 104);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = font(500, 26); x.fillText(clip(x, sub, W - 260), 116, y + 136);
    y += 174;
  });

  // Level
  y = Math.max(y + 40, 1600);
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = font(700, 24); x.fillText('LEVEL', 80, y);
  x.fillStyle = '#fff'; x.font = font(800, 46); x.fillText(`Level ${lv.level} · ${lv.name}`, 80, y + 54);
  roundRect(x, 80, y + 84, W - 160, 18, 9, 'rgba(255,255,255,0.14)');
  roundRect(x, 80, y + 84, Math.max(18, (W - 160) * lv.pct / 100), 18, 9, '#6b93ff');
  x.fillStyle = 'rgba(255,255,255,0.45)'; x.font = font(600, 26);
  x.fillText('innovatif · Design. Build. Bill.', 80, H - 70);

  try {
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const file = new File([blob], `innovatif-recap-${r.key}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `${r.label} recap · Innovatif`, text: `${formatCurrency(r.total)} collected in ${r.label}` });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Recap image saved', 'success');
    }
    haptic(10);
  } catch (err) {
    if (err?.name !== 'AbortError') { console.error(err); toast('Could not share the recap', 'error'); }
  }
  btn?.blur();
}

function roundRect(x, X, Y, W, H, r, fill, stroke) {
  x.beginPath();
  x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
  x.fillStyle = fill; x.fill();
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); }
}
function clip(x, text, maxW) {
  let t = String(text || '');
  if (x.measureText(t).width <= maxW) return t;
  while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
