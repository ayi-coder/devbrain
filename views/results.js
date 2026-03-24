import { getAllProgress, upsertProgress, saveSession, getStats, updateStats } from '../js/db.js';
import { computeSessionUpdates, updateStreak } from '../js/adaptive.js';
import { navigate } from '../js/router.js';

export async function renderResults(container) {
  const session = JSON.parse(sessionStorage.getItem('sessionResults') || '{}');
  const { results = [], sessionId, highestDifficulty, sessionType, conceptIds = [] } = session;

  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  let label, labelColor;
  if (pct >= 80) {
    label = 'Crushing it! \u{1F525}';
    labelColor = 'var(--green)';
  } else if (pct >= 50) {
    label = 'Pretty solid!';
    labelColor = 'var(--yellow)';
  } else {
    label = 'Keep at it!';
    labelColor = 'var(--red)';
  }

  const concepts = window.CONCEPTS;
  const wrongConcepts = results
    .filter((r) => !r.correct)
    .map((r) => {
      const c = concepts.find((x) => x.id === r.conceptId);
      return c ? c.emoji + ' ' + c.name : r.conceptId;
    });

  const uniqueWrong = [...new Set(wrongConcepts)];

  const wrongHTML = uniqueWrong.length > 0
    ? '<div class="label-small mt-16">Needs more practice</div>' +
      uniqueWrong.map((n) => '<div class="card" style="padding:10px 14px;margin-bottom:6px;font-size:14px;">' + n + '</div>').join('')
    : '<div class="mt-16 text-center" style="color:var(--green);font-size:16px;">Perfect session! \u{1F389}</div>';

  container.innerHTML = '<div class="screen-header text-center">' +
    '<div style="font-size:48px;margin-bottom:8px;">\u{1F3C6}</div>' +
    '<div style="font-size:28px;font-weight:700;color:var(--yellow);">' + score + ' / ' + total + '</div>' +
    '<div style="font-size:16px;color:' + labelColor + ';margin-top:4px;">' + label + '</div>' +
    '</div>' +
    '<div class="progress-bar mb-16">' +
    '<div class="progress-fill" style="width:' + pct + '%"></div>' +
    '</div>' +
    wrongHTML +
    '<div class="mt-16">' +
    '<button class="btn-primary" id="btn-done">Done \u2713</button>' +
    '</div>';

  container.querySelector('#btn-done').addEventListener('click', async () => {
    try {
      const allProgress = await getAllProgress();
      const updates = computeSessionUpdates(results, allProgress);
      for (const row of updates) {
        await upsertProgress(row);
      }

      const stats = await getStats();
      const updatedStats = updateStreak(stats, score, total);
      await updateStats(updatedStats);

      const today = new Date().toISOString().slice(0, 10);
      await saveSession({
        session_id: sessionId,
        date: today,
        score,
        total,
        difficulty_reached: highestDifficulty,
        concepts_tested: conceptIds,
        session_type: sessionType,
      });
      history.replaceState(null, '', '#home');
      navigate('#home');
    } catch (err) {
      console.error('Error saving results:', err);
      const btn = container.querySelector('#btn-done');
      if (btn) {
        btn.textContent = 'Save failed — tap to retry';
        btn.style.background = 'var(--red)';
      }
    }
  });
}
