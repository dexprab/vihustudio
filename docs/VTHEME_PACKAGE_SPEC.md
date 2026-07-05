# .vtheme Compiled Package Specification

**Sprint:** TB-4.6 — Theme Builder Runtime Alignment
**Status:** Canonical. This is the one package format Theme Builder emits and
VihuStudio imports — no other compiled shape is supported.
**Scope:** The compiled runtime artifact only. For the pre-compile authoring
folder, see `docs/THEME_PROJECT_SPEC.md` — these are two separate contracts.

---

## Purpose

A **Theme Project** (`docs/THEME_PROJECT_SPEC.md`) is what a person authors:
a folder of JSON files, images, and sub-folders. A **`.vtheme` package** is
what Theme Builder compiles that folder into, and what VihuStudio actually
imports at runtime. They are never the same object — the Theme Project has
no `theme.layouts` array, for instance; the compiler builds one from
`layouts/*.json` at build time.

```
Theme Project (authoring format)
      ↓ Theme Builder: validate + compile
.vtheme package (this spec — runtime format)
      ↓ ThemeEngine.importThemeFile()
ThemeRegistry.importPackage()
      ↓
Theme Registry catalog (Theme Library / ThemeEngine.getTheme())
```

---

## Package Structure

A `.vtheme` file is a single JSON document — not zipped, not compressed.
This is deliberate: it is the runtime's original, fully-supported, first-
class package shape (`js/themeRegistry.js`'s own header comment has called
it "the .vtheme package format" since Sprint 9.2), so compiling straight to
it needs no new infrastructure in Theme Builder. A second, zip-based package
shape also exists for hand-authored folder packages with separate image
files (see **Relationship to the zip package format**, below) — the two are
interchangeable inputs to the same importer, not competing formats.

```json
{
  "manifest": { "...": "see Manifest, below" },
  "theme": { "...": "see Theme, below" },
  "assets": { "relative/path.png": "data:image/png;base64,..." }
}
```

Exactly three top-level keys. No `version`/`format` envelope, no
`builtAt`/`builtWith` provenance fields, no per-collection `{file, data}`
wrappers — anything not read by `ThemeRegistry.importPackage()` does not
belong at the top level. (Theme Builder's own build report — timestamp,
duration, package size — is a UI concern of the *build result*, not a field
of the package itself; see `tools/theme-builder/js/builder.js`'s
`formatReport()`.)

---

## Manifest

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "version": "1.0.0",
  "author": "Vihu",
  "description": "A quiet gallery wall — white mat, soft light, centered.",
  "category": "Official",
  "tags": ["gallery", "art", "museum"],
  "thumbnail": "data:image/png;base64,...",
  "createdDate": "2026-01-01",
  "updatedDate": "2026-07-05",
  "minStudioVersion": "9.5.0",
  "type": "artwork",
  "purpose": "Showcase a child's original artwork the way a museum would.",
  "mood": "Calm, refined, quietly proud.",
  "bestFor": ["Fine art & paintings", "Photography"],
  "notRecommendedFor": ["Silly, high-energy stories"],
  "themeIcon": "🖼️",
  "previewImage": "data:image/png;base64,..."
}
```

The compiled manifest's required fields are exactly
`js/themeRegistry.js`'s `REQUIRED_MANIFEST_FIELDS` — the single list both
the compiler and the importer check against:

| Field | Required | Notes |
|---|---|---|
| `id` | **Required** | Kebab-case, unique. Registry identity — `theme.id` is forced to equal this on import regardless of what the theme object itself carried. |
| `name` | **Required** | Display name. |
| `version` | **Required** | This theme's own semantic version. |
| `author` | **Required** | |
| `description` | **Required** | |
| `category` | **Required** | |
| `tags` | **Required** | May be an empty array. |
| `thumbnail` | **Required** | A data URI (embedded by the compiler from `thumbnail.png`) or an empty string — never a bare relative filename; nothing downstream resolves one. |
| `createdDate` / `updatedDate` | **Required** | `YYYY-MM-DD`. Not read by the runtime; present because the importer's field list requires them. |
| `minStudioVersion` | **Required** | Checked against `ThemeRegistry.THEME_SYSTEM_VERSION` via `ThemeRegistry.isCompatible()`. An incompatible package is rejected at import with a friendly message, never a crash. |
| `type` | Optional | `"story"` \| `"artwork"`. Missing/invalid normalizes to `"story"` (`ThemeRegistry._normalizeManifest`). |
| `previewImage`, `purpose`, `mood`, `bestFor`, `notRecommendedFor`, `themeIcon` | Optional | Rich Theme Library metadata. Read directly by `ThemeEngine._renderThemeCard()` when present; absent for any theme that doesn't set them. |

**Field name note.** This is `minStudioVersion`, not `minimumStudioVersion`.
There is exactly one canonical name across Theme Builder, Theme Registry,
Theme Engine, and both spec documents as of this sprint — see
`docs/THEME_PROJECT_SPEC.md` §13 for the resolved history.

---

## Theme

The compiled `theme` object is the flat runtime shape
`ThemeRegistry.get(id)` / `ThemeEngine` read directly — never `theme.json`'s
raw, unmerged content.

**Story Theme** (`manifest.type === "story"` or absent):

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "frame": { "color": "#1D3457" },
  "panel": { "color": "#FFFFFF" },
  "storyText": { "font": "Georgia, serif", "size": 16, "color": "#FFFFFF" },
  "footerText": { "font": "Georgia, serif", "size": 12, "color": "#FFFFFF" },
  "watermark": { "font": "Georgia, serif", "size": 10, "color": "#FFFFFF" },
  "variants": [],
  "decorations": [],
  "supportedCreationTypes": [ "story" ],
  "layouts": [ "...flattened from layouts/*.json" ],
  "frameVariations": [ "...flattened from frames/*.json" ],
  "layerPack": [ "...flattened from layer-packs/*.json" ],
  "representations": [ "...flattened from representations/*.json — omitted if the project has none" ]
}
```

`frame`, `panel`, `storyText`, `footerText`, `watermark` are required —
`ThemeRegistry.validatePackage()`'s `REQUIRED_THEME_FIELDS`.

**Artwork Theme** (`manifest.type === "artwork"`):

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "description": "...",
  "presentation": "gallery",
  "supportedCreationTypes": [ "artwork" ],
  "layouts": [ "..." ],
  "frameVariations": [ "..." ],
  "layerPack": [ "..." ],
  "representations": [ "..." ]
}
```

Only `name` is required (`REQUIRED_ARTWORK_THEME_FIELDS`) — every
presentation field (`presentation`/`background`/`frame`/`paper`/`caption`/
`shadow`/`lighting`/`composition`) is optional, resolved through
`js/themePresets.js`'s preset ladder when absent.

`layouts` / `frameVariations` / `layerPack` / `representations` are always
flat arrays of plain preset objects on `theme` — never wrapped in `{file,
data}` pairs, never left as separate top-level package keys. This is the
one place Theme Builder's compiler does real work beyond copying files: it
merges every `layouts/*.json` entry (whether a file holds one object or an
array) into `theme.layouts`, and likewise for `frames/` →
`theme.frameVariations`, `layer-packs/` → `theme.layerPack`, and
`representations/` → `theme.representations`
(`tools/theme-builder/js/builder.js`'s `collectFolder()` / `buildTheme()`).

**`supportedCreationTypes`** (Sprint 10.1 — Theme Driven Representations) —
a flat string array naming which of Studio's Creation Type ids
(`js/creationFlow.js`'s `CREATION_TYPES`) this theme is offered under in
Step 2 of the Creation Flow. Not part of any Theme Project *folder* (§8 of
`docs/THEME_PROJECT_SPEC.md` covers `representations/`; this field's
author-time home is not yet finalized — see that spec's Reserved Future
Sections) — today it is only authored directly on the in-code Official
Theme entries in `js/themeRegistry.js`. A theme with no
`supportedCreationTypes` never appears under any Creation Type; Studio does
not guess.

**`representations`** — each entry is a complete page style Studio's
Creation Flow Step 3 ("Choose a Page Style") and Context Panel ("Change
Representation") render directly, with zero Studio-side knowledge of any
specific theme's Representation names. See `docs/THEME_PROJECT_SPEC.md` §8
for the full field-by-field schema (`id`/`name`/`description`/`thumbnail`/
`supportedCreationTypes`/`layout`/`defaultFrame`/`defaultLayerPack`/
`background`/`actions`).

---

## Assets

A flat map, every key a path relative to the Theme Project's `assets/`
folder, every value a data URI:

```json
{
  "textures/linen.png": "data:image/png;base64,...",
  "stickers/wax-seal.png": "data:image/png;base64,..."
}
```

Identical in shape to what `js/zipReader.js` + `js/themeEngine.js`'s
`_buildPackageFromZipFiles()` already produce when unpacking a zipped
package — one canonical assets shape regardless of which package format
supplied it.

A theme with no `assets/` folder compiles to `"assets": {}` — the key is
always present, even when empty.

---

## Metadata

`metadata.json` is **not** a top-level key of the compiled package. Its
fields are merged onto `manifest` at compile time, additively — a field the
manifest already set (e.g. `description` present in both `manifest.json` and
`metadata.json`) is never overwritten by the metadata copy
(`tools/theme-builder/js/builder.js`'s `buildManifest()`). This mirrors
exactly how `_buildPackageFromZipFiles()` folds a zipped package's
`metadata.json` onto `pkg.manifest` at import time — the two package formats
converge on one manifest shape either way.

---

## Versioning

Two independent version numbers travel with a package, and they mean
different things:

- **`manifest.version`** — this theme's own content version, bumped by the
  author whenever the theme's fields change. Not checked by the importer;
  informational and for the author's own changelog.
- **`manifest.minStudioVersion`** — the minimum theme-system contract
  version (`ThemeRegistry.THEME_SYSTEM_VERSION`) this package needs. This
  IS checked, via `ThemeRegistry.isCompatible()`, and blocks import with a
  friendly message if the running VihuStudio build is older.

`manifest.builderVersion` (the Theme Project's own field, see
`docs/THEME_PROJECT_SPEC.md` §2) does not appear in the compiled package —
it is an authoring-time gate Theme Builder itself checks before compiling,
not something the runtime needs once a `.vtheme` exists.

---

## Expected Importer Behaviour

`ThemeEngine.importThemeFile(file)`:

1. Reads the file as an `ArrayBuffer`.
2. If the bytes are a zip archive (`ZipReader.isZip`), unpacks it via
   `ZipReader.read()` + `_buildPackageFromZipFiles()` into this exact
   `{manifest, theme, assets}` shape first.
3. Otherwise parses the bytes directly as JSON — this is the path every
   Theme-Builder-compiled `.vtheme` takes.
4. Calls `ThemeRegistry.importPackage(pkg)`.

`ThemeRegistry.importPackage(pkg, opts)`:

1. `validatePackage(pkg)` — checks every `REQUIRED_MANIFEST_FIELDS` entry is
   present, `manifest.id` matches the naming pattern, `minStudioVersion` is
   compatible, and `theme` has the required fields for its (normalized)
   `type`. Returns `{ok:false, problems:[...]}` on any failure — never
   throws, never partially imports.
2. Normalizes `manifest.type` (defaults to `"story"`).
3. Forces `theme.id = manifest.id` — the registry's identity always comes
   from the manifest, even if `theme.json` disagreed (a project passes
   Theme Builder validation specifically because it can't disagree — see
   `docs/THEME_PROJECT_SPEC.md` §11's id/name equality rule).
4. On an id collision, returns `{ok:false, duplicate:true}` unless
   `opts.onDuplicate` says `replace` / `copy` / `cancel`.
5. On success, registers the theme under `source: 'imported'`, persists it
   to `localStorage`, and returns `{ok:true, theme, manifest}`.

A package built by Theme Builder against this spec passes step 1 by
construction (Theme Builder's own validator enforces the identical field
list before allowing a build) — there is no compatibility shim in either
direction; both sides read and write the same contract.

---

## Relationship to the zip package format

VihuStudio's importer also accepts a zipped folder package (a real zip
archive shaped like the Theme Project in `docs/THEME_PROJECT_SPEC.md` §1,
with a `<RootFolder>/<RootFolder>.vtheme` manifest+theme file inside) —
this is how `themes/MuseumGallery.vtheme` ships today (Sprint 9.6). Both
formats decode to the exact same in-memory `{manifest, theme, assets}`
shape before `ThemeRegistry.importPackage()` ever sees them
(`_buildPackageFromZipFiles()` is the zip-only decode step). Theme Builder
does not compile to the zip format — it emits the flat JSON format
directly, since the flat format is not a legacy fallback but the runtime's
original, still-first-class package shape (`js/themeRegistry.js`'s "Theme
Package format" comment has described it this way since Sprint 9.2). A
theme that needs its images kept as discrete files (rather than inlined
base64) can still be hand-packaged as a zip — the two formats are
alternate inputs to the same importer, not a hierarchy where one is
"real" and the other is a workaround.

---

## Relationship to Theme Project

| | Theme Project | `.vtheme` package |
|---|---|---|
| **Who reads it** | Theme Builder (load + validate) | VihuStudio (`ThemeEngine`/`ThemeRegistry`) |
| **Shape** | A folder: `manifest.json`, `metadata.json`, `theme.json`, `layouts/`, `frames/`, `layer-packs/`, `representations/` (optional), `assets/`, images | A single JSON document: `{manifest, theme, assets}` |
| **`theme.layouts`/`frameVariations`/`layerPack`/`representations`** | Do not exist — these come from separate folders | Flat arrays, merged by the compiler (`representations` omitted entirely if the project has none) |
| **Images** | Separate files (`preview.png`, `assets/textures/linen.png`, ...) | Data URIs, embedded inline |
| **`metadata.json`** | A separate required file | Merged onto `manifest` — not a top-level package key |
| **Identity source of truth** | `manifest.json`'s `id`, cross-checked against `theme.json`'s `id` (must match) | `manifest.id` alone — `theme.id` is overwritten to match on import regardless |
| **Never contains** | Runtime behaviour, rendering logic, canvas instructions | Anything not read by `ThemeRegistry.importPackage()` — no build provenance, no per-file wrappers |

These are separate contracts on purpose. A Theme Project can be reorganized,
re-authored, or hand-edited freely without ever touching how the compiled
package looks to VihuStudio — that boundary is exactly what Theme Builder
exists to enforce.
