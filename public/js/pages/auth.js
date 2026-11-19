/**
 * Orbit — Client-side Authentication Script (ES Module)
 */

let currentCsrfToken = null;

// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const alertBanner = document.getElementById('alert-banner');
const footerSwitchText = document.getElementById('footer-switch-text');
const footerSwitchLink = document.getElementById('footer-switch-link');

/**
 * Fetch and set the CSRF token.
 */
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    const json = await res.json();
    if (json.success && json.data && json.data.csrfToken) {
      currentCsrfToken = json.data.csrfToken;
    }
  } catch (err) {
    console.error('[Orbit Auth] Failed to fetch CSRF token:', err);
  }
}

/**
 * Check if the user is already authenticated.
 * If yes, redirect immediately to the dashboard.
 */
async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.user) {
        window.location.replace('/pages/dashboard.html');
      }
    }
  } catch (err) {
    // Unauthenticated or network error — stay on auth page
  }
}

/**
 * Display alert banner with error or success message.
 */
function showAlert(message, type = 'error') {
  alertBanner.textContent = message;
  alertBanner.className = `alert-banner ${type}`;
  alertBanner.style.display = 'block';
}

function clearAlert() {
  alertBanner.textContent = '';
  alertBanner.style.display = 'none';
}

/**
 * Switch mode between 'login' and 'register'.
 */
function setMode(mode) {
  clearAlert();
  if (mode === 'register') {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    footerSwitchText.textContent = 'Already have an account?';
    footerSwitchLink.textContent = 'Sign in here';
    history.replaceState(null, '', '?mode=register');
  } else {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    footerSwitchText.textContent = "Don't have an account?";
    footerSwitchLink.textContent = 'Sign up here';
    history.replaceState(null, '', '?mode=login');
  }
}

/**
 * Password Visibility Toggle
 */
document.querySelectorAll('.toggle-pwd-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });
});

/**
 * Tab and footer switch handlers
 */
tabLogin.addEventListener('click', () => setMode('login'));
tabRegister.addEventListener('click', () => setMode('register'));
footerSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  const isLoginActive = tabLogin.classList.contains('active');
  setMode(isLoginActive ? 'register' : 'login');
});

/**
 * Login Form Submission
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAlert();

  const submitBtn = document.getElementById('login-submit-btn');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showAlert('Please fill in both email and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    if (!currentCsrfToken) {
      await fetchCsrfToken();
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': currentCsrfToken || '',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      const errorMsg = json.message || 'Login failed. Please check your credentials.';
      showAlert(errorMsg, 'error');
      // Refresh CSRF token on failure
      fetchCsrfToken();
      return;
    }

    // Success — navigate to dashboard
    window.location.replace('/pages/dashboard.html');
  } catch (err) {
    showAlert('A network error occurred. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

/**
 * Register Form Submission
 */
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAlert();

  const submitBtn = document.getElementById('register-submit-btn');
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  if (password !== confirmPassword) {
    showAlert('Passwords do not match.');
    return;
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    showAlert('Password must be at least 8 characters with at least 1 uppercase letter and 1 number.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    if (!currentCsrfToken) {
      await fetchCsrfToken();
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': currentCsrfToken || '',
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      const errorMsg = json.message || 'Registration failed. Please try again.';
      showAlert(errorMsg, 'error');
      fetchCsrfToken();
      return;
    }

    // Success — navigate to dashboard
    window.location.replace('/pages/dashboard.html');
  } catch (err) {
    showAlert('A network error occurred. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
});

// Public Demo Workspace Helper
const btnUseDemo = document.getElementById('btn-use-demo');
if (btnUseDemo) {
  btnUseDemo.addEventListener('click', () => {
    // 1. Switch to login tab if in register mode
    setMode('login');

    // 2. Populate login fields
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput && passwordInput) {
      emailInput.value = 'orbit.demo@example.com';
      passwordInput.value = 'OrbitDemo!Workspace2026#Try';

      // 3. Highlight and focus for user review
      showAlert('Demo credentials populated. Click "Sign In" to explore Orbit.', 'success');
      passwordInput.focus();
    }
  });
}

// Initialize on page load
const urlParams = new URLSearchParams(window.location.search);
const initialMode = urlParams.get('mode') === 'register' ? 'register' : 'login';
setMode(initialMode);
fetchCsrfToken();
checkExistingSession();
