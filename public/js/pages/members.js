/**
 * Orbit — Project Members Management Page Module (Phase 3)
 */

let currentUser = null;
let csrfToken = null;
let currentProject = null;
let projectMembers = [];
let projectId = null;

// DOM Elements
const breadcrumbName = document.getElementById('breadcrumb-project-name');
const projectTitle = document.getElementById('project-title-heading');
const projectDesc = document.getElementById('project-desc-text');
const projectIconBox = document.getElementById('project-icon-box');
const statMemberCount = document.getElementById('stat-member-count');
const statTaskCount = document.getElementById('stat-task-count');
const addMemberSection = document.getElementById('add-member-section');
const addMemberForm = document.getElementById('add-member-form');
const memberEmailInput = document.getElementById('member-email-input');
const memberRoleSelect = document.getElementById('member-role-select');
const autocompleteDropdown = document.getElementById('user-autocomplete-dropdown');
const addMemberFeedback = document.getElementById('add-member-feedback');
const membersTableBody = document.getElementById('members-table-body');
const tableMembersBadge = document.getElementById('table-members-badge');

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
 * Formats ISO date to friendly string.
 */
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Determines project ID from current path or query string.
 */
function extractProjectId() {
  const match = window.location.pathname.match(/\/projects\/([0-9a-fA-F-]+)\/members/);
  if (match && match[1]) return match[1];

  const params = new URLSearchParams(window.location.search);
  return params.get('projectId') || params.get('id');
}

/**
 * Initializes authentication and fetches project data.
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

    setupEventListeners();
    await loadProjectData();
    await loadMembers();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

/**
 * Fetches project details.
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

    // Render header details
    if (breadcrumbName) breadcrumbName.textContent = currentProject.name;
    if (projectTitle) projectTitle.textContent = currentProject.name;
    if (projectDesc) projectDesc.textContent = currentProject.description || 'No description provided.';
    if (projectIconBox) projectIconBox.style.backgroundColor = currentProject.color || '#5B5BD6';
    if (statMemberCount) statMemberCount.textContent = currentProject.memberCount || 1;
    if (statTaskCount) statTaskCount.textContent = currentProject.taskCount || 0;

    // Show invite section if user is owner or admin
    const isOwnerOrAdmin = currentProject.userRole === 'owner' || currentProject.userRole === 'admin';
    if (addMemberSection) {
      addMemberSection.style.display = isOwnerOrAdmin ? 'block' : 'none';
    }
  } catch (err) {
    console.error('Error loading project details:', err);
  }
}

/**
 * Loads project members roster.
 */
async function loadMembers() {
  try {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      membersTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #EF4444; padding: 2rem;">
            Failed to load members: ${escapeHtml(body.error?.message || 'Unknown error')}
          </td>
        </tr>
      `;
      return;
    }

    projectMembers = body.data.members || [];
    if (tableMembersBadge) {
      tableMembersBadge.textContent = `${projectMembers.length} member${projectMembers.length === 1 ? '' : 's'}`;
    }
    if (statMemberCount) {
      statMemberCount.textContent = projectMembers.length;
    }

    renderMembersTable(projectMembers);
  } catch (err) {
    console.error('Error fetching members:', err);
  }
}

/**
 * Renders the table of members.
 */
function renderMembersTable(members) {
  if (!membersTableBody) return;

  const isCurrentProjectOwner = currentProject?.userRole === 'owner';
  const isCurrentProjectAdmin = currentProject?.userRole === 'admin';

  if (members.length === 0) {
    membersTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--theme-text-muted, #94A3B8);">
          No members found in this project.
        </td>
      </tr>
    `;
    return;
  }

  membersTableBody.innerHTML = members.map((m) => {
    const isSelf = m.id === currentUser.id;
    const isTargetOwner = m.role === 'owner';
    const isTargetAdmin = m.role === 'admin';

    // Role display: Owner can change roles of anyone.
    // If target is owner, only show badge unless owner is transferring.
    let roleCell = `<span class="role-badge ${m.role}">${escapeHtml(m.role)}</span>`;

    if (isCurrentProjectOwner && !isTargetOwner) {
      roleCell = `
        <select class="table-role-select change-role-select" data-user-id="${m.id}" data-name="${escapeHtml(m.name)}">
          <option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option>
          <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="owner">Transfer Ownership</option>
        </select>
      `;
    }

    // Actions cell:
    // - Owner cannot be removed.
    // - Admins cannot remove other admins or owner.
    // - Owner can remove anyone (except self).
    // - Anyone can remove themselves (leave project) unless they are the owner.
    let canRemove = false;
    let removeLabel = 'Remove';

    if (isSelf && !isTargetOwner) {
      canRemove = true;
      removeLabel = 'Leave';
    } else if (isCurrentProjectOwner && !isTargetOwner) {
      canRemove = true;
    } else if (isCurrentProjectAdmin && !isTargetOwner && !isTargetAdmin) {
      canRemove = true;
    }

    const actionCell = canRemove ? `
      <button
        class="btn-remove-member btn-remove-user"
        data-user-id="${m.id}"
        data-name="${escapeHtml(m.name)}"
        data-is-self="${isSelf}"
      >
        ${removeLabel}
      </button>
    ` : `<span style="color: var(--theme-text-muted, #94A3B8); font-size: 0.8rem;">—</span>`;

    return `
      <tr>
        <td>
          <div class="member-identity">
            <div class="member-avatar-lg" style="background-color: ${m.avatarColor || '#5B5BD6'};">
              ${getInitials(m.name)}
            </div>
            <div class="member-name-block">
              <span class="member-full-name">
                ${escapeHtml(m.name)} ${isSelf ? '<span style="opacity: 0.5; font-size: 0.8rem;">(You)</span>' : ''}
              </span>
              <span class="member-email-sub">${escapeHtml(m.email)}</span>
            </div>
          </div>
        </td>
        <td style="color: var(--theme-text-secondary, #64748B);">${formatDate(m.joinedAt)}</td>
        <td>${roleCell}</td>
        <td style="text-align: right;">${actionCell}</td>
      </tr>
    `;
  }).join('');

  // Attach role change listeners
  membersTableBody.querySelectorAll('.change-role-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const { userId, name } = e.target.dataset;
      const newRole = e.target.value;
      await handleRoleChange(userId, name, newRole);
    });
  });

  // Attach remove user listeners
  membersTableBody.querySelectorAll('.btn-remove-user').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const { userId, name, isSelf } = e.target.dataset;
      await handleRemoveUser(userId, name, isSelf === 'true');
    });
  });
}

/**
 * Handles member role change (or ownership transfer).
 */
async function handleRoleChange(targetUserId, targetName, newRole) {
  if (newRole === 'owner') {
    const confirmed = window.confirm(
      `TRANSFER PROJECT OWNERSHIP:\nAre you sure you want to transfer ownership of "${currentProject.name}" to ${targetName}?\nYou will be demoted to Admin.`
    );
    if (!confirmed) {
      await loadMembers();
      return;
    }
  }

  try {
    const res = await fetch(`/api/projects/${projectId}/members/${targetUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ role: newRole }),
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Failed to update role: ${body.error?.message || 'Error'}`);
    }

    await loadProjectData();
    await loadMembers();
  } catch (err) {
    alert('Network error while updating member role.');
    await loadMembers();
  }
}

/**
 * Handles member removal or self leave.
 */
async function handleRemoveUser(targetUserId, targetName, isSelf) {
  const message = isSelf
    ? `Are you sure you want to leave "${currentProject.name}"? You will lose access to its tasks.`
    : `Remove ${targetName} from "${currentProject.name}"? Their task assignments in this project will be unassigned.`;

  const confirmed = window.confirm(message);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/projects/${projectId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
    });

    const body = await res.json();
    if (!body.success) {
      alert(`Failed to remove member: ${body.error?.message || 'Error'}`);
      return;
    }

    if (isSelf) {
      window.location.href = '/projects';
      return;
    }

    await loadProjectData();
    await loadMembers();
  } catch (err) {
    alert('Network error while removing member.');
  }
}

/**
 * Live user autocomplete search.
 */
let debounceTimer = null;

async function handleUserSearch(e) {
  const query = e.target.value.trim();
  if (query.length < 1) {
    autocompleteDropdown.classList.remove('active');
    autocompleteDropdown.innerHTML = '';
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      });

      const body = await res.json();
      if (!body.success || !body.data.users || body.data.users.length === 0) {
        autocompleteDropdown.innerHTML = `
          <div style="padding: 0.75rem 1rem; color: var(--theme-text-muted, #94A3B8); font-size: 0.8rem;">
            No registered users found matching "${escapeHtml(query)}".
          </div>
        `;
        autocompleteDropdown.classList.add('active');
        return;
      }

      autocompleteDropdown.innerHTML = body.data.users.map((u) => `
        <div class="autocomplete-item" data-email="${escapeHtml(u.email)}" data-name="${escapeHtml(u.name)}">
          <div class="autocomplete-avatar" style="background-color: ${u.avatarColor || '#5B5BD6'};">
            ${getInitials(u.name)}
          </div>
          <div class="autocomplete-info">
            <span class="autocomplete-name">${escapeHtml(u.name)}</span>
            <span class="autocomplete-email">${escapeHtml(u.email)}</span>
          </div>
        </div>
      `).join('');

      autocompleteDropdown.classList.add('active');

      autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
        item.addEventListener('click', () => {
          memberEmailInput.value = item.dataset.email;
          autocompleteDropdown.classList.remove('active');
        });
      });
    } catch (err) {
      console.error('Error during user search:', err);
    }
  }, 250);
}

/**
 * Handles adding a member form submission.
 */
async function handleAddMemberSubmit(e) {
  e.preventDefault();
  const email = memberEmailInput.value.trim();
  const role = memberRoleSelect.value;

  if (!email) return;

  const submitBtn = document.getElementById('btn-submit-add-member');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  addMemberFeedback.className = 'feedback-banner';
  addMemberFeedback.style.display = 'none';

  try {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ email, role }),
    });

    const body = await res.json();
    if (!body.success) {
      addMemberFeedback.className = 'feedback-banner error';
      addMemberFeedback.textContent = body.error?.message || 'Failed to add member.';
      return;
    }

    addMemberFeedback.className = 'feedback-banner success';
    addMemberFeedback.textContent = `${body.data.member.name} has been added to the project as a ${body.data.member.role}.`;
    memberEmailInput.value = '';
    autocompleteDropdown.classList.remove('active');

    await loadProjectData();
    await loadMembers();
  } catch (err) {
    addMemberFeedback.className = 'feedback-banner error';
    addMemberFeedback.textContent = 'Network error while adding member.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Add Member';
  }
}

/**
 * Sets up event listeners.
 */
function setupEventListeners() {
  if (memberEmailInput) {
    memberEmailInput.addEventListener('input', handleUserSearch);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.input-with-autocomplete')) {
        autocompleteDropdown.classList.remove('active');
      }
    });
  }

  if (addMemberForm) {
    addMemberForm.addEventListener('submit', handleAddMemberSubmit);
  }

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
