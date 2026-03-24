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
