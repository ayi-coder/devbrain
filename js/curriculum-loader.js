import { getAllContent, seedContent, getAllUserProgress, upsertUserProgress } from './db.js';

const DEFAULT_PROGRESS = {
  seen: false,
  practiced: false,
  next_review_date: null,
  last_review_date: null,
  ease_factor: 2.5,
  interval: 1,
  repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
};

export async function loadCurriculum(dbName = 'devbrain') {
  // Guard on progress records (not content) so a partially-completed seed — where content
  // was written but the tab was killed before progress writes finished — gets retried.
  const existingProgress = await getAllUserProgress(dbName);
  if (existingProgress.length > 0) return; // already seeded — idempotent

  const response = await fetch('/data/curriculum.json');
  if (!response.ok) throw new Error(`Failed to load curriculum: ${response.status}`);
  const concepts = await response.json();

  await seedContent(concepts, dbName);

  const seenIds = new Set(existingProgress.map((p) => p.id));

  for (const concept of concepts) {
    if (!seenIds.has(concept.id)) {
      await upsertUserProgress({ ...DEFAULT_PROGRESS, id: concept.id }, dbName);
    }
  }
}
