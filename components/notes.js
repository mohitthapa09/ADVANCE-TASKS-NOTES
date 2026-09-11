import { auth } from '../firebase/config.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { uploadFile } from '../firebase/storage.js';
import { debounce, escapeHtml, sanitizeHtml, showToast, firebaseErrorMessage } from '../assets/js/utils.js';
import { exportNote } from '../services/export.js';
import { openShareModal } from './share.js';

let quill = null;
let currentNoteId = null;
let notesCache = [];
let versions = [];

const toolbarOptions = [
  [{ font: [] }, { size: [] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['image', 'link', 'video'],
  ['clean'],
  ['find', 'replace', 'emoji', 'shape', 'table', 'attachment', 'fullscreen']
];

const renderNoteList = () => {
  const list = document.getElementById('note-list');
  if (!list) return;

  list.innerHTML = notesCache.length
    ? notesCache.map((note) => `
        <div class="note-list-item ${note.id === currentNoteId ? 'active' : ''}" data-note-id="${note.id}">
          <button class="delete-note" data-id="${note.id}" aria-label="Delete note">
            <i class="fa-solid fa-trash"></i>
          </button>
          <h4>${escapeHtml(note.title || 'Untitled')}</h4>
          <p>${escapeHtml((note.content || '').replace(/<[^>]*>/g, '').slice(0, 60))}</p>
        </div>
      `).join('')
    : '<div style="padding:16px;color:var(--muted);text-align:center;">No notes yet</div>';

  list.querySelectorAll('.note-list-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-note')) return;
      openNote(item.dataset.noteId);
    });
  });

  list.querySelectorAll('.delete-note').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Delete this note permanently?')) return;
      await deleteDoc(doc(db, 'notes', id));
      if (currentNoteId === id) {
        currentNoteId = null;
        quill.setContents([]);
        document.getElementById('note-title').value = '';
        document.getElementById('note-word-count').textContent = '0 words';
        document.getElementById('note-char-count').textContent = '0 chars';
      }
      showToast('Note deleted', 'success');
    });
  });
};

const openNote = (id) => {
  const note = notesCache.find((n) => n.id === id);
  if (!note) return;
  currentNoteId = id;
  document.getElementById('note-title').value = note.title || '';
  quill.setContents(note.delta || { ops: [] });
  renderNoteList();
  updateCounts();
};

const updateCounts = () => {
  const text = quill.getText().trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = quill.getLength() - 1;
  document.getElementById('note-word-count').textContent = `${words} words`;
  document.getElementById('note-char-count').textContent = `${chars} chars`;
};

let isSaving = false;

const saveNoteNow = async () => {
  if (isSaving) return;
  isSaving = true;
  const statusEl = document.getElementById('autosave-status');
  try {
    const title = document.getElementById('note-title').value.trim() || 'Untitled';
    const html = quill.root.innerHTML;
    const delta = JSON.parse(JSON.stringify(quill.getContents()));

    if (currentNoteId) {
      const ref = doc(db, 'notes', currentNoteId);
      const existing = notesCache.find((n) => n.id === currentNoteId);
      if (existing) {
        versions.unshift({
          html: existing.content || '',
          delta: existing.delta || { ops: [] },
          timestamp: existing.updatedAt?.toDate?.() || new Date()
        });
        versions = versions.slice(0, 20);
      }
      await updateDoc(ref, {
        title,
        content: sanitizeHtml(html),
        delta,
        versions,
        updatedAt: serverTimestamp()
      });
    } else {
      const ref = doc(collection(db, 'notes'));
      currentNoteId = ref.id;
      await setDoc(ref, {
        id: ref.id,
        uid: auth.currentUser.uid,
        title,
        content: sanitizeHtml(html),
        delta,
        versions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    if (statusEl) statusEl.textContent = 'Autosave on';
  } catch (err) {
    console.error('Failed to save note', err);
    showToast(`Could not save the note: ${firebaseErrorMessage(err)}`, 'error');
  } finally {
    isSaving = false;
  }
};

// Autosave (typing) stays debounced so it doesn't hammer Firestore on every
// keystroke. The visible "Save" button, defined further down, calls
// saveNoteNow() directly so it always saves immediately instead of waiting
// for the debounce timer (which previously made the button look broken).
const saveNote = debounce(saveNoteNow, 1500);

const handleImageUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file, 'notes');
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', url);
      saveNote();
    } catch (err) {
      showToast('Image upload failed', 'error');
    }
  };
  input.click();
};

const handleAttachment = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of input.files) {
      try {
        const { url, name } = await uploadFile(file, 'attachments');
        const range = quill.getSelection(true);
        quill.insertText(range.index, ` 📎 ${name} `, 'link', url);
      } catch {
        showToast('Attachment upload failed', 'error');
      }
    }
  };
  input.click();
};

const insertShape = () => {
  const type = prompt('Enter shape: circle, square, line, arrow');
  const color = prompt('Enter color (hex or name)', '#06B6D4') || '#06B6D4';
  let svg = '';
  switch (type?.toLowerCase()) {
    case 'circle':
      svg = `<svg width="80" height="80"><circle cx="40" cy="40" r="30" fill="${color}"/></svg>`;
      break;
    case 'square':
      svg = `<svg width="80" height="80"><rect width="60" height="60" fill="${color}"/></svg>`;
      break;
    case 'line':
      svg = `<svg width="120" height="20"><line x1="0" y1="10" x2="120" y2="10" stroke="${color}" stroke-width="4"/></svg>`;
      break;
    case 'arrow':
      svg = `<svg width="120" height="30"><line x1="0" y1="15" x2="100" y2="15" stroke="${color}" stroke-width="4"/><polygon points="110,15 90,5 90,25" fill="${color}"/></svg>`;
      break;
    default:
      svg = `<svg width="80" height="80"><rect width="70" height="70" rx="16" fill="${color}"/></svg>`;
  }
  quill.clipboard.dangerouslyPasteHTML(svg);
};

const insertTable = () => {
  const rows = parseInt(prompt('Rows:', '3'), 10);
  const cols = parseInt(prompt('Columns:', '3'), 10);
  if (!rows || !cols) return;
  let html = '<table border="1" cellpadding="10" style="border-collapse:collapse;width:100%;"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  quill.clipboard.dangerouslyPasteHTML(html);
};

const findReplace = () => {
  const find = prompt('Find:');
  if (!find) return;
  const replace = prompt('Replace with:') || '';
  const text = quill.getText();
  const newText = text.split(find).join(replace);
  quill.setText(newText);
  updateCounts();
};

export const initNotes = () => {
  const root = document.getElementById('view-notes');

  root.innerHTML = `
    <div class="notes-layout">
      <div class="note-list-panel glass">
        <div class="panel-header">
          <h2>📝 Notes</h2>
          <button class="btn btn-primary" id="new-note-btn" style="padding:8px 12px;font-size:0.8rem;">
            <i class="fa-solid fa-plus"></i> New
          </button>
        </div>
        <div class="note-list" id="note-list"></div>
      </div>

      <div class="editor-panel glass">
        <div class="editor-toolbar-actions">
          <input type="text" id="note-title" placeholder="Note title..." style="max-width:220px;">
          <button class="btn btn-success" id="save-note-btn"><i class="fa-solid fa-floppy-disk"></i> Save</button>
          <button class="btn btn-ghost" id="export-note-btn"><i class="fa-solid fa-file-export"></i> Export</button>
          <button class="btn btn-ghost" id="share-note-btn"><i class="fa-solid fa-share-nodes"></i> Share</button>
          <button class="btn btn-ghost" id="versions-note-btn"><i class="fa-solid fa-clock-rotate-left"></i> Versions</button>
          <button class="btn btn-ghost" id="print-note-btn"><i class="fa-solid fa-print"></i> Print</button>
        </div>
        <div id="quill-toolbar"></div>
        <div id="editor-container"></div>
        <div class="editor-meta">
          <span id="note-word-count">0 words</span>
          <span id="note-char-count">0 chars</span>
          <span id="autosave-status">Autosave on</span>
        </div>
      </div>
    </div>
  `;

  quill = new Quill('#editor-container', {
    theme: 'snow',
    modules: {
      toolbar: {
        container: toolbarOptions,
        handlers: {
          image: handleImageUpload,
          attachment: handleAttachment,
          shape: insertShape,
          table: insertTable,
          find: findReplace,
          replace: findReplace,
          fullscreen: () => document.querySelector('.editor-panel').classList.toggle('editor-fullscreen'),
          emoji: () => toggleEmojiPicker()
        }
      }
    },
    placeholder: 'Start writing...'
  });

  // Sorted client-side (see comment in Kanban.js) instead of orderBy() in
  // the query, so a missing Firestore composite index can't silently break
  // the notes list.
  const notesQuery = query(collection(db, 'notes'), where('uid', '==', auth.currentUser.uid));

  onSnapshot(notesQuery, (snap) => {
    notesCache = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
    renderNoteList();
  }, (err) => {
    console.error('Failed to load notes', err);
    showToast(`Could not load your notes: ${firebaseErrorMessage(err)}`, 'error');
  });

  document.getElementById('new-note-btn').addEventListener('click', () => {
    currentNoteId = null;
    document.getElementById('note-title').value = '';
    quill.setContents([]);
    versions = [];
    renderNoteList();
    quill.focus();
  });

  document.getElementById('save-note-btn').addEventListener('click', async () => {
    await saveNoteNow();
    showToast('Note saved', 'success');
  });
  document.getElementById('export-note-btn').addEventListener('click', () => {
    if (!currentNoteId) {
      showToast('Save the note before exporting.', 'info');
      return;
    }
    exportNote(currentNoteId, 'pdf');
  });
  document.getElementById('share-note-btn').addEventListener('click', () => {
    if (!currentNoteId) {
      showToast('Save the note before sharing.', 'info');
      return;
    }
    openShareModal({ type: 'note', id: currentNoteId });
  });
  document.getElementById('print-note-btn').addEventListener('click', () => window.print());
  document.getElementById('versions-note-btn').addEventListener('click', () => {
    openVersionsModal();
  });

  quill.on('text-change', debounce(() => {
    updateCounts();
    saveNote();
  }, 1200));

  document.getElementById('note-title').addEventListener('input', debounce(saveNote, 1200));
};

const closeNotesModal = () => {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => overlay.remove(), 250);
};

const openVersionsModal = () => {
  const root = document.getElementById('modal-root');
  const listHtml = versions.length
    ? versions.map((v, i) => `
        <div class="small-list-item" data-version="${i}" style="cursor:pointer;">
          <span>Version ${versions.length - i}</span>
          <span class="date">${v.timestamp instanceof Date ? v.timestamp.toLocaleString() : (v.timestamp?.toDate?.().toLocaleString() || 'Unknown')}</span>
        </div>
      `).join('')
    : '<div class="small-list-item"><span>No versions saved yet</span></div>';

  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>Version History</h3>
          <button class="modal-close" data-close-modal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="small-list" style="max-height:340px;overflow-y:auto;">${listHtml}</div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('.modal-overlay');
  requestAnimationFrame(() => overlay.classList.add('show'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNotesModal();
  });
  root.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeNotesModal));

  root.querySelectorAll('[data-version]').forEach((item) => {
    item.addEventListener('click', () => {
      const v = versions[Number(item.dataset.version)];
      if (!v) return;
      if (!confirm('Restore this version? Your current unsaved changes will be replaced.')) return;
      quill.setContents(v.delta || { ops: [] });
      updateCounts();
      saveNoteNow();
      closeNotesModal();
      showToast('Version restored', 'success');
    });
  });
};

const toggleEmojiPicker = () => {
  const existing = document.querySelector('.emoji-picker');
  if (existing) {
    existing.remove();
    return;
  }
  const picker = document.createElement('emoji-picker');
  picker.className = 'emoji-picker';
  const editorPanel = document.querySelector('.editor-panel');
  editorPanel.style.position = 'relative';
  editorPanel.appendChild(picker);
  picker.addEventListener('emoji-click', (e) => {
    const range = quill.getSelection(true);
    quill.insertText(range.index, e.detail.unicode);
    picker.remove();
  });
};