# Engine V2 Promotion Strategy — Can It Become the Shared Platform Runtime?

**Status:** Investigation + strategy proposal. Not yet approved, not yet
implemented. Per the request that generated it: *"Assume Builder's
authoring architecture is frozen... Do not redesign Builder... The goal
is to migrate runtime consumers, not rebuild the authoring system."*
Nothing in this document proposes touching World Builder's Scene/Holder/
Layer authoring model, the compiled Theme Contract, or any already-
published Theme. Everything proposed lives on the Studio (consumer) side.

**Scope note:** this document evaluates promoting `tools/world-builder-v2/
js/services/engineRuntime.js` ("Engine V2") into a runtime shared by
Builder Preview, Creator Canvas, Publish, and eventually a Reader,
replacing `renderer/slideRenderer.js` ("Engine V1") incrementally. It
does not restate `docs/ENGINE_V2_SCENE_MODEL.md` (the canonical Scene
Model spec) or `docs/THEME_CONTRACT.md`/`docs/THEME_TO_CREATOR_MAP.md`
(Builder⇄Studio parity and Creator-surface mapping) — it answers a
question none of those three do: *is the engine itself ready to be
promoted, and if not, what would it take.*

---

## Verdict, up front

**Engine V2 cannot be promoted today.** Not because it's badly built —
it's clean, pure, and standalone — but because of one confirmed, load-
bearing fact: **it has no code path that consumes a compiled `.vtheme`
package at all.** It only ever renders a *live Builder authoring
session's* in-memory Scene objects, resolving Frame references through
Builder's own global `ProjectModel`. Every field a real Published Theme
actually carries — `layouts`, `frameVariations`, `layerPack`,
`representations`, `slide`, `holder`, `frame`, `panel`, `storyText`,
`footerText`, `watermark` — has **zero** grep hits anywhere in
`engineRuntime.js`. Museum Gallery, the one real Official World this
platform has shipped, would render as an empty backdrop through Engine
V2 today, because nothing feeds it Museum Gallery's actual authored
content in a shape it understands.

Promoting Engine V2 is therefore not a "swap the renderer" task. It's a
**parity-building program**: teach Engine V2 to consume the compiled
Theme Contract, and teach it the large fraction of Engine V1's rendering
vocabulary that has no Engine V2 equivalent today, *before* any real
consumer can safely move to it. This document proposes how to do that
incrementally, consumer by consumer, without redesigning Builder and
without ever leaving the platform in a state where a Published Theme
renders differently depending on which surface shows it.

---

## 1. What Engine V2 can actually do today (verified, not doc-claimed)

`engineRuntime.js` is genuinely standalone — confirmed via grep, it has
zero dependency on `window.ProjectModel`, `currentProject`, or anything
under `js/`/`renderer/`; its only external read is `window.EngineSchema`.
Its public API is five pure-ish functions: `load(scene, resolveFrame,
representativeImage, resolveLayerImage)`, `render(ctx, graph)`,
`rectFor`, `holderBands`, `textFootprint`, plus `paintLayer` for single-
layer painting.

What it renders, concretely:

- **Holder/Frame bands** — the full AV-003 8-field system (wallTone,
  borderColor, cornerRadius, shadow presets, inset, matWidth,
  defaultMargin, frameThickness) as four concentric filled bands. Real
  and correct for flat mat/border/shadow framing — but **structurally
  simpler** than Engine V1's frame system: no named ornament presets
  (storybook/polaroid/ribbon/wooden/magic/vintage/tape/cloud), no paper
  texture, no lighting overlay, no bulletin pins, no artwork caption.
- **Holder content** — one externally-supplied `representativeImage` or
  a placeholder glyph, with Fit/Fill/Original. No per-Scene authored
  photo path exists yet (`load`'s own comment: `representativeImage` is
  "a stand-in for the not-yet-authored Primary Element").
- **Decoration** — fill, 13-kind vector Shape (richer than Engine V1's
  hand-mirrored 5-kind subset), image, glyph fallback.
- **Text** — real word-wrap. This is a genuine capability Engine V1
  *lacks* for the analogous case: Engine V1's Scene text draw calls
  (`_drawSceneText`/`_drawSceneTextHolder`) call `fillText` once, no
  wrapping at all — only the separate Cover/Hook Quote path wraps text.
  Engine V2 is *ahead* of Engine V1 here.

Canvas sizing is also a real, structural difference: Engine V2 sizes the
canvas per-aspect (landscape 1350×1080, wide 1600×900, full-bleed
1080×1920, …) via `EngineSchema.ASPECT_RATIOS`. Engine V1 has **one
fixed logical canvas, 1080×1350, always** — "aspect" there only picks a
composition rect *inside* that fixed canvas. These are two different
canvas models, not the same model wearing different clothes — a shared
runtime has to pick one (see §4).

Every real call site of `EngineV2Runtime.load`/`.render` — confirmed by
a repo-wide grep — is inside `tools/world-builder-v2/js/worldBuilderApp.js`'s
own Working View, Runtime Preview, and thumbnail strips. Nothing outside
World Builder's own preview surfaces has ever called it.

## 2. What Engine V1 provides that any shared runtime has to match

Engine V1 is the mature engine — it is what every real Published Theme
and every Reader-facing export depends on today. Confirmed feature
surface with no Engine V2 equivalent at all:

- **Layer Pack's 5 containership scopes** (`slide`/`frame`/`holder`/
  `element`/`overlay`) with declarative anchor/offset/`scope`-to-Layout
  gating — the entire mechanism Museum Gallery's Museum Caption, Wax
  Seal, and Gallery Spotlight are built from.
- **Artwork Themes as an independent theme-layering dimension** on top
  of a Story Theme — Engine V2 has one Frame Theme Asset reference per
  Holder, not a second theme axis.
- **Frame Variations** (named field bundles + the 7-preset ornament
  pipeline above).
- **Layout `composition` variants reshaping the whole draw pipeline** —
  most importantly `quote`, which skips Frame/Holder entirely for a
  centered, word-wrapped quote. Engine V2's Scene Templates are an
  authoring-time starting shape, not a runtime composition switch.
- **Presentation Presets** (`ThemePresets`' three-tier Preset→Override→
  Default resolution) — no analogous indirection layer in Engine V2.
- **Page furniture** — Handle, Footer/book-title, Page Number, and the
  fixed decorative glyph set (stars/clouds/birds/trees/flowers), each
  with its own position-enum and visibility control. Engine V2 has no
  "page furniture" role — only freeform Scene Layers.
- **Wall-tone-driven chrome-text-color luminance switching.**
- **The full per-image adjustment stack** — crop, focal point,
  straighten, brightness/contrast/highlights/shadows/warmth/saturation/
  sharpness, vignette. Engine V2's Holder has only Fit.
- **The Cover/Hook/End blueprint pipeline** — a second, mutually-
  exclusive rendering path for non-Story-role pages. Engine V2 has one
  uniform Scene model for every page type; nothing maps Cover/Hook/End
  blueprint elements onto it today.
- **The DPR-aware `init(canvas,{dpr})` WYSIWYE mechanism itself** — the
  single canonical `buildPayload()` plus fixed-logical-canvas-with-
  scaled-backing-store technique that makes the editor, thumbnails, and
  the Carousel Portrait export byte-identical (a verified, documented
  product guarantee, not an incidental detail). Nothing describes an
  equivalent in Engine V2's own spec.

Every real consumer of Engine V1 was also mapped: the live editor canvas
(`js/app.js`), thumbnail generation (`js/thumbnails.js`), Preview Studio,
per-page PNG export (`js/pageOps.js`), Publish Studio's Read/cover
renders, and the actual export engine (`js/storyDestinations.js` — Story
Book PDF, Story Carousel PNG; Story Reel is not even wired to a renderer
yet, a pre-existing gap unrelated to this question). One useful existing
precedent: World Builder **already** calls Engine V1 directly in places
(its own `SlideRenderer.init/render/getCanvasSize/getPanelRect` calls,
`buildPreviewSlide`'s legacy-specimen path per AV-005) — Engine V1 is
already dual-purposed across both apps today, which is worth remembering
when arguing "a shared runtime has never been done here before." It has,
just in the other direction.

No live "Reader" surface exists anywhere in the codebase — only static
PDF/PNG exports. This confirms the request's own framing ("eventually
Reader") is correctly forward-looking, not a near-term migration target.

## 3. The central blocker, restated precisely

`tools/world-builder-v2/js/services/builder.js`'s `convergeSceneLayer`/
`convergeScene` is a real, **one-way** translation: Builder's in-memory
Scene Model → Engine V1's compiled `theme.layerPack`/`layouts`/
`representations` shape. No reverse function exists anywhere — nothing
turns a compiled `.vtheme` back into something `engineRuntime.js`'s
`load()` can accept. This is *why* Studio (the real Published-Theme
consumer) has never been able to use Engine V2: the door only opens one
way, and it was built to feed Engine V1, not to feed Engine V2.

This is the one new thing this strategy actually requires building: a
**second, additive translation** — compiled `.vtheme` → Engine V2 Scene
Model shape — living entirely on the Studio side, touching neither
Builder's authoring model nor the compiled package format itself.

## 4. What "promotion" actually requires

Two separable pieces of work, in this order:

**(a) A compiled-package-to-Scene-Model adapter.** A new, additive
module (proposed: `js/engineV2Adapter.js`, mirroring
`convergeSceneLayer`'s own naming) that reads a resolved theme
(`ThemeEngine.resolveTheme()`+`getOptions()`, the same resolution
Engine V1's `buildPayload()` already does) and a slide, and produces a
synthetic Scene object plus a `resolveFrame` callback — in exactly the
shape `EngineV2Runtime.load()` already accepts, with zero changes to
`engineRuntime.js` itself. This is where the real work is: this adapter
has to *decide* how each V1-only concept (§2's list) maps onto Engine
V2's vocabulary, or explicitly declines to for now:
  - Layer Pack's 5 scopes → Engine V2 Scene Layers with a computed
    `rect` (this direction already has real precedent — it's the exact
    reverse of what `convergeSceneLayer` already does one way).
  - Frame Variations' 8 fields → already directly compatible with
    `_paintHolder`'s existing band system (AV-003 built exactly this
    vocabulary); the *ornament presets* (storybook/polaroid/etc.) are
    the real gap — Engine V2 has no equivalent drawing routines, so
    these would need to either be added to `engineRuntime.js` (an
    Engine V2 capability extension — allowed, since we're not
    redesigning Builder, we're extending the runtime) or the adapter
    honestly degrades them to the closest flat-band equivalent,
    disclosed as a fidelity loss, not silently.
  - Layouts/`composition` (especially `quote`) → maps reasonably onto
    Engine V2's aspect+Scene-Template vocabulary for the geometry, but
    `quote`'s actual no-Frame centered-text draw routine doesn't exist
    in `engineRuntime.js` and would need to be added there.
  - Page furniture (Handle/Footer/PageNumber/decorations) → has no
    Engine V2 concept at all. Either add a "page furniture" Layer kind
    to Engine V2 (a real, scoped extension) or keep this one narrow
    slice on Engine V1 permanently and accept a small, disclosed hybrid
    (see §6).
  - The Cover/Hook/End blueprint pipeline → the adapter would need its
    own translation from `SceneEngine.getRenderData()` into synthetic
    Scene Layers, a second mapping alongside the Layer Pack one.

**(b) Canvas-model reconciliation.** Engine V2's per-aspect variable
canvas has to be reconciled with Engine V1's fixed-1080×1350-plus-DPR
model, because the WYSIWYE guarantee (byte-identical editor/thumbnail/
Carousel-export) is real, tested, documented product behavior that
cannot regress. The lower-risk choice is keeping Engine V1's fixed
logical-canvas-plus-DPR convention as the outer contract every consumer
still calls into, with the adapter feeding Engine V2 whatever pixel
dimensions the resolved Layout implies — i.e., Engine V1's `init(canvas,
{dpr})` stays the entry point every consumer keeps calling; only what
happens *inside* a render call changes, consumer by consumer, as it
migrates.

Neither of these touches Builder's authoring model, the Theme Contract,
or a single published `.vtheme`. Both are new, additive Studio-side (and
disclosed, scoped Engine V2) code.

## 5. Migration strategy — consumer by consumer, not feature by feature

The Decoration Shapes precedent (Engine V1's shape-drawing "added by
hand, in lockstep" with Engine V2's) is a live demonstration of what
goes wrong with a *feature-by-feature* split: two implementations of the
same thing, manually kept in sync, forever. A promotion strategy that
moves one feature onto Engine V2 while everything else stays on Engine
V1 **for the same consumer** reproduces this problem at platform scale.
The safer shape is: each *consumer* renders 100% through one engine at a
time — never a page half-rendered by V1, half by V2.

**Phase 0 — Build the adapter in isolation, wire nothing.**
`js/engineV2Adapter.js` gets built and unit-verified against real
Published Theme data (Museum Gallery) with **zero call sites** touching
any real UI. Verification: feed Museum Gallery's resolved theme through
the adapter into `EngineV2Runtime.load/render`, pixel-sample against
Engine V1's real output for the same slide, and catalog every visible
difference (ornament presets, page furniture, quote composition) as
either "fixed this phase" or "disclosed gap, deferred."

**Phase 1 — Migrate the lowest-stakes, most isolated consumer first.**
Candidate: World Builder's own `_sceneCardThumb`/`_sceneStripCard`
thumbnails are already on Engine V2 — the next lowest-stakes *Studio*
consumer is Card Designer's `drawFrameSwatch` (an isolated, small-scope
preview with no WYSIWYE obligation) or `ThumbnailEngine.generate()` (a
one-shot, already-DPR-forced, already-restores-canvas-afterward call
site with no live interactivity). Migrate one, verify pixel parity
against Engine V1's output for every existing Published Theme, ship
behind no flag needed (a one-shot render either matches or it doesn't —
no partial states to hide).

**Phase 2 — Move the export engine.** `js/storyDestinations.js`'s
`_renderSlideInto` is the next candidate: still one-shot, still
`dpr:1`-forced, but now load-bearing for real Reader-facing output (PDF,
Carousel PNG). Requires the adapter to have closed every gap that shows
up in a real exported page — this is where page-furniture and quote-
composition parity actually has to be finished, not deferred.

**Phase 3 — Move the live editor canvas.** The highest-stakes migration:
`js/app.js`'s `draw()` loop, with its editor-only chrome (selection
outlines, drag guides, safe-area) layered on top. Only attempted once
Phases 1-2 have proven full-fidelity parity across every existing
theme, since this is the surface a real child interacts with every
keystroke.

**Phase 4 — Retire Engine V1**, only after every real consumer has
migrated and a full regression pass (every existing Playwright suite,
`goldenBuild.js`, and a manual pass against Museum Gallery) shows zero
behavior change. `renderer/slideRenderer.js` is not deleted until this
phase — it stays the fallback/reference implementation throughout
Phases 0-3.

**Phase 5 (future, not scoped here) — Reader.** Once Engine V2 is the
platform runtime, a live interactive Reader becomes a new consumer of
the same `load()`/`render()` pair, not a new rendering implementation.
Explicitly out of scope for this strategy beyond noting it becomes
possible once Phase 4 completes.

## 6. What stays frozen, explicitly

- Builder's Scene/Holder/Layer authoring model, permission system,
  Experience system — completely untouched. Every proposed change is
  new code reading *from* the compiled package or Builder's existing
  Scene Model, never a change to how a Theme Author authors anything.
- The compiled `.vtheme` shape (`docs/VTHEME_PACKAGE_SPEC.md`) — not
  extended or altered by this strategy; the adapter reads what already
  exists.
- Every already-published Theme (Museum Gallery, and any future one) —
  renders identically throughout every phase, verified at each step
  before moving to the next consumer.
- `convergeSceneLayer`'s one-way Build-time translation — unchanged;
  the new adapter is a second, independent translation living entirely
  in Studio's render path, not a replacement for it.

## 7. Open risks and deliberately unresolved questions

- **Ornament-preset fidelity** (storybook/polaroid/ribbon/wooden/magic/
  vintage/tape) has no Engine V2 equivalent and is real, non-trivial
  drawing work to add — sized here as "the largest single fidelity gap
  the adapter will surface," not solved by this document.
- **Whether to extend `engineRuntime.js` itself** with these missing
  drawing routines (a scoped Engine V2 capability addition) or to keep
  a small permanent hybrid (some page furniture stays Engine-V1-only
  forever) is a real product decision, not resolved here — flagged for
  explicit sign-off before Phase 2 needs it.
- **The Cover/Hook/End blueprint pipeline's mapping onto Engine V2** is
  sketched only at the concept level in §4(a); a full field-by-field
  mapping (mirroring `docs/THEME_PROJECT_SPEC.md`'s own "Builder
  Convergence Sprint — Scene Convergence" precedent) is real follow-up
  work before Phase 3.
- **Performance** — Engine V2's per-object band/shape drawing was never
  measured against Engine V1's at editor-interaction frequency (every
  drag-move frame); Phase 3 needs a real performance pass before
  shipping, not assumed safe by this document.

---

This document is a strategy proposal, not an implementation plan for any
single phase — per the standing "architecture changes require explicit
approval" rule, Phase 0 (the isolated, zero-call-site adapter) is the
smallest concrete next step and would itself need sign-off before any
code is written.
