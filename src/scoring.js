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

/**
 * Calculate points for a single prediction
 */
export function calculatePoints(predHome, predAway, realHome, realAway, phase) {
  if (realHome === null || realAway === null) return 0;

  const multiplier = PHASE_MULTIPLIERS[phase] || 1.0;

  // Exact match
  if (predHome === realHome && predAway === realAway) {
    return Math.floor(BASE_POINTS.exact_score * multiplier);
  }

  // Correct winner/draw
  const predResult = getResult(predHome, predAway);
  const realResult = getResult(realHome, realAway);

  if (predResult === realResult) {
    return Math.floor(BASE_POINTS.correct_winner * multiplier);
  }

  return 0;
}

function getResult(home, away) {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

/**
 * Get the point type description
 */
export function getPointType(points, phase) {
  if (points === 0) return 'miss';
  const multiplier = PHASE_MULTIPLIERS[phase] || 1.0;
  const exactPts = Math.floor(BASE_POINTS.exact_score * multiplier);
  if (points === exactPts) return 'exact';
  return 'winner';
}

export { PHASE_MULTIPLIERS, BASE_POINTS };
