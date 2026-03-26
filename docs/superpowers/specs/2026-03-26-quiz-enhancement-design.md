# Quiz Tab Enhancement — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

This spec covers three categories of change:

1. **Tab restructure** — rename tabs and set a new default landing tab
2. **Quiz tab overhaul** — two modes (stats / quiz), 3 compartments, full-screen search, save & resume
3. **Data model additions** — new fields and store to support the new behaviour

---

## 1. Tab Restructure

| Old name | New name | Notes |
|---|---|---|
| Curriculum | **Explore** | Becomes the default landing tab (replaces Home as `#` default) |
| Home | **Progress** | Renamed only — content unchanged for now |
| Quiz | **Quiz** | Same name, new behaviour |

**Router change:** Default hash on first load changes from `#home` to `#explore` (previously `#curriculum`). The `parseHashParams` fallback `'home'` changes to `'explore'`.

---

## 2. Quiz Tab — Two Modes

The quiz tab operates in one of two modes at all times.

### 2.1 Stats Mode (default)

Shown when no quiz session is being built or resumed.

- Search bar: **hidden**
- Compartment rows: **no `+` buttons** — read-only display only
- Footer: dark bar showing a single dimmed **"Quiz ›"** button and "Nothing selected" hint text
- Tapping "Quiz ›" opens the **Start Sheet** (see §2.2)

### 2.2 Start Sheet

A bottom sheet that appears when the user taps "Quiz ›" in stats mode. Three options:

1. **▶ Resume saved session** — only shown when a saved session exists in IndexedDB. Shows concept names + question progress (e.g. "Bash · Git · npm — 4 / 9 done"). Tapping jumps directly back into the active quiz at the saved position.
2. **+ Add from today's concepts** — closes sheet, enters **Quiz Mode** (§2.3). `+` buttons appear on all compartment rows and search bar appears at top.
3. **⌕ Search all concepts** — closes sheet, opens **Full-Screen Search Overlay** (§2.5) directly. Also enters Quiz Mode in the background so the session can be built.

### 2.3 Quiz Mode

Active when the user is building a session.

- Search bar: **visible** at top of page (same as tapping "Search all concepts")
- Compartment rows: **`+` buttons visible** on every concept
- Footer: shows session chips + active **"Start →"** button when ≥1 concept added; shows "Nothing selected" hint + **"Quiz ›"** button (now active style) when 0 added
- No concept cap — unlimited concepts can be added to a session
- User can exit quiz mode by tapping a different tab (no confirmation needed unless a session is actively running)

---

## 3. Three Compartments

Compartments are always visible in both modes. In stats mode they are read-only. In quiz mode each row has a `+` button.

### 3.1 Explored Today

**Trigger:** Any concept whose info card was opened within the last 24 hours (tracked via new `last_seen_at` timestamp field on `user-progress`).

**Behaviour:**
- Persists regardless of whether the concept has been quizzed
- Does not disappear when a quiz is completed
- Disappears automatically once 24 hours have elapsed since `last_seen_at`
- If compartment is empty, section is hidden entirely

### 3.2 Spaced Repetition

**Contents:** All concepts due for SR review — replaces the existing "Recommended today" and "Due for review" sections. Same underlying `getSRSQueues` logic.

**Behaviour:**
- Each row shows days-overdue badge when applicable
- Disappears once all concepts in it have been quizzed in the current or a previous session
- If a concept in this compartment produces wrong answers in the quiz, it moves to §3.3 after the session ends
- If compartment is empty, section is hidden entirely

### 3.3 Revise Wrong Answers

**Trigger:** Any concept where the user got at least one question wrong in a quiz session. Tracked via new `wrong_answer_indices` field on `user-progress` (object keyed by question type, same shape as `used_question_indices`).

**Behaviour:**
- Each row shows a red "N wrong" badge
- Tapping `+` on a row in quiz mode adds the concept to the session normally. When Start is pressed, if any concept in the session has entries in `wrong_answer_indices`, only those wrong questions are included in the queue for that concept (restricted pool). Concepts from other compartments added to the same session use their normal LRU question selection.
- Concept disappears from this compartment once all its wrong questions have been answered correctly in a subsequent quiz
- If compartment is empty, section is hidden entirely

---

## 4. Sticky Footer

Always visible at the bottom of the quiz tab.

| State | Left side | Right side |
|---|---|---|
| Stats mode | "Nothing selected" hint (muted) | Dimmed "Quiz ›" button |
| Quiz mode, 0 added | "Tap + or search to add concepts" hint (muted) | Nothing |
| Quiz mode, ≥1 added | Session chips (zone dot + name) | Green "Start →" button |
| Mid-quiz saved | Session chip summary | "Continue →" button |

---

## 5. Full-Screen Search Overlay

### 5.1 Structure

- Full-screen overlay with back arrow (closes overlay, stays in quiz mode)
- Search input at top, autofocused on open
- Results list below, scrollable
- Sticky footer inherited from parent (chips + Start button remain visible)

### 5.2 Results list

- All 119 concepts shown when search input is empty
- Grouped by zone in `ZONE_ORDER` sequence
- Zone name as a divider header between groups (zone color text)
- Each concept row: zone color dot · concept name · optional "unseen" label (muted, italic) · `+` button
- `+` turns to `✓` (green) when concept is added to session
- Faint separator line between rows within a zone group

### 5.3 Live filtering

- Filters on every keystroke — any concept whose name contains the typed string (case-insensitive)
- Matched characters highlighted in green within the concept name
- Zone dividers only shown if that zone has at least one match
- No results state: "No concepts match '[query]'"

### 5.4 Unseen concept popup

Triggered when user taps `+` on a concept with `seen === false`.

Appears as a modal **inside** the search overlay (not on the main quiz tab). Contains:

- Concept name + zone color dot
- Message: "You haven't studied this one yet."
- **"View info card"** button — shows the concept's info card within the overlay with a back button. On return, the popup reappears with **"Add to quiz"** replacing "Add anyway"
- **"Add anyway"** button — adds concept directly, closes popup

---

## 6. Save & Resume

### 6.1 Leaving mid-quiz

Triggered when user taps a different tab or the `←` back button while a quiz session is active.

Dialog with three options:
- **"💾 Save & exit"** — serialises current quiz state to `saved_session` IndexedDB store, exits to stats mode
- **"End session"** — discards session, exits to stats mode
- **"Cancel"** — dismisses dialog, stays in quiz

### 6.2 Resume banner

When the quiz tab loads and a `saved_session` record exists in IndexedDB:
- A blue **"Session in progress"** banner appears above the compartments
- Shows concept names + progress (e.g. "Bash · Git · npm — 4 / 9 done")
- **"Continue →"** button — restores session state and resumes quiz at saved position
- **"Discard"** button — deletes the saved session record, hides banner

### 6.3 Saved session data shape

```json
{
  "session": ["concept-id-1", "concept-id-2"],
  "queue": [{ "conceptId": "...", "type": "definition", "index": 0, "question": {} }],
  "queuePos": 4,
  "answers": [{ "conceptId": "...", "type": "definition", "index": 0, "correct": true }]
}
```

Stored in a new `saved_session` IndexedDB object store (single record, key `1`). Deleted on session completion (results screen reached) or on "Discard".

---

## 7. Data Model Changes

### 7.1 `user-progress` — new fields

| Field | Type | Purpose |
|---|---|---|
| `last_seen_at` | ISO timestamp string or null | Set when info card is opened. Used for 24hr "Explored Today" window. |
| `wrong_answer_indices` | `{ definition: [], usage: [], anatomy: [], build: [] }` | Tracks which question indices the user got wrong. Cleared per-type when all questions in that type are answered correctly. |

`markSeen` in `db.js` updated to also write `last_seen_at: new Date().toISOString()`.

### 7.2 New IndexedDB store: `saved_session`

- Key: hardcoded `1` (single record)
- Added in `DB_VERSION` bump (version 3)
- `openDB` upgrade handler creates the store if absent
- Read/write/delete via three new db functions: `getSavedSession()`, `saveMidSession(data)`, `deleteSavedSession()`
- **Rename conflict:** existing `saveSession()` in `db.js` saves quiz history to `quiz_sessions` store — rename it to `saveQuizSession()` throughout codebase before adding the new mid-session functions

### 7.3 DB version bump

`DB_VERSION` increments from `2` → `3`. Upgrade handler:
- Creates `saved_session` store
- Migrates existing `user-progress` records to add `last_seen_at: null` and `wrong_answer_indices` default if missing

---

## 8. Wrong Answer Tracking Flow

1. At end of each quiz session, for every concept in `_answers`:
   - For each answer where `correct === false`: append `{ type, index }` to `wrong_answer_indices[type]` on that concept's `user-progress` record
   - For each answer where `correct === true`: remove the index from `wrong_answer_indices[type]` if present
2. If after processing a concept has no entries left in any `wrong_answer_indices` array, it no longer appears in "Revise Wrong Answers"
3. When building a restricted quiz from "Revise Wrong Answers", `selectQuizQuestions` receives the wrong indices as the explicit question pool instead of the LRU pool

---

## 9. Out of Scope (this spec)

- Progress tab content redesign (deferred — content TBD)
- Map tab (deferred — stub remains)
- Any changes to the Explore (Curriculum) tab
- Any changes to the comprehension check flow
