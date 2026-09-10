import { auth, signOut } from '../firebase/auth.js';
import { showToast } from '../assets/js/utils.js';
import { requestPermissionAndGetToken } from '../firebase/messaging.js';

export const initNavbar = (user) => {
  const root = document.getElementById('navbar');
  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  root.innerHTML = `
    <div class="navbar-brand">
      <img src="./assets/icons/atn.svg" alt="ATN" width="32" height="32">
      ATN Workspace
    </div>
    <div class="navbar-actions">
      <button class="nav-btn" id="nav-notifications" aria-label="Notifications">
        <i class="fa-regular fa-bell"></i>
        <span class="badge hidden">0</span>
      </button>
      <button class="nav-btn" id="nav-export" aria-label="Export workspace">
        <i class="fa-solid fa-download"></i>
      </button>
      <button class="nav-btn" id="nav-share" aria-label="Share workspace">
        <i class="fa-solid fa-share-nodes"></i>
      </button>
      <button class="nav-btn" id="nav-remind" aria-label="Enable push notifications">
        <i class="fa-solid fa-bell-slash"></i>
      </button>
      <div class="user-avatar" id="nav-user" title="${user.email || ''}">${initial}</div>
    </div>
  `;

  root.querySelector('#nav-export').addEventListener('click', () =>
    window.dispatchEvent(new CustomEvent('open-export'))
  );

  root.querySelector('#nav-share').addEventListener('click', () =>
    window.dispatchEvent(new CustomEvent('share-request', { detail: { type: 'workspace' } }))
  );

  root.querySelector('#nav-remind').addEventListener('click', async () => {
    const token = await requestPermissionAndGetToken();
    if (token) {
      showToast('Notifications enabled ✅', 'success');
    } else {
      showToast('Notification permission denied.', 'error');
    }
  });

  root.querySelector('#nav-user').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });

  // Note: the notifications bell's click handler (open/close the dropdown panel)
  // is attached in components/notifications.js -> initNotifications(), which owns
  // #nav-notifications end-to-end (badge count + panel rendering).
};