// ============================================
// Premium micro-interactions: count-ups, chart
// sweeps and haptic feedback.
// ============================================
import { formatCurrency } from './utils.js';

const reduceMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOut = t => 1 - Math.pow(1 - t, 3);

/** Animate every [data-count] element from 0 to its value. */
export function countUps(root = document) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count) || 0;
    const fmt = el.dataset.fmt || 'cur';
    const render = v => {
      if (fmt === 'cur') el.textContent = formatCurrency(v);
      else if (fmt === 'pct') el.textContent = Math.round(v) + '%';
      else el.textContent = String(Math.round(v));
    };
    if (reduceMotion() || target === 0) { render(target); return; }
    const dur = 800, t0 = performance.now();
    const frame = now => {
      const p = Math.min(1, (now - t0) / dur);
      render(p === 1 ? target : target * easeOut(p));
      if (p < 1 && el.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/**
 * Sweep charts into place:
 *  [data-w]      → animates width to N%
 *  [data-h]      → animates height to N%
 *  [data-gauge]  → animates the --v custom property (conic gauge)
 */
export function animateCharts(root = document) {
  const reduce = reduceMotion();

  root.querySelectorAll('[data-w]').forEach(el => {
    if (reduce) { el.style.width = el.dataset.w + '%'; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = el.dataset.w + '%'; }));
  });

  root.querySelectorAll('[data-h]').forEach(el => {
    if (reduce) { el.style.height = el.dataset.h + '%'; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.height = el.dataset.h + '%'; }));
  });

  root.querySelectorAll('[data-gauge]').forEach(el => {
    const target = parseFloat(el.dataset.gauge) || 0;
    if (reduce) { el.style.setProperty('--v', target); return; }
    const dur = 950, t0 = performance.now();
    const frame = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.style.setProperty('--v', (target * easeOut(p)).toFixed(2));
      if (p < 1 && el.isConnected) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** Light haptic tap on supporting devices (no-op elsewhere). */
export function haptic(ms = 10) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
}
