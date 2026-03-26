# Role Hats — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

A Claude Code skill that lets Claude analyze any artifact (feature spec, code, UI flow, design, idea) through the lens of one or all five core product development roles. The skill provides structured, consistent analysis regardless of what's being reviewed.

---

## 1. Skill Location

`.claude/skills/hats.md`

Invoked via the `Skill` tool when the user references a role or asks for hat-based analysis.

---

## 2. Routing Logic

| Invocation pattern | Mode |
|---|---|
| "PM hat", "as the architect", "QA lens", "wear the designer hat" | Single hat |
| "all hats", "run the hats", "through all lenses", "all roles" | Full panel |
| Ambiguous or unspecified | Default to full panel |

---

## 3. Hat Definitions

### PM Hat
- **Persona:** Owns the why. Guards user value and business goals above all else.
- **Lens:** Does this solve a real user problem? Is it scoped right? What's the opportunity cost?
- **Always asks:** Who is this for? What does success look like? What are we NOT building?
- **Red flags:** Scope creep, no clear success metric, solution in search of a problem, stakeholder assumption baked in as fact

### Architect Hat
- **Persona:** Owns structural integrity. Thinks in systems, not features.
- **Lens:** Does this hold up at scale? Where are the seams? What breaks first?
- **Always asks:** What are the dependencies? Where does complexity live? What's the failure mode?
- **Red flags:** Tight coupling, hidden state, unclear data ownership, performance assumptions, one-way doors

### Developer Hat
- **Persona:** Owns implementation reality. Translates intent into effort and risk.
- **Lens:** How hard is this actually? What's underspecified? What will bite us mid-build?
- **Always asks:** What's the edge case? What's the estimated effort? What's missing from the spec?
- **Red flags:** Ambiguous requirements, missing error states, untested assumptions, "we'll figure it out" decisions

### Designer Hat
- **Persona:** Owns the human experience. Advocates for clarity, flow, and feeling.
- **Lens:** Would a real user understand this? Is the flow natural? Does it feel right?
- **Always asks:** What's the user's mental model here? Where does confusion happen? What's the emotional tone?
- **Red flags:** Too many steps, inconsistent patterns, designed for the happy path only, friction in critical moments

### QA Hat
- **Persona:** Owns quality gates. Finds what breaks before users do.
- **Lens:** What are all the ways this can fail? What's untestable? What's been assumed to work?
- **Always asks:** What's the edge case? What happens when data is missing/malformed? How do we verify this works?
- **Red flags:** No acceptance criteria, untestable requirements, missing error handling, "it'll be fine" assumptions

---

## 4. Output Formats

### Single Hat (deep analysis)

```
## [Role] Hat

[2-4 sentences of focused analysis from that role's perspective]

**Flags:**
- flag 1
- flag 2

**Questions to resolve:**
- question 1
```

### All Hats (concise per hat + consensus)

```
## PM Hat
- bullet
- bullet

## Architect Hat
- bullet
- bullet

## Developer Hat
- bullet
- bullet

## Designer Hat
- bullet
- bullet

## QA Hat
- bullet
- bullet

---

## Consensus & Conflicts
**Agree on:** ...
**Tension:** [Hat A] wants X, [Hat B] wants Y — this needs a decision
**Biggest risk:** ...
```

---

## 5. Scope

- Works on any input: feature specs, code, UI flows, designs, raw ideas
- User can override output depth at any time ("go deeper on the QA hat")
- No implementation beyond the skill file itself
