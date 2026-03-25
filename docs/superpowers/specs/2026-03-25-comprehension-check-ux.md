# UX Patterns for Inline Comprehension Checks
## Research & Pattern Analysis for the DevBrain Lesson Screen

**Date:** 2026-03-25
**Context:** Mobile PWA lesson screen. User reads a concept explanation, then optionally triggers a 3-question self-check. Results do NOT feed SRS scheduling or quiz scores. User returns to the lesson screen afterward.

---

## 1. The Core UX Problem to Solve

The lesson screen sits in a reading flow. The comprehension check is a *side-thought* — "before I move on, let me see if I actually got this" — not a mode switch. The danger is that the wrong container pattern makes it feel like a mode switch anyway: the user loses their reading context, has to consciously "go back," and the lesson screen feels heavier than it is.

The right pattern makes the check feel like a brief reflex action that returns the user exactly where they were, without ceremony.

---

## 2. Vocabulary: Why "Comprehension Check" Framing Matters

Research on formative vs summative assessment UX consistently shows that **labeling determines stakes perception**. Words like "Test yourself," "Quiz," or anything with a score implication shift the user's mental model toward evaluation. Words like "Check your understanding," "Have I understood this?", or "Quick check" signal reflection rather than judgment.

This matters practically because:

- Users who perceive an activity as "scored" exhibit avoidance behavior (skipping it) or anxiety about correctness
- Users who perceive it as a self-check engage more freely and recover better from wrong answers
- The absence of a score display reinforces the framing — but the label sets the expectation before any question appears

**Implication for DevBrain:** The button on the lesson screen should read something like "Check my understanding" or "Have I understood this?" — not "Test yourself." The current label "Test yourself →" in the spec (§3.5) works against the no-stakes intent, even though the underlying system is correctly non-scored. The label is the first UX signal.

Within the check itself, questions should use language like "In your own understanding..." or simply present questions without a "score" framing at the end. A completion message like "Done — you can revisit this lesson anytime" is more appropriate than "You got 2/3 correct."

---

## 3. Research Foundation

### 3.1 The Overlay Appropriateness Test (NNGroup)

NNGroup's guidance on overlay overuse identifies five valid use cases for interrupting users with an overlay:

1. Confirming serious irreversible actions
2. Collecting essential information before proceeding
3. Urgent notifications
4. User-initiated progressive disclosure
5. Mobile instructional content where inline space is insufficient

Case 4 is the one that applies here. The check is **user-initiated** (they tap a button) and it **reveals additional interaction relevant to their current task** (the lesson they just read). This is a legitimate use of an overlay — but only if the overlay is clearly attached to the current context rather than appearing to be a separate screen.

The key failure mode is: the overlay feels "launched from" the lesson rather than "existing within" it. That's the design challenge.

### 3.2 Thumb Zones and Bottom-Up Interaction (Hoober, 2013)

Steven Hoober's observational study of 1,333 users found 49% use their phone one-handed with thumb as the sole input. The natural reach zone for one-handed use is the center-bottom of the screen. The top third of the screen (especially top corners) requires repositioning the grip.

**Implication:** A bottom-up panel (bottom sheet) aligns with one-handed reach. A full-screen takeover that places controls at the top (e.g., a close button in the top-left) forces grip readjustment. For a 3-question flow with answer buttons, bottom-up keeps everything in the thumb zone.

However, Hoober also notes users switch grips when they see controls at the top — so this isn't a hard constraint, just a friction cost. For a flow as short as 3 questions, grip-switching once is acceptable. It becomes a problem if controls are always at the top and the flow is longer.

### 3.3 Modal Interruption Cost (NNGroup, Overlay Guidance)

NNGroup's overlay research shows the primary cost of modals is **breaking task continuity**. For a comprehension check, the "task" is reading and understanding the lesson. The check is supplementary — the user should be able to abandon it without losing their place. This rules out any pattern where the lesson screen is destroyed or replaced by the check.

The principle: the lesson screen must remain as the "ground truth" layer. The check lives on top of it or is injected into it temporarily.

### 3.4 Peak-End Rule (Kahneman, via LawsOfUX)

Users judge a short interactive experience by its peak moment and its ending — not the average of all moments. For a 3-question comprehension check:

- The **peak** is the moment of answering the hardest question and seeing feedback
- The **end** is the moment of returning to the lesson

Design implication: the return-to-lesson transition is the last thing the user experiences from the check. It should feel conclusive and positive — "I finished, I'm back" — not ambiguous ("wait, where am I?"). A smooth close animation back to the lesson screen matters more than the check's visual style.

### 3.5 Zeigarnik Effect and the Cost of Interruption

The Zeigarnik effect shows users retain unfinished tasks in working memory. If the comprehension check feels like it interrupted the lesson flow rather than completed it, users are left with a mild sense of incompleteness about the lesson itself. The check should feel like a natural *close* to the reading phase, not a diversion from it.

Design implication: the check should be positioned at the end of the reading content (after the lesson body), not floating mid-screen. The user's mental model should be: "I read the lesson, then I did the check, then I was done with this concept." Sequential, not interrupted.

---

## 4. What Real Apps Do

### 4.1 Duolingo — Lesson-then-practice separation

Duolingo's lesson screens (where it explains grammar or vocabulary) end with a "Continue" button that pushes the user into a dedicated practice session. The practice is NOT on the same screen — it replaces it entirely and uses a distinct visual mode (green header, progress bar). Returning from practice takes the user back to the lesson path, not the lesson screen itself.

**What this tells us:** Duolingo treats reading and practice as two distinct modes with a hard boundary. This works for Duolingo because the practice IS the SRS-scored activity — it has high stakes and a distinct purpose. It would be wrong for DevBrain's comprehension check, which deliberately has no stakes and should feel like a natural extension of reading.

### 4.2 Khan Academy — Inline practice below lesson content

Khan Academy's article format (on desktop and mobile web) places "Check your understanding" questions inline below the lesson text. The user scrolls down from the article into the questions — there is no mode switch, no overlay, no button that "launches" anything. The questions appear as a natural continuation of the reading.

After answering all questions, a summary appears inline and the user can continue scrolling (to related articles) or scroll back up to re-read.

**What this tells us:** Inline expansion is the most reading-native pattern for comprehension checks. It avoids any mode-switch cost entirely. The weakness on mobile is that inline expansion requires scrolling, which can feel disconnected — the user has to scroll back up to re-read something they answered wrong.

### 4.3 Apple Books / Readwise Reader — No inline checks (reference)

Neither Apple Books nor Readwise interrupts the reading flow with comprehension checks — they treat reading as a separate mode from review. Readwise does daily "review" sessions (similar to SRS) but these are entirely separate from the reading mode. The separation is clean.

**What this tells us:** The cleanest user experiences keep reading and checking as clearly distinct activities with a hard boundary. If DevBrain's check is truly optional and low-stakes, it can afford a soft boundary — but the boundary still needs to exist to communicate that reading and checking are different activities.

---

## 5. The Three Concrete Pattern Options

All three options assume:
- The check is triggered by a button at the bottom of the lesson ("Check my understanding →")
- 3 questions only
- No score display at the end — just a completion state and return path
- The lesson screen remains the "home base" throughout

---

### Pattern A: Bottom Sheet (Modal Overlay)

**Description:** Tapping "Check my understanding" slides up a modal bottom sheet that covers roughly 85–90% of the screen. The lesson screen is dimmed behind it (backdrop overlay). A drag handle sits at the top of the sheet. Questions appear one at a time within the sheet. After Q3, the sheet shows a brief completion state, then auto-dismisses (or the user taps "Done") to reveal the lesson screen exactly as they left it.

**Structure:**
```
[ Lesson screen — dimmed, scrolled to where user was ]
[ ─────────────────────────────────────── ]  ← drag handle
[ Question 1 of 3                         ]
[ ○ Option A                              ]
[ ○ Option B                              ]
[ ○ Option C                              ]
[ ○ Option D                              ]
[                                         ]
[ Progress dots: ● ○ ○                   ]
```

**Interaction model:**
- Sheet slides up from bottom on button tap (300ms ease-out)
- Dismissible by drag down or backdrop tap (before first answer; lock after first answer to prevent accidental loss)
- One question at a time; answering auto-advances after 600ms feedback delay
- After Q3: sheet morphs into completion state ("Done — you read and checked this concept") with a single "Back to lesson" button
- Sheet slides down on dismiss; lesson screen reveals at the user's prior scroll position

**Fits DevBrain because:**
- The existing `_showLinkedConcept` overlay in curriculum.js already uses this exact pattern (backdrop + sheet, slides up from body, dismisses to lesson) — this would be visually consistent
- The lesson screen is never destroyed; scroll position is trivially preserved
- The dimmed backdrop communicates "I'm still on the lesson" more clearly than a full-screen takeover
- Bottom-up placement keeps answer buttons in the thumb zone for one-handed use
- No back-button ambiguity — the back button on Android/iOS is irrelevant inside a sheet; the drag-down gesture is the native dismiss

**Trade-offs:**
- 85–90% height means the user can't see their lesson text while answering — they have to trust that the lesson is still there (the dim backdrop signals this, but it's indirect)
- Tall sheets on small phones (320px wide) can feel cramped with 4 answer options; minimum 44px touch targets means the options alone take ~176px, leaving little room for the question text
- If the concept has long questions (Tier 3 anatomy/build questions), the sheet may not have enough vertical space without internal scrolling — which creates a "sheet within a scroll" pattern that feels awkward
- Modal lock (backdrop tap does nothing during a question) can frustrate users who accidentally tap outside

**Best suited for:** Short questions (definition/usage tier), where all 4 options and the question text fit in ~55–60% of the screen height without scrolling.

---

### Pattern B: Inline Expansion (Append Below Content)

**Description:** Tapping "Check my understanding" does NOT navigate anywhere or open any overlay. Instead, the button transforms into a loading state, then the question UI is appended below the button inline in the lesson screen. The user scrolls down naturally from the lesson content into the questions. After Q3, the check section collapses (or remains visible) and a "Lesson complete" state replaces the check section.

**Structure (scrolled to bottom of lesson):**
```
[ ... use_when section ...]
[ ─────────────────────── ]
[ Check my understanding  ]  ← button becomes this section header
[ ─────────────────────── ]
[ Question 1 of 3         ]
[ ○ Option A              ]
[ ○ Option B              ]
[ ○ Option C              ]
[ ○ Option D              ]
```

**Interaction model:**
- Button tap: button text changes to "Checking..." (100ms), then the check section renders below it (no animation required, or a simple fadeIn)
- Questions displayed one at a time: answering collapses the question and reveals the next one inline
- After Q3: a completion banner replaces the check section ("Good work — lesson complete. Add this to your quiz session?")
- No separate screen, no navigation, no overlay
- User can scroll back up to re-read any part of the lesson at any time

**Fits DevBrain because:**
- Zero mode-switch cost — the user never leaves the lesson context even perceptually
- Strongest reading-continuity pattern: the check is a natural extension of the reading, not a separate activity
- Re-reading while checking is trivial (scroll up, scroll back down)
- Works well for all question types including Tier 3 (anatomy/build), since the full screen width and scroll are available
- The completion state can include the "Add to Quiz" CTA, making the post-check flow purposeful (the user's next obvious action is right there)

**Trade-offs:**
- After answering Q3, the lesson screen is in a mixed state: lesson content above, completed check below. The user must scroll back to the top or tap "Back" to navigate away. There's no clear "done, return to your original state" moment — the screen just has more content than before.
- The absence of a modal boundary means the check doesn't feel "separate" from the lesson. This is a feature for continuity but a bug for closure: the user may feel like the lesson is now "longer" and feel mild fatigue
- If the user taps the lesson "Back" button while mid-check, they leave without completing — unlike a sheet which can resist dismissal. The app would need to decide whether to save partial state or silently discard it.
- Visual design must clearly distinguish "lesson content" from "check content" without relying on a separate surface (sheet background) — requires thoughtful typography/border treatment to avoid the check questions visually blending into the lesson body
- The "scroll back up to re-read" affordance, while available, is also a UX limiter: the user sees a long page and may feel the check is far from the questions it's testing

**Best suited for:** Long-form reading contexts where re-reading during the check is likely (e.g., technical/complex concepts where the user needs to refer back). Less ideal for short vocab definitions where the check should feel crisp and done.

---

### Pattern C: Temporary Full-Screen Push (Non-Modal Navigation)

**Description:** Tapping "Check my understanding" pushes a new "mini-lesson check" screen onto the navigation stack — but it is visually styled as a lightweight overlay screen, not a full quiz mode screen. It has no bottom tab bar, a simple "← Back to [concept name]" header, no progress UI beyond "1 of 3" dots, and questions presented one at a time. After Q3, a completion screen appears with a single prominent "Back to lesson" button. Tapping it pops the check screen and restores the lesson screen exactly.

**Structure (full screen, replaces lesson view):**
```
[ ← Back to mkdir                        ]
[ ─────────────────────────────────────── ]
[ 1 of 3                                 ]
[ What does mkdir create?                ]
[                                        ]
[ ● A new folder in the file system      ]
[ ○ A new file with that name            ]
[ ○ An alias to an existing folder       ]
[ ○ A compressed archive                 ]
```

**Interaction model:**
- Screen slides in from right (standard push animation) on button tap
- No bottom tab bar visible (the check is inside the curriculum tab, not a tab change)
- Header: back arrow + concept name (dismisses to lesson, with confirmation if mid-answer)
- Questions one at a time; correct/wrong feedback; auto-advances after 600ms
- After Q3: completion screen slides in from right ("Done — that's all 3 questions. You can come back to this lesson anytime.") with a single "Back to lesson" button
- "Back to lesson" slides the lesson back in from left; lesson is at the same scroll position

**Fits DevBrain because:**
- Full-screen real estate means no cramping — all question types (including Tier 3 anatomy/build) have adequate space
- The push/pop animation (slide right / slide back left) is the most universally understood mobile navigation metaphor — users immediately know they can go back
- The lesson screen is preserved exactly in the navigation stack — scroll position is naturally maintained because the screen is still mounted
- Visually distinct from the lesson (different surface, no lesson content visible) but clearly connected by the back button label showing the concept name
- The Quiz tab's full quiz flow (§5.7) uses a similar pattern with a progress bar and concept strip — this would be a deliberately lighter version of that, reinforcing the "less than a full quiz" feel

**Trade-offs:**
- Full-screen replacement is the strongest mode-switch signal in mobile UX. Even with "← Back to mkdir" in the header, the user may perceive they have "left the lesson" — the opposite of the desired framing
- The back-button behavior needs careful design: Android's system back button (and iOS back swipe gesture) should pop to the lesson, not to the concept list. This requires that the check screen is pushed onto the same navigation stack as the lesson, not the tab's root stack. This is non-trivial in the current hash-based router (router.js) and may require _navStack changes.
- The post-Q3 completion screen is an additional push, meaning there are now 3 screens deep in the stack: concept list → lesson → check completion. The user might accidentally double-back past the lesson to the concept list if they tap back twice quickly.
- This pattern most risks feeling like "a separate app mode" — the very thing the constraints say to avoid. If the visual design isn't deliberately lightweight (muted colors, no score readout, no progress bar styled like the quiz), users may perceive it as a scored quiz.

**Best suited for:** When question types include Tier 3 (anatomy/build commands) that require full-screen width and significant vertical space. Or if the app already has a fully built navigation stack where push/pop is zero-cost.

---

## 6. Comparison Table

| Dimension | A: Bottom Sheet | B: Inline Expansion | C: Full-Screen Push |
|---|---|---|---|
| Mode-switch perception | Low (lesson visible behind) | None (lesson is continuous) | High (lesson replaced) |
| Lesson context preservation | Visual (dimmed behind) | Physical (scroll back up) | Navigational (back button) |
| Space for complex questions | Constrained (Tier 3 risk) | Unconstrained | Unconstrained |
| Return-to-lesson clarity | Strong (auto-dismiss) | Weak (screen stays mixed) | Strong (explicit "Back" button) |
| Closure feeling | Clear (sheet closes) | Diffuse (lesson just has more content) | Clear (back navigation) |
| Thumb zone alignment | Strong (controls bottom-up) | Neutral (inline, scroll to reach) | Neutral (controls at top-left for back) |
| Implementation complexity | Low (existing pattern in `_showLinkedConcept`) | Low (append + scroll) | Medium (nav stack integration) |
| Ambiguity re: scored quiz | Low (sheet = temporary, not a new screen) | Very low (no mode signal at all) | Medium (full screen = quiz signal) |

---

## 7. Recommendation for DevBrain

**Primary recommendation: Pattern A (Bottom Sheet) with Pattern B's completion state.**

The reasoning:

1. **The linked concept overlay already sets the precedent.** The `_showLinkedConcept` function in curriculum.js uses the exact bottom-sheet pattern (backdrop + draggable sheet, slides up from body, dismisses to reveal the lesson). Users who tap a hyperlinked term in the lesson already experience this pattern. Using the same container for the comprehension check creates visual and behavioral consistency. Users already know how this works.

2. **The lesson is always "there."** The dimmed lesson behind the sheet is a constant visual reminder that the check is temporary and the lesson is home base. Pattern C destroys this signal. Pattern B diffuses it.

3. **3 questions is exactly the right length for a sheet.** The cramping risk is real for Tier 3 questions, but DevBrain's comprehension check draws from all unlocked tiers per concept (§6.4). Early-stage concepts (Tier 1 only) have definition-format questions that fit easily. By the time a concept has Tier 3 unlocked, the user is experienced enough that the check is quick. If anatomy/build questions become a real space issue, the sheet can be allowed to expand to near full-screen (95%) for those question types only.

4. **Completion + return is the strongest moment (peak-end rule).** The sheet close animation is the user's last memory of the check. A smooth slide-down revealing the intact lesson — at the exact scroll position — is a satisfying close that reinforces "that was a side note, the lesson is the main thing."

**What to adjust from a pure bottom-sheet implementation:**

- Use the drag handle but **disable backdrop tap** while a question is in progress (accidental dismissal mid-question is worse than requiring a deliberate drag-down)
- After the third answer is recorded: briefly show the completion state inside the sheet for ~1.5 seconds, then auto-dismiss — no "Back to lesson" button needed. The auto-dismiss is faster and avoids asking the user to take an action to return to where they were
- **Do not show a score.** No "2/3 correct." No numbers. The completion message should be something like "Got it — you've checked this one. Tap any highlighted term to explore connected concepts." This uses the end moment (peak-end rule) to point toward the next natural action in the lesson (exploring linked terms)
- Label the trigger button "Check my understanding →" (not "Test yourself →")

**When Pattern B is worth reconsidering:**

Use inline expansion (Pattern B) only if the product direction changes to make the check feel like a structured "end of lesson" capstone rather than an optional self-reflection. If the check ever becomes the gate before the user can mark a concept as done, inline expansion fits better because the user needs to scroll through it as part of the lesson, not launch it as a separate activity.

---

## 8. Label Copy Audit

The current spec (§3.5) uses "Test yourself →" as the button label. Based on the framing research:

| Current | Better | Reason |
|---|---|---|
| "Test yourself →" | "Check my understanding →" | Removes competitive/evaluation framing |
| (no heading inside check) | "Quick check — just for you" | Sets zero-stakes expectation before Q1 |
| (no completion message) | "Done. That's all 3." or "Checked." | Closure without score reference |
| (n/a — no wrong answer message) | "Not quite — here's what it means:" | Frames wrong answer as learning, not failure |

The in-check experience should never show the word "score," "result," "correct," or "points." The word "check" is safe. The word "done" is safe. "Nice" or similar affirmations are acceptable if they are brief and not Duolingo-level celebratory (which would create a false-positive score feeling).

---

## 9. What This Leaves Undecided

This research covers the container pattern and labeling strategy. The following questions are out of scope for this document and need their own spec work:

1. **Question progression animation:** Does each question slide in from the right (like a page turn), fade in, or simply replace? The sheet pattern needs an internal transition.
2. **Wrong answer feedback:** Does the wrong answer turn red instantly, or is there a delay? Is the correct answer revealed? How long does the feedback state last before auto-advancing?
3. **Partial completion:** If the user drag-dismisses after Q1, is partial progress saved? The `used_question_indices` for already-answered questions should probably be saved (spec §6.4 says "persist immediately on completion" but doesn't address partial completion).
4. **Repeat check behavior:** If the user taps "Check my understanding" again after having done the check, does the same 3 questions reappear (exhausted from the pool), or is there a "You've already checked this one" state?
5. **The "Add to Quiz" integration point:** After the check completes, the current spec returns the user to the lesson screen where "Add to Quiz session →" is already visible. This is the correct post-check CTA flow — no additional design needed if the return is to the lesson bottom.
