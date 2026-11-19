/**
 * Orbit — Client-side Workspace Dashboard & Session Management (ES Module)
 * Linear & Asana inspired SaaS aesthetic
 */

'use strict';

let currentCsrfToken = null;
let currentUser = null;

// DOM Elements
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const welcomeTitleEl = document.getElementById('welcome-title');
const logoutBtn = document.getElementById('logout-btn');

const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const dashboardSidebar = document.getElementById('dashboard-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Metric Elements
const metricProjectsEl = document.getElementById('metric-projects-count');
const metricOpenTasksEl = document.getElementById('metric-open-tasks-count');
const metricInProgressEl = document.getElementById('metric-in-progress-count');
const metricCompletedEl = document.getElementById('metric-completed-count');

// Content Containers
const recentProjectsContainer = document.getElementById('recent-projects-container');
const myTasksContainer = document.getElementById('my-tasks-container');
const myTasksCountBadge = document.getElementById('my-tasks-count');

// Workflow Elements
const workflowTotalTasksEl = document.getElementById('workflow-total-tasks');
const workflowBarEl = document.getElementById('workflow-bar');
const legendTodoEl = document.getElementById('legend-count-todo');
const legendInProgressEl = document.getElementById('legend-count-in-progress');
const legendReviewEl = document.getElementById('legend-count-review');
const legendDoneEl = document.getElementById('legend-count-done');

// Activity Feed Elements
const activityListEl = document.getElementById('activity-list');
const activityCounterEl = document.getElementById('activity-counter');

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extracts initials (1-2 uppercase letters) from full name.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generates dynamic time-of-day greeting.
 * @param {string} name
 * @returns {string}
 */
function getGreeting(name) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

/**
 * Formats date into relative time string (e.g. "5m ago", "2h ago", "Yesterday").
 * @param {string|Date} dateVal
 * @returns {string}
 */
function formatRelativeTime(dateVal) {
  if (!dateVal) return 'Recently';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return 'Recently';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Formats short calendar date (e.g. "Nov 24").
 * @param {string|Date} dateVal
 * @returns {string}
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return String(dateVal);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Initialize mobile sidebar drawer toggling.
 */
function initSidebarDrawer() {
  if (!mobileMenuToggle || !dashboardSidebar || !sidebarOverlay) return;

  function openSidebar() {
    dashboardSidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  }

  function closeSidebar() {
    dashboardSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  mobileMenuToggle.addEventListener('click', openSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
}

/**
 * Setup signout action.
 */
function initLogout() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': currentCsrfToken || '',
        },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[Orbit Dashboard] Logout warning:', err.message);
    } finally {
      window.location.replace('/pages/auth.html?mode=login');
    }
  });
}

/**
 * Restores and verifies authenticated user session.
 */
async function initSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });

    if (!res.ok) {
      window.location.replace('/pages/auth.html?mode=login');
      return false;
    }

    const json = await res.json();
    if (!json.success || !json.data || !json.data.user) {
      window.location.replace('/pages/auth.html?mode=login');
      return false;
    }

    currentUser = json.data.user;
    currentCsrfToken = json.data.csrfToken;

    // Render user profile info
    if (userNameEl) userNameEl.textContent = currentUser.name;
    if (userEmailEl) userEmailEl.textContent = currentUser.email;
    if (welcomeTitleEl) welcomeTitleEl.textContent = getGreeting(currentUser.name);

    if (userAvatarEl) {
      userAvatarEl.textContent = getInitials(currentUser.name);
      if (currentUser.avatarColor) {
        userAvatarEl.style.backgroundColor = currentUser.avatarColor;
      }
    }

    return true;
  } catch (err) {
    console.error('[Orbit Dashboard] Session check failed:', err);
    window.location.replace('/pages/auth.html?mode=login');
    return false;
  }
}

/**
 * Fetches workspace data (all active projects and their tasks),
 * aggregates metrics, and populates all dashboard widgets.
 */
async function loadWorkspaceData() {
  try {
    // 1. Fetch user projects
    const projRes = await fetch('/api/projects', { credentials: 'include' });
    if (!projRes.ok) throw new Error('Failed to load projects');

    const projJson = await projRes.json();
    const projects = (projJson.data && Array.isArray(projJson.data.projects))
      ? projJson.data.projects
      : [];

    const activeProjects = projects.filter((p) => !p.isArchived);

    // 2. Concurrently fetch tasks for each active project
    const taskFetchResults = await Promise.allSettled(
      activeProjects.map(async (project) => {
        try {
          const res = await fetch(`/api/projects/${project.id}/tasks`, { credentials: 'include' });
          if (!res.ok) return { projectId: project.id, project, tasks: [] };
          const data = await res.json();
          const grouped = (data.success && data.data) ? data.data : { todo: [], in_progress: [], review: [], done: [] };
          
          // Flatten grouped tasks into a unified array with project metadata
          const flattened = [
            ...(grouped.todo || []),
            ...(grouped.in_progress || []),
            ...(grouped.review || []),
            ...(grouped.done || []),
          ].map((task) => ({
            ...task,
            projectId: project.id,
            projectName: project.name,
            projectColor: project.color,
          }));

          return { projectId: project.id, project, tasks: flattened };
        } catch (fetchErr) {
          console.warn(`[Orbit Dashboard] Failed tasks for project ${project.id}:`, fetchErr);
          return { projectId: project.id, project, tasks: [] };
        }
      })
    );

    // Collect all tasks into a single flat list
    const allTasks = [];
    taskFetchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value && Array.isArray(result.value.tasks)) {
        allTasks.push(...result.value.tasks);
      }
    });

    // 3. Render Metric Cards
    renderMetrics(activeProjects, allTasks);

    // 4. Render Recent Projects
    renderRecentProjects(activeProjects);

    // 5. Render My Tasks
    renderMyTasks(allTasks);

    // 6. Render Task Workflow Overview
    renderWorkflowOverview(allTasks);

    // 7. Render Recent Activity Feed
    renderActivityFeed(activeProjects, allTasks);

  } catch (err) {
    console.error('[Orbit Dashboard] Error loading workspace data:', err);
    renderErrorState();
  }
}

/**
 * Computes and renders Section B overview metric cards.
 * @param {Array} activeProjects
 * @param {Array} allTasks
 */
function renderMetrics(activeProjects, allTasks) {
  const activeProjectsCount = activeProjects.length;
  const inProgressCount = allTasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = allTasks.filter((t) => t.status === 'done').length;
  const openTasksCount = allTasks.filter((t) => ['todo', 'in_progress', 'review'].includes(t.status)).length;

  if (metricProjectsEl) metricProjectsEl.textContent = activeProjectsCount;
  if (metricOpenTasksEl) metricOpenTasksEl.textContent = openTasksCount;
  if (metricInProgressEl) metricInProgressEl.textContent = inProgressCount;
  if (metricCompletedEl) metricCompletedEl.textContent = completedCount;
}

/**
 * Renders Section C (Left Column): Recent Projects list or clean empty state.
 * @param {Array} projects
 */
function renderRecentProjects(projects) {
  if (!recentProjectsContainer) return;

  if (projects.length === 0) {
    recentProjectsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </div>
        <h3 class="empty-title">No projects yet</h3>
        <p class="empty-desc">Create your first collaborative project workspace to start organizing tasks.</p>
        <a href="/projects" class="empty-cta-btn">Create Project</a>
      </div>
    `;
    return;
  }

  // Sort by updatedAt descending and show top 4
  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);

  const html = `
    <div class="project-list">
      ${sorted.map((p) => {
        const total = p.taskCount || 0;
        const completed = p.completedTaskCount || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const color = p.color || '#6366F1';
        const members = p.memberCount || 1;

        return `
          <a href="/projects/${encodeURIComponent(p.id)}/board" class="project-item">
            <div class="project-item-top">
              <div class="project-item-main">
                <div class="project-item-heading">
                  <span class="project-color-dot" style="background-color: ${escapeHtml(color)};"></span>
                  <span class="project-item-name">${escapeHtml(p.name)}</span>
                </div>
                ${p.description ? `<p class="project-item-desc">${escapeHtml(p.description)}</p>` : ''}
              </div>
              <span class="project-role-badge">${escapeHtml(p.userRole || 'member')}</span>
            </div>

            <div class="project-progress-wrap">
              <div class="progress-labels">
                <span>${completed} of ${total} tasks</span>
                <span class="progress-pct">${pct}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%;"></div>
              </div>
            </div>

            <div class="project-item-footer">
              <div class="project-meta-left">
                <span>👥 ${members} member${members === 1 ? '' : 's'}</span>
              </div>
              <span>Updated ${formatRelativeTime(p.updatedAt)}</span>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;

  recentProjectsContainer.innerHTML = html;
}

/**
 * Renders Section C (Right Column): My Tasks list or clean empty state.
 * @param {Array} allTasks
 */
function renderMyTasks(allTasks) {
  if (!myTasksContainer) return;

  const currentUserId = currentUser ? currentUser.id : null;

  // Filter tasks assigned to current user
  const myTasks = allTasks.filter((task) => {
    if (!task.assignees || !Array.isArray(task.assignees)) return false;
    return task.assignees.some((a) => a.id === currentUserId);
  });

  if (myTasksCountBadge) {
    myTasksCountBadge.textContent = myTasks.length;
  }

  if (myTasks.length === 0) {
    myTasksContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 class="empty-title">No tasks assigned to you</h3>
        <p class="empty-desc">When team members assign tasks to you across projects, they will appear here.</p>
        <a href="/projects" class="empty-cta-btn">Browse Projects</a>
      </div>
    `;
    return;
  }

  // Sort: Overdue tasks first, then by status (non-done first), then by dueDate or updatedAt
  const sorted = [...myTasks].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  }).slice(0, 5);

  const statusLabels = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  };

  const html = `
    <div class="task-list">
      ${sorted.map((t) => {
        const boardUrl = `/projects/${encodeURIComponent(t.projectId)}/board`;
        const statusLabel = statusLabels[t.status] || t.status;
        const priority = (t.priority || 'medium').toLowerCase();

        return `
          <a href="${boardUrl}" class="task-item">
            <div class="task-item-title-row">
              <span class="task-item-title">${escapeHtml(t.title)}</span>
            </div>

            <div class="task-tags-row">
              <span class="badge-tag tag-project-pill">
                <span class="project-color-dot" style="background-color: ${escapeHtml(t.projectColor || '#6366F1')};"></span>
                <span>${escapeHtml(t.projectName)}</span>
              </span>

              <span class="badge-tag tag-status-pill ${escapeHtml(t.status)}">${escapeHtml(statusLabel)}</span>
              
              <span class="badge-tag tag-priority-pill ${escapeHtml(priority)}">${escapeHtml(priority)}</span>

              ${t.isOverdue ? `
                <span class="badge-tag tag-due-pill overdue">⚠️ Overdue (${formatDate(t.dueDate)})</span>
              ` : t.dueDate ? `
                <span class="badge-tag tag-due-pill">📅 Due ${formatDate(t.dueDate)}</span>
              ` : ''}
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;

  myTasksContainer.innerHTML = html;
}

/**
 * Computes and renders Section D: Task Workflow Overview breakdown.
 * @param {Array} allTasks
 */
function renderWorkflowOverview(allTasks) {
  const total = allTasks.length;
  if (workflowTotalTasksEl) {
    workflowTotalTasksEl.textContent = `${total} task${total === 1 ? '' : 's'}`;
  }

  const todoCount = allTasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = allTasks.filter((t) => t.status === 'in_progress').length;
  const reviewCount = allTasks.filter((t) => t.status === 'review').length;
  const doneCount = allTasks.filter((t) => t.status === 'done').length;

  const todoPct = total > 0 ? Math.round((todoCount / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((inProgressCount / total) * 100) : 0;
  const reviewPct = total > 0 ? Math.round((reviewCount / total) * 100) : 0;
  const donePct = total > 0 ? Math.max(0, 100 - (todoPct + inProgressPct + reviewPct)) : 0;

  // Update distribution bar segments
  if (workflowBarEl) {
    if (total === 0) {
      workflowBarEl.innerHTML = `
        <div class="workflow-seg" style="width: 100%; background-color: var(--dash-border);" title="No tasks yet"></div>
      `;
    } else {
      workflowBarEl.innerHTML = `
        <div class="workflow-seg todo" style="width: ${todoPct}%;" title="To Do: ${todoCount} (${todoPct}%)"></div>
        <div class="workflow-seg in_progress" style="width: ${inProgressPct}%;" title="In Progress: ${inProgressCount} (${inProgressPct}%)"></div>
        <div class="workflow-seg review" style="width: ${reviewPct}%;" title="In Review: ${reviewCount} (${reviewPct}%)"></div>
        <div class="workflow-seg done" style="width: ${donePct}%;" title="Done: ${doneCount} (${donePct}%)"></div>
      `;
    }
  }

  // Update Legend
  if (legendTodoEl) legendTodoEl.textContent = `${todoCount} (${todoPct}%)`;
  if (legendInProgressEl) legendInProgressEl.textContent = `${inProgressCount} (${inProgressPct}%)`;
  if (legendReviewEl) legendReviewEl.textContent = `${reviewCount} (${reviewPct}%)`;
  if (legendDoneEl) legendDoneEl.textContent = `${doneCount} (${donePct}%)`;
}

/**
 * Derives and renders Section E: Recent Activity Feed from actual project/task timestamps.
 * @param {Array} projects
 * @param {Array} tasks
 */
function renderActivityFeed(projects, tasks) {
  if (!activityListEl) return;

  const events = [];

  // 1. Task events
  tasks.forEach((t) => {
    if (t.createdAt) {
      events.push({
        id: `task-created-${t.id}`,
        timestamp: new Date(t.createdAt).getTime(),
        actorName: t.creator ? t.creator.name : 'Team Member',
        actorColor: t.creator ? t.creator.avatarColor : null,
        verb: 'created task',
        targetTitle: t.title,
        projectName: t.projectName,
        url: `/projects/${encodeURIComponent(t.projectId)}/board`,
      });
    }

    if (t.updatedAt && t.updatedAt !== t.createdAt) {
      const verb = t.status === 'done' ? 'completed task' : 'updated task';
      events.push({
        id: `task-updated-${t.id}`,
        timestamp: new Date(t.updatedAt).getTime(),
        actorName: t.creator ? t.creator.name : 'Team Member',
        actorColor: t.creator ? t.creator.avatarColor : null,
        verb: verb,
        targetTitle: t.title,
        projectName: t.projectName,
        url: `/projects/${encodeURIComponent(t.projectId)}/board`,
      });
    }
  });

  // 2. Project events
  projects.forEach((p) => {
    if (p.createdAt) {
      events.push({
        id: `proj-created-${p.id}`,
        timestamp: new Date(p.createdAt).getTime(),
        actorName: p.owner ? p.owner.name : 'Team Member',
        actorColor: p.owner ? p.owner.avatarColor : null,
        verb: 'created project',
        targetTitle: p.name,
        projectName: null,
        url: `/projects/${encodeURIComponent(p.id)}/board`,
      });
    }

    if (p.updatedAt && p.updatedAt !== p.createdAt) {
      events.push({
        id: `proj-updated-${p.id}`,
        timestamp: new Date(p.updatedAt).getTime(),
        actorName: p.owner ? p.owner.name : 'Team Member',
        actorColor: p.owner ? p.owner.avatarColor : null,
        verb: 'updated project',
        targetTitle: p.name,
        projectName: null,
        url: `/projects/${encodeURIComponent(p.id)}/board`,
      });
    }
  });

  // Sort descending by timestamp
  events.sort((a, b) => b.timestamp - a.timestamp);

  // Take top 6 unique events
  const topEvents = events.slice(0, 6);

  if (activityCounterEl) {
    activityCounterEl.textContent = `${topEvents.length} event${topEvents.length === 1 ? '' : 's'}`;
  }

  if (topEvents.length === 0) {
    activityListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <h3 class="empty-title">No recent activity</h3>
        <p class="empty-desc">Actions taken across your workspaces and tasks will be logged here.</p>
      </div>
    `;
    return;
  }

  const html = topEvents.map((ev) => {
    const initials = getInitials(ev.actorName);
    const bgStyle = ev.actorColor ? `style="background-color: ${escapeHtml(ev.actorColor)};"` : '';

    return `
      <div class="activity-item">
        <div class="activity-avatar" ${bgStyle} aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="activity-details">
          <p class="activity-text">
            <strong>${escapeHtml(ev.actorName)}</strong> ${escapeHtml(ev.verb)}
            <a href="${ev.url}" style="color: inherit; text-decoration: underline; font-weight: 500;">
              ${escapeHtml(ev.targetTitle)}
            </a>
            ${ev.projectName ? `<span style="color: var(--dash-text-muted);">in ${escapeHtml(ev.projectName)}</span>` : ''}
          </p>
          <span class="activity-time">${formatRelativeTime(ev.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');

  activityListEl.innerHTML = html;
}

/**
 * Renders an inline error state if loading fails.
 */
function renderErrorState() {
  if (recentProjectsContainer) {
    recentProjectsContainer.innerHTML = `
      <div class="empty-state">
        <p class="empty-title" style="color: var(--dash-danger-text);">Failed to load projects</p>
        <p class="empty-desc">An error occurred while communicating with the workspace server.</p>
        <button class="empty-cta-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/**
 * Main application initialization.
 */
async function init() {
  initSidebarDrawer();
  initLogout();

  const authenticated = await initSession();
  if (authenticated) {
    await loadWorkspaceData();
  }
}

// Start dashboard on DOM readiness
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
