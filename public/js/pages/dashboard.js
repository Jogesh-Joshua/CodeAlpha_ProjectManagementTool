/**
 * Orbit — Client-side Dashboard Shell & Session Management (ES Module)
 */

let currentCsrfToken = null;

const userProfileEl = document.getElementById('user-profile');
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const welcomeTitleEl = document.getElementById('welcome-title');
const logoutBtn = document.getElementById('logout-btn');

/**
 * Get user initials from their full name.
 * @param {string} name
 * @returns {string} 1-2 letters
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Restore user session from backend.
 */
async function initSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });

    if (!res.ok) {
      window.location.replace('/pages/auth.html?mode=login');
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data || !json.data.user) {
      window.location.replace('/pages/auth.html?mode=login');
      return;
    }

    const { user, csrfToken } = json.data;
    currentCsrfToken = csrfToken;

    // Render user profile
    userNameEl.textContent = user.name;
    userEmailEl.textContent = user.email;
    welcomeTitleEl.textContent = `Welcome back, ${user.name.split(' ')[0]}!`;

    userAvatarEl.textContent = getInitials(user.name);
    if (user.avatarColor) {
      userAvatarEl.style.backgroundColor = user.avatarColor;
    }

    userProfileEl.style.display = 'flex';
  } catch (err) {
    console.error('[Orbit Dashboard] Error verifying session:', err);
    window.location.replace('/pages/auth.html?mode=login');
  }
}

/**
 * Handle user logout.
 */
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  logoutBtn.textContent = 'Signing out...';

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
    console.warn('[Orbit Dashboard] Logout network warning:', err.message);
  } finally {
    window.location.replace('/pages/auth.html?mode=login');
  }
});

// Run session check on page load
initSession();
