# Engine V2 Canon

**Status:** Canonical, finalization pass. Frozen once approved — this
document is the single source of truth for Engine V2. No Builder V2
design or implementation work may begin until this canon is signed off
(see §12, "Open Decisions for Product Sign-off" — five items remain
open; two items from the prior pass are resolved and recorded there
under "Resolved this pass").
**Scope:** The object model, ownership rules, rendering pipeline, and
universal invariants of VihuStudio's rendering engine. This document
describes the *engine* — what a Theme, a Scene, and everything inside a
Scene fundamentally *is*. It does not describe Builder V2's screens,
workflows, or UI (that design starts only after this canon freezes) and
it does not describe the Engine V1 / World Builder object model
(`docs/WORLD_BUILDER_ARCHITECTURE.md`, `docs/WORLD_PROJECT_CONTRACT.md`)
except where explicitly noted for continuity in the appendix.

---

## 0. Why this exists

Engine V1 (Representations, Layouts, Frames, Layer Packs) successfully
shipped a real Official World (Museum Gallery) end-to-end. Authoring
that World exposed the actual problem: the object model asks a Theme
Author to think in terms of four loosely-related, independently-named
objects (a Representation referencing a Layout id and a Frame id and a
Layer Pack id) rather than in terms of *one coherent thing they are
building* — a Scene. Engine V2 is not a Builder redesign; it is a
correction to the object model itself, so that everything a Theme
Author touches is reachable by walking one tree: **Theme → Scene →
Canvas / Holder / Layer → Element.**

---

## 1. Philosophy

VihuStudio is not a graphic design application. It is a tool for
**preserving and beautifying authentic creations.**

Two roles, never confused with each other:

- **Theme Authors** design experiences. They think about composition,
  hierarchy, decoration, and restraint.
- **Story Authors** tell stories. They think about their photo, their
  words, their memory.

A Story Author is never handed a blank page and never asked to make a
design decision the Theme Author didn't already make for them. Every
Scene a Story Author encounters is already a complete, curated
experience — their only job is to drop their own content into the slot
the Theme Author built for it, and to adjust whatever the Theme Author
explicitly chose to leave adjustable.

This one sentence is the test every future feature must pass: **does
this ask the Story Author to design, or only to contribute?** If it
asks them to design, it belongs to the Theme Author's tools, not the
Story Author's.

---

## 2. Object hierarchy

```
Theme
├── Theme Settings
├── Theme Assets
└── Scene (1..N)
     ├── Canvas (exactly 1)
     ├── Holder (0..N)
     └── Layer (0..N)  — "Scene Layers", owned by Canvas

Canvas
└── owns Scene Layers (0..N)

Holder                                    (also a Container)
└── owns Holder Layers (1..N)
     └── exactly one is the reserved Content Layer

Layer (Scene Layer or Holder Layer)
└── owns Elements (0..N)

Element
└── leaf node — the only thing a person actually selects and edits
```

**Read this tree literally.** A Scene has exactly one Canvas, any
number of Holders, and any number of Layers. Canvas and Holder are both
*Containers* — the only two container types in the engine. A Layer is
not a container in the same sense: it groups and orders Elements, but
carries no visual properties itself (§7). Everything that actually
paints pixels is an Element.

---

## 3. Ownership

Ownership answers one question for every object: **whose Layer Stack
is this object positioned in?**

- **Canvas owns Scene Layers.** Scene Layers are the Elements that sit
  directly on the Scene's coordinate frame — background, decorations,
  foreground chrome. Canvas itself owns no Elements directly; it only
  owns the Layers that own them.
- **Holder owns Holder Layers.** A Holder is a self-contained container
  with its own internal Layer Stack, independent of Canvas's. This is
  what lets a Theme Author build a frame/mat/shadow treatment *around*
  a Story Author's photo without that treatment ever touching Canvas's
  own Scene Layers.
- **A Layer owns Elements.** This is the only place Elements live. An
  Element cannot exist outside a Layer, and belongs to exactly one
  Layer at a time (moving an Element to a different Layer is a
  re-parenting operation, not a copy).
- **A Scene Layer may be designated a Decoration Slot.** A Decoration
  Slot is an ordinary Scene Layer the Theme Author has marked as open
  for Story-Author-added decoration — see §7 for the full rule. It is
  still owned by Canvas like any other Scene Layer; nothing new is
  owned differently, only who is allowed to add Elements to it changes.
- **The Holder's Content Layer is reserved.** Every Holder has at least
  one Holder Layer, and exactly one of them is the **Content Layer** —
  the only Layer allowed to hold the Primary Element (§6). A Theme
  Author may add further Holder Layers above or below the Content Layer
  (a frame overlay above, a mat/shadow below) but may never designate a
  second Content Layer and may never let a decorative Holder Layer hold
  a second Primary Element. This is the mechanism, not just the
  intention, behind "the Holder is sacred."

---

## 4. Canvas

Canvas is the Scene's coordinate frame. It is mandatory — a Scene
without a Canvas is not a Scene.

Canvas owns:
- Scene Layers.

Canvas is responsible for:
- **Size** — the Scene's pixel dimensions.
- **Aspect Ratio** — the Scene's shape (portrait, landscape, square,
  full-bleed, …).
- **Safe Area** — the region guaranteed not to be cropped or obscured
  by chrome, independent of what's actually painted inside it.

**Canvas has no background property.** There is no
`canvas.backgroundColor` or equivalent field anywhere in this model.
What reads as "the background" is simply whatever Element occupies the
lowest position in the Scene Stack (§5) — typically a fill or image
Element in the bottom-most Scene Layer. This is a deliberate
simplification: a special-cased background field would be a second way
to do something Elements-in-Layers already do, and this engine has no
second ways to do anything.

Canvas does not carry the Base Object contract (§8) — it is
configuration (how big, what shape, what's safe), not a paintable or
selectable thing in its own right.

---

## 5. The Scene Stack — how Canvas, Holders, and Layers actually composite

The object tree in §2 lists Canvas, Holders, and Layers as three
siblings under Scene, while also saying Canvas *owns* Scene Layers.
Both are true at once, and reconciling them is the key rendering
concept in this canon:

> **Canvas owns the Scene Stack, but Canvas is not itself a member of
> it.** Canvas defines the coordinate frame; the **Scene Stack** is the
> single ordered sequence of paintable entities — Scene Layers and
> Holders together — that paints into that frame, bottom to top.

A Theme Author authoring a Scene is really doing one thing: deciding
the order of the Scene Stack. A background Scene Layer sits at the
bottom; a Holder for the Story Author's photo sits above it; a
decorative Scene Layer (a corner flourish, a title element) might sit
above that. The Holder is not nested inside a Scene Layer and a Scene
Layer is not nested inside the Holder — they are peers in one ordered
list, exactly as the object tree already shows.

Each Holder, once its turn in the Scene Stack comes up, paints its own
internal stack — its Holder Layers, bottom to top, each one's Elements
— clipped to the Holder's own Shape/Padding/Fit (§6). From the Scene
Stack's point of view a Holder is a single opaque entity with its own
nested renderer; the Scene Stack never needs to know what's inside it.

### Rendering pipeline, end to end

1. Resolve the active Theme (Theme Settings + Theme Assets already
   loaded) and the active Scene within it.
2. Establish the Canvas frame: Size, Aspect Ratio, Safe Area. Everything
   below renders into this frame; nothing below can change it.
3. Resolve the Scene Stack: the ordered list of Scene Layers and
   Holders for this Scene, as arranged by the Theme Author.
4. Paint the Scene Stack bottom to top. For each entry:
   - **Scene Layer:** paint its Elements, in that Layer's own internal
     element order, skipping any Element or the whole Layer if not
     `visible` (§8).
   - **Holder:** paint its internal Holder Layer stack bottom to top
     the same way, then clip the result to the Holder's Shape and
     inset it by Padding, per Fit; skip entirely if the Holder itself
     is not `visible`.
5. `visible` is the only Base Object property that affects step 4's
   output. `editable`, `moveable`, and `clickable` affect nothing about
   the rendered pixels — they only govern what an *editing* surface
   (Theme Builder or a future Story Author editing view) lets the
   current user do to that object. A published/reader render has no
   editing surface, so those three properties are simply inert there.

---

## 6. Holder

A Holder is a Container whose entire purpose is to present **exactly
one authentic user creation.** This is the one rule everything else in
this section exists to protect: **the Holder is sacred.**

Theme Author controls, per Holder:
- **Position** — where it sits in the Canvas's coordinate space.
- **Size** — its footprint.
- **Shape** — the clip/mask applied to its contents (rectangle,
  rounded rectangle, circle, a custom path). This is a Holder-level
  clipping concept, distinct from a "Shape" Element (§7) a Theme Author
  might place as a decoration inside a Layer — the two share a name by
  coincidence, not by relationship.
- **Padding** — inset between the Holder's edge and its content.
- **Fit** — how the Primary Element resolves against the Holder's
  bounds (fit / fill / original size, matching the fit vocabulary
  already proven out in the current engine).

Story Author does exactly one thing to a Holder: inserts their
**Primary Element** into its Content Layer. Nothing else about a Holder
is a Story Author concept unless the Theme Author explicitly exposed a
Base Object property (§8) on the Primary Element itself (e.g. letting
them nudge its position or zoom within the fixed Holder frame).

**No AI-generated content may automatically appear inside a Holder.**
This is an engine invariant, not a UI suggestion (see Engine
Invariants, §13) — the Content Layer's only legitimate occupant is
something the Story Author actually chose or uploaded. An empty,
not-yet-filled Holder shows Engine-level placeholder chrome (an upload
prompt), which is Engine UI, not a Theme Asset and not the Primary
Element — see Open Decisions (§12) for whether that placeholder is
Theme-brandable.

---

## 7. Layers and Elements

**A Layer is a container for ordering, not a container for appearance.**
Layers are:
- transparent by default,
- ordered by their position in the owning Container's **Layer Stack**
  (this engine's name for paint order — never "z-index"),
- purely organizational,
- toggled **Show / Hide** (never "visible / hidden" as a technical
  flag name in anything Story-Author-facing).

A Layer carries no typography, no color, no border, no shadow — it has
no visual properties of its own beyond whether it's shown and where it
sits in the stack. Every visual property belongs to the **Elements**
inside it.

**Layers are not a Story Author concept.** They exist only inside
Theme Builder. A Story Author never sees a Layer Stack, never
reorders anything by "layer," and never has a reason to know Layers
exist. What they interact with is always an Element (or, inside a
Holder, the Primary Element specifically).

### Elements

Elements are what a Layer actually holds, and what a person actually
selects and edits. Known Element types:

- Text
- Image
- Shape
- Sticker
- SVG
- Video
- Audio
- *(future object types join this list without changing anything
  above it)*

Elements are the only objects with type-specific properties (§8).
Audio is the one Element type with no visual footprint — it still
belongs to a Layer for organizational grouping (e.g. "this narration
clip belongs with this page"), but it never participates in the Scene
Stack's *paint* order, only in its organizational grouping.

### Decorations and Decoration Slots

Decorations (tape, stickers, flowers, washi, corner flourishes — any
purely ornamental Element) are **Scene Elements, never Holder
Elements.** A decoration may visually overlap a Holder's photo — that's
often the point, a piece of tape appearing to pin the photo down — but
it belongs structurally to the Scene, sitting in its own position in
the Scene Stack, not inside the Holder it happens to cover:

```
Scene Stack (bottom → top)
  Background            (Scene Layer)
  Holder                (Primary Element inside)
  Decoration Slot        (Tape, Sticker, Flower — Scene Layer)
  Foreground            (Scene Layer)
```

This preserves the Holder's one hard rule without exception: **a Holder
always contains exactly one Primary Element, never more, and never a
decoration.** Positioning a Decoration Slot above the Holder in the
Scene Stack (as shown) is what lets a decoration visually cover the
photo's edge while remaining, structurally, a completely separate
object the Holder knows nothing about. A Theme Author decides where a
Decoration Slot sits in the stack like any other Scene Layer — above
the Holder for an "overlapping" look, below it for an "underlay" look,
or both if the Scene defines more than one Decoration Slot.

A **Decoration Slot is an ordinary Scene Layer**, with exactly one
difference from any other Scene Layer: the Theme Author has marked it
as open for the Story Author to add and remove decorative Elements
into, sourced only from:

- **Theme Decoration Packs** — decorations that ship with this
  specific Theme, curated to match its look.
- **Personal Decoration Packs** — a decoration catalog that isn't tied
  to any one Theme (see Open Decisions, item 6, for exactly what
  "personal" means here).

A Story Author never creates a Decoration Slot and never chooses which
Scene Layer is one — the Theme Author already decided that when
authoring the Scene. The Story Author's whole experience is "add a
decoration, pick where it goes" from a curated set; the fact that this
writes into a specific, pre-designated Scene Layer is invisible to
them, consistent with Layers never being a Story Author concept.

> **Confirmed — "Frame Layer."** An earlier working example described
> "Frame Layer" as if Frame were a Layer subtype with its own
> Border/Shadow/Mat properties. That would contradict this section's
> own rule that Layers carry no visual properties. Product has since
> confirmed the resolution this canon already proposed: **Frame is a
> Theme Asset, and becomes a Frame *Element*** — placed inside a Holder
> Layer like any other Element — carrying Border/Shadow/Mat as its own
> type-specific properties. "Frame Layer" was informal shorthand for
> "the Holder Layer that holds the Frame Element," not a distinct
> object type. See §9 for the full placement workflow.

---

## 8. Universal object behaviour (the Base Object contract)

Every Element and every Holder — and only Elements and Holders —
inherit exactly four independent, freely-combinable boolean properties:

| Property | Means |
|---|---|
| `editable` | The object's type-specific properties (Typography, Crop, Border, …) are exposed to whoever is currently editing. This is a **gate**, not a property with its own behavior — turning it off hides the entire type-specific panel; it doesn't itself do anything visual. |
| `moveable` | Position can change (drag, or Theme-provided directional controls). |
| `visible` | Show / Hide. The only one of the four that affects the actual rendered output (§5). |
| `clickable` | The object participates in pointer/tap interaction — selection today; richer bindings (tap-to-flip, tap-to-play) are a future extension of this same flag, not a new one. |

These four are independent: an object can be `moveable` but not
`editable` (a Story Author can reposition a sticker but not recolor it),
`visible` but not `clickable` (decoration nobody can select), and so on.
The Theme Author sets the starting value of all four for every object a
Story Author will ever encounter; nothing defaults to "wide open."

Three kinds of object explicitly sit **outside** this contract —
naming them is the refinement this section exists to make precise:

- **Canvas carries none of the four.** It is configuration (how big,
  what shape, what's safe), not a paintable or selectable object. There
  is no `canvas.editable`; asking whether Canvas is "editable" is a
  category error, not a "false."
- **A Layer is not a Base Object at all.** It does not inherit
  `editable`, `moveable`, `visible`, or `clickable` — it has exactly
  one property of its own, **Show/Hide**, which is a separate, simpler
  mechanism reserved for Theme Author authoring convenience, not a
  member of this four-property contract. A Layer's position in the
  Layer Stack is set once, by the Theme Author, during authoring; it
  is never a Story-Author-facing "moveable" concept, and a Layer is
  never independently clickable or editable — only the Elements inside
  it are.
- **A Theme Asset carries none of the four until it is placed.** Before
  placement it is library material, not yet an object in any Scene —
  there is nothing to make editable, move, show, or click. The instant
  it is placed into a Layer it becomes an Element (§9) and only then
  does the full Base Object contract apply to it, exactly as it would
  to any other Element of that type.

Object-specific properties, gated by `editable`, belong to the object's
*type*, never to the engine's universal contract:

- Text → Typography, Colour, Alignment
- Image → Crop, Fit, Rotation
- Frame Element → Border, Shadow, Mat
- *(every future Element type adds its own list here, in its own type
  definition — never in this section)*

---

## 9. Theme Assets

Theme Assets are raw material — never rendered directly, never
themselves part of a Scene, until placed.

Categories:
- Frames
- Decorations (including Stickers — Sticker is a listed Element type,
  so a Sticker Theme Asset is what becomes a Sticker Element once
  placed)
- Textures
- Fonts
- Icons
- Patterns

Two different *sources* supply Theme Assets, and the distinction
matters because it decides who's allowed to place them (§10):

- **Theme Decoration Packs** — authored by the Theme Author, scoped to
  one Theme, matched to its look. Placement (into any Layer) is a
  Theme-authoring-time act only.
- **Personal Decoration Packs** — a decoration catalog not tied to any
  one Theme (see Open Decisions, item 6, for exactly what "personal"
  means). A Story Author may draw from this catalog too, but only into
  a Decoration Slot (§7) — never into a Holder, never into an arbitrary
  Scene Layer.

**A Theme Asset becomes an Element the moment it is placed into a
Layer.** Before that moment it is inert library material; a Theme
Author browses it the way they'd browse a sticker sheet, not the way
they'd inspect an already-placed object. Once placed, it stops being
"a Theme Asset that happens to be visible" and becomes an ordinary
Element like any other, subject to the full Base Object contract (§8)
and whatever type-specific properties its Element type defines.

### Frame Resolution

Frame is the clearest example of "Theme Asset becomes Element" in
practice, and is worth walking through explicitly since an earlier
working draft blurred it (§7):

```
Theme Asset (Frame)
      ↓  placed into a Holder Layer
Frame Element
      ↓
Rendered — Border / Shadow / Mat are this Element's own
           type-specific properties, never the Layer's
```

Frame is never a Layer subtype and never a property of the Holder
itself — it is an ordinary Element, subject to the same placement rule
as every other Theme Asset.

---

## 10. Author roles

**Theme Author** creates:
- Scenes (from Engine Scene Templates — never from a blank Canvas)
- Canvas configuration (Size, Aspect Ratio, Safe Area) per Scene
- Holders (Position, Size, Shape, Padding, Fit)
- Layers (Scene Layers and Holder Layers, their Layer Stack order)
- Theme Assets, and their placement into Layers as Elements
- The Base Object permission profile (`editable`/`moveable`/`visible`/
  `clickable`) for every object a Story Author will later encounter

**Story Author** never sees:
- Layers
- The Layer Stack
- Any Engine-level construct or vocabulary

**Story Author** never designs a Scene — they personalize one. They may:

1. Populate a Holder with their own original Primary Element.
2. Modify a Theme-provided Element, only where the Theme Author has
   explicitly left it `editable`/`moveable` (§8) — nothing more,
   nothing the Theme Author didn't explicitly leave open.
3. Add decorative Elements into a Decoration Slot (§7), drawn only from
   Theme Decoration Packs or Personal Decoration Packs (§9).

**Story Author may not:**
- create a Holder
- create a Layer (including a Decoration Slot — they add *into* one the
  Theme Author already designated, never designate one themselves)
- modify Canvas
- alter Scene structure
- reorder the Scene Stack

### Scene creation always starts from an Engine Scene Template

A Theme Author never starts a new Scene from an empty Canvas. They
choose an **Engine Scene Template** — a starting scaffold, not a
persisted type:

- Single Holder
- Dual Holder
- Quote
- Cover
- Timeline
- Comic
- Gallery

A template pre-populates a default Canvas configuration, a default
Holder arrangement, and a starter Layer set. The Theme Author then
curates it — repositioning Holders, adding decoration, choosing Theme
Assets — into the Scene a Story Author will actually see. Whether the
resulting Scene keeps any lasting link back to the Template it started
from is an open decision (§12) — this canon does not assume one exists.

---

## 11. Ownership Matrix

The engine model is only complete if these four questions have a clear
answer for every object type: **Who owns it? Who edits it? Who supplies
it? Who renders it?** This table is that check, applied exhaustively.

| Object | Who owns it | Who edits it | Who supplies it | Who renders it |
|---|---|---|---|---|
| **Theme** | — (top of the tree) | Theme Author | Theme Author | Never rendered itself — its active Scene is |
| **Theme Settings** | Theme | Theme Author | Theme Author | Never rendered — configuration only |
| **Theme Assets (library)** | Theme (Theme Decoration Packs) or the cross-Theme catalog (Personal Decoration Packs, §9) | Theme Author (Theme packs); nobody edits Personal packs from inside a Theme | Theme Author authors Theme packs; the product supplies the Personal pack catalog | Never — not an Element until placed |
| **Scene** | Theme | Theme Author | Theme Author, starting from an Engine Scene Template | The rendering pipeline (whichever Scene is active) |
| **Canvas** | Scene (exactly one) | Theme Author only | Theme Author, from the Scene Template's default | Never rendered itself — it is the frame others render into |
| **Scene Stack** | Canvas | Theme Author only (Story Author may never reorder it, §10) | Theme Author | Not rendered itself — it *is* the render order |
| **Scene Layer** (ordinary) | Canvas | Theme Author only | Theme Author | Its Elements, in Scene Stack order |
| **Decoration Slot** (a marked Scene Layer) | Canvas | Theme Author designates the slot; Story Author may only add/remove decorative Elements inside it — never move it, resize it, or reorder it in the stack | Theme Author designates which Scene Layer is a slot | Its Elements, in normal Scene Stack order |
| **Holder** | Scene | Theme Author (Position/Size/Shape/Padding/Fit) — Story Author never edits Holder geometry | Theme Author, from the Scene Template's default | Its Holder Stack, clipped to Holder geometry |
| **Holder Stack** | Holder | Theme Author only | Theme Author | Not rendered itself — it *is* the Holder's internal render order |
| **Content Layer** (the reserved Holder Layer) | Holder (exactly one) | Its existence/position is fixed by the Theme Author; its one Element (the Primary Element) is supplied and, within Theme-allowed bounds, adjusted by the Story Author | Story Author supplies the Primary Element; Theme Author supplies the Content Layer itself | Its one Element, clipped to Holder geometry |
| **Holder Layer** (decorative, non-Content) | Holder | Theme Author only | Theme Author, from Theme Assets | Inside the Holder's own stack |
| **Element — Primary Element** | Content Layer | Story Author (their own content), plus whatever the Theme Author left `editable`/`moveable` (crop, position, zoom) | Story Author uploads/chooses it | As part of the Holder Stack |
| **Element — Theme-placed** (frame, background fill, title text, …) | Whichever Layer the Theme Author placed it in | Theme Author always; Story Author only if that Element's `editable` is left on | Theme Author, from Theme Assets | Wherever its owning Layer sits in whichever stack it's in |
| **Element — Story-added decoration** | A Decoration Slot (a Scene Layer) | Story Author (add/remove/reposition, within whatever bounds the Theme Author set for that Decoration Slot) | Story Author, choosing from Theme or Personal Decoration Packs | In the Decoration Slot's position in the Scene Stack |

If any future object type can't fill in all four columns without a
paragraph of caveats, that object isn't ready for the engine yet —
that ambiguity means an ownership question got skipped, not that this
table is too rigid.

---

## 12. Open Decisions for Product Sign-off

These are the places this canon made a deliberate call rather than
finding one obvious answer in the brief that founded it. Each is a real
product decision, not an implementation detail — resolve them before
Builder V2 design begins, since each one changes what Builder V2 needs
to expose.

1. **What exactly is a "Personal Decoration Pack"?** (§9, §11) Two
   readings are both consistent with everything specified so far, and
   they have very different implications: (a) a **per-account personal
   collection** — decorations *this specific Story Author* has
   uploaded or favorited, which implies accounts/identity the rest of
   this product line may not currently require, or (b) a **shared,
   cross-Theme catalog** — functionally a rename of Engine V1's
   existing product-wide Sticker Library (`js/stickerLibrary.js`),
   just no longer scoped to one Theme. This canon does not assume
   either reading; Builder V2 cannot design a "Personal Decoration
   Pack" UI until this is picked.
2. **Do Scenes remember which Engine Scene Template they were created
   from?** A persisted link would enable a future "swap template" or
   "reset to template" tool; no persisted link keeps the Template
   purely a one-time scaffold, simpler but less flexible later. This
   canon assumes no persisted link (§10).
3. **Is a Holder's empty-state placeholder Theme-brandable, or fixed
   generic Engine chrome?** (§6). A fixed placeholder is simpler and
   guarantees it's never mistaken for Theme Asset content; a
   Theme-brandable one lets Theme Authors keep visual consistency in
   the unfilled state. This canon assumes fixed generic chrome.
4. **Does Theme Settings need anything defined now**, or does it stay
   an intentionally empty placeholder (name/description/category-style
   metadata, by analogy with Engine V1's Theme manifest) until a
   concrete Builder V2 screen needs it? This canon takes no position —
   Theme Settings is named in §2 as a sibling of Theme Assets and
   Scenes and left otherwise undefined on purpose.
5. **Can a Decoration Slot's Story-Author-facing bounds be constrained
   per-slot** (e.g. "stickers only, no text decorations," or "at most
   3 decorations")? Nothing in this canon prevents it, but nothing
   defines the constraint vocabulary either — left for Builder V2 to
   surface once this canon freezes.

### Resolved this pass (no longer open)

- ~~Can a Story Author ever place a brand-new Element themselves?~~ —
  **Resolved: yes, but narrowly.** Only decorative Elements, only into
  a Theme-Author-designated Decoration Slot, only from Theme or
  Personal Decoration Packs (§7, §9, §10). They may never place a
  Text/Image/Shape/etc. Element anywhere else, never create a Layer or
  Holder to hold one.
- ~~Is "Frame is a Layer subtype" or "Frame is an Element" correct?~~ —
  **Resolved: Frame is a Theme Asset that becomes an Element**, exactly
  like every other Theme Asset (§7, §9). Confirmed, not just proposed.

---

## 13. Engine Invariants

Every statement below must hold for every Theme, every Scene, every
object, with no exceptions carved out later. If a future feature would
require breaking one of these, the feature is wrong, or this list is —
either way, that's a canon discussion, not a quiet workaround.

**Theme and Scene**
1. A Theme is a curated library of Scenes.
2. A Scene is a complete, authored experience.
3. A Story Author never starts from a blank Scene — every Scene they
   encounter was already fully authored by a Theme Author.
4. A Scene is always created from an Engine Scene Template, never from
   a blank Canvas.

**Canvas and the Scene Stack**
5. Every Scene owns exactly one Canvas.
6. Canvas owns the Scene Stack; Canvas is never itself a member of it.
7. The Scene Stack contains Scene Layers and Holders, interleaved,
   bottom to top.
8. Canvas has no background property — the visual background is
   whatever Element occupies the lowest Scene Stack position.

**Holder**
9. Every Holder owns an independent Holder Stack, clipped by that
   Holder's own geometry.
10. Every Holder presents exactly one Primary Element.
11. The Holder is sacred: no AI-generated content may automatically
    appear inside it — its Content Layer's only legitimate occupant is
    something the Story Author actually chose or uploaded.
12. A Holder's Content Layer is reserved — only it may hold the Primary
    Element, and exactly one exists per Holder.
13. Decorations are Scene Elements and never belong to a Holder, even
    when they visually overlap one.

**Layers and Elements**
14. Containers (Canvas, Holder) own Layers; a Layer owns Elements.
15. Layers are transparent by default and carry no visual properties of
    their own.
16. Layers organize; Elements render.
17. Every Element belongs to exactly one Layer.
18. A Theme Asset becomes an Element only after being placed into a
    Layer — never before.
19. Frame is a Theme Asset, not a Layer subtype; it becomes a Frame
    Element like any other placed asset.

**The Base Object contract**
20. Only Elements and Holders carry `editable`/`moveable`/`visible`/
    `clickable`. Canvas carries none of the four; a Layer carries none
    of the four (only its own separate Show/Hide); a Theme Asset
    carries none of the four until placed.
21. The four Base Object properties are independent and freely
    combinable. `editable` gates exposure of an object's type-specific
    properties — it is not itself a visual property.
22. `visible` is the only Base Object property that affects rendered
    output. `editable`/`moveable`/`clickable` govern editing-surface
    affordances only and are inert in a published/reader render.

**Authoring boundaries**
23. A Story Author may add a decorative Element only into a
    Theme-Author-designated Decoration Slot, sourced only from a Theme
    or Personal Decoration Pack — never anywhere else, and never by
    creating a new Layer or Holder to hold one.
24. A Story Author may never create a Holder or a Layer, modify Canvas,
    alter Scene structure, or reorder the Scene Stack.

---

## Appendix — where Engine V1 concepts land, if anywhere

Informative only. Nothing here binds Engine V2 design; it exists so the
mapping is visible and nothing feels silently discarded.

| Engine V1 | Engine V2 |
|---|---|
| Representation (Showcase/Portrait/Quote, referencing a Layout id + Frame id + Layer Pack id) | A Scene, authored directly — Canvas + Holders + Layers in one object, no cross-references between separately-named parts |
| Layout (aspect, composition, padding, spacing, alignment, caption position) | Canvas (Size, Aspect Ratio, Safe Area) + Holder placement (Position, Size, Shape, Padding, Fit) — authored per-Scene, not a separately reusable object |
| Frame (mat, border, wall tone, shadow) | A Frame Element, placed into a Holder Layer like any other Element (§7) |
| Layer Pack (a named, reusable set of caption/decoration layers shared across Representations) | Layers belonging directly to their Scene; no cross-Scene reuse is assumed in this foundation (a future Theme-level preset system is possible, but not part of V2's starting model) |
| Sticker Library (`js/stickerLibrary.js`, a product-wide catalog spanning every Theme) | Likely continuity for **Personal Decoration Packs** (§9) — probably the same cross-Theme catalog, renamed to fit V2's vocabulary, rather than a new capability. Not confirmed; see Open Decisions, item 1. |

---

## Terminology

Use the left column everywhere a Theme Author or Story Author might
see it. The right column is implementation vocabulary that must never
leak into product-facing copy.

| Say | Never | Say | Never |
|---|---|---|---|
| Scene | Slide | Theme Assets | Asset Library |
| Layer Stack | z-index | Show / Hide | Visible / Hidden |
| Holder | — | Canvas | — |
| Primary Element | — | Engine Scene Template | — |

---

## Related documents

`docs/ENGINE_V2_SCENE_MODEL.md` — written once Builder V2's Scene
Editor (Place/Decorations/Text) was fully implemented and exposed a gap
this canon does not itself close: this canon defines the *object
model*; it does not specify a serialized shape, a Runtime rendering
path, or how Validation/Build/Publish would consume one. That document
formalizes the canonical Scene data shape Builder V2 already produces
and the execution pipeline it would flow through — additive to this
canon, not a revision of it.
