import { getAllProgress, getStats } from '../js/db.js';
import { getMasteryStatus, getLevelTitle } from '../js/adaptive.js';

// All content rendered here comes from bundled concepts.js (trusted) and
// numeric/date values computed internally — no user-controlled input.
export async function renderProgress(container) {
  const [allProgress, stats] = await Promise.all([
    getAllProgress(),
    getStats(),
  ]);

  const concepts = window.CONCEPTS;
  const progressMap = new Map();
  allProgress.forEach((p) => progressMap.set(p.concept_id, p));

  const masteredCount = allProgress.filter((p) => getMasteryStatus(p) === 'mastered').length;
  const startedCount = allProgress.length;
  const totalConcepts = concepts.length;
  const levelTitle = getLevelTitle(masteredCount);
  const streakDays = stats.streak_days || 0;
  const masteryPct = Math.round((masteredCount / totalConcepts) * 100);

  const categories = [...new Set(concepts.map((c) => c.category))];

  function masteryDots(score) {
    return Array.from({ length: 5 }, (_, i) =>
      `<span style="font-size:13px;color:${i < score ? 'var(--blue)' : 'var(--text-muted)'};">${i < score ? '●' : '○'}</span>`
    ).join('');
  }

  function statusChip(p) {
    if (!p) return '<span class="chip" style="font-size:11px;padding:2px 8px;">Not started</span>';
    const s = getMasteryStatus(p);
    if (s === 'mastered') return '<span class="chip" style="font-size:11px;padding:2px 8px;background:var(--green)22;color:var(--green);border-color:var(--green)44;">✓ Mastered</span>';
    if (s === 'review_soon') return '<span class="chip" style="font-size:11px;padding:2px 8px;background:var(--orange)22;color:var(--orange);border-color:var(--orange)44;">↻ Due</span>';
    if (p.mastery_score > 0) return '<span class="chip" style="font-size:11px;padding:2px 8px;background:var(--blue)22;color:var(--blue);border-color:var(--blue)44;">Learning</span>';
    return '<span class="chip" style="font-size:11px;padding:2px 8px;">Seen</span>';
  }

  function nextReviewLabel(p) {
    if (!p || getMasteryStatus(p) === 'mastered') return '';
    const today = new Date().toISOString().slice(0, 10);
    const d = p.next_review_date;
    if (!d) return '';
    const days = Math.round((new Date(d) - new Date(today)) / 86400000);
    if (days <= 0) return '<span style="color:var(--orange);font-size:11px;">Due now</span>';
    if (days === 1) return '<span style="color:var(--text-muted);font-size:11px;">Tomorrow</span>';
    return `<span style="color:var(--text-muted);font-size:11px;">In ${days} days</span>`;
  }

  const sections = categories.map((cat) => {
    const catConcepts = concepts.filter((c) => c.category === cat);
    const catMastered = catConcepts.filter((c) => {
      const p = progressMap.get(c.id);
      return p && getMasteryStatus(p) === 'mastered';
    }).length;

    const items = catConcepts.map((c) => {
      const p = progressMap.get(c.id) || null;
      const score = p ? p.mastery_score : 0;
      const consec = p ? p.consecutive_correct_sessions : 0;
      return `
        <div class="card" style="padding:12px 14px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;min-width:0;">
              <span style="font-size:18px;flex-shrink:0;">${c.emoji}</span>
              <span style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name}</span>
            </div>
            ${statusChip(p)}
          </div>
          ${p
            ? `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap;">
                <div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">MASTERY</div>
                  <div style="display:flex;align-items:center;gap:3px;">
                    ${masteryDots(score)}
                    <span style="font-size:11px;color:var(--text-muted);margin-left:3px;">${score}/5</span>
                  </div>
                </div>
                <div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">SESSIONS</div>
                  <div style="font-size:12px;">${consec > 0 ? '🔥 ' + consec + ' in a row' : '—'}</div>
                </div>
                <div style="margin-left:auto;">${nextReviewLabel(p)}</div>
              </div>`
            : '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Not studied yet</div>'
          }
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="label-small">${cat}</div>
          <span style="font-size:12px;color:var(--text-muted);">${catMastered}/${catConcepts.length} mastered</span>
        </div>
        ${items}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="screen-header">
      <div style="font-size:20px;font-weight:700;">📊 Progress</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div class="card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:22px;font-weight:700;color:var(--yellow);">${masteredCount}</div>
        <div style="font-size:11px;color:var(--text-muted);">Mastered</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:22px;font-weight:700;color:var(--blue);">${startedCount}</div>
        <div style="font-size:11px;color:var(--text-muted);">Started</div>
      </div>
      <div class="card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:22px;font-weight:700;color:var(--orange);">${streakDays}</div>
        <div style="font-size:11px;color:var(--text-muted);">🔥 Day streak</div>
      </div>
    </div>

    <div class="card card--accent-purple mb-16" style="padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:500;">${levelTitle}</span>
        <span style="font-size:13px;color:var(--blue);">${masteryPct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${masteryPct}%;"></div></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
        ${masteredCount}/${totalConcepts} mastered · needs score 5/5 + 3 correct sessions
      </div>
    </div>

    ${sections}
  `;
}
