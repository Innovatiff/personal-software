export function renderNotFound() {
  document.getElementById('app').innerHTML = `
    <div class="not-found">
      <div class="not-found-code">404</div>
      <div class="not-found-title">Page not found</div>
      <div class="not-found-desc">The page you're looking for doesn't exist or has been moved.</div>
      <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
    </div>
  `;
}
