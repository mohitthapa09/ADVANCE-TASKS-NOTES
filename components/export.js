import { auth } from '../firebase/config.js';
import { collection, query, where, getDocs } from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { downloadFile, formatDate, showToast, firebaseErrorMessage } from '../assets/js/utils.js';

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

const fetchAllData = async () => {
  const uidVal = auth.currentUser.uid;
  const [notesSnap, tasksSnap, columnsSnap] = await Promise.all([
    getDocs(query(collection(db, 'notes'), where('uid', '==', uidVal))),
    getDocs(query(collection(db, 'tasks'), where('uid', '==', uidVal))),
    getDocs(query(collection(db, 'tasks_columns'), where('uid', '==', uidVal)))
  ]);
  return {
    notes: notesSnap.docs.map((d) => d.data()),
    tasks: tasksSnap.docs.map((d) => d.data()),
    columns: columnsSnap.docs.map((d) => d.data())
  };
};

const taskDetailsText = (t, columnsById) => [
  `Title: ${t.title || 'Untitled'}`,
  `Column: ${columnsById[t.columnId]?.name || '—'}`,
  `Priority: ${t.priority || 'medium'}`,
  `Status: ${t.completed ? 'Completed' : 'Open'}`,
  `Due date: ${t.dueDate ? formatDate(t.dueDate) : '—'}`,
  `Reminder: ${t.reminderDate ? formatDate(t.reminderDate) : '—'}`,
  `Assigned to: ${t.assignedTo || '—'}`,
  `Labels: ${t.labels?.length ? t.labels.join(', ') : '—'}`,
  '',
  'Description:',
  t.description || '(none)'
].join('\n');

const exportAsJson = async () => {
  const data = await fetchAllData();
  downloadFile(JSON.stringify(data, null, 2), 'atn-workspace-export.json', 'application/json');
  showToast('Workspace exported as JSON', 'success');
};

const toCsvValue = (val = '') => `"${String(val).replace(/"/g, '""')}"`;

const exportTasksAsCsv = async () => {
  const { tasks } = await fetchAllData();
  const header = ['Title', 'Description', 'Priority', 'Completed', 'Due Date'];
  const rows = tasks.map((t) => [
    t.title || '',
    (t.description || '').replace(/\n/g, ' '),
    t.priority || '',
    t.completed ? 'Yes' : 'No',
    t.dueDate ? formatDate(t.dueDate) : ''
  ].map(toCsvValue).join(','));
  const csv = [header.map(toCsvValue).join(','), ...rows].join('\n');
  downloadFile(csv, 'atn-tasks-export.csv', 'text/csv');
  showToast('Tasks exported as CSV', 'success');
};

const exportAsPdf = async () => {
  const { notes, tasks, columns } = await fetchAllData();
  const columnsById = Object.fromEntries(columns.map((c) => [c.id, c]));

  const container = document.createElement('div');
  container.style.cssText = 'padding:24px;font-family:Arial,sans-serif;color:#111;';
  container.innerHTML = `
    <h1>ATN Workspace Export</h1>
    <h2>Notes (${notes.length})</h2>
    ${notes.map((n) => `<h3>${n.title || 'Untitled'}</h3><div>${n.content || ''}</div>`).join('') || '<p>No notes.</p>'}
    <h2>Tasks (${tasks.length})</h2>
    ${tasks.map((t) => `
      <div style="margin-bottom:14px;padding:10px;border:1px solid #ccc;">
        <h3>${t.completed ? '✅' : '⬜'} ${t.title || 'Untitled'}</h3>
        <p><strong>Column:</strong> ${columnsById[t.columnId]?.name || '—'} &nbsp; <strong>Priority:</strong> ${t.priority || 'medium'}</p>
        <p><strong>Due:</strong> ${t.dueDate ? formatDate(t.dueDate) : '—'} &nbsp; <strong>Reminder:</strong> ${t.reminderDate ? formatDate(t.reminderDate) : '—'}</p>
        <p><strong>Assigned to:</strong> ${t.assignedTo || '—'} &nbsp; <strong>Labels:</strong> ${t.labels?.length ? t.labels.join(', ') : '—'}</p>
        <p>${t.description || ''}</p>
      </div>
    `).join('') || '<p>No tasks.</p>'}
  `;

  if (window.html2pdf) {
    await window.html2pdf().from(container).set({ filename: 'atn-workspace-export.pdf' }).save();
    showToast('Workspace exported as PDF', 'success');
  } else {
    showToast('PDF library failed to load', 'error');
  }
};

const exportAsZip = async () => {
  if (!window.JSZip) {
    showToast('ZIP library failed to load', 'error');
    return;
  }
  const { notes, tasks, columns } = await fetchAllData();
  const columnsById = Object.fromEntries(columns.map((c) => [c.id, c]));
  const zip = new window.JSZip();

  // Raw data, for re-importing or backups.
  zip.file('notes.json', JSON.stringify(notes, null, 2));
  zip.file('tasks.json', JSON.stringify(tasks, null, 2));
  zip.file('columns.json', JSON.stringify(columns, null, 2));

  // A readable folder + file per note, with its full content.
  const notesFolder = zip.folder('notes');
  notes.forEach((n, i) => {
    const safeName = (n.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase() || `note-${i + 1}`;
    notesFolder.file(`${i + 1}-${safeName}.html`, `<h1>${n.title || 'Untitled'}</h1>${n.content || ''}`);
  });

  // A readable folder + file per task, with every detail (column, priority,
  // due date, reminder, assignee, labels, description) — previously the
  // "Full Backup" only bundled raw notes, tasks were left out entirely.
  const tasksFolder = zip.folder('tasks');
  tasks.forEach((t, i) => {
    const safeName = (t.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase() || `task-${i + 1}`;
    tasksFolder.file(`${i + 1}-${safeName}.txt`, taskDetailsText(t, columnsById));
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'atn-workspace-backup.zip';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Full backup downloaded', 'success');
};

export const openExportModal = () => {
  const overlay = openModal(`
    <div class="modal-header">
      <h3>Export Workspace</h3>
      <button class="modal-close" data-close-modal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="export-grid">
      <div class="export-item" id="export-pdf"><i class="fa-solid fa-file-pdf"></i><span>Export as PDF</span></div>
      <div class="export-item" id="export-json"><i class="fa-solid fa-file-code"></i><span>Export as JSON</span></div>
      <div class="export-item" id="export-csv"><i class="fa-solid fa-file-csv"></i><span>Tasks as CSV</span></div>
      <div class="export-item" id="export-zip"><i class="fa-solid fa-file-zipper"></i><span>Full Backup (ZIP)</span></div>
    </div>
  `);

  const withErrorHandling = (fn) => async () => {
    try {
      await fn();
    } catch (err) {
      console.error('Export failed', err);
      showToast(`Export failed: ${firebaseErrorMessage(err)}`, 'error');
    }
  };

  overlay.querySelector('#export-pdf').addEventListener('click', withErrorHandling(exportAsPdf));
  overlay.querySelector('#export-json').addEventListener('click', withErrorHandling(exportAsJson));
  overlay.querySelector('#export-csv').addEventListener('click', withErrorHandling(exportTasksAsCsv));
  overlay.querySelector('#export-zip').addEventListener('click', withErrorHandling(exportAsZip));
};

export const initExport = () => {
  // Modal is created on demand by openExportModal(); nothing to pre-render.
};
