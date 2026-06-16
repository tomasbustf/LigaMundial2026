/**
 * Navbar Component
 */
export function renderNavbar(currentView, currentUser) {
  const avatar = currentUser
    ? `<div class="user-avatar" style="background:${currentUser.avatar_color}">${currentUser.name.charAt(0)}</div>`
    : '';

  return `
    <nav class="navbar" id="navbar">
      <div class="container navbar-inner">
        <a class="navbar-brand" href="#" data-view="dashboard">
          <span>⚽</span> Liga Polla 2026
        </a>
        <ul class="navbar-nav">
          <li><a href="#" data-view="dashboard" class="${currentView === 'dashboard' ? 'active' : ''}">📊 Dashboard</a></li>
          <li><a href="#" data-view="leaderboard" class="${currentView === 'leaderboard' ? 'active' : ''}">🏆 Tops</a></li>
          <li><a href="#" data-view="worldcup" class="${currentView === 'worldcup' ? 'active' : ''}">🌎 Mundial</a></li>
          ${currentUser?.is_admin ? `<li><a href="#" data-view="admin" class="${currentView === 'admin' ? 'active' : ''}">⚙️ Admin</a></li>` : ''}
          <li style="margin-left: 1rem;"><button id="nav-recalculate" class="btn btn-sm" style="padding: 0.35rem 0.75rem;">🔄 Recalcular Puntos</button></li>
        </ul>
        <div class="navbar-user">
          ${avatar}
          <select id="user-selector">
            <option value="general">📊 Vista General</option>
            <option disabled>──────────</option>
          </select>
        </div>
      </div>
    </nav>
  `;
}
