export const initSidebar = () => {
  const root = document.getElementById('sidebar');

  root.innerHTML = `
    <button class="sidebar-item active" data-view="dashboard">
      <i class="fa-solid fa-gauge-high"></i> Dashboard
    </button>
    <button class="sidebar-item" data-view="notes">
      <i class="fa-solid fa-note-sticky"></i> Notes
    </button>
    <button class="sidebar-item" data-view="Kanban">
      <i class="fa-solid fa-list-check"></i> Kanban
    </button>
    <button class="sidebar-item" data-view="dashboard" id="sidebar-export">
      <i class="fa-solid fa-file-export"></i> Export Center
    </button>
  `;

  root.querySelectorAll('.sidebar-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (item.id === 'sidebar-export') {
        window.dispatchEvent(new CustomEvent('open-export'));
        return;
      }
      window.dispatchEvent(new CustomEvent('navigate', { detail: item.dataset.view }));
    });
  });
};