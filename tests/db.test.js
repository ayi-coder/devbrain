import 'fake-indexeddb/auto';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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
