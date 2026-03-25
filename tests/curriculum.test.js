import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, _resetDB, seedContent, upsertUserProgress, getUserProgress } from '../js/db.js';
import { parseLinks, conceptStatus, renderCurriculum, _resetCurriculumState, _selectCheckQuestions } from '../views/curriculum.js';

// Stub location so navigate() calls don't throw in Node.js
globalThis.location = { hash: '' };

let uid = 0;
const mkName = () => 'curriculum-test-' + (++uid);

function makeMockContainer() {
  let html = '';
  const mockEl = { addEventListener() {}, style: {} };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector() { return mockEl; },
    querySelectorAll() { return []; },
    addEventListener() {},
    scrollTop: 0,
  };
}

const sampleConcept = {
  id: 'c1', name: 'mkdir', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Makes a directory.', analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'mkdir foo',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};

const sampleLinkedConcept = {
  id: 'c2', name: 'ls', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Lists files. See also [mkdir](c1) for creating directories.',
  analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'ls',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};

const defaultProg = {
  seen: false, practiced: false, next_review_date: null, last_review_date: null,
  ease_factor: 2.5, interval: 1, repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
};

// ── parseLinks ──────────────────────────────────────────────────────

describe('parseLinks', () => {
  it('returns text as single string when no links present', () => {
    assert.deepEqual(parseLinks('plain text'), ['plain text']);
  });

  it('parses a single link', () => {
    const result = parseLinks('mkdir stands for [make directory](your-machine-dir) here');
    assert.equal(result.length, 3);
    assert.equal(result[0], 'mkdir stands for ');
    assert.deepEqual(result[1], { text: 'make directory', conceptId: 'your-machine-dir' });
    assert.equal(result[2], ' here');
  });

  it('parses multiple links', () => {
    const result = parseLinks('[foo](a) and [bar](b)');
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], { text: 'foo', conceptId: 'a' });
    assert.equal(result[1], ' and ');
    assert.deepEqual(result[2], { text: 'bar', conceptId: 'b' });
  });

  it('handles link at start of string', () => {
    const result = parseLinks('[foo](a) rest');
    assert.deepEqual(result[0], { text: 'foo', conceptId: 'a' });
    assert.equal(result[1], ' rest');
  });

  it('handles link at end of string', () => {
    const result = parseLinks('start [foo](a)');
    assert.equal(result[0], 'start ');
    assert.deepEqual(result[1], { text: 'foo', conceptId: 'a' });
  });
});

// ── conceptStatus ────────────────────────────────────────────────────

describe('conceptStatus', () => {
  it('returns locked when progress is null', () => {
    assert.equal(conceptStatus(null, '2026-03-25'), 'locked');
  });

  it('returns locked when seen is false', () => {
    assert.equal(conceptStatus({ seen: false, practiced: false }, '2026-03-25'), 'locked');
  });

  it('returns new when seen but not practiced', () => {
    assert.equal(conceptStatus({ seen: true, practiced: false }, '2026-03-25'), 'new');
  });

  it('returns due when practiced and next_review_date is null', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: null }, '2026-03-25'), 'due');
  });

  it('returns due when practiced and review date equals today', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: '2026-03-25' }, '2026-03-25'), 'due');
  });

  it('returns done when practiced and review date is in the future', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: '2026-03-26' }, '2026-03-25'), 'done');
  });
});

// ── renderCurriculum (zone accordion + push screens) ─────────────────

describe('renderCurriculum', () => {
  beforeEach(() => { _resetDB(); _resetCurriculumState(); });

  it('renders zone display name in accordion', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    // 'Shell & Terminal' is the display name for zone 'shell-terminal'
    assert.ok(container.innerHTML.includes('Shell'), 'zone display name rendered');
  });

  it('renders total concept count in header', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('1 concepts total'), 'total count in header');
  });

  it('concept list screen shows concept names after nav push', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    // Simulate user having navigated to concept list for bash-commands
    _resetCurriculumState({
      navStack: [{ type: 'concepts', zoneId: 'shell-terminal', subcatId: 'bash-commands' }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('mkdir'), 'concept name shown in list');
  });

  it('marks concept as seen when lesson screen is rendered', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1', seen: false }, dbName);

    // Simulate user having navigated directly to the lesson
    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c1',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    const updated = await getUserProgress('c1', dbName);
    assert.equal(updated.seen, true, 'seen should be true after lesson render');
  });

  it('renders concept-link span for linked term in what_it_is', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleLinkedConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c2' }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c2',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('concept-link'), 'concept-link span rendered');
    assert.ok(container.innerHTML.includes('data-concept-id="c1"'), 'correct conceptId on span');
  });

  it('colors linked term with zone color of the linked concept', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleLinkedConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c2' }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c2',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    // c1 is in zone 'shell-terminal' whose color is #e5c07b
    assert.ok(container.innerHTML.includes('#e5c07b'), 'link colored with zone color');
  });
});

// ── _selectCheckQuestions ─────────────────────────────────────────────

const conceptWithQuestions = {
  ...sampleConcept,
  questions: {
    definition: [
      { prompt: 'Q0', options: ['a', 'b', 'c', 'd'], correct_index: 0 },
      { prompt: 'Q1', options: ['a', 'b', 'c', 'd'], correct_index: 1 },
      { prompt: 'Q2', options: ['a', 'b', 'c', 'd'], correct_index: 2 },
      { prompt: 'Q3', options: ['a', 'b', 'c', 'd'], correct_index: 3 },
    ],
    usage: [], anatomy: [], build: [],
  },
};

describe('_selectCheckQuestions', () => {
  it('returns up to 3 definition questions', () => {
    const result = _selectCheckQuestions(conceptWithQuestions, null);
    assert.equal(result.length, 3);
    result.forEach((item) => {
      assert.ok('index' in item);
      assert.ok('question' in item);
    });
  });

  it('prefers unused indices', () => {
    // 4 questions total, 1 used → unused = [1,2,3] which has >= 3, so pool = unused
    const progress = { check_used_indices: { definition: [0] } };
    const result = _selectCheckQuestions(conceptWithQuestions, progress);
    const indices = result.map((r) => r.index);
    // Should not include used index 0
    assert.ok(!indices.includes(0), 'should not include used index 0');
    assert.ok(indices.includes(1), 'should include index 1 (unused)');
    assert.ok(indices.includes(2), 'should include index 2 (unused)');
    assert.ok(indices.includes(3), 'should include index 3 (unused)');
  });

  it('cycles from full pool when all used', () => {
    const progress = { check_used_indices: { definition: [0, 1, 2, 3] } };
    const result = _selectCheckQuestions(conceptWithQuestions, progress);
    assert.equal(result.length, 3);
    // falls back to full pool [0,1,2,3], takes first 3
    const indices = result.map((r) => r.index);
    assert.deepEqual(indices, [0, 1, 2]);
  });
});

// ── btn-check label ───────────────────────────────────────────────────

describe('renderCurriculum (btn-check label)', () => {
  beforeEach(() => { _resetDB(); _resetCurriculumState(); });

  it('renders Check my understanding button when check_completed is false', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1', seen: true, check_completed: false }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c1',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(
      container.innerHTML.includes('Check my understanding'),
      'button label should be "Check my understanding" when check_completed is false',
    );
  });

  it('renders Check again button when check_completed is true', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1', seen: true, check_completed: true }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c1',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(
      container.innerHTML.includes('Check again'),
      'button label should be "Check again" when check_completed is true',
    );
  });
});
