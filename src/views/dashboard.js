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

    </div>
  `;
}

