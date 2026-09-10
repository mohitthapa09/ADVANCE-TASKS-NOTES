import { auth } from '../firebase/config.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { onForegroundMessage } from '../firebase/messaging.js';
import { escapeHtml, formatDateTime, showToast, firebaseErrorMessage } from '../assets/js/utils.js';

let notificationsCache = [];
let panelOpen = false;
let reminderCheckInterval = null;
let reminderErrorShown = false;

const updateBadge = () => {
  const badge = document.querySelector('#nav-notifications .badge');
  if (!badge) return;
  const unread = notificationsCache.filter((n) => !n.read).length;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
};

const closePanel = () => {
  document.getElementById('notifications-panel')?.remove();
  panelOpen = false;
};

const renderPanel = () => {
  closePanel();
  panelOpen = true;

  const panel = document.createElement('div');
  panel.id = 'notifications-panel';
  panel.className = 'glass';
  panel.style.cssText = 'position:absolute;top:66px;right:24px;width:320px;max-height:400px;overflow-y:auto;padding:10px;z-index:200;';

  panel.innerHTML = notificationsCache.length
    ? notificationsCache.map((n) => `
        <div class="small-list-item" data-id="${n.id}" style="cursor:pointer;align-items:flex-start;flex-direction:column;gap:4px;${n.read ? 'opacity:0.6;' : ''}">
          <span>🔔 ${escapeHtml(n.title || 'Reminder')}</span>
          <span class="date">${formatDateTime(n.timestamp)}</span>
        </div>
      `).join('')
    : '<div class="small-list-item"><span>No notifications yet</span></div>';

  document.body.appendChild(panel);

  panel.querySelectorAll('[data-id]').forEach((item) => {
    item.addEventListener('click', async () => {
      await updateDoc(doc(db, 'notifications', item.dataset.id), { read: true });
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== 'nav-notifications' && !e.target.closest('#nav-notifications')) {
        closePanel();
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
};

// Note: this used to immediately create a "Reminder: ..." notification the
// moment a task was saved — i.e. it fired instantly instead of at the
// reminder's actual date/time, which is why reminders looked broken. All
// this does now is clear the "already notified" flag on the task so that,
// if a reminder is edited to a new date, checkDueReminders() (below) is
// free to notify again when the *new* date arrives.
export const scheduleTaskReminder = async (task) => {
  if (!task.reminderDate || !task.id || !auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'tasks', task.id), { reminderNotified: false });
  } catch (err) {
    console.error('Failed to schedule reminder', err);
  }
};

// Polls the user's tasks for reminders whose due time has actually arrived
// and creates a real notification (+ a native browser notification, if the
// user has granted permission) at that moment, exactly once per reminder.
const checkDueReminders = async (uid) => {
  try {
    const snap = await getDocs(query(collection(db, 'tasks'), where('uid', '==', uid)));
    const now = new Date();

    for (const taskDoc of snap.docs) {
      const task = taskDoc.data();
      const due = task.reminderDate?.toDate?.();
      if (!due || due > now || task.completed || task.reminderNotified) continue;

      await setDoc(doc(collection(db, 'notifications')), {
        uid,
        type: 'task-reminder',
        refId: taskDoc.id,
        title: `Reminder: ${task.title}`,
        read: false,
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'tasks', taskDoc.id), { reminderNotified: true });

      showToast(`⏰ Reminder: ${task.title}`, 'info');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('ATN Workspace', { body: `Reminder: ${task.title}` });
      }
    }
  } catch (err) {
    console.error('Failed to check due reminders', err);
    if (!reminderErrorShown) {
      reminderErrorShown = true;
      showToast(`Reminders aren't working: ${firebaseErrorMessage(err)}`, 'error');
    }
  }
};

export const initNotifications = (user) => {
  // Sorted client-side (see comment in tasks.js) so a missing Firestore
  // composite index can't silently break the notifications list/badge.
  const notifQuery = query(collection(db, 'notifications'), where('uid', '==', user.uid));

  onSnapshot(notifQuery, (snap) => {
    notificationsCache = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0))
      .slice(0, 20);
    updateBadge();
    if (panelOpen) renderPanel();
  }, (err) => {
    console.error('Failed to load notifications', err);
    showToast(`Notifications didn't load: ${firebaseErrorMessage(err)}`, 'error');
  });

  const bell = document.getElementById('nav-notifications');
  if (bell) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panelOpen) {
        closePanel();
      } else {
        renderPanel();
      }
    });
  }

  onForegroundMessage((payload) => {
    showToast(payload.notification?.title || 'New notification', 'info');
  });

  // Check immediately, then every minute, for reminders whose time has come.
  checkDueReminders(user.uid);
  if (reminderCheckInterval) clearInterval(reminderCheckInterval);
  reminderCheckInterval = setInterval(() => checkDueReminders(user.uid), 60000);
};
