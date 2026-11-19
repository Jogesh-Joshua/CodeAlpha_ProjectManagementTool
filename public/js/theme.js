/**
 * Orbit — Global Theme Manager (Dark / Light)
 * Defaults to Dark Mode.
 * Persists user preference in localStorage under 'orbit-theme'.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'orbit-theme';
  const DEFAULT_THEME = 'dark';

  // SVG Icons
  const MOON_ICON = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `.trim();

  const SUN_ICON = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  `.trim();

  /**
   * Retrieves the current stored theme or defaults to 'dark'
   */
  function getTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (e) {
      // localStorage may be disabled
    }
    return DEFAULT_THEME;
  }

  /**
   * Updates all theme toggle buttons on the page with current icon, title, and aria-label
   */
  function updateToggleButtons(theme) {
    const isDark = theme === 'dark';
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    const icon = isDark ? MOON_ICON : SUN_ICON;

    const buttons = document.querySelectorAll('#theme-toggle, .btn-theme-toggle');
    buttons.forEach((btn) => {
      btn.innerHTML = icon;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  /**
   * Applies the theme to the document and saves it in localStorage
   */
  function setTheme(theme) {
    const validTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', validTheme);
    try {
      localStorage.setItem(STORAGE_KEY, validTheme);
    } catch (e) {
      // storage disabled
    }
    updateToggleButtons(validTheme);
  }

  /**
   * Toggles the current theme between dark and light
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  /**
   * Binds click handlers to all theme toggle buttons
   */
  function initThemeButtons() {
    const buttons = document.querySelectorAll('#theme-toggle, .btn-theme-toggle');
    buttons.forEach((btn) => {
      if (!btn.dataset.themeBound) {
        btn.dataset.themeBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleTheme();
        });
      }
    });

    const activeTheme = document.documentElement.getAttribute('data-theme') || getTheme();
    updateToggleButtons(activeTheme);
  }

  // Cross-tab sync
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      const newTheme = event.newValue === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateToggleButtons(newTheme);
    }
  });

  // Apply immediately upon script evaluation
  const initialTheme = getTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Initialize UI buttons once DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeButtons);
  } else {
    initThemeButtons();
  }

  // Expose global helper
  window.OrbitTheme = {
    getTheme,
    setTheme,
    toggleTheme,
    initThemeButtons,
  };
})();
