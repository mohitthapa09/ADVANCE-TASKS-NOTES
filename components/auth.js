import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  getProvider,
  onAuthStateChanged
} from '../firebase/auth.js';

import { upsertUserProfile } from '../firebase/firestore.js';
import { showToast } from '../assets/js/utils.js';

const $ = (id) => document.getElementById(id);

let confirmationResult = null;
let phoneVerifier = null;

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
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console.',
    'auth/invalid-verification-code': 'The OTP code is invalid or expired.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.'
  };
  showError(map[err.code] || err.message || 'Authentication failed.');
};

const completeSignIn = async (user) => {
  await upsertUserProfile(user);
  window.location.href = 'dashboard.html';
};

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'dashboard.html';
});

// Tabs
$('tab-email').addEventListener('click', () => {
  $('tab-email').classList.add('active');
  $('tab-phone').classList.remove('active');
  $('email-form').classList.remove('hidden');
  $('phone-form').classList.add('hidden');
  clearError();
});

$('tab-phone').addEventListener('click', () => {
  $('tab-phone').classList.add('active');
  $('tab-email').classList.remove('active');
  $('phone-form').classList.remove('hidden');
  $('email-form').classList.add('hidden');
  clearError();
});

// Email login
$('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const button = $('email-submit');
  setLoading(button, true);

  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const remember = $('remember-me').checked;

  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await completeSignIn(cred.user);
  } catch (err) {
    handleAuthError(err);
    setLoading(button, false);
  }
});

// Forgot password
$('forgot-password').addEventListener('click', async () => {
  const email = $('auth-email').value.trim();
  if (!email) {
    showError('Enter your email address first.');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Password reset email sent.', 'success');
  } catch (err) {
    handleAuthError(err);
  }
});

// OAuth
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
      await completeSignIn(result.user);
    } catch (err) {
      handleAuthError(err);
    }
  });
});

// Phone login
$('phone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const button = $('phone-submit');
  const label = $('phone-btn-label');
  const phone = $('auth-phone').value.trim();
  const otp = $('auth-otp').value.trim();
  const otpStep = $('otp-step');

  try {
    if (!confirmationResult) {
      setLoading(button, true);
      phoneVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      confirmationResult = await signInWithPhoneNumber(auth, phone, phoneVerifier);
      otpStep.classList.remove('hidden');
      label.textContent = 'Verify Code';
      $('resend-code').classList.remove('hidden');
      showToast('OTP sent! Check your phone.', 'success');
      setLoading(button, false);
    } else {
      if (!otp) {
        showError('Enter the 6-digit verification code.');
        return;
      }
      setLoading(button, true);
      const result = await confirmationResult.confirm(otp);
      await completeSignIn(result.user);
    }
  } catch (err) {
    handleAuthError(err);
    setLoading(button, false);
  }
});

$('resend-code').addEventListener('click', async () => {
  confirmationResult = null;
  $('otp-step').classList.add('hidden');
  $('phone-btn-label').textContent = 'Send Code';
  $('resend-code').classList.add('hidden');
  const phone = $('auth-phone').value.trim();
  phoneVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  confirmationResult = await signInWithPhoneNumber(auth, phone, phoneVerifier);
  showToast('New OTP sent.', 'success');
});