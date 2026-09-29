// ============================================
// Payday celebration: confetti, a short chime, haptics, a flying
// "+$400" pill and a banner with the month total, streak and any
// newly unlocked trophies.
// ============================================
import { icon } from './icons.js';
import { formatCurrency } from './utils.js';
import { haptic } from './anim.js';

const PREF_KEY = 'inv-celebrate';
const DEFAULTS = { confetti: true, sound: true };

export function celebratePrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export function setCelebratePrefs(patch) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...celebratePrefs(), ...patch })); } catch {}
}

const reduceMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Confetti (canvas, no dependencies) ───────────────────────

const COLORS = ['#2352e0', '#6b93ff', '#0c0c11', '#0f9d58', '#f5b301', '#ff5d8f', '#9cb6ff', '#ffffff'];

export function confetti({ x = innerWidth / 2, y = innerHeight * 0.42, count = 150, spread = 65 } = {}) {
  if (!celebratePrefs().confetti || reduceMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = (-90 + (Math.random() - 0.5) * spread * 2) * Math.PI / 180;
    const speed = 8 + Math.random() * 10;
    parts.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 6, h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[i % COLORS.length],
      circle: Math.random() < 0.22,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const dur = 2600, t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const fade = t > dur - 700 ? Math.max(0, (dur - t) / 700) : 1;
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.color === '#ffffff') { ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 3; }
      if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.max(1, p.h * Math.abs(Math.cos(t / 160 + p.phase))));
      ctx.restore();
    }
    if (t < dur && canvas.isConnected) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// ── Chime (Web Audio, no files) ──────────────────────────────

let _audio = null;
export function chime() {
  if (!celebratePrefs().sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    _audio = _audio || new AC();
    if (_audio.state === 'suspended') _audio.resume();
    const t = _audio.currentTime;
    const master = _audio.createGain();
    master.gain.value = 0.16;
    master.connect(_audio.destination);
    // C major arpeggio: C5 E5 G5 C6 — bright, short, not annoying
    [[523.25, 0], [659.25, 0.08], [783.99, 0.16], [1046.5, 0.24]].forEach(([freq, dt]) => {
      const osc = _audio.createOscillator();
      const g = _audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(1, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.6);
      osc.connect(g); g.connect(master);
      osc.start(t + dt); osc.stop(t + dt + 0.65);
    });
  } catch {}
}

// ── Payday banner ────────────────────────────────────────────

/**
 * @param {object} o
 * @param {number} o.amount        amount just collected
 * @param {string} o.clientName
 * @param {number} o.monthTotal    collected so far this month (incl. this one)
 * @param {number} o.lastMonth     last month's total
 * @param {object} o.streaks       from achievements.computeStreaks
 * @param {Array}  o.badges        newly unlocked milestones
 * @param {{x:number,y:number}} o.origin  where the click happened
 */
export function payday({ amount = 0, clientName = '', monthTotal = 0, lastMonth = 0, streaks = null, badges = [], xp = null, origin } = {}) {
  haptic(xp?.leveledUp ? [20, 40, 20, 40, 20, 40, 120] : [18, 40, 26, 40, 60]);
  chime();

  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.45;
  confetti({ x: ox, y: oy });

  // Remove any banner that is still on screen
  document.querySelectorAll('.payday').forEach(el => el.remove());

  const showBanner = () => {
    const el = document.createElement('div');
    el.className = 'payday';
    const delta = lastMonth > 0 ? Math.round(((monthTotal - lastMonth) / lastMonth) * 100) : null;
    const chips = [];
    if (streaks?.growth > 0) {
      chips.push(`<span class="pd-chip hot">${icon('flame', 13, { strokeWidth: 2.2 })} ${streaks.growth}-month growth streak</span>`);
    } else if (streaks && streaks.needed > 0) {
      chips.push(`<span class="pd-chip">${icon('flame', 13, { strokeWidth: 2.2 })} ${formatCurrency(streaks.needed)} more beats last month</span>`);
    }
    if (streaks?.goalAmount) {
      const pct = Math.min(999, Math.round((monthTotal / streaks.goalAmount) * 100));
      chips.push(`<span class="pd-chip ${pct >= 100 ? 'goal' : ''}">${icon('target', 13, { strokeWidth: 2.2 })} ${pct >= 100 ? 'Goal reached' : pct + '% of goal'}</span>`);
    }
    if (xp) {
      chips.push(`<span class="pd-chip xp">${icon('medal', 13, { strokeWidth: 2.2 })} +${Math.round(xp.gained).toLocaleString('en-US')} XP · Level ${xp.level.level} ${xp.level.name}${xp.level.next ? ` · ${xp.level.pct}%` : ''}</span>`);
    }
    const levelHtml = xp?.leveledUp ? `
      <div class="pd-levelup">
        <span class="pd-levelup-icon">${icon('medal', 16, { strokeWidth: 2.2 })}</span>
        <span>Level up! You're now <b>Level ${xp.level.level} · ${xp.level.name}</b></span>
      </div>` : '';
    const badgeHtml = badges.length ? `
      <a class="pd-badges" href="#/trophies">
        <span class="pd-badge-icon">${icon('trophy', 15, { strokeWidth: 2.2 })}</span>
        <span>New trophy: <b>${escHtml(badges[0].title)}</b>${badges.length > 1 ? ` <span class="pd-more">+${badges.length - 1} more</span>` : ''}</span>
        ${icon('arrowUpRight', 14)}
      </a>` : '';

    el.innerHTML = `
      <div class="pd-icon">${icon('partyPopper', 22, { strokeWidth: 2 })}</div>
      <div class="pd-main">
        <div class="pd-title">Payday! <span class="pd-amt num">+${formatCurrency(amount)}</span></div>
        <div class="pd-sub">${clientName ? `from ${escHtml(clientName)} · ` : ''}<b class="num">${formatCurrency(monthTotal)}</b> collected this month${delta !== null ? ` · <span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs last month</span>` : ''}</div>
        ${chips.length ? `<div class="pd-chips">${chips.join('')}</div>` : ''}
        ${levelHtml}
        ${badgeHtml}
      </div>
      <button class="pd-close" aria-label="Dismiss">${icon('x', 15)}</button>`;
    document.body.appendChild(el);

    const close = () => {
      if (!el.isConnected) return;
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 320);
    };
    el.querySelector('.pd-close').addEventListener('click', close);
    el.querySelector('.pd-badges')?.addEventListener('click', close);
    setTimeout(close, badges.length || xp?.leveledUp ? 9000 : 6500);
  };
  if (xp?.leveledUp) setTimeout(() => confetti({ x: innerWidth / 2, y: 90, count: 110, spread: 80 }), 1250);

  if (reduceMotion()) { showBanner(); return; }

  // Flying "+$400" pill from the button up to where the banner lands
  const pill = document.createElement('div');
  pill.className = 'fly-amount num';
  pill.textContent = '+' + formatCurrency(amount);
  pill.style.left = ox + 'px';
  pill.style.top = oy + 'px';
  document.body.appendChild(pill);
  const dx = innerWidth / 2 - ox;
  const dy = 70 - oy;
  const anim = pill.animate([
    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 1, offset: 0.4 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`, opacity: 1, offset: 0.9 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0 },
  ], { duration: 1100, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' });
  anim.onfinish = () => { pill.remove(); showBanner(); };
  setTimeout(() => { if (pill.isConnected) { pill.remove(); showBanner(); } }, 1400); // safety net
}

/** Position of an element's centre, for `origin`. */
export function originOf(el) {
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
