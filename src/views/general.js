/**
 * Vista General — Matrix view of all participants and predictions
 */
import { supabase } from '../supabase.js';

export async function renderGeneral() {
  const { data: fetchedUsers } = await supabase
    .from('users')
    .select('id, name, avatar_color')
    .order('name');

  if (!fetchedUsers || fetchedUsers.length === 0) return `<div class="container page">Sin usuarios</div>`;

  // Custom sort: Tomas & Ukid first, ChatGPT & Simon last
  const users = fetchedUsers.sort((a, b) => {
    const getPrio = (name) => {
      const n = name.toLowerCase();
      if (n.includes('tomás') || n.includes('tomas')) return 1;
      if (n.includes('ukid')) return 2;
      if (n.includes('simón') || n.includes('simon')) return 100;
      if (n.includes('chat gpt')) return 101;
      return 50; // Others in the middle
    };
    const pA = getPrio(a.name);
    const pB = getPrio(b.name);
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  // Fetch all matches
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
      away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
    `)
    .order('match_number', { ascending: true });

  // Fetch all predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('user_id, match_id, home_score, away_score, points_earned');

  // Create lookup dictionary predMap[matchId][userId]
  const predMap = {};
  predictions?.forEach(p => {
    if (!predMap[p.match_id]) predMap[p.match_id] = {};
    predMap[p.match_id][p.user_id] = p;
  });

  return `
    <div class="container page" style="max-width: 98%;">
      <div class="page-header">
        <h1>📊 Vista General</h1>
        <span class="subtitle">Todas las predicciones al estilo Excel</span>
      </div>
      
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-wrap" style="max-height: 80vh; overflow-y: auto; position: relative;">
          <table class="general-table">
            <thead>
              <tr>
                <th style="min-width: 250px; position: sticky; top: 0; left: 0; background: var(--bg-subtle); z-index: 30; box-shadow: 1px 1px 0 var(--border);">Partido</th>
                <th style="min-width: 80px; text-align: center; position: sticky; top: 0; background: var(--bg-subtle); z-index: 20; box-shadow: 0 1px 0 var(--border);">Real</th>
                ${users.map(u => `
                  <th style="text-align: center; min-width: 80px; position: sticky; top: 0; background: var(--bg-subtle); z-index: 20; box-shadow: 0 1px 0 var(--border);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
                      <div class="user-avatar" style="background:${u.avatar_color}; width:24px; height:24px; font-size:0.6rem;">${u.name.charAt(0)}</div>
                      <span style="font-size: 0.7rem; font-weight: 600;">${u.name}</span>
                    </div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${matches.map(m => {
                const isDefined = m.home_team && m.away_team;
                if (!isDefined) return '';

                const realScore = m.is_finished ? `${m.home_score} - ${m.away_score}` : '-';
                
                return `
                  <tr>
                    <td style="position: sticky; left: 0; background: var(--white); z-index: 10; border-right: 1px solid var(--border);">
                      <div style="display:flex; flex-direction:column; gap: 0.2rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                          <span style="font-size:0.65rem; color:var(--light); font-weight:600; letter-spacing:0.05em;">#${m.match_number} · ${m.group_stage_round || m.phase}</span>
                          <button class="btn-toggle-finish" data-match-id="${m.id}" data-finished="${m.is_finished}" style="background:none; border:none; cursor:pointer; padding:0; opacity:0.8; transition:opacity 0.2s;" title="Cambiar estado del partido">
                            ${m.is_finished 
                              ? `<span style="font-size:0.65rem; color:#166534; background:#dcfce7; padding:2px 6px; border-radius:10px; font-weight:bold;">✅ Terminado</span>`
                              : `<span style="font-size:0.65rem; color:var(--light); background:var(--bg-subtle); padding:2px 6px; border-radius:10px; font-weight:bold;">⏳ En juego</span>`
                            }
                          </button>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem; font-weight:500;">
                          <span style="text-align:right; flex:1;">${m.home_team.name} <span class="flag">${m.home_team.flag_emoji}</span></span>
                          <span style="padding: 0 0.5rem; color: var(--light);">vs</span>
                          <span style="flex:1;"><span class="flag">${m.away_team.flag_emoji}</span> ${m.away_team.name}</span>
                        </div>
                      </div>
                    </td>
                    <td style="text-align: center; background: var(--bg-subtle);">
                      <div style="display:flex; justify-content:center; gap:0.2rem;">
                        <input type="number" min="0" class="gen-real-input" data-match-id="${m.id}" data-team="home" value="${m.home_score !== null ? m.home_score : ''}" placeholder="-" style="width:28px; height:24px; text-align:center; font-weight:700; font-size:0.85rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.8); outline:none; transition:all 0.2s;">
                        <span style="display:flex; align-items:center; font-weight:700;">-</span>
                        <input type="number" min="0" class="gen-real-input" data-match-id="${m.id}" data-team="away" value="${m.away_score !== null ? m.away_score : ''}" placeholder="-" style="width:28px; height:24px; text-align:center; font-weight:700; font-size:0.85rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.8); outline:none; transition:all 0.2s;">
                      </div>
                    </td>
                    ${users.map(u => {
                      const p = predMap[m.id]?.[u.id];
                      let badgeStyle = '';
                      if (m.is_finished && p && p.points_earned !== undefined) {
                        if (p.points_earned >= 5) badgeStyle = 'background: #dcfce7; color: #166534; font-weight:700; border-radius: 4px;'; // Exacto (Verde)
                        else if (p.points_earned > 0) badgeStyle = 'background: #fef3c7; color: #92400e; font-weight:600; border-radius: 4px;'; // Ganador (Amarillo)
                        else badgeStyle = 'color: var(--light);'; // Nada
                      }

                      return `
                        <td style="text-align: center;">
                          <div style="display:flex; justify-content:center; gap:0.2rem; padding: 0.25rem; ${badgeStyle}">
                            <input type="number" min="0" class="gen-pred-input" data-match-id="${m.id}" data-user-id="${u.id}" data-team="home" value="${p ? p.home_score : ''}" style="width:28px; height:24px; text-align:center; font-size:0.8rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.5); outline:none; transition:all 0.2s;">
                            <span style="display:flex; align-items:center;">-</span>
                            <input type="number" min="0" class="gen-pred-input" data-match-id="${m.id}" data-user-id="${u.id}" data-team="away" value="${p ? p.away_score : ''}" style="width:28px; height:24px; text-align:center; font-size:0.8rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.5); outline:none; transition:all 0.2s;">
                          </div>
                          ${m.is_finished && p && p.points_earned > 0 ? `<div style="font-size:0.6rem; margin-top:0.15rem; color:var(--medium);">+${p.points_earned} pts</div>` : ''}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function bindGeneralEvents() {
  document.querySelectorAll('.gen-pred-input').forEach(input => {
    input.addEventListener('focus', (e) => {
      e.target.style.border = '1px solid var(--black)';
      e.target.style.background = 'var(--white)';
    });
    
    input.addEventListener('blur', (e) => {
      e.target.style.border = '1px solid transparent';
      e.target.style.background = 'rgba(255,255,255,0.5)';
    });

    input.addEventListener('change', async (e) => {
      const matchId = parseInt(e.target.dataset.matchId);
      const userId = e.target.dataset.userId;
      
      const row = e.target.closest('td');
      const homeInput = row.querySelector('[data-team="home"]');
      const awayInput = row.querySelector('[data-team="away"]');
      
      const homeScore = parseInt(homeInput.value);
      const awayScore = parseInt(awayInput.value);
      
      if (isNaN(homeScore) || isNaN(awayScore)) {
        return; // wait until both are filled
      }
      
      const { error } = await supabase
        .from('predictions')
        .upsert({
          user_id: userId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
        }, { onConflict: 'user_id,match_id' });
        
      if (!error) {
        homeInput.style.background = '#dcfce7'; // green flash
        awayInput.style.background = '#dcfce7';
        setTimeout(() => {
          homeInput.style.background = 'rgba(255,255,255,0.5)';
          awayInput.style.background = 'rgba(255,255,255,0.5)';
        }, 800);
      }
    });
  });
  document.querySelectorAll('.gen-real-input').forEach(input => {
    input.addEventListener('focus', (e) => {
      e.target.style.border = '1px solid var(--black)';
      e.target.style.background = 'var(--white)';
    });
    
    input.addEventListener('blur', (e) => {
      e.target.style.border = '1px solid transparent';
      e.target.style.background = 'rgba(255,255,255,0.8)';
    });

    input.addEventListener('change', async (e) => {
      const matchId = parseInt(e.target.dataset.matchId);
      const row = e.target.closest('td');
      const homeInput = row.querySelector('[data-team="home"]');
      const awayInput = row.querySelector('[data-team="away"]');
      
      const homeScore = parseInt(homeInput.value);
      const awayScore = parseInt(awayInput.value);
      
      const isComplete = !isNaN(homeScore) && !isNaN(awayScore);
      
      // Update the match in supabase
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: isComplete ? homeScore : null,
          away_score: isComplete ? awayScore : null,
          is_finished: false // Keep it false so it stays editable, or user can toggle later
        })
        .eq('id', matchId);
        
      if (!error) {
        homeInput.style.background = '#fef3c7'; // yellow flash
        awayInput.style.background = '#fef3c7';
        setTimeout(() => {
          homeInput.style.background = 'rgba(255,255,255,0.8)';
          awayInput.style.background = 'rgba(255,255,255,0.8)';
        }, 800);
      }
    });
  });

  // Toggle finish state
  document.querySelectorAll('.btn-toggle-finish').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const matchId = parseInt(button.dataset.matchId);
      const isFinished = button.dataset.finished === 'true';
      const newState = !isFinished;
      
      button.style.opacity = '0.5';
      button.style.pointerEvents = 'none';

      const { error } = await supabase
        .from('matches')
        .update({ is_finished: newState })
        .eq('id', matchId);

      if (!error) {
        // Trigger a global refresh so points update properly with the new state
        window.dispatchEvent(new CustomEvent('polla:recalc'));
        // Or simply trigger a render if the window event isn't hooked up, but let's click the recalc button programmatically
        const recalcBtn = document.getElementById('nav-recalculate');
        if (recalcBtn) {
          recalcBtn.click();
        }
      } else {
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }
    });
  });
}
