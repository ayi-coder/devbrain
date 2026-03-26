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

  it('renders subcategory name in zone accordion when zone is open', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    // Open the shell-terminal zone
    _resetCurriculumState({ openZones: ['shell-terminal'] });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('Bash'), 'subcategory name rendered when zone open');
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

const conceptWithForCheck = {
  ...sampleConcept,
  questions: {
    definition: [
      { prompt: 'D0', options: ['a', 'b', 'c', 'd'], correct_index: 0, for_check: true, explanation: 'exp' },
      { prompt: 'D1', options: ['a', 'b', 'c', 'd'], correct_index: 1, for_check: false },
    ],
    usage: [
      { prompt: 'U0', options: ['a', 'b', 'c', 'd'], correct_index: 0, for_check: true, explanation: 'exp' },
      { prompt: 'U1', options: ['a', 'b', 'c', 'd'], correct_index: 1, for_check: false },
    ],
    anatomy: [
      { prompt: 'A0', options: ['a', 'b', 'c', 'd'], correct_index: 0, for_check: true, explanation: 'exp' },
    ],
    build: [],
  },
};

describe('_selectCheckQuestions', () => {
  it('returns questions with for_check:true across all types', () => {
    const result = _selectCheckQuestions(conceptWithForCheck);
    assert.equal(result.length, 3);
    result.forEach((item) => {
      assert.ok('type' in item);
      assert.ok('index' in item);
      assert.ok('question' in item);
      assert.equal(item.question.for_check, true);
    });
  });

  it('returns questions in definition → usage → anatomy → build order', () => {
    const result = _selectCheckQuestions(conceptWithForCheck);
    assert.equal(result[0].type, 'definition');
    assert.equal(result[0].index, 0);
    assert.equal(result[1].type, 'usage');
    assert.equal(result[1].index, 0);
    assert.equal(result[2].type, 'anatomy');
    assert.equal(result[2].index, 0);
  });

  it('returns empty array when no for_check questions exist', () => {
    const concept = { ...sampleConcept, questions: { definition: [], usage: [], anatomy: [], build: [] } };
    const result = _selectCheckQuestions(concept);
    assert.equal(result.length, 0);
  });

  it('caps result at 3 even if more for_check questions exist', () => {
    const concept = {
      ...sampleConcept,
      questions: {
        definition: [
          { prompt: 'D0', options: [], correct_index: 0, for_check: true, explanation: 'e' },
          { prompt: 'D1', options: [], correct_index: 0, for_check: true, explanation: 'e' },
          { prompt: 'D2', options: [], correct_index: 0, for_check: true, explanation: 'e' },
          { prompt: 'D3', options: [], correct_index: 0, for_check: true, explanation: 'e' },
        ],
        usage: [], anatomy: [], build: [],
      },
    };
    const result = _selectCheckQuestions(concept);
    assert.equal(result.length, 3);
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
