// Toast notification system
import { icon } from './icons.js';

let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message, type = 'info', duration = 3500) {
  const container = getContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;

  const iconName = { success: 'check', error: 'x', info: 'info' }[type] || 'info';
  el.innerHTML = `<span class="toast-icon">${icon(iconName, 14, { strokeWidth: 2.5 })}</span><span>${message}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}
