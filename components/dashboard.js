import { auth } from '../firebase/config.js';
import { collection, query, where, onSnapshot } from '../firebase/firestore.js';
import { db } from '../firebase/config.js';
import { formatDate, escapeHtml, showToast, firebaseErrorMessage } from '../assets/js/utils.js';

let activityChart = null;
let latestNotes = [];
let latestTasks = [];

const renderStats = () => {
  const notes = latestNotes;
  const tasks = latestTasks;
  const totalTasks = tasks.length;

  const upcoming = tasks
    .filter((t) => t.reminderDate?.toDate && t.reminderDate.toDate() > new Date())
    .sort((a, b) => a.reminderDate.toDate() - b.reminderDate.toDate())
    .slice(0, 4);

  document.getElementById('stat-tasks').textContent = totalTasks;
  document.getElementById('stat-notes').textContent = notes.length;

  const reminderList = document.getElementById('upcoming-reminders');
  reminderList.innerHTML = upcoming.length
    ? upcoming.map((t) => `
        <li class="small-list-item">
          <span>⏰ ${escapeHtml(t.title)}</span>
          <span class="date">${formatDate(t.reminderDate)}</span>
        </li>
      `).join('')
    : '<li class="small-list-item"><span>No upcoming reminders</span></li>';

  const recentNotes = [...notes]
    .sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0))
    .slice(0, 5);

  document.getElementById('recent-notes').innerHTML = recentNotes.length
    ? recentNotes.map((n) => `
        <li class="small-list-item">
          <span>📝 ${escapeHtml(n.title)}</span>
          <span class="date">${formatDate(n.updatedAt)}</span>
        </li>
      `).join('')
    : '<li class="small-list-item"><span>No notes yet</span></li>';

  const recentTasks = [...tasks]
    .sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0))
    .slice(0, 5);

  document.getElementById('recent-tasks').innerHTML = recentTasks.length
    ? recentTasks.map((t) => `
        <li class="small-list-item">
          <span>✅ ${escapeHtml(t.title)}</span>
          <span class="date">${formatDate(t.updatedAt)}</span>
        </li>
      `).join('')
    : '<li class="small-list-item"><span>No tasks yet</span></li>';
};

const renderActivityChart = () => {
  const ctx = document.getElementById('activity-chart');
  if (!ctx) return;

  // Activity is derived from real note/task creates & updates rather than
  // the 'notifications' collection (which only ever contains reminders) —
  // that's why the chart previously always sat flat at zero.
  const events = [
    ...latestNotes.flatMap((n) => [n.createdAt, n.updatedAt]),
    ...latestTasks.flatMap((t) => [t.createdAt, t.updatedAt])
  ].filter(Boolean);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const data = last7.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return events.filter((ts) => {
      const t = ts?.toDate?.();
      return t && t >= day && t < next;
    }).length;
  });

  const labels = last7.map((d) => d.toLocaleDateString('en-US', { weekday: 'short' }));

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Activities',
        data,
        borderColor: '#06B6D4',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#4F46E5'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
      }
    }
  });
};

export const initDashboard = () => {
  const user = auth.currentUser;
  const root = document.getElementById('view-dashboard');
  const firstName = (user.displayName || user.email || 'user').split(' ')[0];

  root.innerHTML = `
    <h1 class="dash-greeting">👋 Welcome, ${escapeHtml(firstName)}</h1>
    <p class="dash-subtitle">Here's what's happening in your workspace today.</p>

    <div class="stats-grid">
      <div class="stat-card glass">
        <div class="stat-icon purple"><i class="fa-solid fa-list-check"></i></div>
        <div class="stat-info"><h3 id="stat-tasks">0</h3><p>Tasks</p></div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon green"><i class="fa-solid fa-note-sticky"></i></div>
        <div class="stat-info"><h3 id="stat-notes">0</h3><p>Notes</p></div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="panel glass">
        <h2>Activity</h2>
        <div class="chart-wrapper"><canvas id="activity-chart"></canvas></div>
      </div>
      <div class="panel glass">
        <h2>Upcoming Reminders</h2>
        <ul class="small-list" id="upcoming-reminders"></ul>
      </div>
    </div>

    <div class="dash-grid">
      <div class="panel glass">
        <h2>Recent Notes</h2>
        <ul class="small-list" id="recent-notes"></ul>
      </div>
      <div class="panel glass">
        <h2>Recent Tasks</h2>
        <ul class="small-list" id="recent-tasks"></ul>
      </div>
    </div>
  `;

  const uid = user.uid;

  // Sorting is done client-side below rather than via orderBy() in the
  // query — where()+orderBy() on different fields needs a Firestore
  // composite index, and without one onSnapshot fails silently, which is
  // why these panels (and "Upcoming Reminders") could end up stuck empty.
  const notesQuery = query(collection(db, 'notes'), where('uid', '==', uid));
  const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', uid));

  onSnapshot(notesQuery, (snap) => {
    latestNotes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
    renderStats();
    renderActivityChart();
  }, (err) => {
    console.error('Failed to load notes', err);
    showToast(`Could not load notes: ${firebaseErrorMessage(err)}`, 'error');
  });

  onSnapshot(tasksQuery, (snap) => {
    latestTasks = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
    renderStats();
    renderActivityChart();
  }, (err) => {
    console.error('Failed to load tasks', err);
    showToast(`Could not load tasks: ${firebaseErrorMessage(err)}`, 'error');
  });
};