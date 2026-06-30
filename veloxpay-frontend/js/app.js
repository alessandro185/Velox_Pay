const VeloxPayApp = (() => {
  const THEME_KEY = "veloxpay-theme";

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved || "dark");
  }

  function bindGlobalEvents() {
    document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  }

  function init() {
    initTheme();
    bindGlobalEvents();
    VeloxPayRouter.init();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", VeloxPayApp.init);
