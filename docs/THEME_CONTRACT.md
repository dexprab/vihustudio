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
| `holders` | Always `1` (§5's own "Reserved, always 1 in V1") | N/A — no multi-Holder layout exists yet | Aligned (both sides agree it's inert) |

## 6. Layer Pack (`target`)

`docs/THEME_PROJECT_SPEC.md` §7/§11 name four containership scopes a
Layer's `target` may be: `slide`, `frame`, `holder`, `element`.

| `target` value | Validated as legal? | Actually rendered? | Status |
|---|---|---|---|
| `slide`, `frame`, `holder` | Yes | Yes — `renderer/slideRenderer.js` calls `_renderLayers(...)` for each | Aligned |
| `element` | Yes — `validator.js`, `constants.js`'s `LAYER_TARGETS`, and World Builder's own Layer Pack editor all treat it as valid | **No, before this sprint** — `slideRenderer.js` never called `_renderLayers` for this scope at all | **Fixed this sprint** — see §8.2. |

## 7. Assets (`assets/*` → the compiled `assets` map)

| Stage | Behaviour before this sprint | Status |
|---|---|---|
| Builder compiles `assets/` into `{relativePath: dataURI}` | Correct — `builder.js`'s `packageTheme()` | Aligned (unchanged) |
| `ThemeRegistry.importPackage()` stores it on the registered theme record | **Did not** — only `manifest`/`theme` were kept; `pkg.assets` was read, validated implicitly, and then discarded | **Fixed this sprint** — see §8.3. |
| A relative asset path (e.g. a Representation `thumbnail`) resolves back to its data URI | **Could not** — the map that would answer the lookup no longer existed by the time any consumer needed it | **Fixed this sprint** for the one reachable consumer (`js/creationFlow.js`'s Representation thumbnail); see §8.3. |

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
