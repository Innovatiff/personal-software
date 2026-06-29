// Toast notification system
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

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span style="font-size:16px;flex-shrink:0">${icons[type] || icons.info}</span><span>${message}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}
