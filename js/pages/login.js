import { auth } from '../firebase-config.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from '../router.js';
import { toast } from '../toast.js';

export function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">◈</div>
          <span>Passive Asset Portfolio</span>
        </div>
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to track your passive income</p>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email address</label>
            <input class="form-control" type="email" id="email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-control" type="password" id="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <div id="login-error" class="form-error" style="display:none;margin-bottom:12px"></div>
          <button class="btn btn-primary btn-full btn-lg" type="submit" id="login-btn">
            Sign In
          </button>
        </form>

        <div class="auth-footer">
          Don't have an account? <a href="#/register">Create one</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    errEl.style.display = 'none';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast('Welcome back!', 'success');
      router.navigate('/dashboard');
    } catch (err) {
      errEl.style.display = 'block';
      errEl.textContent = friendlyError(err.code);
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function friendlyError(code) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
