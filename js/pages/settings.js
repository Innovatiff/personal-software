import { auth } from '../firebase-config.js';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { renderSidebar, renderTopbar, attachNavbarEvents } from '../components/navbar.js';
import { toast } from '../toast.js';
import { router } from '../router.js';

export function renderSettings() {
  const user = auth.currentUser;
  const initial = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  document.getElementById('app').innerHTML = `
    ${renderSidebar('settings')}
    <div class="main-content">
      ${renderTopbar('Settings')}
      <div class="page-content" style="max-width:600px">
        <div class="page-header">
          <h1 class="page-title">Settings</h1>
          <p class="page-desc">Manage your account and preferences</p>
        </div>

        <!-- Profile -->
        <div class="settings-section">
          <div class="settings-title">Profile</div>
          <div class="settings-desc">Update your display name</div>

          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <div class="user-avatar" style="width:52px;height:52px;font-size:20px;flex-shrink:0">${initial}</div>
            <div>
              <div style="font-size:15px;font-weight:600">${user?.displayName || 'No name set'}</div>
              <div style="font-size:13px;color:var(--text-muted)">${user?.email}</div>
            </div>
          </div>

          <form id="profile-form">
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input class="form-control" type="text" id="display-name" value="${user?.displayName || ''}" placeholder="Your name" />
            </div>
            <button class="btn btn-primary btn-sm" type="submit" id="profile-btn">Save Name</button>
          </form>
        </div>

        <!-- Password -->
        <div class="settings-section">
          <div class="settings-title">Change Password</div>
          <div class="settings-desc">Update your account password</div>

          <form id="password-form">
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input class="form-control" type="password" id="current-password" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input class="form-control" type="password" id="new-password" placeholder="At least 6 characters" minlength="6" />
            </div>
            <div id="pw-error" class="form-error" style="display:none;margin-bottom:10px"></div>
            <button class="btn btn-primary btn-sm" type="submit" id="pw-btn">Update Password</button>
          </form>
        </div>

        <!-- Danger Zone -->
        <div class="danger-zone">
          <div class="settings-title" style="color:var(--red)">Danger Zone</div>
          <div class="settings-desc">These actions are irreversible. Be careful.</div>
          <button class="btn btn-danger" id="delete-account-btn">Delete Account</button>
        </div>
      </div>
    </div>
  `;

  attachNavbarEvents();

  // Profile form
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('display-name').value.trim();
    const btn = document.getElementById('profile-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      toast('Name updated!', 'success');
    } catch {
      toast('Failed to update name', 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Save Name';
  });

  // Password form
  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const btn = document.getElementById('pw-btn');
    const errEl = document.getElementById('pw-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Updating…';
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, next);
      toast('Password updated!', 'success');
      document.getElementById('password-form').reset();
    } catch (err) {
      errEl.style.display = 'block';
      errEl.textContent = err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : 'Failed to update password.';
    }
    btn.disabled = false;
    btn.textContent = 'Update Password';
  });

  // Delete account
  document.getElementById('delete-account-btn').addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title" style="color:var(--red)">Delete Account</div>
        <div class="modal-desc">This will permanently delete your account and all your assets. This cannot be undone.</div>
        <div class="form-group">
          <label class="form-label">Enter your password to confirm</label>
          <input class="form-control" type="password" id="confirm-pw" placeholder="Your password" />
        </div>
        <div id="del-err" class="form-error" style="display:none;margin-bottom:10px"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="cancel-del">Cancel</button>
          <button class="btn btn-danger" id="confirm-del">Delete Forever</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#cancel-del').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirm-del').addEventListener('click', async () => {
      const pw = overlay.querySelector('#confirm-pw').value;
      const errEl = overlay.querySelector('#del-err');
      try {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, pw);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await deleteUser(auth.currentUser);
        overlay.remove();
        toast('Account deleted', 'info');
        router.navigate('/login');
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = err.code === 'auth/wrong-password' ? 'Incorrect password.' : 'Failed to delete account.';
      }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  });
}
