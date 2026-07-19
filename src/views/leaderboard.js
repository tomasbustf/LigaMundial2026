/**
 * Leaderboard View — Full ranking table with breakdowns
 */
import { supabase } from '../supabase.js';
import { renderPointsChart } from '../components/charts.js';

export async function renderLeaderboard(currentUserId) {
  const { data: fetchedLeaderboard } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false });

  const leaderboard = fetchedLeaderboard?.filter(u => !u.name.toLowerCase().includes('mati') && !u.name.toLowerCase().includes('efra')) || [];

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

      <div class="page-header" style="margin-top: 3.5rem; text-align: center;">
        <h2>⚽ Tabla de Goleadores</h2>
        <span class="subtitle">Máximos anotadores del Mundial 2026 · El goleador otorga <strong>10 pts</strong> bonus</span>
      </div>

      ${renderTopScorers(specialMap, leaderboard)}

    </div>
  `;
}

/**
 * Renders the top scorers table for the World Cup
 * Shows real tournament scorers and which participants predicted them
 */
function renderTopScorers(specialMap, leaderboard) {
  const scorers = [
    { name: 'Kylian Mbappé', country: 'Francia', flag: '🇫🇷', goals: 10 },
    { name: 'Lionel Messi', country: 'Argentina', flag: '🇦🇷', goals: 8 },
    { name: 'Jude Bellingham', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', goals: 7 },
    { name: 'Erling Haaland', country: 'Noruega', flag: '🇳🇴', goals: 7 },
    { name: 'Ousmane Dembélé', country: 'Francia', flag: '🇫🇷', goals: 6 },
    { name: 'Harry Kane', country: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', goals: 6 },
    { name: 'Mikel Oyarzabal', country: 'España', flag: '🇪🇸', goals: 5 },
  ];

  // Map who predicted which scorer (normalize names for matching)
  const normalize = (n) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const scorerRows = scorers.map((s, i) => {
    const rank = i + 1;
    const isLeader = rank === 1;

    // Find which participants predicted this scorer
    const predictedBy = [];
    const scorerLastName = s.name.split(' ').pop();
    for (const entry of leaderboard) {
      const sp = specialMap[entry.id];
      if (sp?.scorer?.name && normalize(sp.scorer.name).includes(normalize(scorerLastName))) {
        predictedBy.push(entry.name);
      }
    }

    const predictedBadges = predictedBy.length > 0
      ? predictedBy.map(name => `<span style="display:inline-block; background: ${isLeader ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.1)'}; color: ${isLeader ? '#16a34a' : '#6366f1'}; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; margin: 0.1rem;">${name}</span>`).join(' ')
      : '<span style="color: var(--light); font-size: 0.75rem;">—</span>';

    const rowStyle = isLeader
      ? 'background: linear-gradient(90deg, rgba(250,204,21,0.08) 0%, rgba(250,204,21,0.02) 100%);'
      : '';

    const goalsBar = `<div style="display:flex; align-items:center; gap:0.5rem;">
      <div style="background: ${isLeader ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'var(--primary)'}; height: 6px; border-radius: 3px; width: ${(s.goals / scorers[0].goals) * 100}%; min-width: 8px; transition: width 0.3s;"></div>
      <span style="font-weight: 700; font-size: 0.9rem; ${isLeader ? 'color: #d97706;' : ''}">${s.goals}</span>
    </div>`;

    return `
      <tr style="${rowStyle}">
        <td class="rank-cell" style="${isLeader ? 'font-size:1.2rem;' : ''}">
          ${isLeader ? '👑' : rank}
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.2rem;">${s.flag}</span>
            <div>
              <div style="font-weight:600; ${isLeader ? 'font-size:1.05rem;' : ''}">${s.name}</div>
              <div style="font-size:0.7rem; color:var(--light);">${s.country}</div>
            </div>
          </div>
        </td>
        <td style="min-width: 120px;">
          ${goalsBar}
        </td>
        <td style="text-align:center;">
          ${predictedBadges}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="card" style="max-width: 700px; margin: 0 auto; margin-bottom: 2rem;">
      <div class="table-wrap">
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Jugador</th>
              <th>Goles</th>
              <th style="text-align:center;">¿Quién lo eligió?</th>
            </tr>
          </thead>
          <tbody>
            ${scorerRows}
          </tbody>
        </table>
      </div>
      <div style="text-align:center; padding: 0.75rem 1rem; border-top: 1px solid var(--border); font-size: 0.78rem; color: var(--light);">
        🏅 El que acierte al goleador del torneo suma <strong style="color: var(--dark);">+10 puntos</strong> bonus
      </div>
    </div>
  `;
}
