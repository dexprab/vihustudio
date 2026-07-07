# Builder V2 Storyboard — A First-Time Theme Author's Journey

**Status:** Draft derivation, pending review — the next step after
`docs/BUILDER_V2_MENTAL_MODEL.md`, not yet a UI design. Read
`docs/ENGINE_V2_CANON.md` and `docs/BUILDER_V2_MENTAL_MODEL.md` first;
every stage below derives from them, not from imagination.
**Scope:** The complete first-time journey a Theme Author experiences,
from opening Builder V2 to publishing a World, told as a sequence of
intent — what they are trying to accomplish at each moment, what
decision that moment resolves, and what naturally follows it. This
document deliberately contains no UI detail (no widgets, no layout
pixels, no component names) — see §12 for what it implies Builder V2
must provide, which is as far as it goes. Screens and wireframes are
the next document, not this one.

Format follows `docs/STUDIO_CREATION_JOURNEY_V1.md`'s convention
(Purpose / Entry / Exit / Intent / Shown / Hidden), the closest existing
precedent for a journey document in this codebase — reused here
deliberately rather than inventing a new format.

---

## The shape of the journey

```
Stage 1  Arrival — My Worlds
     ↓
Stage 2  Name This World
     ↓
Stage 3  Add a Scene — Choose a Starting Point
     ↓
   ┌─────────────────────────────────────────────┐
   │  Stage 4  Confirm the Page's Shape           │
   │  Stage 5  Decide Where the Photo Goes        │  revisited freely,
   │  Stage 6  Decorate the Scene                 │  in any order, as
   │  Stage 7  Write the Words                    │  many times as
   │  Stage 8  Decide What a Story Author May Touch│  needed, for as
   │           (recurring, not a separate screen)  │  long as this one
   └─────────────────────────────────────────────┘  Scene is open
     ↓                              ↑
Stage 10  Grow the Library ─────────┘ (back to Stage 3 for the next Scene)
     ↓
Stage 11  Ship It — Validate → Build → Publish
```

**Stage 9, Stock the Shelf,** sits outside this vertical order on
purpose — it is reachable from Stage 3 (choosing what to decorate a new
Scene with), from Stage 6 (realizing mid-decoration that a needed
sticker doesn't exist yet), and directly from World-level navigation at
any time. It is described in its own place below, not forced into a
numbered slot in the main sequence.

---

## Stage 1 — Arrival: My Worlds

**Purpose**

Let a Theme Author see what they've already started, or start
something new, without any Engine vocabulary in the way.

**Entry criteria**

Builder V2 opens. Either no World exists yet (true first-time use) or
one or more Worlds already exist from a previous session.

**Exit criteria**

The Theme Author picks an existing World to continue, or starts a new
one. Either path leads to that World's Overview (Stage 2).

**User intent**

"Let me see what I'm already building, or let me start something new —
don't ask me anything technical yet."

**Objects shown**

- Existing Worlds, if any, each recognizable by name and identity, not
  by an internal id
- A clear way to start a new World

**Objects hidden**

- Theme Settings detail, Scenes, Theme Assets, Validation/Build/Publish
  — none of these matter yet; they only exist once a World exists
- Any Engine vocabulary (Canvas, Holder, Layer, Scene Stack)

---

## Stage 2 — Name This World

**Purpose**

Give the World an identity before there's anything inside it to
distract from that decision.

**Entry criteria**

A new World was just started (Stage 1), or an existing World's Overview
was opened directly from World-level navigation at any later point.

**Exit criteria**

The Theme Author moves on to Scenes — usually to add the first one
(Stage 3), since a brand-new World has none yet.

**User intent**

"What is this World called, what's it about, what mood is it?"

**Objects shown**

- World identity: name, description, whatever else Theme Settings
  turns out to hold (Engine Canon §12 leaves this open; Overview
  inherits that answer directly rather than guessing at it)

**Objects hidden**

- Scenes, Theme Assets, and everything Scene-editing implies (Canvas,
  Holders, Decorations, Text) — none of it exists yet for a new World,
  and none of it is needed to answer "what is this World"

---

## Stage 3 — Add a Scene: Choose a Starting Point

**Purpose**

Let the Theme Author declare what *kind* of page they're building,
using an Engine Scene Template, so they start curating instead of
staring at nothing.

**Entry criteria**

The Theme Author is looking at the World's Scene library — empty (a
brand-new World) or already holding other Scenes — and decides to add
one.

**Exit criteria**

A Template is chosen (Single Holder, Dual Holder, Quote, Cover,
Timeline, Comic, Gallery — Engine Canon §10). The new Scene opens
directly into Stage 4, already holding the Template's defaults —
never a blank Canvas (Engine Canon Invariant 4).

**User intent**

"What kind of page is this — a cover, a photo spread, a quote page —
give me a sensible starting point for it."

**Objects shown**

- The library of existing Scenes, so the new one is understood as
  joining a collection, not replacing anything
- The Template choices, each recognizable by what kind of page it makes
  (a single photo moment, two photos side by side, a quote, …), never
  by an internal template id

**Objects hidden**

- Any Engine concept behind a Template (that it pre-fills a default
  Canvas, a default Holder arrangement, a starter Layer set) — the
  Theme Author only ever sees the result, already sitting in front of
  them the moment they choose

---

## Stage 4 — Confirm the Page's Shape

**Purpose**

Settle the Scene's basic shape — usually a quick confirmation of what
the Template already chose, occasionally a real change.

**Entry criteria**

A Scene was just created (Stage 3) and this is naturally the first
thing looked at, or the Theme Author deliberately returns to an
existing Scene to change its shape later.

**Exit criteria**

The Theme Author moves to whichever of Stages 5–8 feels natural next —
there is no forced order once a Scene is open (see "The shape of the
journey," above).

**User intent**

"Is this page tall, wide, square — and is that actually right for what
I'm building?"

**Objects shown**

- The Scene's shape and proportions, at whatever size actually reads
  as "the page" — Canvas's Size/Aspect Ratio (Engine Canon §4)
- Whatever region of the page is guaranteed not to be cropped or
  covered later (Safe Area) — shown as a concept the Theme Author can
  feel ("things need to stay inside here"), never as a labeled Engine
  field

**Objects hidden**

- Scene Stack order, Layer Stack, or any paint-order concept — Canvas
  is configuration, not a stacking decision (Engine Canon §4, §8); this
  moment is purely "what shape is the page," nothing about what's on it

---

## Stage 5 — Decide Where the Photo Goes

**Purpose**

Design the spot (or spots) where a real photo will eventually live —
position, size, shape, breathing room, and how that specific spot's
picture is framed.

**Entry criteria**

A Scene is open; the Theme Author turns their attention to its
Holder(s) — usually right after confirming the page's shape (Stage 4),
since a Holder's placement depends on knowing the page's proportions
first.

**Exit criteria**

The Theme Author moves on to decorating the Scene as a whole (Stage 6),
writing text (Stage 7), or refining who may touch this Holder later
(Stage 8) — or leaves the Scene entirely, satisfied with its
composition.

**User intent**

"Where does the photo go, how big, what shape, and how is it presented
once it's there?"

**Objects shown**

- Each Holder's position, size, and shape (Engine Canon §6)
- A placeholder image standing in for whatever a Story Author will
  eventually upload — the Theme Author is designing a spot, never
  supplying its actual content themselves (Engine Canon §6, §10: the
  Primary Element is always Story-Author-supplied)
- **This Holder's own presentation** — its frame, mat, shadow. This
  belongs here, not in Stage 6: a Frame is a Theme Asset that becomes
  an Element inside *this Holder's own Holder Layer* (Engine Canon §9,
  "Frame Resolution"), so choosing how this one photo is presented is
  part of designing this Holder, not part of decorating the Scene at
  large. A Theme Author thinking "let me choose a frame for this photo"
  and "let me decide this photo spot's size" is doing one activity, not
  two — Builder V2 should treat it as one.

**Objects hidden**

- The Holder Stack, the Content Layer, or any reason the placeholder
  image sits where it does structurally — the Theme Author sees "the
  photo goes here, framed like this," never "Content Layer, index 0"

---

## Stage 6 — Decorate the Scene

**Purpose**

Dress up the Scene as a whole — background, texture, scattered
ornamentation — the part most Theme Authors will describe as "the fun
part."

**Entry criteria**

A Scene is open, its Holder(s) already have a sense of place (Stage 5
need not be finished, just started), and the Theme Author wants to
build the Scene's atmosphere.

**Exit criteria**

The Theme Author moves to writing text (Stage 7), refining a
decoration's permissions (Stage 8), back to a Holder they want to
revisit (Stage 5), or is satisfied and leaves the Scene.

**User intent**

"What does this page feel like — what's behind the photo, and what's
scattered around it?"

**Objects shown**

- The Scene's background (simply whatever sits at the bottom of the
  Scene, per Engine Canon §4 — there is no separate "background
  setting" to look for)
- Whatever has been pulled in from Theme Assets so far — textures,
  patterns, scattered decorations (tape, stickers, flowers)
- A clear way to reach Theme Assets (Stage 9) without losing this
  Scene — this storyboard's own narrative answers Open Question 4 from
  `docs/BUILDER_V2_MENTAL_MODEL.md`: decorating naturally interrupts
  itself the moment a needed sticker doesn't exist yet, so Theme Assets
  must be reachable *from here*, not only as a separate destination

**Objects hidden**

- Which specific Scene Layer any given decoration lives in, or that a
  Theme Asset "became an Element" the instant it was dropped in — both
  are pure Engine bookkeeping (Engine Canon §7, §9)

**The one real decision this stage adds**

For every decoration placed, the Theme Author makes one choice, right
there, in the same breath as placing it: **is this fixed, or can a
Story Author add their own here too?** Saying yes to the second option
is what makes that spot a Decoration Slot (Engine Canon §7) — the
Theme Author never sees or names "a Slot"; they simply say "let the
Story Author add stickers here" about a spot on the page, and Builder
V2 does the rest.

---

## Stage 7 — Write the Words

**Purpose**

Add and style whatever text this Scene needs — a title, a caption, a
quote's own words — as its own activity, distinct from arranging
photos or scattering decoration.

**Entry criteria**

A Scene is open and the Theme Author turns to its wording — this can
happen before, after, or interleaved with Stages 5 and 6; nothing about
text depends on Holders or decoration being finished first.

**Exit criteria**

The Theme Author returns to any other Stage 4–8 activity, or leaves the
Scene satisfied.

**User intent**

"What does this page say, and what should the words look like?"

**Objects shown**

- Whatever text this Scene calls for (a title, a caption, a quote),
  shown in place, on the page, not as a separate form
- How that text looks — its typography, colour, alignment (Engine
  Canon §8's per-type properties for a Text Element)

**Objects hidden**

- Which Layer the text lives in — text can legitimately sit at Scene
  level (a title) or be tied to a specific Holder (a caption); the
  Theme Author never needs to know or choose which, because "writing
  the words" reads the same regardless of where they end up

---

## Stage 8 — Decide What a Story Author May Touch

**Purpose**

Once something already looks right, decide how much of it a Story
Author is allowed to change later.

**Entry criteria**

Something is already selected — a Holder, a decoration, a piece of
text — because the Theme Author is happy enough with it to think about
its future, not because they navigated to a dedicated screen for this.

**Exit criteria**

The Theme Author returns to whatever they were doing before this
thought occurred (Stage 5, 6, or 7) — this stage never leads anywhere
else, exactly as `docs/BUILDER_V2_MENTAL_MODEL.md` §2 concluded it
shouldn't.

**User intent**

"Now that this looks right — how much of it should a Story Author be
allowed to change?"

**Objects shown**

- Whatever the currently selected object supports: can a Story Author
  move it, change it, hide it, tap it — phrased in those plain terms,
  never as `editable`/`moveable`/`visible`/`clickable` (Engine Canon
  §8)

**Objects hidden**

- Every other object's permissions — this is always about the one
  thing currently selected, never a permissions list for the whole
  Scene at once

---

## Stage 9 — Stock the Shelf (Theme Assets)

**Purpose**

Build up the World's own supply of frames, decorations, textures,
fonts, icons, and patterns (Engine Canon §9) — the material every
Scene's decorating (Stage 6) and Holder-framing (Stage 5) draws from.

**Entry criteria**

Any of: starting a new World with nothing to decorate with yet,
reaching for something mid-Scene that doesn't exist (from Stage 5 or
6), or deliberately curating the shelf as its own task from World-level
navigation.

**Exit criteria**

Whatever was added or organized is now available the next time the
Theme Author decorates a Holder or a Scene. This stage has no single
exit — it's interruptible and resumable by nature, unlike the mostly
linear Stages 1–8.

**User intent**

"What do I have to decorate with, and what's missing?"

**Objects shown**

- The shelf itself, organized by kind (frames, decorations, textures,
  fonts, icons, patterns)
- A way to add to it

**Objects hidden**

- Anything about placement — Theme Assets are inert library material
  until dropped onto a Scene (Engine Canon §9); this stage is about the
  shelf, never about a specific Scene

---

## Stage 10 — Grow the Library

**Purpose**

Step back from one Scene to the World's whole collection, and decide
whether it's complete — the literal expression of "a Theme is a curated
library of Scenes" (Engine Canon §0).

**Entry criteria**

The Theme Author leaves a Scene they consider finished, or wants to
compare Scenes side by side before deciding what's still missing.

**Exit criteria**

Either another Scene is added (back to Stage 3) or the library feels
complete and the Theme Author moves to Stage 11.

**User intent**

"Do I have enough kinds of pages yet — a cover, enough variety, a
quote page if this World needs one — or is something missing?"

**Objects shown**

- Every Scene in the World, recognizable at a glance, so gaps in the
  collection are obvious the way missing chapters are obvious in a
  table of contents

**Objects hidden**

- Any single Scene's internal detail (its Holders, its decorations) —
  this is a collection-level judgment, not an editing moment

---

## Stage 11 — Ship It: Validate → Build → Publish

**Purpose**

Turn a finished World into something Runtime can actually offer a
Story Author.

**Entry criteria**

The Theme Author considers the Scene library complete (from Stage 10).

**Exit criteria**

The World is published, or the Theme Author backs out to keep refining
Scenes (back to Stage 10) — this stage never silently fails forward.

**User intent**

"I'm done — check this is really finished, package it, and put it
where Runtime will find it."

**Objects shown**

A three-part flow, each with a single, honest purpose: *Validate* (is
anything actually missing or broken — checked against the same rules
Runtime itself enforces), *Build* (turn this into the real package
format), *Publish* (place it where Runtime will discover it, or export
it to share another way).

**Objects hidden**

- Every Scene-editing surface from Stages 3–9 — this is a distinct,
  single-purpose moment, the same principle Studio's own Publish stage
  already follows (`docs/STUDIO_CREATION_JOURNEY_V1.md`, Stage 5): it
  never asks the Theme Author to keep half-editing while also trying to
  ship

---

## 12. What this storyboard reveals about Builder V2

The instructions for this document were to derive intent first and let
the shape of Builder V2 fall out — these are the things that fell out,
none of them assumed going in:

1. **World-level navigation must never disappear once a Scene is
   open.** Every stage from 4 through 8 assumes "back to Scenes" and
   "over to Theme Assets" are always one step away — nothing in this
   journey is a full-screen detour with no way back except finishing.
2. **Stages 4–8 have no forced order.** The diagram's box around them
   is deliberate: a real Theme Author moves between Canvas, Holders,
   Decorations, and Text however the Scene currently needs, not in a
   fixed sequence a wizard would impose.
3. **Frame belongs to the Holders moment, not the Decorations
   moment** — confirmed, not just asserted, by Engine Canon §9's own
   ownership rule (a Frame Element lives in a Holder Layer). This
   storyboard is what makes that concrete: "choose this photo's frame"
   and "choose this photo's size" are one activity.
4. **Theme Assets must be reachable from inside a Scene, not only as a
   separate destination.** Stage 6 needing to reach Stage 9 mid-thought
   answers Open Question 4 from `docs/BUILDER_V2_MENTAL_MODEL.md` — the
   journey itself demands it; this document treats that as resolved in
   favor of "reachable inline," not still open.
5. **Permissions genuinely have no home screen.** Stage 8 exists as a
   *moment*, not a place — it only ever begins from something already
   selected in Stages 5–7, and it only ever leads back to where it
   started. No stage transition in this journey ever arrives at Stage 8
   from World-level navigation.
6. **The Scene library (Stage 10) is where "curated library of Scenes"
   becomes a real, felt judgment** — "is this collection complete" —
   not just an Engine Canon sentence.
7. **Shipping is categorically separate from creating.** Nothing about
   Validate/Build/Publish shares a moment with Stages 3–10; the
   transition into Stage 11 is a deliberate, singular decision ("I'm
   done"), mirrored from Studio's own proven Publish separation.

None of this is a screen yet. It is the case for what the screens, once
designed, are obligated to make true.
