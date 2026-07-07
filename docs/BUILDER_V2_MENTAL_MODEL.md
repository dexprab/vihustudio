# Builder V2 — Theme Author Mental Model

**Status:** Draft derivation, pending review. This is the required
first step before any Builder V2 screen, layout, or wireframe is
designed — nothing past §7 exists yet, and nothing here should be read
as final until the open questions in §8 are answered. Read
`docs/ENGINE_V2_CANON.md` first; everything below derives from it.
**Scope:** How a Theme Author should be able to *think* about building
a World, derived from the Engine V2 object model rather than designed
independently of it. This document does not describe screens, visual
design, or implementation — those come only after this derivation is
accepted. Builder V1's workspace (`docs/WORLD_BUILDER_ARCHITECTURE.md`)
is referenced only for ergonomics lessons worth keeping (region layout,
resize behavior, save-state feedback), never for its object model,
which Engine V2 replaces outright.

Worked in the required order: mental model → editing-slice hypothesis
→ information architecture → workspace layout → navigation → editing
workflow → paper wireframes.

---

## 1. The Theme Author's mental model, derived from Engine V2

The Engine models ownership, rendering, persistence, and runtime
behaviour. None of that is what a Theme Author holds in their head
while working. Walking the Engine tree object by object and asking "how
would a person who is *not* thinking about rendering describe this?"
produces a much smaller, much more human set of ideas:

| Engine object | What the Engine models | What a Theme Author actually thinks |
|---|---|---|
| Theme | The root container | "My World" |
| Theme Settings | Configuration | "What my World is called and about" |
| Theme Assets | A placement-ready resource library | "My shelf of frames, stickers, textures, fonts" |
| Scene | A complete authored experience | "One page-type a story can use" — e.g. "the cover," "a photo spread," "a quote page" |
| Canvas | Coordinate frame, size, aspect, safe area | "What shape is this page" — decided early, rarely revisited |
| Holder | A container presenting exactly one Primary Element | "Where the child's photo goes" |
| Scene Layer / Decoration Slot | Paint-order bookkeeping | *(never surfaced — see below)* |
| Holder Layer / Content Layer | Paint-order bookkeeping inside a Holder | *(never surfaced — see below)* |
| Element (Text/Image/Shape/Sticker/…) | The renderable leaf | "This sticker," "this caption," "the photo itself" — always referred to by *type*, never by the generic word "Element" |
| Base Object contract | editable/moveable/visible/clickable | "What can the Story Author do with this" — a refinement question asked *after* something looks right, never while first placing it |

Four points fall out of this table directly:

1. **A Theme is a collection you curate, not a document you fill in.**
   The Museum Gallery exercise's own conclusion — "a Theme is a curated
   library of Scenes" — is the load-bearing idea. A Theme Author's
   primary, recurring activity is not "editing a form," it's "building
   up a small library of page-types."
2. **The Holder deserves permanent visual priority.** It is the entire
   reason the product exists ("preserve and beautify authentic
   creations" — Engine Canon §1). Whatever Builder V2 looks like, the
   place where the real photo goes should never disappear from view
   while a Theme Author is doing something else to the same Scene.
3. **Permissions are a refinement pass, not a creative activity.** No
   real Theme Author starts by deciding what's editable — they build
   the experience first, then decide what a Story Author is allowed to
   touch. This should shape information architecture directly:
   permissions are never a top-level destination, only a per-object
   detail surfaced wherever that object is already selected.
4. **Stacking order is a side-effect a Theme Author observes, not a
   panel they open.** Nobody naturally thinks "I would like to open my
   Layer Stack." They think "put this behind that" while looking at two
   things that already exist. This has a direct navigation
   consequence, below.

### What should always remain visible

The Scene, rendered as a whole — because composing a Scene is a
spatial, visual task, not a form-filling one, and because the Holder
(point 2, above) must never vanish from sight just because a Theme
Author switched to decorating or writing text. This is the single
strongest argument for keeping something like Builder V1's permanently
visible rendered view (validated the hard way across six Builder V1
polish sprints) rather than replacing it with a form-first layout.

### What should disappear until needed

Any object's fine-grained, type-specific properties (Typography detail,
Border/Shadow/Mat, Crop) — these only matter once that specific object
is selected, and permanently reserving screen space for them when
nothing is selected is exactly the "long generic inspector" this phase
was asked to avoid.

### Which Engine concepts stay completely invisible

Not just to the Story Author (Engine Canon §10 already guarantees
that) — to the **Theme Author too**, even though the Engine Canon
allows Layers to exist "inside Theme Builder":

- **Layer / Layer Stack** — never named, never a navigable list, never
  a panel. A Theme Author manipulates objects directly (drag to
  reposition; a front/back control on the selected object); the
  Builder decides which Layer that implies and reorders it silently.
  This is a Builder-only decision — the Engine still requires every
  Element to live in a Layer (Engine Canon §3, §7); Builder V2 simply
  never asks the Theme Author to manage that fact directly.
- **Scene Stack / Holder Stack** — same treatment. Their effect (paint
  order) is fully covered by "bring forward / send backward" on
  whatever's selected — a real Builder verb, not a Stack panel.
- **Content Layer** — fully invisible. A Theme Author sees "the
  Holder"; the reserved Content Layer inside it is pure Engine
  bookkeeping (Engine Canon §3).
- **"Base Object contract," "editable/moveable/visible/clickable" as
  property names** — the underlying four concepts stay (§10 below
  covers exactly how), but never under those names or as a bundled
  four-checkbox block. Each surfaces as its own plain, contextual
  toggle in whatever language fits the object ("Story Author can move
  this photo," not "moveable: true").
- **"Theme Asset becomes an Element on placement"** — invisible.
  Dragging a sticker from the shelf onto a Scene simply *works*; the
  Theme Author never needs to know that a state transition happened
  underneath.
- **The generic noun "Element"** — reserved for this document and the
  Engine Canon. Builder V2 copy always names the specific type: photo,
  sticker, caption, frame.

---

## 2. Validating the editing-slice hypothesis

The working hypothesis: Builder-only "editing slices" (Canvas, Holders,
Decorations, Text, Effects) that the Working View focuses on one at a
time, while Runtime Preview always shows the whole Scene. This is a
good instinct — it matches point 4 above (organize around creative
*activities*, not rendering structures) — but two parts of it don't
survive scrutiny as stated, and one real activity is missing.

### "Effects" does not survive as its own slice

Asking what would live inside an "Effects" slice surfaces the problem
immediately: Border/Shadow/Mat belong to a Frame; typographic effects
belong to Text; a filter belongs to an Image. Every candidate for
"Effects" is already a type-specific property of an object that
already lives in another slice (Engine Canon §8 — object-specific
properties belong to the object's *type*, never to a separate bucket).
A standalone "Effects" slice would necessarily become exactly the
generic inspector this phase was asked to avoid, collecting unrelated
properties from unrelated object types into one screen because they're
all vaguely "visual." **Dropped.** Effects live inside whichever
slice's property editor already owns that object.

### Permissions are not a slice

Per §1, point 3: nothing a Theme Author does with permissions is a
creative activity of its own — it is a refinement attached to whatever
is already selected. Making it a fifth slice would put a
non-activity next to four real activities, and would separate a
decision ("can the Story Author move this photo?") from the object it
describes, forcing a context switch to answer a question about
something already on screen. **Not a slice.** Instead: every slice's
property editor, whenever something is selected, ends with the same
small, consistent block — what the Story Author may do with *this*
object. One mechanism, reused everywhere, never a destination of its
own.

### Canvas is real, but lower-frequency than the other three

Canvas (size, aspect ratio, safe area) is a genuine slice — it needs
its own property editor, distinct from Holders/Decorations/Text — but
it is typically visited once, right after a Scene is created from its
Engine Scene Template (which already pre-fills a default), and rarely
touched again. Holders/Decorations/Text are each visited repeatedly
while building out one Scene. This doesn't remove Canvas as a slice,
but it means the workspace shouldn't imply all four slices are equally
likely to be revisited — Canvas naturally comes first in an ordered
switcher and is the one most often left alone after the first visit.

### A missing activity: Scene identity does not belong inside the Scene editor at all

The hypothesis's four slices are all about a Scene's *visual content*.
But a Scene also has a name, and arguably a short description or
thumbnail — none of which is Canvas, a Holder, a Decoration, or Text.
Rather than inventing a fifth in-Scene slice for this, the cleaner
answer is that **Scene identity belongs to the Scene Library, not the
Scene editor** — you name a Scene the moment you create or rename it in
the list of Scenes (§3), the same way a book's table of contents names
a chapter without that naming happening "inside" the chapter. This
keeps the in-Scene slices purely about visual composition.

### Genuinely unresolved, not force-fit: Video, Audio, Shape, SVG

Shape and SVG are ornamental non-content Elements — placing one is the
same creative activity as placing a sticker, so they belong under
Decorations without needing their own slice. Video and Audio don't fit
cleanly anywhere yet: a video might one day be an alternate Primary
Element inside a Holder, and audio is Scene-scoped narration with no
visual footprint at all (Engine Canon §7). Neither has an authoring
story defined by the Engine Canon today. **This document does not
force an answer** — it's flagged in §8 as a real gap, to be designed
when Video/Audio authoring actually becomes a requirement, not
speculatively now.

### Conclusion: four slices, validated and slightly redefined

**Canvas · Holders · Decorations · Text** — each a real, recurring
creative activity; each Builder-only (no Engine object named
"editing slice" exists, and none should); each with its own
property editor; each ending, when something is selected, in the same
small Story-Author-permission block. Effects and Permissions are
removed as candidate slices; Scene identity moves out of the Scene
editor entirely.

---

## 3. Builder information architecture

Derived directly from §1 and §2 — the collection-of-Scenes discovery
sets the top level, and the validated four slices set what happens once
a Scene is opened:

```
World
├── Overview                     (World identity — name, description,
│                                 category; the natural home for
│                                 whatever Theme Settings turns out to
│                                 contain — Engine Canon §12 leaves this
│                                 open, so Builder V2 doesn't force it
│                                 either)
├── Scenes                       (the curated library itself — add,
│   │                             rename, duplicate, remove, reorder;
│   │                             this is where a Scene gets its name)
│   └── (a Scene, selected)      → opens the Scene editor:
│         ├── Canvas
│         ├── Holders
│         ├── Decorations
│         └── Text
├── Theme Assets                 (the shared shelf — Frames,
│                                 Decorations, Textures, Fonts, Icons,
│                                 Patterns; stocked once, drawn from
│                                 repeatedly while decorating Scenes)
├── Validation
├── Build
└── Publish
```

Validation/Build/Publish are unchanged in *kind* from Builder V1 — they
are process stages (does this compile, package it, ship it), not
creative activities, so nothing about the Engine V2 object model
requires rethinking them from scratch. What they check and package
changes (Scenes, not Representations/Layouts/Frames/Layer Packs); their
place in the Builder's architecture does not.

Two deliberate omissions, both already justified above: there is no
top-level "Permissions" destination (§2) and no Scene-identity screen
nested inside the Scene editor (§2) — identity lives in the Scenes
list, permissions live wherever the object they describe is selected.

---

## 4. Workspace layout, derived

Two different screens fall out of the IA, not one:

**A. World-level screens** (Overview, Scenes, Theme Assets, Validation,
Build, Publish) — list-and-detail surfaces. A Theme Author is managing
a collection here (Scenes, or Theme Assets), not looking at a rendered
page. These don't need a permanently visible Scene render at all.

**B. The Scene editor** (only once a Scene is selected) — this is where
§1's "the Scene must stay visible regardless of activity" rule applies,
and where Builder V1's proven three-region skeleton (Nav / Working
View + Runtime Preview / Property Editor — hard-won across six polish
sprints, `docs/WORLD_BUILDER_ARCHITECTURE.md`) is worth keeping as
*ergonomics*, even though everything it now displays comes from Engine
V2, not Engine V1:

- **Working View** — renders the current Scene, with Builder-only
  guide overlays scoped to whichever slice is active (e.g. Holder
  bounding boxes and a resize handle while in the Holders slice;
  nothing extra while in the Text slice beyond the selected caption's
  own handles). Never a second rendering implementation — the same
  render Runtime Preview uses, with a guide layer drawn on top, exactly
  as Builder V1 already proved out.
- **Runtime Preview** — always the clean, complete Scene, no guides,
  answering "what will the reader see" regardless of which slice is
  active. This is the one surface that should look identical whichever
  slice the Theme Author is in — it exists specifically so switching
  slices never causes anxiety about what got hidden.
- **Property Editor** — context-aware to the current slice and
  selection (per §2's conclusion), ending in the shared permission
  block whenever something is selected.
- **A slice switcher** — a small, scoped control that only exists once
  inside a Scene (Canvas · Holders · Decorations · Text), not a
  permanent item in the World-level navigation list (§5).

---

## 5. Navigation, derived

Two levels, matching the two screen kinds in §4:

- **World-level navigation** (always present while a World is open):
  Overview, Scenes, Theme Assets, Validation, Build, Publish — six
  fixed destinations, each a real, distinct kind of work, none of them
  "Layers" or any other Engine-internal concept.
- **In-Scene slice switcher** (only present once a Scene is open, and
  only replaces/augments the Working View's focus — it is not a
  detour to a different screen): Canvas, Holders, Decorations, Text.

Selecting a Scene from the Scenes list is a mode transition, not a
navigation-list item: the World-level nav stays where it is (so
"back to Scenes" is always one click away), and the workspace's center
region becomes the Scene editor described in §4. This is exactly the
Navigation Philosophy's own example — World → Overview → Scenes →
Selected Scene — with "Selected Scene" resolving to the four-slice
editor rather than a fifth World-level nav item.

---

## 6. Editing workflow, derived

The sequence a Theme Author actually moves through, start to finish:

1. **Create a World.** Name it, describe it (Overview) — done once,
   revisited rarely.
2. **Add a Scene.** Choose an Engine Scene Template (Single Holder,
   Dual Holder, Quote, Cover, Timeline, Comic, Gallery — Engine Canon
   §10); the template pre-fills a default Canvas and Holder
   arrangement, so the Theme Author starts curating, never blank.
3. **Confirm or adjust Canvas** — usually a quick check, occasionally a
   real change (e.g. switching a template's default aspect ratio).
   Visited once per Scene, rarely again.
4. **Arrange Holders** — position/size/shape the photo area(s). For a
   Single Holder template this is nearly already done by the template;
   for Dual Holder or Gallery this is where the real composition
   decisions happen.
5. **Decorate** — pull Frames, textures, stickers, backgrounds from
   Theme Assets onto the Scene. The most exploratory, "creative fun"
   part of the workflow, and the one most likely to loop back to step
   4 (a decoration changes how much room a Holder should have).
6. **Add Text** — captions, titles, a quote's own words.
7. **Refine permissions, per object, as an afterthought** — while still
   in whichever slice that object lives in, not a separate pass through
   a permissions screen.
8. **Repeat 2–7 for the next Scene** — building out the Theme's curated
   library.
9. **Stock Theme Assets** as needed — this can happen before decorating
   (pre-loading a shelf) or opportunistically mid-Scene (realizing a
   needed sticker doesn't exist yet and adding it), so Theme Assets
   should be reachable without losing Scene-editing context, not only
   as a separate destination visited in strict order.
10. **Validate → Build → Publish** once the library feels complete.

---

## 7. Paper wireframes

Box-and-arrow only — no visual design, no styling, no component
choices. These exist to confirm the regions in §4/§5 fit together, not
to specify how anything looks.

### World-level screen (e.g. Scenes)

```
┌─────────────────────────────────────────────────────────┐
│ [World name]                                    [Save●]  │  Header
├───────────┬───────────────────────────────────────────────┤
│ Overview  │                                                │
│ Scenes  ← │   Scene list — cards or rows, one per Scene   │
│ Theme     │   [+ Add Scene]  (opens Engine Scene Template  │
│  Assets   │    picker, not a blank Canvas)                │
│ Validation│                                                │
│ Build     │                                                │
│ Publish   │                                                │
└───────────┴───────────────────────────────────────────────┘
  World-level nav (§5)         List-and-detail content (§4A)
```

### Scene editor (a Scene selected from the list above)

```
┌─────────────────────────────────────────────────────────┐
│ [World name] › [Scene name]                     [Save●]  │  Header
├───────────┬───────────────────────┬───────────────────────┤
│ Overview  │  Canvas·Holders·      │                       │
│ Scenes  ← │  Decorations·Text     │   Runtime Preview     │
│ Theme     │  (slice switcher)     │   (always clean,      │
│  Assets   │ ┌───────────────────┐ │    always complete)   │
│ Validation│ │                   │ │                       │
│ Build     │ │   Working View    │ │                       │
│ Publish   │ │  (current slice,  │ │                       │
│           │ │  Builder guides)  │ │                       │
│           │ └───────────────────┘ │                       │
│           ├───────────────────────┴───────────────────────┤
│           │  Property Editor — context-aware to selection, │
│           │  ends in the shared "Story Author may…" block  │
└───────────┴─────────────────────────────────────────────────┘
```

This is deliberately the same skeleton Builder V1 proved out — the
claim being validated here is that the *regions* were never the
problem (Engine V1's object model was); nothing in this document
proposes changing Header/Nav/Working View/Runtime Preview/Property
Editor as physical regions, only what populates the nav list and what
the slice switcher/property editor expose.

---

## 8. Open questions carried forward

Not resolved here — each needs a decision (or a "not yet, revisit
later") before the region in §7 that depends on it can be finalized.

1. **Video and Audio have no authoring story yet** (§2). Neither fits
   the four validated slices. Defer until either becomes a real
   requirement rather than inventing a slice for a capability that
   doesn't exist yet.
2. **What exactly populates Overview**, beyond World name/description,
   depends on Engine Canon §12 item 4 (Theme Settings' scope) being
   resolved — Builder V2's Overview screen inherits that answer
   directly rather than pre-empting it.
3. **How a Theme Author marks a Decoration Slot as Story-Author-open**
   is proposed here as *the same shared permission block* every other
   object uses (§2) — not a separate mechanism. This needs explicit
   confirmation before the Decorations slice's property editor is
   designed, since it's the one place a Builder-level decision
   (how permission is set) meets an Engine-level concept (Decoration
   Slot) directly.
4. **Whether Theme Assets should be reachable *from inside* the Scene
   editor** (step 9 of §6 — "without losing Scene-editing context") or
   only as a separate World-level destination the Theme Author must
   navigate away to reach. This is a real UX tradeoff (a floating
   picker vs. a dedicated screen) deliberately left for the next design
   pass, once this mental model itself is accepted.
