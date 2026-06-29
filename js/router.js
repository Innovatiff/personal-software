// Simple hash-based SPA router
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  on(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    let matched = null;
    let params = {};

    // Try exact match first
    if (this.routes[hash]) {
      matched = hash;
    } else {
      // Try parameterized routes
      for (const route in this.routes) {
        const routeParts = route.split('/');
        const hashParts = hash.split('/');
        if (routeParts.length !== hashParts.length) continue;

        let match = true;
        const p = {};
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) {
            p[routeParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
          } else if (routeParts[i] !== hashParts[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          matched = route;
          params = p;
          break;
        }
      }
    }

    if (matched) {
      this.currentRoute = { path: matched, params };
      this.routes[matched](params);
    } else if (this.routes['*']) {
      this.routes['*']({});
    }
  }

  start() {
    this.resolve();
  }
}

export const router = new Router();
