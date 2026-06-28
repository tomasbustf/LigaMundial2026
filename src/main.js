/**
 * Liga Polla Mundial 2026 — Main Application
 * Entry point, router, and event delegation
 */
import './styles/index.css';
import { supabase } from './supabase.js';
import { renderNavbar } from './components/navbar.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLeaderboard } from './views/leaderboard.js';
import { renderWorldCup, initWorldCupTabs } from './views/worldcup.js';
import { renderAdmin, initAdminTabs } from './views/admin.js';
import { renderGeneral, bindGeneralEvents } from './views/general.js';
import { initPointsChart } from './components/charts.js';

// ---- State ----
let currentView = 'dashboard';
let currentUserId = 'general'; // Always default to General View
let currentUser = null;
let allUsers = [];

const app = document.getElementById('app');

// ---- Init ----
async function init() {
  // Load users
  const { data: fetchedUsers } = await supabase
    .from('users')
    .select('*')
    .order('name');

  allUsers = fetchedUsers?.sort((a, b) => {
    const getPrio = (name) => {
      const n = name.toLowerCase();
      if (n.includes('tomás') || n.includes('tomas')) return 1;
      if (n.includes('ukid')) return 2;
      if (n.includes('simón') || n.includes('simon')) return 100;
      if (n.includes('chat gpt') || n.includes('chatgpt')) return 101;
      return 50;
    };
    const pA = getPrio(a.name);
    const pB = getPrio(b.name);
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  }) || [];

  if (currentUserId && currentUserId !== 'general') {
    currentUser = allUsers.find(u => u.id === currentUserId) || null;
    if (!currentUser) {
      currentUserId = 'general'; // Fall back to general view
      localStorage.removeItem('polla_user_id');
    }
  }

  await renderApp();
}

// ---- Render ----
async function renderApp() {
  // Render navbar
  const navHtml = renderNavbar(currentView, currentUser);

  // Show loading
  app.innerHTML = navHtml + `<div class="spinner"></div>`;

  // Populate user selector during loading
  const selector = document.getElementById('user-selector');
  if (selector) {
    if (currentUserId === 'general') {
      selector.value = 'general';
    }
    allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      if (u.id === currentUserId) opt.selected = true;
      selector.appendChild(opt);
    });
  }

  // Bind nav events immediately
  bindNavEvents();

  // Render view
  let viewHtml = '';
  try {
    switch (currentView) {
      case 'dashboard':
        if (currentUserId === 'general') {
          viewHtml = await renderGeneral();
        } else {
          viewHtml = await renderDashboard(currentUserId);
        }
        break;
      case 'leaderboard':
        viewHtml = await renderLeaderboard(currentUserId);
        break;
      case 'worldcup':
        viewHtml = await renderWorldCup();
        break;
      case 'admin':
        viewHtml = await renderAdmin(currentUserId);
        break;
      default:
        viewHtml = currentUserId === 'general' ? await renderGeneral() : await renderDashboard(currentUserId);
    }
  } catch (err) {
    console.error('Error rendering view:', err);
    viewHtml = `<div class="container page"><div class="empty-state"><div class="icon">⚠️</div><h3>Error al cargar</h3><p>${err.message}</p></div></div>`;
  }

  // Replace loading with content (keep navbar)
  app.innerHTML = navHtml + viewHtml;

  // Re-populate user selector after full render (navbar already includes Vista General + divider)
  const selectorAfter = document.getElementById('user-selector');
  if (selectorAfter) {
    // Set the general option as selected if needed
    if (currentUserId === 'general') {
      selectorAfter.value = 'general';
    }

    allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      if (u.id === currentUserId) opt.selected = true;
      selectorAfter.appendChild(opt);
    });
  }

  // Bind all events
  bindNavEvents();
  bindViewEvents();
}

// ---- Navigation Events ----
function bindNavEvents() {
  // Nav links
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view !== currentView) {
        currentView = view;
        await renderApp();
      }
    });
  });

  // User selector
  const selector = document.getElementById('user-selector');
  if (selector) {
    selector.addEventListener('change', async (e) => {
      currentUserId = e.target.value || 'general';
      currentUser = allUsers.find(u => u.id === currentUserId) || null;
      await renderApp();
    });
  }

  // Recalculate button
  const recalcBtn = document.getElementById('nav-recalculate');
  if (recalcBtn) {
    recalcBtn.addEventListener('click', async () => {
      recalcBtn.textContent = '...';
      recalcBtn.disabled = true;
      const { error } = await supabase.rpc('recalculate_all_points');
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Puntos actualizados en vivo', 'success');
        await renderApp();
      }
    });
  }
}

// ---- View-Specific Events ----
function bindViewEvents() {
  if (currentUserId === 'general' && (currentView === 'dashboard' || currentView === undefined)) {
    bindGeneralEvents();
  }

  // Leaderboard chart
  if (currentView === 'leaderboard') {
    initPointsChart();
  }

  // World Cup tabs
  if (currentView === 'worldcup') {
    initWorldCupTabs();
  }

  // Admin tabs & events
  if (currentView === 'admin') {
    initAdminTabs();
    bindAdminEvents();
  }

  // Dashboard prediction saving
  if (currentView === 'dashboard') {
    bindDashboardEvents();
  }
}

// ---- Dashboard Events ----
function bindDashboardEvents() {
  // Check if save prediction buttons exist, bind them if they do
  document.querySelectorAll('.save-prediction').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = parseInt(btn.dataset.matchId);
      const homeInput = document.querySelector(`.pred-home[data-match-id="${matchId}"]`);
      const awayInput = document.querySelector(`.pred-away[data-match-id="${matchId}"]`);

      const homeScore = parseInt(homeInput?.value);
      const awayScore = parseInt(awayInput?.value);

      if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        showToast('Ingresa ambos marcadores', 'error');
        return;
      }

      btn.textContent = '...';
      btn.disabled = true;

      const { error } = await supabase
        .from('predictions')
        .upsert({
          user_id: currentUserId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
        }, { onConflict: 'user_id,match_id' });

      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        btn.textContent = 'Guardar';
        btn.disabled = false;
      } else {
        btn.textContent = '✓ Guardado';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        btn.disabled = false;
        showToast('Predicción guardada', 'success');
      }
    });
  });
}

// ---- Admin Events ----
function bindAdminEvents() {
  // Toggle advancing team dropdown
  document.querySelectorAll('.admin-mode').forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('.admin-match-row');
      const advSelect = row.querySelector('.admin-advancing');
      if (advSelect) {
        advSelect.style.display = e.target.value === 'Penales' ? 'inline-block' : 'none';
        if (e.target.value !== 'Penales') {
          advSelect.value = '';
        }
      }
    });
  });

  // Save result
  document.querySelectorAll('.admin-save-result').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = parseInt(btn.dataset.matchId);
      const row = btn.closest('.admin-match-row');
      const homeScore = parseInt(row.querySelector('.admin-home-score').value);
      const awayScore = parseInt(row.querySelector('.admin-away-score').value);
      const isFinished = row.querySelector('.admin-finished').checked;
      const modeSelect = row.querySelector('.admin-mode');
      const mode = modeSelect ? modeSelect.value : null;
      const advSelect = row.querySelector('.admin-advancing');
      const advancingTeamId = advSelect ? advSelect.value : null;

      if (isFinished && (isNaN(homeScore) || isNaN(awayScore))) {
        showToast('Ingresa ambos marcadores', 'error');
        return;
      }

      const updateData = {
        home_score: isNaN(homeScore) ? null : homeScore,
        away_score: isNaN(awayScore) ? null : awayScore,
        is_finished: isFinished,
      };
      
      if (modeSelect) {
        updateData.mode = mode || null;
      }
      
      if (advSelect !== null) {
        updateData.advancing_team_id = advancingTeamId ? parseInt(advancingTeamId) : null;
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (error) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Resultado guardado', 'success');
      }
    });
  });

  // Recalculate
  document.getElementById('btn-recalculate')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-recalculate');
    btn.textContent = 'Calculando...';
    btn.disabled = true;

    const { error } = await supabase.rpc('recalculate_all_points');

    if (error) {
      showToast(`Error: ${error.message}`, 'error');
    } else {
      showToast('Puntos recalculados correctamente', 'success');
    }

    btn.textContent = 'Recalcular Puntos';
    btn.disabled = false;
  });

  // Save scoring rule
  document.querySelectorAll('.admin-save-rule').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ruleId = parseInt(btn.dataset.ruleId);
      const row = btn.closest('tr');
      const winnerPts = parseInt(row.querySelector('.rule-winner-pts').value);
      const exactPts = parseInt(row.querySelector('.rule-exact-pts').value);
      const multiplier = parseFloat(row.querySelector('.rule-multiplier').value);

      const { error } = await supabase
        .from('scoring_rules')
        .update({
          correct_winner_pts: winnerPts,
          exact_score_pts: exactPts,
          phase_multiplier: multiplier,
        })
        .eq('id', ruleId);

      if (error) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Regla actualizada', 'success');
      }
    });
  });

  // Save team multiplier
  document.querySelectorAll('.admin-save-multiplier').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamId = parseInt(btn.dataset.teamId);
      const row = btn.closest('tr');
      const multiplier = parseFloat(row.querySelector('.team-multiplier').value);

      const { error } = await supabase
        .from('teams')
        .update({ champion_risk_multiplier: multiplier })
        .eq('id', teamId);

      if (error) {
        showToast(`Error: ${error.message}`, 'error');
      } else {
        showToast('Multiplicador actualizado', 'success');
      }
    });
  });
}

// ---- Toast Notification ----
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ---- Start ----
init();
