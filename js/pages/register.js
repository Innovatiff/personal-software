import { auth } from '../firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { router } from '../router.js';
import { toast } from '../toast.js';

export function renderRegister() {
  document.getElementById('app').innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">◈</div>
          <span>Passive Asset Portfolio</span>
        </div>
        <h1 class="auth-title">Create account</h1>
        <p class="auth-subtitle">Start tracking your passive income today</p>

        <form id="register-form">
          <div class="form-group">
            <label class="form-label">Full name</label>
            <input class="form-control" type="text" id="name" placeholder="Your name" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label class="form-label">Email address</label>
            <input class="form-control" type="email" id="email" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-control" type="password" id="password" placeholder="At least 6 characters" required autocomplete="new-password" minlength="6" />
          </div>
          <div id="register-error" class="form-error" style="display:none;margin-bottom:12px"></div>
          <button class="btn btn-primary btn-full btn-lg" type="submit" id="register-btn">
            Create Account
          </button>
        </form>

        <div class="auth-footer">
          Already have an account? <a href="#/login">Sign in</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    errEl.style.display = 'none';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      toast('Account created! Welcome!', 'success');
      router.navigate('/dashboard');
    } catch (err) {
      errEl.style.display = 'block';
      errEl.textContent = friendlyError(err.code);
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
