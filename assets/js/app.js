import { auth } from '../../firebase/config.js';
import { onAuthStateChanged } from '../../firebase/auth.js';
import { initNavbar } from '../../components/navbar.js';
import { initSidebar } from '../../components/sidebar.js';
import { initDashboard } from '../../components/dashboard.js';
import { initNotes } from '../../components/notes.js';
import { initKanban } from '../../components/Kanban.js';
import { initExport, openExportModal } from '../../components/export.js';
import { initShare, openShareModal } from '../../components/share.js';
import { initNotifications } from '../../components/notifications.js';
import { showToast } from './utils.js';

const views = ['dashboard', 'notes', 'kanban'];

const showView = (view) => {
  if (!views.includes(view)) view = 'dashboard';
  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  initNavbar(user);
  initSidebar();
  initDashboard();
  initNotes();
  initKanban();
  initExport();
  initShare();
  initNotifications(user);

  window.addEventListener('navigate', (e) => showView(e.detail));
  window.addEventListener('open-export', () => openExportModal());
  window.addEventListener('share-request', (e) => openShareModal(e.detail));

  showView('dashboard');
  showToast(`Welcome back, ${user.displayName?.split(' ')[0] || 'there'} 👋`, 'success');
});