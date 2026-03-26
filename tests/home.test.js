import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, _resetDB, seedContent, upsertUserProgress, saveQuizSession } from '../js/db.js';
import { renderProgress } from '../views/home.js';

// Stub location so navigate() calls in renderHome don't throw in Node.js
globalThis.location = { hash: '' };

let uid = 0;
const mkName = () => 'home-test-' + (++uid);

function makeMockContainer() {
  let html = '';
  const mockEl = { addEventListener() {} };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector() { return mockEl; },
    querySelectorAll() { return []; },
  };
}

const sampleConcept = {
  id: 'c1', name: 'mkdir', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Makes a directory.', analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'mkdir foo',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};

const sampleBridge = {
  id: 'b1', name: 'stdin', is_bridge: true, bridge_zones: ['shell-terminal', 'editor-code'],
  tier_unlocked: 1, what_it_is: '', analogy: '', use_when: '',
  examples: [], questions: { definition: [], usage: [], anatomy: [], build: [] },
};

describe('renderProgress', () => {
  beforeEach(() => _resetDB());

  it('shows due count and Ready tag when concepts are due', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await upsertUserProgress({
      id: 'c1', seen: true, practiced: true,
      next_review_date: yesterday.toISOString().slice(0, 10),
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 1,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderProgress(container, {}, dbName);

    assert.ok(container.innerHTML.includes('1 concept'), 'should show "1 concept due"');
    assert.ok(container.innerHTML.includes('Ready for today'), 'should show ready tag');
  });

  it('shows all-caught-up state when nothing is due', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderProgress(container, {}, dbName);

    assert.ok(container.innerHTML.includes('All caught up'), 'empty state missing');
  });

  it('Map Coverage excludes bridge nodes', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleBridge], dbName);
    // Both practiced -- only c1 (non-bridge) should count
    for (const id of ['c1', 'b1']) {
      await upsertUserProgress({
        id, seen: true, practiced: true, next_review_date: null,
        last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 1,
        used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
      }, dbName);
    }

    const container = makeMockContainer();
    await renderProgress(container, {}, dbName);

    // The number 1 rendered inside a tag -- bridge b1 is excluded
    assert.ok(/>\s*1\s*</.test(container.innerHTML), 'Map Coverage should be 1 (bridge excluded)');
    assert.ok(container.innerHTML.includes('Map Coverage'));
  });

  it('shows Quiz Health empty state when no sessions', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderProgress(container, {}, dbName);

    assert.ok(container.innerHTML.includes('Play your first quiz'));
  });

  it('colors green session dot for high-scoring session', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);
    // 80% correct -- should be green (#98c379)
    await saveQuizSession({ session_id: 's1', date: '2026-03-24', total_questions: 5, correct_count: 4 }, dbName);

    const container = makeMockContainer();
    await renderProgress(container, {}, dbName);

    assert.ok(container.innerHTML.includes('home-health__dot'));
    assert.ok(container.innerHTML.includes('#98c379'), 'green dot for 80% score');
  });
});
