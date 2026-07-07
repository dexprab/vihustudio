# Builder V2 UX Design Package

**Status:** UX Design Package, revised after `docs/BUILDER_V2_VISION.md`
— the last document before implementation begins. Read, in order:
`docs/ENGINE_V2_CANON.md`, `docs/BUILDER_V2_MENTAL_MODEL.md`,
`docs/BUILDER_V2_STORYBOARD.md`, `docs/BUILDER_V2_BLUEPRINT.md`,
`docs/BUILDER_V2_VISION.md`. All five remain authoritative. This
package originally validated, storyboarded, wireframed, and critically
reviewed the Blueprint's four-activity, left-navigation model; the
Vision document's reset (top Global Navigation, a Scene Header carrying
Scene Configuration, three creative activities, Context Inspector
replacing Property Editor) is now applied throughout, and every section
below reflects it — nothing here contradicts the Vision document, and
where this package's own Part 7 critical review first proposed a
change the Vision document later adopted (Canvas), that is noted in
place rather than presented as if it had been the plan from the start.
**Scope:** The complete authoring experience — information architecture,
the full journey for both a first-time and a returning Theme Author,
desktop paper wireframes for every screen, step-by-step interaction
walkthroughs, the reasoning behind every workspace region, the
Builder's interaction language, and a critical review that tries to
remove more than it adds. No implementation, no components, no APIs,
no data structures — this is the last stop before that conversation,
not that conversation.

## Vocabulary note, read before anything else

Two Builder-facing renames apply throughout this package, both from
Engine nouns to creator language, neither an architecture change —
every rule the Blueprint wrote for the underlying Engine concept still
applies exactly as written:

- **Place** — what the Engine calls a **Holder**. The activity where a
  photo will eventually go.
- **Scene Configuration** — what the Engine calls **Canvas**
  (`docs/BUILDER_V2_VISION.md` §2, §5). Surfaced as a glanceable summary
  in the Scene Header, not as its own activity — see Part 1 and Part 5,
  below, for what this changes from this package's original Blueprint-
  era structure.

"Holder" and "Canvas" remain correct only when this package or its
predecessors discuss Engine mechanics (ownership, the Content Layer,
Size/Aspect Ratio/Safe Area as Engine properties) that a Theme Author
never sees. Every other term carries over unchanged: Scene, Decorations,
Text, Theme Assets, Scene Stack (never shown), Layer (never shown).

---

# Part 1 — Builder Information Architecture

The tree, restated per `docs/BUILDER_V2_VISION.md`: Global Navigation
across the top, structurally separate from the Scene Editor; opening a
Scene adds a Scene Header (breadcrumb + Scene Configuration summary)
above a three-activity editor.

```
World | Scenes | Validation | Build | Publish        ← Global Navigation (top, always visible)

Scenes
├── Scene 1 → Scene Header (breadcrumb + Scene Configuration) → Place · Decorations · Text
├── Scene 2 → Scene Header (breadcrumb + Scene Configuration) → Place · Decorations · Text
└── …
```

Every destination is examined below on the same two questions: **why
does this exist**, and **does it survive being challenged**.

### World — survives

Answers "what is this World called, and what's it about" (Blueprint
§4, there named "Overview" — renamed per Vision §1; same screen, same
purpose). Low-frequency, but real — nothing else is a candidate home
for World identity. Challenged against merging into Scenes: rejected,
because Scenes' entire value is answering one question cleanly ("is my
collection of pages complete") and mixing in unrelated identity fields
would cost that clarity for no real gain. World also becomes the
practical entry point for stocking Theme Assets before any Scene
exists — see below.

### Scenes — survives, unconditionally

The single most load-bearing screen in the whole IA — the literal,
felt expression of "a Theme is a curated library of Scenes" (Engine
Canon §0; Mental Model §1, point 1). Nothing about it is negotiable.

### The Scene Editor's three activities — all three survive; Canvas is resolved, not merely challenged

Blueprint originally listed four activities (Canvas, Place, Decorations,
Text) and this package's own Part 7 first raised whether Canvas
belonged in that list at all. `docs/BUILDER_V2_VISION.md` has since
resolved it: Canvas is no longer a peer activity, full stop — it is
surfaced instead as the Scene Header's Scene Configuration summary
(Vision §2). What remains in the switcher is exactly the three
activities that earn a place there by being genuinely recurring:

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
*in addition to* the in-Scene "Browse" overlay. Vision §1 confirms it
stays absent from the top-level Global Navigation list — examined here
rather than silently adopted or silently ignored:

A full top-level "Theme Assets" destination earns its place only if a
Theme Author regularly needs to manage the shelf *independent of any
Scene*. In practice, the overlay (Blueprint §6.3) already covers
picking, and its own "manage the full shelf" bridge already covers
organizing, renaming, and removing — for every moment that happens
*during* Scene work, which is the overwhelming majority of real usage.
The one case the overlay cannot cover is stocking the shelf **before a
World's first Scene exists** (Storyboard, Stage 9, "can happen before
decorating"), since the overlay only opens from inside a Scene.

**Resolution:** Theme Assets is not one of the five Global Navigation
destinations. It is reachable two ways, matching the two moments that
actually need it:

1. **From inside a Scene** — the "Browse Theme Assets" overlay
   (unchanged from Blueprint §6.3), for picking, with its own bridge
   into full management.
2. **From World** — a single, secondary "Manage Theme Assets" entry
   point, for the rare pre-first-Scene stocking case, and for anyone
   who genuinely prefers to organize the shelf as its own task.

Both paths lead to the same underlying screen (Blueprint §11's
Purpose/Information/Actions are unchanged) — only its standing in the
navigation changes, from a permanent peer to a secondary,
occasion-driven entry point. This is a real simplification, not a
renaming: Global Navigation now lists only things a Theme Author visits
by habit (World once in a while, Scenes constantly, Validation/
Build/Publish at the end), and Theme Assets — visited by *need*, not by
habit — no longer competes for that same permanent attention.

### Validation, Build, Publish — survive as three, not one

Examined for collapse in Part 7 (Validation into Build) and rejected
there, with reasoning; kept here as three distinct, single-purpose
Global Navigation destinations, exactly as `docs/BUILDER_V2_VISION.md`
§1 specifies.

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
| 4. Confirm the Page's Shape (now a Scene Header glance at Scene Configuration, not a dedicated activity — `docs/BUILDER_V2_VISION.md` §2) | "Is this page tall, wide, square — and is that right?" |
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
directly to the *exact* screen and activity last visited — not World,
not Scenes, unless that's genuinely where they left off. A first-timer
is *placed* into World deliberately (Blueprint §4, "automatically,
right after creating a new World"); a returning author is never routed
through a screen they didn't ask for. **Exit:** wherever the resumed
task naturally ends — same as any mid-Scene exit point already defined.

### Scenario 2 — "Let me add one more Scene"

**Intent:** grow an already-established library, confidently, with
little exploration — the Theme's style and shelf are already familiar.
**Entry:** Arrival → Scenes directly (skipping World entirely — they
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
for a typo, Decorations for a misplaced sticker) — **never by way of
Scene Configuration first**, unlike a first-timer's natural
Configuration-glance → Place → Decorations → Text progression. This is
the clearest evidence that the three activities must be freely,
independently reachable (Blueprint §6, the switcher's fixed-but-unforced
order) — a returning author's entry point is whichever activity matches
their specific complaint, full stop. **Exit:** immediately back to
Scenes, or straight out of the World entirely — a targeted fix does not
imply a longer session.

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
journey never needs:** Arrival (and Scenes, and World) must show a
glanceable, honest signal when a World's last known state was "not
ready" — not buried inside Validation until someone thinks to check it.
**Entry:** Arrival shows the signal → Global Navigation → Validation,
already scrolled to (or otherwise foregrounding) the unresolved
failures. **Exit:** back into whichever Scene the failure names, via
the same "Fix Now" bridge Blueprint §12 already defines — this
scenario doesn't need a new mechanism, only a new place (Arrival/
Scenes) for an existing signal (Validation's own pass/fail state) to
surface earlier than it currently does.

---

# Part 3 — Desktop Paper Wireframes

Box-and-arrow only, exactly as the prior documents' own wireframe
sections — no visual styling, no component choices. Redrawn throughout
for `docs/BUILDER_V2_VISION.md`'s top Global Navigation, Scene Header,
and three-pane workspace. Every Builder screen, plus each of the three
Scene Editor activities shown on its own.

### Arrival

Unchanged from the original package — Arrival has no World open yet, so
Global Navigation doesn't appear here regardless of top-vs-side
placement.

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

### World

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │  Global Navigation
├──────────────────────────────────────────────────────────┤
│  World Name   [_____________________]                     │
│  Description  [_____________________]                     │
│                                                            │
│  Manage Theme Assets →   (secondary entry point)           │
│                                                            │
│  ✨ No Scenes yet — add your first one → Scenes             │
└──────────────────────────────────────────────────────────┘
```

### Scenes — Scene Library

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │
├──────────────────────────────────────────────────────────┤
│  [+ Add Scene]                                             │
│                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐                          │
│  │ Cover  │ │ Photo  │ │ Quote  │   … one card per Scene,  │
│  │ [thumb]│ │ Spread │ │ [thumb]│     live-updating         │
│  └────────┘ │[thumb] │ └────────┘                          │
│             └────────┘                                     │
└──────────────────────────────────────────────────────────┘
```

### Scene Editor — shared shell (applies to all three activities below)

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │  Global Navigation
├──────────────────────────────────────────────────────────┤
│ Museum Gallery › Gallery Portrait                          │  Scene Header
│ 📄 Portrait   📐 Instagram Safe Area   📦 1080 × 1350      │  (Scene Configuration)
├───────────────────────┬───────────────────┬───────────────┤
│  Place · Decorations  │                   │               │
│  · Text (switcher)    │                   │               │
│ ┌───────────────────┐ │                   │               │
│ │                   │ │    Context        │  Runtime      │
│ │   Working View    │ │    Inspector       │  Preview      │
│ │ (current activity,│ │  (context-aware   │  (clean,      │
│ │  Builder guides)  │ │   to selection)   │   complete,   │
│ │                   │ │                   │   never       │
│ │                   │ │                   │   interactive)│
│ └───────────────────┘ │                   │               │
└───────────────────────┴───────────────────┴───────────────┘
```

> **Amended** — see `docs/BUILDER_V2_VISION.md` §4/Change History v1.1.
> The original design ordered these Working View | Runtime Preview |
> Context Inspector; a later explicit product decision swapped the two
> right-hand columns to the order shown above.

Clicking the Scene Header's Scene Configuration summary (`📄 Portrait …`)
selects it the same way clicking any object does — Context Inspector
shows Aspect Ratio choices; Working View keeps showing whichever
activity was already active (Vision §2).

### Scene Editor — Place activity

```
 Working View                       Context Inspector
┌─────────────────────┐            ┌───────────────────────┐
│                      │            │ Selected: Place 1      │
│   ┌───────────┐      │            │  Position  [x] [y]     │
│   │ [photo    │◄─ handles         │  Size      [w] [h]     │
│   │ placeholder│  on selected     │  Shape     ( rounded ▾)│
│   │  + frame] │      │            │  Fit       (fit ▾)     │
│   └───────────┘      │            │  Frame  [Browse… ]     │
│                      │            │ ── Story Author may ── │
└─────────────────────┘            │  🔒 Locked  [Change]    │
                                    └───────────────────────┘
```

### Scene Editor — Decorations activity

```
 Working View                       Context Inspector
┌─────────────────────┐            ┌───────────────────────┐
│      🌸              │            │ Selected: 🌸 Flower     │
│   ┌───────────┐      │            │  Position  [x] [y]     │
│   │  [photo]  │  🎀   │            │  Bring forward /       │
│   └───────────┘      │            │  Send backward         │
│         📎           │            │ ── Story Author may ── │
│  [+ Browse Theme     │            │  🔒 Locked  [Change]    │
│     Assets]          │            │  (expands to move/     │
│                      │            │   change/add-their-own)│
└─────────────────────┘            └───────────────────────┘
```

### Scene Editor — Text activity

```
 Working View                       Context Inspector
┌─────────────────────┐            ┌───────────────────────┐
│   ┌───────────┐      │            │ Selected: Caption       │
│   │  [photo]  │      │            │  Typography [font ▾]   │
│   └───────────┘      │            │  Colour     [■]         │
│   "A day at the      │            │  Alignment  [≡][⟸][⟹]  │
│    museum"           │            │ ── Story Author may ── │
│   [+ Add Text]       │            │  🔒 Locked  [Change]    │
└─────────────────────┘            └───────────────────────┘
```

Both Place and Decorations wireframes above show the permission block
in its collapsed default state (Part 6/7) — one line, one action — with
a note in Decorations of what expanding it reveals, rather than
repeating the full three-question form in every wireframe.

### Validation

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │
├──────────────────────────────────────────────────────────┤
│  [▶ Run Validation]                                        │
│                                                            │
│  ⚠ 2 issues found                                          │
│   Scenes            ⚠ Error   → Fix Now                    │
│   Place             ✓ All good                             │
│   Decorations       ⚠ Warning → Fix Now                    │
│   Text              ✓ All good                             │
└──────────────────────────────────────────────────────────┘
```

### Build

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │
├──────────────────────────────────────────────────────────┤
│  Output File     museum-gallery.vtheme                     │
│  Last Validation  Passed                                   │
│                                                            │
│  [🎁 Build World Package]                                   │
│                                                            │
│  ✓ Built — 340 KB — just now                                │
│  [Continue to Publish →]                                    │
└──────────────────────────────────────────────────────────┘
```

### Publish

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Validation │ Build │ Publish     [Save●] │
├──────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │
│  │ 💾 Export │ │ 🏛️ Publish│ │ 🌐 Community│                │
│  │  Package  │ │  Official  │ │ Coming Soon│                │
│  └───────────┘ └───────────┘ └───────────┘                 │
└──────────────────────────────────────────────────────────┘
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
5. Context Inspector repopulates with Position/Size/Shape/Padding/Fit and
   the Frame control, ending in the permission block.
6. Runtime Preview does not change at all — it never shows a selection
   state (§6 shared shell).

### Selecting Decorations

1. Theme Author clicks a placed sticker in Working View.
2. It gets a selection outline (lighter-weight than a Place's handles —
   decorations don't resize the same way a Place does; they mostly
   move and reorder).
3. Switcher highlight moves to **Decorations**.
4. Context Inspector shows that decoration's own properties, ending in
   the permission block *with* the Decoration Slot line ("let the
   Story Author add their own here too").

### Selecting Text

1. Theme Author clicks a caption or title directly on the page.
2. A text-editing caret appears in place — typing edits the words
   immediately, no separate "open editor" step.
3. Switcher highlight moves to **Text**.
4. Context Inspector shows Typography/Colour/Alignment for the selected
   text, ending in the permission block (this time governing wording
   vs. restyling independently, Blueprint §10).

### Automatic activity switching

1. Theme Author is actively working in Decorations.
2. They click the Place (the photo) instead of a decoration.
3. Without any extra step or confirmation, the switcher moves to
   **Place** and the Context Inspector updates to match.
4. Nothing about Working View's overlay guides "flickers" — Decorations'
   guides are simply replaced by Place's guides in the same frame the
   selection changes, since both are the same rendering pass with a
   different guide layer on top (Mental Model §4).

### Adjusting Scene Configuration

1. Theme Author clicks the Scene Header's Scene Configuration summary
   (`📄 Portrait  📐 Instagram Safe Area  📦 1080 × 1350`).
2. It is selected exactly the way any other object is (Vision §2) —
   Context Inspector shows Aspect Ratio choices.
3. Working View does **not** change activity — whichever of Place/
   Decorations/Text was active stays on screen, since Scene
   Configuration has no guides or page object of its own to show there.
4. Choosing a new Aspect Ratio updates the Scene Header's summary, the
   Scene's actual shape in both Working View and Runtime Preview,
   immediately — the same live-update guarantee every other edit
   already has.
5. Clicking anywhere else (an object on the page, or a different
   activity) clears this selection the same way any other object's
   selection would clear.

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
   View, selected (so its Context Inspector is immediately available if
   the Theme Author wants to adjust it right away).
3. Focus returns exactly to the activity the overlay was opened from —
   opening it from Place returns to Place, not to Decorations.

### Context Inspector updates

1. Nothing is selected: Context Inspector shows lightweight, activity-
   level guidance only (e.g. Decorations with nothing selected might
   show "click a decoration to edit it, or Browse Theme Assets to add
   one") — never a blank void, never a long generic form.
2. Something is selected: Context Inspector repopulates immediately, no
   transition delay — the selected object's own type-specific
   properties first, the permission block last, always in that order,
   on every activity, so the Context Inspector's *shape* never surprises
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
   current selection — Context Inspector returns to its activity-level
   guidance, switcher stays on whichever activity was active.
2. Clicking a different object replaces the selection outright — there
   is no multi-select in this Blueprint's scope (nothing in the four
   upstream documents implies a Theme Author ever needs to edit two
   objects' properties at once).
3. Pressing outside the Working View entirely (e.g. clicking the
   header) also clears selection.

### Navigation between Scenes

1. From inside any Scene Editor, "back to Scenes" (Global Navigation,
   always visible at the top, per `docs/BUILDER_V2_VISION.md` §1)
   returns to the Scene Library.
2. Selecting a different Scene card opens straight into that Scene's
   editor, resuming on whichever activity it was last left on (never
   forced back to a "start from Scene Configuration" step) — this is
   what makes Returning Scenario 3 ("fix one specific thing") work
   without friction.
3. There is no "are you sure, unsaved changes" interruption at any
   point in this flow — autosave (Part 6) means there is never
   anything unsaved to lose.

---

# Part 5 — Workspace Design

Five regions now, not four — `docs/BUILDER_V2_VISION.md` splits what
was one "Header" region into Global Navigation (top, permanent, outside
the editing workspace entirely) and the Scene Header (appears only once
a Scene is open). Each region's purpose, and what breaks if it's
removed — the falsifiability test this Part is built around.

### Global Navigation

**Purpose:** orientation at the World level — World / Scenes /
Validation / Build / Publish, plus save-state confidence — always
visible, always at the top, structurally outside the editing workspace.
**Why it cannot be removed:** without it, a Theme Author has no
persistent answer to "where am I" once several Scenes deep, and no
persistent answer to "is my last edit safe" — both questions this whole
product line has already learned matter enough to solve once and reuse
everywhere (Builder V1, Sprint B2.0.6). **Why it moved here specifically
(top, not the workspace's own left edge):** Returning Scenario 3
depends entirely on "back to Scenes" being immediate, not a retreat
through a region that could be mistaken for part of the Scene Editor
itself — separating it structurally makes that distinction physical,
not just conventional.

### Scene Header

**Purpose:** two things, together, only once a Scene is open — the
breadcrumb (which Scene, inside which World) and the Scene Configuration
summary (page shape, Safe Area, dimensions), both answering questions
that matter continuously while editing but don't belong to any one
creative activity. **Why it cannot be removed:** without the breadcrumb,
a Theme Author several activities deep loses track of which Scene
they're even in; without the Scene Configuration summary being
glanceable here, Canvas's information would have nowhere to live at all
now that it's not a peer activity (Vision §2) — removing this region
doesn't just lose a convenience, it loses the only remaining home for a
real, necessary piece of information.

### Working View

**Purpose:** the one interactive rendering surface — shows the Scene
with guides scoped to the current activity, and is where every click,
drag, and selection actually happens. **Why it cannot be removed:**
there is nowhere else in this design for direct manipulation to occur;
without it, every edit would have to happen through form fields alone,
which is precisely the "long generic inspector" every upstream document
argued against.

### Context Inspector

**Purpose:** the *only* place an object's own properties and its
Story-Author permissions are edited — context-aware to activity and
selection. **Why it cannot be removed:** without it, the three
activities (and Scene Configuration, selected the same way any object
is) would have nowhere to expose type-specific properties (Typography,
Frame, Fit, Aspect Ratio) without cluttering Working View itself with
form controls drawn on top of the canvas — which would immediately
reintroduce the "generic inspector" problem in a different location.
**On its column width:** `docs/BUILDER_V2_VISION.md` §4 already flags
that an equal three-way split with Working View and Runtime Preview
would under-serve this region the same way Builder V1's old shared-
column Property Editor was once under-served — sized medium (larger
than Runtime Preview, smaller than Working View), not a naive equal
third. **On its position:** moved beside Working View (Vision §4/Change
History v1.1) since editing the current selection is the
higher-frequency action, relative to Runtime Preview's lower-frequency
"what will the reader see" check.

### Runtime Preview

**Purpose:** answers "what will the reader actually see," continuously,
with zero interpretation required. **Why it cannot be removed:**
without a guide-free, always-current second view, a Theme Author would
have to mentally subtract their own Builder guides from Working View to
imagine the real result — an error-prone, cognitively expensive habit
this design deliberately never asks anyone to form (Mental Model §1,
"what should always remain visible"). Now the rightmost, smallest
column (Vision §4/Change History v1.1) — its lower edit-frequency role
justifies the least space, not Context Inspector.

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
the switcher and the Context Inspector together, never one without the
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
never as a dead end: a World with zero Scenes (World points at
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
two adopted at the time this Part was first written, one rejected with
reasoning, and one proposed-but-deliberately-left-open that has since
been resolved by a later document rather than by this one.

### 1. Should Canvas be demoted out of the four-way switcher? — adopted, see `docs/BUILDER_V2_VISION.md`

Canvas is Blueprint's own "lightest slice" — visited once per Scene,
almost never again (§7). This Part originally raised, but deliberately
did not adopt, removing it from the switcher entirely and replacing it
with a compact glance at the Scene's shape, leaving the switcher as
**Place · Decorations · Text** — three activities, all genuinely
recurring, all visited repeatedly while building one Scene. The
reasoning below is kept verbatim as the historical record of that
original argument; it is what `docs/BUILDER_V2_VISION.md` §0 refers to
as "left unadopted pending sign-off."

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

**Disposition: adopted.** Product sign-off has since happened —
`docs/BUILDER_V2_VISION.md` §2–§3 is that sign-off, made explicit and
permanent. Canvas is no longer a peer activity; it now lives as the
Scene Header's Scene Configuration summary, edited by selecting it the
same way any other object is (Vision §2), never by switching Working
View to a fourth activity state. Every Part above (1, 2, 3, 4, 5) has
already been updated to reflect this — "the four activities" no longer
appears anywhere in this document outside this historical note, and
the standalone Canvas wireframe (Part 3) has been retired in favor of
the Scene Header's own wireframe.

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
World.

**Against:** the pre-first-Scene stocking case (Part 1's own reasoning)
is real and would have no home at all under this model — a brand-new
World would force a Theme Author to create a throwaway Scene just to
open an overlay, which is worse than the secondary World entry point
this package already proposes.

**Disposition:** Part 1's resolution (secondary entry from World,
plus the overlay) stands, confirmed rather than second-guessed.

### 4. Should the permission block show all three questions, always? — considered, changed

Already resolved by adoption in Part 6: collapsed-by-default, one
summary line, expand-on-demand. The reasoning is stated there and not
repeated here.

### What Builder V2 must feel like

Every screen answers exactly one question (Part 1's own test, applied
to itself). Every activity a Theme Author repeats often (Place,
Decorations, Text) is one click away, always in the same place. Every
glanceable thing they rarely revisit (Scene Configuration, Theme
Assets, Validation/Build/Publish) costs slightly more to reach, on
purpose, because that cost is
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
- `docs/BUILDER_V2_VISION.md` — the later sign-off document this
  package has been updated to match throughout: Global Navigation's
  move to the top, the Scene Header, Canvas's demotion (Part 7, item 1),
  the three-pane workspace, and the Context Inspector rename all
  originate there, not here.

## Open questions carried forward

Genuinely unresolved, not decided by omission:

1. Everything Blueprint §16 already carried forward as Engine-level
   (Theme Settings' exact scope, Holder placeholder branding, Scene
   Template persistence, per-slot Decoration constraint vocabulary)
   remains exactly as open as it was there — nothing in this UX pass
   needed any of them resolved to proceed, which is itself a small
   confirmation that Blueprint §16 drew its boundaries correctly.
2. **Whether dragging a Place past the Scene's Safe Area should be a
   hard constraint or a soft guide** (Part 6, "Drag") — flagged there,
   not resolved here; a decision for the concrete design pass that
   follows this package. Canvas's own fate, the precondition this item
   once waited on, is now settled (`docs/BUILDER_V2_VISION.md` §2–§3),
   so this is the one remaining open item this pass surfaces.
3. **Exact column proportions for the three-pane workspace** — newly
   surfaced by `docs/BUILDER_V2_VISION.md` §4, not by this package:
   Context Inspector must be sized generously, not as a naive equal
   third, but the precise widths are explicitly left to the next
   concrete design pass.
