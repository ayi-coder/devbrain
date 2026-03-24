# Navigation + Home Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-tab emoji nav with a 4-tab SVG icon nav (Home, Curriculum, Map, Quiz), implement the full Home tab UI, and wire up stub views for the three other tabs.

**Architecture:** Router gains hash query-param parsing for deep-links (`#quiz?preload=id`) — params live in the hash itself, not sessionStorage. A `zones.js` constant file provides zone→color mappings used by the Home view and later views. The Home tab reads exclusively from the v2 `db.js` API (no `adaptive.js`, no `window.CONCEPTS`). Curriculum/Map/Quiz tabs render stubs now — Plans 3–5 implement them. `db.js` gains `getRecentSessions(n)` to feed the Quiz Health card.

**Tech Stack:** Vanilla JS ES modules, IndexedDB via `js/db.js`, `node:test` built-in runner, `fake-indexeddb` for DB tests, no bundler.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `js/router.js` | Hash query-param parsing (`#quiz?preload=id`), 4-tab routing |
| Modify | `index.html` | 4-tab nav with SVG icon pairs, 4 view containers |
| Modify | `css/theme.css` | Active pill, backdrop blur, home card CSS |
| Modify | `js/db.js` | Add `getRecentSessions(n, dbName)` |
| Modify | `js/app.js` | Wire up new routes, call `loadCurriculum`, remove dead imports |
| Modify | `package.json` | Update test script to glob `tests/*.test.js` |
| Create | `js/zones.js` | Zone ID -> hex color map (8 zones) |
| Rewrite | `views/home.js` | Hero nudge card + Map Coverage + Quiz Health |
| Create | `views/curriculum.js` | Stub -- Plan 3 implements |
| Create | `views/map.js` | Stub -- Plan 4 implements |
| Rewrite | `views/quiz.js` | Stub -- Plan 5 implements |
| Create | `tests/router.test.js` | Hash parsing unit tests |
| Create | `tests/home.test.js` | Home tab render tests |
| Modify | `tests/db.test.js` | Add `getRecentSessions` tests |

---

### Task 1: Router -- hash query-param parsing

**Files:**
- Modify: `js/router.js`
- Create: `tests/router.test.js`

The current router uses `sessionStorage` for route params and parses `#learn/id` path-style params.
The spec requires `#quiz?preload=concept-id` query-param style. Extract two pure functions
(`parseHashParams`, `buildHashString`) that can be unit-tested in Node.js without a DOM.
Keep the `quizActive` guard and tab-highlight logic. Route handlers now receive a `params`
object `(params)` instead of a path string.

**Context:**
- Current `navigate(hash, params)` puts params in `sessionStorage` -- replace with hash-native params.
- Current `routes[view](rest.join('/'))` passes a path segment string -- replace with `routes[view](params)`.
- `getParams()` is removed; callers use `params` received directly by the route handler.

- [ ] **Step 1: Write the failing tests**

Create `tests/router.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHashParams, buildHashString } from '../js/router.js';

describe('parseHashParams', () => {
  it('parses view from plain hash', () => {
    assert.deepEqual(parseHashParams('#quiz'), { view: 'quiz', params: {} });
  });

  it('parses view and single query param', () => {
    assert.deepEqual(
      parseHashParams('#quiz?preload=my-concept'),
      { view: 'quiz', params: { preload: 'my-concept' } },
    );
  });

  it('parses multiple query params', () => {
    const { view, params } = parseHashParams('#home?foo=1&bar=2');
    assert.equal(view, 'home');
    assert.equal(params.foo, '1');
    assert.equal(params.bar, '2');
  });

  it('defaults to home for empty string', () => {
    assert.deepEqual(parseHashParams(''), { view: 'home', params: {} });
  });

  it('defaults to home for bare hash', () => {
    assert.deepEqual(parseHashParams('#'), { view: 'home', params: {} });
  });

  it('decodes URI-encoded param values', () => {
    const { params } = parseHashParams('#quiz?preload=my%20concept');
    assert.equal(params.preload, 'my concept');
  });
});

describe('buildHashString', () => {
  it('builds hash from view only', () => {
    assert.equal(buildHashString('home', {}), 'home');
  });

  it('builds hash with a single query param', () => {
    assert.equal(buildHashString('quiz', { preload: 'my-concept' }), 'quiz?preload=my-concept');
  });

  it('omits params with empty string values', () => {
    assert.equal(buildHashString('quiz', { preload: '' }), 'quiz');
  });

  it('round-trips through parseHashParams', () => {
    const original = { view: 'quiz', params: { preload: 'shell-terminal-mkdir' } };
    const hash = '#' + buildHashString(original.view, original.params);
    assert.deepEqual(parseHashParams(hash), original);
  });
});
```

- [ ] **Step 2: Run tests -- expect FAIL**

```bash
node --test tests/router.test.js
```
Expected: `TypeError: parseHashParams is not a function` or import error.

- [ ] **Step 3: Implement the new router.js**

Replace all of `js/router.js` with:

```js
let quizActive = false;

export function setQuizActive(val) {
  quizActive = val;
}

/**
 * Pure function -- exported for tests.
 * Parses a full location.hash string (e.g. '#quiz?preload=foo') into { view, params }.
 */
export function parseHashParams(hash) {
  const raw = (hash || '').replace(/^#/, '') || 'home';
  const [path, query] = raw.split('?');
  const view = path.split('/')[0] || 'home';
  const params = {};
  if (query) {
    for (const part of query.split('&')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const k = decodeURIComponent(part.slice(0, eqIdx));
      const v = decodeURIComponent(part.slice(eqIdx + 1));
      params[k] = v;
    }
  }
  return { view, params };
}

/**
 * Pure function -- exported for tests.
 * Builds a hash string from a view name and optional params object.
 * Omits params with empty/undefined values.
 */
export function buildHashString(view, params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return view;
  const query = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${view}?${query}`;
}

export function navigate(view, params = {}) {
  location.hash = buildHashString(view, params);
}

export function initRouter(routes) {
  window.addEventListener('hashchange', () => handleRoute(routes));
  handleRoute(routes);
}

function handleRoute(routes) {
  const { view, params } = parseHashParams(location.hash);

  if (quizActive && view !== 'quiz') {
    const leave = confirm('Quit quiz? Progress will be lost.');
    if (!leave) {
      location.hash = 'quiz';
      return;
    }
    quizActive = false;
  }

  document.querySelectorAll('.view').forEach((el) => el.classList.remove('view--active'));

  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('view--active');

  if (routes[view]) routes[view](params);

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('nav-tab--active', tab.dataset.view === view);
  });
}
```

- [ ] **Step 4: Run tests -- expect PASS**

```bash
node --test tests/router.test.js
```
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/router.js tests/router.test.js
git commit -m "feat: router supports hash query params (#quiz?preload=id)"
```

---

### Task 2: index.html -- 4-tab nav + view containers

**Files:**
- Modify: `index.html`

Replace the 3-emoji tab nav with a 4-tab SVG nav. Update view containers: remove `view-concepts`,
`view-learn`, `view-results`, `view-progress`; add `view-curriculum`, `view-map`. Keep `view-home`
and `view-quiz`.

Each tab button structure:
- `.nav-tab__pill` span (holds icon pair -- pill background on active)
- `.icon-outline` SVG (shown inactive) + `.icon-filled` SVG (shown active)
- `.nav-tab__label` span

No `onclick` attributes -- router handles navigation via `hashchange`.
No automated tests -- structure verified by browser.

- [ ] **Step 1: Replace index.html content**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0d0f14">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>DevBrain</title>
  <link rel="manifest" href="./manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/theme.css">
</head>
<body>
  <div id="app">
    <div id="view-home" class="view"></div>
    <div id="view-curriculum" class="view"></div>
    <div id="view-map" class="view"></div>
    <div id="view-quiz" class="view"></div>
  </div>

  <nav class="bottom-nav" id="bottom-nav">

    <!-- HOME -->
    <button class="nav-tab" data-view="home" aria-label="Home">
      <span class="nav-tab__pill">
        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          <path d="M9 21V12h6v9"/>
        </svg>
        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true">
          <path d="M12 2.5L2.25 10.1a.75.75 0 00-.25.565V21a.75.75 0 00.75.75H9a.75.75 0 00.75-.75v-6h4.5v6a.75.75 0 00.75.75h6.25a.75.75 0 00.75-.75V10.665a.75.75 0 00-.25-.565L12 2.5z"/>
        </svg>
      </span>
      <span class="nav-tab__label">Home</span>
    </button>

    <!-- CURRICULUM -->
    <button class="nav-tab" data-view="curriculum" aria-label="Curriculum">
      <span class="nav-tab__pill">
        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true">
          <rect x="3" y="4.75" width="18" height="2.5" rx="1.25"/>
          <rect x="3" y="10.75" width="18" height="2.5" rx="1.25"/>
          <rect x="3" y="16.75" width="18" height="2.5" rx="1.25"/>
        </svg>
      </span>
      <span class="nav-tab__label">Curriculum</span>
    </button>

    <!-- MAP -->
    <button class="nav-tab" data-view="map" aria-label="Map">
      <span class="nav-tab__pill">
        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <path d="M3.6 9h16.8M3.6 15h16.8"/>
          <path d="M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9"/>
          <path d="M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9"/>
        </svg>
        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1
            17.93V17h2v2.93c-.33.04-.66.07-1 .07s-.67-.03-1-.07zM4.07 13H7v2.63A8.01 8.01
            0 014.07 13zm0-2A8.01 8.01 0 016.93 7H7v4H4.07V11zM13 4.07V7h-2V4.07c.33-.04
            .66-.07 1-.07s.67.03 1 .07zm4 1.19A8.01 8.01 0 0119.93 11H17V7l.07-.74zm2.93
            7.74H17v4h2.93A8.01 8.01 0 0119.93 13zM9 17.74V13H7v4.74A8.01 8.01 0 009
            17.74zm6-11.48V11h2V6.26A8.01 8.01 0 0015 6.26zM9 6.26V11H7V6.26A8.01 8.01
            0 019 6.26zm6 11.48V13h-2v4.74A8.01 8.01 0 0015 17.74z"/>
        </svg>
      </span>
      <span class="nav-tab__label">Map</span>
    </button>

    <!-- QUIZ -->
    <button class="nav-tab" data-view="quiz" aria-label="Quiz">
      <span class="nav-tab__pill">
        <svg class="icon-outline" width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <path d="M13 2L4 13h7l-1 9 9-11h-7l1-9z"/>
        </svg>
        <svg class="icon-filled" width="22" height="22" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true">
          <path d="M12.2 2.2a.75.75 0 01.65.82L11.7 11H18a.75.75 0 01.58 1.22l-8.25
            10a.75.75 0 01-1.33-.6L10.3 13H4a.75.75 0 01-.58-1.22l8.25-10a.75.75 0
            01.53-.28z"/>
        </svg>
      </span>
      <span class="nav-tab__label">Quiz</span>
    </button>

  </nav>

  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: 4-tab nav with SVG icon pairs and new view containers"
```

---

### Task 3: CSS -- tab bar visual + home card styles

**Files:**
- Modify: `css/theme.css`

Update `.bottom-nav` and `.nav-tab` for the new design. Add home-screen card CSS classes.
No automated tests.

**Key spec requirements:**
- Active tab: filled icon + `#61afef` text + `rgba(97,175,239,0.08)` pill background
- Inactive: outline icon + `#3e4451` text
- Nav: `backdrop-filter: blur(12px)` + semi-transparent bg + `border-top: 1px solid #1a1e28`
- Icon toggle via CSS only (no JS)

- [ ] **Step 1: Replace the bottom nav CSS block**

Find the `/* Bottom nav */` comment block in `css/theme.css` (starts at the `.bottom-nav` rule
around line 119) and replace the entire block through `.nav-tab--active {}` with:

```css
/* Bottom nav */
.bottom-nav {
  position: fixed;
  bottom: 0;
  width: 100%;
  max-width: 480px;
  display: flex;
  background: rgba(16, 18, 26, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid #1a1e28;
  z-index: 100;
}
.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 8px;
  color: #3e4451;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: none;
  min-height: 52px;
  gap: 2px;
  -webkit-tap-highlight-color: transparent;
}
.nav-tab__pill {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 56px;
  height: 28px;
  border-radius: 14px;
  transition: background 0.15s;
}
.nav-tab__label {
  font-size: 10px;
  line-height: 1;
}
/* Inactive: outline icon visible */
.nav-tab .icon-filled  { display: none; }
.nav-tab .icon-outline { display: block; }
/* Active: filled icon + blue text + pill background */
.nav-tab--active { color: #61afef; }
.nav-tab--active .nav-tab__pill { background: rgba(97, 175, 239, 0.08); }
.nav-tab--active .icon-outline { display: none; }
.nav-tab--active .icon-filled  { display: block; }
```

- [ ] **Step 2: Append home screen CSS**

Append to the end of `css/theme.css`:

```css
/* ── Home screen ──────────────────────────────────────────────── */

.home-topbar {
  display: flex;
  align-items: center;
  padding: 14px 0 10px;
}
.home-logo {
  font-size: 17px;
  font-weight: 800;
  color: #e5c07b;
  letter-spacing: -0.3px;
}

/* Hero card */
.home-hero {
  background: linear-gradient(135deg, #161d2e, #111620);
  border: 1px solid rgba(97, 175, 239, 0.2);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 14px;
}
.home-hero__tag {
  font-size: 11px;
  font-weight: 600;
  color: #61afef;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.home-hero__title {
  font-size: 22px;
  font-weight: 700;
  color: #e5e9f0;
  margin-bottom: 4px;
  line-height: 1.2;
}
.home-hero__subtitle {
  font-size: 13px;
  color: #4b5263;
  margin-bottom: 14px;
}
.home-hero__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.home-hero__pill {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 4px 10px 4px 7px;
  font-size: 12px;
  color: #abb2bf;
}
.home-hero__pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.home-hero__cta {
  width: 100%;
  background: rgba(97, 175, 239, 0.12);
  border: 1px solid rgba(97, 175, 239, 0.3);
  border-radius: 10px;
  color: #61afef;
  font-size: 14px;
  font-weight: 600;
  padding: 11px 16px;
  cursor: pointer;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}
.home-hero__cta:active { background: rgba(97, 175, 239, 0.2); }

/* Stats row */
.home-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.home-stat-card {
  background: #1a1e28;
  border-radius: 14px;
  padding: 14px;
}
.home-stat-card__title {
  font-size: 11px;
  color: #4b5263;
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.home-stat-card__number {
  font-size: 32px;
  font-weight: 700;
  color: #e5e9f0;
  line-height: 1;
  margin-bottom: 2px;
}
.home-stat-card__label {
  font-size: 11px;
  color: #4b5263;
  margin-bottom: 10px;
}
.home-stat-card__bar {
  height: 4px;
  background: #252935;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}
.home-stat-card__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #61afef, #56b6c2);
  border-radius: 4px;
  transition: width 0.4s ease;
}
.home-stat-card__milestone { font-size: 11px; color: #4b5263; }

.home-health {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.home-health__dots { display: flex; gap: 5px; }
.home-health__dot  { width: 10px; height: 10px; border-radius: 50%; }
.home-health__label { font-size: 10px; color: #4b5263; }
.home-health__empty { font-size: 12px; color: #4b5263; text-align: center; padding: 8px 0; }
```

- [ ] **Step 3: Commit**

```bash
git add css/theme.css
git commit -m "style: tab bar active pill, backdrop blur, home card CSS"
```

---

### Task 4: db.js -- getRecentSessions

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

Add `getRecentSessions(n, dbName)` to `js/db.js`. Reads from `quiz_sessions` store, sorts by
`date` field descending, returns up to `n` sessions.

**v2 session record shape** (Plan 5 will write these):
```json
{ "session_id": "uuid", "date": "2026-03-25", "total_questions": 9, "correct_count": 7 }
```
Sessions without a `date` field (v1 format) sort to the bottom and won't surface in last-5.

- [ ] **Step 1: Write the failing tests**

Add `getRecentSessions` to the existing import line at the top of `tests/db.test.js`:
```js
import { openDB, _resetDB, seedContent, getAllContent, getContentByZone,
  getUserProgress, getAllUserProgress, upsertUserProgress, markSeen,
  getSRSQueues, getMapCoverageCount, saveSession, getRecentSessions } from '../js/db.js';
```

Then append this describe block at the end of `tests/db.test.js`:

```js
describe('getRecentSessions', () => {
  it('returns empty array when no sessions exist', async () => {
    const dbName = uid();
    await openDB(dbName);
    const result = await getRecentSessions(5, dbName);
    assert.deepEqual(result, []);
  });

  it('returns sessions sorted newest-first', async () => {
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

  it('caps results at n', async () => {
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
```

- [ ] **Step 2: Run new tests -- expect FAIL**

```bash
npm test
```
Expected: existing 15 tests pass, 3 new `getRecentSessions` tests fail with import error.

- [ ] **Step 3: Implement getRecentSessions in db.js**

Add after the `updateStats` function at the end of `js/db.js`:

```js
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
```

- [ ] **Step 4: Run all tests -- expect PASS**

```bash
npm test
```
Expected: 15 + 3 = 18 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "feat: db.js getRecentSessions -- returns quiz_sessions sorted newest-first"
```

---

### Task 5: zones.js + stub views

**Files:**
- Create: `js/zones.js`
- Create: `views/curriculum.js`
- Create: `views/map.js`
- Rewrite: `views/quiz.js`

Zone-color constants used by Home and all future views. Stub views accept the same
`(container, params, dbName)` signature that `app.js` will call.

No automated tests for this task.

- [ ] **Step 1: Create js/zones.js**

```js
/**
 * Zone ID -> hex color.
 * Pass zone ID from a content record's .zone field.
 * Bridge nodes have no zone -- use zoneColor(undefined) which returns the 'bridge' fallback.
 */
export const ZONE_COLORS = {
  'your-machine':   '#c678dd',
  'shell-terminal': '#e5c07b',
  'git-github':     '#e06c75',
  'the-web':        '#61afef',
  'editor-code':    '#98c379',
  'packages-env':   '#56b6c2',
  'ai-prompting':   '#d19a66',
  'cloud-deploy':   '#abb2bf',
  'bridge':         '#abb2bf',
};

export function zoneColor(zoneId) {
  return ZONE_COLORS[zoneId] ?? ZONE_COLORS['bridge'];
}
```

- [ ] **Step 2: Create views/curriculum.js**

```js
// Stub -- full implementation in Plan 3.
export function renderCurriculum(container, params = {}, dbName = 'devbrain') {
  container.innerHTML =
    '<div style="padding:60px 0;text-align:center;color:#4b5263">' +
    '<div style="font-size:32px;margin-bottom:12px">&#x1F4DA;</div>' +
    '<div style="font-size:15px;font-weight:600;color:#5c6370;margin-bottom:6px">Coming in Plan 3</div>' +
    '<div style="font-size:13px">Zone accordion and lesson reader</div>' +
    '</div>';
}
```

- [ ] **Step 3: Create views/map.js**

```js
// Stub -- full implementation in Plan 4.
export function renderMap(container, params = {}, dbName = 'devbrain') {
  container.innerHTML =
    '<div style="padding:60px 0;text-align:center;color:#4b5263">' +
    '<div style="font-size:32px;margin-bottom:12px">&#x1F30D;</div>' +
    '<div style="font-size:15px;font-weight:600;color:#5c6370;margin-bottom:6px">Coming in Plan 4</div>' +
    '<div style="font-size:13px">D3 globe with zone panels</div>' +
    '</div>';
}
```

- [ ] **Step 4: Rewrite views/quiz.js**

```js
// Stub -- full implementation in Plan 5.
export function renderQuiz(container, params = {}, dbName = 'devbrain') {
  const preloadNote = params.preload
    ? '<div style="margin-top:12px;font-size:12px;color:#3e4451">Preloading: ' + params.preload + '</div>'
    : '';
  container.innerHTML =
    '<div style="padding:60px 0;text-align:center;color:#4b5263">' +
    '<div style="font-size:32px;margin-bottom:12px">&#x26A1;</div>' +
    '<div style="font-size:15px;font-weight:600;color:#5c6370;margin-bottom:6px">Coming in Plan 5</div>' +
    '<div style="font-size:13px">Session builder and SRS recommendations</div>' +
    preloadNote +
    '</div>';
}
```

- [ ] **Step 5: Commit**

```bash
git add js/zones.js views/curriculum.js views/map.js views/quiz.js
git commit -m "feat: zones.js color map + stub views for curriculum, map, quiz tabs"
```

---

### Task 6: Home tab -- hero card + secondary stats cards

**Files:**
- Rewrite: `views/home.js`
- Create: `tests/home.test.js`

Complete rewrite of the Home tab using the v2 db.js API exclusively. Renders:
1. **Top bar** -- "DevBrain" logo left-aligned
2. **Hero card** -- count of due concepts (recommended + overdue), up to 5 concept pills
   (zone color dot + name), "Go to Quiz" CTA navigating to `#quiz`
3. **Stats row** -- Map Coverage card + Quiz Health card

**Hero empty state:** when `totalDue === 0`, show "All caught up" copy (CTA still present).
**Quiz Health empty state:** "Play your first quiz" when no sessions.

All innerHTML content in this file comes from app-controlled sources (db.js records seeded
from curriculum.json, which is app-bundled). No user-typed content is ever interpolated.

**Data fetched in parallel:**
- `getSRSQueues(dbName)` -- recommended + overdue for hero
- `getMapCoverageCount(dbName)` -- practiced non-bridge count
- `getAllContent(dbName)` -- total non-bridge count for progress bar denominator
- `getRecentSessions(5, dbName)` -- last 5 sessions for Quiz Health

- [ ] **Step 1: Write the failing tests**

Create `tests/home.test.js`:

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, _resetDB, seedContent, upsertUserProgress, saveSession } from '../js/db.js';
import { renderHome } from '../views/home.js';

// Stub location so navigate() calls in renderHome don't throw in Node.js
globalThis.location = { hash: '' };

let uid = 0;
const mkName = () => 'home-test-' + (++uid);

function makeMockContainer() {
  let html = '';
  const mockEl = { addEventListener() {} };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector() { return mockEl; },
    querySelectorAll() { return []; },
  };
}

const sampleConcept = {
  id: 'c1', name: 'mkdir', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Makes a directory.', analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'mkdir foo',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};

const sampleBridge = {
  id: 'b1', name: 'stdin', is_bridge: true, bridge_zones: ['shell-terminal', 'editor-code'],
  tier_unlocked: 1, what_it_is: '', analogy: '', use_when: '',
  examples: [], questions: { definition: [], usage: [], anatomy: [], build: [] },
};

describe('renderHome', () => {
  beforeEach(() => _resetDB());

  it('shows due count and Ready tag when concepts are due', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await upsertUserProgress({
      id: 'c1', seen: true, practiced: true,
      next_review_date: yesterday.toISOString().slice(0, 10),
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 1,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderHome(container, {}, dbName);

    assert.ok(container.innerHTML.includes('1 concept'), 'should show "1 concept due"');
    assert.ok(container.innerHTML.includes('Ready for today'), 'should show ready tag');
  });

  it('shows all-caught-up state when nothing is due', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderHome(container, {}, dbName);

    assert.ok(container.innerHTML.includes('All caught up'), 'empty state missing');
  });

  it('Map Coverage excludes bridge nodes', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleBridge], dbName);
    // Both practiced -- only c1 (non-bridge) should count
    for (const id of ['c1', 'b1']) {
      await upsertUserProgress({
        id, seen: true, practiced: true, next_review_date: null,
        last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 1,
        used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
      }, dbName);
    }

    const container = makeMockContainer();
    await renderHome(container, {}, dbName);

    // The number 1 rendered inside a tag -- bridge b1 is excluded
    assert.ok(/>\s*1\s*</.test(container.innerHTML), 'Map Coverage should be 1 (bridge excluded)');
    assert.ok(container.innerHTML.includes('Map Coverage'));
  });

  it('shows Quiz Health empty state when no sessions', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);

    const container = makeMockContainer();
    await renderHome(container, {}, dbName);

    assert.ok(container.innerHTML.includes('Play your first quiz'));
  });

  it('colors green session dot for high-scoring session', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({
      id: 'c1', seen: false, practiced: false, next_review_date: null,
      last_review_date: null, ease_factor: 2.5, interval: 1, repetitions: 0,
      used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
    }, dbName);
    // 80% correct -- should be green (#98c379)
    await saveSession({ session_id: 's1', date: '2026-03-24', total_questions: 5, correct_count: 4 }, dbName);

    const container = makeMockContainer();
    await renderHome(container, {}, dbName);

    assert.ok(container.innerHTML.includes('home-health__dot'));
    assert.ok(container.innerHTML.includes('#98c379'), 'green dot for 80% score');
  });
});
```

- [ ] **Step 2: Run tests -- expect FAIL**

```bash
node --test tests/home.test.js
```
Expected: fails -- `renderHome` doesn't exist / wrong API.

- [ ] **Step 3: Implement views/home.js**

```js
import { getSRSQueues, getMapCoverageCount, getAllContent, getRecentSessions } from '../js/db.js';
import { zoneColor } from '../js/zones.js';
import { navigate } from '../js/router.js';

function nextMilestone(count) {
  for (const m of [10, 25, 50, 75, 100, 150, 200]) {
    if (m > count) return m;
  }
  return count + 50;
}

function buildRingSVG(pct) {
  const r = 15;
  const circ = 2 * Math.PI * r; // ~94.25
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#98c379' : pct >= 40 ? '#e5c07b' : '#e06c75';
  return '<svg viewBox="0 0 36 36" width="52" height="52">' +
    '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="#252935" stroke-width="3.5"/>' +
    '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="3.5"' +
    ' stroke-dasharray="' + dash.toFixed(2) + ' ' + circ.toFixed(2) + '"' +
    ' stroke-linecap="round" transform="rotate(-90 18 18)"/>' +
    '<text x="18" y="22" text-anchor="middle" font-size="7.5" fill="#abb2bf"' +
    ' font-family="Roboto,sans-serif" font-weight="600">' + pct + '%</text>' +
    '</svg>';
}

function buildSessionDots(sessions) {
  if (sessions.length === 0) {
    return '<div class="home-health__empty">Play your first quiz</div>';
  }
  const dots = sessions.slice(0, 5).map((s) => {
    const pct = s.total_questions > 0 ? s.correct_count / s.total_questions : 0;
    const color = pct >= 0.70 ? '#98c379' : pct >= 0.40 ? '#e5c07b' : '#e06c75';
    return '<div class="home-health__dot" style="background:' + color + '" title="' + Math.round(pct * 100) + '%"></div>';
  }).join('');
  const label = sessions.length + ' session' + (sessions.length !== 1 ? 's' : '');
  return '<div class="home-health__dots">' + dots + '</div>' +
         '<div class="home-health__label">last ' + label + '</div>';
}

export async function renderHome(container, params = {}, dbName = 'devbrain') {
  const [{ recommended, overdue }, mapCoverage, allContent, recentSessions] = await Promise.all([
    getSRSQueues(dbName),
    getMapCoverageCount(dbName),
    getAllContent(dbName),
    getRecentSessions(5, dbName),
  ]);

  const totalDue = recommended.length + overdue.length;
  const totalNonBridge = allContent.filter((c) => !c.is_bridge).length;
  const coveragePct = totalNonBridge > 0
    ? Math.min(100, Math.round((mapCoverage / totalNonBridge) * 100))
    : 0;
  const milestone = nextMilestone(mapCoverage);
  const estMin = Math.max(2, totalDue * 2);

  const healthPct = recentSessions.length === 0 ? 0
    : Math.round(
        (recentSessions.filter((s) =>
          s.total_questions > 0 && s.correct_count / s.total_questions > 0.6
        ).length / recentSessions.length) * 100
      );

  // Concept pills -- up to 5 from recommended, zone color dot + name.
  // All values come from app-bundled curriculum.json; no user-typed content is interpolated.
  const pillsHTML = recommended.slice(0, 5).map(({ content }) => {
    const color = zoneColor(content.zone);
    return '<div class="home-hero__pill">' +
      '<span class="home-hero__pill-dot" style="background:' + color + '"></span>' +
      content.name +
      '</div>';
  }).join('');

  const heroBody = totalDue > 0
    ? '<div class="home-hero__tag">\u2736 Ready for today</div>' +
      '<div class="home-hero__title">' + totalDue + ' concept' + (totalDue !== 1 ? 's' : '') + ' due</div>' +
      '<div class="home-hero__subtitle">Based on your last session \u00b7 ~' + estMin + ' min</div>' +
      '<div class="home-hero__pills">' + pillsHTML + '</div>' +
      '<button class="home-hero__cta" id="btn-go-quiz">Go to Quiz \u2192</button>'
    : '<div class="home-hero__tag">\u2736 All caught up</div>' +
      '<div class="home-hero__title">Nothing due today</div>' +
      '<div class="home-hero__subtitle">Check back tomorrow \u2014 your next review is scheduled</div>' +
      '<button class="home-hero__cta" id="btn-go-quiz">Go to Quiz \u2192</button>';

  container.innerHTML =
    '<div class="home-topbar"><span class="home-logo">DevBrain</span></div>' +
    '<div class="home-hero">' + heroBody + '</div>' +
    '<div class="home-stats">' +
      '<div class="home-stat-card">' +
        '<div class="home-stat-card__title">Map Coverage</div>' +
        '<div class="home-stat-card__number">' + mapCoverage + '</div>' +
        '<div class="home-stat-card__label">concepts explored</div>' +
        '<div class="home-stat-card__bar">' +
          '<div class="home-stat-card__bar-fill" style="width:' + coveragePct + '%"></div>' +
        '</div>' +
        '<div class="home-stat-card__milestone">Next: ' + milestone + ' concepts</div>' +
      '</div>' +
      '<div class="home-stat-card">' +
        '<div class="home-stat-card__title">Quiz Health</div>' +
        '<div class="home-health">' +
          (recentSessions.length > 0 ? buildRingSVG(healthPct) : '') +
          buildSessionDots(recentSessions) +
        '</div>' +
      '</div>' +
    '</div>';

  container.querySelector('#btn-go-quiz').addEventListener('click', () => navigate('quiz'));
}
```

- [ ] **Step 4: Run all tests -- expect PASS**

```bash
npm test
```
Expected: 18 existing + 5 new = 23 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add views/home.js tests/home.test.js
git commit -m "feat: home tab -- hero nudge card, map coverage, quiz health"
```

---

### Task 7: app.js wiring + package.json

**Files:**
- Modify: `js/app.js`
- Modify: `package.json`

Rewrite `app.js` to use the new v2 API: `openDB()` + `loadCurriculum()`, 4 new routes, new view
imports. Remove all v1 imports (`concepts.js`, old view files). Update `package.json` so the test
script globs all test files automatically.

No new tests -- existing suite covers correctness.

- [ ] **Step 1: Update package.json test script**

Change `scripts.test` to use a glob pattern:
```json
"test": "node --test tests/*.test.js"
```

- [ ] **Step 2: Verify all tests pass with the new glob**

```bash
npm test
```
Expected: same 23 tests pass (glob picks up all 4 test files).

- [ ] **Step 3: Rewrite js/app.js**

```js
import { openDB } from './db.js';
import { loadCurriculum } from './curriculum-loader.js';
import { initRouter } from './router.js';
import { renderHome } from '../views/home.js';
import { renderCurriculum } from '../views/curriculum.js';
import { renderMap } from '../views/map.js';
import { renderQuiz } from '../views/quiz.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

async function init() {
  await openDB();
  await loadCurriculum();

  initRouter({
    home:       (params) => renderHome(document.getElementById('view-home'), params),
    curriculum: (params) => renderCurriculum(document.getElementById('view-curriculum'), params),
    map:        (params) => renderMap(document.getElementById('view-map'), params),
    quiz:       (params) => renderQuiz(document.getElementById('view-quiz'), params),
  });
}

init().catch((err) => {
  console.error('Init failed:', err);
  const el = document.getElementById('view-home');
  el.textContent = 'Failed to start: ' + err.message;
  el.style.cssText = 'padding:20px;color:var(--red)';
  el.classList.add('view--active');
});
```

- [ ] **Step 4: Run all tests -- expect PASS**

```bash
npm test
```
Expected: 23 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/app.js package.json
git commit -m "feat: wire up 4-tab router and loadCurriculum in app.js"
```
