# Companion v1 (Guide) — Implementation Proposal

**Status: proposal only. No implementation code has been written.**

This is the near-term slice of `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md`,
narrowed to the responsibility the product owner has now made the priority:
**platform guidance**. It does not replace that document, and it does not
introduce a second architecture. Where that document already answered a
question, this one cites it and moves on. Where the new brief needs something
that document does not have — an *ask* surface — this one specifies it.

The product decision behind it is `docs/COMPANION_CANON.md` → **Canon 5, the
Guide responsibility** (added in Canon V3 as part of this work).

---

## 0. Six findings that change the brief

Stated first, because each one alters what should be built.

### 0.1 `docs/COMPANION_CANON.md` already exists — and was frozen

The brief recommends creating it. It already exists at 251 lines, marked
*"frozen — V2"*, covering the Story Egg, Lumo, Story Companions, the Creator
Ceremony, the Magic Card bond, Visitor/Creator behaviour and asset
registration.

Creating a second canon would have been exactly the parallel architecture the
brief forbids. **It has been amended to V3 instead** — one new section (Canon
5) and a version table. Nothing in V2 was removed or reinterpreted.

### 0.2 The frozen canon forbade what Companion v1 asks for

`docs/COMPANION_CANON.md:17`:

> *"A companion is not an assistant, a chatbot, a teacher, or an AI tutor."*

The brief agrees with the first two — *"Companion is not an AI chatbot.
Companion is not a generic assistant."* — but then assigns a responsibility
the frozen canon did not grant: *"Companion is the creator's guide inside
VihuStudio. Its responsibility is to help children successfully use the
platform."*

Answering *"How do I make this bigger?"* is help-desk behaviour. Under the V2
canon it was out of bounds. **This is a canon change, not a feature**, and it
is the reason Canon 5 had to be written before any code. It is now recorded.
If the product owner disagrees with how Canon 5 draws the line, that is the
one thing to correct before anything else proceeds.

### 0.3 A Companion architecture proposal already exists

`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` (699 lines) already specifies
`CompanionContext` / `CompanionBrain` / `CompanionActions` / a model gateway,
the three knowledge tiers, the three action gates, the restraint rules, and a
five-phase roadmap.

Companion v1 as briefed maps almost exactly onto **its Phases 0–2**. The
correct move is to execute that plan, not to redesign it. This document adds
one thing it genuinely lacks and defers one thing it explicitly gates.

### 0.4 There is no "Activity architecture"

The brief asks me to identify it. There isn't one. The only occurrence of the
word in the entire application is `onActivity()` at
`js/companionDirector.js:194` — an idle-timer reset bound to pointer/key
events, plus `onTypingActivity()` at line 221. There is no activity model, no
activity log, no activity stream, no activity service.

This is good news: there is nothing to integrate with, and Companion v1 needs
nothing of the kind. The signals it needs already exist (§5.3).

### 0.5 There is no command system, and no global undo

The brief asks me to identify the "existing command system." There is none —
no command pattern, no inverse registry, no project-level history. Undo exists
only as per-tool local stacks (`js/pictureStudio.js` brush strokes and
`_preCropSnapshot`, `js/cardDesigner.js` doodle strokes).
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §1.4 and §7.4 already establish
this and gate the Perform tier on it.

This matters directly, because **two of the nine v1 goals are not questions —
they are commands**: *"Add another page."* and *"Duplicate this."* Executing
those means mutating the project (`PageOps.addAfter`, `PageOps.duplicatePage`),
which is Perform-tier work that the existing architecture explicitly defers.

§4.3 resolves this without building undo and without dropping the goals.

### 0.6 The Companion has no way to receive a question

The success criterion is *"Children can ask natural questions about using
VihuStudio."* Today the Companion widget is **output-only**:

| Element | Behaviour |
|---|---|
| `.companion-bubble` | `textContent` set by `speak(text)`, auto-hides on a timer |
| `.companion-portrait` | hover glow/tilt/particles, click wiggle + sparkle burst, drag to reposition |
| `.companion-environment` | decorative, `aria-hidden` |

There is no text field, no ask affordance, no input event of any kind bound to
the widget. `speak()` takes a string and renders it; nothing reads anything
back.

**This is the one genuinely new UI Companion v1 requires**, and the brief says
*"Do not redesign the overall experience."* §7 keeps it to a single additive
panel that reuses the widget's existing root, and — importantly — makes it
**tap-first rather than type-first** (§7.2), which is both better for young
children and the reason v1 needs no natural-language understanding at all.

---

## 1. Current Architecture

### 1.1 How the Companion exists today

Three layers, already documented in full at `docs/COMPANION_ENGINE.md`.
Summarised only as far as v1 depends on it:

| Layer | File | Lines | Knows about |
|---|---|---|---|
| Runtime | `js/companionEngine.js` | 927 | Nothing specific — loads a package, swaps images, shows a bubble |
| Director | `js/companionDirector.js` | 581 | Studio moments; the one file allowed to map events → poses/speech |
| Content | `assets/<id>/`, `assets/registry.json` | — | Everything about who a companion *is* |

The Engine's frozen public API: `load / unload / show / hide / setState /
getState / speak / wake / sleep / destroy`, plus `setRichness / boostGlow /
setSyncBadge / getSyncBadge / getPersonality / getAnimations / isVisible`, and
static `loadRegistry()`.

Both files are loaded as classic IIFE `<script>` tags from `index.html`'s
single 57-script block (currently `?v=0363`). There is no build step, no
module system, no framework. Any new Companion module must follow the same
shape.

### 1.2 Current capabilities

- **Presence** — pose, glow, richness, drag-to-reposition, occlusion
  awareness, idle sleep.
- **Reaction** — a static `MODES` table maps five Studio events to poses,
  differently for traveller vs. creator.
- **Speech** — `speak(text)` renders a bubble. Content is a random pick from
  `personality.json`'s `greetings` array.
- **Ceremony** — `getCeremonySequence()` returns a data-driven beat list for
  the Creator Ceremony.
- **One dynamic read** — `currentRichness()` reads `AppState.slides.length`.
  This is the *only* place the Companion looks at the project at all, and it
  is the existence proof that richer reading is reachable from the same seat.

### 1.3 Current limitations, relative to the v1 goals

| Limitation | Consequence for v1 |
|---|---|
| `notify()` accepts exactly 7 hardcoded event strings | No situational vocabulary |
| No read of page, selection, guardrails or story health | Cannot answer any of the nine goal questions |
| Speech is a random greeting pick | Cannot answer a specific question |
| No input surface (§0.6) | Cannot be asked anything |
| No global undo (§0.5) | Cannot safely perform mutations |
| `personality.json` has no keyed answer store | Nowhere to author guidance text per companion |

Note what is *not* on this list: nothing needs redesigning. Every limitation is
an absence, and every absence is additive to fill.

---

## 2. Companion Integration

### 2.1 Where Companion v1 lives

Two new modules. Both are IIFEs attached to `window`, loaded by `<script>`
tags, exactly like the other 57.

| Module | File | Role | Owns state? |
|---|---|---|---|
| Context Reader | `js/companionContext.js` | Builds one read-only *situation snapshot* by projecting existing state | No |
| Guide | `js/companionGuide.js` | Question → deterministic answer, over the snapshot + the knowledge corpus | No (a cooldown/novelty ledger only) |

Plus one authored data directory, `assets/companions/knowledge/` (§3.2), and
one additive UI panel inside the existing companion widget root (§7).

`js/companionContext.js` is the same module
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §2.1 proposes, unchanged.
`js/companionGuide.js` is the v1-scoped, answer-only form of the
`companionBrain` in that document — deliberately named differently so that
when the proactive Brain is built later, it is obvious that the Guide answers
questions and the Brain volunteers observations, and neither absorbs the
other's job.

### 2.2 What is deliberately not created

- **No Companion service.** `js/companionDirector.js` already is that service
  and stays the one Studio-aware file. It gains the wiring that mounts the ask
  surface and routes an answer into `speak()`; it does not gain answering
  logic.
- **No new state store.** The snapshot is a projection, created on demand and
  discarded.
- **No new event system.** §5.3.
- **No second renderer, hit-tester, or object model.** The Guide reads
  `PageRuntime.getRenderedObjects()`, which already *is* Creator's object
  model.
- **No model gateway, no Edge Function, no provider client.** §6.

### 2.3 What is read from but never modified

`js/companionEngine.js` · `renderer/slideRenderer.js` · `js/sceneEngine.js` ·
`js/pageOps.js` · `js/publishValidator.js` · `js/pageRuntime.js` ·
`js/contextPanel.js` · `js/objectStrip.js` · the Theme Contract · the Engine
V2 Scene Model · `tools/world-builder/` · `tools/world-builder-v2/` ·
everything under Publish.

---

## 3. Knowledge Sources

Three tiers, per `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §5. v1 uses all
three but adds no abstraction to any of them.

### 3.1 Tier 1 — Package knowledge (exists)

`assets/<id>/personality.json`. Today only Lumo has one, carrying `name`,
`role`, `traits`, `neverSays`, `greetings`.

**v1 adds one optional field: `lines`** — a flat map from a stable answer id
to that companion's own phrasing. A companion without it still guides
perfectly, using the platform's default phrasing; a companion with it sounds
like itself. `neverSays` becomes a hard filter over every emitted line.

This keeps "adding a companion is zero code" true, which is the property
`docs/COMPANION_CANON.md`'s Implementation Constraints section spends most of
its length defending.

### 3.2 Tier 2 — Platform knowledge (new, authored, static)

`assets/companions/knowledge/*.json` — human-authored, versioned, shipped as
data. Not generated, not scraped, not inferred from code at runtime.

| File | Answers | Derived from |
|---|---|---|
| `controls.json` | *"What does this button do?"* | `js/contextPanel.js`, `js/selectionActionStrip.js`, `js/objectStrip.js` |
| `howto.json` | *"How do I use this tool?"*, *"How do I make this bigger?"* | `docs/THEME_TO_CREATOR_MAP.md`; shaped after `STATE_GUIDANCE`'s What/Why/Do/Next (`tools/world-builder-v2/js/worldBuilderApp.js:2719`) |
| `guardrails.json` | *"Why can't I move this?"* | Creator Governing Rules #1–#5; the existing child-safe copy in `_renderWorldObjectDisclosure` (`js/contextPanel.js:1566`) |
| `vocabulary.json` | Kid-facing names for everything | `js/objectStrip.js`'s `FRIENDLY_TYPE` / `FRIENDLY_TEXT_ID` |

Every entry carries a stable `id`, kid-facing text, and a `surface` pointer —
the DOM selector or panel id the answer refers to — so an answer can point at
something real rather than describing it in prose.

**The guardrail copy already exists and is already good.** `js/contextPanel.js`
ships lines like *"This is part of the World — tap ✏️ Edit on the toolbar above
the page to adjust it."* `guardrails.json` should lift that voice, not invent
a new one.

### 3.3 Tier 3 — Situation knowledge (runtime, ephemeral)

Produced by `js/companionContext.js`. Every field traces to an existing read;
nothing new is computed or stored.

```js
{
  mode:'creator', companion:'nimbus',
  project:{ pageCount, hasTitle, hasCover, worldName },
  page:{ index, role, objectCount,
         objects:[{id,type,label,owner,moveable,editable,visible,locked,bbox}] },
  selection:{ id, type, owner, moveable, editable, visible },
  nudges:[ ...PublishValidator.run(slides, project) ],
  session:{ idleMs, lastEvent }
}
```

| Field group | Existing source |
|---|---|
| `page`, `selection` | `PageRuntime.getActivePage()` / `.getRenderedObjects()` / `.getSelection()` / `.selectionIsValid()` |
| object guardrails | `renderer/slideRenderer.js`'s `_sceneObject(raw,owner)` — already normalises **every** object to `{id,type,label,owner,moveable,editable,visible,locked,bbox}` regardless of origin |
| place permissions | `SlideRenderer.getPlacePermissions()`, `getPlaceV2LayerPermission()` |
| `nudges` | `js/publishValidator.js`'s `run(slides, project)` — 96 lines, already returns ordered, friendly, non-blocking items with a `fixHint` routing key |
| `project` | `AppState`, `ThemeRegistry` |

`_sceneObject` is the single most important existing asset for this work. It
means *"is the child allowed to touch this?"* is already a property on every
object on the page — the Companion does not have to derive it, and cannot
disagree with what the renderer and Context Panel already believe.

`js/publishValidator.js` is the second. It is already, in miniature, the
engine this proposal argues for: pure rules over project state, structured
friendly output, never blocking, never the word "error". *"What should I do
next?"* is **already computed** — it just isn't routed anywhere near the
Companion.

---

## 4. Help System

### 4.1 Every v1 goal question, and what answers it

This is the core claim of the proposal, so it is shown in full.

| # | Question | Deterministic source | AI? |
|---|---|---|---|
| 1 | *How do I make this bigger?* | `selection` + `moveable/editable` + `howto.json` → point at the size control | No |
| 2 | *Why can't I move this?* | `selection.owner`/`moveable` + `getPlacePermissions()` + `guardrails.json` | No |
| 3 | *How do I change the colour?* | `selection.visual.kind` + `controls.json` → point at ✏️ Edit on the Selection Action Strip | No |
| 4 | *Add another page.* | Offer → focus the existing Add Page control (§4.3) | No |
| 5 | *Duplicate this.* | Offer → focus the existing duplicate control for the current selection (§4.3) | No |
| 6 | *Where did my object go?* | Snapshot scan (§4.2) — hidden, off-canvas, behind, or on another page | No |
| 7 | *What does this button do?* | `controls.json` lookup by `surface` id | No |
| 8 | *What should I do next?* | `PublishValidator.run()` — already built, already ordered, already friendly | No |
| 9 | *How do I use this tool?* | `howto.json`, What/Why/Do/Next | No |

**Nine of nine, with no model.** That is the direct answer to the brief's
*"Recommend where AI is unnecessary."* — for Companion v1, everywhere.

### 4.2 "Where did my object go?" deserves its own note

It is the question with the best deterministic answer in the whole set, and
the one a child is most likely to ask in real distress. Every cause is already
readable from the snapshot:

| Cause | Detected by | Answer |
|---|---|---|
| Hidden | `object.visible === false` | *"It's hiding! Want me to show it again?"* |
| Off-canvas | `bbox` outside the page rect | *"It wandered off the edge of the page."* |
| Behind another object | z-order vs. overlapping `bbox` | *"It's behind your picture."* |
| On a different page | scan other slides' objects | *"It's on page 3."* |
| Genuinely deleted | absent everywhere | *"I can't find it — it may have been removed."* |

Each answer resolves to a Point (select it, glow it) or an Offer. None of them
needs a model, and none of them is guessing.

### 4.3 The two commands, resolved without building undo

*"Add another page."* and *"Duplicate this."* are Perform-tier mutations, which
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §7.4 gates on global undo.

**Recommendation: ship them as Offers, not Performs.** The Companion answers
by taking the child *to* the existing control and highlighting it — the child
presses it. Concretely: `PageRuntime.openPage()` / `selectSceneObject()` plus
a highlight on the real Add Page or duplicate affordance, which already exist
in `js/pageOps.js`'s surfaces and their panels.

This delivers the goal (the child successfully adds a page, having asked in
their own words), teaches them where the control lives so they need the
Companion less next time, requires no undo, mutates nothing, and keeps
Companion v1 entirely inside the Point/Offer tiers that the existing
architecture already declares safe today.

If the product owner wants true one-tap Perform, that is a separate decision
with a real prerequisite — global undo — and should be taken on its own
merits, not smuggled in under Companion v1.

### 4.4 Answer resolution order

Strictly ordered; the first hit wins, and the Guide stops.

1. **Guardrail truth** — if the question is about a selected object and the
   guardrails already answer it, answer from the live render tree. Never from
   the corpus, never from a model. (Creator Governing Rule #2.)
2. **Live situation** — if the snapshot answers it (missing object, missing
   title, page count), answer from the snapshot.
3. **Platform knowledge** — otherwise, look it up in Tier 2 by `surface` id.
4. **Companion voice** — re-phrase through `personality.json`'s `lines[id]` if
   present; filter through `neverSays` unconditionally.
5. **Honest miss** — *"I don't know that one yet!"* A cheerful, truthful miss
   is a correct v1 outcome and must never be dressed up as an answer.

Step 1 sitting above everything else is what prevents the Companion from ever
telling a child to drag something the platform will refuse to move — the
failure mode flagged as risk §9.3 in the existing architecture document.

---

## 5. Runtime

### 5.1 The Guide is pull, not push

The proactive Companion (`companionBrain`) is a later phase and is *not* built
here. The v1 Guide runs **only when a child asks**. Nothing ticks, nothing
watches, nothing volunteers.

This is what makes v1 cheap, safe, and testable, and it is why the restraint
machinery in the existing architecture (§6.3 cooldowns, novelty, silence bias)
is largely not needed yet — the child's own tap is the rate limiter.

### 5.2 The tick

1. Child opens the ask surface (§7).
2. `CompanionContext.snapshot()` — synchronous, cheap, built fresh.
3. The surface offers contextual questions derived from that snapshot.
4. Child taps one. `CompanionGuide.answer(questionId, snapshot)` resolves it
   through §4.4.
5. `CompanionDirector` applies the result: `speak(text)`, optional
   `setState(pose)`, optional Point/Offer.

### 5.3 Signals — all of which already exist

| Signal | Existing source | Cost |
|---|---|---|
| Page/object/selection changed | `PageRuntime.notify()` — already dispatches to five subscribers at `js/pageRuntime.js:125-132` | free |
| Named lifecycle moments | `CompanionDirector.notify(event)` | free |
| Idle | the Director's existing `IDLE_SLEEP_MS` timer | free |
| Story health | `PublishValidator.run()` — O(slides), no rendering | on demand |

**No polling is introduced. No new event model is introduced.** The Companion
becomes one more `PageRuntime.notify()` subscriber alongside CardDesigner,
ContextPanel, ObjectStrip, TravellerSaveNotice and SelectionActionStrip.

### 5.4 Fail-open, structurally

Deleting both new files must leave Studio fully functional, exactly as
deleting `js/companionDirector.js` does today. Achieved the same way the rest
of the codebase does it — every call site guarded:

```js
try{ if(typeof CompanionGuide!=='undefined') CompanionGuide.answer(...); }catch(e){}
```

The Context Reader is read-only; the Guide owns no project state; the corpus
is static data with a working default if a file 404s (the same graceful
degradation `CompanionEngine` already proves for missing pose art).

---

## 6. LLM Boundary

### 6.1 Companion v1 ships with no model, no gateway, no key

Not "AI optional." **No AI.** Every one of the nine goal questions is answered
deterministically (§4.1), so a model would add cost, latency, a privacy
question, and a failure mode, in exchange for nothing v1 needs.

This satisfies the brief's hard requirement directly: *"If external AI becomes
unavailable, Companion should still successfully answer platform guidance
questions using deterministic platform knowledge."* It does, because there is
nothing to become unavailable.

### 6.2 Where a model eventually earns its place

| Later capability | Why deterministic logic runs out |
|---|---|
| Free-typed questions with unanticipated phrasing | Matching arbitrary child language to answer ids is genuinely hard; the tap-first surface (§7.2) avoids needing it in v1 |
| Educational questions (*"why is the sky blue?"*) | Not platform knowledge; nothing in VihuStudio can answer it |
| World knowledge | Same |
| Creative writing / story continuation | Explicitly out of scope, and the sharpest canon risk (`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §4, C9) |
| Warmer per-companion phrasing | Nice-to-have; `personality.json`'s `lines` covers most of it without a model |

### 6.3 The boundary is architectural, and already designed

When a model does arrive, it arrives at exactly one place —
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §8.2's Edge Function, following
the `supabase/functions/family-album/index.ts` precedent, with the client
never holding a key. The Guide's §4.4 resolution order already has the
correct shape for it: a model would slot in as a **new step 4.5, between
platform knowledge and the honest miss** — never above step 1, never
answering a guardrail question.

**Gate, restated:** §9.1 of that document — children's creative content
leaving the device — remains an unmade product decision and blocks any model
escalation regardless of how ready the architecture is.

---

## 7. UI

The brief says *"Recommend minimal improvements. Do not redesign the overall
experience."* Three changes, all additive, all inside the existing
`.companion-widget` root.

### 7.1 An ask affordance on the portrait

The portrait already handles click — `_playClickReaction()` fires a wiggle,
pulse and sparkle burst. **Keep that entirely**, and let the same tap also
open the ask surface. A child who taps their companion expecting delight still
gets delight; they now also get a way in.

No new mount point, no new widget, no layout change.

### 7.2 A tap-first question surface

**This is the most important UI recommendation in the document.**

The obvious design is a text box. It is the wrong one for this audience: many
Story Authors are young enough that typing is a barrier rather than an
affordance, and free text forces the Guide to solve natural-language
understanding — the one part of v1 that would genuinely need a model.

**Recommendation: a small list of contextual question chips**, generated from
the live snapshot, appearing above the portrait in the same visual language as
the existing `.companion-bubble`.

With a locked World object selected:

```
  🌍  Why can't I move this?
  🎨  How do I change the colour?
  🔍  Where did my object go?
  ✨  What should I do next?
```

With nothing selected, on a nearly-empty story:

```
  ➕  Add another page
  🔍  Where did my object go?
  ✨  What should I do next?
```

Because the questions are *offered*, every one of them is guaranteed
answerable, no NLU is required, no misunderstanding is possible, and the
surface doubles as capability discovery — a child learns what they are allowed
to ask by seeing it. This single choice is what lets Companion v1 be fully
deterministic.

### 7.3 Answers land in the bubble that already exists

`speak(text)` renders them. For long answers the only change needed is a
slightly longer auto-hide for Guide answers than for greetings — a parameter,
not a redesign.

Where an answer points at a control, add one reusable highlight class
(`.companion-pointing`) applied to the real target element and cleared on the
next interaction. Nothing is moved, opened, or pressed.

### 7.4 Explicitly not proposed

A chat log · multi-turn conversation · a docked panel · a persistent open
state · voice input · any layout change to Studio · any change to where the
companion lives on screen.

---

## 8. Roadmap

Five milestones. **G0 is a gate; G1–G4 each ship something usable.**

### G0 — Canon (docs only) ✅ done in this change

`docs/COMPANION_CANON.md` amended to V3 with Canon 5, the Guide
responsibility, and the Companion version table. **No code.** This is the
approval gate: if Canon 5 draws the line in the wrong place, correct it here
before anything is built.

### G1 — Situation snapshot

`js/companionContext.js` only. Read-only projection over `PageRuntime`,
`SlideRenderer`, `PublishValidator`, `AppState`. Nothing user-visible.

*Verifies:* snapshot correctness against a real authored World page — every
object's `owner/moveable/editable/visible` matching what Context Panel and
Object Strip independently show for the same page.

### G2 — Ask surface + the three situation answers

The portrait tap, the chip surface (§7.2), and `js/companionGuide.js` with
snapshot-only rules. No corpus yet.

*Ships:* *Where did my object go?* · *Why can't I move this?* · *What should I
do next?* — the three highest-value questions, all answerable from live state
with no authored content at all.

**This is the milestone where the Companion visibly becomes a guide.**

### G3 — Platform knowledge corpus

`assets/companions/knowledge/{controls,howto,guardrails,vocabulary}.json`,
plus `personality.json`'s optional `lines` map.

*Ships:* *What does this button do?* · *How do I use this tool?* · *How do I
change the colour?* · *How do I make this bigger?*

### G4 — Pointing & Offering

The Point/Offer tiers from `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §7,
restricted to selection, navigation and highlight — no mutation.

*Ships:* *Add another page.* · *Duplicate this.* (as Offers, §4.3). Completes
all nine v1 goals.

### Deferred, with their gates named

| Deferred | Gate |
|---|---|
| Proactive noticing (`companionBrain`) | Product decision — v1 is pull-only by design |
| Free-typed questions | Needs NLU, therefore needs a model |
| Any model escalation | `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §9.1 — children's content leaving the device |
| Perform tier (true one-tap actions) | Global undo (§0.5, §4.3) |
| Creator memory | Canon 5 forbids it at this version |
| Story Journey | **Out of scope. Do not implement.** |

---

## 9. Risks

### 9.1 Canon drift — the Companion becomes an assistant — **highest**

Canon 5 grants a genuinely new responsibility, and the pressure to widen it
will be constant and reasonable-sounding: one answer, then a tip, then a
suggestion, then a to-do list, then a co-author.

*Mitigation:* Canon 5's may/may-not table is deliberately a hard boundary, not
a guideline. The pull-only runtime (§5.1) is architecture, not tuning — a
Guide that cannot speak unprompted cannot nag. Any future proactive behaviour
is a separate, visible decision.

### 9.2 Corpus staleness — the new maintenance burden

Tier 2 describes UI that changes. When a control is renamed or moved and
`controls.json` is not updated, the Companion confidently tells a child to tap
something that isn't there — **worse than saying nothing**, because it
destroys trust in every other answer.

This is the one genuinely new maintainability cost Companion v1 introduces,
and it is a real one.

*Mitigation:* every corpus entry carries a `surface` selector; ship a
verification pass that resolves every `surface` against a live Studio DOM and
fails loudly on any that no longer match. Treat corpus updates as part of the
same commit as any control change, the way `?v=` bumps already are.

### 9.3 Guidance contradicting Guardrails

A Guide that says *"just drag it over there"* about a `moveable:false` object
teaches a child the app is broken, and violates Creator Governing Rule #2.

*Mitigation:* §4.4's resolution order puts live guardrail truth above all
authored content, unconditionally. Guardrail answers are never corpus lookups.

### 9.4 Two brains

If `companionGuide` grows its own notion of story health, it will drift from
`PublishValidator`.

*Mitigation:* the Guide **calls** `PublishValidator.run()`; it never
reimplements it. Same rule for `FRIENDLY_TYPE`, `getPlacePermissions()` and
the render tree — call, never copy.

### 9.5 Coupling — package knowledge vs. platform knowledge

If platform specifics leak into `personality.json`, adding a companion stops
being zero-code, breaking a property `docs/COMPANION_CANON.md` explicitly
defends.

*Mitigation:* the Tier 1 / Tier 2 split is the whole defence.
`personality.json`'s `lines` may only ever carry *phrasing* keyed by an answer
id the platform owns — never the answer's content, never a selector.

### 9.6 Traveller silence

A Story Egg never speaks. A misplaced ask surface in Visitor mode would break
V2 canon outright.

*Mitigation:* the mode gate sits at the top of the surface's mount check,
before any question is generated — not as a filter at the end.

### 9.7 Performance

`getRenderedObjects()` is cheap but not free, and the snapshot scans all
slides for the *"where did it go?"* answer.

*Mitigation:* the snapshot is built on the child's tap, not on a tick, so it
never runs during a drag — a boundary this codebase already treats as sacred
(the debounced `ObjectStrip.refresh()` in `js/contextPanel.js` exists for
exactly this reason). Cross-page scans are O(slides × objects) on a
tens-of-pages project, run once per question.

### 9.8 Future Story Journey integration

Story Journey is out of scope and nothing here builds toward it. But it is
worth recording that **`js/companionContext.js` does not obstruct it, and
mildly helps.**

`docs/STORY_REPLAY_ARCHITECTURE.md` §3.1/§3.3 argues for *observing and
deriving* rather than *capturing and publishing*. `CompanionContext` is
precisely a derived, read-only projection built from existing state with no
storage, no timeline and no event model — the shape that document recommends,
arrived at independently for a different reason.

*Consideration, not a task:* if Story Journey is ever approved, it should reuse
the Context Reader's projection rather than build a second one. Nothing in
Companion v1 should be shaped *for* that eventuality, and this proposal builds
no recording, no timeline, no replay, no storage model and no event model.

---

## 10. Summary

1. **`COMPANION_CANON.md` already existed and has been amended to V3**, not
   recreated. Canon 5 records the Guide responsibility.
2. **The frozen canon forbade this** — the amendment is the real deliverable
   of this stage, and the thing to approve or correct first.
3. **A Companion architecture already exists.** Companion v1 executes its
   Phases 0–2 and adds the one thing it lacked: an ask surface.
4. **There is no Activity architecture and no command system.** Neither is
   needed; both absences are recorded.
5. **All nine v1 goal questions are answerable with zero AI.**
6. **`PublishValidator` already computes "what should I do next?"** — it just
   isn't routed to the Companion.
7. **`_sceneObject` already carries the guardrail truth** on every object, so
   the Companion cannot disagree with the renderer.
8. **Tap-first questions, not a text box** — better for children, and the
   single choice that makes v1 fully deterministic.
9. **The two commands ship as Offers, not Performs** — goals delivered, no
   undo prerequisite, nothing mutated.
10. **Motion Publishing is unblocked.** Companion v1 reads `PublishValidator`
    and touches nothing else under Publish.

---

*No implementation has begun. This document is a proposal awaiting approval
under `CLAUDE.md`'s standing rule that architecture changes require explicit
sign-off. `docs/COMPANION_CANON.md`'s Canon 5 is the product decision it
implements.*
