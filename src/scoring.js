/**
 * Scoring Engine for Liga Polla Mundial 2026
 * Calculates points based on predictions vs real results
 */

const PHASE_MULTIPLIERS = {
  'Grupos': 1.0,
  'Dieciseisavos': 1.0,
  'Octavos': 1.5,
  'Cuartos': 2.0,
  'Semifinal': 3.0,
  'Tercer Puesto': 1.0,
  'Final': 5.0,
};

const BASE_POINTS = {
  correct_winner: 2,
  exact_score: 5,
};

export function calculatePoints(predHome, predAway, realHome, realAway, phase, predMode = null, realMode = null, predAdvancingId = null, realAdvancingId = null) {
  if (realHome === null || realAway === null) return 0;

  const multiplier = PHASE_MULTIPLIERS[phase] || 1.0;
  const isKnockout = phase !== 'Grupos';
  let pts = 0;

  const getWinner = (h, a, adv) => {
    if (h > a) return 'H';
    if (h < a) return 'A';
    return isKnockout ? (adv || 'D') : 'D';
  };

  const predWinner = getWinner(predHome, predAway, predAdvancingId);
  const realWinner = getWinner(realHome, realAway, realAdvancingId);

  if (predWinner === realWinner) {
    pts += BASE_POINTS.correct_winner; // 2 pts
    if (predHome === realHome && predAway === realAway) {
      pts += (BASE_POINTS.exact_score - BASE_POINTS.correct_winner); // +3 pts
      
      if (isKnockout && predMode && predMode === realMode) {
        pts += 2; // +2 pts
      }
    }
  }

  return Math.floor(pts * multiplier);
}

/**
 * Get the point type description
 */
export function getPointType(points, phase) {
  if (points === 0) return 'miss';
  const multiplier = PHASE_MULTIPLIERS[phase] || 1.0;
  
  const p7 = Math.floor(7 * multiplier);
  const p5 = Math.floor(BASE_POINTS.exact_score * multiplier);
  
  if (points === p5 || points === p7) return 'exact';
  return 'winner';
}

export { PHASE_MULTIPLIERS, BASE_POINTS };
