import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, _resetDB, seedContent, upsertUserProgress } from '../js/db.js';
import { parseLinks, conceptStatus, renderCurriculum, _resetCurriculumState } from '../views/curriculum.js';

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
});
