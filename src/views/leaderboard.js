/**
 * Leaderboard View — Full ranking table with breakdowns
 */
import { supabase } from '../supabase.js';
import { renderPointsChart } from '../components/charts.js';

export async function renderLeaderboard(currentUserId) {
  const { data: leaderboard } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false });

  // Fetch special predictions with team/player names
  const { data: specialPreds } = await supabase
    .from('special_predictions')
    .select('*, champion:teams!special_predictions_champion_team_id_fkey(name, flag_emoji), scorer:players!special_predictions_top_scorer_player_id_fkey(name)');

  const specialMap = {};
  specialPreds?.forEach(sp => { specialMap[sp.user_id] = sp; });

  const rows = leaderboard?.map((entry, i) => {
    const rank = i + 1;
    const isCurrentUser = entry.id === currentUserId;
    const sp = specialMap[entry.id];
    let rankClass = '';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';

    return `
      <tr class="${isCurrentUser ? 'highlight' : ''}">
        <td class="rank-cell ${rankClass}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</td>
        <td>
          <div class="player-cell">
            <div class="user-avatar" style="background:${entry.avatar_color}">${entry.name.charAt(0)}</div>
            <div>
              <div style="font-weight:600">${entry.name}</div>
              <div class="points-breakdown">
                ${sp?.champion?.flag_emoji || ''} ${sp?.champion?.name || '–'} · ${sp?.scorer?.name || '–'}
              </div>
            </div>
          </div>
        </td>
        <td class="text-right">
          <div class="points-breakdown">${entry.group_points}</div>
        </td>
        <td class="text-right">
          <div class="points-breakdown">${entry.knockout_points}</div>
        </td>
        <td class="text-right">
          <div class="points-breakdown">${entry.champion_points + entry.scorer_points}</div>
        </td>
        <td class="text-right">
          <div style="font-size:0.8rem">${entry.exact_scores} exactos · ${entry.correct_winners} ganadores</div>
        </td>
        <td class="text-right">
          <span class="points-big">${entry.total_points}</span>
        </td>
      </tr>
    `;
  }).join('') || '';

  // Top stats
  const leader = leaderboard?.[0];
  const mostExact = leaderboard?.reduce((a, b) => (b.exact_scores > a.exact_scores ? b : a), leaderboard[0]);
  const avgPoints = leaderboard?.length
    ? Math.round(leaderboard.reduce((sum, e) => sum + e.total_points, 0) / leaderboard.length)
    : 0;

  return `
    <div class="container page">
      <div class="page-header">
        <h1>🏆 Tabla de Posiciones</h1>
        <span class="subtitle">Ranking general de la polla</span>
      </div>

      <div class="stat-cards">
        <div class="stat-card">
          <div class="label">Líder</div>
          <div class="value" style="font-size:1.5rem">${leader?.name || '–'}</div>
          <div class="detail">${leader?.total_points || 0} puntos</div>
        </div>
        <div class="stat-card">
          <div class="label">Más Exactos</div>
          <div class="value" style="font-size:1.5rem">${mostExact?.name || '–'}</div>
          <div class="detail">${mostExact?.exact_scores || 0} resultados exactos</div>
        </div>
        <div class="stat-card">
          <div class="label">Promedio</div>
          <div class="value">${avgPoints}</div>
          <div class="detail">puntos promedio</div>
        </div>
        <div class="stat-card">
          <div class="label">Participantes</div>
          <div class="value">${leaderboard?.length || 0}</div>
          <div class="detail">jugadores activos</div>
        </div>
      </div>

      ${renderPointsChart()}

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th class="text-right">Grupos</th>
                <th class="text-right">Eliminat.</th>
                <th class="text-right">Especiales</th>
                <th class="text-right">Aciertos</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
