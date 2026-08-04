# Place · Frame · Paper · Art Model V2 — Rollout Status

Companion to the frozen spec `docs/PLACE_FRAME_MODEL_V2.md`. This doc tracks **what's shipped, what's pending, and what's deferred** — so anyone joining V2 mid-rollout can see the current state without archaeology through `git log`.

Naming/pairing convention mirrors `docs/ENGINE_V2_SCENE_MODEL.md` + `docs/ENGINE_V2_PROMOTION_STRATEGY.md` — the spec stays frozen; this doc updates as phases land.

---

## Shipped (Phases 1–7)

Every phase preserves Creator Governing Rule #1 (Fidelity) by keeping legacy Places byte-identical. Museum Gallery's canonical render hashes — landscape `1f54eb660f7beb53`, portrait `843e68f2cffb3c2e`, quote `969a67e5c984647b` — hold unchanged through the entire rollout.

| Phase | Commit | What landed |
|---|---|---|
| **Spec freeze** | `56c4109` | `docs/PLACE_FRAME_MODEL_V2.md` — the frozen product canon |
| **1 — Foundation** | `037cf3b` | New `js/placeFrameV2.js` with the layer skeleton shape + defaults |
| **2a — Model storage** | `cd740ca` | `ProjectModel.enableHolderV2Layers` / `.disableHolderV2Layers` / `.setHolderV2Layer` — Builder v2 can persist `holder.v2Layers` on a per-Place opt-in basis |
| **2b — Inspector UI** | `ffc9da3` | Builder Inspector shows the V2 authoring panel: Visible checkbox, Frame geometry, Frame border, Paper/Art fitMode, **content-kind picker only** (concrete values deferred) |
| **3 — Compile side** | `0adbd35` | `builder.js` carries `holder.v2Layers` through to compiled `placeRects[i].v2Layers`. Any future content field (image src, colour hex, shape id, experience id) rides through automatically |
| **4 — Studio render** | `8e82c22` | `renderer/slideRenderer.js`'s `_drawPlaceV2` — Paper → Art → Frame stack, Frame's geometry as the shared clip, Frame's own border. Dispatched on `_place.v2Layers` presence |
| **5 — Per-layer content** | `459c92c` | Studio draws every content kind the spec §3 names: Paper/Art get Image/Color/Shape; Frame gets Image/Shape overlay + Color (as 15% tint from Phase 4). Experience deferred (no-op) |
| **6 — Story-Author overrides** | `a497640` | Selection Action Strip's popup on a V2 Place: Frame geometry picker + Paper Colour Kit. `getPlaceV2Layers`/`isPlaceV2` accessors exposed. Overrides ride through `SceneEngine.setContentOverride` on flat `v2*` keys; can INTRODUCE content on a baseline-null layer, not just modify existing |
| **7 — Retire legacy fields** | `1c065a9` | On a V2 Place, compile step drops `frame`/`padding`/`fit`/`shape`. Legacy Places keep all four. State-based (v2Layers presence), not history-based |

**Verified regression suites** (all in scratchpad, one per phase): `placefram_v2_phase{1,2a,2b,3,4,5,6,7}_verify.js`. All pass. Both `goldenBuild.js` suites (World Builder v1 and v2) pass unchanged. Museum Gallery real-file byte-identical throughout.

---

## Pending — Theme-Author side (Builder v2)

The biggest visible gap: Phase 2b's Inspector lets a Theme Author pick each layer's **content kind** but not the actual **content value**. Nothing renders in Studio until content values are authorable. This is what the "Content attachment... lands in a follow-up phase" blurb refers to.

### 1. Content values (highest priority — blocks demo)

Compile step and Studio renderer already consume these; only the Builder Inspector UI is missing.

| Layer | Kind | Missing Builder control | Compiles to | Renderer reads |
|---|---|---|---|---|
| Paper | Colour | Colour swatch + Transparent checkbox | `paper.content.color` | ✅ Phase 5 |
| Paper | Image | Collection picker + Rotation | `paper.content.image` | ✅ Phase 5 |
| Paper | Shape | SHAPE_KINDS picker + fill/stroke | `paper.content.shape` (+ styling) | ✅ Phase 5 |
| Art | Colour | Colour swatch | `art.content.color` | ✅ Phase 5 |
| Art | Image | Collection picker + Rotation | `art.content.image` | ✅ Phase 5 |
| Art | Shape | SHAPE_KINDS picker | `art.content.shape` | ✅ Phase 5 |
| Frame | Image | Collection picker + Rotation | `frame.content.image` | ✅ Phase 5 |
| Frame | Shape | SHAPE_KINDS picker | `frame.content.shape` | ✅ Phase 5 |
| Any | Experience | Experience attach picker | `<layer>.content.experienceId` | ❌ (spec §3: additive overlay, unbuilt) |

### 2. Transform stack (spec §4)

Approved and in scope for V2; not yet in compile, model, or Inspector.

| Transform | Layers | Status |
|---|---|---|
| Rotation (2D Z) | Frame/Paper/Art | Model + compile + Inspector + render — all missing |
| Tilt (3D X/Y skew) | Frame/Paper/Art | Same; needs new draw pipeline (canvas `setTransform` affine) |
| Perspective (vanishing point) | Frame/Paper/Art | Same; needs 4-point mapping or WebGL step |
| Resize (w/h within layer max) | Frame/Paper/Art | Would produce mat gap via Paper smaller than Frame |

### 3. Bounds & layout (§2 "Max size / Min size")

| Missing | What it does |
|---|---|
| Paper `bounds.w/h` control | A Paper smaller than Frame creates the mat gap — the entire mat concept flows from this |
| Art `bounds.w/h` control | Independent Art bounds within Frame |
| Frame internal padding | Distance from Frame edge to Paper/Art bounds |

### 4. Per-layer author permissions (§2 "Honor" cell)

Builder still has ONE permission block for the whole Place (moveable/editable/visible/resizable/rotatable). Spec grammar's "Honor" cell wants permissions PER LAYER.

| Missing | Example use |
|---|---|
| Per-layer visibility permission | Let Story Author hide Paper but not Frame |
| Per-layer content-edit permission | Let them recolour Paper but not swap Frame's ornament |
| Per-layer transform permission | Let them rotate Art but keep Frame straight |

---

## Pending — Story-Author side (Studio Selection Action Strip)

Phase 6 shipped only Frame geometry and Paper colour. Everything else the Theme Author eventually authors (from the table above) needs a matching Story-Author-facing override control if the layer's `editable` permission is on.

| Story-Author control | Currently in popup | Notes |
|---|---|---|
| Frame geometry | ✅ | Phase 6 |
| Paper colour | ✅ | Phase 6 |
| Art colour | ❌ | Trivial once Theme-Author side ships |
| Paper/Art image swap | ❌ | Reuse Collection picker |
| Paper/Art shape swap | ❌ | Reuse SHAPE_KINDS picker |
| Paper/Art rotation | ❌ | Follows transform stack |
| Frame border colour / width | ❌ | Trivial once controls are wired |
| Frame content swap (image/shape) | ❌ | Reuse pickers |

Override storage uses flat `v2*` keys already established in Phase 6 (`v2FrameGeometry`, `v2PaperContentColor`, etc.) via `SceneEngine.setContentOverride`. `_v2ResolveEffectiveLayers` (Phase 6) already materializes a default layer when the compiled baseline is null but any override exists — so a Story Author can INTRODUCE content the Theme Author never authored, not just modify.

---

## Pending — Both sides (deferred capabilities)

These the spec explicitly approves but names as large, dedicated efforts. Each is its own multi-file phase:

- **Tilt** — 3D X/Y skew. Needs new draw pipeline in both `renderer/slideRenderer.js` (Studio) and `tools/world-builder-v2/js/services/engineRuntime.js` (Builder Working View), kept in lockstep by hand per the twin-engine discipline.
- **Perspective** — vanishing-point warp. Needs 4-point mapping or a WebGL step. Larger than Tilt.
- **Experience as additive overlay** — spec §3 says an Experience can attach to any V2 layer and composites additively on top of that layer's own primary content. Today's Experience system is a top-level object with parts; wiring it as a per-layer overlay is a real integration.

---

## Not touched — Builder v2 Working View (`engineRuntime.js`)

**Real, disclosed gap.** Phase 4 shipped V2 rendering in Studio (`renderer/slideRenderer.js`) but did NOT extend Builder's own Working View / Runtime Preview to render V2. Builder still renders V2 Places through the legacy `_paintHolder` code path — which reads `holder.frame`/`.padding`/`.fit`/`.shape` (untouched on the live editable object, unrelated to the compiled retirement) — so a Theme Author currently sees a default legacy render for a V2 Place in Builder, not the V2 stack.

This is a genuine Fidelity gap between Builder's preview and Studio's real render. It's arguably the "Phase 4.5" that got skipped — extending `engineRuntime.js` to route V2 Places through a V2 draw path mirroring Studio's own `_drawPlaceV2`. Not blocking (Studio renders correctly for a published Theme), but Builder is currently a misleading preview for V2 authoring work.

---

## Suggested next-ship order

If picking one thing to ship next:

1. **Paper Colour value + Paper Image + Art Colour + Art Image** in Builder Inspector — smallest meaningful surface, unblocks a demo Theme Author from producing anything visible. Reuses `_renderCollectionPickerCore` and standard colour-swatch discipline. Would be a natural **Phase 8**.
2. **Frame Image + Frame Shape** in Builder Inspector — completes content-value authoring for all three layers.
3. **Builder Working View V2 render** (`engineRuntime.js`) — closes the Builder-preview Fidelity gap so a Theme Author actually sees what they're authoring.
4. **Per-layer Rotation** — reuses today's rotation pipeline; small.
5. **Per-layer Story-Author overrides** to match every new Theme-Author control.
6. **Per-layer permissions** — restructures the Inspector's permission block.
7. **Bounds/Resize** — needs bounds visualization in Builder.
8. **Tilt** — new draw pipeline.
9. **Perspective** — new draw pipeline.
10. **Experience as per-layer additive overlay** — integration effort.

Each step above is independently shippable, verify-testable in the scratchpad, and preserves legacy byte-identical rendering by construction.

---

## Related canonical docs

- `docs/PLACE_FRAME_MODEL_V2.md` — the frozen spec this rollout implements.
- `docs/ENGINE_V2_SCENE_MODEL.md` — Scene/Canvas/Holder/Layer/Element ownership (unchanged by V2).
- `docs/THEME_PROJECT_SPEC.md` §6 — Frame Variation field list, governs the legacy schema V2 replaces.
- `docs/THEME_CONTRACT.md` — Studio consumer parity contract.
- CLAUDE.md → Creator Governing Rules #1 (Fidelity) and #5 (Publish Fidelity) — every phase must satisfy both.
