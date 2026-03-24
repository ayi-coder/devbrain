# DevBrain Structured Learning — Design Spec

## Goal

Replace the current unstructured "quiz whatever is due" model with a guided daily curriculum that covers all 102 concepts systematically, enforces a learning schedule, introduces question variety to prevent memorisation, and adds Gemini-style feedback on wrong answers.

## Architecture Overview

Three layers of change:

1. **Content** — `concepts.js` expanded from 3 questions per concept (1 MCQ + 1 T/F + 1 fill_blank) to 8 (4 MCQ + 4 fill_blank). T/F removed entirely — the existing T/F entry in each concept's `quiz` array is deleted.
2. **Data** — Two new IndexedDB stores + additions to existing `concept_progress` schema. DB_VERSION bumped from 1 to 2.
3. **UI** — Home screen redesigned with 3 session modes. New lesson flow: plan screen → study cards → quiz. Feedback upgraded on wrong answers.

---

## 1. Content Changes — concepts.js

### Question pool per concept

| Type | Count | Indices | Used in |
|------|-------|---------|---------|
| `mcq` | 4 | 0, 1, 2, 3 | Index 0: solidification only. Indices 1–3: quiz + mega |
| `fill_blank` | 4 | 0, 1, 2, 3 | All 4: quiz + mega |
| `true_false` | 0 | — | Removed. Existing T/F entry deleted from every concept. |

Total: 8 questions per concept, 816 questions across 102 concepts.

### Generation requirement

Each concept currently has 1 MCQ (kept as MCQ index 0), 1 T/F (deleted), 1 fill_blank (kept as fill_blank index 0). New questions to generate per concept: 3 MCQ (indices 1–3) + 3 fill_blank (indices 1–3) = 6 new questions × 102 concepts = 612 new questions total.

Questions within the same type must test meaningfully different angles of the concept — different scenarios, different blanks, not just rephrased wording of the same fact. This prevents pattern memorisation.

### fill_blank answer requirement

All fill_blank answers must be a single word or short unambiguous phrase (2–3 words max). This keeps the existing exact-match string comparison valid without fuzzy matching.

### MCQ structure (unchanged)
```json
{
  "type": "mcq",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "answer": 1
}
```

### fill_blank structure (unchanged)
```json
{
  "type": "fill_blank",
  "question": "Git keeps a ___ of every change you make.",
  "answer": "history"
}
```

---

## 2. Data Model Changes

### 2a. DB version bump and migration

`DB_VERSION` in `db.js` bumped from 1 to 2. The `onupgradeneeded` handler must add the two new stores only if they do not yet exist (using `db.objectStoreNames.contains()`). The three existing stores (`concept_progress`, `quiz_sessions`, `user_stats`) are left unchanged — all existing user data is preserved.

### 2b. concept_progress store — new fields

Two new fields added. Because `computeSessionUpdates` builds its output by spreading the existing record (see section 5), these fields are preserved across saves.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `last_mastery_increment_date` | string (YYYY-MM-DD) or null | null | Enforces +1 mastery cap per calendar day |
| `used_question_indices` | `{ mcq: number[], fill_blank: number[] }` | `{ mcq: [], fill_blank: [] }` | Ordered list of recently used indices per type (oldest first, most recent last) |

**`used_question_indices` semantics:** Indices are type-scoped — position 0 within the MCQ sub-array of the `quiz` array (after filtering by type), not position in the raw flat array. The list is ordered oldest-to-most-recent. When `pickQuestionIndex` is called, it reads the list and picks the lowest available index not in the list, or index 0 if the list is empty or the field is absent (handles existing records that pre-date this schema). After a session ends, the session's used indices are appended to the list. If the combined list length exceeds 4, truncate to the last 4 entries — this keeps the most recent usage history and naturally cycles the pool on the next call. Do not reset to empty: truncate-to-last-4 is the canonical rule (see also section 5).

### 2c. New store — daily_curriculum

Tracks the generated daily lesson plan.

```
Store name:  daily_curriculum
KeyPath:     date  (YYYY-MM-DD string)

Record schema:
{
  date:                "2026-03-24",
  concept_ids:         ["git", "api", "docker", "python", "tcp_ip", "neural_net"],
  lesson_completed:    false,
  revision_completed:  false
}
```

One record per day. Generated on first Home screen visit of the day. If a record for today already exists it is reused unchanged — no regeneration mid-day. Missed days are not backfilled.

### 2d. New store — seen_concepts

Tracks which concepts have appeared in a completed Today's Lesson (Phase 1 tracking).

```
Store name:  seen_concepts
KeyPath:     concept_id

Record schema:
{
  concept_id:       "git",
  first_seen_date:  "2026-03-24"
}
```

**Important:** Written at lesson completion (Done button on Lesson Results screen), NOT at plan generation. A concept only counts as "seen" after the user has finished the lesson that included it. This prevents the Phase 1→Phase 2 transition from triggering on a day the user opened the app but never completed the lesson.

**Why a separate store:** `concept_progress.last_seen_date` is also updated by Revision sessions. Using that field to determine "seen in Lesson" would incorrectly promote concepts that were only revised, never studied in a Lesson plan. `seen_concepts` tracks Lesson exposure exclusively.

---

## 3. Daily Curriculum Logic — curriculum.js

All curriculum functions live in a new file `js/curriculum.js`. `adaptive.js` does not own any curriculum logic.

### getTodaysPlan()

Returns the `daily_curriculum` record for today.
- If a record exists for today: return it.
- If not: call `generateDailyPlan()`, store it, return it.

### generateDailyPlan(allProgress, seenConceptIds)

Takes current progress array and array of seen concept IDs as input. Returns 6 concept IDs (one per category).

**Phase 1 — unseen concepts remain:**
```
for each category:
  unseenInCat = concepts in category NOT in seenConceptIds
  if unseenInCat is empty: skip this category (all seen)
  else: pick 1 at random from unseenInCat
```
Result: up to 6 concept IDs (may be fewer if some categories are fully exhausted).

**Phase 2 — all 102 concepts seen (seenConceptIds.length === 102):**
```
for each category:
  weight each concept by: (6 - mastery_score)²
    score 0 → weight 36
    score 1 → weight 25
    score 2 → weight 16
    score 3 → weight  9
    score 4 → weight  4
    score 5 → weight  1
  weighted-random pick 1 from category
```

### markLessonComplete(date, conceptIds)

Called from the Lesson Results "Done" button handler after all progress saves succeed:
1. Updates `daily_curriculum` record for date: sets `lesson_completed = true`.
2. Writes one `seen_concepts` record for each concept in `conceptIds` that does not already have one.

### markRevisionComplete(date)

Called from Revision Results "Done" button after saves succeed:
1. Updates `daily_curriculum` record: sets `revision_completed = true`.

### getDayNumber()

Returns the count of records in the `daily_curriculum` store. Used for the "Day X" header on the Plan Preview screen. This is the total number of days the user has had a lesson plan generated, regardless of completion.

---

## 4. Question Selection Logic — adaptive.js additions

### getQuestionTypeForConcept(masteryScore)

```js
function getQuestionTypeForConcept(masteryScore) {
  return masteryScore >= 3 ? 'fill_blank' : 'mcq';
}
```

Replaces the old Easy/Medium/Hard system entirely.

### pickQuestionIndex(conceptId, type, usedIndices, reservedIndices = [])

```
pool = [0, 1, 2, 3]  (all 4 indices for this type)
available = pool filtered to exclude reservedIndices and usedIndices (recent list)
if available is empty: reset — available = pool filtered to exclude reservedIndices only
pick first element of available (oldest = least recently used)
return that index
```

`reservedIndices` defaults to `[]`. For MCQ in quiz context, caller passes `[0]` to exclude the solidification index. For fill_blank, caller passes `[]`.

**Missing field handling:** If `usedIndices` is null/undefined/absent (existing record without the new field), treat as `[]` — picks index 0 on first call.

### Removed functions

- `getQuestionType(difficulty)` — deleted
- `getMiniQuestionType(index)` — deleted
- `updateDifficulty(current, consCorrect, consWrong)` — deleted

---

## 5. Mastery Cap — computeSessionUpdates update

`computeSessionUpdates` in `adaptive.js` is updated as follows:

**Field preservation:** The function now spreads the existing progress record before building the update object, so `used_question_indices`, `last_mastery_increment_date`, and any future fields are not silently erased by `upsertProgress`'s `store.put()`.

```js
const base = progressMap.get(conceptId) || { concept_id: conceptId, mastery_score: 0, ... };
const update = { ...base };  // spread first — preserves all existing fields
```

**Mastery cap logic:**
```
today = todayISO()
if (allCorrectThisSession) {
  if (base.last_mastery_increment_date !== today) {
    update.mastery_score = min(5, base.mastery_score + 1)
    update.last_mastery_increment_date = today
  }
  // else: already incremented today — score unchanged, date unchanged
  update.consecutive_correct_sessions = base.consecutive_correct_sessions + 1
} else {
  update.mastery_score = max(0, base.mastery_score - 1)
  update.consecutive_correct_sessions = 0
  // last_mastery_increment_date unchanged on wrong session
}
```

**`used_question_indices` update:** After the session, the indices used during the session are appended to the existing list for each type. If the combined list length exceeds 4, truncate to the last 4 (full cycle). This write happens inside `computeSessionUpdates` so a single `upsertProgress` call saves everything atomically.

---

## 6. Home Screen Redesign

Three modes replace the current two buttons.

### Mode 1 — Today's Lesson
- Label: "📚 Today's Lesson"
- Subtext: today's 6 concept names as chips, or "Loading…" while plan generates
- Always available
- On tap: navigate to Plan Preview screen
- After completion: button shows "✓ Done today" (still tappable to review)

### Mode 2 — Revision
- Label: "🔁 Revision"
- Subtext: "X concepts due" or "Nothing due today" (greyed, non-tappable)
- Available independently of Today's Lesson
- On tap: navigate directly into quiz flow with due concept IDs

### Mode 3 — Mega Quiz
- Label: "⚡ Mega Quiz — optional"
- Only rendered after `lesson_completed === true`
- If Revision queue is empty: Mega Quiz uses today's 6 lesson concepts only (still shown, labelled "6 concepts")
- If Revision was not launched: uses `getDueConceptIds()` output at Mega Quiz start time (not a completed revision set)
- On tap: navigate into quiz flow with combined concept pool
- After completion: button shows "✓ Done today"

### Stats section (unchanged)
Level title, streak, mastered count, overall mastery progress bar remain at top.

---

## 7. Today's Lesson Flow

### Screen A — Plan Preview

- Header: "Today's Lesson · Day [getDayNumber()]"
- List of 6 concept rows: emoji + name + category chip
- Subtext: "Study each concept, then take the quiz"
- CTA: "Start Studying →"

### Screen B — Study Cards (1 of 6 → 6 of 6)

One card per concept, sequential.

**Learn section:**
- Large emoji
- Concept name (bold)
- Explain text
- Analogy in yellow accent card

**Solidification section:**
- MCQ index 0 for this concept (reserved, never appears in quiz)
- Label: "Quick check"
- 4 option buttons
- Correct: green flash → auto-advance after 0.8s
- Wrong: red flash + correct answer highlighted + analogy hint ("Remember: [concept.analogy]") → user taps "Next" manually

**Skip button:** top-right. Skips learn + solidification. Concept still appears in quiz.

**Progress:** "2 of 6" counter at top.

### Screen C — Pre-Quiz Transition

- "Ready to quiz? You studied X of 6 concepts."
- CTA: "Start Quiz →"

### Screen D — Lesson Quiz (6 questions)

One question per concept, same order as study cards.

**Question selection:**
- Type: `getQuestionTypeForConcept(mastery_score)`
- Index: `pickQuestionIndex(conceptId, type, used_indices, reservedIndices)` where `reservedIndices = [0]` for MCQ (index 0 reserved for solidification), and `reservedIndices = []` for fill_blank (all 4 fill_blank indices are available in the quiz)
- Selected indices stored in sessionStorage for the session; written to IndexedDB in the Done handler

**Wrong answer feedback:**
- Correct option → green
- Selected wrong option → red
- Below: "Remember: [concept.analogy]"
- 2.0s pause then auto-advance

**Correct answer feedback:**
- Selected option → green
- "✓ Correct!"
- 1.2s pause then auto-advance

### Screen E — Lesson Results

- Score X / 6, performance label, wrong concept list
- "Done ✓" button handler:
  1. `computeSessionUpdates(results, allProgress)` — with used indices passed in
  2. `upsertProgress` for each update
  3. `updateStats` (streak update)
  4. `saveSession` (session_type: `'lesson'`)
  5. `markLessonComplete(today, conceptIds)` — writes seen_concepts + sets lesson_completed flag
  6. Navigate to Home

---

## 8. Revision Flow

Identical to current "Start Today's Quiz" with these changes:

- Question type: `getQuestionTypeForConcept(mastery_score)` — no in-session difficulty tracking
- Question index: `pickQuestionIndex` with MCQ reserved index 0
- Wrong answer feedback: same Gemini-style (analogy hint)
- Mastery cap applies via updated `computeSessionUpdates`
- Results Done handler calls `markRevisionComplete(today)` after saves

---

## 9. Mega Quiz Flow

### Concept pool

`getDueConceptIds()` output (revision concepts) + today's lesson `concept_ids` from `daily_curriculum`. Deduplicated. If a concept appears in both, it appears once.

### Question selection

Same mastery-based type selection. Index selection uses same `pickQuestionIndex` but also checks `session_used_indices` (sessionStorage map of `conceptId → usedIndex` built up as the quiz progresses) to ensure the same question text is not shown twice for the same concept within this session.

```
if session_used_indices[conceptId] exists:
  reserved = [0].concat([session_used_indices[conceptId]])  (reserve solidification + already-used)
else:
  reserved = [0]
pick via pickQuestionIndex with these reserved indices
store result in session_used_indices[conceptId]
```

### Scoring

- Score displayed at end
- `session_type: 'mega'` saved to `quiz_sessions` for history
- `computeSessionUpdates` is NOT called — no mastery writes
- `updateStats` is NOT called — streak not updated
- `markRevisionComplete` / `markLessonComplete` not called again

---

## 10. "Quiz Me On This" (learn.js)

Still a 1-question mini session. Changes:

- Type: `getQuestionTypeForConcept(mastery_score)` instead of always MCQ
- Index: `pickQuestionIndex(conceptId, type, used_indices, [0])` — reserves solidification MCQ
- Results: updates `used_question_indices` in `concept_progress`, mastery cap applies
- `session_type: 'mini'`

---

## 11. Adaptive.js — Full Change Summary

| Item | Action |
|------|--------|
| `getQuestionType(difficulty)` | Deleted |
| `getMiniQuestionType(index)` | Deleted |
| `updateDifficulty(...)` | Deleted |
| `DIFFICULTY_ORDER` constant | Deleted |
| `getQuestionTypeForConcept(score)` | Added |
| `pickQuestionIndex(id, type, used, reserved)` | Added |
| `computeSessionUpdates` | Updated: spread existing record, mastery cap, used_indices write |

---

## 12. Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `js/concepts.js` | Modify | Delete T/F entries; add 3 MCQ + 3 fill_blank per concept |
| `js/db.js` | Modify | DB_VERSION 1→2; add `daily_curriculum` + `seen_concepts` stores in onupgradeneeded |
| `js/adaptive.js` | Modify | Remove difficulty functions; add `getQuestionTypeForConcept`, `pickQuestionIndex`; update `computeSessionUpdates` |
| `js/curriculum.js` | Create | `generateDailyPlan`, `getTodaysPlan`, `markLessonComplete`, `markRevisionComplete`, `getDayNumber` |
| `js/app.js` | Modify | Add `lesson-plan`, `study-card` routes; keep `quiz` route for Revision + Mega |
| `views/home.js` | Modify | 3-mode buttons, plan preview chips, getDayNumber |
| `views/lesson-plan.js` | Create | Screen A: plan preview |
| `views/study-card.js` | Create | Screens B + C: study cards + pre-quiz transition |
| `views/quiz.js` | Modify | Remove difficulty tracking; add question rotation; new feedback; handle mega session type |
| `views/results.js` | Modify | Pass used indices to computeSessionUpdates; call markLessonComplete/markRevisionComplete; skip mastery+streak writes for mega |
| `sw.js` | Modify | Add new view files to ASSETS; bump CACHE_NAME version string |
| `index.html` | Modify | Add `view-lesson-plan`, `view-study-card` containers |

---

## 13. Out of Scope

- User-facing difficulty preference setting
- Question type selection toggle per session
- Push notifications / daily reminders
- Cloud sync or account system
- Fuzzy matching for fill_blank answers

---

# UI Improvements Spec

## Overview

The current app has no screen transitions, no interactive feedback on tappable elements, an invisible active tab indicator, and several consistency/contrast issues. This section specifies all UI fixes required to make the app feel fluid and polished, benchmarked against Duolingo and Quizlet.

Sixteen issues were identified across four severity levels. All are addressed below.

---

## UI-1. Active Tab Indicator

**Problem:** `.nav-tab--active` only changes text colour from `#5c6370` to `#61afef` — a subtle shift that is nearly invisible at a glance, especially on a dark background.

**Fix:** Three-part active treatment:
1. **Indicator bar** — 2px line at the top of the active tab, coloured `var(--blue)`
2. **Icon brightness** — active tab icon rendered at full opacity (`1.0`); inactive at `0.5`
3. **Label weight** — active label `font-weight: 600`; inactive stays at default

```css
.nav-tab--active {
  color: var(--blue);
  font-weight: 600;
}
.nav-tab--active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  width: 80%;
  height: 2px;
  background: var(--blue);
  border-radius: 0 0 2px 2px;
}
.nav-tab {
  position: relative;  /* needed for ::before positioning */
  opacity: 0.55;
  transition: opacity 0.2s, color 0.2s;
}
.nav-tab--active {
  opacity: 1;
}
```

---

## UI-2. Screen Transitions

**Problem:** Views switch via `display: none` → `display: block` — instant snap with zero animation. Every screen change feels jarring.

**Fix:** Replace the display toggle with an opacity + slight upward translate fade-in. Since `display` cannot be transitioned directly, the approach uses `opacity` and `visibility` with a keyframe animation triggered on `view--active`.

```css
.view {
  display: block;          /* always in DOM */
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  width: 100%;
}
.view--active {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  position: relative;
  animation: viewEnter 0.22s ease-out both;
}
@keyframes viewEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Duration: 220ms — fast enough to not feel slow, long enough to feel smooth.

**Router change:** Remove `display` manipulation from router.js entirely — the CSS handles visibility. The `view--active` class is the only toggle needed.

---

## UI-3. Button and Interactive Element Press States

**Problem:** No `:active` state on any interactive element. Tapping a button with zero visual response feels broken on mobile.

**Fix:** Add `:active` states to all tappable elements.

```css
.btn-primary:active {
  transform: scale(0.97);
  filter: brightness(0.9);
}
.btn-secondary:active {
  transform: scale(0.97);
  background: var(--bg-deep);
}
.quiz-option:active {
  transform: scale(0.98);
  border-color: var(--blue);
}
.concept-card:active {
  transform: scale(0.96);
  border-color: var(--border);
  background: var(--bg-deep);
}
.nav-tab:active {
  opacity: 0.7;
}
/* Shared transition for smooth press feel */
.btn-primary, .btn-secondary, .quiz-option, .concept-card {
  transition: transform 0.1s ease, filter 0.1s ease, background 0.1s ease;
}
```

---

## UI-4. Loading State

**Problem:** When a tab is tapped, the view appears while the async DB query runs — leaving a blank dark screen for 50–200ms. No indication anything is happening.

**Fix:** Each view renders a skeleton placeholder immediately on mount, then replaces it with real content once the async data resolves.

Skeleton pattern — added as a utility CSS class:

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg-surface) 25%, var(--border) 50%, var(--bg-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  border-radius: 8px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Each view renders 2–3 skeleton blocks (matching the rough layout of its content) while awaiting DB data, then swaps them out. This is a JS change per view file — each `renderX` function starts by setting `container.innerHTML` to skeleton HTML before the `await` calls.

---

## UI-5. Nav Tab Icons — Replace Emoji with CSS Icons

**Problem:** Emoji (🏠 🗺️ 📊) render inconsistently across Android versions and have no active/inactive visual variant. They cannot be styled for active state.

**Fix:** Replace emoji with inline SVG icons embedded directly in `index.html`. Use outline style for inactive, filled/coloured for active (controlled entirely by the existing `.nav-tab--active` colour cascade).

Icons to use (simple, universally recognisable):
- **Home** — house outline → house filled
- **Concepts** — grid/map outline → grid filled
- **Progress** — bar chart outline → bar chart filled

SVGs are inlined (no external requests, no icon library dependency). Each icon is ~200 bytes. The active colour is inherited from `.nav-tab--active { color: var(--blue) }` via `fill: currentColor`.

---

## UI-6. Card and List Entrance Animations

**Problem:** Cards just appear. Staggered entrance makes an interface feel alive and gives the eye a clear reading path.

**Fix:** Staggered fade-up animation on card groups. Applied via CSS `animation-delay` using an `nth-child` pattern — no JS needed.

```css
.card, .concept-card, .quiz-option {
  animation: cardEnter 0.25s ease-out both;
}
.card:nth-child(1), .concept-card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2), .concept-card:nth-child(2) { animation-delay: 40ms; }
.card:nth-child(3), .concept-card:nth-child(3) { animation-delay: 80ms; }
.card:nth-child(4), .concept-card:nth-child(4) { animation-delay: 120ms; }
.card:nth-child(5), .concept-card:nth-child(5) { animation-delay: 160ms; }
/* beyond 5: no delay (don't animate entire long lists) */

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Note: `animation: viewEnter` on `.view--active` already handles the overall screen fade-in. Card stagger adds a secondary layer of motion only on items within view.

---

## UI-7. Quiz Answer Feedback — Scale Animation

**Problem:** Correct/wrong feedback is colour-only. Duolingo bounces correct answers and shakes wrong ones — these micro-animations are a core part of why the app feels rewarding.

**Fix:** Add keyframe animations triggered by the correct/wrong CSS classes.

```css
.quiz-option--correct {
  animation: correctPulse 0.35s ease-out both;
}
.quiz-option--wrong {
  animation: wrongShake 0.35s ease-out both;
}
@keyframes correctPulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.03); }
  100% { transform: scale(1); }
}
@keyframes wrongShake {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-6px); }
  40%  { transform: translateX(6px); }
  60%  { transform: translateX(-4px); }
  80%  { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
```

---

## UI-8. Progress Bar Entrance Animation

**Problem:** The progress fill jumps to its final value on first render. It should animate in from 0% to communicate the value visually.

**Fix:** The `width` transition already exists (`transition: width 0.3s`). The fix is a JS change: set `width: 0%` first, then set the real width in the next animation frame so the transition fires.

```js
// In each view that renders a progress bar:
const fill = container.querySelector('.progress-fill');
fill.style.width = '0%';
requestAnimationFrame(() => {
  fill.style.width = masteryPct + '%';
});
```

---

## UI-9. Typography Scale

**Problem:** Only two text sizes are used consistently (`11px` labels, `13–15px` body). Headings are inline-styled across view files with no shared system. No rhythm.

**Fix:** Define a 4-level type scale as CSS custom properties. Remove all inline `font-size` from view files and use these classes instead.

```css
:root {
  --text-xs:   11px;   /* labels, chips, metadata */
  --text-sm:   13px;   /* secondary body, captions */
  --text-base: 15px;   /* primary body text */
  --text-lg:   18px;   /* section headings */
  --text-xl:   22px;   /* screen titles */
  --text-2xl:  28px;   /* hero numbers (score, mastery %) */
}
.text-xs   { font-size: var(--text-xs); }
.text-sm   { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg   { font-size: var(--text-lg); }
.text-xl   { font-size: var(--text-xl); }
.text-2xl  { font-size: var(--text-2xl); }
```

View files replace inline `style="font-size:22px"` etc. with these classes. The scale is not enforced in a single pass — it is applied as each view file is touched during the structured learning implementation.

---

## UI-10. Back Navigation

**Problem:** Learn screen and quiz screen have no back button. The only exit is the Android system back button, which feels incomplete and is not obvious to new users.

**Fix:** Add a back chevron to the screen header in learn.js and quiz.js (and future lesson-plan.js, study-card.js). Tapping it calls `history.back()`.

```html
<div class="screen-header" style="display:flex;align-items:center;gap:12px;">
  <button class="back-btn" onclick="history.back()">&#8592;</button>
  <div><!-- title content --></div>
</div>
```

```css
.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}
.back-btn:active {
  background: var(--bg-deep);
}
```

Quiz screen: back button is only shown before the quiz starts (plan preview and study cards). Once the quiz begins, it is replaced by the existing quit-quiz confirm dialog guard in the router.

---

## UI-11. Card Spacing System

**Problem:** `margin-bottom` values of 8px, 10px, 12px, 16px appear inconsistently across the CSS. No grid rhythm.

**Fix:** Standardise on a 4-point grid. Allowed spacing values: 4, 8, 12, 16, 20, 24px. Remove the 10px margins from `.btn-primary` and `.btn-secondary`. Audit all inline `margin`/`padding` in view files during the structured learning implementation pass.

```css
.btn-primary  { margin-bottom: 12px; }  /* was 10px */
.btn-secondary { margin-bottom: 12px; } /* was 10px */
.card          { margin-bottom: 12px; } /* unchanged */
```

---

## UI-12. Screen Header Enhancement

**Problem:** The gradient `#21252b → #2c313a` is a 6% brightness difference — imperceptible. The header zone lacks visual weight.

**Fix:** Increase contrast and add a subtle bottom border to separate header from content.

```css
.screen-header {
  background: var(--bg-deep);          /* solid, not gradient */
  border-bottom: 1px solid var(--border);
  padding: 20px 16px 16px;
  margin: -16px -16px 16px;
  border-radius: 0 0 14px 14px;
}
```

The border gives a clear separation line. Solid `var(--bg-deep)` (`#21252b`) vs page `var(--bg-primary)` (`#282c34`) creates a ~5% contrast that is more readable than the gradient because it is uniform rather than fading.

---

## UI-13. Tappable vs Non-Tappable Cards

**Problem:** On the Progress page, concept cards look identical whether or not they are interactive. Users cannot tell what they can tap.

**Fix:** Add a right-arrow indicator to tappable cards only.

```css
.card--tappable {
  cursor: pointer;
  position: relative;
}
.card--tappable::after {
  content: '›';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 18px;
}
.card--tappable:active {
  background: var(--bg-deep);
}
```

Applied to concept cards in the concept map and learn entry points. Non-tappable progress cards (info-only) do not get this class.

---

## UI-14. Semantic Chip Colours

**Problem:** Default `.chip` is always purple, which has no consistent meaning in the app. Purple is used for accent/mastery elsewhere but chips use it as a generic default.

**Fix:** Change the default chip to a neutral grey. Purple chips become explicit opt-in via `.chip--purple`.

```css
.chip {
  /* was: purple background/border */
  background: rgba(171,178,191,0.1);   /* neutral */
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 12px;
  display: inline-block;
}
.chip--purple {
  background: rgba(198,120,221,0.12);
  color: var(--purple);
  border-color: rgba(198,120,221,0.25);
}
```

Existing usage of `.chip` for category labels and concept names gets a neutral grey that is semantically neutral. Only mastery/level-related chips use `.chip--purple` explicitly.

---

## UI-15. Text Contrast Fix

**Problem:** `var(--text-muted)` is `#5c6370` on `#282c34` background — contrast ratio ~3.4:1, below WCAG AA minimum of 4.5:1 for normal text. Hard to read outdoors on a phone screen.

**Fix:** Lighten `--text-muted` from `#5c6370` to `#7a8394`.

```css
:root {
  --text-muted: #7a8394;   /* was #5c6370 — contrast ratio now ~5.1:1 */
}
```

This affects all labels, metadata text, and placeholder text across the app. It is a single token change.

---

## UI-16. Reduce Motion Respect

**Problem:** All animations run unconditionally. Users who have enabled "reduce motion" in Android accessibility settings expect animations to be minimised.

**Fix:** Wrap all keyframe animations and transitions in a media query override.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is a single block at the bottom of `theme.css`. All animations still exist — they are just made imperceptibly short for users who opt out of motion.

---

## UI Files to Modify

| File | Changes |
|------|---------|
| `css/theme.css` | UI-1 through UI-16: all CSS changes, type scale variables, new utility classes |
| `index.html` | UI-5: replace emoji with inline SVG icons in bottom nav |
| `js/router.js` | UI-2: update view show/hide to use visibility/opacity instead of display |
| `views/home.js` | UI-4 skeleton, UI-8 progress bar animation, UI-9 type classes |
| `views/concept-map.js` | UI-4 skeleton, UI-13 tappable card class |
| `views/learn.js` | UI-10 back button, UI-9 type classes |
| `views/quiz.js` | UI-10 back button (pre-quiz only), UI-9 type classes |
| `views/results.js` | UI-8 progress bar animation, UI-9 type classes |
| `views/progress.js` | UI-13 tappable card class, UI-9 type classes |
