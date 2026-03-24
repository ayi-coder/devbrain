import 'fake-indexeddb/auto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Path resolved relative to this file — works regardless of CWD
const __dir = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_PATH = join(__dir, '..', 'data', 'curriculum.json');

// Mock fetch — intercepts /data/curriculum.json and returns local file contents
globalThis.fetch = async (url) => {
  if (url.includes('curriculum.json')) {
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
});
