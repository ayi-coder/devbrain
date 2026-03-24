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

      // Migrate v1 concept_progress → user-progress (leave old store orphaned).
      // The upgrade transaction stays alive as long as there are pending requests on it.
      // getAll() queues a request; its onsuccess callback queues put() requests before
      // returning — so the transaction cannot commit until all puts complete. This is
      // correct IDB behavior per spec (not a race condition).
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
      // Due within the last 2 calendar days (spec §5.5 "Recommended today")
      recommended.push(item);
    } else if (progress.next_review_date < twoDaysAgo) {
      // More than 2 days overdue (spec §5.5 "Due for review")
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

export async function getRecentSessions(n = 5, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quiz_sessions', 'readonly');
    tx.objectStore('quiz_sessions').getAll().onsuccess = (e) => {
      const all = e.target.result;
      all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      resolve(all.slice(0, n));
    };
    tx.onerror = () => reject(tx.error);
  });
}
