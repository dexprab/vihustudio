# Engine V2 — Canonical Scene Model & Execution Pipeline

**Status:** Canonical and frozen in full — every architectural decision
this document exists to make is now resolved (the Scene Model itself,
Representation's retirement, Canvas's schema, Scene Template, and, as of
this pass, the Runtime resolution path: a **native Engine V2 Runtime**,
operating directly on the canonical Scene Model — no translation layer
to Engine V1, no permanent parallel architecture). §7's remaining items
(Holder Layers; Personal Decoration Packs) are narrower, lower-stakes
authoring questions, not blocking architecture. This is still a
**documentation-only** deliverable: nothing in this document is
implemented. It defines what Runtime, Validation, Build, and Publish
must do, and now which architecture they must be built as; it does not
build any of them.
**Scope:** The canonical, single-source-of-truth data model a Scene
compiles to — the thing Builder produces and Runtime, Validation,
Build, and Publish all consume identically, natively, with no
intermediate form — plus the execution pipeline that model flows
through. `docs/ENGINE_V2_CANON.md` defines the *object model* (Theme →
Scene → Canvas/Holder/Layer → Element, ownership, invariants); this
document defines the *serialized shape* of that model as Builder V2
already produces it, and the pipeline stages downstream of it. It does
not redesign Builder V2 (see `docs/BUILDER_V2_VISION.md`/
`BUILDER_V2_BLUEPRINT.md`, frozen, untouched by this document) and it
does not implement Runtime, Validation, Build, or Publish — see §5 and
`docs/BUILDER_V2_ENGINE_GAP.md` for the now-resolved architectural
question of what they consume and how.

---

## 0. Why this document exists

`docs/BUILDER_V2_ENGINE_GAP.md` recorded, at the end of Builder V2's
implementation phase, that Validation/Build/Publish could not be
extended to Scenes because no document defined what a compiled Engine
V2 package or Runtime rendering path looked like. That gap had two
parts, easy to conflate but genuinely separate:

1. **What is the canonical Scene data, precisely?** — this part has an
   answer already, because Builder V2 has been authoring real Scenes
   for five vertical slices now (`tools/world-builder/js/projectModel.js`).
   This document formalizes that existing, working shape as canonical —
   it is not inventing new data, only naming and specifying what
   already exists and works.
2. **What do Runtime/Validation/Build/Publish do with that data, and in
   what package format?** — the first half is now resolved (§5, §7,
   LOCK V2-04): a native Engine V2 Runtime operating directly on the
   Scene Model, not a translation layer or a permanent parallel
   architecture. The exact compiled package *format* remains
   genuinely undecided and this document does not decide it — format
   and compilation are explicitly downstream of the Scene Model, never
   the Scene Model itself (see the Constraints this document was
   commissioned under: "Do not invent compiled package formats as the
   canonical representation").

Splitting these two questions is the whole point of this document:
Builder V2 does not need to wait for package-format and Runtime
decisions to have a canonical, implementable, cross-subsystem data
model. It already has one; this document is that model, written down.

---

## 1. The canonical execution pipeline

```
Builder                    (creates and edits Worlds — tools/world-builder)
   ↓
Canonical Engine Scene Model  (World → Scene → Canvas/Holder/Layer/Element,
   │                           §2 below — the single source of truth)
   ↓
Runtime                    (renders a Scene — NOT YET IMPLEMENTED for V2)
   ↓
Validation                 (checks a Scene against this model — NOT YET IMPLEMENTED for V2)
   ↓
Build                      (compiles validated Scenes into a package — NOT YET IMPLEMENTED for V2)
   ↓
Publish                    (shares the package — NOT YET IMPLEMENTED for V2)
```

This is deliberately the same five-stage shape
`docs/WORLD_BUILDER_ARCHITECTURE.md`'s own "The pipeline" section
already uses for Engine V1 (`Builder → Project → Validation → Build →
Publish → Runtime`) — Engine V2 does not need a different-shaped
pipeline, only a different object flowing through it. The reordering
above (Runtime drawn directly beneath the Scene Model, before
Validation/Build/Publish) is deliberate, not cosmetic: it states plainly
that **Runtime consumes the Scene Model directly** — Validation/Build/
Publish are correctness and packaging stages applied *around* that
consumption, never a second, parallel model Runtime reads instead.

### Architecture Locks — Engine V2

Mirroring `docs/WORLD_BUILDER_ARCHITECTURE.md`'s own Lock convention,
extended for Engine V2's object rather than replacing the V1 locks
(which still govern the V1 pipeline running today, unchanged, per
`docs/BUILDER_V2_ENGINE_GAP.md` §5):

**LOCK V2-01 — The Scene Model is the only canonical representation.**
There is no second, Runtime-owned Scene shape and no second,
Builder-owned Scene shape. `tools/world-builder/js/projectModel.js`'s
`scenes/<id>.json` shape *is* the canonical model, not an approximation
of one defined elsewhere — §2 below documents exactly what Builder
already writes, nothing more, nothing translated.

**LOCK V2-02 — Compilation is downstream, never canonical.** A `.vtheme`
package, or any other compiled artifact, is something Build produces
*from* the Scene Model. It is never itself the source of truth, and no
future Build implementation may require data that doesn't already exist
on the canonical Scene Model — if Build needs a field the Scene Model
doesn't have, the Scene Model gains that field first, deliberately, as
a documented change to this document, not as a silent addition inside a
compiler.

**LOCK V2-03 — Runtime meaning is specified before Runtime exists.**
Every object in §2 states its intended Runtime meaning now, in this
document, even though no Runtime implementation consumes it yet. This
is deliberate sequencing, not premature detail: a future Runtime
implementation is required to satisfy what's written here, not to
invent Runtime semantics as an implementation detail nobody wrote down
first.

**LOCK V2-04 — Engine V2 is a native Runtime, resolved.**
`docs/BUILDER_V2_ENGINE_GAP.md` §4 named three possible shapes a
Runtime/Validation/Build/Publish resolution could take (a genuine V2
Runtime; a translation layer down to the existing V1 Runtime; two
permanently parallel authoring surfaces). By explicit architectural
decision, the first is chosen and the other two are rejected outright:
**Validation, Runtime, Build, and Publish will all operate directly on
the canonical Scene Model — no translation layer to Engine V1, and no
permanent parallel Runtime architecture.** Engine V1
(Representations/Layouts/Frames/Layer Packs, and the pipeline that
serves them) remains legacy — it keeps running, unmodified, for Engine
V1 data only (§6) — but it is not, and will never become, a
compatibility path Engine V2 routes through. This document was already
written to be implementable under a native Runtime (LOCK V2-01 through
V2-03 all assume direct consumption of the Scene Model); this lock only
makes that assumption binding rather than merely convenient.

---

## 2. The Canonical Engine Scene Model

Everything below is what `tools/world-builder/js/projectModel.js`
already persists today (Builder V2 Slices 1–5) — this section names and
specifies it, rather than proposing something new. Every object is
described the same way Engine Canon §11's Ownership Matrix does: Who
owns it? Who edits it? Who supplies it? Who renders it? — plus its
purpose, its lifecycle, and its serialized shape.

**The canonical Engine V2 authoring flow**, confirmed by explicit
architectural decision (see Change History) and stated here in Builder
vocabulary directly, since that vocabulary is now also the correct
Engine-level one:

```
World
  ↓
Scene
  ↓
Canvas          (Builder-facing: Scene Configuration)
  ↓
Place           (Builder-facing: Holder)
  ↓
Decoration      (a Scene Layer, kind: 'fill' | 'decoration')
  ↓
Text            (a Scene Layer, kind: 'text')
```

**Read this as authoring order, not an ownership chain.** Canvas,
Place, Decoration, and Text are siblings under Scene, not nested inside
one another — Scene owns exactly one Canvas, 0..N Holders, and 0..N
Layers directly (Engine Canon §2's own tree, unchanged by this
diagram). The arrows above describe the sequence a Theme Author
typically moves through (confirm the shape, then place photos, then
decorate, then add words — `docs/BUILDER_V2_STORYBOARD.md` Stages 4–7),
not a containment relationship. The per-object tables below, and the
TypeScript interfaces in §3, are the actual technical specification;
this diagram exists only so the canonical flow can be stated once, in
plain vocabulary, before the detail.

### World

| | |
|---|---|
| **Purpose** | The root container — a Theme Author's entire curated library, per Engine Canon §0. |
| **Ownership** | Top of the tree; owns Theme Settings, Theme Assets, and every Scene. |
| **Edited by** | Theme Author, via Builder V2's World screen (Vision §1 — renamed from "Overview," same fields). |
| **Supplied by** | Theme Author, starting from a World Builder template (`js/templates.js`). |
| **Lifecycle** | Created once per World; identity fields (name/tagline/description/publisher/version/purpose/mood) are edited freely throughout the World's life; never deleted except by explicit Theme Author action (Draft Management, Sprint B2.0.5). |
| **Relationships** | Owns 0..N Scenes (§ below); owns Theme Assets (Frames today; Decorations/Textures/Fonts/Icons/Patterns per Engine Canon §9, not yet Builder-authorable as a shelf — `docs/BUILDER_V2_ENGINE_GAP.md`-adjacent, non-blocking gap). |
| **Serialization** | `manifest.json`, `metadata.json`, `theme.json` — unchanged in shape from Engine V1 (`docs/THEME_PROJECT_SPEC.md` §2–§4); Engine V2 changes what a World *contains* (Scenes, not Representations/Layouts/Frames/Layer Packs), not how the World itself is identified. |
| **Runtime meaning** | Never rendered itself (Engine Canon §11) — its active Scene is. Its identity fields are what a Story Author sees before choosing to create inside this World (Studio's Creation Flow Screen 1/2). |

### Scene

| | |
|---|---|
| **Purpose** | A complete, authored experience — "one page-type a story can use" (`docs/BUILDER_V2_MENTAL_MODEL.md` §1). |
| **Ownership** | Owned by World; owns exactly one Canvas, 0..N Holders, 0..N Layers, ordered by exactly one Stack (Engine Canon §2, §5). |
| **Edited by** | Theme Author, via Builder V2's Scene Editor (Place/Decorations/Text) and Scene Header (Scene Configuration). |
| **Supplied by** | Theme Author, always starting from an Engine Scene Template (Single Holder/Dual Holder/Quote/Cover/Timeline/Comic/Gallery) — never a blank Canvas (Engine Invariant 4). |
| **Lifecycle** | Created via Add a Scene (Blueprint §5); renamed/duplicated/deleted/reordered from the Scenes Library; its content (Holders/Layers/Stack) is edited freely for as long as the Scene exists. |
| **Relationships** | Belongs to exactly one World. Never references another Scene, another World's Scene, or a cross-Scene reusable object (Engine V1's Layout/Frame/Layer-Pack cross-referencing is explicitly not carried forward, Engine Canon Appendix). |
| **Serialization** | One file per Scene, `scenes/<id>.json`: <br>`{ id, name, startedFrom, canvas: { aspectRatio, safeArea }, holders: Holder[], layers: SceneLayer[], stack: StackEntry[] }` — plus a World-level `sceneOrder: string[]` (mirroring the existing `frameOrder` pattern) recording display order. `startedFrom` is informational provenance only (Engine Canon §12 item 2 — no persisted binding to the Template; nothing reads it to offer "reset to template"). |
| **Runtime meaning** | The rendering pipeline's actual unit of work (Engine Canon §11) — "whichever Scene is active" is what gets painted, per the Scene Stack, bottom to top (§5 below). |

### Scene Configuration (Engine: Canvas)

| | |
|---|---|
| **Purpose** | The Scene's coordinate frame — Size, Aspect Ratio, Safe Area (Engine Canon §4). |
| **Ownership** | Owned by Scene, exactly one; owns the Scene Stack (but is never itself a member of it, Engine Invariant 6). |
| **Edited by** | Theme Author, by selecting the Scene Header's glance (Vision §2) — never a fourth Working-View activity, since Scene Configuration has no page object to draw guides around. |
| **Supplied by** | The Engine Scene Template's default Aspect Ratio at Scene creation; freely changed after. |
| **Lifecycle** | Exists for the entire life of its Scene; Aspect Ratio may change at any time (`ProjectModel.setSceneAspect`); Size is always derived from Aspect Ratio, never independently typed (Blueprint §7). |
| **Relationships** | Every Holder's and every Scene Layer's `position`/`size` fractions (0–1) are relative to this Canvas's frame — nothing in §2 stores absolute pixels; pixels are derived by multiplying a fraction by the Aspect Ratio's own `width`/`height` (`js/services/engineSchema.js`'s `ASPECT_RATIOS` table). |
| **Serialization** | `scene.canvas: { aspectRatio: 'portrait'\|'landscape'\|'square'\|'wide'\|'full-bleed'\|'quote', safeArea: string }` — `safeArea` is a derived display label (`EngineSchema.aspectInfo(aspectRatio).safeArea`), not independently authored, since Engine Canon §4 does not let Aspect Ratio and Safe Area vary independently. |
| **Runtime meaning** | Establishes the frame everything else renders into (Engine Canon §5, pipeline step 2) — "nothing below can change it." Carries none of the Base Object contract's four properties (Engine Invariant 20); asking whether Scene Configuration is "editable" is a category error, same as Canvas itself. |

> **Confirmed by explicit architectural decision.** An
> architectural-review request described Canvas's properties as
> "Orientation, Dimensions, Safe Area, Background," which read as a
> possible Invariant 8 reversal — flagged here rather than silently
> applied. Product has since confirmed: **Background remains a
> bottom-of-stack Scene Layer; Canvas gains no background property;
> Engine Canon Invariant 8 stands, unmodified.** "Background" in that
> review request is descriptive only — Canvas as "the whole visual
> context" a Theme Author sees, of which the bottom Scene Layer is
> part — not a schema instruction. Canvas's serialization is confirmed
> exactly `{ aspectRatio, safeArea }`, matching Builder V2's existing
> implementation with no code change required.

### Place (Engine: Holder)

| | |
|---|---|
| **Purpose** | A container presenting exactly one Primary Element — "where the child's photo goes" (Mental Model §1). The Holder is sacred (Engine Canon §6). |
| **Ownership** | Owned by Scene, 0..N per Scene; owns its own internal Holder Stack (not yet separately authored in Builder V2 — see below). |
| **Edited by** | Theme Author: Position/Size (drag or slider), Shape, Padding, Fit, Frame (Blueprint §8). Story Author, at Runtime (not yet implemented): supplies the Primary Element into the reserved Content Layer, and whatever else the Base Object contract leaves open. |
| **Supplied by** | The Engine Scene Template's default Holder arrangement (`js/services/engineSchema.js`'s `HOLDER_LAYOUTS`) at Scene creation; Theme Author may Add/Remove Holders freely after (Engine Canon §2 places no upper bound). |
| **Lifecycle** | Created with its Scene or added later; edited freely; deleted freely; never persists past its owning Scene's deletion. |
| **Relationships** | Optionally references one Theme Asset (a Frame, by id) — the only cross-object reference in the entire Scene Model, matching Engine Canon §9's Frame Resolution rule (a Frame Element is placed inside a Holder Layer). No other cross-references exist anywhere in §2. |
| **Serialization** | `{ id, name, position: {x, y}, size: {w, h}, shape: 'rectangle'\|'rounded'\|'circle', padding: number, fit: 'fit'\|'fill'\|'original', frame: string \| null, permissions: { moveable, editable, visible } }` — `position`/`size` are fractions of the Scene Configuration's frame (0–1), never absolute pixels or a separately-typed Size (consistent with Scene Configuration's own "Size is derived" rule extended to every object placed inside it). |
| **Runtime meaning** | Paints its internal Holder Stack (today: generic placeholder chrome only — no Holder Layers or Content Layer are yet separately authored in Builder V2; see Open Decision §7 item 1), clipped to Shape, inset by Padding, resolved per Fit — then composited into the Scene Stack at its own stack position (§ below). |

### Decoration (Engine: a Scene Layer, `kind: 'decoration'` or `'fill'`)

| | |
|---|---|
| **Purpose** | The Scene's atmosphere — background, and scattered ornamentation (Blueprint §9). |
| **Ownership** | Owned by Scene, 0..N per Scene, as one entry in `scene.layers`; its paint position is owned by `scene.stack`, never by the layer itself. |
| **Edited by** | Theme Author: reposition (drag), Size, colour (background only), bring-forward/send-backward. Story Author, at Runtime (not yet implemented): may add/remove decorative Elements only into a layer explicitly marked `decorationSlot: true` (Engine Canon §7). |
| **Supplied by** | Theme Author, from a small built-in emoji palette today (`DECORATION_GLYPHS`) — real Theme Decoration Pack browsing (Engine Canon §9) is a disclosed, non-blocking gap (`docs/BUILDER_V2_ENGINE_GAP.md`-adjacent, Builder-level, not Engine-level). |
| **Lifecycle** | Added/removed freely; a Scene's Background is a convenience action (`setSceneBackground`) that reuses or creates the bottom-of-stack fill layer — never a separate `scene.background` field (Engine Invariant 8 forbids a second way to do what Elements-in-Layers already do). |
| **Relationships** | None to other objects; may visually overlap a Holder while remaining structurally separate (Engine Canon §7, Engine Invariant 13). |
| **Serialization** | `{ id, name, kind: 'fill' \| 'decoration', color?: string, glyph?: string, position: {x, y}, size: {w, h}, permissions: {...}, decorationSlot: boolean }` — a `'fill'` kind pinned to `position:{0,0}, size:{1,1}` at `stack[0]` is what "the Background" means; there is no separate Background type. |
| **Runtime meaning** | Paints its glyph or fill at its stack position, gated on `visible` only (Engine Invariant 22) — `moveable`/`editable`/`clickable` affect only a future editing surface, never a published render. `decorationSlot: true` is the entire Decoration Slot mechanism (Engine Canon §7) — a plain Scene Layer with one flag set, not a distinct object type. |

### Text (Engine: a Scene Layer, `kind: 'text'`)

| | |
|---|---|
| **Purpose** | The words a Scene needs — title, caption, quote (Blueprint §10). |
| **Ownership** | Owned by Scene, 0..N per Scene, as one entry in `scene.layers` — the same collection Decorations live in, distinguished only by `kind`. |
| **Edited by** | Theme Author: the words themselves, Font, Alignment, Size, Colour. Story Author, at Runtime (not yet implemented): may change wording and/or styling together, gated by one `editable` flag (Blueprint §10 — deliberately not split into two separate permissions). |
| **Supplied by** | Theme Author directly — unconstrained by any Theme Asset shelf (Blueprint §2's resolved contradiction: text is not a Theme Asset, so nothing constrains adding more of it the way the Decoration shelf does). |
| **Lifecycle** | Added/removed freely; never sourced from a template default (every Engine Scene Template starts with zero Text layers). |
| **Relationships** | None to other objects. |
| **Serialization** | `{ id, name, kind: 'text', text: string, font: string, fontSize: number, align: 'left'\|'center'\|'right', color: string, position: {x, y}, size: {w, h}, permissions: {...} }` — no `decorationSlot` field is meaningful for text (that mechanism is Decoration-specific, Engine Canon §7), though the field may exist at `false` on a layer for shape uniformity within `scene.layers`. |
| **Runtime meaning** | Renders top-down word-wrapped text within its bounding box at its stack position, gated on `visible` only, same as Decoration. |

### The Scene Stack (`scene.stack`)

| | |
|---|---|
| **Purpose** | The single ordered sequence of Holders and Scene Layers that paints bottom to top (Engine Canon §5) — "Canvas owns the Scene Stack, but Canvas is never itself a member of it." |
| **Ownership** | Owned by Scene (conceptually by Canvas, per Engine Canon §5's own wording — serialized directly on the Scene object for simplicity, since Canvas has no other owned data to warrant its own file section). |
| **Edited by** | Theme Author only, via "Bring Forward"/"Send Backward" (`moveInStack`) — the one Builder verb that stands in for a Layer Stack panel (Blueprint §9). Story Author may never reorder it (Engine Invariant 24). |
| **Supplied by** | Reconciled lazily on every read (`_ensureStack`, the same pattern `_ordered` already uses for `frameOrder`/`sceneOrder`) — a Scene authored before `stack` existed, or missing an entry for a newly-added Holder/Layer, is repaired automatically rather than crashing. |
| **Lifecycle** | Grows/shrinks exactly in step with `scene.holders`/`scene.layers` — an entry is added when a Holder or Layer is created, removed when one is deleted; never independently created or destroyed. |
| **Relationships** | References every Holder and every Scene Layer by id; is the *only* place paint order is recorded — no Holder or Layer stores its own z-index/order. |
| **Serialization** | `Array<{ type: 'holder' \| 'layer', id: string }>`, index 0 = bottom of stack. |
| **Runtime meaning** | *Is* the render order (Engine Canon §11 — "not rendered itself... it is the render order"). A Runtime implementation would iterate this array bottom to top, dispatching each entry to the Holder-paint or Layer-paint routine per its `type`. |

### Representation — retired, by explicit architectural decision

An earlier draft of this document proposed "Representation" as a new
Engine V2 concept (a thin, Runtime-facing wrapper letting Studio's
Creation Flow know which Scenes to offer a Story Author). That proposal
is now **retired outright** by explicit architectural decision: **the
canonical Engine V2 authoring flow is `World → Scene → Canvas → Place →
Decoration → Text`, with no `Representation` object anywhere in it.**
Nothing in Engine V2 depends on, or reintroduces, the Engine V1
`Representation → Layout → Frame → Layer Pack` pipeline (`docs/BUILDER_V2_ENGINE_GAP.md`
§2 documents that legacy pipeline; it continues to run, unmodified,
purely for Engine V1 data, per this document's own §6). `Representation`
remains what `docs/ENGINE_V2_CANON.md`'s Appendix already said it was —
a **legacy Engine V1 concept only**, superseded by Scene, never a
parallel or successor object in Engine V2.

This retirement reopened, deliberately, the real Runtime question the
retired proposal was trying to answer: *how does Studio's Creation Flow
know which Scenes to offer a Story Author, in what order?* That question
is now **resolved** — see Scene Template, immediately below — without
reintroducing anything Representation-shaped. Output-format concerns
(PNG/PDF/MP4, etc.) remain Build/Publish concerns operating directly on
a Scene (§5) and likewise never route through any wrapper object.

### Scene Template — Builder/Studio-only, Engine-invisible (resolves the reopened Creation Flow question)

**Not an Engine object. Not serialized. Not consumed by Runtime,
Validation, Build, or Publish.** Scene Template is UI vocabulary only —
the answer to "how does Creation Flow know which Scenes to offer" turns
out to require no new data at all, because a World's Scenes are already
everything that question needs:

> **Creation Flow offers every Scene in a World, by its own name and
> thumbnail, in Scene Library order.** Picking one starts a new,
> personal page seeded from that Scene's existing Canvas/Place/
> Decoration/Text content — exactly the "Story Author personalizes,
> never designs, and never starts from blank" rule already frozen in
> Engine Canon Invariant 3. No separate authored list, no per-Scene
> "is this offered" flag, no label/thumbnail override distinct from the
> Scene's own — the Scene Library's existing name and (Slice 5's) live
> thumbnail *are* what Creation Flow shows. This is Open Decision item
> 1's own alternative (b), now confirmed rather than merely proposed.

Two distinct moments now share the term "Scene Template," deliberately
disambiguated here to avoid confusing them:

1. **Theme-Author-facing, at Scene-authoring-time** — the existing,
   unchanged **Engine Scene Template** (Engine Canon §10: Single
   Holder, Dual Holder, Quote, Cover, Timeline, Comic, Gallery). A
   Theme Author picks one of these seven fixed shapes to bootstrap a
   *brand-new* Scene's starting Canvas/Holders/Layers while authoring a
   World in Builder V2. Nothing about this changes.
2. **Story-Author-facing, at Creation-Flow-time** — the concept this
   section introduces. A Story Author picks one of a World's
   *already-authored* Scenes (by name — "Story Page," "Cover," "Quote,"
   "Showcase," whatever the Theme Author called it) as the starting
   point for their own new page. This is not a fixed shape from a
   built-in list; it is literally any Scene the Theme Author has
   already built, offered back to a Story Author under a friendlier
   frame ("pick a starting point") than "browse this World's internal
   authoring library."

Both moments preconfigure the same things (Canvas preset, Safe Area,
initial Places, initial Layer Stack including any placeholder text or
default decorations) because both are, structurally, just "here is an
already-shaped Scene to build from" — the only difference is *who* is
picking (Theme Author bootstrapping new authoring content vs. Story
Author starting a new personal page) and *what* they're picking from
(seven fixed Engine shapes vs. this World's own finished Scenes). In
both cases, **the moment the Scene is created or the personal page is
seeded, the template's job is done** — nothing downstream (Runtime,
Validation, Build, Publish) ever needs to know a template was involved
at all, satisfying LOCK V2-01 (the Scene Model is the only canonical
representation) without exception.

---

## 3. TypeScript interfaces

Directly reflecting §2 — no field here is speculative; every one is
already written by `tools/world-builder/js/projectModel.js` today.
There is no `Representation` interface — that concept is retired (§2).

```typescript
type AspectRatioId = 'portrait' | 'landscape' | 'square' | 'wide' | 'full-bleed' | 'quote';
type HolderShape = 'rectangle' | 'rounded' | 'circle';
type HolderFit = 'fit' | 'fill' | 'original';
type SceneLayerKind = 'fill' | 'decoration' | 'text';
type TextAlign = 'left' | 'center' | 'right';

interface Fraction2D {
  x: number; // 0..1, relative to the owning Scene's Canvas frame
  y: number;
}

interface FractionSize {
  w: number; // 0..1, relative to the owning Scene's Canvas frame
  h: number;
}

// The Base Object contract (Engine Canon §8) — Holders and every
// Scene Layer kind carry exactly these four... minus `clickable`,
// which Builder V2 derives (true whenever moveable or editable is
// true) rather than surfacing as an independent toggle, per Blueprint
// §6.2's own documented simplification.
interface BaseObjectPermissions {
  moveable: boolean;
  editable: boolean;
  visible: boolean;
}

interface Canvas { // "Scene Configuration" in Builder-facing copy
  aspectRatio: AspectRatioId;
  safeArea: string; // derived display label, never independently authored
}

interface Holder { // "Place" in Builder-facing copy
  id: string;
  name: string;
  position: Fraction2D;
  size: FractionSize;
  shape: HolderShape;
  padding: number; // 0..40, cosmetic scale — see §2's own disclosed limitation
  fit: HolderFit;
  frame: string | null; // a Theme Asset (Frame) id — the model's only cross-reference
  permissions: BaseObjectPermissions;
}

interface SceneLayer { // "Decoration" (kind: fill | decoration) or "Text" (kind: text) in Builder-facing copy
  id: string;
  name: string;
  kind: SceneLayerKind;
  position: Fraction2D;
  size: FractionSize;
  permissions: BaseObjectPermissions;
  decorationSlot: boolean; // meaningful only when kind !== 'text'

  // kind === 'fill' | 'decoration'
  color?: string;   // kind === 'fill'
  glyph?: string;   // kind === 'decoration'

  // kind === 'text'
  text?: string;
  font?: string;
  fontSize?: number;
  align?: TextAlign;
}

interface StackEntry {
  type: 'holder' | 'layer';
  id: string;
}

interface Scene {
  id: string;
  name: string;
  startedFrom: string; // Engine Scene Template id — informational provenance only, Engine Canon §12 item 2
  canvas: Canvas;
  holders: Holder[];
  layers: SceneLayer[];
  stack: StackEntry[]; // reconciled lazily; always covers every holders[]/layers[] entry exactly once
}

interface World {
  // manifest.json / metadata.json / theme.json — unchanged in shape
  // from docs/THEME_PROJECT_SPEC.md §2-§4; omitted here since this
  // document's scope is the Scene Model, not World identity, which
  // Engine V2 does not change.
  scenes: Scene[];
  sceneOrder: string[]; // display order; scenes[] itself is unordered storage
  // No `representations` field — that concept is retired (§2). How
  // Creation Flow discovers which Scenes to offer is an open question
  // (§7), deliberately left unanswered here rather than reintroducing
  // a Representation-shaped field to answer it.
}
```

---

## 4. How Builder data becomes this model

Unlike Engine V1 (where a hand-authored Theme Project and a
Builder-generated World Project were two distinct shapes reconciled at
Build time, per `docs/WORLD_PROJECT_CONTRACT.md`), **Builder V2 already
writes the canonical Scene Model directly** — there is no translation
step, because none is needed:

```
Theme Author action (Builder V2 UI)
   ↓
tools/world-builder/js/projectModel.js's Scene/Holder/SceneLayer CRUD
   ↓
project.files['scenes/<id>.json']   ← already exactly §2/§3's shape
   ↓
(Runtime/Validation/Build/Publish would read this file directly — no
 translation layer exists or is proposed, per LOCK V2-01)
```

This is a direct consequence of LOCK V2-01: since the canonical model
*is* whatever Builder already persists, "how Builder data becomes
executable Runtime data" has the simplest possible answer — it already
is that data, the moment any future Runtime is written to read
`scenes/*.json` in the shape §2/§3 specify. No compiled intermediate
form is required for Runtime to consume a Scene; compilation (§5)
exists for packaging/distribution, not for making Scene data
consumable in the first place.

---

## 5. How the same model must flow through Validation, Build, and Publish

**Not implemented. This section specifies the target contract each
stage must satisfy, per LOCK V2-03 — it does not build any of them.**
Which architecture they are built as is no longer open: LOCK V2-04
resolves it as a native Engine V2 Runtime, so every bullet below
describes each stage consuming the canonical Scene Model **directly**
— never through a translation step, never through an Engine V1
intermediary.

- **Validation** would check every Scene in a World against §2's own
  rules as real constraints, not merely as documentation: every Scene
  has exactly one Canvas (trivially true — `canvas` is a required
  field, not optional); every `stack` entry resolves to a real Holder
  or Layer id and every Holder/Layer id appears in `stack` exactly once
  (today enforced by `_ensureStack`'s reconciliation at read time —
  Validation's job would be to *report* a Scene that ever needed
  reconciliation as a warning, not to silently fix it the way the
  Builder's own read-time convenience does); every Holder's `frame`, if
  set, resolves to a real Theme Asset id; every fractional
  `position`/`size` stays within `[0, 1]` and does not place an object
  fully outside its Canvas.
- **Build** would compile a validated World's Scenes into a package
  format — this document still takes no position on the *exact* format
  (file layout, naming, whether it keeps the `.vtheme` name), per its
  own commissioning constraint ("Do not invent compiled package formats
  as the canonical representation") and per LOCK V2-02. That is an
  ordinary implementation decision for whoever builds Build, not a
  blocking architectural one — LOCK V2-04 has already settled the part
  that *was* architectural (native, direct consumption of the Scene
  Model; no translation; no parallel path). Whatever form Build takes,
  its *input* is exactly §2/§3's Scene Model — Build is a pure function
  from Scene Model to package, never a stage that requires additional
  undocumented fields. **Output-format variation (PNG/PDF/MP4, or any
  future export target) is a Build/Publish concern operating directly
  on a Scene** — a format choice, not a second content-selection
  object. Nothing about producing a PNG vs. a PDF from the same Scene
  implies a Representation-shaped wrapper; it implies a Build stage
  with more than one output routine over the same canonical input.
- **Publish** would share whatever Build produced — sharing mechanics
  (Official/Community/Export) are unchanged in *kind* from Engine V1's
  own Publish stage (`docs/WORLD_BUILDER_ARCHITECTURE.md`'s Architecture
  Locks), so this document does not re-specify them.

> **Amended by the Builder Convergence Sprint (see Change History v1.5).**
> The Build/Publish bullets above described a *native* Engine V2
> Build/Publish, operating on the Scene Model with no Engine V1
> intermediary — the actual implementation took a different, explicitly
> product-directed path instead: Scene content converges *into* Engine
> V1's existing Build (`tools/world-builder/js/services/builder.js`'s
> `packageTheme()`), producing exactly one Published Theme, because
> Studio's real Runtime (`renderer/slideRenderer.js`) has no Engine V2
> concept to consume a native Scene Model package with. A native Engine
> V2 Build (`js/services/engineBuilder.js`, `project.lastSceneBuild`) was
> implemented once, then retired — it produced a real, well-formed
> package, but as a *second*, Studio-invisible published artifact, which
> the Builder Convergence Sprint's own commissioning brief explicitly
> named as the problem to solve ("Do not maintain parallel Theme
> formats"). See §6 below and `docs/THEME_PROJECT_SPEC.md`'s "Builder
> Convergence Sprint — Scene Convergence" section for the actual
> mapping.

---

## 6. Relationship to the Engine V1 pipeline

`docs/WORLD_BUILDER_ARCHITECTURE.md`'s existing pipeline
(`Builder → Project → Validation → Build → Publish → Runtime`) is
**unchanged and still fully operational** for Engine V1 data
(Representations/Layouts/Frames/Layer Packs) — nothing in this document
touches `js/services/validator.js`, `js/services/builder.js`,
`js/themeEngine.js`, or `renderer/slideRenderer.js`, all of which
continue to validate/build/render exactly as they did before Builder V2
existed, and will keep doing so indefinitely: **Engine V1 remains
legacy, not a compatibility path Engine V2 ever routes through.**

This document defines a second, independent pipeline for Engine V2
data — not yet implemented, not yet wired to anything, but now
architecturally settled (LOCK V2-04): a **native Runtime**, operating
directly on the canonical Scene Model. The two pipelines do not merge
(the translation-layer option is rejected); Engine V2 does not become a
second, permanently-parallel authoring surface bolted onto Engine V1
(that option is also rejected) — it is its own, self-sufficient
pipeline, sharing nothing at runtime with Engine V1's beyond both
existing in the same repository during the (indefinite) period Engine
V1 content continues to be supported.

> **Amended by the Builder Convergence Sprint (see Change History v1.5).**
> The **authoring-time Runtime** half of this paragraph stands unmodified
> — Working View and Runtime Preview inside World Builder still render
> Scenes directly off the canonical Scene Model via
> `tools/world-builder/js/services/engineRuntime.js`, exactly as this
> document specifies, with no Engine V1 involvement. The **published-
> artifact** half is superseded: rather than remaining "its own, self-
> sufficient pipeline" all the way to a Published Theme, Scene content
> now converges into Engine V1's Build (`packageTheme()`) as its final
> step, so Publish/the Repository/Studio see exactly one Theme, never
> two. This was an explicit, deliberate product decision made after this
> document was written and after a native Engine V2 Build/Publish had
> already been built once (see §5's amendment) — not a rediscovery that
> the "translation-layer option" this paragraph rejected was secretly
> fine all along. The distinction that matters: Engine V2's Scene Model
> remains the one canonical *authoring* representation (unchanged);
> only the *compiled/published* representation converges into Engine
> V1's, because a second published format with zero Studio consumers
> served no one.

---

## 7. Open Decisions for Product Sign-off

Mirroring `docs/ENGINE_V2_CANON.md` §12's own convention — each of
these is a genuine product decision this document deliberately does not
make, listed so Builder V2 (or a future Engine implementation) is not
blocked pretending an answer exists when it doesn't.

### Resolved this pass (no longer open)

- ~~Is "Representation" the right shape for Creation-Flow exposure?~~ —
  **Resolved: retired outright, no replacement Engine object.** Creation
  Flow's "which Scenes to offer" question is answered by Scene Template
  (§2) — a Builder/Studio-only UI concept requiring zero new Engine
  data. Every Scene in a World is offered, by its own name/thumbnail, in
  Scene Library order.
- ~~Does Canvas carry a Background property?~~ — **Resolved: no.**
  Background remains a bottom-of-stack Scene Layer; Engine Canon
  Invariant 8 stands unmodified; Canvas's serialization is unchanged
  (§2, §3).
- ~~Which of `docs/BUILDER_V2_ENGINE_GAP.md` §4's three resolution paths
  should Validation/Build/Publish actually implement?~~ — **Resolved: a
  native Engine V2 Runtime.** By explicit architectural decision,
  Validation, Runtime, Build, and Publish will all operate directly on
  the canonical Scene Model defined here — no translation layer down to
  Engine V1, and no permanent parallel Runtime architecture. Both other
  paths named in the Gap document are rejected outright. Engine V1
  (Representations/Layouts/Frames/Layer Packs, and the pipeline that
  serves them, §6) remains legacy — it keeps running, unmodified, for
  Engine V1 data only — but is not, and will never become, a
  compatibility path Engine V2 routes through. See LOCK V2-04.

### Still open

1. **Do Holder Layers and a reserved Content Layer need separate
   authoring**, or does Builder V2's current single-Frame-per-Holder
   model (no independently-orderable Holder Layer stack, no explicit
   Content Layer object) already cover every case a Theme Author needs?
   Engine Canon §6/§11 describe a Holder's own internal Holder Stack
   with a reserved Content Layer as a real Engine concept; Builder V2
   has not yet needed to expose that internal stack directly (a Frame
   is the only thing a Theme Author places "inside" a Holder today).
   Left open until a real authoring need (e.g., multiple decorative
   layers inside one Holder, not just one Frame) surfaces it. Narrower
   than an architectural blocker — an authoring-completeness question,
   not a prerequisite for Runtime/Validation/Build/Publish
   implementation to begin.
2. **Personal Decoration Packs** (Engine Canon §12 item 1) remains as
   open here as it was in Engine Canon itself — nothing in Builder V2's
   Decoration implementation (a small built-in emoji palette) resolves
   it, since Builder V2 deliberately did not build Theme Decoration Pack
   browsing at all yet (a disclosed, Builder-level gap, not an
   Engine-level one). Likewise not a blocker to beginning
   implementation.

---

## Cross-references

- `docs/ENGINE_V2_CANON.md` — the object model this document's Scene
  Model directly serializes; untouched by this document except for one
  additive pointer to it (see that document's own end).
- `docs/BUILDER_V2_ENGINE_GAP.md` — the implementation report that
  first surfaced the need for this document; its three resolution
  paths (§4 there) are resolved by this document's §7 (native Runtime
  chosen; LOCK V2-04) — see that document's own updated §5/Cross-references.
- `docs/BUILDER_V2_VISION.md` / `BUILDER_V2_BLUEPRINT.md` /
  `BUILDER_V2_STORYBOARD.md` / `BUILDER_V2_MENTAL_MODEL.md` /
  `BUILDER_V2_UX_PACKAGE.md` — the frozen Builder V2 product
  specification this document's vocabulary (Scene Configuration, Place,
  Decoration, Text) is drawn from verbatim; none of them are edited by
  this document, per this sprint's own explicit constraint.
- `docs/WORLD_BUILDER_ARCHITECTURE.md` / `docs/WORLD_PROJECT_CONTRACT.md`
  / `docs/THEME_PROJECT_SPEC.md` / `docs/VTHEME_PACKAGE_SPEC.md` — the
  Engine V1 pipeline and package specs this document's §1/§6 explicitly
  leave running, unchanged, alongside the V2 target pipeline defined
  here.
- `docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md` — the Runtime-side
  consumer (`theme.representations`) whose Engine V1 dependency §2's
  retirement note explains; its Engine V2 equivalent is now resolved by
  Scene Template (§2, §7 "Resolved this pass").

---

## Change History

- v1.0 — Initial version. Proposed "Representation" as a new Engine V2
  object (a Runtime-facing wrapper for Creation Flow exposure), marked
  provisional in its own Open Decisions section.
- v1.1 — Architectural review retired Representation outright: the
  canonical Engine V2 authoring flow is confirmed as `World → Scene →
  Canvas → Place → Decoration → Text`, with no Representation object
  anywhere in it, and no dependency on Engine V1's
  `Representation → Layout → Frame → Layer Pack` pipeline. The question
  Representation was answering (Creation Flow Scene exposure) is
  reopened, explicitly barred from resolving back to a
  Representation-shaped answer. Also flagged, not applied: a Canvas
  "Background" property described in the same review request directly
  contradicts Engine Canon Invariant 8 and Builder V2's existing
  implementation (Background as a bottom-of-stack fill Scene Layer);
  Canvas's schema is unchanged pending explicit confirmation of intent.
- v1.2 — Confirmed by explicit architectural decision: Background
  remains a bottom-of-stack Scene Layer; Canvas gains no background
  property; Engine Canon Invariant 8 stands, unmodified. Open Decisions
  item 1a and §2's Scene Configuration flag are both marked resolved.
  No code change required — Builder V2's existing implementation was
  already correct.
- v1.3 — Architecture Lock pass. Closed the remaining open item from
  Representation's retirement: introduces **Scene Template** (§2) as a
  Builder/Studio-only, Engine-invisible concept answering "how does
  Creation Flow know which Scenes to offer" — every Scene in a World,
  by its own name/thumbnail, in Scene Library order, requiring no new
  Engine data. Explicitly distinguishes this from the existing,
  unchanged **Engine Scene Template** (Engine Canon §10's seven
  bootstrap shapes) since the two now share similar naming but describe
  different moments (Theme-Author Scene-authoring-time vs.
  Story-Author Creation-Flow-time). §7's "Resolved this pass"
  subsection replaces the old numbered items 1/1a; remaining items
  renumbered 1-3. Status line updated: the Scene Model, Representation's
  retirement, Canvas's schema, and Scene Template are now frozen; only
  §7's three remaining items stay open.
- v1.4 — Architecture Lock pass. Resolves the last blocking Open
  Decision: **Engine V2 will implement a native Runtime over the
  canonical Scene Model.** By explicit architectural decision, a
  translation layer to Engine V1 and a permanent parallel Runtime
  architecture are both rejected outright — Validation, Runtime, Build,
  and Publish will all operate directly on the Scene Model defined here;
  Engine V1 remains legacy, running unmodified for Engine V1 data only,
  never a compatibility path Engine V2 routes through. LOCK V2-04
  rewritten from "does not choose a resolution path" to state this
  outcome directly; §5's intro and Build bullet, and §6's closing
  paragraph, updated to describe direct/native consumption rather than
  an undecided architecture. §7's former item 1 (the three-path
  question) moves to "Resolved this pass"; the remaining two items
  (Holder Layers/Content Layer authoring; Personal Decoration Packs)
  renumber to 1-2 and are recharacterized as narrower authoring/product
  questions, not architectural blockers. `docs/BUILDER_V2_ENGINE_GAP.md`
  gains a matching "Resolved" pointer in its own §4/Cross-references.
  **With this resolved, no architectural Open Decisions remain: Engine
  V2 Architecture is now completely frozen. Runtime, Validation, Build,
  and Publish implementation may begin against the canonical Scene
  Model defined in this document, with no further design sign-off
  required.**
- v1.5 — Builder Convergence Sprint. Runtime, Validation, and the
  authoring-time half of Build/Publish (v1.4's "native Runtime") were all
  implemented exactly as specified and remain unmodified. The published-
  artifact half of Build/Publish was implemented once as a fully native,
  parallel pipeline (`js/services/engineBuilder.js`, `project.
  lastSceneBuild`, a real, well-formed `{format:'engine-v2-world-
  package', ...}` compiled package) — then explicitly retired by later
  product direction: Studio's actual Runtime has no Engine V2 concept to
  consume that package with, so it was a second, Studio-invisible
  published artifact rather than a working parallel pipeline. Scene
  content now converges into Engine V1's existing Build/Publish instead
  (§5/§6 above carry inline "Amended" notes; the actual field-by-field
  mapping lives in `docs/THEME_PROJECT_SPEC.md`'s "Builder Convergence
  Sprint — Scene Convergence" section, not duplicated here). This is a
  deliberate reversal of this document's own "the two pipelines do not
  merge" position for the *published-artifact* question only — the
  canonical *authoring* Scene Model, and the native authoring-time
  Runtime that renders it inside the Builder, are completely unchanged.
