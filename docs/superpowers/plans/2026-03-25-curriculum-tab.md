# Curriculum Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Curriculum tab with zone accordion (Level 1/2), concept list screen (Level 3), lesson screen (Level 4), hyperlinked terms, and linked concept bottom sheet overlay.

**Architecture:** `views/curriculum.js` replaces the stub and manages all 4 navigation levels via a module-level nav stack (`_navStack`) and accordion state (`_openZones`). Data is fetched fresh on every tab activation via `getCurriculumData(dbName)` — a single-pass query returning `{ totalConcepts, zones, contentMap, progressMap }`. Navigation state persists across tab switches in module scope. CSS appended to `css/theme.css`.

**Tech Stack:** Vanilla JS ES modules, IndexedDB v2 via `js/db.js`, `node:test` + `fake-indexeddb` for tests

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `js/zones.js` | Modify | Add `ZONE_NAMES` map and `subcatName()` helper |
| `js/db.js` | Modify | Add `getCurriculumData()` — single-pass query for all curriculum screens |
| `css/theme.css` | Modify | Append all curriculum CSS |
| `views/curriculum.js` | Rewrite | All 4 navigation levels, pure functions, nav state |
| `tests/db.test.js` | Modify | Add `getCurriculumData` tests |
| `tests/curriculum.test.js` | Create | `parseLinks`, `conceptStatus`, `renderCurriculum` integration tests |

---

### Task 1: zones.js display helpers + db.js getCurriculumData

**Files:**
- Modify: `js/zones.js`
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

`getCurriculumData` reads `concepts-content` and `user-progress` once and returns everything the curriculum tab needs. Zones are ordered by the canonical `ZONE_ORDER` list and only zones with at least one concept are included.

- [ ] **Step 1: Write the failing tests**

Add `getCurriculumData` to the import at the **top of `tests/db.test.js`**:

```js
import { openDB, _resetDB, seedContent, getAllContent, getContentByZone,
  getUserProgress, getAllUserProgress, upsertUserProgress, markSeen,
  getSRSQueues, getMapCoverageCount, saveSession, getRecentSessions,
  getCurriculumData } from '../js/db.js';
```

Append this describe block at the **end of `tests/db.test.js`**:

```js
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --test tests/db.test.js
```
Expected: FAIL — `getCurriculumData` is not exported from `../js/db.js`

- [ ] **Step 3: Add ZONE_NAMES and subcatName to js/zones.js**

Append to `js/zones.js` after the `zoneColor` function:

```js
export const ZONE_NAMES = {
  'your-machine':   'Your Machine',
  'shell-terminal': 'Shell & Terminal',
  'git-github':     'Git & GitHub',
  'the-web':        'The Web',
  'editor-code':    'Editor & Code',
  'packages-env':   'Packages & Env',
  'ai-prompting':   'AI & Prompting',
  'cloud-deploy':   'Cloud & Deploy',
};

/** Converts zone-style kebab IDs to Title Case display names.
 *  e.g. 'bash-commands' → 'Bash Commands' */
export function subcatName(id) {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
```

- [ ] **Step 4: Add getCurriculumData to js/db.js**

Append to `js/db.js` after `getConceptCounts` (before the session history section):

```js
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

  const ZONE_ORDER = [
    'your-machine', 'shell-terminal', 'git-github', 'the-web',
    'editor-code', 'packages-env', 'ai-prompting', 'cloud-deploy',
  ];

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
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test
```
Expected: 33 existing + 3 new = 36 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add js/zones.js js/db.js tests/db.test.js
git commit -m "feat: ZONE_NAMES/subcatName in zones.js + getCurriculumData in db.js"
```

---

### Task 2: CSS — curriculum tab styles

**Files:**
- Modify: `css/theme.css` (append)

No tests — visual changes only.

- [ ] **Step 1: Append curriculum CSS to css/theme.css**

```css
/* ── Curriculum Tab ──────────────────────────────────────────────── */
.curriculum-header {
  padding: 20px 16px 12px;
}
.curriculum-header__title {
  font-size: 20px;
  font-weight: 700;
  color: #e5c07b;
  margin-bottom: 4px;
}
.curriculum-header__subtitle {
  font-size: 12px;
  color: #4b5263;
}

/* Zone accordion */
.zone-row {
  padding: 0 16px;
  cursor: pointer;
  user-select: none;
}
.zone-row__top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 0 10px;
}
.zone-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.zone-row__name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #abb2bf;
}
.zone-row__progress {
  font-size: 12px;
  color: #4b5263;
}
.zone-row__map-btn {
  font-size: 11px;
  color: #61afef;
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  flex-shrink: 0;
}
.zone-row__chevron {
  font-size: 12px;
  color: #4b5263;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.zone-row--open .zone-row__chevron {
  transform: rotate(90deg);
}
.zone-row__bar {
  height: 2px;
  background: #1a1e28;
}
.zone-row__bar-fill {
  height: 100%;
  transition: width 0.3s;
}

/* Subcategory list */
.subcat-list {
  padding: 4px 0 8px;
}
.subcat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px 11px 26px;
  border-left: 2px solid transparent;
  margin-left: 16px;
  cursor: pointer;
}
.subcat-row:active { background: #161b27; }
.subcat-row__name {
  flex: 1;
  font-size: 13px;
  color: #abb2bf;
}
.subcat-row__count {
  font-size: 11px;
  background: #1a1e28;
  color: #4b5263;
  border-radius: 10px;
  padding: 2px 7px;
}
.subcat-row__map-btn {
  font-size: 11px;
  color: #61afef;
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
}

/* Shared push-screen header */
.curriculum-screen__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid #1a1e28;
  flex-shrink: 0;
}
.curriculum-screen__back {
  font-size: 13px;
  color: #61afef;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}
.curriculum-screen__zone-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}

/* Concept list rows */
.concept-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid #161b27;
  cursor: pointer;
}
.concept-row:active { background: #161b27; }
.concept-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.concept-row__name {
  flex: 1;
  font-size: 14px;
  color: #abb2bf;
}
.concept-row__status {
  font-size: 11px;
  color: #4b5263;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Lesson screen */
.lesson {
  padding: 0 16px 120px;
  overflow-y: auto;
}
.lesson__name {
  font-size: 22px;
  font-weight: 700;
  color: #e5c07b;
  margin: 16px 0 8px;
}
.lesson__zone-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  color: #fff;
  margin-bottom: 20px;
}
.lesson-section {
  margin-bottom: 20px;
}
.lesson-section__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4b5263;
  margin-bottom: 6px;
}
.lesson-section__text {
  font-size: 14px;
  line-height: 1.65;
  color: #abb2bf;
}
.lesson__command {
  font-family: 'Roboto Mono', monospace;
  font-size: 14px;
  color: #98c379;
  background: #161b27;
  padding: 10px 14px;
  border-radius: 6px;
  margin-top: 6px;
}
.lesson__example {
  font-size: 13px;
  line-height: 1.6;
  color: #abb2bf;
  margin-bottom: 6px;
}
.lesson__read-more {
  font-size: 13px;
  color: #61afef;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  margin-top: 4px;
  display: block;
}
.lesson-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}
.lesson-actions__btn {
  flex: 1;
  padding: 12px 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  border: none;
}
.lesson-actions__btn--primary {
  background: #61afef;
  color: #1e2127;
}
.lesson-actions__btn--secondary {
  background: #1a1e28;
  color: #61afef;
  border: 1px solid rgba(97,175,239,0.25);
}

/* Concept hyperlinks in lesson text */
.concept-link {
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Bottom sheet overlay */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
}
.overlay-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1e28;
  border-radius: 16px 16px 0 0;
  max-height: 70vh;
  overflow-y: auto;
  z-index: 201;
  padding: 0 16px 40px;
  animation: sheet-slide-up 0.25s ease-out;
}
@keyframes sheet-slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.overlay-sheet__handle {
  width: 40px;
  height: 4px;
  background: #3e4451;
  border-radius: 2px;
  margin: 12px auto 16px;
}
.overlay-sheet__back {
  font-size: 13px;
  color: #61afef;
  background: none;
  border: none;
  padding: 0 0 12px;
  cursor: pointer;
  display: block;
}
.overlay-sheet__name {
  font-size: 18px;
  font-weight: 700;
  color: #e5c07b;
  margin-bottom: 6px;
}
.overlay-sheet__zone-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  color: #fff;
  margin-bottom: 16px;
}
.overlay-sheet__text {
  font-size: 14px;
  line-height: 1.65;
  color: #abb2bf;
}
.overlay-sheet__locked {
  font-size: 13px;
  color: #4b5263;
  font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/theme.css
git commit -m "style: curriculum tab CSS -- accordion, concept list, lesson, overlay"
```

---

### Task 3: curriculum.js — parseLinks + conceptStatus + zone accordion

**Files:**
- Rewrite: `views/curriculum.js`
- Create: `tests/curriculum.test.js`

Establishes the full module structure and the zone accordion (Level 1/2). `_renderConceptList` and `_renderLesson` are stubs — filled in Tasks 4 and 5.

Key design:
- `_navStack = []` → zone accordion; `[{type:'concepts',...}]` → concept list; `[..., {type:'lesson',...}]` → lesson
- `_openZones` (Set) tracks which zones have their accordion rows expanded
- `_scrollY` saves zones-view scroll position before navigating away
- Zone toggle re-renders `_renderZones` synchronously without a new DB fetch (data already in closure)

- [ ] **Step 1: Write the failing tests**

Create `tests/curriculum.test.js`:

```js
import 'fake-indexeddb/auto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDB, _resetDB, seedContent, upsertUserProgress } from '../js/db.js';
import { parseLinks, conceptStatus, renderCurriculum, _resetCurriculumState } from '../views/curriculum.js';

// Stub location so navigate() calls don't throw in Node.js
globalThis.location = { hash: '' };

let uid = 0;
const mkName = () => 'curriculum-test-' + (++uid);

function makeMockContainer() {
  let html = '';
  const mockEl = { addEventListener() {}, style: {} };
  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; },
    querySelector() { return mockEl; },
    querySelectorAll() { return []; },
    addEventListener() {},
    scrollTop: 0,
  };
}

const sampleConcept = {
  id: 'c1', name: 'mkdir', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Makes a directory.', analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'mkdir foo',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};

const defaultProg = {
  seen: false, practiced: false, next_review_date: null, last_review_date: null,
  ease_factor: 2.5, interval: 1, repetitions: 0,
  used_question_indices: { definition: [], usage: [], anatomy: [], build: [] },
};

// ── parseLinks ──────────────────────────────────────────────────────

describe('parseLinks', () => {
  it('returns text as single string when no links present', () => {
    assert.deepEqual(parseLinks('plain text'), ['plain text']);
  });

  it('parses a single link', () => {
    const result = parseLinks('mkdir stands for [make directory](your-machine-dir) here');
    assert.equal(result.length, 3);
    assert.equal(result[0], 'mkdir stands for ');
    assert.deepEqual(result[1], { text: 'make directory', conceptId: 'your-machine-dir' });
    assert.equal(result[2], ' here');
  });

  it('parses multiple links', () => {
    const result = parseLinks('[foo](a) and [bar](b)');
    assert.equal(result.length, 3);
    assert.deepEqual(result[0], { text: 'foo', conceptId: 'a' });
    assert.equal(result[1], ' and ');
    assert.deepEqual(result[2], { text: 'bar', conceptId: 'b' });
  });

  it('handles link at start of string', () => {
    const result = parseLinks('[foo](a) rest');
    assert.deepEqual(result[0], { text: 'foo', conceptId: 'a' });
    assert.equal(result[1], ' rest');
  });

  it('handles link at end of string', () => {
    const result = parseLinks('start [foo](a)');
    assert.equal(result[0], 'start ');
    assert.deepEqual(result[1], { text: 'foo', conceptId: 'a' });
  });
});

// ── conceptStatus ────────────────────────────────────────────────────

describe('conceptStatus', () => {
  it('returns locked when progress is null', () => {
    assert.equal(conceptStatus(null, '2026-03-25'), 'locked');
  });

  it('returns locked when seen is false', () => {
    assert.equal(conceptStatus({ seen: false, practiced: false }, '2026-03-25'), 'locked');
  });

  it('returns new when seen but not practiced', () => {
    assert.equal(conceptStatus({ seen: true, practiced: false }, '2026-03-25'), 'new');
  });

  it('returns due when practiced and next_review_date is null', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: null }, '2026-03-25'), 'due');
  });

  it('returns due when practiced and review date equals today', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: '2026-03-25' }, '2026-03-25'), 'due');
  });

  it('returns done when practiced and review date is in the future', () => {
    assert.equal(conceptStatus({ seen: true, practiced: true, next_review_date: '2026-03-26' }, '2026-03-25'), 'done');
  });
});

// ── renderCurriculum (zone accordion + push screens) ─────────────────

describe('renderCurriculum', () => {
  beforeEach(() => { _resetDB(); _resetCurriculumState(); });

  it('renders zone display name in accordion', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    // 'Shell & Terminal' is the display name for zone 'shell-terminal'
    assert.ok(container.innerHTML.includes('Shell'), 'zone display name rendered');
  });

  it('renders total concept count in header', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('1 concepts total'), 'total count in header');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --test tests/curriculum.test.js
```
Expected: FAIL — `parseLinks`, `conceptStatus`, `renderCurriculum`, `_resetCurriculumState` not exported from `../views/curriculum.js`

- [ ] **Step 3: Rewrite views/curriculum.js**

```js
import { getCurriculumData, markSeen, getUserProgress } from '../js/db.js';
import { zoneColor, ZONE_NAMES, subcatName } from '../js/zones.js';
import { navigate } from '../js/router.js';

// ── Module-level navigation state ─────────────────────────────────────
// Persists across tab switches. Reset via _resetCurriculumState() in tests.
let _openZones = new Set(); // zone IDs with expanded accordion rows
let _navStack = [];         // push entries: {type:'concepts',...} | {type:'lesson',...}
let _scrollY = 0;           // zones-view scroll position, saved before navigating away

/** TEST USE ONLY — reset navigation state between tests. */
export function _resetCurriculumState(state = {}) {
  _openZones = new Set(state.openZones ?? []);
  _navStack = state.navStack ? [...state.navStack] : [];
  _scrollY = 0;
}

// ── Exported pure functions ────────────────────────────────────────────

/**
 * Parses [display text](concept-id) link syntax into an array of segments.
 * String segments are plain text; object segments are { text, conceptId }.
 * Exported for testing.
 */
export function parseLinks(text) {
  const result = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (match.index > last) result.push(text.slice(last, match.index));
    result.push({ text: match[1], conceptId: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

/**
 * Returns the display status for a concept: 'locked' | 'new' | 'due' | 'done'
 * today: ISO date string YYYY-MM-DD; defaults to today if omitted.
 * Exported for testing.
 */
export function conceptStatus(progress, today) {
  if (!today) today = new Date().toISOString().slice(0, 10);
  if (!progress || !progress.seen) return 'locked';
  if (!progress.practiced) return 'new';
  if (!progress.next_review_date || progress.next_review_date <= today) return 'due';
  return 'done';
}

// ── Entry point ────────────────────────────────────────────────────────

export async function renderCurriculum(container, params = {}, dbName = 'devbrain') {
  const data = await getCurriculumData(dbName);
  await _render(container, data, dbName);
}

// ── Internal render dispatcher ─────────────────────────────────────────

async function _render(container, data, dbName) {
  const top = _navStack[_navStack.length - 1];
  if (!top) {
    _renderZones(container, data, dbName);
  } else if (top.type === 'concepts') {
    _renderConceptList(container, data, top, dbName);
  } else if (top.type === 'lesson') {
    await _renderLesson(container, data, top, dbName);
  }
}

// ── Level 1/2: zone accordion + subcategory list ───────────────────────

function _renderZones(container, data, dbName) {
  const total = data.totalConcepts;

  let html =
    '<div class="curriculum-header">' +
      '<div class="curriculum-header__title">Curriculum</div>' +
      '<div class="curriculum-header__subtitle">8 zones \u00b7 ' + total + ' concepts total</div>' +
    '</div>';

  for (const zone of data.zones) {
    const color = zoneColor(zone.id);
    const name = ZONE_NAMES[zone.id] ?? zone.id;
    const barWidth = zone.total > 0 ? Math.round((zone.practiced / zone.total) * 100) : 0;
    const isOpen = _openZones.has(zone.id);

    html +=
      '<div class="zone-row' + (isOpen ? ' zone-row--open' : '') + '" data-zone="' + zone.id + '">' +
        '<div class="zone-row__top">' +
          '<div class="zone-row__dot" style="background:' + color + '"></div>' +
          '<div class="zone-row__name">' + name + '</div>' +
          '<div class="zone-row__progress">' + zone.practiced + ' / ' + zone.total + '</div>' +
          '<button class="zone-row__map-btn" data-mapzone="' + zone.id + '">Map \u2197</button>' +
          '<span class="zone-row__chevron">\u203a</span>' +
        '</div>' +
        '<div class="zone-row__bar">' +
          '<div class="zone-row__bar-fill" style="background:' + color + ';width:' + barWidth + '%"></div>' +
        '</div>' +
      '</div>';

    if (isOpen) {
      html += '<div class="subcat-list">';
      for (const subcat of zone.subcategories) {
        const displayName = subcatName(subcat.id);
        html +=
          '<div class="subcat-row" data-subcat="' + subcat.id + '" data-subcat-zone="' + zone.id + '"' +
              ' style="border-left-color:' + color + '">' +
            '<span class="subcat-row__name">' + displayName + '</span>' +
            '<span class="subcat-row__count">' + subcat.total + '</span>' +
            '<button class="subcat-row__map-btn" data-mapsubcat="' + subcat.id + '">Map \u2197</button>' +
          '</div>';
      }
      html += '</div>';
    }
  }

  container.innerHTML = html;
  container.scrollTop = _scrollY;

  // Zone accordion toggle (zone-row__top click, not Map button)
  container.querySelectorAll('.zone-row').forEach((row) => {
    row.querySelector('.zone-row__top').addEventListener('click', (e) => {
      if (e.target.closest('[data-mapzone]')) return;
      const zoneId = row.dataset.zone;
      if (_openZones.has(zoneId)) _openZones.delete(zoneId);
      else _openZones.add(zoneId);
      _renderZones(container, data, dbName);
    });
  });

  // Map buttons — save scroll position then navigate to Map tab
  container.querySelectorAll('[data-mapzone], [data-mapsubcat]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _scrollY = container.scrollTop;
      navigate('map');
    });
  });

  // Subcategory row tap — push to concept list
  container.querySelectorAll('.subcat-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-mapsubcat]')) return;
      const subcatId = row.dataset.subcat;
      const zoneId = row.dataset.subcatZone;
      _scrollY = container.scrollTop;
      _navStack.push({ type: 'concepts', zoneId, subcatId });
      _renderConceptList(container, data, { zoneId, subcatId }, dbName);
    });
  });
}

// ── Level 3: concept list (stub — filled in Task 4) ────────────────────

function _renderConceptList(container, data, { zoneId, subcatId }, dbName) {
  container.innerHTML = '<p style="padding:20px;color:#4b5263">Concept list — Task 4</p>';
}

// ── Level 4: lesson screen (stub — filled in Task 5) ───────────────────

async function _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName) {
  container.innerHTML = '<p style="padding:20px;color:#4b5263">Lesson screen — Task 5</p>';
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```
Expected: 36 existing + 13 new (5 parseLinks + 6 conceptStatus + 2 accordion) = 49 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add views/curriculum.js tests/curriculum.test.js
git commit -m "feat: curriculum.js -- parseLinks, conceptStatus, zone accordion"
```

---

### Task 4: curriculum.js — concept list screen

**Files:**
- Modify: `views/curriculum.js` (replace `_renderConceptList` stub)
- Modify: `tests/curriculum.test.js` (add 1 test)

Concept list (Level 3): shows all non-bridge concepts in a subcategory with color-coded status dots. Back button returns to zone accordion (with same zone still open).

Status dot colors: done=`#98c379`, due=`#e5c07b`, new=`#61afef`, locked=`#3e4451`
Status labels: done="done", due="review", new="new", locked="locked"

- [ ] **Step 1: Add concept list test to tests/curriculum.test.js**

Append inside the `renderCurriculum` describe block (after the existing two tests):

```js
  it('concept list screen shows concept names after nav push', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);

    // Simulate user having navigated to concept list for bash-commands
    _resetCurriculumState({
      navStack: [{ type: 'concepts', zoneId: 'shell-terminal', subcatId: 'bash-commands' }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('mkdir'), 'concept name shown in list');
  });
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
node --test tests/curriculum.test.js
```
Expected: the new concept list test fails (stub shows "Task 4")

- [ ] **Step 3: Replace _renderConceptList in views/curriculum.js**

Find the stub `_renderConceptList` function and replace the entire function body:

```js
function _renderConceptList(container, data, { zoneId, subcatId }, dbName) {
  const today = new Date().toISOString().slice(0, 10);
  const color = zoneColor(zoneId);
  const zoneName = ZONE_NAMES[zoneId] ?? zoneId;
  const subcatDisplayName = subcatName(subcatId);

  const STATUS_COLOR = { done: '#98c379', due: '#e5c07b', new: '#61afef', locked: '#3e4451' };
  const STATUS_LABEL = { done: 'done', due: 'review', new: 'new', locked: 'locked' };

  const concepts = [...data.contentMap.values()].filter(
    (c) => !c.is_bridge && c.subcategory === subcatId,
  );

  let rows = '';
  for (const concept of concepts) {
    const progress = data.progressMap.get(concept.id);
    const status = conceptStatus(progress, today);
    rows +=
      '<div class="concept-row" data-concept="' + concept.id + '">' +
        '<div class="concept-row__dot" style="background:' + STATUS_COLOR[status] + '"></div>' +
        '<div class="concept-row__name">' + concept.name + '</div>' +
        '<div class="concept-row__status">' + STATUS_LABEL[status] + '</div>' +
      '</div>';
  }

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + zoneName + '</button>' +
      '<span class="curriculum-screen__zone-tag" style="background:' + color + '">' +
        subcatDisplayName +
      '</span>' +
    '</div>' +
    '<div>' + rows + '</div>';

  container.querySelector('.curriculum-screen__back').addEventListener('click', () => {
    _navStack.pop();
    _render(container, data, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
  });

  container.querySelectorAll('.concept-row').forEach((row) => {
    row.addEventListener('click', () => {
      const conceptId = row.dataset.concept;
      _navStack.push({ type: 'lesson', conceptId, zoneId, subcatId });
      _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName).catch((err) => {
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      });
    });
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```
Expected: 49 existing + 1 new = 50 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add views/curriculum.js tests/curriculum.test.js
git commit -m "feat: curriculum concept list screen -- status dots, push nav"
```

---

### Task 5: curriculum.js — lesson screen + markSeen + examples toggle

**Files:**
- Modify: `views/curriculum.js` (replace `_renderLesson` stub)
- Modify: `tests/curriculum.test.js` (add 1 test, update import)

The lesson screen (Level 4) renders full concept content, calls `markSeen` on first open, updates `data.progressMap` so back-navigated concept list shows updated status, and provides a "Read more" toggle for hidden examples.

`what_it_is` is rendered as plain text here — hyperlinks made interactive in Task 6.

Both buttons navigate to `#quiz?preload=conceptId` for now (mini-drill distinction is Plan 5).

- [ ] **Step 1: Add markSeen integration test**

Update the `import` line at the top of `tests/curriculum.test.js` to add `getUserProgress`:

```js
import { openDB, _resetDB, seedContent, upsertUserProgress, getUserProgress } from '../js/db.js';
```

Append inside the `renderCurriculum` describe block:

```js
  it('marks concept as seen when lesson screen is rendered', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1', seen: false }, dbName);

    // Simulate user having navigated directly to the lesson
    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c1',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    const updated = await getUserProgress('c1', dbName);
    assert.equal(updated.seen, true, 'seen should be true after lesson render');
  });
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
node --test tests/curriculum.test.js
```
Expected: new markSeen test fails (stub doesn't call markSeen)

- [ ] **Step 3: Replace _renderLesson in views/curriculum.js**

Find the stub `_renderLesson` function and replace the entire function:

```js
async function _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) {
    container.innerHTML = '<p style="padding:20px;color:var(--red)">Concept not found</p>';
    return;
  }

  const color = zoneColor(zoneId);
  const zoneName = ZONE_NAMES[zoneId] ?? zoneId;
  const subcatDisplayName = subcatName(subcatId);

  // Mark concept as seen and refresh progressMap so concept list shows updated status on back
  await markSeen(conceptId, dbName);
  const updatedProgress = await getUserProgress(conceptId, dbName);
  if (updatedProgress) data.progressMap.set(conceptId, updatedProgress);

  // Command block (only if concept has an example_command)
  const commandBlock = concept.example_command
    ? '<div class="lesson-section">' +
        '<div class="lesson-section__label">Example Command</div>' +
        '<div class="lesson__command">' + concept.example_command + '</div>' +
      '</div>'
    : '';

  // Examples: first visible one always shown; remaining behind Read more toggle
  const visible = concept.examples.filter((e) => e.visible);
  const hidden = concept.examples.filter((e) => !e.visible);
  const visibleHtml = visible.map((e) => '<div class="lesson__example">' + e.text + '</div>').join('');
  const hiddenHtml = hidden.length > 0
    ? '<div class="lesson__hidden-examples" style="display:none">' +
        hidden.map((e) => '<div class="lesson__example">' + e.text + '</div>').join('') +
      '</div>' +
      '<button class="lesson__read-more">Read more \u25be</button>'
    : '';

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + subcatDisplayName + '</button>' +
    '</div>' +
    '<div class="lesson">' +
      '<div class="lesson__name">' + concept.name + '</div>' +
      '<span class="lesson__zone-tag" style="background:' + color + '">' + zoneName + '</span>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">What it is</div>' +
        '<div class="lesson-section__text" id="lesson-what-it-is">' + concept.what_it_is + '</div>' +
      '</div>' +
      commandBlock +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Examples</div>' +
        visibleHtml +
        hiddenHtml +
      '</div>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Use it when</div>' +
        '<div class="lesson-section__text">' + concept.use_when + '</div>' +
      '</div>' +
      '<div class="lesson-actions">' +
        '<button class="lesson-actions__btn lesson-actions__btn--secondary" id="btn-test-self">' +
          'Test yourself \u2192' +
        '</button>' +
        '<button class="lesson-actions__btn lesson-actions__btn--primary" id="btn-add-quiz">' +
          'Add to Quiz \u2192' +
        '</button>' +
      '</div>' +
    '</div>';

  container.querySelector('.curriculum-screen__back').addEventListener('click', () => {
    _navStack.pop();
    _render(container, data, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
  });

  container.querySelector('#btn-test-self').addEventListener('click', () => {
    navigate('quiz', { preload: conceptId });
  });

  container.querySelector('#btn-add-quiz').addEventListener('click', () => {
    navigate('quiz', { preload: conceptId });
  });

  const readMoreBtn = container.querySelector('.lesson__read-more');
  if (readMoreBtn) {
    readMoreBtn.addEventListener('click', () => {
      const hiddenSection = container.querySelector('.lesson__hidden-examples');
      if (hiddenSection.style.display === 'none') {
        hiddenSection.style.display = 'block';
        readMoreBtn.textContent = 'Read less \u25b4';
      } else {
        hiddenSection.style.display = 'none';
        readMoreBtn.textContent = 'Read more \u25be';
      }
    });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```
Expected: 50 existing + 1 new = 51 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add views/curriculum.js tests/curriculum.test.js
git commit -m "feat: curriculum lesson screen -- markSeen, examples toggle, quiz CTA"
```

---

### Task 6: curriculum.js — hyperlinked terms + bottom sheet overlay

**Files:**
- Modify: `views/curriculum.js` (add renderLinkedText + _showLinkedConcept; update _renderLesson)
- Modify: `tests/curriculum.test.js` (add fixture + 2 tests)

`renderLinkedText` converts `[term](concept-id)` syntax to colored `<span class="concept-link">` elements. Inside the bottom sheet overlay (`isOverlay=true`), spans are rendered with zone color but are not clickable — this caps overlay depth at 1 level per spec §3.5.1.

`_showLinkedConcept` appends a backdrop + sheet to `document.body`. It guards on `typeof document !== 'undefined'` so it is never called in Node.js test environments (click handlers don't fire on the mock container).

- [ ] **Step 1: Add fixture and 2 tests to tests/curriculum.test.js**

Add `sampleLinkedConcept` after the existing `sampleConcept` fixture (near the top of the file):

```js
const sampleLinkedConcept = {
  id: 'c2', name: 'ls', zone: 'shell-terminal', subcategory: 'bash-commands',
  is_bridge: false, tier_unlocked: 1, bridge_zones: [],
  what_it_is: 'Lists files. See also [mkdir](c1) for creating directories.',
  analogy: '', use_when: '',
  examples: [{ text: 'eg', visible: true }], example_command: 'ls',
  questions: { definition: [], usage: [], anatomy: [], build: [] },
};
```

Append 2 tests inside the `renderCurriculum` describe block:

```js
  it('renders concept-link span for linked term in what_it_is', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleLinkedConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c2' }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c2',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    assert.ok(container.innerHTML.includes('concept-link'), 'concept-link span rendered');
    assert.ok(container.innerHTML.includes('data-concept-id="c1"'), 'correct conceptId on span');
  });

  it('colors linked term with zone color of the linked concept', async () => {
    const dbName = mkName();
    await openDB(dbName);
    await seedContent([sampleConcept, sampleLinkedConcept], dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c1' }, dbName);
    await upsertUserProgress({ ...defaultProg, id: 'c2' }, dbName);

    _resetCurriculumState({
      navStack: [{
        type: 'lesson', conceptId: 'c2',
        zoneId: 'shell-terminal', subcatId: 'bash-commands',
      }],
    });

    const container = makeMockContainer();
    await renderCurriculum(container, {}, dbName);

    // c1 is in zone 'shell-terminal' whose color is #e5c07b
    assert.ok(container.innerHTML.includes('#e5c07b'), 'link colored with zone color');
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --test tests/curriculum.test.js
```
Expected: 2 new tests fail (what_it_is still rendered as plain text)

- [ ] **Step 3: Add renderLinkedText and _showLinkedConcept to views/curriculum.js**

Add these two functions **before** the `_renderLesson` function:

```js
/**
 * Renders text with [term](concept-id) links as colored <span> elements.
 * isOverlay=true: spans are colored but not clickable (overlay depth cap — spec §3.5.1).
 * Unknown concept IDs fall back to plain text.
 */
function renderLinkedText(text, contentMap, progressMap, isOverlay) {
  const segments = parseLinks(text);
  return segments.map((seg) => {
    if (typeof seg === 'string') return seg;
    const linked = contentMap.get(seg.conceptId);
    if (!linked) return seg.text;
    const color = zoneColor(linked.zone);
    if (isOverlay) {
      return '<span class="concept-link" style="color:' + color + '">' + seg.text + '</span>';
    }
    return '<span class="concept-link" data-concept-id="' + seg.conceptId + '"' +
      ' style="color:' + color + '">' + seg.text + '</span>';
  }).join('');
}

/**
 * Opens a bottom sheet overlay for a linked concept.
 * Shows full what_it_is (with non-clickable links) or a locked message.
 * Only called in browser context — guarded in _renderLesson.
 */
function _showLinkedConcept(container, data, conceptId, backToName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) return;

  const progress = data.progressMap.get(conceptId);
  const isLocked = !progress || !progress.seen;
  const color = zoneColor(concept.zone);
  const zoneName = ZONE_NAMES[concept.zone] ?? concept.zone;

  const bodyHTML = isLocked
    ? '<p class="overlay-sheet__locked">Explore more of this zone to unlock</p>'
    : '<div class="overlay-sheet__text">' +
        renderLinkedText(concept.what_it_is, data.contentMap, data.progressMap, true) +
      '</div>';

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'overlay-sheet';
  sheet.innerHTML =
    '<div class="overlay-sheet__handle"></div>' +
    '<button class="overlay-sheet__back">\u2190 Back to ' + backToName + '</button>' +
    '<div class="overlay-sheet__name">' + concept.name + '</div>' +
    '<span class="overlay-sheet__zone-tag" style="background:' + color + '">' + zoneName + '</span>' +
    bodyHTML;

  const close = () => { backdrop.remove(); sheet.remove(); };
  backdrop.addEventListener('click', close);
  sheet.querySelector('.overlay-sheet__back').addEventListener('click', close);

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}
```

- [ ] **Step 4: Update _renderLesson to use renderLinkedText and wire concept-link clicks**

In `_renderLesson`, find this line inside the `what_it_is` section:

```js
        '<div class="lesson-section__text" id="lesson-what-it-is">' + concept.what_it_is + '</div>' +
```

Replace it with:

```js
        '<div class="lesson-section__text" id="lesson-what-it-is">' +
          renderLinkedText(concept.what_it_is, data.contentMap, data.progressMap, false) +
        '</div>' +
```

Then add concept-link click handlers at the end of `_renderLesson` (after the `readMoreBtn` block):

```js
  // Concept hyperlinks → bottom sheet overlay (browser only; document.body unavailable in Node.js tests)
  if (typeof document !== 'undefined' && document.body) {
    container.querySelectorAll('.concept-link').forEach((link) => {
      link.addEventListener('click', () => {
        _showLinkedConcept(container, data, link.dataset.conceptId, concept.name);
      });
    });
  }
```

- [ ] **Step 5: Run all tests — expect PASS**

```bash
npm test
```
Expected: 51 existing + 2 new = 53 tests pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add views/curriculum.js tests/curriculum.test.js
git commit -m "feat: curriculum hyperlinked terms + linked concept bottom sheet overlay"
```
