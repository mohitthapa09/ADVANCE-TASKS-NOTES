import { doc, getDoc } from '../firebase/firestore.js';
import { db } from '../firebase/config.js';

const params = new URLSearchParams(window.location.search);
const shareId = params.get('id');
const contentEl = document.getElementById('share-content');

const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

const renderNotFound = () => {
  contentEl.innerHTML = `
    <div class="share-content">
      <h1>Link not found</h1>
      <p>This shared link is invalid or has expired.</p>
    </div>
  `;
};

const renderShare = (data) => {
  document.title = `${data.title || 'Shared content'} — ATN Workspace`;

  if (data.type === 'task') {
    contentEl.innerHTML = `
      <div class="share-content">
        <h1>${escapeHtml(data.title)}</h1>
        <p>${escapeHtml(data.body || 'No description provided.')}</p>
      </div>
    `;
    return;
  }

  // Notes were sanitized before storage in the main app, safe to render as HTML.
  contentEl.innerHTML = `
    <div class="share-content">
      <h1>${escapeHtml(data.title)}</h1>
      ${data.body || '<p>This note is empty.</p>'}
    </div>
  `;
};

(async () => {
  if (!shareId) {
    renderNotFound();
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) {
      renderNotFound();
      return;
    }
    renderShare(snap.data());
  } catch (err) {
    console.error('Failed to load shared content', err);
    renderNotFound();
  }
})();
