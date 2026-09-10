export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = (fn, limit = 300) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const uid = () =>
  `${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;

export const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatDateTime = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

export const sanitizeHtml = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
};

export const showToast = (message, type = 'info') => {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  }[type];
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  root.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
};

export const downloadFile = (content, fileName, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Turns a raw Firestore/Firebase error into something a user (or you, in
// the moment) can actually act on, instead of a generic "something broke".
export const firebaseErrorMessage = (err) => {
  if (!err) return 'Unknown error';
  switch (err.code) {
    case 'permission-denied':
      return 'permission denied — your Firestore security rules need to allow this. See firestore.rules.';
    case 'failed-precondition':
      return 'a Firestore index is missing — open the browser console, there should be a link to create it.';
    case 'unavailable':
      return 'network/connection issue — check you\u2019re online.';
    case 'unauthenticated':
      return 'you\u2019re not signed in.';
    default:
      return err.message || 'something went wrong.';
  }
};