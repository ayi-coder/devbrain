const DB_NAME = 'devbrain';
const DB_VERSION = 1;
let dbInstance = null;

export async function openDB() {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('concept_progress')) {
        db.createObjectStore('concept_progress', { keyPath: 'concept_id' });
      }
      if (!db.objectStoreNames.contains('quiz_sessions')) {
        db.createObjectStore('quiz_sessions', { keyPath: 'session_id' });
      }
      if (!db.objectStoreNames.contains('user_stats')) {
        const statsStore = db.createObjectStore('user_stats', { keyPath: 'id' });
        // Seed is done after the transaction completes
      }
    };
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      // Seed user_stats if empty
      const tx = dbInstance.transaction('user_stats', 'readwrite');
      const store = tx.objectStore('user_stats');
      const getReq = store.get(1);
      getReq.onsuccess = () => {
        if (!getReq.result) {
          store.put({ id: 1, streak_days: 0, last_session_date: null });
        }
      };
      tx.oncomplete = () => resolve(dbInstance);
      tx.onerror = () => {
        console.error('DB seed failed:', tx.error);
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

function getDB() {
  if (!dbInstance) throw new Error('DB not opened. Call openDB() first.');
  return dbInstance;
}

export async function getProgress(conceptId) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concept_progress', 'readonly');
    const store = tx.objectStore('concept_progress');
    const req = store.get(conceptId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertProgress(data) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concept_progress', 'readwrite');
    const store = tx.objectStore('concept_progress');
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDueConceptIds() {
  const db = getDB();
  const today = new Date().toISOString().slice(0, 10);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concept_progress', 'readonly');
    const store = tx.objectStore('concept_progress');
    const req = store.getAll();
    req.onsuccess = () => {
      const due = req.result
        .filter((row) => row.next_review_date <= today)
        .map((row) => row.concept_id);
      resolve(due);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(sessionData) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quiz_sessions', 'readwrite');
    const store = tx.objectStore('quiz_sessions');
    const req = store.put(sessionData);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getStats() {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user_stats', 'readonly');
    const store = tx.objectStore('user_stats');
    const req = store.get(1);
    req.onsuccess = () => resolve(req.result || { id: 1, streak_days: 0, last_session_date: null });
    req.onerror = () => reject(req.error);
  });
}

export async function updateStats(data) {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('user_stats', 'readwrite');
    const store = tx.objectStore('user_stats');
    data.id = 1;
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProgress() {
  const db = getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('concept_progress', 'readonly');
    const store = tx.objectStore('concept_progress');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
