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
