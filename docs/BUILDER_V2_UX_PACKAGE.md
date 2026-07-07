# Builder V2 UX Design Package

**Status:** UX Design Package — the last document before implementation
begins. Read, in order: `docs/ENGINE_V2_CANON.md`,
`docs/BUILDER_V2_MENTAL_MODEL.md`, `docs/BUILDER_V2_STORYBOARD.md`,
`docs/BUILDER_V2_BLUEPRINT.md`. All four remain authoritative and are
not redesigned here — this package validates, storyboards, wireframes,
and critically reviews what they already established. It makes exactly
one vocabulary change (below) and one screen-placement change (Part 1,
Theme Assets), both argued explicitly rather than assumed, and one
candidate simplification is proposed but deliberately **not** adopted
without sign-off (Part 7, Canvas).
**Scope:** The complete authoring experience — information architecture,
the full journey for both a first-time and a returning Theme Author,
desktop paper wireframes for every screen, step-by-step interaction
walkthroughs, the reasoning behind every workspace region, the
Builder's interaction language, and a critical review that tries to
remove more than it adds. No implementation, no components, no APIs,
no data structures — this is the last stop before that conversation,
not that conversation.

## Vocabulary note, read before anything else

This phase's brief introduces **Place** as the Builder-facing name for
what the Engine calls a **Holder**, and asks that "Holder," "Layer," and
"Element" stay internal wherever possible. This is not an architecture
change — every rule Blueprint §8 wrote for the Holders slice still
applies exactly as written — it is a vocabulary correction the prior
documents didn't fully make: they used "Holder" fairly often in
Builder-facing prose (e.g. the storyboard's own "Decide Where the Photo
Goes" stage). From here on:

- **Place** — what a Theme Author sees, reads, and clicks. The Scene
  Editor's second activity, where a photo will eventually go.
- **Holder** — the Engine noun, used only when this package or its
  predecessors discuss Engine mechanics (ownership, the Content Layer)
  that a Theme Author never sees.

Every other term carries over unchanged: Scene, Canvas, Decorations,
Text, Theme Assets, Scene Stack (never shown), Layer (never shown).

---

# Part 1 — Builder Information Architecture

The tree, restated with Place in place of Holders:

```
World
├── Overview
├── Scenes
│    ├── Scene 1 → Scene Editor: Canvas · Place · Decorations · Text
│    ├── Scene 2 → Scene Editor: Canvas · Place · Decorations · Text
│    └── …
├── Validation
├── Build
└── Publish
```

Every destination is examined below on the same two questions: **why
does this exist**, and **does it survive being challenged**.

### Overview — survives

Answers "what is this World called, and what's it about" (Blueprint
§4). Low-frequency, but real — nothing else is a candidate home for
World identity. Challenged against merging into Scenes: rejected,
because Scenes' entire value is answering one question cleanly ("is my
collection of pages complete") and mixing in unrelated identity fields
would cost that clarity for no real gain. Overview also becomes the
practical entry point for stocking Theme Assets before any Scene
exists — see below.

### Scenes — survives, unconditionally

The single most load-bearing screen in the whole IA — the literal,
felt expression of "a Theme is a curated library of Scenes" (Engine
Canon §0; Mental Model §1, point 1). Nothing about it is negotiable.

### The Scene Editor's four activities — three survive without
question; Canvas is challenged in Part 7

- **Canvas** — settles the page's shape. Real, but Blueprint §7 already
  flags it as "the lightest slice," visited once and rarely again. That
  frequency observation is examined properly in Part 7 rather than
  resolved here, since it's a genuine design question, not a
  contradiction to wave through.
- **Place** — decide where the photo goes and how it's framed.
  Survives without qualification: this is the Holder's own reason for
  existing (Engine Canon §1), so it is necessarily the Builder's own
  most important activity too.
- **Decorations** — build the Scene's atmosphere. Survives — the
  activity every Theme Author will describe as "the fun part"
  (Storyboard, Stage 6).
- **Text** — write and style the words. Survives as its own activity,
  distinct from Decorations, because wording (Blueprint §2's resolved
  contradiction) is never sourced from a shelf the way a sticker is —
  it's a different kind of creative decision even though both end up
  "on the page."

### Theme Assets — changed, and here is why

Blueprint §11 gave Theme Assets its own top-level World destination,
*in addition to* the in-Scene "Browse" overlay. This phase's own
Builder Structure diagram omits it from the top-level list entirely —
examined here rather than silently adopted or silently ignored:

A full top-level "Theme Assets" destination earns its place only if a
Theme Author regularly needs to manage the shelf *independent of any
Scene*. In practice, the overlay (Blueprint §6.3) already covers
picking, and its own "manage the full shelf" bridge already covers
organizing, renaming, and removing — for every moment that happens
*during* Scene work, which is the overwhelming majority of real usage.
The one case the overlay cannot cover is stocking the shelf **before a
World's first Scene exists** (Storyboard, Stage 9, "can happen before
decorating"), since the overlay only opens from inside a Scene.

**Resolution:** Theme Assets is no longer an independent, equally-
weighted item beside Scenes/Validation/Build/Publish. It is reachable
two ways, matching the two moments that actually need it:

1. **From inside a Scene** — the "Browse Theme Assets" overlay
   (unchanged from Blueprint §6.3), for picking, with its own bridge
   into full management.
2. **From Overview** — a single, secondary "Manage Theme Assets" entry
   point, for the rare pre-first-Scene stocking case, and for anyone
   who genuinely prefers to organize the shelf as its own task.

Both paths lead to the same underlying screen (Blueprint §11's
Purpose/Information/Actions are unchanged) — only its standing in the
top-level nav list changes, from a permanent peer to a secondary,
occasion-driven entry point. This is a real simplification, not a
renaming: the top-level nav now lists only things a Theme Author visits
by habit (Overview once in a while, Scenes constantly, Validation/
Build/Publish at the end), and Theme Assets — visited by *need*, not by
habit — no longer competes for that same permanent attention.

### Validation, Build, Publish — survive as three, not one

Examined for collapse in Part 7 (Validation into Build) and rejected
there, with reasoning; kept here as three distinct, single-purpose
destinations, exactly as this phase's own Builder Structure specifies.

---

# Part 2 — Complete Builder Storyboard

## 2A. First-time Theme Author — recap

The full Purpose/Entry/Exit/Intent/Shown/Hidden detail for all eleven
stages already lives in `docs/BUILDER_V2_STORYBOARD.md` and is not
repeated here — only its shape, renamed to this package's vocabulary:

| Stage | One-line intent |
|---|---|
| 1. Arrival | "Let me see what I'm already building, or start something new." |
| 2. Name This World | "What is this World called, what's it about?" |
| 3. Add a Scene | "What kind of page is this — give me a sensible starting point." |
| 4. Confirm the Page's Shape (Canvas) | "Is this page tall, wide, square — and is that right?" |
| 5. Decide Where the Photo Goes (Place) | "Where does the photo go, how big, what shape, how is it framed?" |
| 6. Decorate the Scene | "What does this page feel like?" |
| 7. Write the Words (Text) | "What does this page say, and how should it look?" |
| 8. Decide What a Story Author May Touch | "Now that this looks right, how much may they change?" |
| 9. Stock the Shelf (non-linear) | "What do I have to decorate with, and what's missing?" |
| 10. Grow the Library | "Do I have enough kinds of pages yet?" |
| 11. Ship It | "I'm done — check it, package it, put it where Runtime will find it." |

## 2B. Returning Theme Author — new

A returning Theme Author's journey does not follow one line — it
branches by *why they came back*. Five real scenarios cover the return
visits that matter; each states its intent, how it differs from a
first-timer's path, and where it lets out.

### Scenario 1 — "Let me pick up where I left off"

The majority case. **Intent:** "Get me back to exactly what I was
doing, with zero re-orientation." **Entry:** Arrival recognizes the
World instantly (by name/identity, per Blueprint §3) and opens it
directly to the *exact* screen and slice last visited — not Overview,
not Scenes, unless that's genuinely where they left off. A first-timer
is *placed* into Overview deliberately (Blueprint §4, "automatically,
right after creating a new World"); a returning author is never routed
through a screen they didn't ask for. **Exit:** wherever the resumed
task naturally ends — same as any mid-Scene exit point already defined.

### Scenario 2 — "Let me add one more Scene"

**Intent:** grow an already-established library, confidently, with
little exploration — the Theme's style and shelf are already familiar.
**Entry:** Arrival → Scenes directly (skipping Overview entirely — they
already know what this World is). **Difference from first-time:** the
Template choice (Storyboard Stage 3) is faster and more decisive; Theme
Assets browsing (Storyboard Stage 9) is closer to "I know exactly which
sticker I want" than first-time's exploratory browsing. **Exit:** back
to Scenes, or straight to Validation if this was the last piece needed.

### Scenario 3 — "Let me fix one specific thing"

**Intent:** a single, targeted correction — a typo, a frame that looks
wrong, a decoration that needs moving — prompted by something noticed
after the fact (their own second look, or someone else's feedback).
**Entry:** Arrival → Scenes → the specific Scene → directly into
whichever *activity* the fix requires (Place for a frame issue, Text
for a typo, Decorations for a misplaced sticker) — **never Canvas
first**, unlike a first-timer's natural Canvas → Place → Decorations →
Text progression. This is the clearest evidence that the four
activities must be freely, independently reachable (Blueprint §6, the
switcher's fixed-but-unforced order) — a returning author's entry point
is whichever activity matches their specific complaint, full stop.
**Exit:** immediately back to Scenes, or straight out of the World
entirely — a targeted fix does not imply a longer session.

### Scenario 4 — "Time to ship it"

**Intent:** confirm readiness and publish — not review everything
again, just confirm. **Entry:** Arrival → straight to Validation,
bypassing Scenes if they already trust the library is complete.
**Difference from first-time:** Storyboard Stage 10 ("Grow the
Library") is a real stage for a first-timer sizing up their first
collection; a returning author confident in a mature World may skip
straight past it. **Exit:** Publish, or back into a specific Scene if
Validation surfaces something unexpected (§4's "Fix Now" pattern,
Blueprint §12).

### Scenario 5 — "I left off mid-problem"

**Intent:** the previous session ended on a failed Validation or Build,
and the Theme Author needs to know that *immediately*, without having
to remember or re-discover it. **This is the one genuinely new
requirement returning-author journeys surface that a first-timer's
journey never needs:** Arrival (and Scenes, and Overview) must show a
glanceable, honest signal when a World's last known state was "not
ready" — not buried inside Validation until someone thinks to check it.
**Entry:** Arrival shows the signal → World-level nav → Validation,
already scrolled to (or otherwise foregrounding) the unresolved
failures. **Exit:** back into whichever Scene the failure names, via
the same "Fix Now" bridge Blueprint §12 already defines — this
scenario doesn't need a new mechanism, only a new place (Arrival/
Scenes) for an existing signal (Validation's own pass/fail state) to
surface earlier than it currently does.

---

# Part 3 — Desktop Paper Wireframes

Box-and-arrow only, exactly as the prior documents' own wireframe
sections — no visual styling, no component choices. Every Builder
screen, plus each Scene Editor activity shown on its own.

### Arrival

```
┌──────────────────────────────────────────────────────────┐
│  VihuStudio Builder                                       │
├──────────────────────────────────────────────────────────┤
│                                                            │
│   [ + Create New World ]                                  │
│                                                            │
│   My Worlds                                               │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│   │ Museum      │  │ Storybook   │  │ Sketchbook  │       │
│   │ Gallery     │  │ Classic     │  │             │       │
│   │ ⚠ not ready │  │             │  │             │       │
│   └────────────┘  └────────────┘  └────────────┘         │
└──────────────────────────────────────────────────────────┘
```

The "⚠ not ready" badge is Scenario 5's signal — glanceable here,
before opening anything.

### Overview

```
┌──────────────────────────────────────────────────────────┐
│ [World name]                                     [Save●]  │
├───────────┬────────────────────────────────────────────────┤
│ Overview ←│  World Name   [_____________________]           │
│ Scenes    │  Description  [_____________________]           │
│ Validation│                                                  │
│ Build     │  Manage Theme Assets →   (secondary entry point) │
│ Publish   │                                                  │
│           │  ✨ No Scenes yet — add your first one → Scenes  │
└───────────┴────────────────────────────────────────────────┘
```

### Scene Library (Scenes)

```
┌──────────────────────────────────────────────────────────┐
│ [World name]                                     [Save●]  │
├───────────┬────────────────────────────────────────────────┤
│ Overview  │  [+ Add Scene]                                  │
│ Scenes  ← │                                                  │
│ Validation│  ┌────────┐ ┌────────┐ ┌────────┐               │
│ Build     │  │ Cover  │ │ Photo  │ │ Quote  │  … one card    │
│ Publish   │  │ [thumb]│ │ Spread │ │ [thumb]│    per Scene,  │
│           │  └────────┘ │[thumb] │ └────────┘    live-       │
│           │             └────────┘                updating   │
└───────────┴────────────────────────────────────────────────┘
```

### Scene Editor — shared shell (applies to all four activities below)

```
┌──────────────────────────────────────────────────────────┐
│ [World name] › [Scene name]                      [Save●]  │
├───────────┬───────────────────────┬───────────────────────┤
│ Overview  │ Canvas · Place ·      │                        │
│ Scenes  ← │ Decorations · Text    │    Runtime Preview     │
│ Validation│ (activity switcher)   │   (clean, complete,    │
│ Build     │ ┌───────────────────┐ │    never interactive,  │
│ Publish   │ │                   │ │    identical no matter │
│           │ │   Working View    │ │    which activity is   │
│           │ │ (current activity,│ │    active)             │
│           │ │  Builder guides)  │ │                        │
│           │ └───────────────────┘ │                        │
│           ├───────────────────────┴───────────────────────┤
│           │  Property Editor — context-aware to selection   │
└───────────┴─────────────────────────────────────────────────┘
```

### Scene Editor — Canvas activity (Working View + Property Editor detail)

```
 Working View                       Property Editor
┌─────────────────────┐            ┌───────────────────────┐
│  ┌ ─ ─ safe area ─ ┐ │            │ Page Shape             │
│  ┆               ┆  │            │  ( ) Portrait          │
│  ┆   the page,   ┆  │            │  (•) Landscape         │
│  ┆   full size   ┆  │            │  ( ) Square             │
│  ┆               ┆  │            │  ( ) Wide               │
│  └ ─ ─ ─ ─ ─ ─ ─ ┘ │            │  ( ) Quote              │
└─────────────────────┘            └───────────────────────┘
```

### Scene Editor — Place activity

```
 Working View                       Property Editor
┌─────────────────────┐            ┌───────────────────────┐
│                      │            │ Selected: Place 1      │
│   ┌───────────┐      │            │  Position  [x] [y]     │
│   │ [photo    │◄─ handles         │  Size      [w] [h]     │
│   │ placeholder│  on selected     │  Shape     ( rounded ▾)│
│   │  + frame] │      │            │  Fit       (fit ▾)     │
│   └───────────┘      │            │  Frame  [Browse… ]     │
│                      │            │ ── Story Author may ── │
└─────────────────────┘            │  ☑ move   ☑ resize      │
                                    └───────────────────────┘
```

### Scene Editor — Decorations activity

```
 Working View                       Property Editor
┌─────────────────────┐            ┌───────────────────────┐
│      🌸              │            │ Selected: 🌸 Flower     │
│   ┌───────────┐      │            │  Position  [x] [y]     │
│   │  [photo]  │  🎀   │            │  Bring forward /       │
│   └───────────┘      │            │  Send backward         │
│         📎           │            │ ── Story Author may ── │
│  [+ Browse Theme     │            │  ☐ move  ☐ change       │
│     Assets]          │            │  ☐ add their own here   │
└─────────────────────┘            └───────────────────────┘
```

### Scene Editor — Text activity

```
 Working View                       Property Editor
┌─────────────────────┐            ┌───────────────────────┐
│   ┌───────────┐      │            │ Selected: Caption       │
│   │  [photo]  │      │            │  Typography [font ▾]   │
│   └───────────┘      │            │  Colour     [■]         │
│   "A day at the      │            │  Alignment  [≡][⟸][⟹]  │
│    museum"           │            │ ── Story Author may ── │
│   [+ Add Text]       │            │  ☑ change wording       │
└─────────────────────┘            └───────────────────────┘
```

### Validation

```
┌──────────────────────────────────────────────────────────┐
│ [World name]                                     [Save●]  │
├───────────┬────────────────────────────────────────────────┤
│ Overview  │  [▶ Run Validation]                             │
│ Scenes    │                                                  │
│ Validation←│  ⚠ 2 issues found                              │
│ Build     │   Scenes            ⚠ Error   → Fix Now          │
│ Publish   │   Place             ✓ All good                  │
│           │   Decorations       ⚠ Warning → Fix Now          │
│           │   Text              ✓ All good                  │
└───────────┴────────────────────────────────────────────────┘
```

### Build

```
┌──────────────────────────────────────────────────────────┐
│ [World name]                                     [Save●]  │
├───────────┬────────────────────────────────────────────────┤
│ Overview  │  Output File     museum-gallery.vtheme          │
│ Scenes    │  Last Validation  Passed                        │
│ Validation│                                                  │
│ Build   ← │  [🎁 Build World Package]                        │
│ Publish   │                                                  │
│           │  ✓ Built — 340 KB — just now                     │
│           │  [Continue to Publish →]                         │
└───────────┴────────────────────────────────────────────────┘
```

### Publish

```
┌──────────────────────────────────────────────────────────┐
│ [World name]                                     [Save●]  │
├───────────┬────────────────────────────────────────────────┤
│ Overview  │  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│ Scenes    │  │ 💾 Export │ │ 🏛️ Publish│ │ 🌐 Community│    │
│ Validation│  │  Package  │ │  Official  │ │ Coming Soon│    │
│ Build     │  └───────────┘ └───────────┘ └───────────┘     │
│ Publish ← │                                                  │
└───────────┴────────────────────────────────────────────────┘
```

---

# Part 4 — Interaction Storyboards

Each walked through step by step, grounded in Blueprint §6.

### Selecting a Place

1. Theme Author is in any activity, looking at Working View.
2. They click the photo placeholder (or its frame).
3. Working View draws selection handles around it.
4. The activity switcher's highlight moves to **Place**, regardless of
   which activity was active a moment ago (Blueprint §6.1).
5. Property Editor repopulates with Position/Size/Shape/Padding/Fit and
   the Frame control, ending in the permission block.
6. Runtime Preview does not change at all — it never shows a selection
   state (§6 shared shell).

### Selecting Decorations

1. Theme Author clicks a placed sticker in Working View.
2. It gets a selection outline (lighter-weight than a Place's handles —
   decorations don't resize the same way a Place does; they mostly
   move and reorder).
3. Switcher highlight moves to **Decorations**.
4. Property Editor shows that decoration's own properties, ending in
   the permission block *with* the Decoration Slot line ("let the
   Story Author add their own here too").

### Selecting Text

1. Theme Author clicks a caption or title directly on the page.
2. A text-editing caret appears in place — typing edits the words
   immediately, no separate "open editor" step.
3. Switcher highlight moves to **Text**.
4. Property Editor shows Typography/Colour/Alignment for the selected
   text, ending in the permission block (this time governing wording
   vs. restyling independently, Blueprint §10).

### Automatic activity switching

1. Theme Author is actively working in Decorations.
2. They click the Place (the photo) instead of a decoration.
3. Without any extra step or confirmation, the switcher moves to
   **Place** and the Property Editor updates to match.
4. Nothing about Working View's overlay guides "flickers" — Decorations'
   guides are simply replaced by Place's guides in the same frame the
   selection changes, since both are the same rendering pass with a
   different guide layer on top (Mental Model §4).

### Theme Asset overlay

1. Theme Author is in Decorations, wants a texture that isn't on the
   Scene yet.
2. They choose "Browse Theme Assets" (Blueprint §6.3).
3. An overlay opens *on top of* the current Scene Editor — the Scene
   underneath is not unmounted, just temporarily covered.
4. The overlay shows the shelf, scoped to the categories relevant to
   wherever it was opened from (Decorations → decorations/textures/
   patterns; Place → Frames only).
5. Theme Author picks an asset.

### Returning from Theme Assets

1. The moment an asset is picked, the overlay closes automatically —
   no separate "done" step.
2. The picked asset appears already placed on the Scene, in Working
   View, selected (so its Property Editor is immediately available if
   the Theme Author wants to adjust it right away).
3. Focus returns exactly to the activity the overlay was opened from —
   opening it from Place returns to Place, not to Decorations.

### Property Editor updates

1. Nothing is selected: Property Editor shows lightweight, activity-
   level guidance only (e.g. Decorations with nothing selected might
   show "click a decoration to edit it, or Browse Theme Assets to add
   one") — never a blank void, never a long generic form.
2. Something is selected: Property Editor repopulates immediately, no
   transition delay — the selected object's own type-specific
   properties first, the permission block last, always in that order,
   on every activity, so the Property Editor's *shape* never surprises
   a Theme Author even when its *content* changes completely.

### Runtime Preview behaviour

1. Constant truth: Runtime Preview always shows the Scene exactly as
   Runtime will render it, regardless of the active activity or
   current selection.
2. It never adds a guide, a selection outline, or a hover state — not
   even a subtle one.
3. It is not clickable — clicking inside it does nothing at all,
   deliberately (§6 shared shell's firm rule, not a soft default).
4. Any edit made anywhere in the Scene Editor reflects in Runtime
   Preview immediately — there is no separate "preview my changes"
   action, because there is nothing Runtime Preview needs to be told to
   refresh; it is always live.

### Object selection (general)

1. Clicking empty space (no object under the cursor) clears the
   current selection — Property Editor returns to its activity-level
   guidance, switcher stays on whichever activity was active.
2. Clicking a different object replaces the selection outright — there
   is no multi-select in this Blueprint's scope (nothing in the four
   upstream documents implies a Theme Author ever needs to edit two
   objects' properties at once).
3. Pressing outside the Working View entirely (e.g. clicking the
   header) also clears selection.

### Navigation between Scenes

1. From inside any Scene Editor, "back to Scenes" (World-level nav,
   always visible per §6 shared shell) returns to the Scene Library.
2. Selecting a different Scene card opens straight into that Scene's
   editor, resuming on whichever activity it was last left on (never
   forced back to Canvas) — this is what makes Returning Scenario 3
   ("fix one specific thing") work without friction.
3. There is no "are you sure, unsaved changes" interruption at any
   point in this flow — autosave (Part 6) means there is never
   anything unsaved to lose.

---

# Part 5 — Workspace Design

Each region's purpose, and what breaks if it's removed — the
falsifiability test this Part is built around.

### Header

**Purpose:** orientation (which World, which Scene) and save-state
confidence, always visible. **Why it cannot be removed:** without it, a
Theme Author has no persistent answer to "where am I" once several
Scenes deep, and no persistent answer to "is my last edit safe" — both
questions this whole product line has already learned matter enough to
solve once and reuse everywhere (Builder V1, Sprint B2.0.6).

### Navigation (World-level)

**Purpose:** keeps Overview/Scenes/Validation/Build/Publish one click
away, permanently, regardless of how deep into a Scene's activities the
Theme Author currently is. **Why it cannot be removed:** Returning
Scenario 3 depends entirely on "back to Scenes" being immediate, not a
multi-step retreat out of a modal-feeling editing surface. Remove this
region and every Scene Editor becomes a dead end you can only escape by
finishing, not by choosing to leave.

### Working View

**Purpose:** the one interactive rendering surface — shows the Scene
with guides scoped to the current activity, and is where every click,
drag, and selection actually happens. **Why it cannot be removed:**
there is nowhere else in this design for direct manipulation to occur;
without it, every edit would have to happen through form fields alone,
which is precisely the "long generic inspector" every upstream document
argued against.

### Runtime Preview

**Purpose:** answers "what will the reader actually see," continuously,
with zero interpretation required. **Why it cannot be removed:**
without a guide-free, always-current second view, a Theme Author would
have to mentally subtract their own Builder guides from Working View to
imagine the real result — an error-prone, cognitively expensive habit
this design deliberately never asks anyone to form (Mental Model §1,
"what should always remain visible").

### Property Editor

**Purpose:** the *only* place an object's own properties and its
Story-Author permissions are edited — context-aware to activity and
selection. **Why it cannot be removed:** without it, the four
activities would have nowhere to expose type-specific properties
(Typography, Frame, Fit) without cluttering Working View itself with
form controls drawn on top of the canvas — which would immediately
reintroduce the "generic inspector" problem in a different location.

None of these five regions is optional in the sense that removing it
would merely be "less convenient" — each removal breaks a specific,
already-identified requirement from an upstream document. That is the
bar this Part holds every region to.

---

# Part 6 — Interaction Principles

Only interactions that earn their place by genuinely improving
authoring — nothing added for completeness' sake.

**Selection.** Click to select, matching Part 4's walkthroughs exactly.
Selection is always singular (no multi-select) and always drives both
the switcher and the Property Editor together, never one without the
other.

**Hover.** A light indication (an outline, not a full selection state)
on whatever's under the cursor in Working View, so a Theme Author knows
what *would* be selected before committing to a click — cheap to
provide, meaningfully reduces mis-clicks in a Scene with several small
decorations close together. Never present in Runtime Preview (§6's
firm non-interactive rule extends to hover, not just click).

**Drag.** The primary way to reposition anything `moveable` — a Place,
a decoration, a text element. Dragging a Place also visibly respects
the Canvas's Safe Area guide (shown, not enforced as a hard wall,
unless the Theme itself wants a hard constraint — a decision left to
whichever concrete design pass follows this one).

**Resize.** Handles on the selected object's own bounding box — the
same interaction for a Place's footprint as for a resizable decoration.
Only appears on objects whose `moveable`/type properties actually
support a size change (a fixed-caption text box, for instance, may only
expose drag, not resize, if its Theme Author locked its dimensions).

**Keyboard shortcuts.** Deliberately minimal at this stage: Delete/
Backspace removes the current selection; arrow keys nudge it by one
unit, Shift+arrow by a larger step — both directly serving fine
positioning drag alone is clumsy for. No larger shortcut system is
proposed here; inventing one without a concrete implementation pass to
validate it against would be exactly the kind of speculative addition
Part 7 exists to catch.

**Undo / Redo.** A flat, whole-Scene undo stack — not per-activity,
since a Theme Author moving between Place/Decorations/Text while
building one Scene thinks of it as one continuous session of changes,
not four separate histories to track independently.

**Autosave.** Every change is written the moment it happens — matching
Builder V1's own proven synchronous-save model (Sprint B2.0.6). There
is no separate "Save" action a Theme Author must remember to invoke;
the Header's save-state indicator (below) exists to build confidence in
this fact, not to gate it.

**Dirty state / Saving state.** Builder V1's own proven two-state
model, kept verbatim: 🟠 *Unsaved Changes* the instant an edit begins,
settling to 🟢 *All Changes Saved* shortly after — no separate "Saving…"
state, since the underlying write is already synchronous and instant;
a third state would describe a gap in time that doesn't exist (Sprint
B2.0.6's own reasoning, unchanged here).

**Empty states.** Every screen that can be empty says so invitingly,
never as a dead end: a World with zero Scenes (Overview points at
Scenes directly); a Scene's unfilled Place (a generic upload-style
placeholder, never mistaken for real Theme Author content); an empty
Decorations activity ("click Browse Theme Assets to add your first
decoration"); an empty Theme Assets shelf (an invitation to add the
first asset, not a blank grid).

**Permissions — collapsed by default.** A refinement surfaced during
Part 7's critical review, adopted here directly since it changes only
presentation, not the underlying mechanism (Blueprint §6.2 is otherwise
unchanged): the permission block starts **collapsed**, showing one
honest summary line — "Locked for Story Authors" (the default for
anything the Theme Author places) or "Story Author may adjust this" —
with a single "Change" action that expands the full three-question
block only when the Theme Author actually wants to touch it. Most
objects in most Scenes stay at their default forever; showing three
open checkboxes on every single selection would be exactly the kind of
visual noise this whole design has tried to avoid, for a decision most
objects never need revisited.

---

# Part 7 — Critical Review

Four real candidates for removal or simplification, argued honestly —
two adopted, one rejected with reasoning, one proposed but deliberately
left for explicit sign-off rather than adopted unilaterally.

### 1. Should Canvas be demoted out of the four-way switcher? — proposed, not adopted

Canvas is Blueprint's own "lightest slice" — visited once per Scene,
almost never again (§7). A real case exists for removing it from the
switcher entirely and replacing it with a compact "Page Shape" control
near Working View's header (sketched informally: `Page Shape:
Landscape ▾`), leaving the switcher as **Place · Decorations · Text** —
three activities, all genuinely recurring, all visited repeatedly while
building one Scene.

**In favor:** matches actual usage frequency exactly; a leaner
three-item switcher is easier to hold in mind than four; nothing about
Place/Decorations/Text's own design changes.

**Against:** demoting Canvas changes its standing from a full activity
with its own Purpose/Primary Question (Blueprint §7) to a minor header
control — a real architectural change to a document this phase's brief
calls authoritative, not merely a presentation tweak like the
permissions default above. It also very slightly reduces
discoverability for the rare-but-real case of reconsidering a Scene's
aspect ratio well after first creating it.

**Disposition:** genuinely worth doing, but treated here as a
**recommendation for explicit product sign-off**, not adopted — the
distinction Part 7 is supposed to respect is "propose confidently" vs.
"redesign unilaterally," and this one crosses from vocabulary/
presentation into the Blueprint's own screen model. If accepted, Parts
1–6 above would need one mechanical update: replace "the four
activities" with "the three activities, plus Canvas's Page Shape
control" throughout, and retire Canvas's wireframe (Part 3) into a
one-line header sketch instead.

### 2. Should Validation merge into Build? — considered, rejected

An alternative model: Build simply validates internally and only shows
a report on failure, collapsing two top-level destinations into one for
the common "it just works" path.

**Against, decisively:** Validation's value is being an independent,
re-runnable diagnostic a Theme Author can consult *at any point*, not
only immediately before packaging — Builder V1's own "Fix Now" pattern
(Blueprint §12) depends on Validation being reachable on its own terms,
including from Arrival's own "not ready" signal (Part 2B, Scenario 5).
Folding it into Build would remove a genuinely useful mid-work check-in
moment for no real simplification gain, since the report itself still
has to exist and be read either way.

**Disposition:** kept as three distinct destinations, unchanged.

### 3. Should the standalone Theme Assets screen exist at all, even demoted? — considered, kept

An even leaner alternative: no standalone screen at all, ever — only
the in-Scene overlay, with its "manage the full shelf" mode simply
being a fuller version of the same overlay, never reachable from
Overview.

**Against:** the pre-first-Scene stocking case (Part 1's own reasoning)
is real and would have no home at all under this model — a brand-new
World would force a Theme Author to create a throwaway Scene just to
open an overlay, which is worse than the secondary Overview entry point
this package already proposes.

**Disposition:** Part 1's resolution (secondary entry from Overview,
plus the overlay) stands, confirmed rather than second-guessed.

### 4. Should the permission block show all three questions, always? — considered, changed

Already resolved by adoption in Part 6: collapsed-by-default, one
summary line, expand-on-demand. The reasoning is stated there and not
repeated here.

### What Builder V2 must feel like

Every screen answers exactly one question (Part 1's own test, applied
to itself). Every activity a Theme Author repeats often (Place,
Decorations, Text) is one click away, always in the same place. Every
activity they rarely repeat (Canvas, Theme Assets, Validation/Build/
Publish) costs slightly more to reach, on purpose, because that cost is
what keeps the frequent activities cheap. Nothing on screen ever asks
"what would you like to configure" — everything asks "what are you
making," which is the whole thesis this entire derivation chain has
been building toward since Engine V2 Canon's own opening line.

---

## Cross-references

This document depends on, and does not restate in full:

- `docs/ENGINE_V2_CANON.md` — the object model everything above
  translates, never redesigns.
- `docs/BUILDER_V2_MENTAL_MODEL.md` — the mental-model derivation this
  package's vocabulary and activity set are inherited from.
- `docs/BUILDER_V2_STORYBOARD.md` — the first-time journey Part 2A
  summarizes rather than repeats.
- `docs/BUILDER_V2_BLUEPRINT.md` — the per-screen architecture Part 1,
  3, 4, and 5 all build directly on top of.

## Open questions carried forward

Genuinely unresolved, not decided by omission:

1. **Canvas's placement in the switcher** (Part 7, item 1) — proposed,
   explicitly not adopted, awaiting product sign-off before Parts 1–6
   are amended.
2. Everything Blueprint §16 already carried forward as Engine-level
   (Theme Settings' exact scope, Holder placeholder branding, Scene
   Template persistence, per-slot Decoration constraint vocabulary)
   remains exactly as open as it was there — nothing in this UX pass
   needed any of them resolved to proceed, which is itself a small
   confirmation that Blueprint §16 drew its boundaries correctly.
3. **Whether dragging a Place past its Canvas Safe Area should be a
   hard constraint or a soft guide** (Part 6, "Drag") — flagged there,
   not resolved here; a decision for the concrete design pass that
   follows this package, once Canvas's own fate (item 1, above) is
   settled.
