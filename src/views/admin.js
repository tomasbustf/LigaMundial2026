/**
 * Admin Panel — Manage results, multipliers, and recalculate points
 */
import { supabase } from '../supabase.js';

export async function renderAdmin(userId) {
  // Check if user is admin
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (!user?.is_admin) {
    return `
      <div class="container page">
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>Acceso restringido</h3>
          <p>Solo los administradores pueden acceder a este panel</p>
        </div>
      </div>
    `;
  }

  // Fetch matches with teams
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
      away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
    `)
    .not('home_team_id', 'is', null)
    .order('match_number');

  // Fetch scoring rules
  const { data: rules } = await supabase
    .from('scoring_rules')
    .select('*')
    .order('id');

  // Fetch teams for risk multipliers
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, flag_emoji, champion_risk_multiplier')
    .order('name');

  return `
    <div class="container page">
      <div class="page-header">
        <h1>⚙️ Panel de Administración</h1>
        <span class="subtitle">Gestionar resultados y puntuación</span>
      </div>

      <div class="tabs" id="admin-tabs">
        <button class="tab active" data-tab="results">Resultados</button>
        <button class="tab" data-tab="rules">Reglas de Puntuación</button>
        <button class="tab" data-tab="multipliers">Multiplicadores</button>
      </div>

      <!-- Results Tab -->
      <div id="admin-tab-results">
        <div class="card">
          <div class="card-header">
            <h3>📝 Cargar Resultados Reales</h3>
            <button class="btn btn-primary" id="btn-recalculate">Recalcular Puntos</button>
          </div>
          <div class="table-wrap">
            ${matches?.map(m => {
              const isKnockout = m.phase !== 'Grupos';
              let modeSelect = '';
              if (isKnockout) {
                modeSelect = `
                  <select class="admin-mode" style="margin-left:0.5rem; font-size:0.8rem; padding:2px; border-radius:4px; border:1px solid var(--border);">
                    <option value="">Modo...</option>
                    <option value="90 minutos" ${m.mode === '90 minutos' ? 'selected' : ''}>90 mins</option>
                    <option value="Alargue" ${m.mode === 'Alargue' ? 'selected' : ''}>Alargue</option>
                    <option value="Penales" ${m.mode === 'Penales' ? 'selected' : ''}>Penales</option>
                  </select>
                `;
              }
              return `
              <div class="admin-match-row" data-match-id="${m.id}">
                <span class="match-num">#${m.match_number}</span>
                <span style="font-weight:500">${m.home_team?.flag_emoji || ''} ${m.home_team?.name || 'TBD'}</span>
                <div class="admin-score-input" style="display:flex; align-items:center;">
                  <input type="number" min="0" max="20" class="admin-home-score" value="${m.home_score ?? ''}" placeholder="–">
                  <span style="color:var(--light); margin:0 4px;">–</span>
                  <input type="number" min="0" max="20" class="admin-away-score" value="${m.away_score ?? ''}" placeholder="–">
                  ${modeSelect}
                </div>
                <span style="font-weight:500;text-align:right">${m.away_team?.name || 'TBD'} ${m.away_team?.flag_emoji || ''}</span>
                <div>
                  <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.4rem;cursor:pointer">
                    <input type="checkbox" class="admin-finished" ${m.is_finished ? 'checked' : ''}>
                    Finalizado
                  </label>
                </div>
                <button class="btn btn-sm admin-save-result" data-match-id="${m.id}">Guardar</button>
              </div>
            `}).join('') || '<div class="empty-state">No hay partidos con equipos definidos</div>'}
          </div>
        </div>
      </div>

      <!-- Rules Tab -->
      <div id="admin-tab-rules" style="display:none">
        <div class="card">
          <div class="card-header">
            <h3>📐 Reglas de Puntuación por Fase</h3>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th class="text-right">Pts Ganador</th>
                  <th class="text-right">Pts Exacto</th>
                  <th class="text-right">Multiplicador</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rules?.map(r => `
                  <tr data-rule-id="${r.id}">
                    <td style="font-weight:500">${r.phase}</td>
                    <td class="text-right">
                      <input type="number" class="rule-winner-pts" value="${r.correct_winner_pts}" style="width:50px;text-align:center;border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem;font-family:var(--font)">
                    </td>
                    <td class="text-right">
                      <input type="number" class="rule-exact-pts" value="${r.exact_score_pts}" style="width:50px;text-align:center;border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem;font-family:var(--font)">
                    </td>
                    <td class="text-right">
                      <input type="number" step="0.1" class="rule-multiplier" value="${r.phase_multiplier}" style="width:60px;text-align:center;border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem;font-family:var(--font)">
                    </td>
                    <td>
                      <button class="btn btn-sm admin-save-rule" data-rule-id="${r.id}">Guardar</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Multipliers Tab -->
      <div id="admin-tab-multipliers" style="display:none">
        <div class="card">
          <div class="card-header">
            <h3>🎲 Multiplicadores de Riesgo (Campeón)</h3>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th class="text-right">Multiplicador</th>
                  <th class="text-right">Pts si acierta (base 15)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${teams?.map(t => `
                  <tr data-team-id="${t.id}">
                    <td>${t.flag_emoji} ${t.name}</td>
                    <td class="text-right">
                      <input type="number" step="0.1" min="0.5" class="team-multiplier" value="${t.champion_risk_multiplier}" style="width:60px;text-align:center;border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem;font-family:var(--font)">
                    </td>
                    <td class="text-right" style="color:var(--medium)">
                      ${Math.round(15 * t.champion_risk_multiplier)} pts
                    </td>
                    <td>
                      <button class="btn btn-sm admin-save-multiplier" data-team-id="${t.id}">Guardar</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initAdminTabs() {
  const tabs = document.querySelectorAll('#admin-tabs .tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      document.getElementById('admin-tab-results').style.display = tabName === 'results' ? '' : 'none';
      document.getElementById('admin-tab-rules').style.display = tabName === 'rules' ? '' : 'none';
      document.getElementById('admin-tab-multipliers').style.display = tabName === 'multipliers' ? '' : 'none';
    });
  });
}
