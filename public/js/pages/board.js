/**
 * Orbit — Kanban Board Page Module (Phase 4)
 */

let currentUser = null;
let csrfToken = null;
let currentProject = null;
let projectMembers = [];
let projectId = null;
let tasksData = {
  todo: [],
  in_progress: [],
  review: [],
  done: [],
};
let activeTaskDetail = null;

// DOM Elements
const breadcrumbProjectName = document.getElementById('breadcrumb-project-name');
const boardProjectTitle = document.getElementById('board-project-title');
const projectColorBadge = document.getElementById('project-color-badge');
const btnProjectMembers = document.getElementById('btn-project-members');
const searchInput = document.getElementById('board-search-input');
const priorityFilter = document.getElementById('board-priority-filter');

// Modals
const createTaskModal = document.getElementById('create-task-modal');
const editTaskModal = document.getElementById('edit-task-modal');
const taskDetailModal = document.getElementById('task-detail-modal');

const createTaskForm = document.getElementById('create-task-form');
const editTaskForm = document.getElementById('edit-task-form');
const createTaskFeedback = document.getElementById('create-task-feedback');
const editTaskFeedback = document.getElementById('edit-task-feedback');

const createAssigneeChecklist = document.getElementById('create-assignee-checklist');
const editAssigneeChecklist = document.getElementById('edit-assignee-checklist');

// Column containers
const columns = {
  todo: document.getElementById('cards-todo'),
  in_progress: document.getElementById('cards-in_progress'),
  review: document.getElementById('cards-review'),
  done: document.getElementById('cards-done'),
};

const countBadges = {
  todo: document.getElementById('count-todo'),
  in_progress: document.getElementById('count-in_progress'),
  review: document.getElementById('count-review'),
  done: document.getElementById('count-done'),
};

/**
 * Escapes HTML characters.
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
 * Formats ISO date string to friendly format.
 */
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Extracts project ID from URL.
 */
function extractProjectId() {
  const match = window.location.pathname.match(/\/projects\/([0-9a-fA-F-]+)\/board/);
  if (match && match[1]) return match[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('projectId') || params.get('id');
}

/**
 * Initialize application state.
 */
async function init() {
  projectId = extractProjectId();
  if (!projectId) {
    alert('No project ID specified.');
    window.location.href = '/projects';
    return;
  }

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

    // Render user pill in sidebar
    const userAvatarEl = document.getElementById('user-avatar');
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');

    if (userAvatarEl) {
      userAvatarEl.textContent = getInitials(currentUser.name);
      userAvatarEl.style.backgroundColor = currentUser.avatarColor || '#5B5BD6';
    }
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userEmailEl) userEmailEl.textContent = currentUser.email;

    setupEventListeners();
    await loadProjectData();
    await loadTasks();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

/**
 * Fetches project metadata and members roster.
 */
async function loadProjectData() {
  try {
    const res = await fetch(`/api/projects/${projectId}`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Could not load project: ${body.error?.message || 'Access denied'}`);
      window.location.href = '/projects';
      return;
    }

    currentProject = body.data.project;
    projectMembers = currentProject.members || [];

    if (breadcrumbProjectName) breadcrumbProjectName.textContent = currentProject.name;
    if (boardProjectTitle) boardProjectTitle.textContent = currentProject.name;
    if (projectColorBadge) projectColorBadge.style.backgroundColor = currentProject.color || '#5B5BD6';
    if (btnProjectMembers) btnProjectMembers.href = `/projects/${projectId}/members`;

    populateAssigneeChecklists();
  } catch (err) {
    console.error('Error fetching project:', err);
  }
}

/**
 * Populates project member checklist for create and edit modals.
 */
function populateAssigneeChecklists() {
  const renderChecklist = (container, prefix) => {
    if (!container) return;
    if (projectMembers.length === 0) {
      container.innerHTML = `<span style="font-size: 0.8rem; color: rgba(255,255,255,0.4);">No members in project.</span>`;
      return;
    }

    container.innerHTML = projectMembers.map((m) => `
      <label class="assignee-check-item">
        <input type="checkbox" name="${prefix}-assignees" value="${m.id}" />
        <span class="task-assignee-avatar" style="background-color: ${m.avatarColor || '#5B5BD6'};">
          ${getInitials(m.name)}
        </span>
        <span>${escapeHtml(m.name)}</span>
      </label>
    `).join('');
  };

  renderChecklist(createAssigneeChecklist, 'create');
  renderChecklist(editAssigneeChecklist, 'edit');
}

/**
 * Loads tasks for the project and groups them into columns.
 */
async function loadTasks() {
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      console.error('Failed to load tasks:', body.error);
      return;
    }

    tasksData = body.data || { todo: [], in_progress: [], review: [], done: [] };
    renderBoard();
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

/**
 * Renders all columns of the board with current tasks and filter criteria.
 */
function renderBoard() {
  const query = (searchInput?.value || '').toLowerCase().trim();
  const selectedPriority = priorityFilter?.value || '';

  const filterFn = (task) => {
    if (selectedPriority && task.priority !== selectedPriority) return false;
    if (query) {
      const titleMatch = task.title && task.title.toLowerCase().includes(query);
      const descMatch = task.description && task.description.toLowerCase().includes(query);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  };

  const statuses = ['todo', 'in_progress', 'review', 'done'];

  statuses.forEach((status) => {
    const columnContainer = columns[status];
    const badge = countBadges[status];
    const rawList = tasksData[status] || [];
    const filteredList = rawList.filter(filterFn);

    if (badge) badge.textContent = filteredList.length;
    if (!columnContainer) return;

    if (filteredList.length === 0) {
      columnContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: rgba(255,255,255,0.3); font-size: 0.825rem; font-style: italic;">
          No tasks in this column.
        </div>
      `;
      return;
    }

    columnContainer.innerHTML = filteredList.map((task) => renderTaskCard(task)).join('');
  });

  setupCardEventListeners();
}

/**
 * Generates HTML string for a single task card.
 */
function renderTaskCard(task) {
  const nextStatusMap = {
    todo: 'in_progress',
    in_progress: 'review',
    review: 'done',
    done: 'todo',
  };
  const nextStatus = nextStatusMap[task.status] || 'todo';
  const nextLabelMap = {
    todo: 'Start ➔',
    in_progress: 'Review ➔',
    review: 'Done ✔',
    done: 'Restart ↺',
  };
  const nextLabel = nextLabelMap[task.status];

  return `
    <div
      class="task-card"
      draggable="true"
      data-task-id="${task.id}"
      data-status="${task.status}"
      data-position="${task.position}"
    >
      <div class="task-card-top">
        <span class="priority-pill ${task.priority}">${escapeHtml(task.priority)}</span>
      </div>

      <div class="task-card-title btn-open-detail" data-task-id="${task.id}">
        ${escapeHtml(task.title)}
      </div>

      ${task.description ? `<div class="task-card-desc">${escapeHtml(task.description)}</div>` : ''}

      <div class="task-card-meta">
        ${task.dueDate ? `
          <div class="task-due-date ${task.isOverdue ? 'overdue' : ''}" title="${task.isOverdue ? 'Overdue task!' : 'Due date'}">
            <span>📅</span>
            <span>${formatDate(task.dueDate)}</span>
            ${task.isOverdue ? '<span>⚠️</span>' : ''}
          </div>
        ` : `<div></div>`}

        <div class="task-assignees-stack">
          ${(task.assignees || []).map((a) => `
            <div class="task-assignee-avatar" style="background-color: ${a.avatarColor || '#5B5BD6'};" title="${escapeHtml(a.name)}">
              ${getInitials(a.name)}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Quick Accessibility Action Controls -->
      <div class="task-card-actions">
        <button
          class="btn-card-micro btn-quick-move"
          data-task-id="${task.id}"
          data-target-status="${nextStatus}"
          title="Move to ${nextStatus.replace('_', ' ')}"
          type="button"
        >
          ${nextLabel}
        </button>
        <button
          class="btn-card-micro btn-card-edit"
          data-task-id="${task.id}"
          title="Edit Task"
          type="button"
        >
          ✏️
        </button>
        <button
          class="btn-card-micro danger btn-card-delete"
          data-task-id="${task.id}"
          data-title="${escapeHtml(task.title)}"
          title="Delete Task"
          type="button"
        >
          🗑️
        </button>
      </div>
    </div>
  `;
}

/**
 * Attaches drag-and-drop and action event listeners to rendered task cards.
 */
function setupCardEventListeners() {
  // Card click opens detail
  document.querySelectorAll('.btn-open-detail').forEach((el) => {
    el.addEventListener('click', (e) => {
      const taskId = e.currentTarget.dataset.taskId;
      openTaskDetail(taskId);
    });
  });

  // Edit button
  document.querySelectorAll('.btn-card-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = e.currentTarget.dataset.taskId;
      openEditTaskModal(taskId);
    });
  });

  // Delete button
  document.querySelectorAll('.btn-card-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { taskId, title } = e.currentTarget.dataset;
      confirmDeleteTask(taskId, title);
    });
  });

  // Quick Move button fallback for accessibility
  document.querySelectorAll('.btn-quick-move').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { taskId, targetStatus } = e.currentTarget.dataset;
      await moveTaskApi(taskId, targetStatus, 0);
    });
  });

  // HTML5 Drag and Drop Events on Cards
  document.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({
        taskId: card.dataset.taskId,
        sourceStatus: card.dataset.status,
      }));
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-column').forEach((col) => col.classList.remove('drag-over'));
    });
  });
}

/**
 * Sets up column drop targets for drag-and-drop.
 */
function setupColumnDragAndDrop() {
  const columnSections = document.querySelectorAll('.kanban-column');

  columnSections.forEach((column) => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', (e) => {
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
      }
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');

      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;

      try {
        const { taskId, sourceStatus } = JSON.parse(rawData);
        const targetStatus = column.dataset.status;

        // Calculate dropped position (index within column)
        const cardsList = column.querySelector('.column-cards-list');
        const cardsInCol = [...cardsList.querySelectorAll('.task-card:not(.dragging)')];
        const afterElement = getDragAfterElement(cardsList, e.clientY);
        let targetPosition = 0;

        if (afterElement == null) {
          targetPosition = cardsInCol.length;
        } else {
          targetPosition = cardsInCol.indexOf(afterElement);
          if (targetPosition < 0) targetPosition = 0;
        }

        // Only call API if column or position changed
        await moveTaskApi(taskId, targetStatus, targetPosition);
      } catch (err) {
        console.error('Error handling drop:', err);
      }
    });
  });
}

/**
 * Helper to determine card insertion position relative to cursor Y coordinate.
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Calls PATCH /api/projects/:id/tasks/:taskId/move to persist status and position.
 */
async function moveTaskApi(taskId, targetStatus, targetPosition) {
  // Store backup in case rollback is needed
  const previousData = JSON.parse(JSON.stringify(tasksData));

  // Optimistically move task in state
  let movedTask = null;
  for (const status in tasksData) {
    const idx = tasksData[status].findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      movedTask = tasksData[status].splice(idx, 1)[0];
      break;
    }
  }

  if (movedTask) {
    movedTask.status = targetStatus;
    movedTask.position = targetPosition;
    if (!tasksData[targetStatus]) tasksData[targetStatus] = [];
    tasksData[targetStatus].splice(targetPosition, 0, movedTask);
    renderBoard();
  }

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/move`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        status: targetStatus,
        position: targetPosition,
      }),
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Could not move task: ${body.error?.message || 'Error'}`);
      // Rollback
      tasksData = previousData;
      renderBoard();
      return;
    }

    // Refresh tasks to guarantee server-synced position ordering
    await loadTasks();
  } catch (err) {
    console.error('Move task network error:', err);
    tasksData = previousData;
    renderBoard();
  }
}

/**
 * Task Details Modal view.
 */
async function openTaskDetail(taskId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Could not retrieve task: ${body.error?.message || 'Error'}`);
      return;
    }

    activeTaskDetail = body.data.task;

    const titleEl = document.getElementById('detail-task-title');
    const priorityEl = document.getElementById('detail-priority-badge');
    const statusEl = document.getElementById('detail-status-badge');
    const creatorEl = document.getElementById('detail-creator-val');
    const dueEl = document.getElementById('detail-due-val');
    const assigneesEl = document.getElementById('detail-assignees-val');
    const updatedEl = document.getElementById('detail-updated-val');
    const descEl = document.getElementById('detail-desc-content');

    if (titleEl) titleEl.textContent = activeTaskDetail.title;
    if (priorityEl) {
      priorityEl.className = `priority-pill ${activeTaskDetail.priority}`;
      priorityEl.textContent = activeTaskDetail.priority.toUpperCase();
    }
    if (statusEl) {
      statusEl.textContent = activeTaskDetail.status.replace('_', ' ').toUpperCase();
    }
    if (creatorEl) {
      creatorEl.textContent = activeTaskDetail.creator?.name || 'Unknown';
    }
    if (dueEl) {
      if (activeTaskDetail.dueDate) {
        dueEl.innerHTML = `${formatDate(activeTaskDetail.dueDate)} ${activeTaskDetail.isOverdue ? '<span style="color: #F87171; font-weight: 700;">(Overdue)</span>' : ''}`;
      } else {
        dueEl.textContent = 'None';
      }
    }
    if (assigneesEl) {
      const assignees = activeTaskDetail.assignees || [];
      if (assignees.length === 0) {
        assigneesEl.textContent = 'Unassigned';
      } else {
        assigneesEl.textContent = assignees.map((a) => a.name).join(', ');
      }
    }
    if (updatedEl) {
      updatedEl.textContent = new Date(activeTaskDetail.updatedAt).toLocaleString();
    }
    if (descEl) {
      descEl.textContent = activeTaskDetail.description || 'No description provided.';
    }

    // Reset comment form & feedback banner
    const commentInput = document.getElementById('comment-input');
    const commentFeedback = document.getElementById('comment-feedback');
    if (commentInput) commentInput.value = '';
    if (commentFeedback) {
      commentFeedback.className = 'feedback-banner';
      commentFeedback.style.display = 'none';
      commentFeedback.textContent = '';
    }

    // Load active task comments
    await loadTaskComments(taskId);

    taskDetailModal.classList.add('open');
  } catch (err) {
    console.error('Error opening task detail:', err);
  }
}

function closeTaskDetail() {
  taskDetailModal.classList.remove('open');
  activeTaskDetail = null;
}

/**
 * Helper to format relative time.
 */
function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Loads and renders comments for a task.
 */
async function loadTaskComments(taskId) {
  const commentsListEl = document.getElementById('task-comments-list');
  const countPill = document.getElementById('comments-count-pill');
  if (!commentsListEl) return;

  commentsListEl.innerHTML = '<div class="comment-empty-state"><div class="spinner" style="margin: 0 auto 0.5rem;"></div>Loading discussion...</div>';

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      commentsListEl.innerHTML = `<div class="comment-empty-state" style="color: #F87171;">Failed to load comments: ${escapeHtml(body.error?.message || 'Error')}</div>`;
      return;
    }

    const comments = body.data.comments || [];
    if (countPill) countPill.textContent = comments.length;

    renderCommentsList(comments, taskId);
  } catch (err) {
    console.error('Error loading comments:', err);
    commentsListEl.innerHTML = '<div class="comment-empty-state" style="color: #F87171;">Network error loading comments.</div>';
  }
}

/**
 * Renders the array of comments into the comments container.
 */
function renderCommentsList(comments, taskId) {
  const container = document.getElementById('task-comments-list');
  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = `
      <div class="comment-empty-state">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">💭</div>
        No comments yet. Start the conversation below!
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  const isPrivileged = ['owner', 'admin'].includes(currentProject?.userRole);

  comments.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.dataset.commentId = c.id;

    const authorInitials = getInitials(c.author?.name);
    const authorColor = c.author?.avatarColor || '#6366F1';
    const timeAgo = formatTimeAgo(c.createdAt);
    const isAuthor = currentUser && c.author && c.author.id === currentUser.id;
    const canDelete = isAuthor || isPrivileged;

    card.innerHTML = `
      <div class="comment-card-header">
        <div class="comment-author-badge">
          <div class="comment-author-avatar" style="background-color: ${authorColor};">
            ${authorInitials}
          </div>
          <div class="comment-meta-info">
            <span class="comment-author-name">${escapeHtml(c.author?.name || 'Unknown')}</span>
            <span class="comment-timestamp">${timeAgo}${c.isEdited ? ' <span class="comment-edited-tag">(edited)</span>' : ''}</span>
          </div>
        </div>
        ${canDelete ? `<button class="btn-delete-comment" type="button" title="Delete comment" data-comment-id="${c.id}">&times; Delete</button>` : ''}
      </div>
      <div class="comment-body-text">${escapeHtml(c.body).replace(/\n/g, '<br>')}</div>
    `;

    if (canDelete) {
      const deleteBtn = card.querySelector('.btn-delete-comment');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDeleteComment(taskId, c.id));
      }
    }

    container.appendChild(card);
  });
}

/**
 * Posts a new comment to the active task.
 */
async function handlePostComment(taskId) {
  const commentInput = document.getElementById('comment-input');
  const commentFeedback = document.getElementById('comment-feedback');
  const submitBtn = document.getElementById('btn-submit-comment');
  if (!commentInput || !submitBtn) return;

  const body = commentInput.value.trim();
  if (!body) {
    if (commentFeedback) {
      commentFeedback.className = 'feedback-banner error';
      commentFeedback.style.display = 'block';
      commentFeedback.textContent = 'Comment cannot be empty.';
    }
    commentInput.focus();
    return;
  }

  if (commentFeedback) {
    commentFeedback.className = 'feedback-banner';
    commentFeedback.style.display = 'none';
    commentFeedback.textContent = '';
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting...';

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ body }),
    });

    const resData = await res.json();
    if (!resData.success) {
      if (commentFeedback) {
        commentFeedback.className = 'feedback-banner error';
        commentFeedback.style.display = 'block';
        commentFeedback.textContent = resData.error?.message || 'Failed to post comment.';
      }
      return;
    }

    commentInput.value = '';
    await loadTaskComments(taskId);
  } catch (err) {
    console.error('Error posting comment:', err);
    if (commentFeedback) {
      commentFeedback.className = 'feedback-banner error';
      commentFeedback.style.display = 'block';
      commentFeedback.textContent = 'Network error while posting comment.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Comment';
  }
}

/**
 * Handles comment deletion.
 */
async function handleDeleteComment(taskId, commentId) {
  const confirmed = window.confirm('Are you sure you want to delete this comment?');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Could not delete comment: ${body.error?.message || 'Permission denied'}`);
      return;
    }

    await loadTaskComments(taskId);
  } catch (err) {
    console.error('Error deleting comment:', err);
    alert('Network error while deleting comment.');
  }
}

/**
 * Task Creation Modal.
 */
function openCreateTaskModal(targetStatus = 'todo') {
  createTaskFeedback.className = 'feedback-banner';
  createTaskFeedback.style.display = 'none';
  createTaskForm.reset();
  document.getElementById('task-status-target').value = targetStatus;

  // Uncheck all assignees
  if (createAssigneeChecklist) {
    createAssigneeChecklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });
  }

  createTaskModal.classList.add('open');
  document.getElementById('task-title-input').focus();
}

function closeCreateTaskModal() {
  createTaskModal.classList.remove('open');
}

/**
 * Handles create task form submission.
 */
async function handleCreateTaskSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('task-title-input').value.trim();
  const description = document.getElementById('task-desc-input').value.trim();
  const priority = document.getElementById('task-priority-select').value;
  const due_date = document.getElementById('task-due-date-input').value || null;

  const selectedAssignees = [];
  if (createAssigneeChecklist) {
    createAssigneeChecklist.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      selectedAssignees.push(cb.value);
    });
  }

  if (!title) return;

  const submitBtn = document.getElementById('btn-submit-create-task');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        title,
        description,
        priority,
        due_date,
        assignee_ids: selectedAssignees,
      }),
    });

    const body = await res.json();
    if (!body.success) {
      createTaskFeedback.className = 'feedback-banner error';
      createTaskFeedback.textContent = body.error?.message || 'Failed to create task.';
      return;
    }

    closeCreateTaskModal();
    await loadTasks();
  } catch (err) {
    createTaskFeedback.className = 'feedback-banner error';
    createTaskFeedback.textContent = 'Network error while creating task.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Task';
  }
}

/**
 * Task Editing Modal.
 */
function openEditTaskModal(taskId) {
  // Find task in local state or activeTaskDetail
  let task = activeTaskDetail?.id === taskId ? activeTaskDetail : null;
  if (!task) {
    for (const status in tasksData) {
      const found = tasksData[status].find((t) => t.id === taskId);
      if (found) {
        task = found;
        break;
      }
    }
  }

  if (!task) return;

  editTaskFeedback.className = 'feedback-banner';
  editTaskFeedback.style.display = 'none';

  document.getElementById('edit-task-id').value = task.id;
  document.getElementById('edit-task-title').value = task.title;
  document.getElementById('edit-task-desc').value = task.description || '';
  document.getElementById('edit-task-priority').value = task.priority || 'medium';
  document.getElementById('edit-task-due-date').value = task.dueDate || '';

  // Check assigned members
  const assignedIds = (task.assignees || []).map((a) => a.id);
  if (editAssigneeChecklist) {
    editAssigneeChecklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = assignedIds.includes(cb.value);
    });
  }

  // Close detail if open
  closeTaskDetail();
  editTaskModal.classList.add('open');
  document.getElementById('edit-task-title').focus();
}

function closeEditTaskModal() {
  editTaskModal.classList.remove('open');
}

/**
 * Handles edit task form submission.
 */
async function handleEditTaskSubmit(e) {
  e.preventDefault();

  const taskId = document.getElementById('edit-task-id').value;
  const title = document.getElementById('edit-task-title').value.trim();
  const description = document.getElementById('edit-task-desc').value.trim();
  const priority = document.getElementById('edit-task-priority').value;
  const due_date = document.getElementById('edit-task-due-date').value || null;

  const selectedAssignees = [];
  if (editAssigneeChecklist) {
    editAssigneeChecklist.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      selectedAssignees.push(cb.value);
    });
  }

  const submitBtn = document.getElementById('btn-submit-edit-task');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        title,
        description,
        priority,
        due_date,
        assignee_ids: selectedAssignees,
      }),
    });

    const body = await res.json();
    if (!body.success) {
      editTaskFeedback.className = 'feedback-banner error';
      editTaskFeedback.textContent = body.error?.message || 'Failed to update task.';
      return;
    }

    closeEditTaskModal();
    await loadTasks();
  } catch (err) {
    editTaskFeedback.className = 'feedback-banner error';
    editTaskFeedback.textContent = 'Network error while updating task.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

/**
 * Handles task deletion with confirmation.
 */
async function confirmDeleteTask(taskId, title) {
  const confirmed = window.confirm(`Are you sure you want to delete task "${title}"?\nThis action cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Failed to delete task: ${body.error?.message || 'Access denied'}`);
      return;
    }

    closeTaskDetail();
    await loadTasks();
  } catch (err) {
    alert('Network error while deleting task.');
  }
}

/**
 * Sets up global event listeners.
 */
function setupEventListeners() {
  if (searchInput) searchInput.addEventListener('input', renderBoard);
  if (priorityFilter) priorityFilter.addEventListener('change', renderBoard);

  const openCreateBtn = document.getElementById('btn-open-create-task');
  if (openCreateBtn) openCreateBtn.addEventListener('click', () => openCreateTaskModal('todo'));

  document.querySelectorAll('.btn-add-task-column').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const status = e.currentTarget.dataset.status || 'todo';
      openCreateTaskModal(status);
    });
  });

  const closeCreateBtn = document.getElementById('btn-close-create-task');
  if (closeCreateBtn) closeCreateBtn.addEventListener('click', closeCreateTaskModal);

  const cancelCreateBtn = document.getElementById('btn-cancel-create-task');
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeCreateTaskModal);

  const closeEditBtn = document.getElementById('btn-close-edit-task');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditTaskModal);

  const cancelEditBtn = document.getElementById('btn-cancel-edit-task');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditTaskModal);

  const closeDetailBtn = document.getElementById('btn-close-task-detail');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeTaskDetail);

  const editFromDetailBtn = document.getElementById('btn-edit-from-detail');
  if (editFromDetailBtn) {
    editFromDetailBtn.addEventListener('click', () => {
      if (activeTaskDetail) openEditTaskModal(activeTaskDetail.id);
    });
  }

  const deleteFromDetailBtn = document.getElementById('btn-delete-from-detail');
  if (deleteFromDetailBtn) {
    deleteFromDetailBtn.addEventListener('click', () => {
      if (activeTaskDetail) confirmDeleteTask(activeTaskDetail.id, activeTaskDetail.title);
    });
  }

  if (createTaskForm) createTaskForm.addEventListener('submit', handleCreateTaskSubmit);
  if (editTaskForm) editTaskForm.addEventListener('submit', handleEditTaskSubmit);

  const submitCommentBtn = document.getElementById('btn-submit-comment');
  if (submitCommentBtn) {
    submitCommentBtn.addEventListener('click', () => {
      if (activeTaskDetail) handlePostComment(activeTaskDetail.id);
    });
  }

  const commentInput = document.getElementById('comment-input');
  if (commentInput) {
    commentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeTaskDetail) handlePostComment(activeTaskDetail.id);
      }
    });
  }

  setupColumnDragAndDrop();

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

document.addEventListener('DOMContentLoaded', init);
