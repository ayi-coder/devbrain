import 'fake-indexeddb/auto';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, seedContent, upsertUserProgress } from '../js/db.js';
import { selectQuizQuestions, renderQuiz, _resetQuizState } from '../views/quiz.js';

globalThis.location = { hash: '' };

let _uid = 0;
const mkDB = () => `quiz-test-${++_uid}`;

function makeConcept(overrides = {}) {
  return {
    id: 'c1', name: 'Test Concept', zone: 'shell-terminal', is_bridge: false,
    questions: {
      definition: [
        { prompt: 'D1?', options: ['a','b','c','d'], correct_index: 0 },
        { prompt: 'D2?', options: ['a','b','c','d'], correct_index: 1 },
        { prompt: 'D3?', options: ['a','b','c','d'], correct_index: 2 },
      ],
      usage:    [{ prompt: 'U1?', options: ['a','b','c','d'], correct_index: 0 },
                 { prompt: 'U2?', options: ['a','b','c','d'], correct_index: 1 }],
      anatomy:  [],
      build:    [],
    },
    ...overrides,
  };
}

function baseProgress(overrides = {}) {
  return {
    id: 'c1', seen: true, practiced: false,
    next_review_date: null, last_review_date: null,
    ease_factor: 2.5, interval: 1, repetitions: 0,
    used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    ...overrides,
  };
}

function makeMockContainer() {
  let html = '';
  const mockEl = { addEventListener() {}, style: {}, dataset: {}, disabled: false };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector()    { return mockEl; },
    querySelectorAll() { return []; },
    addEventListener() {},
    scrollTop: 0,
  };
}

// ── selectQuizQuestions ────────────────────────────────────────────────────

describe('selectQuizQuestions', () => {
  test('T1 only: returns 2 definition questions', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress());
    assert.equal(picks.length, 2);
    assert.ok(picks.every(p => p.type === 'definition'));
  });

  test('T1 only: returns two different indices', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress());
    assert.notEqual(picks[0].index, picks[1].index);
  });

  test('T2 unlocked (practiced=true): 1 definition + 1 usage', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress({ practiced: true }));
    assert.equal(picks.length, 2);
    assert.ok(picks.some(p => p.type === 'definition'));
    assert.ok(picks.some(p => p.type === 'usage'));
  });

  test('T3 unlocked: 1 def + 1 usage + 1 anatomy', () => {
    const concept = makeConcept({
      questions: {
        definition: [{ prompt: 'D?', options: ['a','b','c','d'], correct_index: 0 }],
        usage:      [{ prompt: 'U?', options: ['a','b','c','d'], correct_index: 0 }],
        anatomy:    [{ prompt: 'A?', tokens: [{text:'git',label:'command'}], labels: ['command','argument'] }],
        build:      [],
      },
    });
    const prog = baseProgress({
      practiced: true,
      used_question_indices: { definition: [0], usage: [0], anatomy: [], build: [] },
    });
    const picks = selectQuizQuestions(concept, prog);
    assert.equal(picks.length, 3);
    assert.ok(picks.some(p => p.type === 'anatomy'));
  });

  test('LRU: prefers unused indices', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress({
      used_question_indices: { definition: [0], usage: [], anatomy: [], build: [] },
    }));
    assert.ok(picks.every(p => p.index !== 0));
  });

  test('LRU cycle: falls back to full pool when all used', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress({
      used_question_indices: { definition: [0,1,2], usage: [], anatomy: [], build: [] },
    }));
    assert.equal(picks.length, 2);
  });

  test('T2 fallback: 2 definition when usage array is empty', () => {
    const concept = makeConcept({
      questions: {
        definition: [
          { prompt: 'D1?', options: ['a','b','c','d'], correct_index: 0 },
          { prompt: 'D2?', options: ['a','b','c','d'], correct_index: 1 },
        ],
        usage: [], anatomy: [], build: [],
      },
    });
    const picks = selectQuizQuestions(concept, baseProgress({ practiced: true }));
    assert.equal(picks.length, 2);
    assert.ok(picks.every(p => p.type === 'definition'));
  });

  test('returns empty array when all question arrays are empty', () => {
    const concept = makeConcept({ questions: { definition: [], usage: [], anatomy: [], build: [] } });
    assert.equal(selectQuizQuestions(concept, baseProgress()).length, 0);
  });

  test('each pick has type, index, and question fields', () => {
    const picks = selectQuizQuestions(makeConcept(), baseProgress());
    for (const p of picks) {
      assert.ok('type' in p && 'index' in p && 'question' in p);
    }
  });
});

// ── renderQuiz — builder view ──────────────────────────────────────────────

describe('renderQuiz — builder view', () => {
  test('renders session builder card', async () => {
    const DB = mkDB();
    await openDB(DB);
    _resetQuizState();
    const container = makeMockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(container.innerHTML.includes('Your session'));
  });

  test('shows 0/5 count when session is empty', async () => {
    const DB = mkDB();
    await openDB(DB);
    _resetQuizState();
    const container = makeMockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(container.innerHTML.includes('0 / 5'));
  });

  test('preload adds concept to session', async () => {
    const DB = mkDB();
    await openDB(DB);
    await seedContent([{
      id: 'pre-c', name: 'Preloaded Concept', zone: 'shell-terminal', is_bridge: false,
      questions: { definition: [], usage: [], anatomy: [], build: [] },
    }], DB);
    await upsertUserProgress({
      id: 'pre-c', seen: true, practiced: false,
      next_review_date: null, last_review_date: null,
      ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, DB);
    _resetQuizState();
    const container = makeMockContainer();
    await renderQuiz(container, { preload: 'pre-c' }, DB);
    assert.ok(container.innerHTML.includes('Preloaded Concept'));
    assert.ok(container.innerHTML.includes('1 / 5'));
  });

  test('preload ignored when session is full', async () => {
    _resetQuizState({ session: ['a','b','c','d','e'] });
    const container = makeMockContainer();
    await renderQuiz(container, { preload: 'extra' }, mkDB());
    assert.ok(container.innerHTML.includes('5 / 5'));
  });
});

// ── renderQuiz — results view ──────────────────────────────────────────────

describe('renderQuiz — results view', () => {
  test('renders results header and concept scores', async () => {
    const DB = mkDB();
    await openDB(DB);
    _resetQuizState({
      view: 'results',
      session: ['c1'],
      answers: [
        { conceptId: 'c1', type: 'definition', index: 0, correct: true  },
        { conceptId: 'c1', type: 'usage',      index: 0, correct: false },
      ],
      quizData: {
        contentMap:  new Map([['c1', { id: 'c1', name: 'Test Concept', zone: 'shell-terminal' }]]),
        progressMap: new Map(),
      },
    });
    const container = makeMockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(container.innerHTML.includes('Session complete'));
    assert.ok(container.innerHTML.includes('Test Concept'));
    assert.ok(container.innerHTML.includes('1 / 2'));
  });
});
