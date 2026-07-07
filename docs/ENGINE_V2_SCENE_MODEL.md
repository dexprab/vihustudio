# Engine V2 — Canonical Scene Model & Execution Pipeline

**Status:** Canonical, pending product sign-off on §7's open items — the
architecture-documentation counterpart to `docs/ENGINE_V2_CANON.md`,
written once Builder V2's Scene Editor (Place/Decorations/Text) was
fully implemented and exposed the exact gap this document exists to
close. This is a **documentation-only** deliverable: nothing in this
document is implemented. It defines what Runtime, Validation, Build,
and Publish would need to do; it does not build any of them.
**Scope:** The canonical, single-source-of-truth data model a Scene
compiles to — the thing Builder produces, Runtime would consume, and
Validation/Build/Publish would all operate on identically — plus the
execution pipeline that model flows through. `docs/ENGINE_V2_CANON.md`
defines the *object model* (Theme → Scene → Canvas/Holder/Layer →
Element, ownership, invariants); this document defines the *serialized
shape* of that model as Builder V2 already produces it, and the
pipeline stages downstream of it. It does not redesign Builder V2 (see
`docs/BUILDER_V2_VISION.md`/`BUILDER_V2_BLUEPRINT.md`, frozen, untouched
by this document) and it does not implement Runtime, Validation, Build,
or Publish — see §5 and `docs/BUILDER_V2_ENGINE_GAP.md` for why those
remain a product decision, not an engineering default.

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
   what package format?** — this part is still genuinely undecided (see
   §5, §7) and this document does not decide it. Format and
   compilation are explicitly downstream of the Scene Model, never the
   Scene Model itself (see the Constraints this document was
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

**LOCK V2-04 — This document does not choose a resolution path.**
`docs/BUILDER_V2_ENGINE_GAP.md` §4 named three possible shapes a
Runtime/Validation/Build/Publish resolution could take (a genuine V2
Runtime; a translation layer down to the existing V1 Runtime; two
permanently parallel authoring surfaces). This document is written to
be equally implementable under any of the three — it specifies the
Scene Model and the pipeline shape, not which of the three paths fills
in Runtime/Validation/Build/Publish. That remains a product decision
(§7).

---

## 2. The Canonical Engine Scene Model

Everything below is what `tools/world-builder/js/projectModel.js`
already persists today (Builder V2 Slices 1–5) — this section names and
specifies it, rather than proposing something new. Every object is
described the same way Engine Canon §11's Ownership Matrix does: Who
owns it? Who edits it? Who supplies it? Who renders it? — plus its
purpose, its lifecycle, and its serialized shape.

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
| **Runtime meaning** | Paints its internal Holder Stack (today: generic placeholder chrome only — no Holder Layers or Content Layer are yet separately authored in Builder V2; see Open Decision §7 item 3), clipped to Shape, inset by Padding, resolved per Fit — then composited into the Scene Stack at its own stack position (§ below). |

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

### Representation — new Engine-level terminology, flagged as such

**This concept does not appear in any of the six frozen Builder V2
documents** (`BUILDER_V2_VISION.md`, `_BLUEPRINT.md`, `_STORYBOARD.md`,
`_MENTAL_MODEL.md`, `_UX_PACKAGE.md`) — none of them define a
"Representation" object, screen, or activity for Builder V2. The term
exists only in `docs/ENGINE_V2_CANON.md`'s own Appendix, where it names
the **Engine V1** concept Scene already supersedes ("A Scene, authored
directly... no cross-references between separately-named parts").
Reintroducing it here is **not** restoring a Builder concept — it is
this document defining a genuinely new Engine-level answer to a real,
still-live Runtime question the Appendix mapping left unaddressed:
Studio's Creation Flow Preview carousel (`docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md`)
depends on `theme.representations`, "the authored, user-facing wrapper
around `theme.layouts`," to know which page styles to offer a Story
Author and in what order. Engine V2 has no Layouts to wrap — but the
Runtime-facing question itself ("which of this World's Scenes are
offered as Creation Flow starting points, in what order, under what
label/thumbnail") does not go away just because Layouts did.

| | |
|---|---|
| **Purpose** | The ordered, labeled subset of a World's Scenes that Studio's Creation Flow offers a Story Author as a starting point. |
| **Ownership** | Owned by World; references Scenes, never contains them. |
| **Edited by** | Proposed: Theme Author, from the Scenes Library — not a new screen or activity, but a lightweight per-Scene toggle ("offer this Scene in Creation Flow") plus a label/thumbnail override, analogous to how a Decoration Slot is one flag on an existing object rather than a new object type. **Not yet built; not yet confirmed** — see §7 item 1. |
| **Supplied by** | Proposed: defaults to "every Scene is offered, in Scene Library order," so a World with no explicit Representation authoring still has a complete Creation Flow, mirroring `docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md`'s own "a World that defines none still shows a Preview" guarantee. |
| **Lifecycle** | Derived from Scenes, never independently created — deleting a Scene removes its Representation entry automatically; there is no orphaned Representation state possible. |
| **Relationships** | References exactly one Scene by id; carries its own display label/thumbnail/`supportedCreationTypes`, independent of the Scene's own `name` (a Scene named for the Theme Author's own reference — "Cover" — may want a different, friendlier Story-Author-facing label). |
| **Serialization (proposed, not yet implemented)** | `representations: Array<{ sceneId: string, label: string, thumbnail: string, supportedCreationTypes: string[] }>` at the World level — the direct V2 analogue of Engine V1's `theme.representations`, referencing a Scene id instead of a Layout id + Frame id + Layer Pack id. |
| **Runtime meaning** | Drives Studio's Creation Flow Preview carousel exactly as `theme.representations` does today — unchanged Runtime behaviour, only what it wraps changes (a Scene reference, not a Layout+Frame+LayerPack cross-reference). |

This entire subsection is marked **proposed**, not decided — see §7
item 1. It is documented here, at the same rigor as the other six
objects, precisely because leaving it out would silently drop a real
Runtime requirement (Creation Flow needs *something* to drive its
carousel) rather than surfacing it for a decision.

---

## 3. TypeScript interfaces

Directly reflecting §2 — no field here is speculative; every one is
either already written by `tools/world-builder/js/projectModel.js`
(marked accordingly) or explicitly proposed in §2's Representation
subsection (marked `// proposed`).

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

// proposed — not yet implemented, see §2's Representation subsection and §7 item 1
interface Representation {
  sceneId: string;
  label: string;
  thumbnail: string;
  supportedCreationTypes: string[];
}

interface World {
  // manifest.json / metadata.json / theme.json — unchanged in shape
  // from docs/THEME_PROJECT_SPEC.md §2-§4; omitted here since this
  // document's scope is the Scene Model, not World identity, which
  // Engine V2 does not change.
  scenes: Scene[];
  sceneOrder: string[]; // display order; scenes[] itself is unordered storage
  representations?: Representation[]; // proposed
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
stage would need to satisfy, per LOCK V2-03 — it does not build any of
them, and per `docs/BUILDER_V2_ENGINE_GAP.md` §4, which of the three
resolution paths eventually fills these in is still an open product
decision (§7 item 2 here).**

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
- **Build** would compile a validated World's Scenes into whatever
  package format is eventually decided (§7 item 2) — this document
  takes no position on that format, per its own commissioning
  constraint ("Do not invent compiled package formats as the canonical
  representation"). Whatever form Build takes, its *input* is exactly
  §2/§3's Scene Model — Build is a pure function from Scene Model to
  package, never a stage that requires additional undocumented fields
  (LOCK V2-02).
- **Publish** would share whatever Build produced — sharing mechanics
  (Official/Community/Export) are unchanged in *kind* from Engine V1's
  own Publish stage (`docs/WORLD_BUILDER_ARCHITECTURE.md`'s Architecture
  Locks), so this document does not re-specify them.

---

## 6. Relationship to the Engine V1 pipeline

`docs/WORLD_BUILDER_ARCHITECTURE.md`'s existing pipeline
(`Builder → Project → Validation → Build → Publish → Runtime`) is
**unchanged and still fully operational** for Engine V1 data
(Representations/Layouts/Frames/Layer Packs) — nothing in this document
touches `js/services/validator.js`, `js/services/builder.js`,
`js/themeEngine.js`, or `renderer/slideRenderer.js`, all of which
continue to validate/build/render exactly as they did before Builder V2
existed. This document defines a second, parallel *target* pipeline for
Engine V2 data, not yet implemented, not yet wired to anything. Whether
these two pipelines eventually merge (a translation layer, §7 item 2's
option B), whether V2 gets its own independent Runtime (option A), or
whether they run permanently side by side (option C) is exactly the
decision `docs/BUILDER_V2_ENGINE_GAP.md` §4 already declined to make and
this document also declines to make — see §7.

---

## 7. Open Decisions for Product Sign-off

Mirroring `docs/ENGINE_V2_CANON.md` §12's own convention — each of
these is a genuine product decision this document deliberately does not
make, listed so Builder V2 (or a future Engine implementation) is not
blocked pretending an answer exists when it doesn't.

1. **Is "Representation" (§2) the right shape for Creation-Flow
   exposure, and should it be Builder-authored at all?** Three real
   alternatives exist: (a) as proposed — an explicit, Theme-Author-set
   per-Scene toggle + label/thumbnail; (b) implicit — every Scene is
   always offered, in Scene Library order, with no separate authoring
   step at all (simpler, but removes the "some Scenes are internal-only"
   capability Engine V1's Representation model implicitly allowed by
   omission); (c) something not yet imagined. This document assumes (a)
   only provisionally, for concreteness — it is the least-decided part
   of this whole document and should not be treated as settled.
2. **Which of `docs/BUILDER_V2_ENGINE_GAP.md` §4's three resolution
   paths (genuine V2 Runtime / translation layer to V1 / permanent
   parallel surfaces) should Validation/Build/Publish actually
   implement?** This document's entire purpose is to make that decision
   safe to defer — the Scene Model (§2/§3) is stable and implementable
   regardless of which path is chosen — but the choice itself remains
   outstanding and is a prerequisite for any Runtime/Validation/Build/
   Publish implementation work, per this sprint's own explicit
   instruction to stop before that work begins.
3. **Do Holder Layers and a reserved Content Layer need separate
   authoring**, or does Builder V2's current single-Frame-per-Holder
   model (no independently-orderable Holder Layer stack, no explicit
   Content Layer object) already cover every case a Theme Author needs?
   Engine Canon §6/§11 describe a Holder's own internal Holder Stack
   with a reserved Content Layer as a real Engine concept; Builder V2
   has not yet needed to expose that internal stack directly (a Frame
   is the only thing a Theme Author places "inside" a Holder today).
   Left open until a real authoring need (e.g., multiple decorative
   layers inside one Holder, not just one Frame) surfaces it.
4. **Personal Decoration Packs** (Engine Canon §12 item 1) remains as
   open here as it was in Engine Canon itself — nothing in Builder V2's
   Decoration implementation (a small built-in emoji palette) resolves
   it, since Builder V2 deliberately did not build Theme Decoration Pack
   browsing at all yet (a disclosed, Builder-level gap, not an
   Engine-level one).

---

## Cross-references

- `docs/ENGINE_V2_CANON.md` — the object model this document's Scene
  Model directly serializes; untouched by this document except for one
  additive pointer to it (see that document's own end).
- `docs/BUILDER_V2_ENGINE_GAP.md` — the implementation report that
  first surfaced the need for this document; its three resolution
  paths (§4 there) are what §7 item 2 here still leaves open.
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
  consumer (`theme.representations`) that motivates §2's Representation
  subsection.
