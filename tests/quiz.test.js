import 'fake-indexeddb/auto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  openDB, _resetDB, seedContent, upsertUserProgress, getUserProgress, markSeen,
  getExploredToday, getWrongAnswerConcepts,
  getSavedSession, saveMidSession, deleteSavedSession,
} from '../js/db.js';

globalThis.location = { hash: '' };
globalThis.confirm  = () => true;

let uid = 0;
const mkName = () => 'quiz-test-' + (++uid);

const concept = (id, zone = 'shell-terminal') => ({
  id, name: id, zone, subcategory: 'bash', is_bridge: false,
  tier_unlocked: 1, bridge_zones: [], what_it_is: '',
  analogy: '', use_when: '', examples: [],
  questions: { definition: [], usage: [], anatomy: [], build: [] },
});

const defaultProg = (id) => ({
  id, seen: false, practiced: false,
  t2_unlocked: false, t3_unlocked: false, check_completed: false,
  next_review_date: null, last_review_date: null,
  ease_factor: 2.5, interval: 1, repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
  check_used_indices: { definition: [] },
  last_seen_at: null,
  wrong_answer_indices: { definition: [], usage: [], anatomy: [], build: [] },
});

describe('markSeen — last_seen_at', () => {
  it('sets last_seen_at on first view', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress(defaultProg('c1'), DB);
    const before = Date.now();
    await markSeen('c1', DB);
    const prog = await getUserProgress('c1', DB);
    assert.ok(prog.seen);
    assert.ok(prog.last_seen_at !== null);
    assert.ok(new Date(prog.last_seen_at).getTime() >= before);
  });

  it('updates last_seen_at even when already seen', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    const old = new Date(Date.now() - 100_000).toISOString();
    await upsertUserProgress({ ...defaultProg('c1'), seen: true, last_seen_at: old }, DB);
    await markSeen('c1', DB);
    const prog = await getUserProgress('c1', DB);
    assert.ok(new Date(prog.last_seen_at) > new Date(old));
  });
});

describe('getExploredToday', () => {
  it('returns concepts seen within last 24 hours', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1'), concept('c2')], DB);
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    const old    = new Date(Date.now() - 90_000_000).toISOString();
    await upsertUserProgress({ ...defaultProg('c1'), seen: true, last_seen_at: recent }, DB);
    await upsertUserProgress({ ...defaultProg('c2'), seen: true, last_seen_at: old },    DB);
    const result = await getExploredToday(DB);
    assert.equal(result.length, 1);
    assert.equal(result[0].content.id, 'c1');
  });

  it('returns empty array when none within 24hrs', async () => {
    const DB = mkName(); await openDB(DB);
    assert.deepEqual(await getExploredToday(DB), []);
  });
});

describe('getWrongAnswerConcepts', () => {
  it('returns concepts with non-empty wrong_answer_indices', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1'), concept('c2')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'), seen: true,
      wrong_answer_indices: { definition: [0], usage: [], anatomy: [], build: [] },
    }, DB);
    await upsertUserProgress(defaultProg('c2'), DB);
    const result = await getWrongAnswerConcepts(DB);
    assert.equal(result.length, 1);
    assert.equal(result[0].content.id, 'c1');
  });

  it('returns concept once even when multiple types have wrong answers', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'), seen: true,
      wrong_answer_indices: { definition: [0], usage: [1], anatomy: [], build: [] },
    }, DB);
    const result = await getWrongAnswerConcepts(DB);
    assert.equal(result.length, 1);
  });
});

describe('getSavedSession / saveMidSession / deleteSavedSession', () => {
  it('returns null when no saved session', async () => {
    const DB = mkName(); await openDB(DB);
    assert.equal(await getSavedSession(DB), null);
  });

  it('round-trips a session', async () => {
    const DB = mkName(); await openDB(DB);
    await saveMidSession({ session: ['c1','c2'], queue: [], queuePos: 3, answers: [] }, DB);
    const result = await getSavedSession(DB);
    assert.deepEqual(result.session, ['c1','c2']);
    assert.equal(result.queuePos, 3);
  });

  it('deleteSavedSession clears the record', async () => {
    const DB = mkName(); await openDB(DB);
    await saveMidSession({ session: ['c1'], queue: [], queuePos: 0, answers: [] }, DB);
    await deleteSavedSession(DB);
    assert.equal(await getSavedSession(DB), null);
  });

  it('saveMidSession overwrites previous saved session', async () => {
    const DB = mkName(); await openDB(DB);
    await saveMidSession({ session: ['c1'], queue: [], queuePos: 0, answers: [] }, DB);
    await saveMidSession({ session: ['c2'], queue: [], queuePos: 5, answers: [] }, DB);
    const result = await getSavedSession(DB);
    assert.deepEqual(result.session, ['c2']);
    assert.equal(result.queuePos, 5);
  });
});

import { applyWrongAnswers } from '../js/db.js';

describe('applyWrongAnswers', () => {
  it('removes correct index and adds wrong index', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'),
      wrong_answer_indices: { definition: [0], usage: [], anatomy: [], build: [] },
    }, DB);
    await applyWrongAnswers('c1', [
      { type: 'definition', index: 0, correct: true  },
      { type: 'definition', index: 1, correct: false },
    ], DB);
    const prog = await getUserProgress('c1', DB);
    assert.ok(!prog.wrong_answer_indices.definition.includes(0), 'correct cleared');
    assert.ok( prog.wrong_answer_indices.definition.includes(1), 'wrong added');
  });

  it('does not duplicate an already-present wrong index', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'),
      wrong_answer_indices: { definition: [1], usage: [], anatomy: [], build: [] },
    }, DB);
    await applyWrongAnswers('c1', [{ type: 'definition', index: 1, correct: false }], DB);
    const prog = await getUserProgress('c1', DB);
    assert.equal(prog.wrong_answer_indices.definition.filter(i => i === 1).length, 1, 'no duplicate');
  });

  it('is a no-op when concept has no progress record', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    // No upsertUserProgress call — should not throw
    await assert.doesNotReject(applyWrongAnswers('c1', [{ type: 'definition', index: 0, correct: false }], DB));
  });

  it('clearing all wrong answers removes concept from getWrongAnswerConcepts', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'),
      wrong_answer_indices: { definition: [0], usage: [], anatomy: [], build: [] },
    }, DB);
    await applyWrongAnswers('c1', [{ type: 'definition', index: 0, correct: true }], DB);
    const result = await getWrongAnswerConcepts(DB);
    assert.equal(result.length, 0, 'concept removed when all wrong answers cleared');
  });
});

import { renderQuiz, _resetQuizState } from '../views/quiz.js';

function mockContainer() {
  let html = '';
  const el = { addEventListener() {}, style: {}, disabled: false };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector() { return el; },
    querySelectorAll() { return []; },
    addEventListener() {},
    appendChild(child) {},
    scrollTop: 0,
  };
}

describe('renderQuiz — stats mode', () => {
  it('renders EXPLORED TODAY when concepts seen in last 24hrs', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    await upsertUserProgress({ ...defaultProg('c1'), seen: true, last_seen_at: recent }, DB);
    _resetQuizState();
    const container = mockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(container.innerHTML.includes('EXPLORED TODAY'));
  });

  it('renders REVISE WRONG ANSWERS when wrong_answer_indices non-empty', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    await upsertUserProgress({
      ...defaultProg('c1'), seen: true,
      wrong_answer_indices: { definition: [0], usage: [], anatomy: [], build: [] },
    }, DB);
    _resetQuizState();
    const container = mockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(container.innerHTML.includes('REVISE WRONG'));
  });

  it('does not render data-add buttons in stats mode', async () => {
    const DB = mkName(); await openDB(DB);
    _resetQuizState();
    const container = mockContainer();
    await renderQuiz(container, {}, DB);
    assert.ok(!container.innerHTML.includes('data-add'));
  });
});

describe('renderQuiz — quiz mode via preload', () => {
  it('shows data-add buttons when preload param enters quiz mode', async () => {
    const DB = mkName(); await openDB(DB);
    await seedContent([concept('c1')], DB);
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    await upsertUserProgress({ ...defaultProg('c1'), seen: true, last_seen_at: recent }, DB);
    _resetQuizState();
    const container = mockContainer();
    await renderQuiz(container, { preload: 'c1' }, DB);
    assert.ok(container.innerHTML.includes('data-add'));
  });
});

import { _filterConcepts } from '../views/quiz-search.js';

describe('_filterConcepts', () => {
  const concepts = [
    { id: 'c1', name: 'Bash Basics',  zone: 'shell-terminal' },
    { id: 'c2', name: 'Git Commit',   zone: 'git' },
    { id: 'c3', name: 'Bash Scripts', zone: 'shell-terminal' },
  ];

  it('returns all concepts when query is empty', () => {
    assert.equal(_filterConcepts(concepts, '').length, 3);
  });

  it('filters case-insensitively', () => {
    const result = _filterConcepts(concepts, 'bash');
    assert.equal(result.length, 2);
    assert.ok(result.every((c) => c.name.toLowerCase().includes('bash')));
  });

  it('returns empty array when no matches', () => {
    assert.deepEqual(_filterConcepts(concepts, 'zzz'), []);
  });
});

import { selectQuizQuestions } from '../views/quiz.js';

const conceptWithQ = {
  id: 'cq', name: 'cq', zone: 'shell-terminal', subcategory: 'bash',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [], what_it_is: '',
  analogy: '', use_when: '', examples: [],
  questions: {
    definition: [
      { prompt: 'Q0', options: ['a','b','c','d'], correct_index: 0 },
      { prompt: 'Q1', options: ['a','b','c','d'], correct_index: 1 },
      { prompt: 'Q2', options: ['a','b','c','d'], correct_index: 2 },
    ],
    usage: [], anatomy: [], build: [],
  },
};

describe('selectQuizQuestions — restricted pool', () => {
  it('returns only wrong-indexed questions when restrictToWrong=true', () => {
    const progress = {
      practiced: false, t2_unlocked: false, t3_unlocked: false,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
      wrong_answer_indices:  { definition: [1, 2], usage: [], anatomy: [], build: [] },
    };
    const picks = selectQuizQuestions(conceptWithQ, progress, true);
    assert.equal(picks.length, 2);
    assert.ok(picks.every((p) => [1, 2].includes(p.index)));
  });

  it('uses normal LRU pool when restrictToWrong=false', () => {
    const progress = {
      practiced: false, t2_unlocked: false, t3_unlocked: false,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
      wrong_answer_indices:  { definition: [1], usage: [], anatomy: [], build: [] },
    };
    const picks = selectQuizQuestions(conceptWithQ, progress, false);
    assert.equal(picks.length, 2);
  });
});
