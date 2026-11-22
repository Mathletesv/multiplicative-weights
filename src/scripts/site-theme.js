(() => {
  const storageKey = 'mw-color-scheme';
  const root = document.documentElement;
  const preference = window.matchMedia('(prefers-color-scheme: dark)');

  function restoreTheme() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
      else delete root.dataset.theme;
    } catch {
      // The system preference still applies when storage is unavailable.
    }
  }

  restoreTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!(toggle instanceof HTMLButtonElement)) return;

    function isDark() {
      return root.dataset.theme ? root.dataset.theme === 'dark' : preference.matches;
    }

    function updateToggle() {
      const dark = isDark();
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }

    toggle.addEventListener('click', () => {
      const theme = isDark() ? 'light' : 'dark';
      root.dataset.theme = theme;
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // The toggle still works on the current page.
      }
      updateToggle();
    });

    preference.addEventListener('change', updateToggle);
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      restoreTheme();
      updateToggle();
    });
    updateToggle();
    toggle.hidden = false;
  }, { once: true });
})();
