# Theme Contract — Builder ⇄ Studio Parity Ledger

**Sprint:** Platform Hardening Sprint.
**Status:** Canonical. Created by this sprint; maintain going forward
whenever the Builder ⇄ Studio contract changes.
**Scope:** This document does not restate or replace
`docs/THEME_PROJECT_SPEC.md` (the authoring-time schema) or
`docs/VTHEME_PACKAGE_SPEC.md` (the compiled runtime package shape) — both
remain the authoritative field-by-field specifications. This document's
own, distinct job is **parity**: for every field either spec names, does
World Builder (the producer) actually produce it, and does VihuStudio
(the consumer) actually consume it, today, in the real code — not just in
the documented intent. Where a gap was found, this records what it was,
where it lived, how it was fixed (or why it was deliberately left
disclosed rather than fixed), and how it was verified.

Treat Builder as the producer. Treat Studio as the consumer. The
`.vtheme` package is the contract between them. This ledger exists
because a field can be correctly documented, correctly validated, and
correctly compiled, and *still* never reach the reader — reference
integrity (AV-012, the Platform Hardening Sprint's own predecessor fix)
and field-consumption parity (this sprint) are two different failure
modes of the same contract, and both need a canonical home.

---

## 1. How to read this ledger

Each row names a field or field-group from the compiled package
(`docs/VTHEME_PACKAGE_SPEC.md`), then answers three questions:

- **Produced?** Does `tools/world-builder/js/services/builder.js` (or the
  Builder authoring UI feeding it) actually populate this field for a
  Theme authored today?
- **Consumed?** Does `js/themeRegistry.js` / `js/themeEngine.js` /
  `renderer/slideRenderer.js` actually read this field at real render
  time — not merely accept it during `validatePackage()`?
- **Status** — `Aligned` (both sides agree, verified), `Fixed this
  sprint` (a real gap, closed at the root cause), or `Disclosed gap` (a
  real gap, deliberately left unfixed — reason given).

---

## 2. Manifest

| Field | Produced? | Consumed? | Status |
|---|---|---|---|
| `id`, `name`, `version`, `author`, `description`, `category`, `tags`, `thumbnail`, `createdDate`, `updatedDate`, `minStudioVersion` | Yes | Yes — `REQUIRED_MANIFEST_FIELDS` | Aligned |
| `type` | Yes | Yes — normalized to `"story"` if absent | Aligned |
| `purpose`, `mood`, `bestFor`, `notRecommendedFor`, `themeIcon`, `previewImage` | Yes, when authored | Yes — `ThemeEngine._renderThemeCard()` | Aligned |

**Asset Repository Transition** — `thumbnail`/`previewImage` are a plain relative-path **reference** (e.g. `"thumbnail.png"`), never an embedded data URI, as of `builder.js`'s `buildManifest()` / `js/themeEngine.js`'s `_buildPackageFromZipFiles()`. The real bytes live only in the compiled package's `assets` map, keyed by that same reference — exactly the convention `validator.js`'s `findAssetPaths()` already established for every Layout/Frame/Layer/Representation image field, now applied uniformly to these two manifest fields too. Every consumer reads the resolved value via `ThemeRegistry.resolveAssetRef(id, value)` (`js/themeEngine.js`'s `_renderThemeCard()`, `js/creationFlow.js`'s `_themePreview()`/`_repThumbnail()`) rather than treating the manifest field as a ready `src` — a data:/http(s) value (a legacy already-embedded package, or a repository's resolved signed URL) passes through unchanged, a bare reference resolves against `getAsset()`. This is what lets a Theme published to a Supabase repository carry zero embedded base64 in its `manifest`/`theme` row while still rendering correctly — see `docs/THEME_REPOSITORY_ARCHITECTURE.md` §10.

## 3. Theme (top level)

| Field | Produced? | Consumed? | Status |
|---|---|---|---|
| `layouts`, `frameVariations`, `layerPack` | Yes — flattened by `builder.js`'s `collectFolder()`/`buildTheme()` | Yes | Aligned |
| `representations` | Yes, when the project has any (omitted otherwise) | Yes — `js/creationFlow.js`, `js/contextPanel.js` | Aligned |
| `supportedCreationTypes` | **No** — not yet authorable anywhere in World Builder's UI; only the in-code Official Theme entries in `js/themeRegistry.js` set it | Yes, when present | **Disclosed gap** (pre-existing, named in `docs/THEME_PROJECT_SPEC.md` §13's Reserved Future Sections and §8 — "the Theme Project author-time home for it… is not yet finalized." Not this sprint's scope: no new Builder authoring surface, per the Working Rules' "no new Builder capabilities.") A World Builder-authored Theme is therefore never offered under any Creation Type unless the record is edited by hand after publish. |
| `assets` | Yes — `builder.js`'s `packageTheme()` | **No, before this sprint** | **Fixed this sprint** — see §8.3. |

## 4. Frame Variation (`fields.*`)

`docs/THEME_PROJECT_SPEC.md` §6 names exactly eight fields:
`background`, `frame`, `paper`, `shadow`, `matWidth`, `frameThickness`,
`borderColor`, `wallTone`.

| Field | Produced by World Builder's Frames screen? | Consumed by `renderer/slideRenderer.js`'s `_artworkBorder()`? | Status |
|---|---|---|---|
| `matWidth`, `frameThickness`, `borderColor`, `wallTone`, `shadow` | Yes (seeded on `addFrame`, editable) | Yes | Aligned |
| `background`, `frame`, `paper` | **No, before this sprint** — the Frames screen (`_renderFramesPanel`) had no control for any of these three at all | Yes — `ARTWORK_BACKGROUND_FILL[resolved.background]` selects the mat fill, `ARTWORK_FRAME_PRESET[resolved.frame]` selects the frame-ornament design and its corner radius | **Fixed this sprint** — see §8.1. Before the fix, every Builder-authored Frame Variation rendered in real Studio with `fill:'none'` (no mat drawn at all) and `design:null` (no frame ornament), no matter what the author configured — only the border stroke and wall tone ever reached the page. |

**Builder-authored fields with no home in the canonical spec or the real
renderer**: `fields.cornerRadius`, `fields.inset`, `fields.defaultMargin`.
See §9, Disclosed Gaps — deliberately not fixed this sprint.

## 5. Layout (`aspect`, `composition`, …)

| Field | Produced? | Consumed? | Status |
|---|---|---|---|
| `id`, `name`, `aspect`, `composition`, `supportedFrames` | Yes | Yes | Aligned |
| `holders` | Always `1` for `tools/world-builder/` (v1, §5's own "Reserved, always 1 in V1"); real counts >1 from `tools/world-builder-v2`'s Scene→Layout convergence | Yes — `_resolveBorder`/`js/objectStrip.js` read the count to gate whether an Artwork Place shows at all | Aligned |
| `placeRects` (`tools/world-builder-v2` only, Multiple Artwork Places Per Page) | Every Place's own `{id,name,position,size,shape,padding,fit,frame}`, in authored order | Yes — `renderer/slideRenderer.js`'s `_activeLayoutPlaces`/`_placePixelRectFor` resolve each Place's own pixel rect/Frame/picture independently; `js/objectStrip.js`/`js/app.js`/`js/contextPanel.js`/`js/cardDesigner.js` all render/select/edit each Place independently | Aligned (producer and consumer added together); `tools/world-builder/` (v1) never produces this field, so a v1-authored theme is unaffected, per the same v1/v2-parity precedent this table already used for `moveable`/`editable` below |

## 6. Layer Pack (`target`)

`docs/THEME_PROJECT_SPEC.md` §7/§11 name four containership scopes a
Layer's `target` may be: `slide`, `frame`, `holder`, `element`.

| `target` value | Validated as legal? | Actually rendered? | Status |
|---|---|---|---|
| `slide`, `frame`, `holder` | Yes | Yes — `renderer/slideRenderer.js` calls `_renderLayers(...)` for each | Aligned |
| `element` | Yes — `validator.js`, `constants.js`'s `LAYER_TARGETS`, and World Builder's own Layer Pack editor all treat it as valid | **No, before this sprint** — `slideRenderer.js` never called `_renderLayers` for this scope at all | **Fixed this sprint** — see §8.2. |
| `overlay` (added by the Builder Convergence Sprint) | Not authorable through World Builder's own Layer Pack editor or `validator.js`'s `LAYER_TARGETS` — it is only ever produced by `builder.js`'s Scene convergence (`convergeSceneLayer()`), never hand-authored | Yes — `renderer/slideRenderer.js` calls `_renderLayers(...)` for it, painted last, on top of everything | Aligned by construction (producer and consumer added together); see `docs/THEME_PROJECT_SPEC.md`'s "Builder Convergence Sprint — Scene Convergence" section for the full mapping (also documents the new `scope`/`rect` Layer fields and the `decoration.kind:"fill"`/`"image"` values). |

### 6.1 — `moveable`/`editable` (Creator Reconciliation Sprint)

| Field | Produced? | Consumed? | Status |
|---|---|---|---|
| `moveable`, `editable` | Yes, but **only** via `tools/world-builder-v2/js/services/builder.js`'s `convergeSceneLayer()` — mirrors the already-existing `visible` line, sourced from Builder's own `layer.permissions` (`js/projectModel.js`). Hand-authored `layer-packs/*.json` entries (World Builder's raw `collectFolder('layer-packs')` path, the other of the two `layerPack` sources) never set these keys — a Museum-Gallery-style legacy theme built before this sprint carries neither field. | Yes — `renderer/slideRenderer.js`'s `_pushLayerObject` reads them straight off the compiled entry (`!!layer.moveable`/`!!layer.editable`, correctly resolving `false` when absent) onto the render-tree Scene Object every downstream Creator surface reads. `js/objectStrip.js`'s badge and `js/contextPanel.js`'s selection-dispatch both act on the real value — an `editable:true` World object shows 🟢 in Object Strip and a differently-worded disclosure in Context Panel, an `editable:false` one shows 🔒/the locked wording. | Aligned (both sides added together this sprint) — `tools/world-builder/` (v1) is deliberately untouched, per the same precedent the Decoration Shapes sprint set. |

`moveable` is exposed on the render tree but not yet acted on — no drag-persistence exists for a World-owned object (would need a new small override bag mirroring `slide.metadata.elementOverrides`); a disclosed, deliberately deferred Phase 2. `editable` is acted on only as a disclosure-vs-generic-section decision in Context Panel — an honest "you may edit this, but that kind of edit isn't built in Creator yet" state, not a fabricated editor.

## 7. Assets (`assets/*` → the compiled `assets` map)

| Stage | Behaviour before this sprint | Status |
|---|---|---|
| Builder compiles `assets/` into `{relativePath: dataURI}` | Correct — `builder.js`'s `packageTheme()` | Aligned (unchanged) |
| `ThemeRegistry.importPackage()` stores it on the registered theme record | **Did not** — only `manifest`/`theme` were kept; `pkg.assets` was read, validated implicitly, and then discarded | **Fixed this sprint** — see §8.3. |
| A relative asset path (e.g. a Representation `thumbnail`) resolves back to its data URI | **Could not** — the map that would answer the lookup no longer existed by the time any consumer needed it | **Fixed** for the one reachable consumer at the time (`js/creationFlow.js`'s Representation thumbnail); see §8.3. |
| `manifest.thumbnail`/`.previewImage` resolve the same way | **Could not** — these two fields were embedded base64 at Build time, never references, so no repository could externalize them | **Fixed this sprint** — the embedding was removed at its two producer sites and both fields now resolve through the same generic mechanism `resolveAssetRef` factors out; see §8.4 and `docs/THEME_REPOSITORY_ARCHITECTURE.md` §10. |

---

## 8. What this sprint fixed, and where

Three real Builder ⇄ Studio contract gaps were found auditing the
compiled-package pipeline against the Museum Theme as the reference
project (continuing directly from `docs/PLATFORM_INTEGRATION_REPORT.md`).
Each was reproduced against the actual gap before being fixed, per the
Working Method.

### 8.1 — Frame Variation missing `background`/`frame`/`paper`

- **Root cause.** World Builder's Frames screen (`tools/world-builder/
  js/worldBuilderApp.js`'s `_renderFramesPanel`) only ever exposed Wall
  Tone/Border Color/Shadow/Padding(Mat Width)/Thickness — never
  `background`/`frame`(design)/`paper`, the three enum fields
  `renderer/slideRenderer.js`'s `_artworkBorder()` needs to select
  anything other than its own `'none'` fallback for mat fill and frame
  ornament. A Frame authored entirely through today's Builder therefore
  always compiled without these three fields, and always rendered in
  real Studio with no mat and no frame ornament — regardless of what the
  author configured for matWidth/frameThickness/borderColor.
- **Fix, at the source.** `tools/world-builder/js/projectModel.js` gained
  `_ensureFrameFieldDefaults(frame)`, called from the `frames(project)`
  read accessor — the same "reconcile lazily, mutate, never crash"
  discipline `_ordered`/`_ensureHolderDefaults` already use in this file.
  It seeds sensible defaults (`background:'white'`, `frame:'white-mat'`,
  `paper:'smooth'` — Museum Gallery's own "Classic White" values) for any
  Frame missing them, repairing both a brand-new Frame (`addFrame`'s
  `_defaultFrameFields()` now includes all eight canonical fields) and
  any already-authored Frame the moment its project is next opened. No
  new Builder UI was added — the Frames screen's controls are unchanged;
  this closes the gap by making the field set complete by default,
  matching what the screen's existing five fields already did.
- **Verified** by hand-corrupting a Frame record to the pre-fix shape
  (deleting `background`/`frame`/`paper`), reopening the project, and
  confirming `ProjectModel.frames()` returns all eight fields again.

### 8.2 — Layer `target: "element"` validated but never rendered

- **Root cause.** `renderer/slideRenderer.js` calls `_renderLayers(...)`
  for exactly three of the four spec'd containership scopes — `slide`,
  `frame`, `holder` — never `element`, even though `element` is a
  first-class, documented target (§7/§11) that Builder's own Layer Pack
  editor lets an author choose. `js/layerEngine.js`'s `LayerEngine.render`
  is fully generic and target-agnostic; the gap was purely the missing
  fourth call site.
- **Fix, at the source.** A Layer targeting `element` now renders via the
  same call as `holder` (`_holderRectFor`'s content rect), immediately
  after it in `renderer/slideRenderer.js`. This isn't a new rendering
  concept: with exactly one Holder per page (every Layout ships
  `holders: 1`, §5 — Diptych/Triptych remain a deliberately deferred
  future sprint), Holder and Element are geometrically the same rect
  today, so no new geometry was invented — the existing rect is simply
  handed to the render call the spec already promised.
- **Verified** by importing a synthetic theme with one `target:"element"`
  sticker Layer, rendering a real slide through `SlideRenderer.render()`,
  and confirming the Layer's distinctive fill colour appears at its
  anchored position on the canvas (it did not, before the fix).

### 8.3 — The compiled `assets` map vanished on import

- **Root cause.** `js/themeRegistry.js`'s `importPackage()` /
  `_setImported()` only ever kept `manifest` and `theme` on a registered
  theme record — `pkg.assets`, though correctly compiled by
  `builder.js` and correctly accepted by `validatePackage()`, was simply
  never stored. Every relative-path asset reference (a Representation
  thumbnail, a Frame ornament image, a decoration texture) therefore
  became permanently unresolvable the instant a package was imported —
  the map existed right up until the moment something might have needed
  it.
- **Fix, at the source.** `_setImported(manifest, theme, assets)` now
  stores `assets` on the registry record (defaulting to `{}`);
  `importPackage()` passes `pkg.assets` through; `_persistImported()` /
  `_loadImported()` carry it across a reload the same way
  `manifest`/`theme` always have. A new `ThemeRegistry.getAsset(id,
  relativePath)` resolves a stored path — the map lookup
  `docs/THEME_PROJECT_SPEC.md` §9 always said "the code consuming that
  field is responsible for" now has somewhere real to happen.
  `js/creationFlow.js`'s Representation-thumbnail rendering (`_repThumbnail`)
  is the one concrete, reachable consumer wired to call it — a relative-
  path thumbnail resolves through the correct theme's own asset map
  before falling back to using the raw string.
- **Verified** by importing a synthetic package with a real
  `assets['textures/test.png']` entry, confirming `getAsset()` resolves
  it, confirming an unknown path resolves to `null` rather than
  throwing, and confirming the map survives a `localStorage`
  round-trip.

Full regression: `tools/world-builder/verify/goldenBuild.js` — 30/30,
unchanged, including its own negative fixture. None of the three fixes
touch Validation, Build eligibility, or Publish behaviour — only what
gets stored and read once a package already validated and built
correctly.

### 8.4 — `manifest.thumbnail`/`.previewImage` were embedded base64, not references (Asset Repository Transition)

- **Root cause.** Every other image-bearing field in a compiled package
  (`assets/*`, and any Layout/Frame/Layer/Representation field
  `validator.js`'s `findAssetPaths()` recognizes) was already a plain
  relative-path reference, resolved lazily by whichever code consumes
  it. `manifest.thumbnail`/`.previewImage` were the two exceptions:
  `builder.js`'s `buildManifest()` and `js/themeEngine.js`'s
  `_buildPackageFromZipFiles()` both overwrote the placeholder path
  (`"thumbnail.png"`/`"preview.png"`) with a literal embedded data URI
  "so the compiled package carries real image bytes, not a placeholder
  string" — the right instinct at the time, but it meant these two
  fields could never be externalized to a repository: `supabase/
  schema.sql`'s `themes` table has no `assets` column at all, so
  whatever landed in the `manifest` JSONB column *was* the theme's
  permanent, embedded copy.
- **Fix, at the source, in both producers.** `packageTheme()`/
  `buildManifest()` (`builder.js`) and `_buildPackageFromZipFiles()`
  (`js/themeEngine.js`) now merge `thumbnail.png`/`preview.png`'s real
  bytes into the *same* `assets` map every `assets/*` file already uses,
  and leave the manifest fields as the plain reference they were always
  meant to be. Both producers needed the identical fix — this is what
  gives the sprint's "Cloud Repository (Supabase) and Local Repository
  (a zip/extracted package) must behave identically" requirement real
  teeth, not just a shared interface on paper.
- **Consumer side.** A new `ThemeRegistry.resolveAssetRef(id, value)` —
  factored out of `js/creationFlow.js`'s pre-existing `_repThumbnail`,
  which had already independently discovered this exact rule for
  Representation thumbnails — is the one place that decides whether a
  string is already a usable `src` (`data:`/`http(s):` — a legacy
  embedded package, or a repository's resolved signed URL) or a bare
  reference that still needs `getAsset()`. Wired into the two real
  consumers, `js/themeEngine.js`'s `_renderThemeCard()` and
  `js/creationFlow.js`'s `_themePreview()`; `_repThumbnail` itself now
  calls the shared helper instead of duplicating the rule a third time.
- **Why Publish needed no code change at all.** `ThemeRepositoryClient.
  publish()` already uploads every key of the built package's `assets`
  map to Storage, and `supabase/schema.sql`'s `themes` table already has
  no column for it — once `thumbnail.png`/`preview.png` joined that map,
  they started uploading automatically. Same for `load()`: it already
  resolves the *whole* assets map to signed URLs, so
  `assets['thumbnail.png']` becomes a real, working URL with zero
  Repository-layer changes.
- **Verified**: `goldenBuild.js` gained assertions that
  `manifest.thumbnail === 'thumbnail.png'` (not a `data:` URI) and that
  `pkg.assets['thumbnail.png']` holds the real bytes, plus a round-trip
  check that `ThemeRegistry.resolveAssetRef()` resolves the imported
  reference back to real bytes after `importPackage()`. A separate
  Playwright pass built a real Theme end-to-end through World Builder's
  own UI (upload → Build) and confirmed the same two fields are bare
  references with real bytes in `assets`; a second pass registered a
  theme with `assets` resolved to **signed-URL-shaped strings** (the
  exact shape a real Supabase `load()` produces) and confirmed the
  World Library card's actual `<img src>` in the live DOM resolved to
  that signed URL — proving the existing card-rendering code needed no
  changes at all to work against a repository-sourced Theme.

---

## 8.5 Happy Flow Completion Sprint — Representation ordering, Export confirmed correct

A real Theme (legacy template Representations + one authored Scene) was
traced live end to end, per the sprint's own "instrument first, no
speculative fixes" instruction. Two symptoms were reported, one real, one
not:

- **Real bug, fixed**: `theme.representations` had every Scene's
  converged Representation appended *after* the legacy, template-seeded
  ones (`js/creationFlow.js`'s carousel always starts at index 0 and
  "Start Creating" applies whichever index is current) — so a Theme
  Author who never swiped the carousel got an empty legacy
  Representation instead of their own authored content, even though the
  Theme itself was correctly discovered and applied. Fixed in
  `builder.js`'s `convergeScenes()`: Scene-derived Representations are
  now prepended, not appended. See `docs/THEME_PROJECT_SPEC.md`'s "Happy
  Flow Completion Sprint — Representation Ordering" section for the full
  trace and fix.
- **Not a bug, confirmed by direct comparison**: Export
  (`_downloadDataURL(project.lastBuild.dataURL, ...)`) and Publish
  (`_lastBuiltPackage()`'s `fetch(project.lastBuild.dataURL)`) read the
  identical object — there is no second serialization path to converge.
  The `assets` map legitimately holds embedded `data:image/...` bytes in
  both; `manifest`/`theme` fields hold zero (verified by recursive scan).
  This is required, not accidental — Export's whole purpose is producing
  a self-contained, portable file that doesn't depend on a reachable
  Repository/Storage bucket to open later. No code change was made here.

---

## 9. Disclosed gaps — found, not fixed (by design)

Per the Working Rules ("no new Builder capabilities, no new Studio
capabilities, no redesigns, no speculative improvements"), the following
were investigated and are recorded honestly rather than silently
patched or silently ignored:

- **`fields.cornerRadius` / `fields.inset` / `fields.defaultMargin`.**
  World Builder's Frames screen offers all three (and its own internal
  Engine V2 preview — `tools/world-builder/js/services/engineRuntime.js` —
  genuinely reads and draws them, per the AV-003 fix). None of the three
  appear anywhere in `docs/THEME_PROJECT_SPEC.md` §6's canonical Frame
  field list, and `renderer/slideRenderer.js`'s real corner-radius value
  has only ever come from the enum-driven `ARTWORK_FRAME_PRESET[resolved.frame]`
  lookup (a fixed table of seven named designs, each with its own
  hardcoded radius) — there is no established "freeform numeric
  override" mechanism for corner radius the way `matWidth` already
  overrides the composition-based padding default. Teaching the real
  renderer a new numeric-override concept for these three fields would
  be exactly the kind of contract *redesign* this sprint's Working Rules
  rule out, not a hardening fix. **These three fields are Builder-preview
  authoring aids only — they have no effect on what a published Theme
  actually looks like in Studio.** Any future sprint that wants them to
  matter needs to either map them onto the existing enum vocabulary (a
  design decision, not a bug fix) or extend the frozen Frame
  Specification itself (a spec change, which needs its own sprint, not a
  hardening pass).
- **`theme.supportedCreationTypes` has no Builder authoring surface.**
  See §3 above — a pre-existing, already-documented gap
  (`docs/THEME_PROJECT_SPEC.md` §8/§13), not introduced or widened by
  this sprint, and out of scope for a "no new Builder capabilities"
  hardening pass.

---

## 10. Maintenance

Update this ledger whenever the Builder ⇄ Studio contract changes —
a field added to one side, a consumption path added or removed on the
other, or a disclosed gap in §9 finally getting a real fix. Do not
duplicate this parity information into a sprint report — reports narrate
what happened in a given sprint; this document is the one place that
states the contract's current, living state. If `docs/THEME_PROJECT_SPEC.md`
or `docs/VTHEME_PACKAGE_SPEC.md` change their own field lists, update the
relevant row here in the same change.
