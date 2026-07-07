# Builder V2 — The Engine Compile Gap

**Status:** **Resolved and implemented.** This document originally
disclosed an unresolved implementation blocker, written during Builder
V2 implementation (not design) — it is not a sixth design document
alongside `ENGINE_V2_CANON.md`/`BUILDER_V2_MENTAL_MODEL.md`/
`BUILDER_V2_STORYBOARD.md`/`BUILDER_V2_BLUEPRINT.md`/`BUILDER_V2_UX_PACKAGE.md`/
`BUILDER_V2_VISION.md` — it did not propose a design, only recorded a
gap those six documents left open. That gap is now closed: the
architectural resolution (§4 below) was made explicitly (a native
Engine V2 Runtime, `docs/ENGINE_V2_SCENE_MODEL.md` §7/LOCK V2-04), and
every stage this document named as blocked has since been implemented
directly against the canonical Scene Model — `tools/world-builder/js/services/engineRuntime.js`
(Runtime), `engineValidator.js` (Validation), `engineBuilder.js`
(Build), and matching "Scenes (Engine V2)" sections in the Validation/
Build/Publish screens (Publish: Export only so far, disclosed below).
The rest of this document is preserved as the historical record of the
gap and the reasoning that led to its resolution, not rewritten.
**Scope:** Why `tools/world-builder`'s Validation, Build, and Publish
screens (Blueprint §12–§14) could not be extended to cover Scenes
without a product decision this document did not make — and, as of the
Status above, how that decision was made and acted on.

---

## 1. What has been built

Builder V2's Scene Editor — Scene Header (Scene Configuration), Place,
Decorations, and Text — is now fully implemented against Engine V2's
object model (`docs/ENGINE_V2_CANON.md`), authoring real, persisted data:

- `scenes/<id>.json` — Canvas configuration (Aspect Ratio, Safe Area),
  Holders (Position/Size/Shape/Padding/Fit/Frame), Scene Layers
  (Decorations and Text Elements), and a Scene Stack (`stack`) ordering
  them all, bottom to top, exactly as Engine Canon §5 describes.
- A Theme Author can, right now, build a real multi-Scene World with
  real Holders, decorations, background, and text, edit their Base
  Object permissions, and see it rendered live in Working View and
  Runtime Preview.

None of this touches `js/services/validator.js`, `js/services/builder.js`,
or `js/projectCompiler.js` — all three are byte-for-byte unchanged from
before Builder V2 implementation began.

## 2. Why they're unchanged, not merely unfinished

Validation, Build, and Publish exist to answer one question: *does this
World Project compile into a `.vtheme` package the Runtime
(`js/themeEngine.js`, `renderer/slideRenderer.js`) can actually render?*
That question has a real, working answer for Engine V1 data
(`representations/`, `layouts/`, `frames/`, `layer-packs/`) — that is
what the current validator/builder/Runtime all speak.

**No frozen document defines what a compiled Engine V2 package looks
like, or how the Runtime would render a Scene/Canvas/Holder/Layer/
Element tree.** Concretely:

- `docs/ENGINE_V2_CANON.md` specifies the *object model* in full — but
  is explicit in its own §0 that it describes "the object model,
  ownership rules, rendering pipeline, and universal invariants," not a
  file format. It has no equivalent of `docs/THEME_PROJECT_SPEC.md` or
  `docs/VTHEME_PACKAGE_SPEC.md` for Engine V2.
- `js/themeEngine.js` and `renderer/slideRenderer.js` — the actual
  Runtime — have zero code path that reads a `scene.holders`/
  `scene.layers`/`scene.stack` shape. They resolve
  Representation → Layout + Frame + Layer Pack, the Engine V1 model,
  exclusively.
- The six frozen Builder V2 documents describe Builder V2's own screens
  and workflows in detail, but every one of them explicitly scopes
  itself to "the Builder," not "the Engine" — `docs/BUILDER_V2_BLUEPRINT.md`'s
  own opening line is "Do not invent implementation... Do not discuss
  data structures," and `docs/ENGINE_V2_CANON.md §0` says plainly this
  canon "does not describe the Engine V1 / World Builder object model
  except where explicitly noted for continuity" — it was never asked to
  define a V1→V2 migration or compile path, and doesn't.

Extending `validator.js`/`builder.js` to accept Scenes, or teaching the
Runtime to render one, would mean *inventing* that missing specification
mid-implementation — precisely the "changing architecture" this
implementation phase's own brief says to stop before doing, not work
around quietly.

## 3. What this blocked, concretely (historical — see §0 Status)

- **Validation** could not meaningfully validate a Scene's Holders/
  Layers against anything, because there was no contract to validate
  them against. **Resolved:** `tools/world-builder/js/services/engineValidator.js`
  checks every Scene against Scene Model §5's four named constraints.
- **Build** could not compile Scenes into the `.vtheme` package, because
  no format existed for them to compile into. **Resolved:**
  `tools/world-builder/js/services/engineBuilder.js` compiles a
  validated World's Scenes into a package — deliberately a new, plain
  JSON format (`<id>.v2world.json`), not `.vtheme`, since the two are
  not interchangeable (Scene Model §5/LOCK V2-02).
- **Publish** shipped whatever Build produced — with nothing to add.
  **Resolved, partially by design:** Publish now offers Export for the
  Engine V2 package; Official/Community are not offered for Engine V2
  yet, since no standalone Engine V2 Runtime exists outside this
  Builder for such an install to target — a disclosed scope boundary,
  not a remaining blocker of the kind this document originally recorded.

A Theme Author can fully author Scenes in Builder V2, and that
authoring work now has a real path to becoming a package a Runtime can
load — the native Engine V2 Runtime implemented directly inside this
Builder's own Working View/Runtime Preview (`docs/ENGINE_V2_SCENE_MODEL.md`,
LOCK V2-04). The bridge this section originally said didn't exist now
does.

## 4. Paths forward — not decided here

**Resolved after this document was written** — see
`docs/ENGINE_V2_SCENE_MODEL.md` §7/LOCK V2-04: by explicit architectural
decision, path 1 (a genuine Engine V2 Runtime) is the chosen resolution;
paths 2 and 3 below are rejected outright. Validation, Runtime, Build,
and Publish will operate directly on the canonical Scene Model that
document defines — no translation layer to Engine V1, no permanent
parallel Runtime architecture. The three paths are left below,
unedited, as the historical record of what this document considered
before that decision was made:

Three shapes a resolution could take, listed to make the decision
concrete, not to pick one:

1. **A genuine Engine V2 Runtime.** `js/themeEngine.js`/
   `renderer/slideRenderer.js` gain a real Scene/Canvas/Holder/Layer/
   Element rendering path, and a new compiled-package spec
   (`docs/ENGINE_V2_VTHEME_SPEC.md`, or similar) defines how `scenes/*.json`
   serializes into it. This is an Engine-level project in its own
   right, not a Builder sprint.
2. **A translation layer.** Build/Validate compile a Scene down into an
   equivalent Engine V1 Representation/Layout/Frame/Layer-Pack set
   (Canvas → Layout's aspect; Holders → the Frame/positioning fields;
   Scene Layers → a Layer Pack), so the *existing* Runtime keeps working
   unmodified. This requires deciding, for every Engine V2 concept, its
   nearest Engine V1 equivalent — a real design exercise (Text
   typography and multiple independent Holders don't map cleanly onto
   today's single-Frame-per-Representation model), not a mechanical
   rename.
3. **Two parallel authoring surfaces, indefinitely.** Scenes stay a
   Builder-only authoring convenience (a richer *planning* view) while
   Representations/Layouts/Frames/Layer Packs remain the only thing that
   actually compiles — accepting real duplication of effort for a Theme
   Author who wants both.

None of these is implied as preferred by anything written so far. Each
has a real cost; picking one is exactly the kind of decision Engine
Canon's own §12 ("Open Decisions for Product Sign-off") models — a
deliberate product call, not a default to fall into.

## 5. What was deliberately not done instead

To be explicit about the discipline followed here, consistent with this
phase's own brief:

- Validator/builder/Runtime code was **not** quietly extended to
  half-support Scenes (e.g., silently treating a Scene's first Holder as
  a Representation's Frame) — that would be exactly the kind of
  undisclosed architecture change the brief prohibits, dressed up as an
  implementation detail.
- No new compiled-package format was invented unilaterally to unblock
  Build, since format design is squarely an Engine-level decision this
  document is scoped not to make.
- Builder V2's own UI/authoring work continued everywhere it did not
  depend on this decision (Scenes, Place, Decorations, Text, Scenes
  Library polish) — this gap blocks Validation/Build/Publish
  specifically, not the rest of Builder V2.

## Cross-references

- `docs/ENGINE_V2_CANON.md` — the object model this gap is about; §0
  already scopes itself away from defining a compile format.
- `docs/BUILDER_V2_BLUEPRINT.md` §12–§14 — the Validation/Build/Publish
  screen specifications this gap prevents from being implemented against
  Scenes.
- `docs/THEME_PROJECT_SPEC.md` / `docs/VTHEME_PACKAGE_SPEC.md` — the
  Engine V1 equivalents this document's §2 points out have no Engine V2
  counterpart yet.
- `docs/ENGINE_V2_SCENE_MODEL.md` — written after this document, in a
  follow-up documentation-only sprint. It formalizes §2's "what is the
  canonical Scene data" half of this gap (already answered — Builder V2
  has been producing it since Slice 1) as canonical, and its §7/LOCK
  V2-04 resolves §4's resolution-path choice: a native Engine V2
  Runtime, no translation layer, no permanent parallel architecture.
