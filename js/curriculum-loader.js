import { getAllContent, addContentIfNew, getAllUserProgress, upsertUserProgress } from './db.js';

const DEFAULT_PROGRESS = {
  seen: false,
  practiced: false,
  t2_unlocked: false,
  t3_unlocked: false,
  check_completed: false,
  next_review_date: null,
  last_review_date: null,
  ease_factor: 2.5,
  interval: 1,
  repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
  check_used_indices: { definition: [] },
};

export async function loadCurriculum(dbName = 'devbrain') {
  const existingProgress = await getAllUserProgress(dbName);

  const response = await fetch('/data/curriculum.json');
  if (!response.ok) throw new Error(`Failed to load curriculum: ${response.status}`);
  const concepts = await response.json();

  await addContentIfNew(concepts, dbName);

  const seenIds = new Set(existingProgress.map((p) => p.id));

  for (const concept of concepts) {
    if (!seenIds.has(concept.id)) {
      await upsertUserProgress({ ...DEFAULT_PROGRESS, id: concept.id }, dbName);
    }
  }
}
