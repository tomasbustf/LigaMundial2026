/**
 * World Cup View — Groups and knockout bracket
 */
import { supabase } from '../supabase.js';

export async function renderWorldCup() {
  // Fetch all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name');

  // Fetch finished matches with teams
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, name, flag_emoji, group_letter),
      away_team:teams!matches_away_team_id_fkey(id, name, flag_emoji, group_letter)
    `)
    .order('match_number');

  // Build group standings
  const groups = {};
  teams?.forEach(t => {
    if (!t.group_letter) return;
    if (!groups[t.group_letter]) groups[t.group_letter] = [];
    groups[t.group_letter].push({
      ...t,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
    });
  });

  // Calculate standings from finished group matches
  const groupMatches = matches?.filter(m => m.phase === 'Grupos' && m.is_finished) || [];
  groupMatches.forEach(m => {
    if (!m.home_team || !m.away_team) return;
    const gl = m.home_team.group_letter;
    if (!gl || !groups[gl]) return;

    const home = groups[gl].find(t => t.id === m.home_team.id);
    const away = groups[gl].find(t => t.id === m.away_team.id);
    if (!home || !away) {
      // Teams might be in different groups, find them
      const awayGroup = m.away_team.group_letter;
      if (awayGroup && groups[awayGroup]) {
        const awayInGroup = groups[awayGroup].find(t => t.id === m.away_team.id);
        if (awayInGroup) updateStandings(home, awayInGroup, m.home_score, m.away_score);
      }
      return;
    }
    updateStandings(home, away, m.home_score, m.away_score);
  });

  // Sort groups
  Object.keys(groups).forEach(g => {
    groups[g].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  });

  // Knockout matches by phase
  const knockoutPhases = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercer Puesto', 'Final'];
  const knockoutMatches = {};
  knockoutPhases.forEach(phase => {
    knockoutMatches[phase] = matches?.filter(m => m.phase === phase) || [];
  });

  const sortedGroups = Object.keys(groups).sort();

  return `
    <div class="container page">
      <div class="page-header">
        <h1>🌎 Estado del Mundial</h1>
        <span class="subtitle">Grupos y eliminatorias</span>
      </div>

      <div class="tabs" id="worldcup-tabs">
        <button class="tab active" data-tab="groups">Fase de Grupos</button>
        <button class="tab" data-tab="knockout">Eliminatorias</button>
        <button class="tab" data-tab="results">Resultados</button>
      </div>

      <div id="tab-groups">
        <div class="groups-grid">
          ${sortedGroups.map(g => renderGroupCard(g, groups[g])).join('')}
        </div>
      </div>

      <div id="tab-knockout" style="display:none">
        <div class="bracket-container">
          <div class="bracket">
            ${knockoutPhases.filter(p => p !== 'Tercer Puesto').map(phase => renderBracketRound(phase, knockoutMatches[phase])).join('')}
          </div>
        </div>
        ${knockoutMatches['Tercer Puesto']?.length ? `
          <div class="section" style="margin-top:2rem">
            <div class="section-title">🥉 Tercer Puesto</div>
            ${knockoutMatches['Tercer Puesto'].map(m => renderBracketMatch(m)).join('')}
          </div>
        ` : ''}
      </div>

      <div id="tab-results" style="display:none">
        <div class="section-title">📋 Todos los Resultados</div>
        <div class="match-list">
          ${(matches?.filter(m => m.is_finished && m.home_team && m.away_team) || [])
            .reverse()
            .map(m => `
              <div class="match-card finished">
                <div class="match-team">
                  <span class="flag">${m.home_team?.flag_emoji || ''}</span>
                  <span>${m.home_team?.name || 'TBD'}</span>
                </div>
                <div class="match-center">
                  <div class="match-phase">${m.phase} · #${m.match_number}</div>
                  <div class="match-score">
                    <span>${m.home_score}</span>
                    <span class="separator">–</span>
                    <span>${m.away_score}</span>
                  </div>
                </div>
                <div class="match-team away">
                  <span>${m.away_team?.name || 'TBD'}</span>
                  <span class="flag">${m.away_team?.flag_emoji || ''}</span>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateStandings(home, away, hs, as) {
  if (hs === null || as === null) return;
  home.played++;
  away.played++;
  home.gf += hs;
  home.ga += as;
  away.gf += as;
  away.ga += hs;

  if (hs > as) {
    home.won++; home.pts += 3;
    away.lost++;
  } else if (hs < as) {
    away.won++; away.pts += 3;
    home.lost++;
  } else {
    home.drawn++; home.pts += 1;
    away.drawn++; away.pts += 1;
  }
}

function renderGroupCard(letter, teams) {
  return `
    <div class="group-card">
      <div class="group-header">Grupo ${letter}</div>
      <table>
        <thead>
          <tr>
            <th>Equipo</th>
            <th class="text-right">PJ</th>
            <th class="text-right">G</th>
            <th class="text-right">E</th>
            <th class="text-right">P</th>
            <th class="text-right">GF</th>
            <th class="text-right">GC</th>
            <th class="text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${teams.map((t, i) => `
            <tr${i < 2 ? ' style="font-weight:600"' : ''}>
              <td>${t.flag_emoji} ${t.name}</td>
              <td class="text-right">${t.played}</td>
              <td class="text-right">${t.won}</td>
              <td class="text-right">${t.drawn}</td>
              <td class="text-right">${t.lost}</td>
              <td class="text-right">${t.gf}</td>
              <td class="text-right">${t.ga}</td>
              <td class="text-right" style="font-weight:700">${t.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBracketRound(phase, matches) {
  const phaseLabels = {
    'Dieciseisavos': '16avos',
    'Octavos': 'Octavos',
    'Cuartos': 'Cuartos',
    'Semifinal': 'Semis',
    'Final': 'Final'
  };

  return `
    <div class="bracket-round">
      <div class="bracket-round-title">${phaseLabels[phase] || phase}</div>
      ${matches.map(m => renderBracketMatch(m)).join('')}
    </div>
  `;
}

function renderBracketMatch(match) {
  const homeWin = match.is_finished && match.home_score > match.away_score;
  const awayWin = match.is_finished && match.away_score > match.home_score;

  return `
    <div class="bracket-match">
      <div class="bracket-team ${homeWin ? 'winner' : ''}">
        <span>${match.home_team?.flag_emoji || ''} ${match.home_team?.name || 'TBD'}</span>
        <span class="score">${match.is_finished ? match.home_score : '–'}</span>
      </div>
      <div class="bracket-team ${awayWin ? 'winner' : ''}">
        <span>${match.away_team?.flag_emoji || ''} ${match.away_team?.name || 'TBD'}</span>
        <span class="score">${match.is_finished ? match.away_score : '–'}</span>
      </div>
    </div>
  `;
}

export function initWorldCupTabs() {
  const tabs = document.querySelectorAll('#worldcup-tabs .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      document.getElementById('tab-groups').style.display = tabName === 'groups' ? '' : 'none';
      document.getElementById('tab-knockout').style.display = tabName === 'knockout' ? '' : 'none';
      document.getElementById('tab-results').style.display = tabName === 'results' ? '' : 'none';
    });
  });
}
