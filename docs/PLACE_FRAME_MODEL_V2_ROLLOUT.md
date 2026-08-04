# Place · Frame · Paper · Art Model V2 — Rollout Status

Companion to the frozen spec `docs/PLACE_FRAME_MODEL_V2.md`. This doc tracks **what's shipped, what's pending, and what's deferred** — so anyone joining V2 mid-rollout can see the current state without archaeology through `git log`.

Naming/pairing convention mirrors `docs/ENGINE_V2_SCENE_MODEL.md` + `docs/ENGINE_V2_PROMOTION_STRATEGY.md` — the spec stays frozen; this doc updates as phases land.

**Status: the V2 rollout is COMPLETE.** All 16 phases are shipped. Nothing from the spec's approved scope remains pending.

---

## Shipped (Phases 1–16)

Every phase preserves Creator Governing Rule #1 (Fidelity) by keeping legacy Places byte-identical. Museum Gallery's canonical render hashes — landscape `1f54eb660f7beb53`, portrait `843e68f2cffb3c2e`, quote `969a67e5c984647b` — hold unchanged through the entire rollout.

| Phase | Commit | What landed |
|---|---|---|
| **Spec freeze** | `56c4109` | `docs/PLACE_FRAME_MODEL_V2.md` — the frozen product canon |
| **1 — Foundation** | `037cf3b` | New `js/placeFrameV2.js` with the layer skeleton shape + defaults |
| **2a — Model storage** | `cd740ca` | `ProjectModel.enableHolderV2Layers` / `.disableHolderV2Layers` / `.setHolderV2Layer` — Builder v2 can persist `holder.v2Layers` on a per-Place opt-in basis |
| **2b — Inspector UI** | `ffc9da3` | Builder Inspector shows the V2 authoring panel: Visible checkbox, Frame geometry, Frame border, Paper/Art fitMode, content-kind picker (concrete values came in Phase 8) |
| **3 — Compile side** | `0adbd35` | `builder.js` carries `holder.v2Layers` through to compiled `placeRects[i].v2Layers`. Any future content field rides through automatically |
| **4 — Studio render** | `8e82c22` | `renderer/slideRenderer.js`'s `_drawPlaceV2` — Paper → Art → Frame stack, Frame's geometry as the shared clip, Frame's own border. Dispatched on `_place.v2Layers` presence |
| **5 — Per-layer content** | `459c92c` | Studio draws every content kind the spec §3 names: Paper/Art get Image/Color/Shape; Frame gets Image/Shape overlay + Color (as 15% tint from Phase 4) |
| **6 — Story-Author overrides** | `a497640` | Selection Action Strip's popup on a V2 Place: Frame geometry picker + Paper Colour Kit. `getPlaceV2Layers`/`isPlaceV2` accessors exposed. Overrides ride through `SceneEngine.setContentOverride` on flat `v2*` keys; can INTRODUCE content on a baseline-null layer, not just modify existing |
| **7 — Retire legacy fields** | `1c065a9` | On a V2 Place, compile step drops `frame`/`padding`/`fit`/`shape`. Legacy Places keep all four. State-based (v2Layers presence), not history-based |
| **8 — Content value editors** | `6d1de6b` | Builder Inspector authors the actual content VALUES: Paper/Art/Frame get Colour swatch (+ Transparent + Opacity), Collection image picker (+ Rotation + Fit), SHAPE_KINDS picker (+ fill/stroke styling). Reuses `_renderCollectionPickerCore` and the standard colour-swatch discipline |
| **9 — Builder Working View V2 render** | `eb0d103` | `engineRuntime.js`'s `_paintHolderV2` — Builder's own Working View / Runtime Preview renders the V2 stack, hand-mirroring Studio's `_drawPlaceV2` per the twin-engine discipline. Closes the Builder-preview Fidelity gap |
| **10 — Per-layer Rotation** | `fc392f9` | Rotation (2D Z) on Frame/Paper/Art. Frame's rotation carries the whole stack (clip included); Paper/Art spin within the clip. Both engines |
| **11 — Bounds / resize / mat gap** | `cbe8eba` | Paper/Art `bounds.w/h` (Layer Width/Height %) + Frame internal padding (Mat Gap) — a Paper smaller than Frame produces the mat gap, the entire mat concept per spec §2 |
| **12 — Per-layer permissions** | `709a96d` | The spec grammar's "Honor" cell: per-layer Story Author Permissions block in the Inspector (visibility / content-edit / transform per layer), compiled through and enforced in Studio |
| **13 — Story-Author overrides, full surface** | `f8b7bee` | Selection Action Strip popup gains a control for every V2 knob the Theme Author can author — content swap (colour/image/shape), rotation, bounds — each gated on that layer's own Phase 12 permission end to end |
| **14 — Tilt** | `26f0797` | 3D X/Y skew as an affine shear (`setTransform`), Frame/Paper/Art, both engines hand-mirrored |
| **15 — Perspective** | `ba3a9e3` | Vanishing-point warp (receding-edge + strength) via a scanline-strip trapezoid mapper, both engines hand-mirrored |
| **16 — Experience as per-layer additive overlay** | `e89c2e7` | Spec §3/§6: an Experience attaches to any V2 layer and composites additively ON TOP of that layer's own primary content. See the design note below — this is a separate `layer.experience` field, **not** a content kind |

**Verified regression suites** (all in scratchpad, one per phase): `placeframe_v2_phase{1,2a,2b,3,4,5,6,7,8,9,10,11,12,13,14,15,16}_verify.js`. All pass. Both `goldenBuild.js` suites (World Builder v1 and v2) pass unchanged. Museum Gallery real-file byte-identical throughout.

---

## Design note — Experience is `layer.experience`, never a content kind

An earlier draft of this doc listed Experience as a fourth content-kind value (`<layer>.content.experienceId`). That was a mislabel and does not match the frozen spec or the shipped implementation. Spec §3/§6 defines Experience as **additive**: "never displaces the layer's own primary content." A content kind would do exactly that — it would occupy the slot the primary colour/image/shape lives in.

What actually shipped:

- **Live authoring model**: a separate, additive `layer.experience` field on any of frame/paper/art, holding a bare reference `{ id }`. The layer's own `content` (color/image/shape) is untouched.
- **Compiled form**: `builder.js` resolves the reference at Build time into a self-contained `{ id, parts }` — a published `.vtheme` has no Experience registry to resolve against, so the parts are inlined. Each part is `{ rect, content }`: `rect` is `{x,y,w,h}` in FRACTIONS OF THE LAYER'S OWN RECT (`null` = the whole rect); `content` is the same V2 content shape (`color`/`image`/`shape`), plus an overlay-only `text` kind (primary layers never hold text).
- **Paint order**: the overlay always paints AFTER the layer's own primary content, inside the same clip/transform stack — so it inherits the Frame geometry clip, rotation, tilt, and perspective automatically. Additive by construction.
- **Resolution**: Builder's live engine gets an injected resolver (`EngineV2Runtime.load(..., resolveV2Experience)` → `ProjectModel.resolveV2ExperienceOverlay`), keeping `engineRuntime.js` pure; Studio's renderer reads only the compiled inline `parts` and needs no resolver at all.
- **Eligibility** (`ProjectModel.eligibleV2OverlayExperiences`): Public Experiences attach anywhere; Personal only within their own `scopeSceneId`; Nurturing never — the established Experience lifecycle canon, unchanged.
- **Image externalization at compile**: overlay part images dedupe through Collection first (`collection/<id>.png`), else hydrate `vihu-asset:` refs, embedding at `v2exp/<sceneId>-<placeRectId>-<layerKind>-<i>.png`.
- **Scope decision, disclosed**: there are NO Story-Author overrides for the overlay — attaching an Experience is a Theme-Author act. A future phase could add permission-gated overrides if ever wanted; nothing structural blocks it.

---

## Deliberately out of scope (unchanged from the spec)

Nothing below is "pending" — these were never in the spec's approved V2 scope:

- Story-Author authoring of Experience overlays (see the scope decision above).
- WebGL/true-3D perspective (Phase 15's scanline mapper is the approved 2D-canvas approach).
- V2 layers on anything other than a Place (Scene-level layers keep the existing Scene Layer system).

---

## Related canonical docs

- `docs/PLACE_FRAME_MODEL_V2.md` — the frozen spec this rollout implements.
- `docs/ENGINE_V2_SCENE_MODEL.md` — Scene/Canvas/Holder/Layer/Element ownership (unchanged by V2).
- `docs/THEME_PROJECT_SPEC.md` §6 — Frame Variation field list, governs the legacy schema V2 replaces.
- `docs/THEME_CONTRACT.md` — Studio consumer parity contract.
- CLAUDE.md → Creator Governing Rules #1 (Fidelity) and #5 (Publish Fidelity) — every phase must satisfy both.
