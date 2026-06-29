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

  const prizeParticipants = ['tomas', 'tomás', 'edu', 'danko', 'basti', 'dasu', 'ukid', 'sidkar', 'martin', 'martín'];
  const prizeLeaderboard = leaderboard?.filter(entry => 
    prizeParticipants.includes(entry.name.toLowerCase().trim())
  ) || [];

  const prizeRows = prizeLeaderboard.map((entry, i) => {
    const rank = i + 1;
    const isFirst = rank === 1;
    const isCurrentUser = entry.id === currentUserId;
    
    const nameStyle = isFirst ? 'font-size: 1.2rem; color: var(--primary, #ff007a); font-weight: 700;' : 'font-weight: 600;';
    const pointsStyle = isFirst ? 'font-size: 1.6rem; color: var(--primary, #ff007a); font-weight: 800;' : 'font-size: 1.1rem; font-weight: 600;';
    const rowClass = isCurrentUser ? 'highlight' : '';

    return `
      <tr class="${rowClass}">
        <td class="rank-cell" style="${isFirst ? 'font-size: 1.5rem;' : ''}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</td>
        <td>
          <div class="player-cell">
            <div class="user-avatar" style="background:${entry.avatar_color}; ${isFirst ? 'width: 44px; height: 44px; font-size: 1.2rem;' : ''}">${entry.name.charAt(0)}</div>
            <div style="${nameStyle}">${entry.name}</div>
          </div>
        </td>
        <td class="text-right">
          <span style="${pointsStyle}">${entry.total_points}</span>
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="3" class="text-center" style="padding: 2rem;">No hay datos</td></tr>`;

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

      <div class="page-header" style="margin-top: 3.5rem; text-align: center;">
        <h2>💸 Premio 40.000</h2>
      </div>

      <div class="card" style="max-width: 500px; margin: 0 auto; margin-bottom: 2rem;">
        <div class="table-wrap">
          <table style="width: 100%;">
            <thead>
              <tr>
                <th style="width: 60px;">#</th>
                <th>Jugador</th>
                <th class="text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              ${prizeRows}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
