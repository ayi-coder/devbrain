# DevBrain Redesign — Design Spec

**Date:** 2026-03-25
**Status:** Updated

---

## Overview

DevBrain teaches tech vocabulary to "vibe coders" — beginners who use AI coding tools (Cursor, Copilot, Claude) but lack the vocabulary to understand what's happening around them. The redesign replaces a flat quiz-card model with a spatial globe map that makes progress feel like exploration rather than a checklist. All existing spaced repetition logic is preserved; it's surfaced through the dedicated Quiz tab rather than scattered across the app.

**Goal:** A mobile PWA where users explore an interconnected globe knowledge map, read concept lessons in the Curriculum, and build dedicated quiz sessions in the Quiz tab — with a clear separation between exploring, reading, and practicing.

---

## 1. Navigation

### 1.1 Four-tab structure

| Tab | Icon (outline inactive / filled active) | Purpose |
|---|---|---|
| Home | House icon | Daily recommendation nudge + ambient progress |
| Curriculum | List/rows icon | Full zone/subcategory/concept browser + lesson reading |
| Map | Map/terrain icon | Globe exploration map — visual progress only |
| Quiz | Lightning bolt icon | Session builder + spaced repetition practice |

No Progress tab. Stats are ambient on the Home cards (map coverage + quiz health).

### 1.2 Tab bar visual

- SVG outline/filled icon pairs — no emojis
- Active tab: filled icon + `#61afef` text + `rgba(97,175,239,0.08)` pill background
- Inactive: outline icon + `#3e4451` text
- Backdrop blur (`blur(12px)`) over content when scrolled
- Border top: `1px solid #1a1e28`
- 4 tabs on 320px = 80px per tab — validated against 44px minimum touch target guideline

### 1.3 UI density principles

- More vertical padding inside cards (14–16px) — breathing room over compactness
- Maximum 4 elements per card row with clear size hierarchy (primary / secondary)
- Section headers: `12px regular weight #4b5263` — signposts, not headings
- Zone colors used only on dot/accent — neutral tones for everything else per screen
- Borders used only where background contrast is insufficient to differentiate

---

## 2. Home Tab

### 2.1 Top bar

- App name "DevBrain" (`#e5c07b`, 17px, weight 800) — left aligned
- Nothing else on the right (no streak numbers, no XP, no greeting)

### 2.2 Hero card — daily recommendation nudge

- Background: `linear-gradient(135deg, #161d2e, #111620)` with blue border `rgba(97,175,239,0.2)`
- Tag pill: "✦ Ready for today"
- Title: "N concepts due" — based on spaced repetition engine output
- Subtitle: "Based on your last session · ~N min"
- Concept pills: each shows a colored dot (zone color) + concept name
- Footer: "Go to Quiz →" button — navigates to Quiz tab (does NOT launch quiz directly)
- The hero card is a nudge only; the Quiz tab is where sessions are built and started

### 2.3 Secondary cards row

Two cards side by side:

**Map Coverage card**
- Title: "Map Coverage"
- Large number: concepts `practiced` (e.g. "18") — not "18/120" (endowed progress, avoids demotivating)
- Label: "concepts explored"
- Progress bar: `linear-gradient(90deg, #61afef, #56b6c2)`, width = practiced/total
- Milestone: "Next: 25 concepts"

**Quiz Health card**
- Title: "Quiz Health"
- Ring SVG: percentage of recent sessions with >60% correct
- Session dots: last 5 sessions, colored by score band
  - Green (`#98c379`): ≥ 70% correct
  - Yellow (`#e5c07b`): 40–69% correct
  - Red (`#e06c75`): < 40% correct
- Label: "last 5 sessions"

---

## 3. Curriculum Tab

### 3.1 Screen header

- Title: "Curriculum"
- Subtitle: "8 zones · N concepts total"

### 3.2 Zone accordion (Level 1 → Level 2)

Each zone row:
- Colored dot (zone color)
- Zone name
- Progress count (e.g. "8 / 18") — counts `practiced` concepts
- **"Map ↗" button** — deep-links to zone on Map tab (see §3.6)
- Chevron — rotates 90° when open

Below the row: a 2px colored progress bar (zone color), width = practiced/total.

Tapping the zone row (not the Map button) toggles the accordion open/closed.

### 3.3 Subcategory list (Level 2)

Shown when parent zone is open. Each subcategory row:
- 2px colored left border (zone color)
- Subcategory name
- Concept count pill (e.g. "6")
- **"Map ↗" button** — deep-links to subcategory cluster on Map tab

Tapping the subcategory name (not the Map button) pushes to the concept list screen.

### 3.4 Concept list screen (Level 3 — push navigation)

Back button shows parent subcategory name. Screen shows:
- Header: subcategory name + zone tag pill
- List of all concepts in this subcategory, each row:
  - Status dot color derived from concept state:
    - Green: `practiced === true && next_review_date > today` (done, not yet due)
    - Yellow: `practiced === true && next_review_date ≤ today` (due for review)
    - Blue: `seen === true && practiced === false` (lesson read, never quizzed)
    - Gray: `seen === false` (locked — not yet discovered)
  - Concept name
  - Status label (done / review / new / locked)

Tapping a concept pushes to the lesson screen.

### 3.5 Lesson screen

Back button shows parent subcategory. Content:
- Concept name (large)
- Zone tag pill
- **"What it is" block** — plain-language definition with **hyperlinked terms**
- **"Example command" block** (monospace, green text) — only for command concepts
- **"Example" block** — one example visible by default with a "Read more" toggle revealing two additional examples
- **"Use it when" block** — practical trigger context
- Two action buttons at bottom:
  - **"Test yourself →"** — launches 3-question mini-drill for this concept (see §6.7)
  - **"Add to Quiz session →"** — deep-links to Quiz tab with this concept pre-loaded (see §4.4)

#### 3.5.1 Hyperlinked terms

- Words in the definition that match other concept names are highlighted in that concept's zone color
- Tapping a highlighted term slides up a **linked concept overlay** (bottom sheet):
  - Header: `← Back to [original concept name]` — dismisses overlay and returns to original lesson
  - Concept name + zone tag
  - Full "What it is" definition for the linked concept
  - If linked concept is **locked** (`seen === false`): shows the concept name + zone tag + "Explore more of this zone to unlock" — no definition. The name is intentionally visible here (it appears in the definition text the user is already reading) even though it has no label on the globe.
  - Bridge nodes display both zone colors in the tag
- Overlay stack depth: maximum 1 level — tapping a highlighted term inside a linked overlay replaces it rather than stacking a third sheet
- Same term appearing multiple times in a definition: all instances are highlighted
- Links stored as explicit markup in definition strings: `[term](concept-id)` syntax

#### 3.5.2 Lesson `seen` state

- First time the lesson screen is opened for a concept → concept state is set to `seen`
- `seen` state: concept appears in Quiz tab recommendations, concept dot glows dimly on globe
- `practiced` state: set after at least one quiz answer recorded (any result, any mode)

### 3.6 "Map ↗" deep-link behavior

1. Switch to Map tab
2. If zone-level: animate globe to face that zone panel, pulse it for 300ms
3. If subcategory-level: animate globe to zone, zoom to subcategory region, pulse subcategory area for 300ms
4. Curriculum tab preserves its scroll position when user returns

---

## 4. Map Tab

The Map tab is **exploration and visual progress only**. There are no quiz entry points on this tab.

### 4.1 Globe — world view

- **Rendering:** Canvas 2D, D3 `geoOrthographic` projection
- **Structure:** 8 zone panels generated as spherical Voronoi tessellation from seed coordinates defined in `globe-seeds.json` config file
- **Background:** Deep dark (`#060810`) with subtle atmospheric rim glow (radial gradient on canvas edges)
- **Auto-rotation:** 4°/s idle rotation via `requestAnimationFrame`; stops on touch; resumes after 3s timeout
- **Interaction:** Versor (quaternion) drag for gimbal-lock-free rotation; pinch-to-zoom; +/− buttons

**Zone panel rendering:**
- Radial gradient fill: holographic glow effect per zone using zone color
- Panel border: zone color stroke
- Zone label with back-face fade (dot product of centroid vs. view direction → opacity)

**Earned connections:**
- When a bridge node concept reaches `practiced` state, a dashed great-circle arc appears between its two connected zone panels
- Arc uses gradient stroke from zone A color to zone B color
- Opacity: 0.3–0.4 so arcs don't clutter early on

### 4.2 Globe — LOD zoom system

Three zoom levels:

| Zoom level | What appears |
|---|---|
| k < 2.5 | Zone panels with labels and glow — world view |
| k ≥ 2.5 (after tapping zone) | Subcategory "country" regions within the zone panel |
| k ≥ 5 (after tapping subcategory) | Concept "city" dots within the subcategory region |

**Zone tap → subcategory view:**
- Tapping a zone panel triggers `zoomToZone()`: globe rotates to face the zone + scale animates to k=2.5
- Zone panel subdivides into subcategory regions (sub-Voronoi from subcategory seed points in `globe-seeds.json`)
- Subcategory region labels appear (subcategory name)
- Tap target minimum: after zoom animation, subcategory regions must be ≥ 44px — verified per zone

**Subcategory tap → concept view:**
- Tapping a subcategory region triggers `zoomToSubcategory()`: further zoom to k=5+
- Concept dots appear as small circles at their defined positions within the subcategory region
- `practiced` concepts: filled circle, zone color, glow
- `seen` (not yet practiced): dim filled circle, zone color, reduced opacity
- Undiscovered/locked: very dim dot, gray, no label

**Back navigation:**
- At concept view: tapping outside dots zooms out to subcategory view
- At subcategory view: back button returns to world view

### 4.3 Globe — concept info card

Tapping any concept dot (regardless of state) slides up a bottom sheet info card:
- Drag handle
- Concept name + zone tag pill
- Subcategory label
- "What it is" — first sentence of definition only (truncated, not full text)
- **"View lesson →"** — deep-links to the Curriculum lesson screen for this concept
- No quiz buttons of any kind on this sheet

### 4.4 Bridge nodes on globe

Cross-zone concepts appear in every zone they belong to:
- Diamond shape (circle rotated 45°) instead of round dot
- Stroke: gradient from zone A color to zone B color
- Fill: dark (`#0d0f14`)
- Completion state is shared — marking it `practiced` in one zone marks it everywhere
- Bridge nodes are **not counted** in any zone's progress total

### 4.5 Globe positioning config

Zone panel seeds and subcategory seeds are defined in `data/globe-seeds.json`:
```json
{
  "zones": [
    { "id": "shell-terminal", "seed": [-30, 20] },
    ...
  ],
  "subcategories": [
    { "id": "bash-commands", "zone": "shell-terminal", "seed": [-28, 18] },
    ...
  ],
  "concepts": [
    { "id": "bash-mkdir", "subcategory": "bash-commands", "seed": [-27, 17] },
    ...
  ]
}
```
Positions are defined once and never auto-generated at runtime.

### 4.6 Performance

- **Two-layer canvas:** Layer 1 (static) — Voronoi fills, edges, labels — only redrawn on rotation/zoom. Layer 2 (animated) — glow pulses, dot animations — drawn every `requestAnimationFrame`.
- Static layer cached to offscreen canvas; composite on each frame.
- **Frame-rate fallback:** After 10 frames, if sustained below 30fps, disable `shadowBlur` glow effects and replace with flat fills. Full structure preserved on slow devices.

---

## 5. Quiz Tab

### 5.1 Tab overview

The Quiz tab is the only place full multi-concept quiz sessions start. It shows SRS recommendations and lets the user build a custom session of 1–5 concepts.

### 5.2 Session builder

- Card at top of screen: "Your session" with 0/5 count
- Empty state: instruction text "Tap concepts below to add them" — no placeholder slot UI
- When concepts added: colored chips (zone dot + concept name + × remove) appear in the card
- **"Start session →"** button: disabled when 0 concepts selected, enabled when ≥ 1
- At 5/5: remaining recommendation cards dim with "Session full" label

### 5.3 Recommended today section

- Section label: "Recommended today" (12px, muted)
- Shows two types of concepts, interleaved, sorted by due date ascending (most urgent first):
  1. **Due today:** `practiced === true && next_review_date ≤ today && next_review_date ≥ today - 2 days` (due within the last 2 days — not deeply overdue)
  2. **New (ready):** `seen === true && practiced === false` — no `next_review_date` yet; appended after due-today concepts, sorted by zone order
- Concepts more than 2 days overdue are **excluded** from this section — they appear only in "Due for review" below
- Each card: colored zone dot + concept name (primary) + zone name + status badge ("Due" or "New") + add button
- Tapped card: add button shows green checkmark + chip appears in session builder

### 5.4 Due for review section

- Section label: "Due for review" (12px, muted)
- Shows: `practiced === true && next_review_date < today - 2 days`
- Sorted by most overdue first (largest `today - next_review_date` value)
- Compact row format: days-overdue badge (red ≥ 7d, orange 3–6d, yellow 2–3d) + zone dot + concept name + add button
- A concept added to session shows strikethrough and checkmark on its row

### 5.5 SRS threshold definitions

- **Due today (Recommended section):** `practiced === true && next_review_date ≤ today && next_review_date ≥ today - 2 days`
- **New (Recommended section):** `seen === true && practiced === false`
- **Overdue (Due for review section):** `practiced === true && next_review_date < today - 2 days`
- **Locked (hidden from Quiz tab):** `seen === false`
- A concept never appears in both sections simultaneously — the 2-day cutoff is the dividing line

### 5.6 Empty states

- Zero `seen` concepts: entire recommendations area shows "Explore the map and read lessons first — concepts you discover will appear here."
- SRS queue empty (all concepts up to date): "You're all caught up — pick anything to practice anyway" with a "Browse all concepts" link to the Curriculum tab.

### 5.7 Active quiz view

- Progress bar at top with question count (e.g. "4 / 9")
- Concept mini-bar strip below progress: horizontal scroll showing session concepts as pills
  - Done: dim, zone color border
  - Current: highlighted in zone color with zone color background
  - Upcoming: faded, zone color border
- Back arrow (`←`) exits session with confirmation if questions remain
- After quiz completes: results screen showing score per concept, then returns to Quiz tab

### 5.8 Pre-loading a concept from other tabs

Deep-link format: `#quiz?preload=<concept-id>`

When the Quiz tab mounts and `preload` param is present:
- Concept is added to session builder automatically
- Hash is normalized back to `#quiz` after reading
- If session is already full (5/5), pre-load is ignored silently

---

## 6. Quiz System

### 6.1 Question types

| Type | Description | Tier |
|---|---|---|
| Definition | "What does X do?" — multiple choice, 4 options | 1 |
| Multiple choice (usage) | "Which command does X?" or "What happens when…?" | 2 |
| Fill in the blank | Complete a sentence about the concept | 2 |
| Command anatomy | Tap a token → tap its label from a bank | 3 |
| Build command | Assemble a command from a word bank | 3 |

### 6.2 Tier unlock rules

- Tier 1 unlocks immediately (all concepts)
- Tier 2 unlocks after Tier 1 answered correctly at least once
- Tier 3 unlocks after Tier 2 answered correctly at least once
- Within a quiz session, questions draw from all unlocked tiers for each concept

### 6.3 Session rules (Quiz tab full session)

- Per session: questions per concept = number of unlocked tiers for that concept (minimum 2, maximum 3)
  - Tier 1 only unlocked: 2 questions
  - Tiers 1–2 unlocked: 2 questions (1 per tier)
  - All tiers unlocked: 3 questions (1 per tier, or 2 from most recently unlocked tier)
- Selection priority: least-recently-used questions first (LRU across all unlocked tiers)
- After all 8 questions for a type have been used, cycle restarts
- Max 5 concepts per session; max total questions = 15 (5 concepts × 3 questions)

### 6.4 Mini-drill rules (Curriculum lesson screen)

- Exactly 3 questions for the single concept
- Draws from all already-unlocked tiers for that concept
- Uses the same `used_question_indices` pool as full sessions — no duplication
- On completion: persist `used_question_indices` to IndexedDB immediately, then return user to lesson screen
- Result feeds back into SRS scoring normally

### 6.5 Shared question pool

Both the full session (Quiz tab) and mini-drill (Curriculum) read from and write to the same `used_question_indices` per concept per type. Session type is irrelevant — only usage history matters.

### 6.6 Concept discovery states

Two distinct fields per concept in IndexedDB:

| Field | Type | Trigger |
|---|---|---|
| `seen` | boolean | First time the lesson screen is opened |
| `practiced` | boolean | First quiz answer recorded (any result, any mode) |

- `seen = false`: concept dot on globe is locked (very dim, no label); not shown in Quiz tab
- `seen = true, practiced = false`: concept dot glows dimly; appears in Quiz tab "Recommended today"
- `practiced = true`: concept dot glows fully; counted in Map Coverage progress

### 6.7 Spaced repetition

- SM-2-style engine: `next_review_date = last_review_date + interval_days`
- Due: `next_review_date ≤ today`
- On answer: ease factor and interval recalculated per SM-2 formula
- Overdue cards: surfaced for review but interval not reset aggressively — SM-2 recalculation applied normally

### 6.8 Command anatomy interaction

1. Command rendered as individual token spans (e.g. `git`, `commit`, `-m`, `"message"`)
2. User taps a token → highlights (selected state)
3. Label bank below (e.g. "command", "flag / option", "argument", "subcommand")
4. User taps a label → token gets labeled, label chip dims
5. Correct label: token turns green; wrong label: token turns red with correct label shown
6. Repeat until all tokens labeled

### 6.9 Build command interaction

1. Task description shown ("Build the command to…")
2. Answer area: monospace blank bar
3. Word bank: correct words + plausible real distractors
4. User taps words to add in order; tapping a placed word removes it back to bank
5. Submit button validates full sequence

---

## 7. Question Quality Standards

### 7.1 Distractor rules (all question types)

- Wrong options must be **real things** — other tools, real commands, plausible behaviors
- At least one distractor from an adjacent concept (e.g. for `npm`, use `pip` or `brew` — real package managers, wrong ecosystem)
- Wrong options describe what a **similar real tool** does, not an unrelated thing
- **Never** use joke, absurd, or obviously wrong options
- Maximum 4 answer options per question (research-backed optimal for retention)
- Avoid "all of the above" and "none of the above" — gameable and reduce learning value

### 7.2 Difficulty calibration

- Tier 1: recognition — distractors require domain knowledge to rule out, not just guessing
- Tier 2: practical usage — user must know when/how to use it, not just what it is
- Tier 3: construction/labeling — requires real syntax knowledge with no obvious answers
- Target: attentive users correct 70–80% of the time (per Butler 2018 research)

### 7.3 Curriculum content

Full content for all ~120 concepts documented in `curriculum-content.md`:
- Plain-language definition (no jargon)
- Core real-world analogy
- 1 visible example + 2 examples behind "Read more" toggle
- "Use it when" practical trigger
- 8 quiz questions per concept across Tiers 1–3 with quality distractors

Content follows the pedagogical approach: analogy first, concrete example second, abstract definition third.

---

## 8. Data Model

### 8.1 IndexedDB store separation

Content and user state are stored in **separate IndexedDB object stores** to support curriculum content updates without overwriting user progress:

- **`concepts-content`** store — static, bundled with the app, keyed by `id`:
  - Curriculum fields: `id`, `name`, `zone`, `subcategory`, `tier_unlocked`, `is_bridge`, `bridge_zones`, `what_it_is`, `analogy`, `examples[]`, `example_command`, `use_when`, `questions{}`

- **`user-progress`** store — mutable user state, keyed by concept `id`:
  - Progress fields: `id`, `seen`, `practiced`, `next_review_date`, `last_review_date`, `ease_factor`, `interval`, `repetitions`, `used_question_indices{}`

On first install: `user-progress` records are created with all fields at default values for every concept in `concepts-content`. On curriculum content updates: new content is written to `concepts-content` without touching `user-progress`. Migration script handles structural schema changes.

**Content record example:**
```json
{
  "id": "bash-mkdir",
  "name": "mkdir",
  "zone": "shell-terminal",
  "subcategory": "bash-commands",
  "tier_unlocked": 1,
  "is_bridge": false,
  "bridge_zones": [],
  "what_it_is": "mkdir stands for [make directory](your-machine-directory)...",
  "analogy": "Exactly like right-clicking and choosing New Folder...",
  "examples": [
    { "text": "mkdir my-project creates a folder...", "visible": true },
    { "text": "mkdir -p src/components/buttons...", "visible": false },
    { "text": "mkdir images css js creates three...", "visible": false }
  ],
  "example_command": "mkdir my-project",
  "use_when": "Setting up a new project structure from the terminal.",
  "questions": {
    "definition": [...],
    "usage": [...],
    "anatomy": [...],
    "build": [...]
  }
}
```

**User progress record example:**
```json
{
  "id": "bash-mkdir",
  "seen": false,
  "practiced": false,
  "next_review_date": null,
  "last_review_date": null,
  "ease_factor": 2.5,
  "interval": 1,
  "repetitions": 0,
  "used_question_indices": {
    "definition": [],
    "usage": [],
    "anatomy": [],
    "build": []
  }
}
```

### 8.2 Bridge node record

Bridge nodes follow the same two-store separation as regular concepts. `is_bridge: true` flags them in the content store. They appear once in the SRS recommender regardless of how many zones they belong to.

**Content store entry:**
```json
{
  "id": "bridge-stdin",
  "name": "stdin / stdout",
  "is_bridge": true,
  "bridge_zones": ["shell-terminal", "editor-code"],
  "tier_unlocked": 1,
  "what_it_is": "...",
  "analogy": "...",
  "examples": [...],
  "questions": { "definition": [...], "usage": [...], "anatomy": [...], "build": [...] }
}
```

**User progress store entry:**
```json
{
  "id": "bridge-stdin",
  "seen": false,
  "practiced": false,
  "next_review_date": null,
  "last_review_date": null,
  "ease_factor": 2.5,
  "interval": 1,
  "repetitions": 0,
  "used_question_indices": { "definition": [], "usage": [], "anatomy": [], "build": [] }
}
```

### 8.3 Zone progress calculation

- Zone progress = concepts in zone where `practiced === true` and `is_bridge === false`
- Bridge node `practiced` state tracked separately — contributes to earned connections on globe, not zone progress
- Map Coverage on Home card = total `practiced` concepts across all zones (excluding bridge nodes)

### 8.4 Definition link markup

Definition strings use `[term](concept-id)` syntax for hyperlinked terms:
```
"mkdir stands for [make directory](your-machine-directory). It creates a new [folder](your-machine-directory) from the terminal."
```
The renderer parses this at display time and applies the zone color highlight + tap handler.

---

## 9. Zone & Subcategory Structure

| Zone | Color | Subcategories |
|---|---|---|
| Your Machine | `#c678dd` | Operating Systems · File System · System Concepts |
| Shell & Terminal | `#e5c07b` | Core Concepts · Bash Commands · PowerShell Commands · Scripting |
| Git & GitHub | `#e06c75` | Core Concepts · Git Commands · GitHub |
| The Web | `#61afef` | How the Web Works · APIs & Data · Tools & Security |
| Editor & Code | `#98c379` | VS Code · Code Fundamentals · Software Concepts |
| Packages & Env | `#56b6c2` | Package Managers · Project Config · Dependencies |
| AI & Prompting | `#d19a66` | How AI Works · Using AI Tools · Prompting |
| Cloud & Deploy | `#abb2bf` | Deployment · Databases · Storage |

Target: ~120 concepts across all zones (~14–18 per zone). Bridge nodes (~5–8) stored separately.

---

## 10. Preserved from Existing App

- **SRS engine** (SM-2-style scheduling, intervals, ease factors) — unchanged
- **IndexedDB schema** — extended with `seen`, `practiced`, `examples[]`, `analogy`, `what_it_is`, and restructured `used_question_indices` object; migration script required for existing data
- **PWA service worker** — unchanged
- **Hash-based SPA router** — extended with query param support (`#quiz?preload=<id>`) and new `#quiz` route
- **Existing concept data** — migrated to new schema; questions audited against quality standards separately

---

## 11. Out of Scope

- Accounts / cloud sync (local storage only)
- Social / sharing features
- Notifications / push reminders
- FlutterFlow zone (removed)
- Progress tab (removed)
- Streak counter / XP display on home bar (removed)
- Quiz entry points on the Map tab (exploration only)
