# Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the new IndexedDB v2 schema, migrate existing user data from v1, create the content seeding pipeline from JSON, and produce the data files (`curriculum.json`, `globe-seeds.json`) that every other plan depends on.

**Architecture:** Two separate IndexedDB object stores — `concepts-content` (static curriculum, keyed by concept `id`) and `user-progress` (mutable SRS state, keyed by concept `id`). A `curriculum-loader.js` module seeds the content store on first load from `data/curriculum.json`. The v1 `concept_progress` store data is migrated to `user-progress` during the IndexedDB version upgrade (the old store is left orphaned rather than deleted, to avoid unsafe async-callback DDL patterns). A `data/globe-seeds.json` file defines hand-placed lat/lon seeds for all zones, subcategories, and concepts.

**Tech Stack:** Vanilla JS ES modules, IndexedDB API, Node.js `node:test` (built-in test runner, Node ≥ 18), `fake-indexeddb` npm package for DB tests, no bundler.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `js/db.js` | v2 schema, v1→v2 migration, all DB read/write functions |
| Create | `js/curriculum-loader.js` | Seeds `concepts-content` from `data/curriculum.json` on first load |
| Create | `data/curriculum.json` | 3 sample concepts in spec content format (full conversion in Plan 6) |
| Create | `data/globe-seeds.json` | Zone, subcategory, and concept seed coordinates |
| Create | `package.json` | `devDependencies` only: `fake-indexeddb`; `scripts.test` to run tests |
| Create | `tests/db.test.js` | Schema, migration, and query API tests |
| Create | `tests/curriculum-loader.test.js` | Content seeding tests |

### `js/db.js` exported functions (complete API)

```
// Lifecycle
openDB(name?)              → opens DB (default name used in prod; tests pass unique names)
_resetDB()                 → clears cached instance — TEST USE ONLY

// Content store (read-only after seeding)
getContent(id)             → concept content record | null
getAllContent()            → concept content record[]
getContentByZone(zoneId)   → non-bridge concept content records for that zone

// User progress store
getUserProgress(id)        → user-progress record | null
getAllUserProgress()        → user-progress record[]
upsertUserProgress(data)   → writes one user-progress record

// High-level SRS helpers
getSRSQueues()             → { recommended: [{content, progress}], overdue: [{content, progress}] }
markSeen(id)               → sets seen=true (no-op if already true)
markPracticed(id)          → sets practiced=true (no-op if already true)
getMapCoverageCount()      → count of practiced non-bridge concepts

// Helpers (also exported for seedContent in curriculum-loader)
seedContent(concepts[])    → bulk write to concepts-content (idempotent)

// Session history (unchanged API from v1)
saveSession(sessionData)   → writes quiz_sessions record
getStats()                 → user_stats record
updateStats(data)          → writes user_stats record
```

### DB name convention

Production code calls `openDB()` with no argument — it uses the constant `'devbrain'`. Tests call `openDB('test-<unique-suffix>')` to get fully isolated databases. The `dbMap` inside `db.js` caches one connection per name.

---

## Task 1: Test infrastructure

**Files:**
- Create: `package.json`
- Create: `tests/` directory (empty)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "devbrain",
  "type": "module",
  "scripts": {
    "test": "node --test tests/db.test.js tests/curriculum-loader.test.js"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 2: Install devDependencies**

Run: `npm install`
Expected: `node_modules/fake-indexeddb` directory created, `package-lock.json` created.

- [ ] **Step 3: Smoke-test the test runner**

Create `tests/smoke.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

Run: `node --test tests/smoke.test.js`
Expected: `✔ test runner works`

- [ ] **Step 4: Delete smoke test**

```bash
rm tests/smoke.test.js
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add test infrastructure (fake-indexeddb, node:test)"
```

---

## Task 2: New IndexedDB v2 schema

**Files:**
- Modify: `js/db.js`
- Create: `tests/db.test.js`

The v1 schema has stores: `concept_progress`, `quiz_sessions`, `user_stats`.
The v2 schema adds: `concepts-content`, `user-progress`.
`concept_progress` is **left in place** (orphaned, not deleted) — see Architecture note above.

- [ ] **Step 1: Write the failing tests for v2 schema**

Create `tests/db.test.js`:
```js
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `node --test tests/db.test.js`
Expected: FAIL — `openDB` not found or store assertions fail.

- [ ] **Step 3: Rewrite `js/db.js` with v2 schema**

Replace the entire file:

```js
const DB_VERSION = 2;
const DB_NAME_PROD = 'devbrain';

// Per-name connection cache. Tests pass unique names; production uses DB_NAME_PROD.
const dbMap = new Map();

export async function openDB(name = DB_NAME_PROD) {
  if (dbMap.has(name)) return dbMap.get(name);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;

      // New v2 stores
      if (!db.objectStoreNames.contains('concepts-content')) {
        db.createObjectStore('concepts-content', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('user-progress')) {
        db.createObjectStore('user-progress', { keyPath: 'id' });
      }

      // Retained stores
      if (!db.objectStoreNames.contains('quiz_sessions')) {
        db.createObjectStore('quiz_sessions', { keyPath: 'session_id' });
      }
      if (!db.objectStoreNames.contains('user_stats')) {
        db.createObjectStore('user_stats', { keyPath: 'id' });
      }

      // Migrate v1 concept_progress → user-progress (leave old store orphaned)
      if (event.oldVersion < 2 && db.objectStoreNames.contains('concept_progress')) {
        const oldStore = tx.objectStore('concept_progress');
        const newStore = tx.objectStore('user-progress');
        oldStore.getAll().onsuccess = (e) => {
          for (const record of e.target.result) {
            newStore.put(_migrateProgressRecord(record));
          }
        };
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      dbMap.set(name, db);
      _seedUserStats(db).then(() => resolve(db));
    };

    request.onerror = () => reject(request.error);
  });
}

/** TEST USE ONLY — clears cached connections so tests can open fresh databases. */
export function _resetDB() {
  for (const db of dbMap.values()) db.close();
  dbMap.clear();
}

function _migrateProgressRecord(old) {
  return {
    id: old.concept_id,
    seen: old.seen ?? false,
    practiced: old.practiced ?? false,
    next_review_date: old.next_review_date ?? null,
    last_review_date: old.last_seen_date ?? null,
    ease_factor: old.ease_factor ?? 2.5,
    interval: old.interval ?? 1,
    repetitions: old.repetitions ?? 0,
    used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
  };
}

async function _seedUserStats(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('user_stats', 'readwrite');
    const store = tx.objectStore('user_stats');
    const req = store.get(1);
    req.onsuccess = () => {
      if (!req.result) store.put({ id: 1, streak_days: 0, last_session_date: null });
    };
    tx.oncomplete = resolve;
  });
}

function getDB(name = DB_NAME_PROD) {
  const db = dbMap.get(name);
  if (!db) throw new Error(`DB "${name}" not opened. Call openDB("${name}") first.`);
  return db;
}

// ── Content store ──────────────────────────────────────────────────────────

export async function getContent(id, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concepts-content', 'readonly');
    tx.objectStore('concepts-content').get(id).onsuccess = (e) =>
      resolve(e.target.result ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllContent(dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concepts-content', 'readonly');
    tx.objectStore('concepts-content').getAll().onsuccess = (e) => resolve(e.target.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getContentByZone(zoneId, dbName = DB_NAME_PROD) {
  const all = await getAllContent(dbName);
  return all.filter((c) => !c.is_bridge && c.zone === zoneId);
}

export async function seedContent(concepts, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concepts-content', 'readwrite');
    const store = tx.objectStore('concepts-content');
    for (const concept of concepts) store.put(concept);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── User progress store ────────────────────────────────────────────────────

export async function getUserProgress(id, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user-progress', 'readonly');
    tx.objectStore('user-progress').get(id).onsuccess = (e) =>
      resolve(e.target.result ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllUserProgress(dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user-progress', 'readonly');
    tx.objectStore('user-progress').getAll().onsuccess = (e) => resolve(e.target.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function upsertUserProgress(data, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user-progress', 'readwrite');
    const req = tx.objectStore('user-progress').put(data);
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSeen(id, dbName = DB_NAME_PROD) {
  const existing = await getUserProgress(id, dbName);
  if (!existing || existing.seen) return;
  await upsertUserProgress({ ...existing, seen: true }, dbName);
}

export async function markPracticed(id, dbName = DB_NAME_PROD) {
  const existing = await getUserProgress(id, dbName);
  if (!existing || existing.practiced) return;
  await upsertUserProgress({ ...existing, practiced: true }, dbName);
}

// ── SRS helpers ────────────────────────────────────────────────────────────

export async function getSRSQueues(dbName = DB_NAME_PROD) {
  const today = new Date().toISOString().slice(0, 10);

  // Calendar-based 2-day cutoff (not 48-hour timestamp) to avoid day-boundary edge cases.
  const twoDaysAgoDate = new Date();
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
  const twoDaysAgo = twoDaysAgoDate.toISOString().slice(0, 10);

  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const contentMap = new Map(allContent.map((c) => [c.id, c]));

  const recommended = [];
  const overdue = [];

  for (const progress of allProgress) {
    const content = contentMap.get(progress.id);
    if (!content || !progress.seen) continue;
    const item = { content, progress };

    if (!progress.practiced) {
      // New: seen but never quizzed
      recommended.push(item);
    } else if (!progress.next_review_date) {
      // Practiced but no review date recorded — treat as due today
      recommended.push(item);
    } else if (progress.next_review_date >= twoDaysAgo && progress.next_review_date <= today) {
      // Due within the last 2 calendar days (§5.5 "Recommended today")
      recommended.push(item);
    } else if (progress.next_review_date < twoDaysAgo) {
      // More than 2 days overdue (§5.5 "Due for review")
      overdue.push(item);
    }
  }

  // Sort recommended: due-today items first, new items appended after
  recommended.sort((a, b) => {
    const aNew = !a.progress.practiced;
    const bNew = !b.progress.practiced;
    if (aNew !== bNew) return aNew ? 1 : -1;
    return (a.progress.next_review_date ?? '').localeCompare(b.progress.next_review_date ?? '');
  });

  // Sort overdue: most overdue first (smallest date first)
  overdue.sort((a, b) =>
    (a.progress.next_review_date ?? '').localeCompare(b.progress.next_review_date ?? ''),
  );

  return { recommended, overdue };
}

export async function getMapCoverageCount(dbName = DB_NAME_PROD) {
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const bridgeIds = new Set(allContent.filter((c) => c.is_bridge).map((c) => c.id));
  return allProgress.filter((p) => p.practiced && !bridgeIds.has(p.id)).length;
}

// ── Session history (unchanged API from v1) ────────────────────────────────

export async function saveSession(sessionData, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quiz_sessions', 'readwrite');
    const req = tx.objectStore('quiz_sessions').put(sessionData);
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStats(dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user_stats', 'readonly');
    tx.objectStore('user_stats').get(1).onsuccess = (e) =>
      resolve(e.target.result ?? { id: 1, streak_days: 0, last_session_date: null });
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateStats(data, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user_stats', 'readwrite');
    const req = tx.objectStore('user_stats').put({ ...data, id: 1 });
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 4: Run the schema tests**

Run: `node --test tests/db.test.js`
Expected: All 4 schema tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "feat: IndexedDB v2 schema — concepts-content and user-progress stores"
```

---

## Task 3: v1 → v2 migration

**Files:**
- Modify: `tests/db.test.js` (add migration test)

The migration test seeds a v1-style database using raw IndexedDB calls, then calls `openDB()` with the same name at version 2 (simulating the upgrade). This tests `db.js`'s own `onupgradeneeded` handler, not inline test code.

Because `openDB()` in `db.js` always opens at `DB_VERSION = 2`, we simulate v1 state by first opening the test DB at version 1 directly (bypassing `db.js`), seeding a `concept_progress` record, closing it, then calling `openDB()` on the same name — which triggers the upgrade.

- [ ] **Step 1: Add migration test to `tests/db.test.js`**

Append to `tests/db.test.js`:

```js
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
```

- [ ] **Step 2: Run all tests to confirm passing**

Run: `node --test tests/db.test.js`
Expected: All tests PASS including the new migration test.

- [ ] **Step 3: Commit**

```bash
git add tests/db.test.js
git commit -m "test: v1→v2 migration via db.js openDB upgrade path"
```

---

## Task 4: DB query API tests

**Files:**
- Modify: `tests/db.test.js` (add query API tests)

- [ ] **Step 1: Add query API tests**

Append to `tests/db.test.js`:

```js
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
```

- [ ] **Step 2: Run all tests**

Run: `node --test tests/db.test.js`
Expected: All tests PASS (schema + migration + query API).

- [ ] **Step 3: Commit**

```bash
git add tests/db.test.js
git commit -m "test: query API coverage — SRS queues, markSeen, coverage count, bridge exclusion"
```

---

## Task 5: `data/curriculum.json` — 3 sample concepts

**Files:**
- Create: `data/curriculum.json`
- Create: `data/` directory if it doesn't exist

Three concepts: `your-machine-os` (non-command, no anatomy/build), `your-machine-filesystem` (non-command), `shell-terminal-mkdir` (command with anatomy + build questions).

> **Source:** Read `/mnt/c/Users/A/Desktop/app/curriculum-content.md` for exact question text. Do not paraphrase. Convert verbatim. `correct_index` is 0-based.

**Question object format:**
```json
{ "prompt": "...", "options": ["A", "B", "C", "D"], "correct_index": 0 }
```

Non-command concepts have `anatomy: []` and `build: []`. Command concepts use anatomy/build arrays.

- [ ] **Step 1: Create `data/curriculum.json`**

```json
[
  {
    "id": "your-machine-os",
    "name": "Operating System (OS)",
    "zone": "your-machine",
    "subcategory": "operating-systems",
    "tier_unlocked": 1,
    "is_bridge": false,
    "bridge_zones": [],
    "what_it_is": "The operating system is the software that runs your computer before anything else starts. It manages your hardware (screen, keyboard, memory) and lets all your other programs run on top of it. Without it, your computer is just metal.",
    "analogy": "Think of it like the manager of a restaurant. The manager doesn't cook food or serve customers directly — but nothing works without them. They make sure the kitchen (hardware) and the waiters (apps) can all do their jobs without stepping on each other.",
    "examples": [
      { "text": "When you click a file to open it, your OS decides which app should open it, allocates the memory to run that app, and draws the window on screen. You never think about this — the OS just handles it.", "visible": true },
      { "text": "When you plug in a USB drive, your OS detects it, loads the correct driver to understand the device, and mounts it so you can see the files. Every device interaction goes through the OS first.", "visible": false },
      { "text": "When two apps want to use your Wi-Fi at the same time, the OS decides how to share the network connection between them. It's constantly juggling resources so nothing crashes into anything else.", "visible": false }
    ],
    "example_command": null,
    "use_when": "You hear someone ask \"what OS are you on?\" — they're asking whether you're using Windows, macOS, or Linux because the answer changes what commands you'll type and what software you can run.",
    "questions": {
      "definition": [
        {
          "prompt": "What is the main job of an operating system?",
          "options": [
            "It writes your code for you",
            "It manages your hardware and lets apps run on top of it",
            "It connects you to the internet",
            "It stores your files on the hard drive"
          ],
          "correct_index": 1
        },
        {
          "prompt": "Which of these is an operating system?",
          "options": ["Google Chrome", "Microsoft Word", "macOS", "VS Code"],
          "correct_index": 2
        }
      ],
      "usage": [
        {
          "prompt": "A developer says \"this app only runs on Linux.\" What does that mean?",
          "options": [
            "The app only works on computers made by Linux Inc.",
            "The app was built for the Linux OS and won't work on Windows or macOS without changes",
            "The app requires a Linux keyboard",
            "The app was written in the Linux programming language"
          ],
          "correct_index": 1
        },
        {
          "prompt": "You want to install a new program. Why does the OS matter?",
          "options": [
            "The OS controls how fast you can type",
            "All programs work on all operating systems without differences",
            "Different OSes use different file formats and system calls, so programs are built for specific ones",
            "The OS determines how expensive the program will be"
          ],
          "correct_index": 2
        },
        {
          "prompt": "Someone shares a `.exe` file with you. You're on a Mac. What's the problem?",
          "options": [
            ".exe files are too large for macOS",
            "macOS doesn't support files with more than 3 letters in the extension",
            ".exe is a Windows executable format — macOS uses a different format and can't run it directly",
            "You need to update your OS to open .exe files"
          ],
          "correct_index": 2
        },
        {
          "prompt": "When you open two apps at the same time and your computer slows down, what is the OS doing?",
          "options": [
            "Downloading updates in the background",
            "Waiting for you to close one app before allocating resources",
            "Sharing limited CPU and RAM between both apps simultaneously, causing resource contention",
            "Restarting its internal memory manager"
          ],
          "correct_index": 2
        },
        {
          "prompt": "A friend says their computer \"crashed.\" In OS terms, what most likely happened?",
          "options": [
            "The hard drive physically broke",
            "The internet connection dropped",
            "A program or the OS itself encountered an unrecoverable error and stopped executing",
            "The computer ran out of storage space"
          ],
          "correct_index": 2
        },
        {
          "prompt": "You install the same app on Windows and macOS. Why might it look slightly different on each?",
          "options": [
            "The app has two different codebases for aesthetic reasons",
            "Each OS provides its own UI components and rendering engine that apps use by default",
            "macOS displays everything 20% larger than Windows",
            "The app detects your screen resolution and adjusts accordingly"
          ],
          "correct_index": 1
        }
      ],
      "anatomy": [],
      "build": []
    }
  },
  {
    "id": "your-machine-filesystem",
    "name": "File System",
    "zone": "your-machine",
    "subcategory": "file-system",
    "tier_unlocked": 1,
    "is_bridge": false,
    "bridge_zones": [],
    "what_it_is": "The file system is how your computer organizes and stores everything on your hard drive. It's the system that knows where every file lives, what it's called, and how to find it when you ask for it.",
    "analogy": "It's like the filing cabinet system in an office. The cabinet itself is your hard drive. The drawers are folders. The files inside are documents. The file system is the rulebook that says how everything gets labeled and where it goes — so you can find it later.",
    "examples": [
      { "text": "When you save a Word document to your Desktop, the file system records its name, size, and exact location on the disk. When you double-click it later, the OS asks the file system \"where is this file?\" and gets directed straight to it.", "visible": true },
      { "text": "When you delete a file and empty the Trash, the file system marks that space as available — but the data isn't immediately gone. Until something else writes over that space, specialized tools can sometimes recover it.", "visible": false },
      { "text": "Different OSes use different file systems: Windows uses NTFS, macOS uses APFS, and most Linux systems use ext4. When you plug a USB drive formatted in NTFS into a Mac, macOS can usually read it — but it needs to understand the NTFS rulebook to do so.", "visible": false }
    ],
    "example_command": null,
    "use_when": "You hear someone talk about \"paths,\" \"directories,\" or \"where a file is stored\" — they're describing the file system structure. Understanding it helps you navigate the terminal confidently.",
    "questions": {
      "definition": [
        {
          "prompt": "What does the file system do?",
          "options": [
            "It scans files for viruses",
            "It organizes and tracks where every file is stored on your disk",
            "It compresses files to save space",
            "It syncs files to the cloud automatically"
          ],
          "correct_index": 1
        },
        {
          "prompt": "Which of these best describes the file system?",
          "options": [
            "A program you install to manage files",
            "A type of internet storage",
            "The rulebook your OS uses to store and find files on disk",
            "The physical hard drive in your computer"
          ],
          "correct_index": 2
        }
      ],
      "usage": [
        {
          "prompt": "You save a file to your Desktop. What role does the file system play?",
          "options": [
            "It uploads a backup to the cloud",
            "It records the file's name and exact location on disk so it can be retrieved later",
            "It converts the file into binary automatically",
            "It checks if the file already exists and deletes it if so"
          ],
          "correct_index": 1
        },
        {
          "prompt": "You delete a file and empty the Trash. Is the data truly gone?",
          "options": [
            "Yes — deleting a file immediately overwrites the data",
            "Yes — the file system erases it from the hard drive instantly",
            "No — the file system marks the space as available but doesn't wipe it immediately",
            "No — files are never deleted; they're just hidden"
          ],
          "correct_index": 2
        },
        {
          "prompt": "You plug a Windows-formatted USB into a Mac. Why can the Mac sometimes read it?",
          "options": [
            "All file systems are identical across OSes",
            "macOS automatically reformats the drive",
            "macOS includes support for the NTFS file system used by Windows",
            "The Mac copies the files to a temporary location before reading them"
          ],
          "correct_index": 2
        },
        {
          "prompt": "A developer mentions a \"path\" to a file. What are they describing?",
          "options": [
            "The network route the file takes to download",
            "The history of edits made to the file",
            "The file system address that locates the file on disk",
            "A type of encrypted file format"
          ],
          "correct_index": 2
        },
        {
          "prompt": "What happens when two files have the same name in the same folder?",
          "options": [
            "Both are kept — the file system adds a number to one",
            "The file system allows it and merges their contents",
            "The file system prevents it — only one file can use a given name in the same location",
            "Both files are renamed with a timestamp"
          ],
          "correct_index": 2
        },
        {
          "prompt": "Your hard drive is full. From a file system perspective, what can't happen?",
          "options": [
            "The OS can't find existing files",
            "The file system has no available space to record new file locations, so new files can't be saved",
            "Existing files are automatically compressed",
            "The file system resets to factory defaults"
          ],
          "correct_index": 1
        }
      ],
      "anatomy": [],
      "build": []
    }
  },
  {
    "id": "shell-terminal-mkdir",
    "name": "mkdir",
    "zone": "shell-terminal",
    "subcategory": "bash-commands",
    "tier_unlocked": 1,
    "is_bridge": false,
    "bridge_zones": [],
    "what_it_is": "`mkdir` stands for \"make directory.\" It creates a new folder from the terminal. One command, and you have a new directory exactly where you want it.",
    "analogy": "Exactly like right-clicking on your desktop and choosing \"New Folder\" — except you can name it, place it anywhere, and even create nested folders all in one command.",
    "examples": [
      { "text": "`mkdir my-project` creates a folder called `my-project` in your current directory. Run `ls` afterward and it appears in the list.", "visible": true },
      { "text": "`mkdir -p src/components/buttons` creates the full path even if `src` and `components` don't exist yet. The `-p` flag (\"parents\") creates all the intermediate directories automatically.", "visible": false },
      { "text": "`mkdir images css js` creates three directories at once in a single command. Separating names with spaces creates each as a separate directory.", "visible": false }
    ],
    "example_command": "mkdir my-project",
    "use_when": "Setting up a new project structure, adding a new section to an existing project, or whenever you need to create folders from the terminal without leaving the command line.",
    "questions": {
      "definition": [
        {
          "prompt": "What does `mkdir` do?",
          "options": [
            "Moves a directory to a new location",
            "Creates a new directory",
            "Lists the contents of a directory",
            "Deletes a directory"
          ],
          "correct_index": 1
        },
        {
          "prompt": "What does `mkdir` stand for?",
          "options": ["Modify Directory", "Move Directory", "Make Directory", "Map Directory"],
          "correct_index": 2
        }
      ],
      "usage": [
        {
          "prompt": "You want to create a folder called `components` inside an existing `src` folder without navigating into it. What do you type?",
          "options": [
            "mkdir components src",
            "touch src/components",
            "mkdir src/components",
            "cd src && touch components"
          ],
          "correct_index": 2
        },
        {
          "prompt": "You run `mkdir src/components/buttons` and get \"No such file or directory.\" What flag fixes this?",
          "options": ["-r", "-f", "-v", "-p — creates parent directories as needed"],
          "correct_index": 3
        },
        {
          "prompt": "What command creates three folders (`css`, `js`, `images`) at once?",
          "options": [
            "mkdir css+js+images",
            "mkdir css; mkdir js; mkdir images",
            "mkdir [css, js, images]",
            "mkdir css js images"
          ],
          "correct_index": 3
        }
      ],
      "anatomy": [
        {
          "prompt": "In `mkdir -p a/b/c`, if only `a` exists, what directories get created?",
          "options": [
            "Only `c`",
            "Only `b/c`",
            "`a` gets recreated, plus `b` and `c`",
            "`b` inside `a`, and `c` inside `b` — the full path is created"
          ],
          "correct_index": 3
        },
        {
          "prompt": "You run `mkdir my project` (with a space). What happens?",
          "options": [
            "Creates a directory called `my project`",
            "Creates nothing — spaces aren't allowed in names",
            "Creates two directories: `my` and `project`",
            "Creates a directory called `my_project`"
          ],
          "correct_index": 2
        }
      ],
      "build": [
        {
          "prompt": "What single command creates the directory structure `project/src/components`?",
          "options": [
            "mkdir project src components",
            "mkdir project && cd project && mkdir src && cd src && mkdir components",
            "mkdir -p project/src/components",
            "touch project/src/components"
          ],
          "correct_index": 2
        }
      ]
    }
  }
]
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data/curriculum.json','utf8')); console.log('concepts:', d.length, '| first id:', d[0].id)"`
Expected: `concepts: 3 | first id: your-machine-os`

- [ ] **Step 3: Commit**

```bash
git add data/curriculum.json
git commit -m "data: 3 sample concepts in v2 curriculum JSON format"
```

---

## Task 6: `data/globe-seeds.json` — all zones, subcategories, and concept seeds

**Files:**
- Create: `data/globe-seeds.json`

Seeds define `[longitude, latitude]` positions (D3 convention) for Voronoi generation. Zones spread evenly across the globe. Subcategory seeds cluster near their parent zone. Concept seeds sit within their subcategory cluster. All values are degrees.

This file is living config — concept entries for remaining ~100 concepts are added in Plan 6. Globe renderer silently skips concepts without a seed entry.

- [ ] **Step 1: Create `data/globe-seeds.json`**

```json
{
  "zones": [
    { "id": "your-machine",      "color": "#c678dd", "seed": [-30,  25] },
    { "id": "shell-terminal",    "color": "#e5c07b", "seed": [ 20, -15] },
    { "id": "git-github",        "color": "#e06c75", "seed": [ 60,  40] },
    { "id": "the-web",           "color": "#61afef", "seed": [110,  10] },
    { "id": "editor-code",       "color": "#98c379", "seed": [150, -35] },
    { "id": "packages-env",      "color": "#56b6c2", "seed": [-100, 50] },
    { "id": "ai-prompting",      "color": "#d19a66", "seed": [ -60, -50] },
    { "id": "cloud-deploy",      "color": "#abb2bf", "seed": [-150,  15] }
  ],
  "subcategories": [
    { "id": "operating-systems",   "zone": "your-machine",   "seed": [-32,  27] },
    { "id": "file-system",         "zone": "your-machine",   "seed": [-28,  23] },
    { "id": "system-concepts",     "zone": "your-machine",   "seed": [-26,  28] },

    { "id": "shell-core",          "zone": "shell-terminal", "seed": [ 18, -13] },
    { "id": "bash-commands",       "zone": "shell-terminal", "seed": [ 22, -17] },
    { "id": "powershell-commands", "zone": "shell-terminal", "seed": [ 24, -12] },
    { "id": "scripting",           "zone": "shell-terminal", "seed": [ 16, -18] },

    { "id": "git-core",            "zone": "git-github",     "seed": [ 58,  38] },
    { "id": "git-commands",        "zone": "git-github",     "seed": [ 62,  42] },
    { "id": "github",              "zone": "git-github",     "seed": [ 60,  36] },

    { "id": "how-web-works",       "zone": "the-web",        "seed": [108,   8] },
    { "id": "apis-data",           "zone": "the-web",        "seed": [112,  12] },
    { "id": "tools-security",      "zone": "the-web",        "seed": [110,   6] },

    { "id": "vscode",              "zone": "editor-code",    "seed": [148, -33] },
    { "id": "code-fundamentals",   "zone": "editor-code",    "seed": [152, -37] },
    { "id": "software-concepts",   "zone": "editor-code",    "seed": [150, -32] },

    { "id": "package-managers",    "zone": "packages-env",   "seed": [-102, 48] },
    { "id": "project-config",      "zone": "packages-env",   "seed": [  -98, 52] },
    { "id": "dependencies",        "zone": "packages-env",   "seed": [-100, 46] },

    { "id": "how-ai-works",        "zone": "ai-prompting",   "seed": [ -62, -52] },
    { "id": "using-ai-tools",      "zone": "ai-prompting",   "seed": [ -58, -48] },
    { "id": "prompting",           "zone": "ai-prompting",   "seed": [ -60, -54] },

    { "id": "deployment",          "zone": "cloud-deploy",   "seed": [-152,  13] },
    { "id": "databases",           "zone": "cloud-deploy",   "seed": [-148,  17] },
    { "id": "storage",             "zone": "cloud-deploy",   "seed": [-150,  12] }
  ],
  "concepts": [
    { "id": "your-machine-os",         "subcategory": "operating-systems", "seed": [-31,  26] },
    { "id": "your-machine-filesystem", "subcategory": "file-system",       "seed": [-29,  24] },
    { "id": "shell-terminal-mkdir",    "subcategory": "bash-commands",     "seed": [ 23, -18] }
  ]
}
```

- [ ] **Step 2: Validate structure**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('data/globe-seeds.json','utf8')); console.log('zones:', d.zones.length, '| subcategories:', d.subcategories.length, '| concepts:', d.concepts.length)"`
Expected: `zones: 8 | subcategories: 25 | concepts: 3`

- [ ] **Step 3: Commit**

```bash
git add data/globe-seeds.json
git commit -m "data: globe-seeds.json with all 8 zones and 25 subcategories"
```

---

## Task 7: `js/curriculum-loader.js`

**Files:**
- Create: `js/curriculum-loader.js`
- Create: `tests/curriculum-loader.test.js`

`loadCurriculum(dbName?)` is called once at app startup (after `openDB()`). It fetches `/data/curriculum.json` only if `concepts-content` is empty, then seeds both stores. Idempotent — safe to call on every app load.

- [ ] **Step 1: Write the failing tests**

Create `tests/curriculum-loader.test.js`:

```js
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
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `node --test tests/curriculum-loader.test.js`
Expected: FAIL — `loadCurriculum` not found.

- [ ] **Step 3: Implement `js/curriculum-loader.js`**

```js
import { getAllContent, seedContent, getAllUserProgress, upsertUserProgress } from './db.js';

const DEFAULT_PROGRESS = {
  seen: false,
  practiced: false,
  next_review_date: null,
  last_review_date: null,
  ease_factor: 2.5,
  interval: 1,
  repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
};

export async function loadCurriculum(dbName = 'devbrain') {
  const existing = await getAllContent(dbName);
  if (existing.length > 0) return; // already seeded — idempotent

  const response = await fetch('/data/curriculum.json');
  if (!response.ok) throw new Error(`Failed to load curriculum: ${response.status}`);
  const concepts = await response.json();

  await seedContent(concepts, dbName);

  const existingProgress = await getAllUserProgress(dbName);
  const seenIds = new Set(existingProgress.map((p) => p.id));

  for (const concept of concepts) {
    if (!seenIds.has(concept.id)) {
      await upsertUserProgress({ ...DEFAULT_PROGRESS, id: concept.id }, dbName);
    }
  }
}
```

- [ ] **Step 4: Run all curriculum-loader tests**

Run: `node --test tests/curriculum-loader.test.js`
Expected: All 3 tests PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests in both files PASS. Zero failures.

- [ ] **Step 6: Commit**

```bash
git add js/curriculum-loader.js tests/curriculum-loader.test.js
git commit -m "feat: curriculum-loader seeds concepts-content and user-progress on first load"
```

---

## Final verification

- [ ] **Run full test suite**

Run: `npm test`
Expected: All tests PASS. No warnings about leaked resources or unresolved promises.

- [ ] **Verify all files created**

Run: `ls js/db.js js/curriculum-loader.js data/curriculum.json data/globe-seeds.json package.json tests/db.test.js tests/curriculum-loader.test.js`
Expected: All 7 paths listed without errors.

- [ ] **Final commit**

```bash
git status  # confirm only intended files are modified/new
git add -A
git commit -m "feat: data foundation complete — v2 schema, curriculum loader, seed data"
```
