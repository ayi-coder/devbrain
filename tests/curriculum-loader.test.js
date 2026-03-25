import 'fake-indexeddb/auto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Path resolved relative to this file — works regardless of CWD
const __dir = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_PATH = join(__dir, '..', 'data', 'curriculum.json');

// Mutable fetch override — tests can swap this to control curriculum content
let fetchOverride = null;

// Mock fetch — intercepts /data/curriculum.json and returns local file contents
globalThis.fetch = async (url) => {
  if (url.includes('curriculum.json')) {
    if (fetchOverride) return fetchOverride(url);
    const data = readFileSync(CURRICULUM_PATH, 'utf8');
    return { ok: true, json: async () => JSON.parse(data) };
  }
  throw new Error(`Unexpected fetch call: ${url}`);
};

const uid = () => `test-loader-${Math.random().toString(36).slice(2)}`;

describe('curriculum-loader', () => {
  test('seeds concepts-content from JSON on first load', async () => {
    const DB = uid();
    const { openDB, getAllContent } = await import('../js/db.js');
    const { loadCurriculum } = await import('../js/curriculum-loader.js');

    await openDB(DB);
    await loadCurriculum(DB);

    const content = await getAllContent(DB);
    assert.ok(content.length >= 3, 'at least 3 concepts seeded');
    const ids = content.map((c) => c.id);
    assert.ok(ids.includes('your-machine-os'));
    assert.ok(ids.includes('shell-terminal-mkdir'));
  });

  test('creates user-progress records for each seeded concept', async () => {
    const DB = uid();
    const { openDB, getAllUserProgress } = await import('../js/db.js');
    const { loadCurriculum } = await import('../js/curriculum-loader.js');

    await openDB(DB);
    await loadCurriculum(DB);

    const progress = await getAllUserProgress(DB);
    assert.equal(progress.length, 3, 'one progress record per concept');

    const record = progress.find((p) => p.id === 'your-machine-os');
    assert.ok(record, 'progress record for your-machine-os exists');
    assert.equal(record.seen, false);
    assert.equal(record.practiced, false);
    assert.equal(record.ease_factor, 2.5);
    assert.deepEqual(record.used_question_indices, {
      definition: [], usage: [], anatomy: [], build: [],
    });
  });

  test('is idempotent — calling twice does not duplicate records', async () => {
    const DB = uid();
    const { openDB, getAllContent } = await import('../js/db.js');
    const { loadCurriculum } = await import('../js/curriculum-loader.js');

    await openDB(DB);
    await loadCurriculum(DB);
    await loadCurriculum(DB); // second call should be a no-op

    const content = await getAllContent(DB);
    const osEntries = content.filter((c) => c.id === 'your-machine-os');
    assert.equal(osEntries.length, 1, 'no duplicate entries after second loadCurriculum call');
  });

  test('second loadCurriculum call does not throw', async () => {
    const DB = uid();
    const { openDB } = await import('../js/db.js');
    const { loadCurriculum } = await import('../js/curriculum-loader.js');

    await openDB(DB);
    await loadCurriculum(DB);
    await assert.doesNotReject(() => loadCurriculum(DB), 'second call must not throw');
  });

  test('new concepts added on second call — existing concepts untouched', async () => {
    const DB = uid();
    const { openDB, getAllContent, getUserProgress } = await import('../js/db.js');
    const { loadCurriculum } = await import('../js/curriculum-loader.js');

    // Minimal concept shape — enough for addContentIfNew and upsertUserProgress
    const conceptA = { id: 'test-concept-a', name: 'Concept A', zone: 'z', subcategory: 's' };
    const conceptB = { id: 'test-concept-b', name: 'Concept B', zone: 'z', subcategory: 's' };

    await openDB(DB);

    // First load: only conceptA
    fetchOverride = async () => ({ ok: true, json: async () => [conceptA] });
    await loadCurriculum(DB);

    // Mutate the in-DB record for conceptA so we can detect overwrites
    const { upsertUserProgress } = await import('../js/db.js');
    await upsertUserProgress({ id: 'test-concept-a', seen: true, practiced: true,
      t2_unlocked: false, t3_unlocked: false, check_completed: false,
      next_review_date: null, last_review_date: null, ease_factor: 9.9,
      interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
      check_used_indices: { definition: [] } }, DB);

    // Second load: conceptA + conceptB
    fetchOverride = async () => ({ ok: true, json: async () => [conceptA, conceptB] });
    await loadCurriculum(DB);
    fetchOverride = null;

    // conceptB should now exist in content
    const content = await getAllContent(DB);
    const ids = content.map((c) => c.id);
    assert.ok(ids.includes('test-concept-b'), 'new concept added on second call');

    // conceptA progress should be untouched (ease_factor still 9.9)
    const progressA = await getUserProgress('test-concept-a', DB);
    assert.equal(progressA.ease_factor, 9.9, 'existing progress record not overwritten');

    // conceptB progress should have been created
    const progressB = await getUserProgress('test-concept-b', DB);
    assert.ok(progressB, 'progress record created for new concept');
    assert.equal(progressB.seen, false, 'new concept starts unseen');
  });
});
