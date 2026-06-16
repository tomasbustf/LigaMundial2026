/**
 * Dashboard View — Personal summary, predictions, and upcoming matches
 * Organized by Fecha 1, Fecha 2, Fecha 3 for group stage
 */
import { supabase } from '../supabase.js';

export async function renderDashboard(userId) {
  if (!userId) {
    return `
      <div class="container page">
        <div class="empty-state">
          <div class="icon">👤</div>
          <h3>Selecciona tu usuario</h3>
          <p>Elige tu nombre en el selector de arriba para ver tu dashboard</p>
        </div>
      </div>
    `;
  }

  // Fetch user data
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch leaderboard position
  const { data: leaderboard } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false });

  const userRank = leaderboard?.findIndex(l => l.id === userId) + 1 || '-';
  const userData = leaderboard?.find(l => l.id === userId);

  // Fetch special predictions
  const { data: specialPred } = await supabase
    .from('special_predictions')
    .select('*, champion:teams!special_predictions_champion_team_id_fkey(name, flag_emoji, champion_risk_multiplier), scorer:players!special_predictions_top_scorer_player_id_fkey(name, scorer_risk_multiplier)')
    .eq('user_id', userId)
    .single();

  // Fetch all matches with team info and user predictions
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, name, flag_emoji),
      away_team:teams!matches_away_team_id_fkey(id, name, flag_emoji)
    `)
    .order('match_number', { ascending: true });

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId);

  const predMap = {};
  predictions?.forEach(p => { predMap[p.match_id] = p; });

  // Split matches into group stage rounds and knockout
  const groupMatches = matches?.filter(m => m.phase === 'Grupos' && m.home_team && m.away_team) || [];
  const knockoutMatches = matches?.filter(m => m.phase !== 'Grupos' && m.home_team && m.away_team) || [];

  // Group by round (Fecha 1, 2, 3)
  const fecha1 = groupMatches.filter(m => m.group_stage_round === 'Fecha 1');
  const fecha2 = groupMatches.filter(m => m.group_stage_round === 'Fecha 2');
  const fecha3 = groupMatches.filter(m => m.group_stage_round === 'Fecha 3');

  // Determine which fecha is "active" (first one with unfinished matches)
  let activeFecha = 'fecha1';
  if (fecha1.every(m => m.is_finished) && fecha2.length > 0) activeFecha = 'fecha2';
  if (fecha2.every(m => m.is_finished) && fecha3.length > 0) activeFecha = 'fecha3';

  // Calculate accuracy
  const finishedMatches = groupMatches.filter(m => m.is_finished);
  const totalFinished = finishedMatches.length;
  const totalCorrect = (userData?.correct_winners || 0) + (userData?.exact_scores || 0);
  const accuracy = totalFinished > 0 ? Math.round((totalCorrect / totalFinished) * 100) : 0;

  // Count predictions per fecha
  const fecha1Preds = fecha1.filter(m => predMap[m.id]).length;
  const fecha2Preds = fecha2.filter(m => predMap[m.id]).length;
  const fecha3Preds = fecha3.filter(m => predMap[m.id]).length;

  // Count points per fecha
  const fecha1Pts = fecha1.reduce((sum, m) => sum + (predMap[m.id]?.points_earned || 0), 0);
  const fecha2Pts = fecha2.reduce((sum, m) => sum + (predMap[m.id]?.points_earned || 0), 0);
  const fecha3Pts = fecha3.reduce((sum, m) => sum + (predMap[m.id]?.points_earned || 0), 0);

  return `
    <div class="container page">
      <div class="page-header">
        <h1>
          <div class="user-avatar" style="background:${user?.avatar_color}">${user?.name?.charAt(0)}</div>
          ${user?.name || 'Usuario'}
        </h1>
        <span class="subtitle">Dashboard Personal</span>
      </div>

      <!-- Stats -->
      <div class="stat-cards">
        <div class="stat-card">
          <div class="label">Puntos Totales</div>
          <div class="value">${userData?.total_points || 0}</div>
          <div class="detail">${userData?.group_points || 0} grupos · ${userData?.knockout_points || 0} eliminatorias</div>
        </div>
        <div class="stat-card">
          <div class="label">Posición</div>
          <div class="value">#${userRank}</div>
          <div class="detail">de ${leaderboard?.length || 12} participantes</div>
        </div>
        <div class="stat-card">
          <div class="label">Exactos</div>
          <div class="value">${userData?.exact_scores || 0}</div>
          <div class="detail">${userData?.correct_winners || 0} ganadores acertados</div>
        </div>
        <div class="stat-card">
          <div class="label">Efectividad</div>
          <div class="value">${accuracy}%</div>
          <div class="detail">${totalCorrect} de ${totalFinished} partidos</div>
        </div>
      </div>

      <!-- Special Predictions -->
      <div class="section">
        <div class="section-title">🎯 Predicciones Especiales</div>
        <div class="card">
          <div class="special-pred">
            <span class="label">Campeón</span>
            <span class="value">
              ${specialPred?.champion?.flag_emoji || '🏳️'} ${specialPred?.champion?.name || 'No definido'}
              <span class="multiplier">×${specialPred?.champion?.champion_risk_multiplier || '?'} riesgo</span>
            </span>
          </div>
          <div class="special-pred">
            <span class="label">Goleador</span>
            <span class="value">
              ${specialPred?.scorer?.name || 'No definido'}
              <span class="multiplier">×${specialPred?.scorer?.scorer_risk_multiplier || '?'} riesgo</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Group Stage Predictions by Fecha -->
      <div class="section">
        <div class="section-title">⚽ Fase de Grupos — Predicciones</div>

        <div class="fecha-tabs" id="fecha-tabs">
          <button class="fecha-tab ${activeFecha === 'fecha1' ? 'active' : ''}" data-fecha="fecha1">
            <span class="fecha-tab-title">Fecha 1</span>
            <span class="fecha-tab-meta">${fecha1Preds}/${fecha1.length} pred · ${fecha1Pts} pts</span>
            ${fecha1.every(m => m.is_finished) ? '<span class="fecha-tab-badge done">✓</span>' : fecha1.some(m => m.is_finished) ? '<span class="fecha-tab-badge live">EN CURSO</span>' : ''}
          </button>
          <button class="fecha-tab ${activeFecha === 'fecha2' ? 'active' : ''}" data-fecha="fecha2">
            <span class="fecha-tab-title">Fecha 2</span>
            <span class="fecha-tab-meta">${fecha2Preds}/${fecha2.length} pred · ${fecha2Pts} pts</span>
            ${fecha2.every(m => m.is_finished) ? '<span class="fecha-tab-badge done">✓</span>' : fecha2.some(m => m.is_finished) ? '<span class="fecha-tab-badge live">EN CURSO</span>' : ''}
          </button>
          <button class="fecha-tab ${activeFecha === 'fecha3' ? 'active' : ''}" data-fecha="fecha3">
            <span class="fecha-tab-title">Fecha 3</span>
            <span class="fecha-tab-meta">${fecha3Preds}/${fecha3.length} pred · ${fecha3Pts} pts</span>
            ${fecha3.every(m => m.is_finished) ? '<span class="fecha-tab-badge done">✓</span>' : fecha3.some(m => m.is_finished) ? '<span class="fecha-tab-badge live">EN CURSO</span>' : ''}
          </button>
        </div>

        <div id="fecha-fecha1" class="fecha-content" style="${activeFecha !== 'fecha1' ? 'display:none' : ''}">
          ${renderFechaMatches(fecha1, predMap)}
        </div>
        <div id="fecha-fecha2" class="fecha-content" style="${activeFecha !== 'fecha2' ? 'display:none' : ''}">
          ${renderFechaMatches(fecha2, predMap)}
        </div>
        <div id="fecha-fecha3" class="fecha-content" style="${activeFecha !== 'fecha3' ? 'display:none' : ''}">
          ${renderFechaMatches(fecha3, predMap)}
        </div>
      </div>

      <!-- Knockout Matches (if any have teams) -->
      ${knockoutMatches.length > 0 ? `
      <div class="section">
        <div class="section-title">🏆 Fase Eliminatoria</div>
        <div class="match-list">
          ${knockoutMatches.map(m => m.is_finished
            ? renderFinishedMatch(m, predMap[m.id])
            : renderUpcomingMatch(m, predMap[m.id])
          ).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function renderFechaMatches(matches, predMap) {
  if (!matches.length) {
    return '<div class="empty-state"><div class="icon">📋</div><p>No hay partidos definidos aún</p></div>';
  }

  // Group matches by group name
  const byGroup = {};
  matches.forEach(m => {
    const group = m.group_name || 'Sin grupo';
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push(m);
  });

  const sortedGroups = Object.keys(byGroup).sort();

  return `
    <div class="fecha-groups-grid">
      ${sortedGroups.map(groupName => `
        <div class="fecha-group-section">
          <div class="fecha-group-header">${groupName}</div>
          <div class="match-list">
            ${byGroup[groupName].map(m =>
              m.is_finished
                ? renderFinishedMatch(m, predMap[m.id])
                : renderUpcomingMatch(m, predMap[m.id])
            ).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderUpcomingMatch(match, prediction) {
  const hasPred = prediction !== undefined;
  return `
    <div class="match-card" data-match-id="${match.id}">
      <div class="match-team">
        <span class="flag">${match.home_team?.flag_emoji || '🏳️'}</span>
        <span>${match.home_team?.name || 'TBD'}</span>
      </div>
      <div class="match-center">
        <div class="match-phase">#${match.match_number}</div>
        <div class="prediction-input">
          <input type="number" min="0" max="20" class="pred-home" data-match-id="${match.id}" value="${hasPred ? prediction.home_score : ''}" placeholder="–">
          <span class="dash">–</span>
          <input type="number" min="0" max="20" class="pred-away" data-match-id="${match.id}" value="${hasPred ? prediction.away_score : ''}" placeholder="–">
        </div>
        <button class="btn btn-sm btn-primary save-prediction" data-match-id="${match.id}" ${hasPred ? 'style="background:var(--success);border-color:var(--success)"' : ''}>
          ${hasPred ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
      <div class="match-team away">
        <span>${match.away_team?.name || 'TBD'}</span>
        <span class="flag">${match.away_team?.flag_emoji || '🏳️'}</span>
      </div>
    </div>
  `;
}

function renderFinishedMatch(match, prediction) {
  const pts = prediction?.points_earned || 0;
  let badgeClass = 'pts-0';
  if (pts >= 5) badgeClass = 'pts-exact';
  else if (pts > 0) badgeClass = 'pts-positive';

  return `
    <div class="match-card finished">
      <div class="match-team">
        <span class="flag">${match.home_team?.flag_emoji || '🏳️'}</span>
        <span>${match.home_team?.name || 'TBD'}</span>
      </div>
      <div class="match-center">
        <div class="match-phase">#${match.match_number}</div>
        <div class="match-score">
          <span>${match.home_score ?? '–'}</span>
          <span class="separator">–</span>
          <span>${match.away_score ?? '–'}</span>
        </div>
        ${prediction ? `
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem">
          <span class="pred-label">Tu pred:</span>
          <span style="font-weight:600;font-size:0.85rem">${prediction.home_score} – ${prediction.away_score}</span>
          <span class="match-points-badge ${badgeClass}">+${pts} pts</span>
        </div>
        ` : '<span class="pred-label" style="margin-top:0.25rem">Sin predicción</span>'}
      </div>
      <div class="match-team away">
        <span>${match.away_team?.name || 'TBD'}</span>
        <span class="flag">${match.away_team?.flag_emoji || '🏳️'}</span>
      </div>
    </div>
  `;
}

export function initFechaTabs() {
  const tabs = document.querySelectorAll('#fecha-tabs .fecha-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const fecha = tab.dataset.fecha;
      document.querySelectorAll('.fecha-content').forEach(c => c.style.display = 'none');
      const target = document.getElementById(`fecha-${fecha}`);
      if (target) target.style.display = '';
    });
  });
}
