import 'fake-indexeddb/auto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, _resetDB, seedContent, getAllContent, getContentByZone,
  getUserProgress, getAllUserProgress, upsertUserProgress, markSeen,
  getSRSQueues, getMapCoverageCount, saveSession, getRecentSessions,
  getCurriculumData, applyQuizResult } from '../js/db.js';

// Each describe block uses a unique DB name to prevent cross-test contamination.
// Pass the name to openDB() so each test group gets its own IndexedDB database.

describe('DB v2 schema', () => {
  const DB = 'test-schema';

  test('openDB creates concepts-content store', async () => {
    const { openDB } = await import('../js/db.js');
    const db = await openDB(DB);
    assert.ok(db.objectStoreNames.contains('concepts-content'));
  });

  test('openDB creates user-progress store', async () => {
    const { openDB } = await import('../js/db.js');
    const db = await openDB(DB);
    assert.ok(db.objectStoreNames.contains('user-progress'));
  });

  test('openDB retains quiz_sessions store', async () => {
    const { openDB } = await import('../js/db.js');
    const db = await openDB(DB);
    assert.ok(db.objectStoreNames.contains('quiz_sessions'));
  });

  test('openDB retains user_stats store', async () => {
    const { openDB } = await import('../js/db.js');
    const db = await openDB(DB);
    assert.ok(db.objectStoreNames.contains('user_stats'));
  });
});

describe('v1 → v2 migration', () => {
  const DB = 'test-migration';

  test('migrates concept_progress records to user-progress', async () => {
    // Seed a v1 DB at version 1 using raw IDB (bypassing db.js)
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore('concept_progress', { keyPath: 'concept_id' });
        db.createObjectStore('quiz_sessions', { keyPath: 'session_id' });
        db.createObjectStore('user_stats', { keyPath: 'id' });
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('concept_progress', 'readwrite');
        tx.objectStore('concept_progress').put({
          concept_id: 'your-machine-os',
          next_review_date: '2026-03-25',
          mastery_score: 3,
          last_seen_date: '2026-03-24',
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    // Now open at v2 via db.js — triggers the migration
    const { openDB, getUserProgress } = await import('../js/db.js');
    await openDB(DB);

    const migrated = await getUserProgress('your-machine-os', DB);

    assert.ok(migrated, 'migrated record should exist in user-progress');
    assert.equal(migrated.id, 'your-machine-os');
    assert.equal(migrated.next_review_date, '2026-03-25');
    assert.equal(migrated.last_review_date, '2026-03-24');
    assert.equal(migrated.ease_factor, 2.5);
    assert.deepEqual(migrated.used_question_indices, {
      definition: [], usage: [], anatomy: [], build: [],
    });
  });
});

describe('DB query API', () => {
  // Each sub-test uses a unique DB name suffix to avoid cross-contamination
  const uid = () => `test-queries-${Math.random().toString(36).slice(2)}`;

  test('seedContent and getAllContent round-trip', async () => {
    const DB = uid();
    const { openDB, seedContent, getAllContent } = await import('../js/db.js');
    await openDB(DB);
    await seedContent([
      { id: 'concept-a', name: 'A', zone: 'zone-1', is_bridge: false },
      { id: 'concept-b', name: 'B', zone: 'zone-2', is_bridge: false },
    ], DB);
    const all = await getAllContent(DB);
    const ids = all.map((c) => c.id);
    assert.ok(ids.includes('concept-a'));
    assert.ok(ids.includes('concept-b'));
  });

  test('getContent returns null for unknown id', async () => {
    const DB = uid();
    const { openDB, getContent } = await import('../js/db.js');
    await openDB(DB);
    assert.equal(await getContent('does-not-exist', DB), null);
  });

  test('getContentByZone excludes bridge nodes', async () => {
    const DB = uid();
    const { openDB, seedContent, getContentByZone } = await import('../js/db.js');
    await openDB(DB);
    await seedContent([
      { id: 'regular', name: 'R', zone: 'target-zone', is_bridge: false },
      { id: 'bridge', name: 'B', is_bridge: true, bridge_zones: ['target-zone', 'other-zone'] },
      { id: 'other', name: 'O', zone: 'other-zone', is_bridge: false },
    ], DB);
    const results = await getContentByZone('target-zone', DB);
    const ids = results.map((c) => c.id);
    assert.ok(ids.includes('regular'), 'regular concept included');
    assert.ok(!ids.includes('bridge'), 'bridge node excluded from zone results');
    assert.ok(!ids.includes('other'), 'other-zone concept excluded');
  });

  test('markSeen sets seen=true without touching other fields', async () => {
    const DB = uid();
    const { openDB, upsertUserProgress, getUserProgress, markSeen } = await import('../js/db.js');
    await openDB(DB);
    await upsertUserProgress({
      id: 'mark-seen-test', seen: false, practiced: false,
      next_review_date: null, last_review_date: null,
      ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, DB);
    await markSeen('mark-seen-test', DB);
    const p = await getUserProgress('mark-seen-test', DB);
    assert.equal(p.seen, true);
    assert.equal(p.practiced, false);
    assert.equal(p.ease_factor, 2.5);
  });

  test('getSRSQueues separates recommended from overdue', async () => {
    const DB = uid();
    const { openDB, seedContent, upsertUserProgress, getSRSQueues } = await import('../js/db.js');
    await openDB(DB);

    await seedContent([
      { id: 'due-today', zone: 'z', is_bridge: false },
      { id: 'overdue-10d', zone: 'z', is_bridge: false },
      { id: 'new-never-quizzed', zone: 'z', is_bridge: false },
      { id: 'locked-unseen', zone: 'z', is_bridge: false },
    ], DB);

    const today = new Date().toISOString().slice(0, 10);
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const base = { ease_factor: 2.5, interval: 1, repetitions: 1,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] } };

    await upsertUserProgress({ ...base, id: 'due-today', seen: true, practiced: true,
      next_review_date: today, last_review_date: today }, DB);
    await upsertUserProgress({ ...base, id: 'overdue-10d', seen: true, practiced: true,
      next_review_date: tenDaysAgo, last_review_date: tenDaysAgo }, DB);
    await upsertUserProgress({ ...base, id: 'new-never-quizzed', seen: true, practiced: false,
      next_review_date: null, last_review_date: null }, DB);
    await upsertUserProgress({ ...base, id: 'locked-unseen', seen: false, practiced: false,
      next_review_date: null, last_review_date: null }, DB);

    const { recommended, overdue } = await getSRSQueues(DB);
    const recIds = recommended.map((x) => x.content.id);
    const ovIds = overdue.map((x) => x.content.id);

    assert.ok(recIds.includes('due-today'), 'due-today in recommended');
    assert.ok(recIds.includes('new-never-quizzed'), 'new concept in recommended');
    assert.ok(ovIds.includes('overdue-10d'), 'overdue-10d in overdue');
    assert.ok(!recIds.includes('overdue-10d'), 'overdue-10d NOT in recommended');
    assert.ok(!recIds.includes('locked-unseen'), 'locked concept NOT in recommended');
    assert.ok(!ovIds.includes('locked-unseen'), 'locked concept NOT in overdue');
  });

  test('getSRSQueues handles practiced=true with null next_review_date', async () => {
    // Spec §5.5: practiced records must surface somewhere — null date treated as due
    const DB = uid();
    const { openDB, seedContent, upsertUserProgress, getSRSQueues } = await import('../js/db.js');
    await openDB(DB);
    await seedContent([{ id: 'corrupt-progress', zone: 'z', is_bridge: false }], DB);
    await upsertUserProgress({
      id: 'corrupt-progress', seen: true, practiced: true,
      next_review_date: null, last_review_date: null,
      ease_factor: 2.5, interval: 1, repetitions: 1,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, DB);
    const { recommended, overdue } = await getSRSQueues(DB);
    const recIds = recommended.map((x) => x.content.id);
    assert.ok(recIds.includes('corrupt-progress'), 'practiced+null-date treated as due in recommended');
  });

  test('getMapCoverageCount excludes bridge nodes exactly', async () => {
    const DB = uid();
    const { openDB, seedContent, upsertUserProgress, getMapCoverageCount } = await import('../js/db.js');
    await openDB(DB);
    await seedContent([
      { id: 'p1', zone: 'z', is_bridge: false },
      { id: 'p2', zone: 'z', is_bridge: false },
      { id: 'bridge-p', is_bridge: true, bridge_zones: ['z', 'z2'] },
    ], DB);
    const practicedBase = {
      seen: true, practiced: true,
      next_review_date: null, last_review_date: null,
      ease_factor: 2.5, interval: 1, repetitions: 1,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    };
    await upsertUserProgress({ ...practicedBase, id: 'p1' }, DB);
    await upsertUserProgress({ ...practicedBase, id: 'p2' }, DB);
    await upsertUserProgress({ ...practicedBase, id: 'bridge-p' }, DB);

    const count = await getMapCoverageCount(DB);
    assert.equal(count, 2, 'only 2 non-bridge practiced concepts counted');
  });
});

describe('getRecentSessions', () => {
  const uid = () => `test-sessions-${Math.random().toString(36).slice(2)}`;

  test('returns empty array when no sessions exist', async () => {
    const dbName = uid();
    await openDB(dbName);
    const result = await getRecentSessions(5, dbName);
    assert.deepEqual(result, []);
  });

  test('returns sessions sorted newest-first', async () => {
    const dbName = uid();
    await openDB(dbName);
    await saveSession({ session_id: 'a', date: '2026-03-20', total_questions: 5, correct_count: 3 }, dbName);
    await saveSession({ session_id: 'b', date: '2026-03-24', total_questions: 5, correct_count: 4 }, dbName);
    await saveSession({ session_id: 'c', date: '2026-03-22', total_questions: 5, correct_count: 2 }, dbName);

    const result = await getRecentSessions(5, dbName);
    assert.equal(result.length, 3);
    assert.equal(result[0].session_id, 'b'); // newest first
    assert.equal(result[1].session_id, 'c');
    assert.equal(result[2].session_id, 'a');
  });

  test('caps results at n', async () => {
    const dbName = uid();
    await openDB(dbName);
    for (let i = 0; i < 7; i++) {
      await saveSession({
        session_id: `s${i}`,
        date: `2026-03-${String(i + 10).padStart(2, '0')}`,
        total_questions: 3,
        correct_count: 2,
      }, dbName);
    }
    const result = await getRecentSessions(5, dbName);
    assert.equal(result.length, 5);
  });
});

describe('getCurriculumData', () => {
  const uid = () => `test-curriculum-${Math.random().toString(36).slice(2)}`;

  const cA = {
    id: 'curr-c1', name: 'Concept A', zone: 'your-machine', subcategory: 'operating-systems',
    is_bridge: false, tier_unlocked: 1, bridge_zones: [],
    what_it_is: 'A', analogy: '', use_when: '',
    examples: [], example_command: null,
    questions: { definition: [], usage: [], anatomy: [], build: [] },
  };
  const cB = {
    id: 'curr-c2', name: 'Concept B', zone: 'shell-terminal', subcategory: 'bash-commands',
    is_bridge: false, tier_unlocked: 1, bridge_zones: [],
    what_it_is: 'B', analogy: '', use_when: '',
    examples: [], example_command: null,
    questions: { definition: [], usage: [], anatomy: [], build: [] },
  };
  const cBridge = {
    id: 'curr-bridge', name: 'Bridge', is_bridge: true,
    bridge_zones: ['your-machine', 'shell-terminal'], tier_unlocked: 1,
    what_it_is: '', analogy: '', use_when: '', examples: [], example_command: null,
    questions: { definition: [], usage: [], anatomy: [], build: [] },
  };
  const defProg = (id) => ({
    id, seen: false, practiced: false, next_review_date: null, last_review_date: null,
    ease_factor: 2.5, interval: 1, repetitions: 0,
    used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
  });

  test('totalConcepts excludes bridge nodes', async () => {
    const DB = uid();
    await openDB(DB);
    await seedContent([cA, cB, cBridge], DB);
    for (const id of ['curr-c1', 'curr-c2', 'curr-bridge']) {
      await upsertUserProgress(defProg(id), DB);
    }
    const data = await getCurriculumData(DB);
    assert.equal(data.totalConcepts, 2);
  });

  test('zone has correct practiced count', async () => {
    const DB = uid();
    await openDB(DB);
    await seedContent([cA], DB);
    await upsertUserProgress({ ...defProg('curr-c1'), practiced: true }, DB);
    const data = await getCurriculumData(DB);
    const zone = data.zones.find((z) => z.id === 'your-machine');
    assert.ok(zone, 'your-machine zone exists');
    assert.equal(zone.total, 1);
    assert.equal(zone.practiced, 1);
  });

  test('contentMap and progressMap contain all concepts', async () => {
    const DB = uid();
    await openDB(DB);
    await seedContent([cA, cB], DB);
    for (const id of ['curr-c1', 'curr-c2']) {
      await upsertUserProgress(defProg(id), DB);
    }
    const data = await getCurriculumData(DB);
    assert.ok(data.contentMap instanceof Map);
    assert.ok(data.contentMap.has('curr-c1'));
    assert.ok(data.contentMap.has('curr-c2'));
    assert.ok(data.progressMap instanceof Map);
    assert.ok(data.progressMap.has('curr-c1'));
    assert.ok(data.progressMap.has('curr-c2'));
  });
});

describe('applyQuizResult', () => {
  const uid = () => `test-aqr-${Math.random().toString(36).slice(2)}`;
  const base = (overrides = {}) => ({
    id: 'aqr-c', seen: true, practiced: false,
    t2_unlocked: false, t3_unlocked: false,
    check_completed: false,
    next_review_date: null, last_review_date: null,
    ease_factor: 2.5, interval: 1, repetitions: 0,
    used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    check_used_indices: { definition: [] },
    ...overrides,
  });

  test('sets practiced=true on first answer', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base(), DB);
    await applyQuizResult('aqr-c', true, 'definition', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.practiced, true);
  });

  test('appends question index to used_question_indices', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base(), DB);
    await applyQuizResult('aqr-c', true, 'definition', 2, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.deepEqual(p.used_question_indices.definition, [2]);
  });

  test('does not duplicate index already present', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base({
      used_question_indices: { definition: [2], usage: [], anatomy: [], build: [] },
    }), DB);
    await applyQuizResult('aqr-c', true, 'definition', 2, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.deepEqual(p.used_question_indices.definition, [2]);
  });

  test('correct answer rep=0: interval=1, advances next_review_date by 1 day', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base(), DB);
    await applyQuizResult('aqr-c', true, 'definition', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.repetitions, 1);
    assert.equal(p.interval, 1);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    assert.equal(p.next_review_date, tomorrow);
    assert.equal(p.last_review_date, new Date().toISOString().slice(0, 10));
  });

  test('correct answer rep=1: interval=6', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base({ repetitions: 1, interval: 1, practiced: true }), DB);
    await applyQuizResult('aqr-c', true, 'definition', 1, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.interval, 6);
    assert.equal(p.repetitions, 2);
  });

  test('correct answer rep>=2: interval=round(interval*ease_factor)', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base({ repetitions: 2, interval: 6, ease_factor: 2.5, practiced: true }), DB);
    await applyQuizResult('aqr-c', true, 'definition', 2, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.interval, 15); // Math.round(6 * 2.5)
    assert.equal(p.repetitions, 3);
  });

  test('wrong answer resets repetitions and interval', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base({ repetitions: 3, interval: 12, practiced: true }), DB);
    await applyQuizResult('aqr-c', false, 'definition', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.repetitions, 0);
    assert.equal(p.interval, 1);
    assert.ok(p.ease_factor < 2.5);
  });

  test('ease_factor never drops below 1.3', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base({ ease_factor: 1.3, practiced: true }), DB);
    await applyQuizResult('aqr-c', false, 'definition', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.ok(p.ease_factor >= 1.3);
  });

  test('no-op if concept has no progress record', async () => {
    const DB = uid();
    await openDB(DB);
    await applyQuizResult('does-not-exist', true, 'definition', 0, DB);
    assert.equal(await getUserProgress('does-not-exist', DB), null);
  });

  test('sets t2_unlocked on correct definition answer', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base(), DB);
    await applyQuizResult('aqr-c', true, 'definition', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.t2_unlocked, true);
    assert.equal(p.t3_unlocked, false);
  });

  test('sets t3_unlocked on correct usage answer', async () => {
    const DB = uid();
    await openDB(DB);
    await upsertUserProgress(base(), DB);
    await applyQuizResult('aqr-c', true, 'usage', 0, DB);
    const p = await getUserProgress('aqr-c', DB);
    assert.equal(p.t3_unlocked, true);
    assert.equal(p.t2_unlocked, false);
  });
});
