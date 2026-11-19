/**
 * Orbit — Projects Workspace Page Module (Phase 3)
 */

const PALETTE = [
  '#5B5BD6', '#22C55E', '#F59E0B', '#EF4444',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'
];

let currentUser = null;
let csrfToken = null;
let allProjects = [];

// DOM Elements
const projectsGrid = document.getElementById('projects-grid');
const searchInput = document.getElementById('search-projects');
const createModal = document.getElementById('create-project-modal');
const editModal = document.getElementById('edit-project-modal');
const createForm = document.getElementById('create-project-form');
const editForm = document.getElementById('edit-project-form');
const colorSwatchesContainer = document.getElementById('color-swatches');
const editColorSwatchesContainer = document.getElementById('edit-color-swatches');
const createFeedback = document.getElementById('create-modal-feedback');
const editFeedback = document.getElementById('edit-modal-feedback');

// Metric Elements
const metricTotal = document.getElementById('metric-total-projects');
const metricActive = document.getElementById('metric-active-projects');
const metricOwned = document.getElementById('metric-owned-projects');
const metricMembers = document.getElementById('metric-total-members');

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders avatar initials from name.
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Initializes authentication and fetches projects.
 */
async function init() {
  try {
    const authRes = await fetch('/api/auth/me', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    if (authRes.status === 401) {
      window.location.href = '/login';
      return;
    }

    const authData = await authRes.json();
    if (!authData.success) {
      window.location.href = '/login';
      return;
    }

    currentUser = authData.data.user;
    csrfToken = authData.data.csrfToken;

    // Render user profile pill
    const userAvatarEl = document.getElementById('user-avatar');
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');

    if (userAvatarEl) {
      userAvatarEl.textContent = getInitials(currentUser.name);
      userAvatarEl.style.backgroundColor = currentUser.avatarColor || '#5B5BD6';
    }
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userEmailEl) userEmailEl.textContent = currentUser.email;

    setupColorSwatches();
    setupEventListeners();
    await loadProjects();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

/**
 * Sets up color picker swatches in create and edit modals.
 */
function setupColorSwatches() {
  if (colorSwatchesContainer) {
    colorSwatchesContainer.innerHTML = PALETTE.map((c, i) => `
      <div
        class="color-swatch-radio ${i === 0 ? 'selected' : ''}"
        style="background-color: ${c};"
        data-color="${c}"
      ></div>
    `).join('');

    colorSwatchesContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.color-swatch-radio');
      if (!target) return;
      colorSwatchesContainer.querySelectorAll('.color-swatch-radio').forEach((el) => el.classList.remove('selected'));
      target.classList.add('selected');
      document.getElementById('selected-color-input').value = target.dataset.color;
    });
  }

  if (editColorSwatchesContainer) {
    editColorSwatchesContainer.innerHTML = PALETTE.map((c) => `
      <div
        class="color-swatch-radio"
        style="background-color: ${c};"
        data-color="${c}"
      ></div>
    `).join('');

    editColorSwatchesContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.color-swatch-radio');
      if (!target) return;
      editColorSwatchesContainer.querySelectorAll('.color-swatch-radio').forEach((el) => el.classList.remove('selected'));
      target.classList.add('selected');
      document.getElementById('edit-selected-color-input').value = target.dataset.color;
    });
  }
}

/**
 * Loads projects list from API.
 */
async function loadProjects() {
  try {
    const res = await fetch('/api/projects', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      projectsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load projects</h3>
          <p>${escapeHtml(body.error?.message || 'Unknown error')}</p>
        </div>
      `;
      return;
    }

    allProjects = body.data.projects || [];
    updateMetrics(allProjects);
    renderProjects(allProjects);
    renderSidebarProjects(allProjects);
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    projectsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Network Error</h3>
        <p>Could not connect to Orbit services. Please try refreshing.</p>
      </div>
    `;
  }
}

/**
 * Updates top metrics based on project dataset.
 */
function updateMetrics(projects) {
  if (metricTotal) metricTotal.textContent = projects.length;
  if (metricActive) metricActive.textContent = projects.filter((p) => !p.isArchived).length;
  if (metricOwned) metricOwned.textContent = projects.filter((p) => p.userRole === 'owner').length;

  const totalMembers = projects.reduce((acc, p) => acc + (p.memberCount || 1), 0);
  if (metricMembers) metricMembers.textContent = totalMembers;
}

/**
 * Renders quick navigation links in sidebar.
 */
function renderSidebarProjects(projects) {
  const sidebarList = document.getElementById('sidebar-projects-list');
  if (!sidebarList) return;

  if (projects.length === 0) {
    sidebarList.innerHTML = `<span style="font-size: 0.75rem; color: var(--theme-text-muted, #94A3B8); padding-left: 0.75rem;">No projects yet</span>`;
    return;
  }

  sidebarList.innerHTML = projects.slice(0, 6).map((p) => `
    <a href="/projects/${p.id}/members" class="nav-link" style="font-size: 0.825rem; padding: 0.45rem 0.75rem;" title="${escapeHtml(p.name)}">
      <span style="width: 8px; height: 8px; border-radius: 2px; background: ${p.color || '#6366F1'};"></span>
      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</span>
    </a>
  `).join('');
}

/**
 * Renders the project cards into the grid.
 */
function renderProjects(projects) {
  if (!projectsGrid) return;

  if (projects.length === 0) {
    projectsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🪐</div>
        <h3>No projects found</h3>
        <p>Get started by creating your first collaborative workspace project.</p>
        <button id="btn-empty-create" class="btn-primary" type="button" style="margin-top: 0.5rem;">
          + Create Project
        </button>
      </div>
    `;
    const emptyBtn = document.getElementById('btn-empty-create');
    if (emptyBtn) emptyBtn.addEventListener('click', openCreateModal);
    return;
  }

  projectsGrid.innerHTML = projects.map((p) => {
    const isOwner = p.userRole === 'owner';
    const isAdminOrOwner = p.userRole === 'owner' || p.userRole === 'admin';
    const progress = p.progressPercentage || 0;

    return `
      <div class="project-card" data-project-id="${p.id}">
        <div class="project-color-bar" style="background-color: ${p.color || '#5B5BD6'};"></div>

        <div class="project-card-header">
          <div class="project-title-wrap">
            <div class="project-badge-dot" style="background-color: ${p.color || '#5B5BD6'};"></div>
            <a href="/projects/${p.id}/board" class="project-title">${escapeHtml(p.name)}</a>
          </div>
          <span class="role-badge ${p.userRole || 'member'}">${escapeHtml(p.userRole || 'member')}</span>
        </div>

        <div class="project-desc">
          ${p.description ? escapeHtml(p.description) : '<span style="opacity: 0.4; font-style: italic;">No description provided.</span>'}
        </div>

        <div class="progress-section">
          <div class="progress-label-row">
            <span>Progress (${p.completedTaskCount || 0}/${p.taskCount || 0} tasks)</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%;"></div>
          </div>
        </div>

        <div class="project-card-footer">
          <div class="member-stack" title="${p.memberCount || 1} team member(s)">
            <div class="member-avatar-mini" style="background-color: ${p.owner?.avatarColor || '#5B5BD6'};">
              ${getInitials(p.owner?.name)}
            </div>
            ${p.memberCount > 1 ? `
              <div class="member-avatar-mini" style="background-color: #374151; font-size: 0.65rem;">
                +${p.memberCount - 1}
              </div>
            ` : ''}
          </div>

          <div class="card-actions">
            <a href="/projects/${p.id}/board" class="btn-card-action btn-card-action-board" title="Open Kanban Board">
              <span>📋</span> Board
            </a>
            <a href="/projects/${p.id}/members" class="btn-card-action" title="Manage Team Members">
              <span>👥</span> Members
            </a>
            ${isAdminOrOwner ? `
              <button class="btn-card-action btn-edit-project" data-id="${p.id}" title="Edit Project Settings">
                <span>✏️</span>
              </button>
            ` : ''}
            ${isOwner ? `
              <button class="btn-card-action danger btn-delete-project" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete Project">
                <span>🗑️</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  projectsGrid.querySelectorAll('.btn-edit-project').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const projectId = e.currentTarget.dataset.id;
      const proj = allProjects.find((x) => x.id === projectId);
      if (proj) openEditModal(proj);
    });
  });

  projectsGrid.querySelectorAll('.btn-delete-project').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const { id, name } = e.currentTarget.dataset;
      confirmDeleteProject(id, name);
    });
  });
}

/**
 * Filter projects when user types in search.
 */
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderProjects(allProjects);
    return;
  }
  const filtered = allProjects.filter((p) =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.description && p.description.toLowerCase().includes(query))
  );
  renderProjects(filtered);
}

/**
 * Modal handlers
 */
function openCreateModal() {
  createFeedback.className = 'feedback-banner';
  createFeedback.style.display = 'none';
  createForm.reset();
  document.getElementById('selected-color-input').value = PALETTE[0];
  setupColorSwatches();
  createModal.classList.add('open');
  document.getElementById('project-name-input').focus();
}

function closeCreateModal() {
  createModal.classList.remove('open');
}

function openEditModal(project) {
  editFeedback.className = 'feedback-banner';
  editFeedback.style.display = 'none';
  document.getElementById('edit-project-id').value = project.id;
  document.getElementById('edit-name-input').value = project.name;
  document.getElementById('edit-desc-input').value = project.description || '';
  document.getElementById('edit-selected-color-input').value = project.color || PALETTE[0];
  document.getElementById('edit-archived-input').checked = Boolean(project.isArchived);

  // Update selected swatch
  if (editColorSwatchesContainer) {
    editColorSwatchesContainer.querySelectorAll('.color-swatch-radio').forEach((swatch) => {
      if (swatch.dataset.color.toLowerCase() === (project.color || '').toLowerCase()) {
        swatch.classList.add('selected');
      } else {
        swatch.classList.remove('selected');
      }
    });
  }

  editModal.classList.add('open');
  document.getElementById('edit-name-input').focus();
}

function closeEditModal() {
  editModal.classList.remove('open');
}

/**
 * Handles project creation form submit.
 */
async function handleCreateSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('project-name-input').value.trim();
  const description = document.getElementById('project-desc-input').value.trim();
  const color = document.getElementById('selected-color-input').value;

  if (!name) return;

  const submitBtn = document.getElementById('btn-submit-create');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description, color }),
    });

    const data = await res.json();
    if (!data.success) {
      createFeedback.className = 'feedback-banner error';
      createFeedback.textContent = data.error?.message || 'Failed to create project.';
      return;
    }

    closeCreateModal();
    await loadProjects();
  } catch (err) {
    createFeedback.className = 'feedback-banner error';
    createFeedback.textContent = 'Network error while creating project.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Project';
  }
}

/**
 * Handles project edit form submit.
 */
async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-project-id').value;
  const name = document.getElementById('edit-name-input').value.trim();
  const description = document.getElementById('edit-desc-input').value.trim();
  const color = document.getElementById('edit-selected-color-input').value;
  const is_archived = document.getElementById('edit-archived-input').checked;

  const submitBtn = document.getElementById('btn-submit-edit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description, color, is_archived }),
    });

    const data = await res.json();
    if (!data.success) {
      editFeedback.className = 'feedback-banner error';
      editFeedback.textContent = data.error?.message || 'Failed to update project.';
      return;
    }

    closeEditModal();
    await loadProjects();
  } catch (err) {
    editFeedback.className = 'feedback-banner error';
    editFeedback.textContent = 'Network error while updating project.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

/**
 * Prompts user and deletes a project.
 */
async function confirmDeleteProject(id, name) {
  const confirmed = window.confirm(`Are you sure you want to delete "${name}"?\nThis will permanently delete all tasks, members, and comments in this project.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
    });

    const data = await res.json();
    if (!data.success) {
      alert(`Error deleting project: ${data.error?.message || 'Unknown error'}`);
      return;
    }

    await loadProjects();
  } catch (err) {
    alert('Network error while deleting project.');
  }
}

/**
 * Sets up listeners.
 */
function setupEventListeners() {
  if (searchInput) searchInput.addEventListener('input', handleSearch);

  const openCreateBtn = document.getElementById('btn-open-create-modal');
  if (openCreateBtn) openCreateBtn.addEventListener('click', openCreateModal);

  const closeCreateBtn = document.getElementById('btn-close-create-modal');
  if (closeCreateBtn) closeCreateBtn.addEventListener('click', closeCreateModal);

  const cancelCreateBtn = document.getElementById('btn-cancel-create');
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeCreateModal);

  const closeEditBtn = document.getElementById('btn-close-edit-modal');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);

  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

  if (createForm) createForm.addEventListener('submit', handleCreateSubmit);
  if (editForm) editForm.addEventListener('submit', handleEditSubmit);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'same-origin',
        });
        window.location.href = '/login';
      } catch (err) {
        window.location.href = '/login';
      }
    });
  }
}

// Start initialization on DOM load
document.addEventListener('DOMContentLoaded', init);
