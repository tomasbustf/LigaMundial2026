/**
 * Points Evolution Chart — Line chart showing cumulative points per finished match
 * Each x-axis tick = one finished match (ordered by match_number)
 * Shows how rankings shift match by match
 */
import { supabase } from '../supabase.js';
import { calculatePoints } from '../scoring.js';

/**
 * Renders the HTML container for the chart canvas
 */
export function renderPointsChart() {
  return `
    <div class="card chart-card">
      <div class="card-header">
        <h3>📈 Evolución de Puntos</h3>
        <span class="subtitle" style="font-size: 0.75rem; color: var(--light);">Acumulado partido a partido</span>
      </div>
      <div class="chart-container">
        <canvas id="points-evolution-chart"></canvas>
      </div>
    </div>
  `;
}

/**
 * Initializes the Chart.js line chart with data from Supabase
 * X-axis: each finished match individually (ordered by match_number)
 * Y-axis: cumulative points
 */
export async function initPointsChart() {
  const canvas = document.getElementById('points-evolution-chart');
  if (!canvas) return;

  // Fetch users
  const { data: users } = await supabase
    .from('users')
    .select('id, name, avatar_color')
    .order('name');

  if (!users || users.length === 0) return;

  // Custom sort: Tomas & Ukid first, ChatGPT & Simon last
  users.sort((a, b) => {
    const getPrio = (name) => {
      const n = name.toLowerCase();
      if (n.includes('tomás') || n.includes('tomas')) return 1;
      if (n.includes('ukid')) return 2;
      if (n.includes('simón') || n.includes('simon')) return 100;
      if (n.includes('chat gpt')) return 101;
      return 50;
    };
    const pA = getPrio(a.name);
    const pB = getPrio(b.name);
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  // Fetch finished matches with team info (ordered by match_number)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, match_number, phase, group_stage_round, home_score, away_score, status, mode, advancing_team_id, home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
      away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
    `)
    .eq('status', 'terminado')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('match_number', { ascending: true });

  if (!matches || matches.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('No hay partidos terminados aún', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Fetch all predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('user_id, match_id, home_score, away_score, mode, advancing_team_id');

  const predMap = {};
  predictions?.forEach(p => {
    if (!predMap[p.match_id]) predMap[p.match_id] = {};
    predMap[p.match_id][p.user_id] = p;
  });

  // Build x-axis labels: short match descriptions
  // e.g. "🇲🇽 vs 🇿🇦" or "#1 MEX-RSA"
  const labels = matches.map(m => {
    const home = m.home_team?.flag_emoji || '?';
    const away = m.away_team?.flag_emoji || '?';
    return `${home} vs ${away}`;
  });

  // Build cumulative points per user, match by match
  const datasets = users.map(user => {
    let cumulative = 0;
    const dataPoints = matches.map(m => {
      const pred = predMap[m.id]?.[user.id];
      if (pred && pred.home_score !== null && pred.away_score !== null) {
        cumulative += calculatePoints(
          pred.home_score, pred.away_score,
          m.home_score, m.away_score,
          m.phase,
          pred.mode, m.mode,
          pred.advancing_team_id, m.advancing_team_id,
          m.home_team_id, m.away_team_id
        );
      }
      return cumulative;
    });

    return {
      label: user.name,
      data: dataPoints,
      borderColor: user.avatar_color,
      backgroundColor: user.avatar_color + '18',
      borderWidth: 2.5,
      pointRadius: matches.length > 30 ? 2 : 4,
      pointHoverRadius: 7,
      pointBackgroundColor: user.avatar_color,
      pointBorderColor: '#fff',
      pointBorderWidth: matches.length > 30 ? 1 : 2,
      tension: 0.25,
      fill: false,
    };
  });

  // Create Chart.js chart
  const ctx = canvas.getContext('2d');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: {
              family: "'Inter', sans-serif",
              size: 11,
              weight: '500',
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(17, 17, 17, 0.92)',
          titleFont: {
            family: "'Inter', sans-serif",
            size: 13,
            weight: '600',
          },
          bodyFont: {
            family: "'Inter', sans-serif",
            size: 12,
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            // Show match details in tooltip title
            title: function(tooltipItems) {
              const idx = tooltipItems[0].dataIndex;
              const m = matches[idx];
              const homeName = m.home_team?.name || '?';
              const awayName = m.away_team?.name || '?';
              const homeFlag = m.home_team?.flag_emoji || '';
              const awayFlag = m.away_team?.flag_emoji || '';
              return `#${m.match_number} · ${homeFlag} ${homeName} ${m.home_score}-${m.away_score} ${awayName} ${awayFlag}`;
            },
            label: function(context) {
              // Show points and position delta
              const userIdx = context.datasetIndex;
              const matchIdx = context.dataIndex;
              const pts = context.parsed.y;

              // Compute rank at this match
              const allPtsAtMatch = datasets.map(d => d.data[matchIdx]);
              const sorted = [...allPtsAtMatch].sort((a, b) => b - a);
              const rank = sorted.indexOf(pts) + 1;

              return `  ${context.dataset.label}: ${pts} pts  (#${rank})`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 11,
            },
            color: '#666',
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: matches.length > 30 ? 20 : matches.length,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 11,
            },
            color: '#999',
            stepSize: 5,
          },
          title: {
            display: true,
            text: 'Puntos Acumulados',
            font: {
              family: "'Inter', sans-serif",
              size: 12,
              weight: '600',
            },
            color: '#999',
          },
        },
      },
      animation: {
        duration: 1200,
        easing: 'easeInOutQuart',
      },
    },
  });
}
