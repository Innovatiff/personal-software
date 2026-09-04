// Light/dark theme handling (light is the default).
export function currentTheme() {
  try { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'dark') el.setAttribute('data-theme', 'dark');
  else el.removeAttribute('data-theme');
  try { localStorage.setItem('theme', t); } catch {}
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme() {
  applyTheme(currentTheme());
}
