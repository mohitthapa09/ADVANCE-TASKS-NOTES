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
  serverTimestamp,
  getDocs
} from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { escapeHtml, showToast, uid, firebaseErrorMessage } from '../assets/js/utils.js';
import { scheduleTaskReminder } from './notifications.js';
import { openShareModal } from './share.js';

let columns = [];
let tasks = [];
let editingTaskId = null;
let editingColumnId = null;

const DEFAULT_COLUMNS = [
  { name: 'To Do', emoji: '📋', color: '#94A3B8', order: 0 },
  { name: 'In Progress', emoji: '🚧', color: '#06B6D4', order: 1 },
  { name: 'Done', emoji: '✅', color: '#22C55E', order: 2 }
];

const sortByOrder = (arr) => [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));

const seedDefaultColumns = async () => {
  const uidVal = auth.currentUser.uid;
  for (const col of DEFAULT_COLUMNS) {
    const ref = doc(collection(db, 'kanban_columns'));
    await setDoc(ref, {
      id: ref.id,
      uid: uidVal,
      ...col,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

const loadBoardData = () => {
  const uidVal = auth.currentUser.uid;
  let seeded = false;

  // Note: sorting is done client-side (sortByOrder) rather than with an
  // orderBy() clause here. where()+orderBy() on different fields needs a
  // Firestore composite index; if that index hasn't been created in the
  // Firebase console, onSnapshot fails silently and the board never
  // updates — which looked like "adding a column/task does nothing, the
  // dialog just closes." Sorting client-side avoids that dependency.
  const colsQuery = query(collection(db, 'kanban_columns'), where('uid', '==', uidVal));
  onSnapshot(colsQuery, (snap) => {
    columns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!columns.length && !seeded) {
      seeded = true;
      seedDefaultColumns();
    }
    renderBoard();
  }, (err) => {
    console.error('Failed to load columns', err);
    showToast(`Could not load your columns: ${firebaseErrorMessage(err)}`, 'error');
  });

  const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', uidVal));
  onSnapshot(tasksQuery, (snap) => {
    tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderBoard();
  }, (err) => {
    console.error('Failed to load tasks', err);
    showToast(`Could not load your tasks: ${firebaseErrorMessage(err)}`, 'error');
  });
};

const renderBoard = () => {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  const orderedCols = sortByOrder(columns);

  board.innerHTML = orderedCols.map((col) => {
    const colTasks = sortByOrder(tasks.filter((t) => t.columnId === col.id));
    return `
      <div class="kanban-column glass" data-column-id="${col.id}">
        <div class="column-header">
          <span class="column-handle"><i class="fa-solid fa-grip-vertical"></i></span>
          <span class="column-title" style="color:${col.color || '#fff'}">${escapeHtml(col.emoji || '')} ${escapeHtml(col.name)}</span>
          <span class="column-count">${colTasks.length}</span>
          <div class="column-actions">
            <button class="edit-column-btn" data-id="${col.id}" aria-label="Edit column"><i class="fa-solid fa-pen"></i></button>
            <button class="delete-column-btn" data-id="${col.id}" aria-label="Delete column"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="tasks-container" data-column-id="${col.id}">
          ${colTasks.map((t) => renderTaskCard(t)).join('') || '<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:12px;">No tasks</div>'}
        </div>
        <button class="btn btn-ghost add-task-btn" data-column-id="${col.id}" style="margin-top:10px;width:100%;padding:10px;">
          <i class="fa-solid fa-plus"></i> Add Task
        </button>
      </div>
    `;
  }).join('') + `
    <button class="add-column-btn" id="add-column-btn">
      <i class="fa-solid fa-plus"></i> Add Column
    </button>
  `;

  // Bind column actions
  board.querySelectorAll('.edit-column-btn').forEach((btn) => {
    btn.addEventListener('click', () => openColumnModal(btn.dataset.id));
  });
  board.querySelectorAll('.delete-column-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteColumn(btn.dataset.id));
  });
  board.querySelectorAll('.add-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.columnId));
  });

  // Task actions
  board.querySelectorAll('.edit-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.id));
  });
  board.querySelectorAll('.delete-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
  board.querySelectorAll('.complete-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleTaskComplete(btn.dataset.id));
  });
  board.querySelectorAll('.duplicate-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => duplicateTask(btn.dataset.id));
  });
  board.querySelectorAll('.task-share-btn').forEach((btn) => {
    btn.addEventListener('click', () => openShareModal({ type: 'task', id: btn.dataset.id }));
  });

  document.getElementById('add-column-btn').addEventListener('click', () => openColumnModal());

  // Sortable setup
  if (window.Sortable) {
    const boardEl = document.getElementById('kanban-board');
    Sortable.create(boardEl, {
      animation: 200,
      handle: '.column-handle',
      ghostClass: 'dragging',
      draggable: '.kanban-column',
      onEnd: (evt) => {
        const colId = evt.item.dataset.columnId;
        const newOrder = [...boardEl.querySelectorAll('.kanban-column')].map((el, index) => ({
          id: el.dataset.columnId,
          order: index
        }));
        const newPos = newOrder.find((item) => item.id === colId);
        if (newPos) updateColumnDoc(colId, { order: newPos.order });
      }
    });

    boardEl.querySelectorAll('.tasks-container').forEach((container) => {
      Sortable.create(container, {
        animation: 200,
        group: 'tasks',
        ghostClass: 'dragging',
        onEnd: async (evt) => {
          const taskId = evt.item.dataset.taskId;
          const targetColumnId = evt.to.dataset.columnId;
          const tasksInColumn = [...evt.to.querySelectorAll('.task-card')].map((el, index) => ({
            id: el.dataset.taskId,
            order: index
          }));

          const task = tasks.find((t) => t.id === taskId);
          if (task && task.columnId !== targetColumnId) {
            await updateDoc(doc(db, 'tasks', taskId), { columnId: targetColumnId, updatedAt: serverTimestamp() });
          }
          for (const item of tasksInColumn) {
            await updateDoc(doc(db, 'tasks', item.id), { order: item.order, updatedAt: serverTimestamp() });
          }
        }
      });
    });
  }
};

const renderTaskCard = (task) => {
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const doneItems = checklist.filter((item) => typeof item === 'object' && item.done).length;
  const progress = checklist.length ? Math.round((doneItems / checklist.length) * 100) : null;

  const priority = task.priority || 'medium';
  const priorityClass = `priority-${priority}`;

  return `
    <div class="task-card" data-task-id="${task.id}">
      <div class="task-card-header">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="priority-tag ${priorityClass}">${priority}</span>
      </div>
      ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
      ${task.labels?.length ? `
        <div class="task-labels">
          ${task.labels.map((l) => `<span class="task-label">${escapeHtml(l)}</span>`).join('')}
        </div>
      ` : ''}
      ${progress !== null ? `
        <div class="task-checklist">
          <i class="fa-solid fa-list-check"></i> ${doneItems}/${checklist.length} (${progress}%)
        </div>
      ` : ''}
      <div class="task-footer">
        <span>${task.dueDate ? `📅 ${new Date(task.dueDate.toDate()).toLocaleDateString()}` : ''}</span>
        <span>${task.assignedTo ? `👤 ${escapeHtml(task.assignedTo)}` : ''}</span>
      </div>
      <div class="task-actions">
        <button class="complete-task-btn" data-id="${task.id}" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
          <i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i>
        </button>
        <button class="edit-task-btn" data-id="${task.id}" title="Edit task"><i class="fa-solid fa-pen"></i></button>
        <button class="duplicate-task-btn" data-id="${task.id}" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
        <button class="task-share-btn" data-id="${task.id}" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
        <button class="delete-task-btn" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
};

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

const updateColumnDoc = async (colId, data) => {
  await updateDoc(doc(db, 'kanban_columns', colId), { ...data, updatedAt: serverTimestamp() });
};

const openColumnModal = (colId = null) => {
  editingColumnId = colId;
  const col = colId ? columns.find((c) => c.id === colId) : null;

  const overlay = openModal(`
    <div class="modal-header">
      <h3>${col ? 'Edit Column' : 'New Column'}</h3>
      <button class="modal-close" data-close-modal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form class="modal-form" id="column-form">
      <div>
        <label for="column-name">Column name</label>
        <input type="text" id="column-name" value="${col ? escapeHtml(col.name) : ''}" placeholder="e.g. Backlog" required>
      </div>
      <div class="form-row">
        <div>
          <label for="column-emoji">Emoji</label>
          <input type="text" id="column-emoji" value="${col ? escapeHtml(col.emoji || '') : ''}" placeholder="🗂️" maxlength="2">
        </div>
        <div>
          <label for="column-color">Color</label>
          <input type="color" id="column-color" value="${col ? col.color || '#4F46E5' : '#4F46E5'}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${col ? 'Save Changes' : 'Add Column'}</button>
      </div>
    </form>
  `);

  overlay.querySelector('#column-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('column-name').value.trim();
    const emoji = document.getElementById('column-emoji').value.trim();
    const color = document.getElementById('column-color').value;
    if (!name) return;

    try {
      if (editingColumnId) {
        await updateColumnDoc(editingColumnId, { name, emoji, color });
        showToast('Column updated', 'success');
      } else {
        const ref = doc(collection(db, 'kanban_columns'));
        await setDoc(ref, {
          id: ref.id,
          uid: auth.currentUser.uid,
          name,
          emoji,
          color,
          order: columns.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast('Column added', 'success');
      }
      closeModal();
    } catch (err) {
      console.error('Failed to save column', err);
      showToast(`Could not save the column: ${firebaseErrorMessage(err)}`, 'error');
    }
  });
};

const deleteColumn = async (colId) => {
  const colTasks = tasks.filter((t) => t.columnId === colId);
  if (colTasks.length && !confirm(`Delete this column and its ${colTasks.length} task(s)?`)) return;
  if (!colTasks.length && !confirm('Delete this column?')) return;

  for (const t of colTasks) {
    await deleteDoc(doc(db, 'tasks', t.id));
  }
  await deleteDoc(doc(db, 'kanban_columns', colId));
  showToast('Column deleted', 'success');
};

const openTaskModal = (taskId = null, columnId = null) => {
  editingTaskId = taskId;
  const task = taskId ? tasks.find((t) => t.id === taskId) : null;
  const targetColumnId = task ? task.columnId : columnId || columns[0]?.id;

  const overlay = openModal(`
    <div class="modal-header">
      <h3>${task ? 'Edit Task' : 'New Task'}</h3>
      <button class="modal-close" data-close-modal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form class="modal-form" id="task-form">
      <div>
        <label for="task-title">Title</label>
        <input type="text" id="task-title" value="${task ? escapeHtml(task.title) : ''}" placeholder="Task title" required>
      </div>
      <div>
        <label for="task-description">Description</label>
        <textarea id="task-description" rows="3" placeholder="Add more details...">${task ? escapeHtml(task.description || '') : ''}</textarea>
      </div>
      <div class="form-row">
        <div>
          <label for="task-column">Column</label>
          <select id="task-column">
            ${sortByOrder(columns).map((c) => `<option value="${c.id}" ${c.id === targetColumnId ? 'selected' : ''}>${escapeHtml(c.emoji || '')} ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="task-priority">Priority</label>
          <select id="task-priority">
            <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${!task || task?.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label for="task-due">Due date</label>
          <input type="date" id="task-due" value="${task?.dueDate ? new Date(task.dueDate.toDate()).toISOString().slice(0, 10) : ''}">
        </div>
        <div>
          <label for="task-reminder">Reminder</label>
          <input type="datetime-local" id="task-reminder" value="${task?.reminderDate ? new Date(task.reminderDate.toDate()).toISOString().slice(0, 16) : ''}">
        </div>
      </div>
      <div class="form-row">
        <div>
          <label for="task-labels">Labels (comma separated)</label>
          <input type="text" id="task-labels" value="${task?.labels ? escapeHtml(task.labels.join(', ')) : ''}" placeholder="urgent, design">
        </div>
        <div>
          <label for="task-assigned">Assigned to</label>
          <input type="text" id="task-assigned" value="${task ? escapeHtml(task.assignedTo || '') : ''}" placeholder="Name or email">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">${task ? 'Save Changes' : 'Add Task'}</button>
      </div>
    </form>
  `);

  overlay.querySelector('#task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;

    const description = document.getElementById('task-description').value.trim();
    const columnIdVal = document.getElementById('task-column').value;
    const priority = document.getElementById('task-priority').value;
    const dueDateVal = document.getElementById('task-due').value;
    const reminderVal = document.getElementById('task-reminder').value;
    const labels = document.getElementById('task-labels').value
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    const assignedTo = document.getElementById('task-assigned').value.trim();

    const payload = {
      title,
      description,
      columnId: columnIdVal,
      priority,
      labels,
      assignedTo,
      dueDate: dueDateVal ? new Date(dueDateVal) : null,
      reminderDate: reminderVal ? new Date(reminderVal) : null
    };

    try {
      if (editingTaskId) {
        await updateDoc(doc(db, 'tasks', editingTaskId), { ...payload, updatedAt: serverTimestamp() });
        showToast('Task updated', 'success');
        // A reminder set or changed while editing also needs to be (re)scheduled —
        // previously this only happened for brand-new tasks, so reminders added
        // later never actually notified anyone.
        if (payload.reminderDate) scheduleTaskReminder({ id: editingTaskId, ...payload });
      } else {
        const ref = doc(collection(db, 'tasks'));
        await setDoc(ref, {
          id: ref.id,
          uid: auth.currentUser.uid,
          ...payload,
          completed: false,
          checklist: [],
          order: tasks.filter((t) => t.columnId === columnIdVal).length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast('Task added', 'success');
        if (payload.reminderDate) scheduleTaskReminder({ id: ref.id, ...payload });
      }
      closeModal();
    } catch (err) {
      console.error('Failed to save task', err);
      showToast(`Could not save the task: ${firebaseErrorMessage(err)}`, 'error');
    }
  });
};

const deleteTask = async (taskId) => {
  if (!confirm('Delete this task?')) return;
  await deleteDoc(doc(db, 'tasks', taskId));
  showToast('Task deleted', 'success');
};

const toggleTaskComplete = async (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  await updateDoc(doc(db, 'tasks', taskId), {
    completed: !task.completed,
    updatedAt: serverTimestamp()
  });
};

const duplicateTask = async (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const ref = doc(collection(db, 'tasks'));
  await setDoc(ref, {
    ...task,
    id: ref.id,
    title: `${task.title} (copy)`,
    completed: false,
    order: tasks.filter((t) => t.columnId === task.columnId).length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  showToast('Task duplicated', 'success');
};

export const initKanban = () => {
  const root = document.getElementById('view-kanban');

  root.innerHTML = `
    <div class="board-header">
      <h1>🗂️ Kanban Board</h1>
      <button class="btn btn-primary" id="new-task-btn"><i class="fa-solid fa-plus"></i> New Task</button>
    </div>
    <div class="kanban-board" id="kanban-board"></div>
  `;

  document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal(null, columns[0]?.id));

  loadBoardData();
};
