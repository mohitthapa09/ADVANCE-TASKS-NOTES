import { auth } from '../firebase/config.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { escapeHtml, showToast, firebaseErrorMessage } from '../assets/js/utils.js';

const closeModal = () => {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => overlay.remove(), 250);
};

const openModal = (html) => {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`;
  const overlay = root.querySelector('.modal-overlay');
  requestAnimationFrame(() => overlay.classList.add('show'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  root.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });
  return overlay;
};

const fetchSourceContent = async ({ type, id }) => {
  if (type === 'workspace') {
    return { title: 'My ATN Workspace', body: 'Shared workspace overview.' };
  }
  const collectionName = type === 'note' ? 'notes' : 'tasks';
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return type === 'note'
    ? { title: data.title || 'Untitled note', body: data.content || '' }
    : { title: data.title || 'Untitled task', body: data.description || '' };
};

export const openShareModal = async ({ type, id }) => {
  const overlay = openModal(`
    <div class="modal-header">
      <h3>Share ${type === 'workspace' ? 'Workspace' : type === 'note' ? 'Note' : 'Task'}</h3>
      <button class="modal-close" data-close-modal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="modal-form" id="share-body">
      <p style="color:var(--muted);font-size:0.9rem;">Generating a shareable link…</p>
    </div>
  `);

  let source;
  try {
    source = await fetchSourceContent({ type, id });
  } catch (err) {
    console.error('Failed to load content to share', err);
    overlay.querySelector('#share-body').innerHTML =
      `<p style="color:var(--muted);">Could not load this content: ${escapeHtml(firebaseErrorMessage(err))}</p>`;
    return;
  }

  const body = overlay.querySelector('#share-body');

  if (!source && type !== 'workspace') {
    body.innerHTML = `<p style="color:var(--muted);">Save this ${type} before sharing it.</p>`;
    return;
  }

  const shareRef = doc(collection(db, 'shares'));
  const shareId = shareRef.id;
  const shareUrl = `${window.location.origin}/share.html?id=${shareId}`;

  // Creating the "shares" doc can fail (offline, missing permissions, etc.)
  // — previously that left the modal stuck forever on "Generating a
  // shareable link…" with no feedback at all.
  try {
    await setDoc(shareRef, {
      id: shareId,
      ownerUid: auth.currentUser?.uid || null,
      type,
      refId: id || null,
      title: source.title,
      body: source.body,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Failed to create share link', err);
    body.innerHTML = `
      <p style="color:var(--muted);font-size:0.9rem;">Could not generate a shareable link: ${escapeHtml(firebaseErrorMessage(err))}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Close</button>
      </div>
    `;
    body.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeModal));
    return;
  }

  const shareText = `${source.title} — ${shareUrl}`;

  body.innerHTML = `
    <p style="color:var(--muted);font-size:0.9rem;">Anyone with this link can view a read-only copy of <strong>${escapeHtml(source.title)}</strong>.</p>
    <div class="form-row" style="grid-template-columns: 1fr auto;">
      <input type="text" id="share-link-input" value="${shareUrl}" readonly>
      <button type="button" class="btn btn-primary" id="copy-share-link"><i class="fa-solid fa-copy"></i> Copy</button>
    </div>
    <div class="form-actions" style="flex-wrap:wrap;">
      <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp
      </a>
      <a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent(source.title)}&body=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">
        <i class="fa-solid fa-envelope"></i> Gmail / Email
      </a>
      <a class="btn btn-ghost" href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(source.title)}" target="_blank" rel="noopener">
        <i class="fa-brands fa-telegram"></i> Telegram
      </a>
      <button type="button" class="btn btn-ghost" data-close-modal>Done</button>
    </div>
  `;

  body.querySelector('#copy-share-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard', 'success');
    } catch {
      body.querySelector('#share-link-input').select();
      showToast('Select and copy the link manually', 'info');
    }
  });
  body.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeModal));
};

export const initShare = () => {
  // Modal is created on demand by openShareModal(); nothing to pre-render.
};
