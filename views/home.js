import { getSRSQueues, getConceptCounts, getRecentSessions } from '../js/db.js';
import { zoneColor } from '../js/zones.js';
import { navigate } from '../js/router.js';

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nextMilestone(count) {
  for (const m of [10, 25, 50, 75, 100, 150, 200]) {
    if (m > count) return m;
  }
  return count + 50;
}

function buildRingSVG(pct) {
  const r = 15;
  const circ = 2 * Math.PI * r; // ~94.25
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#98c379' : pct >= 40 ? '#e5c07b' : '#e06c75';
  return '<svg viewBox="0 0 36 36" width="52" height="52">' +
    '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="#252935" stroke-width="3.5"/>' +
    '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="3.5"' +
    ' stroke-dasharray="' + dash.toFixed(2) + ' ' + circ.toFixed(2) + '"' +
    ' stroke-linecap="round" transform="rotate(-90 18 18)"/>' +
    '<text x="18" y="22" text-anchor="middle" font-size="7.5" fill="#abb2bf"' +
    ' font-family="Roboto,sans-serif" font-weight="600">' + pct + '%</text>' +
    '</svg>';
}

function buildSessionDots(sessions) {
  if (sessions.length === 0) {
    return '<div class="home-health__empty">Play your first quiz</div>';
  }
  const dots = sessions.slice(0, 5).map((s) => {
    const pct = s.total_questions > 0 ? s.correct_count / s.total_questions : 0;
    const color = pct >= 0.70 ? '#98c379' : pct >= 0.40 ? '#e5c07b' : '#e06c75';
    return '<div class="home-health__dot" style="background:' + color + '" title="' + Math.round(pct * 100) + '%"></div>';
  }).join('');
  const label = sessions.length + ' session' + (sessions.length !== 1 ? 's' : '');
  return '<div class="home-health__dots">' + dots + '</div>' +
         '<div class="home-health__label">last ' + label + '</div>';
}

export async function renderProgress(container, params = {}, dbName = 'devbrain') {
  const [{ recommended, overdue }, { coverage: mapCoverage, total: totalNonBridge }, recentSessions] = await Promise.all([
    getSRSQueues(dbName),
    getConceptCounts(dbName),
    getRecentSessions(5, dbName),
  ]);

  const totalDue = recommended.length + overdue.length;
  const coveragePct = totalNonBridge > 0
    ? Math.min(100, Math.round((mapCoverage / totalNonBridge) * 100))
    : 0;
  const milestone = nextMilestone(mapCoverage);
  const estMin = Math.max(2, totalDue * 2);

  const healthPct = recentSessions.length === 0 ? 0
    : Math.round(
        (recentSessions.filter((s) =>
          s.total_questions > 0 && s.correct_count / s.total_questions >= 0.70
        ).length / recentSessions.length) * 100
      );

  // Concept pills -- up to 5 from recommended, zone color dot + name.
  // All values come from app-bundled curriculum.json; no user-typed content is interpolated.
  const pillsHTML = recommended.slice(0, 5).map(({ content }) => {
    const color = zoneColor(content.zone);
    return '<div class="home-hero__pill">' +
      '<span class="home-hero__pill-dot" style="background:' + color + '"></span>' +
      _esc(content.name) +
      '</div>';
  }).join('');

  const heroBody = totalDue > 0
    ? '<div class="home-hero__tag">\u2736 Ready for today</div>' +
      '<div class="home-hero__title">' + totalDue + ' concept' + (totalDue !== 1 ? 's' : '') + ' due</div>' +
      '<div class="home-hero__subtitle">Based on your last session \u00b7 ~' + estMin + ' min</div>' +
      '<div class="home-hero__pills">' + pillsHTML + '</div>' +
      '<button class="home-hero__cta" id="btn-go-quiz">Go to Quiz \u2192</button>'
    : '<div class="home-hero__tag">\u2736 All caught up</div>' +
      '<div class="home-hero__title">Nothing due today</div>' +
      '<div class="home-hero__subtitle">Check back tomorrow \u2014 your next review is scheduled</div>' +
      '<button class="home-hero__cta" id="btn-go-quiz">Go to Quiz \u2192</button>';

  container.innerHTML =
    '<div class="home-topbar"><span class="home-logo">DevBrain</span></div>' +
    '<div class="home-hero">' + heroBody + '</div>' +
    '<div class="home-stats">' +
      '<div class="home-stat-card">' +
        '<div class="home-stat-card__title">Map Coverage</div>' +
        '<div class="home-stat-card__number">' + mapCoverage + '</div>' +
        '<div class="home-stat-card__label">concepts explored</div>' +
        '<div class="home-stat-card__bar">' +
          '<div class="home-stat-card__bar-fill" style="width:' + coveragePct + '%"></div>' +
        '</div>' +
        '<div class="home-stat-card__milestone">Next: ' + milestone + ' concepts</div>' +
      '</div>' +
      '<div class="home-stat-card">' +
        '<div class="home-stat-card__title">Quiz Health</div>' +
        '<div class="home-health">' +
          (recentSessions.length > 0 ? buildRingSVG(healthPct) : '') +
          buildSessionDots(recentSessions) +
        '</div>' +
      '</div>' +
    '</div>';

  container.querySelector('#btn-go-quiz').addEventListener('click', () => navigate('quiz'));
}
