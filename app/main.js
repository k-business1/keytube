/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Main Application Entry Point (app/main.js)
   ════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  logPageVisit();
  initGlobalEvents();
});

/**
 * Initializes and updates navbar links based on authentication state
 */
function initNavbar() {
  const user = getSessionUser();
  const navUserMenu = document.getElementById("navUserMenu");

  if (!navUserMenu) return;

  if (user) {
    navUserMenu.innerHTML = `
      <div class="user-nav-group" style="display: flex; align-items: center; gap: 12px;">
        <a href="../user/studio/index.html" class="nav-link studio-link">Studio</a>
        <a href="../pages/profile.html" class="nav-user-profile" style="display: flex; align-items: center; gap: 8px;">
          <img src="${user.avatar || '../imagelib/default-avatar.png'}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onError="this.src='../imagelib/logo.png'">
          <span>${escapeHtml(user.name || user.gmail)}</span>
        </a>
        <button onclick="doLogout()" class="btn-logout" style="cursor: pointer;">Sign Out</button>
      </div>
    `;
  } else {
    navUserMenu.innerHTML = `
      <div class="auth-nav-group" style="display: flex; gap: 8px;">
        <a href="../pages/login.html" class="btn-login">Sign In</a>
        <a href="../pages/register.html" class="btn-register">Register</a>
      </div>
    `;
  }
}

/**
 * Logs visitor activity to the Traffic sheet in backend
 */
function logPageVisit() {
  const user = getSessionUser();
  apiFetch({
    action: "logTraffic",
    user: user ? user.gmail : "guest",
    actionName: "visit",
    details: window.location.pathname
  });
}

/**
 * Initializes global event handlers (Search bar submit, Toasts, etc.)
 */
function initGlobalEvents() {
  const searchForm = document.getElementById("globalSearchForm");
  const searchInput = document.getElementById("globalSearchInput");

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `../pages/search.html?q=${encodeURIComponent(q)}`;
      }
    });
  }
}

/**
 * Helper to escape HTML characters safely
 * @param {string} str 
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
