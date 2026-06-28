/**
 * Vista General — Matrix view of all participants and predictions
 * Supports 3 match states: por_jugar, en_juego, terminado
 * Color coding: Red (miss), Yellow (correct winner), Green (exact score)
 */
import { supabase } from '../supabase.js';
import { calculatePoints, getPointType } from '../scoring.js';

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
    .select('user_id, match_id, home_score, away_score, points_earned, mode');

  // Create lookup dictionary predMap[matchId][userId]
  const predMap = {};
  predictions?.forEach(p => {
    if (!predMap[p.match_id]) predMap[p.match_id] = {};
    predMap[p.match_id][p.user_id] = p;
  });

  // Helper: get status config
  function getStatusConfig(status) {
    switch (status) {
      case 'en_juego':
        return {
          label: '🔴 En Juego',
          cssClass: 'status-en-juego',
          nextStatus: 'terminado',
        };
      case 'terminado':
        return {
          label: '✅ Terminado',
          cssClass: 'status-terminado',
          nextStatus: 'por_jugar',
        };
      default: // por_jugar
        return {
          label: '⏳ Por Jugar',
          cssClass: 'status-por-jugar',
          nextStatus: 'en_juego',
        };
    }
  }

  // Helper: compute live points for a prediction against current match score
  function computeLivePoints(pred, match) {
    if (!pred || pred.home_score === null || pred.away_score === null) return null;
    if (match.home_score === null || match.away_score === null) return null;
    return calculatePoints(pred.home_score, pred.away_score, match.home_score, match.away_score, match.phase, pred.mode, match.mode);
  }

  // Helper: determine color badge style for a prediction cell
  function getPredCellStyle(match, pred) {
    const status = match.status || 'por_jugar';
    
    // Only color-code for en_juego or terminado when scores exist
    if (status === 'por_jugar') return '';
    if (!pred || pred.home_score === null || pred.away_score === null) return '';
    if (match.home_score === null || match.away_score === null) return '';

    const pts = calculatePoints(pred.home_score, pred.away_score, match.home_score, match.away_score, match.phase, pred.mode, match.mode);
    const pointType = getPointType(pts, match.phase);
    
    if (pointType === 'exact') return 'pred-exact';      // Green
    if (pointType === 'winner') return 'pred-winner';     // Yellow
    return 'pred-miss';                                    // Red
  }

  const isPredDisabled = (status) => status === 'en_juego' || status === 'terminado';
  const isRealDisabled = (status) => status === 'terminado';

  const groupMatches = matches.filter(m => m.phase === 'Grupos');
  const knockoutMatches = matches.filter(m => m.phase !== 'Grupos');

  function renderTableRows(matchList, isKnockout = false) {
    return matchList.map(m => {
      const isDefined = m.home_team && m.away_team;
      if (!isDefined) return '';

      const status = m.status || 'por_jugar';
      const statusCfg = getStatusConfig(status);
      const predLocked = isPredDisabled(status);
      const realLocked = isRealDisabled(status);
      
      let realModeSelect = '';
      if (isKnockout) {
        realModeSelect = `
          <select class="gen-real-mode" data-match-id="${m.id}" ${realLocked ? 'disabled' : ''} style="font-size:0.7rem; width:100%; margin-top:4px; padding:2px; border:1px solid #ccc; border-radius:4px; background:rgba(255,255,255,0.8);">
            <option value="">Modo...</option>
            <option value="90 minutos" ${m.mode === '90 minutos' ? 'selected' : ''}>90 mins</option>
            <option value="Alargue" ${m.mode === 'Alargue' ? 'selected' : ''}>Alargue</option>
            <option value="Penales" ${m.mode === 'Penales' ? 'selected' : ''}>Penales</option>
          </select>
        `;
      }
      
      return `
        <tr class="match-row-${status}">
          <td style="position: sticky; left: 0; background: var(--white); z-index: 10; border-right: 1px solid var(--border);">
            <div style="display:flex; flex-direction:column; gap: 0.2rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.65rem; color:var(--light); font-weight:600; letter-spacing:0.05em;">#${m.match_number} · ${m.group_stage_round || m.phase}</span>
                <button class="btn-cycle-status ${statusCfg.cssClass}" data-match-id="${m.id}" data-status="${status}" style="background:none; border:none; cursor:pointer; padding:0; opacity:0.9; transition:opacity 0.2s;" title="Cambiar estado del partido">
                  <span class="match-status-badge ${statusCfg.cssClass}">${statusCfg.label}</span>
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
            <div style="display:flex; flex-direction:column; align-items:center;">
              <div style="display:flex; justify-content:center; gap:0.2rem;">
                <input type="number" min="0" class="gen-real-input" data-match-id="${m.id}" data-team="home" value="${m.home_score !== null ? m.home_score : ''}" placeholder="-" ${realLocked ? 'disabled' : ''} style="width:28px; height:24px; text-align:center; font-weight:700; font-size:0.85rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.8); outline:none; transition:all 0.2s; ${realLocked ? 'opacity:0.6; cursor:not-allowed;' : ''}">
                <span style="display:flex; align-items:center; font-weight:700;">-</span>
                <input type="number" min="0" class="gen-real-input" data-match-id="${m.id}" data-team="away" value="${m.away_score !== null ? m.away_score : ''}" placeholder="-" ${realLocked ? 'disabled' : ''} style="width:28px; height:24px; text-align:center; font-weight:700; font-size:0.85rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.8); outline:none; transition:all 0.2s; ${realLocked ? 'opacity:0.6; cursor:not-allowed;' : ''}">
              </div>
              ${realModeSelect}
            </div>
          </td>
          ${users.map(u => {
            const p = predMap[m.id]?.[u.id];
            const cellClass = getPredCellStyle(m, p);
            
            let pointsDisplay = '';
            if ((status === 'en_juego' || status === 'terminado') && p) {
              const pts = computeLivePoints(p, m);
              if (pts !== null && pts > 0) {
                pointsDisplay = `<div style="font-size:0.6rem; margin-top:0.15rem; color:var(--medium);">+${pts} pts</div>`;
              }
            }

            let predModeSelect = '';
            if (isKnockout) {
              predModeSelect = `
                <select class="gen-pred-mode" data-match-id="${m.id}" data-user-id="${u.id}" ${predLocked ? 'disabled' : ''} style="font-size:0.65rem; width:100%; margin-top:4px; padding:2px; border:1px solid #ccc; border-radius:4px; background:rgba(255,255,255,0.5);">
                  <option value="">Modo...</option>
                  <option value="90 minutos" ${p?.mode === '90 minutos' ? 'selected' : ''}>90 mins</option>
                  <option value="Alargue" ${p?.mode === 'Alargue' ? 'selected' : ''}>Alargue</option>
                  <option value="Penales" ${p?.mode === 'Penales' ? 'selected' : ''}>Penales</option>
                </select>
              `;
            }

            return `
              <td style="text-align: center;">
                <div class="pred-cell ${cellClass}" style="display:flex; flex-direction:column; align-items:center; padding: 0.25rem;">
                  <div style="display:flex; justify-content:center; gap:0.2rem;">
                    <input type="number" min="0" class="gen-pred-input" data-match-id="${m.id}" data-user-id="${u.id}" data-team="home" value="${p ? p.home_score : ''}" ${predLocked ? 'disabled' : ''} style="width:28px; height:24px; text-align:center; font-size:0.8rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.5); outline:none; transition:all 0.2s; ${predLocked ? 'opacity:0.7; cursor:not-allowed;' : ''}">
                    <span style="display:flex; align-items:center;">-</span>
                    <input type="number" min="0" class="gen-pred-input" data-match-id="${m.id}" data-user-id="${u.id}" data-team="away" value="${p ? p.away_score : ''}" ${predLocked ? 'disabled' : ''} style="width:28px; height:24px; text-align:center; font-size:0.8rem; border:1px solid transparent; border-radius:4px; background:rgba(255,255,255,0.5); outline:none; transition:all 0.2s; ${predLocked ? 'opacity:0.7; cursor:not-allowed;' : ''}">
                  </div>
                  ${predModeSelect}
                </div>
                ${pointsDisplay}
              </td>
            `;
          }).join('')}
        </tr>
      `;
    }).join('');
  }

  return `
    <div class="container page" style="max-width: 98%;">
      <div class="page-header">
        <h1>📊 Vista General</h1>
        <span class="subtitle">Todas las predicciones al estilo Excel</span>
      </div>

      <div class="tabs" id="general-tabs" style="margin-bottom: 1rem;">
        <button class="tab active" data-tab="grupos">Fase de Grupos</button>
        <button class="tab" data-tab="eliminatorias">Fase Eliminatoria</button>
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
            <tbody id="gen-tbody-grupos">
              ${renderTableRows(groupMatches, false)}
            </tbody>
            <tbody id="gen-tbody-eliminatorias" style="display:none;">
              ${renderTableRows(knockoutMatches, true)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function bindGeneralEvents() {
  document.querySelectorAll('#general-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#general-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('gen-tbody-grupos').style.display = tabName === 'grupos' ? '' : 'none';
      document.getElementById('gen-tbody-eliminatorias').style.display = tabName === 'eliminatorias' ? '' : 'none';
    });
  });

  const savePrediction = async (userId, matchId, homeScore, awayScore, mode) => {
    if (isNaN(homeScore) || isNaN(awayScore)) return null;
    
    // Validaciones
    if (homeScore !== awayScore && mode !== '90 minutos' && mode !== null) {
      // If someone chooses Alargue/Penales but scores are different, 
      // let's force mode to '90 minutos' or just save it but it's invalid according to rules.
      // But we just save it.
    }

    const payload = {
      user_id: userId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
    };
    if (mode !== undefined && mode !== null) {
      payload.mode = mode;
    }

    return await supabase
      .from('predictions')
      .upsert(payload, { onConflict: 'user_id,match_id' });
  };

  const getRowInputs = (e, prefix) => {
    const row = e.target.closest('td');
    const homeInput = row.querySelector('[data-team="home"]');
    const awayInput = row.querySelector('[data-team="away"]');
    const modeSelect = row.querySelector('.' + prefix + '-mode');
    return { homeInput, awayInput, modeSelect };
  };


  // Prediction inputs
  document.querySelectorAll('.gen-pred-input:not([disabled]), .gen-pred-mode:not([disabled])').forEach(input => {
    input.addEventListener('change', async (e) => {
      const matchId = parseInt(e.target.dataset.matchId);
      const userId = e.target.dataset.userId;
      
      const { homeInput, awayInput, modeSelect } = getRowInputs(e, 'gen-pred');
      const homeScore = parseInt(homeInput.value);
      const awayScore = parseInt(awayInput.value);
      const mode = modeSelect ? modeSelect.value : null;
      
      if (isNaN(homeScore) || isNaN(awayScore)) return;
      if (modeSelect && mode === "") return;
      
      const { error } = await savePrediction(userId, matchId, homeScore, awayScore, mode);
      if (!error) {
        homeInput.style.background = '#dcfce7'; 
        awayInput.style.background = '#dcfce7';
        if (modeSelect) modeSelect.style.background = '#dcfce7';
        setTimeout(() => {
          homeInput.style.background = 'rgba(255,255,255,0.5)';
          awayInput.style.background = 'rgba(255,255,255,0.5)';
          if (modeSelect) modeSelect.style.background = 'rgba(255,255,255,0.5)';
        }, 800);
      }
    });
  });

  // Real score inputs
  document.querySelectorAll('.gen-real-input:not([disabled]), .gen-real-mode:not([disabled])').forEach(input => {
    input.addEventListener('change', async (e) => {
      const matchId = parseInt(e.target.dataset.matchId);
      const { homeInput, awayInput, modeSelect } = getRowInputs(e, 'gen-real');
      
      const homeScore = parseInt(homeInput.value);
      const awayScore = parseInt(awayInput.value);
      const mode = modeSelect ? modeSelect.value : null;
      
      const isComplete = !isNaN(homeScore) && !isNaN(awayScore);
      
      const updateData = {
        home_score: isComplete ? homeScore : null,
        away_score: isComplete ? awayScore : null,
      };
      if (modeSelect) {
        updateData.mode = mode || null;
      }
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);
        
      if (!error) {
        homeInput.style.background = '#fef3c7'; 
        awayInput.style.background = '#fef3c7';
        if (modeSelect) modeSelect.style.background = '#fef3c7';
        setTimeout(() => {
          homeInput.style.background = 'rgba(255,255,255,0.8)';
          awayInput.style.background = 'rgba(255,255,255,0.8)';
          if (modeSelect) modeSelect.style.background = 'rgba(255,255,255,0.8)';
        }, 800);
      }
    });
  });

  // Cycle status
  // Cycle status
  document.querySelectorAll('.btn-cycle-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const matchId = parseInt(button.dataset.matchId);
      const currentStatus = button.dataset.status;
      
      const statusCycle = {
        'por_jugar': 'en_juego',
        'en_juego': 'terminado',
        'terminado': 'por_jugar',
      };
      const newStatus = statusCycle[currentStatus] || 'por_jugar';

      // Also update is_finished for backwards compatibility
      const isFinished = newStatus === 'terminado';
      
      button.style.opacity = '0.5';
      button.style.pointerEvents = 'none';

      const { error } = await supabase
        .from('matches')
        .update({ status: newStatus, is_finished: isFinished })
        .eq('id', matchId);

      if (!error) {
        // Recalculate points and refresh
        const recalcBtn = document.getElementById('nav-recalculate');
        if (recalcBtn) {
          recalcBtn.click();
        } else {
          window.dispatchEvent(new CustomEvent('polla:recalc'));
        }
      } else {
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }
    });
  });
}
