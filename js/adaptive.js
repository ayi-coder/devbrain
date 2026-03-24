const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

export function getQuestionType(difficulty) {
  if (difficulty === 'Easy') return 'mcq';
  if (difficulty === 'Medium') return 'true_false';
  return 'fill_blank';
}

export function getMiniQuestionType(index) {
  const types = ['mcq', 'true_false', 'fill_blank'];
  return types[index % 3];
}

export function updateDifficulty(current, consCorrect, consWrong) {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (consCorrect >= 3) {
    return DIFFICULTY_ORDER[Math.min(idx + 1, 2)];
  }
  if (consWrong >= 2) {
    return DIFFICULTY_ORDER[Math.max(idx - 1, 0)];
  }
  return current;
}

export function getNextReviewDate(masteryScore) {
  const today = new Date();
  let daysAhead;
  if (masteryScore <= 1) daysAhead = 1;
  else if (masteryScore <= 3) daysAhead = 3;
  else daysAhead = 7;
  today.setDate(today.getDate() + daysAhead);
  return today.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function computeSessionUpdates(results, allProgress) {
  const progressMap = new Map();
  if (Array.isArray(allProgress)) {
    allProgress.forEach((p) => progressMap.set(p.concept_id, p));
  } else if (allProgress && typeof allProgress === 'object') {
    for (const [k, v] of Object.entries(allProgress)) {
      progressMap.set(k, v);
    }
  }

  const today = todayISO();
  const conceptResults = new Map();

  // Aggregate results per concept
  for (const r of results) {
    if (!conceptResults.has(r.conceptId)) {
      conceptResults.set(r.conceptId, { correct: 0, wrong: 0 });
    }
    const entry = conceptResults.get(r.conceptId);
    if (r.correct) entry.correct++;
    else entry.wrong++;
  }

  const updates = [];
  for (const [conceptId, counts] of conceptResults) {
    const existing = progressMap.get(conceptId) || {
      concept_id: conceptId,
      mastery_score: 0,
      next_review_date: today,
      times_correct: 0,
      times_wrong: 0,
      consecutive_correct_sessions: 0,
      last_seen_date: null,
    };

    const allCorrectThisSession = counts.wrong === 0;
    const newMastery = Math.max(0, Math.min(5,
      existing.mastery_score + (allCorrectThisSession ? 1 : -1)
    ));

    const newConsecutive = allCorrectThisSession
      ? existing.consecutive_correct_sessions + 1
      : 0;

    updates.push({
      concept_id: conceptId,
      mastery_score: newMastery,
      next_review_date: getNextReviewDate(newMastery),
      times_correct: existing.times_correct + counts.correct,
      times_wrong: existing.times_wrong + counts.wrong,
      consecutive_correct_sessions: newConsecutive,
      last_seen_date: today,
    });
  }

  return updates;
}

export function updateStreak(stats, score, total) {
  const today = todayISO();
  const qualifies = score * 2 >= total;
  const updated = { ...stats };

  if (!qualifies) return updated;
  if (updated.last_session_date === today) return updated;

  // Check if yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  if (updated.last_session_date === yesterdayISO) {
    updated.streak_days = (updated.streak_days || 0) + 1;
  } else {
    updated.streak_days = 1;
  }
  updated.last_session_date = today;
  return updated;
}

export function getMasteryStatus(progress) {
  if (!progress) return 'grey';
  if (progress.mastery_score === 5 && progress.consecutive_correct_sessions >= 3) return 'mastered';

  // Check if next_review_date <= tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  if (progress.next_review_date <= tomorrowISO) return 'review_soon';

  return 'grey';
}

export function getLevelTitle(masteredCount) {
  if (masteredCount >= 100) return 'Full Stack Legend';
  if (masteredCount >= 75) return 'Dev Brain';
  if (masteredCount >= 50) return 'API Architect';
  if (masteredCount >= 30) return 'Shell Explorer';
  if (masteredCount >= 15) return 'Code Curious';
  if (masteredCount >= 5) return 'Terminal Thinker';
  return 'Curious Newcomer';
}
