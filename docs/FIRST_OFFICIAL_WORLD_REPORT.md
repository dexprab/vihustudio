# First Official World Report

**Status:** Canonical record of Sprint B2.0 (First Official World
Platform Validation) — not sprint notes to be deleted later. This is
the permanent account of what it took to produce Museum Gallery, the
World Builder Platform's first Official World, end-to-end through the
Builder alone.

---

## Objective and result

The objective was not to implement isolated features. It was to prove
that World Builder — as it stood after Sprint B1.1 — could actually
carry a World from **Create New World** to **Runtime-discoverable
Official World**, with a real, non-trivial theme (Museum Gallery, 3
Layouts, 7 Frame Variations, 3 Representations, a 5-entry Layer Pack),
authored through the Builder's own UI alone.

**Result: yes, with two schema bugs and one rendering bug found and
fixed along the way, and zero manual JSON/folder editing performed to
work around any of them.** Every artifact that ended up in
`official-worlds/MuseumGallery/` and `themes/MuseumGallery.vtheme`
originated from Builder operations — clicks, fills, and file uploads
driven against the real running Workspace — never from a hand-typed
JSON file. See "Manual interventions" below for the one honest
exception, which is not a content-authoring intervention.

The full lifecycle was exercised and verified:

```
Create New World → Author (Overview/Representations/Layouts/Frames/
Layer Packs/Assets) → Validate → Build → MuseumGallery.vtheme →
Publish → Import into a clean Runtime → Discovered on Screen 2 →
Preview carousel generated from the package → Start Creating → correct
Layout applied → Publish Story (same code path as any World)
```

---

## Platform gaps discovered

Four real defects were found by actually running Validation/Build/
Import for the first time against a fully-authored World — not by
inspection, but because the Builder's own generated output failed
against the real, unmodified `validator.js` the moment it was asked to
validate something non-trivial:

1. **Layouts were missing the required `name` field.** Every template
   since Sprint B1.0 generated `{id, aspect}` layouts. `validator.js`
   requires `name` on every Layout (`docs/THEME_PROJECT_SPEC.md` §5).
   This had never been caught because no sprint before B2.0 had run
   real Validation — Sprint B1.0/B1.1's own Playwright checks verified
   generation and UI wiring, never the actual validator.

2. **Frame Variation fields were flat instead of nested under
   `fields`.** The real schema
   (`docs/THEME_PROJECT_SPEC.md` §6) is
   `{id, name, description, fields: {matWidth, frameThickness, ...}}`.
   `builder.js` doesn't reject a flat shape (it doesn't validate
   `fields` nesting), so this compiled "successfully" into a package
   whose frame-variation fields the runtime's own resolver would never
   actually read correctly — a silent, not a loud, failure.

3. **Renaming a World in Overview never updated `theme.json.name`.**
   `validator.js` requires `theme.name === manifest.name`. The Overview
   panel updated `manifest.name`/`metadata.displayName` but not
   `theme.name`, so validation failed the instant a creator renamed
   their World away from its template default — which every real
   creator does immediately.

4. **A Context-Panel-class bug: several Workspace states re-rendered
   themselves by appending instead of replacing.** `_renderContextPanel`
   (the dispatcher) clears `#wb-context-panel` before painting a state;
   but several in-state actions (toggle visibility/lock, reorder, add
   layer, rename pack) called their own render function directly,
   which never cleared the panel itself. The result: duplicated field
   groups in the DOM, and — because duplicate "Layer Id" inputs all
   matched the same label — edits meant for one layer silently landing
   on whichever layer's fields happened to still be present from a
   previous render. Fixed by making every panel-render function clear
   `#wb-context-panel` itself, so it is correct regardless of whether
   it's invoked via the dispatcher or directly.

None of these were cosmetic. All four would have produced a World
Project that looked complete in the UI but silently failed to validate,
compile correctly, or accept the edits a creator made.

---

## Contracts enhanced

- **`docs/WORLD_PROJECT_CONTRACT.md`** — gained a "Contract corrections
  (Sprint B2.0)" section documenting gaps 1–3 above, and a Change
  History entry.
- **`docs/WORLD_ASSET_CONTRACT.md`** — gained a note reconciling the
  Assets state's actual Identity implementation (root
  `thumbnail.png`/`preview.png`, the already-shipped mechanism) against
  the document's own reserved `assets/thumbnail.webp`/`hero.webp`
  convention, which remains an intentionally open gap.
- **`docs/WORLD_ASSET_SPEC.md`** — new canonical document. Defines the
  full per-slot asset schema (`id`/`displayName`/`category`/`purpose`/
  `required`/`formats`/`recommendedDimensions`/`recommendedResolution`/
  `usedBy`/`previewType`/`validationRules`) and the seven categories
  (Identity, Frames, Textures, Decorations, Icons, Fonts, Backgrounds)
  the Assets Workspace state is generated from — mirrored 1:1 by
  `tools/world-builder/js/assetSpec.js`.
- **`docs/WORLD_BUILDER_ARCHITECTURE.md`** — status table updated to
  reflect every Workspace state now implemented; new section
  documenting `projectCompiler.js`'s reuse of the unmodified
  `validator.js`/`builder.js`.

---

## Builder capabilities added

- **Frames** — full CRUD (create/duplicate/rename/delete/reorder) plus
  a property editor (Thickness, Padding/Mat Width, Inset, Border Color,
  Wall Tone, Shadow, Corner Radius, Default Margin), all through
  `ProjectModel`, all reflected live in the Preview.
- **Layer Packs** — multiple named packs (a Builder-only organizational
  convenience; the compiled Runtime still merges every
  `layer-packs/*.json` file into one flat array, unchanged), a real
  Default Layer Pack control that writes the previously-reserved
  `theme.json.defaultLayerPack` field, and a per-layer editor (Type,
  Target Container, Anchor, Position, Offset X/Y, Z-Index, Text Source,
  visibility, lock, reorder).
- **Assets** — a fully data-driven screen generated from
  `assetSpec.js`/`docs/WORLD_ASSET_SPEC.md`: category grouping, per-slot
  Preview/Upload/Replace/Required-Optional/Usage/Status, a real file
  upload path (`<input type=file>` → `FileReader` → data URI, matching
  the same embedding convention `builder.js` already used for
  `preview.png`/`thumbnail.png`), and live overall completion tracking.
- **Validation** — runs the real `validator.js` via `projectCompiler.js`;
  reports grouped by category (World Contract/Representations/Layouts/
  Frames/Layer Packs/Assets/References/Metadata/Version) with a
  pass/warning/error status per category and the full message list.
- **Build** — runs the real `builder.js` via the same adapter; produces
  a genuine `{manifest, theme, assets}` package, stored on the Project
  as `project.lastBuild` (filename/size/version/data URI) so Publish
  always ships exactly what Build produced.
- **Publish** — Export Package and Official World both trigger a real
  browser download of the Build-produced package, byte-for-byte
  identical, no special-casing between them; Community World is an
  honest, inert "Coming soon" placeholder.
- **Overview** — gained World Id, Icon, Purpose, and Mood fields (all
  were template-frozen and uneditable before this sprint), and Creation
  Types became a real toggle instead of a read-only display. README.md
  now regenerates from the current Name/Tagline/Description on every
  edit instead of staying frozen at whatever the template first wrote.
- **Layouts** gained a Composition field (`below`/`right`/`quote` —
  `docs/THEME_PROJECT_SPEC.md` §5), needed for a Quote-style layout to
  correctly drop its Frame/Holder.

---

## Architecture improvements

- **`tools/world-builder/js/projectCompiler.js`** (new) — the adapter
  that lets Validation and Build reuse the real, unmodified
  `validator.js`/`builder.js` against an in-memory World Project,
  making good on `docs/WORLD_PROJECT_CONTRACT.md`'s original promise
  that a future Build stage would need "no translation layer."
- **`tools/world-builder/js/assetSpec.js`** (new) — the Builder-readable
  mirror of `docs/WORLD_ASSET_SPEC.md`; the Assets screen contains zero
  per-category markup, generating entirely from this module.
- **`tools/world-builder/js/projectModel.js`** — extended with Frame
  CRUD, multi-Layer-Pack CRUD, per-layer mutation, and Asset read/write
  helpers, while remaining the single accessor/mutator layer every
  Workspace state goes through — no Workspace code touches
  `project.files[...]` directly, before or after this sprint.

---

## Remaining technical debt

Named honestly rather than silently worked around:

- **`theme.json`'s `editor` block** (Sprint 9.4's Dynamic Theme
  Workspace configuration — which Studio-side Card/Page Designer
  controls a theme surfaces) is not authorable through the Builder yet.
  Museum Gallery's compiled package ships without one; Studio falls
  back to its default fixed control set for it, exactly as any
  pre-9.4 theme already does. This does not affect Import Parity's core
  promise (Representations/Layouts/Frames/Layer Pack are what the
  creation experience actually hinges on) but is a real, named gap.
- **`layouts/*.json`'s `supportedFrames`/`holders`/`defaultHolderMode`**
  (authoring guidance only, per spec — never enforced) are not yet
  editable through the Layouts state.
- **A Representation's own `supportedCreationTypes`** field (optional;
  defaults to "every Creation Type this theme supports" when absent) is
  not yet editable through the Representations state.
- **`manifest.json`'s `category`/`tags` fields** are not yet editable
  anywhere in the Workspace — they remain at whatever the originating
  template set. Purely cosmetic (Theme Library sectioning is driven by
  *how* a theme is registered — `registerOfficial` vs. `importPackage`
  — never by this string field), so this does not affect Official vs.
  Imported classification or Import Parity.
- **`metadata.json`'s `bestFor`/`notRecommendedFor`** array fields are
  not yet editable (Overview only gained single-value Purpose/Mood this
  sprint, not array editors).
- **The Assets state's optional categories (Textures/Decorations/
  Icons/Fonts/Backgrounds)** ship a small, fixed slot count (2/2/1/1/1)
  rather than an open-ended add-your-own-slot interface — deliberately
  modest scope per `docs/WORLD_ASSET_SPEC.md`'s own "no hardcoded Asset
  screen hardcoding, but no arbitrarily large registry either" design.

None of these block a World from validating, building, publishing, or
importing correctly — Museum Gallery proves that end-to-end with all of
them left at their defaults.

---

## Manual interventions

**Zero manual JSON or folder-content editing was performed.** Every
field in `official-worlds/MuseumGallery/manifest.json`, `metadata.json`,
`theme.json`, every `layouts/*.json`, every `frames/*.json`,
`representations/all.json`, and `layer-packs/basic.json` was set by
driving the real, running Builder Workspace — clicking Frames/Layer
Packs/Representations/Layouts rows, filling text inputs, moving
sliders, uploading the real `thumbnail.png`/`preview.png` images through
the Assets/Overview file-upload controls — never by opening a text
editor.

**One mechanical, content-free step was required and is disclosed
here:** World Builder is a browser tool with no publish backend (no
server to submit a package to). "Publish → Official World" produces a
real, correct package and triggers a real download — the same
byte-for-byte `.vtheme` "Export Package" produces — but placing that
downloaded file into `themes/MuseumGallery.vtheme` and expanding its
sibling `official-worlds/MuseumGallery/` source folder onto disk is a
filesystem copy operation, not a JSON-authoring one: every file written
there is a direct, unedited dump of the exact `project.files` map the
Builder held in memory at Build time (verified by re-running Build and
diffing checksums). This is the same category of step a real deploy
pipeline would perform mechanically (download → place in hosting); it
introduces no content this report doesn't already account for.

---

## Verification performed

- All 6 starter templates (Artwork Gallery/Storybook/Quotes/Sketchbook/
  Greeting Cards/Blank World) still generate contract-valid projects
  after the schema fixes (re-verified via Playwright, 0 errors each).
- `tools/world-builder/verify/goldenBuild.js`'s pre-existing 30
  assertions still pass unchanged.
- A dedicated Playwright suite (23 assertions) exercises Frames/Layer
  Packs/Assets/Validation/Build/Publish end-to-end, including real file
  uploads and a real triggered download.
- Museum Gallery was authored via 100+ real UI interactions (clicks/
  fills/uploads) against the live Workspace, validated (0 errors),
  built (real `.vtheme`, ~9 KB), and the resulting package:
  - Does not exist in a fresh Runtime before import.
  - Imports immediately with `source: 'imported'` (no privileged flag).
  - Is discovered on Creation Flow Screen 2 with zero code changes.
  - Renders a Preview carousel of exactly the 3 authored Representations
    (Showcase/Portrait/Quote) — nothing fabricated, nothing missing.
  - Resolves all 7 Frame Variations, all 5 Layer Pack entries (with
    their correct individual fields — anchor/offset/z-index/text
    source — after fixing gap 4 above), and all 3 Representations
    through `ThemeEngine.getTheme()`.
  - Applies the correct authored Layout (`landscape`, Showcase) when
    Start Creating is pressed.
  - Reaches `PublishStudio.open` through the ordinary Publish path, no
    special case.

---

## Change History

- v1.0 — Initial report, written for Sprint B2.0 (First Official World
  Platform Validation).
