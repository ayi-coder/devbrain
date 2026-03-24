# DevBrain UI Improvements — Design Spec

## Goal

Bring the DevBrain PWA's visual polish and interaction quality up to the standard of Duolingo/Quizlet: clear active states, smooth transitions, responsive press feedback, accessible contrast, and motion respect.

## Scope

16 targeted fixes across CSS, HTML, and JS view files. No new features — purely interaction quality and visual consistency.

---

## UI-1. Active Tab Indicator

**Problem:** `.nav-tab--active` only changes text colour from `#5c6370` to `#61afef` — a subtle shift that is nearly invisible at a glance on a dark background.

**Fix:** Three-part active treatment:
1. **Indicator bar** — 2px line at the top of the active tab, coloured `var(--blue)`
2. **Opacity** — active tab at full opacity; inactive at 55%
3. **Label weight** — active label `font-weight: 600`

```css
.nav-tab {
  position: relative;  /* needed for ::before positioning */
  opacity: 0.55;
  transition: opacity 0.2s, color 0.2s;
}
.nav-tab--active {
  color: var(--blue);
  font-weight: 600;
  opacity: 1;
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
```

---

## UI-2. Screen Transitions

**Problem:** Views switch via `display: none` → `display: block` — instant snap with zero animation.

**Fix:** Opacity + upward translate fade-in (220ms) on `view--active`. All views stay `position:absolute` at all times — no position toggling, which would collapse document height. The `#app` wrapper provides the height floor via `min-height:100vh`. Active view gets `z-index:1` to sit on top.

```css
#app {
  position: relative;
  min-height: 100vh;
}
.view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100vh;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.view--active {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
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

**Router note:** The router already only toggles the `view--active` class — no other changes needed in `router.js`.

---

## UI-3. Button and Interactive Element Press States

**Problem:** No `:active` state on any interactive element. Tapping a button with zero visual feedback feels broken on mobile.

**Fix:**

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

## UI-4. Loading State (Skeleton)

**Problem:** Views appear while async DB queries run — blank dark screen for 50–200ms with no indication anything is happening.

**Fix:** Each view renders 2–3 shimmer skeleton blocks immediately on mount, then swaps them for real content once data resolves.

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg-surface) 25%, var(--border) 50%, var(--bg-surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  border-radius: 8px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

JS pattern per view:

```js
async function renderX(container) {
  // Show skeleton immediately
  container.innerHTML = `
    <div class="skeleton" style="height:80px;margin-bottom:12px;"></div>
    <div class="skeleton" style="height:60px;margin-bottom:12px;"></div>
    <div class="skeleton" style="height:60px;"></div>
  `;
  // Fetch data
  const data = await getDataFromDB();
  // Replace with real content
  container.innerHTML = buildRealHTML(data);
}
```

---

## UI-5. Nav Tab Icons — Replace Emoji with SVG

**Problem:** Emoji (🏠 🗺️ 📊) render inconsistently across Android versions and cannot be styled for active/inactive states.

**Fix:** Replace with inline SVG icons in `index.html`. Active colour is inherited via `fill: currentColor` from `.nav-tab--active { color: var(--blue) }`.

Icons (outline style, ~200 bytes each):
- **Home** — house outline
- **Concepts** — grid/map outline
- **Progress** — bar chart outline

```html
<!-- Example: Home tab -->
<button class="nav-tab" data-view="home" onclick="location.hash='#home'">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <!-- house path -->
  </svg>
  <span>Home</span>
</button>
```

No external requests, no icon library dependency.

---

## UI-6. Card and List Entrance Animations

**Problem:** Cards just appear. Staggered entrance gives the eye a reading path and makes the interface feel alive.

**Fix:** Staggered fade-up on `.card` and `.concept-card` only (not `.quiz-option` — see UI-7). CSS nth-child delays, no JS needed. Capped at 5 items to avoid animating entire long lists.

```css
.card, .concept-card {
  animation: cardEnter 0.25s ease-out both;
}
.card:nth-child(1), .concept-card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2), .concept-card:nth-child(2) { animation-delay: 40ms; }
.card:nth-child(3), .concept-card:nth-child(3) { animation-delay: 80ms; }
.card:nth-child(4), .concept-card:nth-child(4) { animation-delay: 120ms; }
.card:nth-child(5), .concept-card:nth-child(5) { animation-delay: 160ms; }

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

The quiz answer container (`#answer-area`) animates as a group via `cardEnter` instead of individual `.quiz-option` elements, preventing conflict with UI-7 feedback animations.

---

## UI-7. Quiz Answer Feedback Animations

**Problem:** Correct/wrong feedback is colour-only. Bounce on correct and shake on wrong are core to why quiz apps feel rewarding.

**Fix:** Keyframe animations on the feedback CSS classes. These fire on `.quiz-option--correct` / `--wrong` only — not on base `.quiz-option` — so they do not conflict with UI-6 entrance animation.

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

**Problem:** The progress fill jumps to its final value on first render — the existing `transition: width 0.3s` never fires.

**Fix:** Set `width: 0%` first, then update in a double `requestAnimationFrame` so the browser paints the zero state before the transition starts.

```js
const fill = container.querySelector('.progress-fill');
fill.style.width = '0%';
requestAnimationFrame(() => requestAnimationFrame(() => {
  fill.style.width = masteryPct + '%';
}));
```

Applied in: `views/home.js`, `views/results.js`.

---

## UI-9. Typography Scale

**Problem:** Only two text sizes used consistently. Headings are inline-styled with no shared system.

**Fix:** 6-level type scale as CSS custom properties. View files replace all inline `font-size` with these classes during the structured learning implementation pass.

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

---

## UI-10. Back Navigation

**Problem:** Learn and quiz screens have no back button — the only exit is the Android system back button.

**Fix:** Back chevron in the screen header of `learn.js` and `quiz.js`. Calls `history.back()`. On the quiz screen, shown only before the quiz begins (plan/study phase); hidden once the quiz is in progress (existing quit-dialog guard handles that phase).

```html
<div class="screen-header" style="display:flex;align-items:center;gap:12px;">
  <button class="back-btn" onclick="history.back()">&#8592;</button>
  <div><!-- title --></div>
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

---

## UI-11. Card Spacing System

**Problem:** `margin-bottom` values of 8px, 10px, 12px, 16px appear inconsistently. No grid rhythm.

**Fix:** Standardise on a 4-point grid. Allowed values: 4, 8, 12, 16, 20, 24px. Remove the 10px outliers.

```css
.btn-primary   { margin-bottom: 12px; }  /* was 10px */
.btn-secondary { margin-bottom: 12px; }  /* was 10px */
.card          { margin-bottom: 12px; }  /* unchanged */
```

All inline `margin`/`padding` values in view files are audited and corrected to the nearest grid value during the structured learning implementation pass.

---

## UI-12. Screen Header Enhancement

**Problem:** The gradient `#21252b → #2c313a` is a 6% brightness difference — imperceptible. The header lacks visual weight.

**Fix:** Replace gradient with solid `var(--bg-deep)` + 1px border-bottom separator.

```css
.screen-header {
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border);
  padding: 20px 16px 16px;
  margin: -16px -16px 16px;
  border-radius: 0 0 14px 14px;
}
```

---

## UI-13. Tappable vs Non-Tappable Cards

**Problem:** On the Progress page, concept cards look identical whether interactive or not. Users cannot tell what they can tap.

**Fix:** Tappable cards get `.card--tappable` with a right-arrow indicator. Info-only cards stay plain.

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

Applied to concept cards in `views/concept-map.js` and the learn entry point. Non-interactive progress cards do not get this class.

---

## UI-14. Semantic Chip Colours

**Problem:** Default `.chip` is always purple — no consistent semantic meaning. Purple is used for mastery/accent elsewhere.

**Fix:** Default `.chip` becomes neutral grey. Purple is explicit opt-in via `.chip--purple` for mastery/level-related chips only.

```css
.chip {
  background: rgba(171,178,191,0.1);
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

**No view file changes needed.** Existing `.chip` usage on category labels and concept names correctly becomes neutral grey by default. Only new mastery/level chips added during structured learning implementation explicitly use `.chip--purple`.

---

## UI-15. Text Contrast Fix

**Problem:** `var(--text-muted)` is `#5c6370` on `#282c34` — contrast ratio ~3.4:1, below WCAG AA minimum of 4.5:1.

**Fix:** Single token change.

```css
:root {
  --text-muted: #7a8394;   /* was #5c6370 — contrast ratio now ~5.1:1 */
}
```

Affects all labels, metadata, and placeholder text app-wide.

---

## UI-16. Reduce Motion Respect

**Problem:** All animations run unconditionally, ignoring Android accessibility "reduce motion" setting.

**Fix:** Single block at the bottom of `theme.css`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations still exist — they are made imperceptibly short for users who opt out of motion.

---

## Files to Modify

| File | Changes |
|------|---------|
| `css/theme.css` | UI-1 through UI-16: all CSS additions and token changes |
| `index.html` | UI-2: `#app` position wrapper; UI-5: SVG nav icons |
| `views/home.js` | UI-4: skeleton loading; UI-8: progress bar double-rAF |
| `views/concept-map.js` | UI-4: skeleton loading; UI-13: `.card--tappable` |
| `views/learn.js` | UI-10: back button; UI-9: type scale classes |
| `views/quiz.js` | UI-10: back button (pre-quiz only); UI-9: type scale classes |
| `views/results.js` | UI-8: progress bar double-rAF; UI-9: type scale classes |
| `views/progress.js` | UI-13: `.card--tappable`; UI-9: type scale classes |
