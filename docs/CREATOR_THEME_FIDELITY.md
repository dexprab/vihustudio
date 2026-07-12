# Creator Theme Fidelity — the Museum Gallery Acceptance Test

**Sprint:** Creator Acceptance Sprint — Theme Fidelity Pass (Museum
Gallery).
**Status:** Canonical. Museum Gallery is the acceptance benchmark for
this contract; a future Official World should be checked against the
same journey before being considered "Creator-ready."
**Scope:** This document is the Golden Rule and the one root cause that
broke it — it does not restate the Theme Contract
(`docs/THEME_CONTRACT.md`), the Creator↔Builder field map
(`docs/THEME_TO_CREATOR_MAP.md`), or the render-tree/ownership model
(the Creator Reconciliation Sprint, see `CLAUDE.md`).

## The Golden Rule

Creator does not recreate the page. Creator does not reinterpret the
Theme. Creator's first responsibility is to render exactly what
Builder published — Builder's own Runtime Preview is the visual source
of truth, and Creator should begin from that same visual state, before
any Story Author content exists.

## The bug: one gate, not many

Before this sprint, opening a fresh Museum Gallery page showed almost
nothing — no wall, no frame, no branding, no Wax Seal, no Museum
Caption — until the child uploaded a picture. That read as "the page is
empty," when in fact the World had already authored all of that
content. The entire gap traced to one line:
`renderer/slideRenderer.js`'s `_resolveBorder(s)` resolved an Artwork
Theme's Frame only `if(hasImage)` (a deliberate Sprint 9.3 decision,
"if a page contains no artwork, Artwork Theme has no effect"). Because
the Frame/mat/ornament/stroke/caption draw block, and every
Frame/Holder-scoped Layer Pack entry (Wax Seal, Gallery Spotlight,
Museum Caption), only run when that resolved border is non-null, the
whole World disappeared behind one boolean.

Everything downstream of that gate — wall tone, mat, paper texture,
lighting glow, ornament, stroke, caption — was *already* correct and
image-independent once reached; none of those functions ever touched
`s.image`. Builder's own `engineRuntime.js` (`_paintHolder`) already
enforces the opposite rule at the Engine level: an empty Holder always
shows its placeholder chrome, image or not. Fixing the one gate in
`_resolveBorder` (resolve whenever an Artwork Theme is active, not only
when `hasImage`) closed the entire visual gap with zero further
drawing-code changes.

## What else changed, and why each was necessary

- **A new Story-role artwork placeholder.** Cover/Hook/End pages
  already had a "no image yet" affordance
  (`_drawSceneImageHolder`'s dashed box + "Add an image" text, Sprint
  6.2) because they have a real `SceneEngine` blueprint. Story-role
  pages (Museum Gallery's role) never had an equivalent, since
  `SceneEngine.getRenderData` returns `null` for Story role by design.
  New `_drawArtworkPlaceholder(panelRect,border,chromeColor)` mirrors
  the same visual language — but takes an explicit `chromeColor`
  (the same wall-tone luminance check already used for Handle/Page
  Number text) instead of the original's hardcoded white, since a
  light Frame Variation's wall (Museum Gallery's own "Classic White")
  would make a white dashed line invisible.
- **Object Strip's Artwork card was gated on `slide.image` truthy.**
  Fixed to always show once there's no Scene blueprint — worded
  "Artwork Place" before a picture exists, "Artwork" once it does.
  This is what makes the acceptance journey's "Tap Artwork Place →
  Replace Artwork → Choose Artwork → Done" flow reachable at all;
  before this fix, that card simply didn't exist to tap.
- **A second, deeper bug found while verifying this fix**: the card's
  original gate was `slide.pageType==='story'`, but a freshly
  Creation-Flow-created page's `pageType` never gets promoted away from
  `'blank'` — nothing in `js/creationFlow.js`/`js/pageOps.js` ever sets
  it to `'story'` for that path (only the sidebar's separate bulk
  "Upload Images" importer does, on pages it creates itself). This
  means the Artwork card would have stayed permanently absent for the
  actual primary onboarding path, even after this sprint's other
  fixes. Fixed by matching the exact criterion
  `renderer/slideRenderer.js`'s own `_hasScene` gate already uses
  (`SceneEngine.getRenderData(slide)!==null`) instead of a hardcoded
  pageType string — correctly covers `'story'` and `'blank'` alike (and
  any future non-scene pageType), since the renderer already treats
  them identically.
- **Context Panel's default view became guidance-first**: a "Welcome
  to `<World Icon> <World Name>`" heading (new `_worldIdentity()`,
  reusing the exact `ThemeEngine.getActiveArtworkThemeId`/
  `ThemeRegistry.get` lookup `js/app.js`'s own header readout already
  uses) plus a two-line ownership legend ("✏️ Objects marked editable
  can be changed." / "🌍 Objects marked World belong to the World."),
  above the pre-existing, unchanged Page Style/Caption/Background/Add
  Sticker controls.
- **Object Strip's World-owned badge glyph** changed from 🔒 to 🌍 to
  match the acceptance checklist's explicit vocabulary and the 🌍 icon
  Context Panel's own World-object disclosure banner already used —
  text/glyph only; the editable/owner gating logic (which already
  correctly distinguishes editable, locked-World, and locked-Story) is
  unchanged.
- **"Add Artwork" vs "Replace Artwork"** wording, and hiding "Crop /
  Rotate" until there's something to crop (it already silently no-oped
  with nothing selected — hiding it removes a dead button, not new
  capability).

## What was checked and found already correct

- **Sticker Studio** was already fully contextual — CSS-hidden until
  "Add a Sticker" is clicked, never a default panel.
- **The sidebar "Upload Images" button** is a separate, pre-existing
  bulk multi-page importer, never part of Context Panel's default
  view — the acceptance checklist's "Upload Images should not be the
  first action" was already true structurally; this sprint's Object
  Strip fix is what makes the *intended* contextual path (Tap Artwork
  Place → Replace/Add Artwork) reachable instead.
- **`CardDesigner`'s image section** already gracefully disables its
  scale/pan controls when there's no image — no change needed.
- **Publish** (`js/storyDestinations.js`/`js/publishStudio.js`) renders
  through the identical `buildPayload`+`render` pair as the editor
  canvas, so the fix reaches Publish for free; verified directly by
  opening Publish Studio on an image-less page and confirming it
  renders without error.

## Disclosed, deliberately not fixed this sprint

- **`representation.defaultFrame`** is authored in the compiled
  package but never consumed anywhere in the Creator runtime — it's a
  Builder-authoring-time-only hint today. For Museum Gallery this has
  zero visible effect (both real representations point at
  `classic-white`, whose own fields are deliberately empty, delegating
  to the `gallery` Presentation Preset's own System Defaults — so
  wiring it would render identically for this theme). A future theme
  whose representations pick a *non-default* Frame Variation would
  actually diverge from Builder's intent here; that's real follow-up
  work, not something this sprint's scope covered.
- **The `handle` Layer Pack entry's default-to-`'spotlight'` decoration
  kind** (when a layer has no `decoration` payload) was investigated as
  a possible unintended visual side effect, but found genuinely
  ambiguous: `gallery-spotlight` — a different, clearly intentional
  entry — relies on the exact same default for its own glow. "Fixing"
  it risks silently removing a real, intentional effect and
  second-guessing Builder's own authored intent, which this sprint's
  own Golden Rule and constraints explicitly forbid. Left untouched,
  disclosed rather than guessed at.

## Verification

A Playwright test (`museum_fidelity_test.js`, scratch-only) built a
Museum-Gallery-shaped synthetic fixture (frameVariations + a full
layerPack: Wax Seal/Gallery Spotlight/Museum Caption) and drove the
real acceptance journey end to end:

- Before any picture is uploaded: the canvas already paints the wall
  tone at the page edges and a mat/frame/placeholder inside the panel
  rect (pixel-sampled, non-blank); Object Strip lists Background,
  **Artwork Place**, Wax Seal, and Gallery Spotlight (Museum Caption
  correctly absent — an empty caption with no title still draws
  nothing, matching pre-existing, correct behaviour); Context Panel's
  default view shows "Welcome to 🏛️ Museum Gallery" plus the ownership
  legend; selecting Artwork Place shows only "🖼️ Add Artwork" (no
  Crop/Rotate).
- After a real picture is set: the placeholder is gone (the sampled
  pixel now matches the uploaded image's own colour), Object Strip's
  card renames to **Artwork**, and selecting it shows "🖼️ Replace
  Artwork" + "✂️ Crop / Rotate".
- Publish Studio opens and renders without error on the image-less
  page.

Full regression across the existing Creator suite (`regression.js`,
`final_qa.js`, `frame_variation_test3.js`, `ws_check.js`,
`publish_stages.js`, `lang_check.js`, `baseline3.js`,
`scene_object_test.js`, `sticker_owner_check.js`,
`diag_layerpack3.js`, `runtime_pass_test.js`) passes unchanged, zero
console errors throughout.
