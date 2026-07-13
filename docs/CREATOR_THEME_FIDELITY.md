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

## Addendum — tracing the REAL `themes/MuseumGallery.vtheme`, not a synthetic fixture

Every test above (and the sprint's own original verification) used a
hand-written, Museum-Gallery-*shaped* fixture registered directly via
`ThemeRegistry.registerOfficial(...)`. A follow-up request asked for
the trace to be repeated through Theme Load → Scene Creation → Object
Registry → Runtime → Object Strip using the **real, compiled**
`themes/MuseumGallery.vtheme` file, loaded through the real production
import path (`ThemeEngine.importThemeFile` → `ThemeRegistry.importPackage`).
This surfaced two real, previously-invisible bugs that every synthetic
fixture had unknowingly been masking.

### Bug 1 — a real crash, silently swallowed everywhere

Tracing the real file end to end: the canvas rendered fully blank
(`getImageData` returned `[0,0,0,0]`, i.e. never painted), `SlideRenderer.
getSceneElements()`/`getTextElements()` both returned empty arrays, and
Object Strip showed "Nothing on this page yet." Manually re-invoking
`window.showSlide()`/`SlideRenderer.render()` outside the app's own
defensive `try{...}catch(e){}` wrappers surfaced the real exception:

```
TypeError: Cannot read properties of null (reading 'variants')
    at _defaultOptionsFor (js/themeEngine.js:138)
    at getOptions (js/themeEngine.js:175)
    at resolveTheme (js/themeEngine.js:195)
    at SlideRenderer.buildPayload (renderer/slideRenderer.js:2575)
```

**Root cause**: Museum Gallery's `supportedCreationTypes` is
`["artwork","artwork-collection"]` — it has no `'story'` entry, so
`js/creationFlow.js`'s `_finish()` only ever calls
`ThemeEngine.applyArtworkTheme()` for it, never `applyTheme()`. On a
genuinely fresh project whose *only* chosen World is a pure Artwork
Theme, the Story Theme (`ThemeEngine.getActiveTheme()`) never gets
set. This is not a hypothetical edge case — `js/themeRegistry.js`
documents, in its own comments, that Studio today ships with **zero
built-in themes** (`OFFICIAL_THEMES` is deliberately commented out,
"Studio now relies entirely on imported/published themes... `storybook-
classic` remains the hardcoded default project theme id... deliberately
left unresolved rather than rewired, since [it] now exists only until
reintroduced by import/publish") — a null active Story Theme is an
accepted, disclosed, *normal* state in this architecture, not a bug to
paper over by inventing a fallback registration. The bug was that nothing
downstream actually *handled* that accepted null state:

- `js/themeEngine.js`'s `_defaultOptionsFor(theme)` dereferenced
  `theme.variants`/`theme.slide`/`theme.holder` assuming `theme` was
  always a real object.
- `resolveTheme()` dereferenced `base.id`/`base.frame.color`/etc. the
  same way.
- `renderer/slideRenderer.js`'s `buildPayload()` called
  `ThemeEngine.resolveTheme()`/`getOptions()` **directly, with no
  try/catch** — bypassing the exact safety net `_theme(s)`/`_options(s)`
  already established elsewhere in the same file (both already fall
  back to `FALLBACK_THEME`/`FALLBACK_OPTIONS` on any thrown exception).

Because `js/creationFlow.js`'s `_finish()` and `js/app.js`'s
`showSlide()` both wrap their own calls in `try{...}catch(e){}` (by
design, so one bad refresh doesn't wedge the whole UI), the exception
above was caught and silently discarded at every call site — it never
surfaced as a console error, `render()` simply never completed, and the
page looked "empty" for a reason with no error trail to follow.

**Fix**: `_defaultOptionsFor` now normalizes `theme=theme||{}` at its
top so every subsequent `theme.X` access resolves to `undefined`
(falsy) instead of throwing — the exact same "no theme = System
Defaults" behaviour every other untouched-theme code path already has.
`resolveTheme()` now falls back to a new `_NO_THEME_FALLBACK` constant
(deliberately identical values to `renderer/slideRenderer.js`'s own
`FALLBACK_THEME` — same colours, same fonts) when `getActiveTheme()`
returns null. `buildPayload()`'s two direct `ThemeEngine` calls gained
the same try/catch + fallback pattern `_theme(s)`/`_options(s)` already
use, for defense-in-depth. This fixes the crash for every caller of
`getOptions()`/`resolveTheme()` at once — several other call sites
(`js/cardDesigner.js`, `js/contextPanel.js`) call these same functions
with no try/catch of their own and were equally exposed.

### Bug 2 — the `handle` Layer Pack entry drew an unintended glow and a nonsensical Object Strip card

With the crash fixed, the real Object Strip showed a fourth World card
literally labelled "Handle" — meaningless to a child, and not
something Museum Gallery's author ever intended as an independent,
selectable object. `docs/THEME_PROJECT_SPEC.md` §7 already documents
the intended contract precisely: an entry naming `page-number` or
`handle` with no real content payload is **declarative-only** — "it
documents that this Layer exists in the theme's inventory, but the
actual pixels are still drawn by the pre-existing, unrelated engine
feature it names ... never a second, competing renderer for the same
content," and `position` is "only meaningful on the declarative
`handle` / `page-number` ids." `_layerDrawText` already honours this
correctly for `page-number` (`type:"text"`, no `text.content`/`.source`
→ returns null, nothing drawn or pushed). `_layerDrawDecoration` did
not have the equivalent guard for `type:"decoration"` entries: with no
`decoration` payload, `kind` defaulted to `'spotlight'`, so `handle`
(which the real compiled package authors as `type:"decoration"`, no
`decoration` field, `position:"bottom-right"`) silently painted an
unintended lighting glow across the whole slide *and* got pushed onto
the render tree as its own selectable Scene Object.

**Fix**: `_layerDrawDecoration` now returns `null` (draws nothing, no
bbox pushed) when `!layer.decoration && layer.position` — the exact,
spec-sanctioned signature of a declarative-only entry. `gallery-
spotlight` (Museum Gallery's other, genuinely content-less decoration
entry) is unaffected: it has no `decoration` payload either, but it
also has no `position` field, so it still resolves through the
existing `kind==='spotlight'` default and keeps its real, intentional
glow — confirmed unchanged in every regression fixture.

### A separate, disclosed, NOT-fixed finding — theme icon

The Context Panel's "Welcome to `<icon>` Museum Gallery" heading shows
the generic 📖 fallback instead of Museum Gallery's own 🏛️ for the real
imported package (confirmed via direct inspection:
`ThemeRegistry.get('museum-gallery')` has no `themeIcon` key at all —
only the compiled package's `manifest.themeIcon` carries it, and
`ThemeRegistry.get()` returns only the `theme` sub-object, discarding
`manifest`). This is a pre-existing gap in the exact same lookup
pattern `js/app.js`'s own header readout (`_updateHeaderContext()`)
already uses — `_worldIdentity()` faithfully reused that established
pattern rather than introducing a new one. Not part of the acceptance
checklist's named criteria (which concern the ownership legend/badges
functioning, not which glyph appears), and fixing it would mean
deciding whether `ThemeRegistry.get()` should start returning manifest
fields merged onto the theme object — a real design question, out of
this trace's scope. Disclosed here rather than silently fixed or
silently ignored.

### Verification

A new Playwright test (`real_museum_trace.js`, scratch-only) loaded
the real `themes/MuseumGallery.vtheme` via `ThemeEngine.importThemeFile`
and drove the full acceptance journey against it: Theme Load
(`registered:true`, correct name/representations/layerPack ids) → Scene
Creation (Creation Flow discovers and applies it) → Object Registry/
Runtime (non-blank canvas pixels, populated `getSceneElements()`) →
Thumbnail (a real, non-trivial generated thumbnail image) → Object
Strip (Background/Artwork Place/Gallery Spotlight/Wax Seal, no
"Nothing on this page yet") → Context Panel (Welcome heading + legend,
and selecting Wax Seal shows the correct 🌍 "This is part of the World"
disclosure). Full regression across every existing suite
(`regression.js`, `final_qa.js`, `frame_variation_test3.js`,
`ws_check.js`, `publish_stages.js`, `lang_check.js`, `baseline3.js`,
`scene_object_test.js`, `sticker_owner_check.js`, `diag_layerpack3.js`,
`runtime_pass_test.js`, `museum_fidelity_test.js`) passes unchanged,
zero console errors.
