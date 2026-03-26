import { ZONE_ORDER } from './zones.js';

const DB_VERSION = 3;
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

      // v3: saved_session store + migrate user-progress with new fields
      if (!db.objectStoreNames.contains('saved_session')) {
        db.createObjectStore('saved_session', { keyPath: 'id' });
      }
      if (event.oldVersion >= 1 && event.oldVersion < 3 && db.objectStoreNames.contains('user-progress')) {
        const store = tx.objectStore('user-progress');
        store.getAll().onsuccess = (e) => {
          for (const record of e.target.result) {
            if (record.last_seen_at === undefined)
              record.last_seen_at = null;
            if (record.wrong_answer_indices === undefined)
              record.wrong_answer_indices = { definition: [], usage: [], anatomy: [], build: [] };
            store.put(record);
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
    t2_unlocked: false,
    t3_unlocked: false,
    check_completed: false,
    check_used_indices: { definition: [] },
    last_seen_at: null,
    wrong_answer_indices: { definition: [], usage: [], anatomy: [], build: [] },
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

export async function addContentIfNew(concepts, dbName = DB_NAME_PROD) {
  if (!concepts || concepts.length === 0) return;
  const db = getDB(dbName);
  // Reads existing keys then adds only new ones (single-tab safe — concurrent writes
  // between transactions are not guarded). This avoids ConstraintError when called
  // multiple times from the same tab without touching records that already exist.
  const existingIds = await new Promise((resolve, reject) => {
    const tx = db.transaction('concepts-content', 'readonly');
    tx.objectStore('concepts-content').getAllKeys().onsuccess = (e) => resolve(new Set(e.target.result));
    tx.onerror = () => reject(tx.error);
  });
  const toAdd = concepts.filter((c) => !existingIds.has(c.id));
  if (toAdd.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concepts-content', 'readwrite');
    for (const concept of toAdd) tx.objectStore('concepts-content').add(concept);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
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
  if (!existing) return;
  await upsertUserProgress({
    ...existing,
    seen: true,
    last_seen_at: new Date().toISOString(),
  }, dbName);
}

export async function saveCheckCompletion(conceptId, usedIndices, dbName = DB_NAME_PROD) {
  const existing = await getUserProgress(conceptId, dbName);
  if (!existing) return;
  const currentUsed = existing.check_used_indices?.definition ?? [];
  const merged = [...new Set([...currentUsed, ...usedIndices])];
  await upsertUserProgress({
    ...existing,
    check_completed: true,
    check_used_indices: { definition: merged },
  }, dbName);
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

    // Skip concepts explored today — they're already in the "Explored Today" section
    if (progress.last_seen_at?.slice(0, 10) === today) continue;

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

/**
 * Returns a Map<YYYY-MM-DD, count> for all future review dates (after today).
 * Used to render the SRS calendar in the quiz stats view.
 */
export async function getUpcomingReviews(dbName = DB_NAME_PROD) {
  const today = new Date().toISOString().slice(0, 10);
  const allProgress = await getAllUserProgress(dbName);
  const byDate = new Map();
  for (const p of allProgress) {
    if (!p.practiced || !p.next_review_date) continue;
    if (p.next_review_date <= today) continue;
    byDate.set(p.next_review_date, (byDate.get(p.next_review_date) ?? 0) + 1);
  }
  return byDate;
}

export async function getMapCoverageCount(dbName = DB_NAME_PROD) {
  const { coverage } = await getConceptCounts(dbName);
  return coverage;
}

/** Returns { coverage: practiced non-bridge count, total: all non-bridge count }. */
export async function getConceptCounts(dbName = DB_NAME_PROD) {
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const bridgeIds = new Set(allContent.filter((c) => c.is_bridge).map((c) => c.id));
  const total = allContent.filter((c) => !c.is_bridge).length;
  const coverage = allProgress.filter((p) => p.practiced && !bridgeIds.has(p.id)).length;
  return { coverage, total };
}

/**
 * Returns all data needed for the Curriculum tab in one query.
 * { totalConcepts, zones, contentMap, progressMap }
 *
 * zones: array of { id, total, practiced, subcategories: [{id, total}] }
 *   ordered by ZONE_ORDER; only zones with at least one concept included.
 * contentMap: Map<conceptId, contentRecord>
 * progressMap: Map<conceptId, progressRecord>
 */
export async function getCurriculumData(dbName = DB_NAME_PROD) {
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);

  const progressMap = new Map(allProgress.map((p) => [p.id, p]));
  const contentMap = new Map(allContent.map((c) => [c.id, c]));

  // Index non-bridge concepts by zone → subcategory count
  const zoneIndex = new Map(); // zoneId → Map<subcatId, number>
  for (const c of allContent) {
    if (c.is_bridge) continue;
    if (!zoneIndex.has(c.zone)) zoneIndex.set(c.zone, new Map());
    const subcats = zoneIndex.get(c.zone);
    subcats.set(c.subcategory, (subcats.get(c.subcategory) ?? 0) + 1);
  }

  const allNonBridge = allContent.filter((c) => !c.is_bridge);

  const zones = ZONE_ORDER
    .filter((id) => zoneIndex.has(id))
    .map((zoneId) => {
      const subcats = zoneIndex.get(zoneId);
      const zoneContent = allNonBridge.filter((c) => c.zone === zoneId);
      const practiced = zoneContent.filter((c) => progressMap.get(c.id)?.practiced).length;
      return {
        id: zoneId,
        total: zoneContent.length,
        practiced,
        subcategories: [...subcats.entries()].map(([id, total]) => ({ id, total })),
      };
    });

  return { totalConcepts: allNonBridge.length, zones, contentMap, progressMap };
}

/**
 * Records a quiz answer: marks practiced, updates SM-2 scheduling fields,
 * and appends qIndex to used_question_indices[qType].
 *
 * Also sets t2_unlocked=true on first correct definition answer, t3_unlocked=true
 * on first correct usage answer. Preserves check_completed / check_used_indices
 * via ?? fallback for records that pre-date those fields.
 *
 * qType: 'definition' | 'usage' | 'anatomy' | 'build'
 * qIndex: 0-based index into concept.questions[qType]
 */
export async function applyQuizResult(conceptId, isCorrect, qType, qIndex, dbName = DB_NAME_PROD) {
  const existing = await getUserProgress(conceptId, dbName);
  if (!existing) return;

  const today = new Date().toISOString().slice(0, 10);
  let { ease_factor, interval, repetitions } = existing;

  if (isCorrect) {
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * ease_factor);
    ease_factor = Math.max(1.3, parseFloat((ease_factor + 0.1).toFixed(2)));
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
    ease_factor = Math.max(1.3, parseFloat((ease_factor - 0.2).toFixed(2)));
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const next_review_date = nextDate.toISOString().slice(0, 10);

  const usedForType = existing.used_question_indices[qType] ?? [];
  await upsertUserProgress({
    ...existing,
    practiced: true,
    t2_unlocked: (existing.t2_unlocked ?? false) || (isCorrect && qType === 'definition'),
    t3_unlocked: (existing.t3_unlocked ?? false) || (isCorrect && qType === 'usage'),
    check_completed: existing.check_completed ?? false,
    check_used_indices: existing.check_used_indices ?? { definition: [] },
    ease_factor,
    interval,
    repetitions,
    next_review_date,
    last_review_date: today,
    used_question_indices: {
      ...existing.used_question_indices,
      [qType]: usedForType.includes(qIndex) ? usedForType : [...usedForType, qIndex],
    },
  }, dbName);
}

// ── Session history (unchanged API from v1) ────────────────────────────────

export async function saveQuizSession(sessionData, dbName = DB_NAME_PROD) {
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

// ── Explored Today ──────────────────────────────────────────────────────────

export async function getExploredToday(dbName = DB_NAME_PROD) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const contentMap = new Map(allContent.map((c) => [c.id, c]));
  return allProgress
    .filter((p) => p.last_seen_at && p.last_seen_at > cutoff)
    .map((p) => ({ content: contentMap.get(p.id), progress: p }))
    .filter((item) => item.content);
}

// ── Wrong answer concepts ───────────────────────────────────────────────────

export async function getWrongAnswerConcepts(dbName = DB_NAME_PROD) {
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const contentMap = new Map(allContent.map((c) => [c.id, c]));
  return allProgress
    .filter((p) => {
      const w = p.wrong_answer_indices;
      return w && Object.values(w).some((arr) => arr.length > 0);
    })
    .map((p) => ({ content: contentMap.get(p.id), progress: p }))
    .filter((item) => item.content);
}

// ── Wrong answer update ─────────────────────────────────────────────────────

export async function applyWrongAnswers(conceptId, answers, dbName = DB_NAME_PROD) {
  const existing = await getUserProgress(conceptId, dbName);
  if (!existing) return;
  const wrong = {
    definition: [...(existing.wrong_answer_indices?.definition ?? [])],
    usage:      [...(existing.wrong_answer_indices?.usage      ?? [])],
    anatomy:    [...(existing.wrong_answer_indices?.anatomy    ?? [])],
    build:      [...(existing.wrong_answer_indices?.build      ?? [])],
  };
  for (const { type, index, correct } of answers) {
    if (!wrong[type]) wrong[type] = [];
    if (correct) {
      wrong[type] = wrong[type].filter((i) => i !== index);
    } else if (!wrong[type].includes(index)) {
      wrong[type].push(index);
    }
  }
  await upsertUserProgress({ ...existing, wrong_answer_indices: wrong }, dbName);
}

// ── Saved mid-session ───────────────────────────────────────────────────────

export async function getSavedSession(dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saved_session', 'readonly');
    tx.objectStore('saved_session').get(1).onsuccess = (e) =>
      resolve(e.target.result ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMidSession(data, dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saved_session', 'readwrite');
    const req = tx.objectStore('saved_session').put({ id: 1, ...data });
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSavedSession(dbName = DB_NAME_PROD) {
  const db = getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saved_session', 'readwrite');
    tx.objectStore('saved_session').delete(1);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
