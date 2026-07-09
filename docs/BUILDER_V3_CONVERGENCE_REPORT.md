# Builder V3 — Authoring Convergence Sprint Report

Repository: `dexprab/vihustudio`. This report accompanies the code changes made
during the Authoring Convergence Sprint — a pause-on-features, converge-toward-
one-pipeline pass, per the sprint's own explicit instruction ("this is about
convergence, not capability"). It does not redesign Engine V2, Runtime, or the
Builder's own architecture; every fix below reuses an existing mechanism.

## 1. What legacy authoring paths remain

- **The Frame picker inside Place** (`_renderFramePicker`, and the underlying
  "Manage Frames" screen / `frames/*.json` Theme Asset shelf). A Place's
  `holder.frame` field can point at either a plain Theme Asset Frame record
  (created via "+ Create Frame" in Manage Frames) or a Frame Experience's own
  mirrored Frame record — both are the same `frames/*.json` collection, and
  `_setHolderFrame` already routes Experience-backed selections through
  `attachExperience`/`detachExperience` correctly (fixed in the MEP Freeze
  audit). This dual nature is deliberately **not** touched this sprint — see
  §4, Architectural Blockers.
- **The per-object Scene Layer editors** — `_renderLayerPanel` (Decoration)
  and `_renderTextLayerPanel` (Text) — the panels shown when clicking an
  existing Decoration/Text object directly in the Scene's own Working View.
  These remain, deliberately, as **migration paths**: an object already on a
  Scene (Experience-backed or not) still needs some way to be repositioned,
  renamed, or removed by clicking it directly on the canvas — Working View's
  own click-to-select-and-drag interaction model (Blueprint §6.1) has no
  other route to an existing object's properties. Both panels already route
  Experience-backed field writes through `updateExperience`/
  `updateExperienceProperty` (the MEP Freeze audit's own fix), so editing an
  Experience-backed object through either surface never disagrees with the
  Experience Inspector.
- **Plain (non-Experience) Scene Layers already authored before this sprint**
  in any existing World Project keep working exactly as before — this sprint
  performs no migration of already-persisted data, only changes what *new*
  creation actions produce going forward.

## 2. Which of those now route through Experience workflows

- **"Add a Decoration" (the glyph-picker grid) and "➕ Add Text"** — the two
  concrete parallel data paths this sprint targeted, and the sprint's own
  Objective 5 names explicitly. Both used to call `addSceneLayer` directly,
  producing a plain Scene Layer with no Experience behind it at all — a
  second, competing way to create the exact same enrichment an Experience
  already covers, with its own inspector-less editing surface. Both now call
  the same `addExperience` → `graduateToPersonal` → `attachExperience`
  sequence the "+ Add Experience"/"Create & Host" flow already uses
  elsewhere, then land directly on the new Experience's own Inspector — no
  new pipeline, the existing one, reused. A picked Decoration glyph is
  rasterized into a small PNG data URI and stored as the Experience's
  Graphics section content (`_rasterizeGlyphToDataURL`), since the Universal
  Experience content model (Builder V3.1) has no bare "glyph" concept of its
  own — this preserves the exact one-click picking feel while creating a
  real Experience underneath, with no new content-model field invented.
  "Add Text" seeds the new Experience's Text section `textContent` directly,
  since that maps onto the existing Universal Text vocabulary with no
  translation needed at all.
- **Every contextual "+ Add Experience" / "Reuse Existing Experience"
  entry point** (Place's Frame section, Decorations, Text) already routed
  through Experience workflows before this sprint (Milestone 3) — unchanged,
  confirmed still functioning identically via full regression.

## 3. Which still require future migration

- **The Frame Theme Asset shelf** (Manage Frames / `frames/*.json`) is not
  yet Experience-first — "+ Create Frame" there still creates a plain Frame
  record with no owning Experience, and a Theme Author can still pick one
  from the Place picker without ever touching the Experience system. This is
  a real, disclosed gap left open per §4 below.
- **The per-object Scene Layer editors** (`_renderLayerPanel`/
  `_renderTextLayerPanel`) are migration-compatibility surfaces, not
  permanent product features, per Objective 1's own framing — a future
  sprint could fold their remaining unique capabilities (Bring Forward/Send
  Backward stacking, the Decoration Slot permission checkbox) into the
  Experience Inspector and retire the standalone panels entirely, once every
  creation path funnels through Experience and no orphan plain layers are
  being authored anymore.
- **Atmosphere/Lighting/Text Style** — the three Experience `type` values
  with no Engine Adapter rendering path at all (disclosed since Builder V3.1)
  — remain reserved vocabulary, untouched this sprint.

## 4. Architectural blockers discovered

- **Frame's dual identity is a real, unresolved product question, not a bug
  to quietly patch.** A Frame is simultaneously (a) a reusable Theme Asset in
  its own right — Frame Variations exist independently of any one Place, and
  the Manage Frames screen's reorder/duplicate/delete controls assume that —
  and (b) something an Experience can front-end. Converting "+ Create Frame"
  into "always creates an Experience" the same way this sprint did for
  Decoration/Text would be a materially bigger, more speculative change: it
  touches the Frame Theme Asset shelf's own reorder/duplicate identity, which
  Decoration/Text's simple glyph-grid/single-button creation flows never
  had. The sprint's own Objective 5 explicitly scopes "Current Scene
  workspace still exposes: Decoration, Text" — Frame is conspicuously absent
  from that list — so this was treated as intentionally out of scope rather
  than an oversight. **Recommendation**: resolve this as its own, deliberate
  design decision in a future sprint, not as a side effect of this one.
- **No blocker required introducing a second rendering implementation, a
  parallel Builder architecture, or new Engine V2/Runtime concepts.** Every
  fix in this sprint reuses an existing function (`addExperience`, the
  Adapter's own sync path, `usageOf`, the existing Inspector sections) —
  confirmed by the fact that no changes were needed in
  `js/services/engineRuntime.js`, `js/services/engineSchema.js`, or the Scene
  Model shape at all this sprint.

## What else changed (Objectives 2 and 4)

Two additional convergence findings, both fixed without new rendering or new
product concepts:

- **Runtime consistency (Objective 2)**: Working View's isolated Experience
  Studio (Builder V3.1) renders directly from an Experience's own
  `properties` — correct for authoring an idea before it's hosted anywhere,
  but a genuine "Working View shows it, Runtime Preview doesn't" gap with no
  explanation. `_experienceHostingStatus(exp)` now compares the Experience's
  real Usage records against the currently-open Scene and shows a plain
  banner ("Not yet hosted anywhere…" / "Hosted in `<Scene>` — open that Scene
  to see it in Runtime Preview.") whenever the two views would otherwise
  silently disagree; no banner at all when they already match. No new
  renderer — this is a synchronization-status readout over the same
  `usageOf` data the Inspector's own "Used In" section already displays.
- **Ownership/Usage/Hosting mixing (Objective 4)**: the Inspector already
  keeps Ownership (lifecycle + Graduate actions), Used In (real usage +
  detach), and Host Here (the attach action) in visually distinct sections —
  but Host Here always showed a full Scene/Place picker and an always-
  enabled "Host Here" button even when the selected target was *already*
  where the Experience is hosted, making re-clicking it a confusing no-op. A
  Personal Experience scoped to exactly one Scene and already hosted there
  (the common case for anything created via a contextual "+ Add Experience")
  now shows a plain "Already hosted in `<Scene>` — nothing more to host
  here" note instead of a redundant picker; in every other case, the "Host
  Here" button itself now recomputes live as the Scene/Place dropdowns
  change, reading "✓ Already Hosted Here" (disabled) when the current
  selection already matches a real Usage entry, and "📎 Host Here" (enabled)
  otherwise.

## Verification

Full regression across `goldenBuild.js` (30/30) and every prior Builder
V3/V3.1/Working-View-Experience-Studio Playwright script passes unchanged.
New coverage added and verified: clicking a Decoration glyph and "Add Text"
both produce a real, correctly-attached Experience with zero orphan Scene
Layers; the hosting-status banner appears/disappears correctly across
hosted-here / hosted-elsewhere / never-hosted states; the Host Here button
and the "nothing more to host here" note both react correctly to real Usage
state; a full Museum Theme authoring pass using only the converged creation
paths (Frame Experience via Place, a rasterized-glyph Decoration Experience,
a Text Experience via the converged "Add Text" button) reaches a clean
Validation, a successful Scene Package Build, and a successful World Package
Build. Zero console errors throughout.

## Release Recommendation

The two concrete parallel-creation-path instances the sprint targeted
(Decoration, Text) are converged. Frame's dual Theme-Asset/Experience
identity remains a disclosed, deliberately-deferred exception, not
introduced by this sprint and not quietly worked around by it. No new
Builder concepts, no second renderer, no Engine V2/Runtime redesign.
