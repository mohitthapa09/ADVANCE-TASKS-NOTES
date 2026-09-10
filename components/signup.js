import {
  auth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  getProvider,
  onAuthStateChanged
} from '../firebase/auth.js';

import { upsertUserProfile } from '../firebase/firestore.js';
import { showToast } from '../assets/js/utils.js';

const $ = (id) => document.getElementById(id);

const setLoading = (button, loading) => {
  const label = button.querySelector('.btn-label');
  const spinner = button.querySelector('.spinner');
  if (label) label.classList.toggle('hidden', loading);
  if (spinner) spinner.classList.toggle('hidden', !loading);
  button.disabled = loading;
};

const showError = (message) => {
  const el = $('auth-error');
  el.textContent = message;
};

const clearError = () => showError('');

const handleAuthError = (err) => {
  console.error(err);
  const map = {
    'auth/email-already-in-use': 'An account already exists with this email. Try signing in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-up popup was closed before completing.',
    'auth/operation-not-allowed': 'This sign-up method is not enabled in Firebase Console.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.'
  };
  showError(map[err.code] || err.message || 'Account creation failed.');
};

// Finish onboarding a freshly created (or OAuth-created) user, then land on the dashboard
const completeSignUp = async (user, displayName) => {
  if (displayName && !user.displayName) {
    await updateProfile(user, { displayName });
  }
  await upsertUserProfile(user);
  showToast('Account created! Welcome to ATN Workspace.', 'success');
  window.location.href = 'dashboard.html';
};

// Already signed in? Skip straight to the dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'dashboard.html';
});

// Email + password sign up
$('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const name = $('auth-name').value.trim();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const confirmPassword = $('auth-confirm-password').value;

  if (!name) {
    showError('Enter your full name.');
    return;
  }
  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }
  if (password !== confirmPassword) {
    showError('Passwords do not match.');
    return;
  }

  const button = $('signup-submit');
  setLoading(button, true);

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await completeSignUp(cred.user, name);
  } catch (err) {
    handleAuthError(err);
    setLoading(button, false);
  }
});

// OAuth sign up (also transparently signs in returning users)
document.querySelectorAll('.oauth-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    clearError();
    const providerName = btn.dataset.provider;
    try {
      const provider = getProvider(providerName);
      if (providerName === 'apple') {
        provider.addScope('email');
        provider.addScope('name');
      }
      const result = await signInWithPopup(auth, provider);
      await completeSignUp(result.user);
    } catch (err) {
      handleAuthError(err);
    }
  });
});
