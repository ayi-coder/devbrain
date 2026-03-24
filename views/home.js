import { getDueConceptIds, getAllProgress, getStats } from '../js/db.js';
import { getLevelTitle, getMasteryStatus } from '../js/adaptive.js';
import { navigate } from '../js/router.js';

export async function renderHome(container) {
  const [dueIds, allProgress, stats] = await Promise.all([
    getDueConceptIds(),
    getAllProgress(),
    getStats(),
  ]);

  const progressMap = new Map();
  allProgress.forEach((p) => progressMap.set(p.concept_id, p));

  const concepts = window.CONCEPTS;
  const masteredCount = allProgress.filter(
    (p) => getMasteryStatus(p) === 'mastered'
  ).length;
  const totalConcepts = concepts.length;
  const levelTitle = getLevelTitle(masteredCount);
  const streakDays = stats.streak_days || 0;
  const masteryPct = Math.round((masteredCount / totalConcepts) * 100);

  const dueConceptNames = dueIds
    .slice(0, 5)
    .map((id) => {
      const c = concepts.find((x) => x.id === id);
      return c ? c.name : id;
    });
  const extraDue = dueIds.length > 5 ? dueIds.length - 5 : 0;

  const dueChipsHTML = dueIds.length > 0
    ? dueConceptNames.map((n) => `<span class="chip">${n}</span>`).join(' ') +
      (extraDue > 0 ? ` <span class="chip chip--blue">+${extraDue} more</span>` : '')
    : '<p style="color:var(--green)">You\'re all caught up! \u{1F389}</p>';

  const quizBtnClass = dueIds.length === 0 ? 'btn-primary btn-disabled' : 'btn-primary';

  container.innerHTML = `
    <div class="screen-header">
      <div style="font-size:18px;margin-bottom:4px;">Welcome back,</div>
      <div style="font-size:22px;font-weight:700;color:var(--yellow);margin-bottom:12px;">${levelTitle}</div>
      <div style="display:flex;gap:8px;">
        <span class="chip chip--orange">\u{1F525} ${streakDays} day streak</span>
        <span class="chip chip--blue">\u2705 ${masteredCount}/${totalConcepts} mastered</span>
      </div>
    </div>

    <div class="card card--accent-purple mb-16">
      <div class="label-small">Due for review</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${dueChipsHTML}
      </div>
    </div>

    <button class="${quizBtnClass}" id="btn-start-quiz">\u25B6 Start Today's Quiz</button>
    <button class="btn-secondary" id="btn-browse">\u{1F4D6} Browse All Concepts</button>

    <div class="mt-16">
      <div class="label-small">Overall mastery</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:13px;">${masteredCount} of ${totalConcepts} concepts</span>
        <span style="font-size:13px;color:var(--blue);">${masteryPct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${masteryPct}%"></div>
      </div>
    </div>
  `;

  container.querySelector('#btn-start-quiz').addEventListener('click', () => {
    if (dueIds.length === 0) return;
    sessionStorage.setItem('quizParams', JSON.stringify({
      conceptIds: dueIds,
      sessionType: 'standard',
    }));
    navigate('#quiz');
  });

  container.querySelector('#btn-browse').addEventListener('click', () => {
    navigate('#concepts');
  });
}
