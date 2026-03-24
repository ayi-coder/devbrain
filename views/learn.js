import { getProgress, upsertProgress } from '../js/db.js';
import { navigate } from '../js/router.js';

export async function renderLearn(container, conceptId) {
  const concepts = window.CONCEPTS;
  const concept = concepts.find((c) => c.id === conceptId);

  if (!concept) {
    container.innerHTML = '<p>Concept not found.</p>';
    return;
  }

  let progress = await getProgress(conceptId);
  if (!progress) {
    const today = new Date().toISOString().slice(0, 10);
    progress = {
      concept_id: conceptId,
      mastery_score: 0,
      next_review_date: today,
      times_correct: 0,
      times_wrong: 0,
      consecutive_correct_sessions: 0,
      last_seen_date: null,
    };
    await upsertProgress(progress);
  }

  container.innerHTML = `
    <div class="screen-header">
      <div style="font-size:44px;margin-bottom:8px;">${concept.emoji}</div>
      <div style="font-size:22px;font-weight:700;color:var(--blue);margin-bottom:8px;">${concept.name}</div>
      <span class="chip">${concept.category}</span>
    </div>

    <div class="card card--accent-yellow mb-12">
      <div class="label-small">Think of it like this</div>
      <p style="font-size:14px;line-height:1.6;">${concept.explain}</p>
    </div>

    <div class="card card--accent-muted mb-16">
      <div class="label-small">Real example</div>
      <p style="font-size:14px;line-height:1.6;">${concept.real_example}</p>
    </div>

    <button class="btn-primary" id="btn-quiz-me">\u{1F9EA} Quiz Me On This</button>
  `;

  container.querySelector('#btn-quiz-me').addEventListener('click', () => {
    sessionStorage.setItem('quizParams', JSON.stringify({
      conceptIds: [conceptId],
      sessionType: 'mini',
    }));
    navigate('#quiz');
  });
}
