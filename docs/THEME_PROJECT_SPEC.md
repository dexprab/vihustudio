# Theme Project Specification

**Sprint:** TB-4.5 — Official Theme Project Specification
**Status:** Canonical. Every Official Theme is authored against this contract.
**Scope:** Authoring-time structure and schema only. This document does not
change Theme Engine, Theme Registry, Theme Library, Theme Import, or Theme
Builder — it describes the contract those frozen components already assume,
so every future Official Theme is built the same way instead of inventing
its own structure.

---

## 0. How to read this document

A **Theme Project** is a folder a person authors by hand (or with Theme
Designer, later). **Theme Builder** loads that folder, validates it, and
compiles it into a single `ThemeName.vtheme` package. **VihuStudio**
imports that package at runtime. Three different programs, one contract
in between each handoff:

```
Theme Project (this spec)
      ↓ load + validate
Theme Builder
      ↓ compile
ThemeName.vtheme (this spec, "Compiled Package" sections)
      ↓ import
VihuStudio (Theme Registry / Theme Engine)
```

Every section below states the rule, then — where it matters for the
package to actually import and render correctly — cross-references the
real, already-shipping VihuStudio code that consumes it. Where today's
Theme Builder (TB-1/TB-2) doesn't yet fully implement a rule in this
spec, that is called out explicitly in **§14 Known Reconciliation
Items** rather than silently glossed over. This document does not fix
those gaps — TB-4.5 is documentation only — it names them so the team
that closes them (and the person authoring Museum Gallery next) isn't
surprised.

**Repository convention (Sprint 11.2):** every Official Theme's Theme
Project source lives under `official-worlds/<WorldName>/` at the
repository root — e.g. `official-worlds/MuseumGallery/`. This is source
only; it is never consumed directly by Studio. Compiling it through
Theme Builder is the one and only path to a usable package, exactly the
same path a third-party World creator follows — there is no privileged
pipeline for a World merely because it ships with the product (see
`docs/WORLD_ASSET_CONTRACT.md`'s Import Parity rule).

**Naming note (Sprint B1.0):** "Theme Builder" below refers to the
validate/compile engine this spec describes, not a specific product UI.
That engine survives, untouched, as the internal Build services
(`tools/world-builder/js/services/{projectLoader,validator,builder}.js`)
behind the new **World Builder** application — see
`docs/WORLD_BUILDER_ARCHITECTURE.md`. World Builder's own Screens 1–2
(this sprint) don't yet expose Validate/Build in the UI; those services
are reached today only by internal tooling
(`tools/world-builder/verify/goldenBuild.js`) until a future Builder
Workspace sprint wires them into the visual product.

---

## 1. Theme Project Structure

Canonical folder layout:

```
ThemeProject/
├── manifest.json          Required
├── metadata.json           Required
├── theme.json              Required
├── README.md               Recommended
├── thumbnail.png            Recommended
├── preview.png               Recommended
├── layouts/                Required (≥ 1 file)
│   └── *.json
├── frames/                  Required (≥ 1 file)
│   └── *.json
├── layer-packs/              Required (may compile to an empty pack)
│   └── *.json
├── representations/            Optional
│   └── *.json
├── assets/                    Optional
│   ├── frames/
│   ├── textures/
│   ├── decorations/
│   ├── stickers/
│   └── icons/
└── screenshots/                Optional
```

The folder's own name (`ThemeProject/` above) becomes the theme's working
name during authoring only — it is never read by the loader or the
compiler. The theme's real identity always comes from `manifest.json`'s
`id`.

| Path | Purpose | Required? | Contents | Owns | Relates to |
|---|---|---|---|---|---|
| `manifest.json` | Identity + compatibility | **Required** | See §2 | Theme identity | Read first by the loader; everything else is meaningless without it |
| `metadata.json` | Theme Library presentation | **Required** | See §3 | Display/marketing info | Feeds the Theme Library picker card |
| `theme.json` | Global theme defaults | **Required** | See §4 | Theme-wide defaults, not the runtime shape | Base object the compiler merges `layouts/`, `frames/`, `layer-packs/` into |
| `README.md` | Human documentation | Recommended | Free-form Markdown | Author's own notes | Never read by loader, validator, or compiler |
| `thumbnail.png` | Small Theme Library grid image | Recommended | A single raster image | Theme Library card | Referenced by `manifest.thumbnail` / shown when present |
| `preview.png` | Larger Theme Library preview image | Recommended | A single raster image | Theme Library card | Referenced by `metadata.previewImage` / shown when present |
| `layouts/` | Slide layout presets | **Required** | One JSON file per layout, or one file holding an array | A Layout owns its own composition | See §5; compiles into `theme.layouts` |
| `frames/` | Frame Variation presets | **Required** | One JSON file per variation, or one file holding an array | A Frame owns its own presentation fields | See §6; compiles into `theme.frameVariations` |
| `layer-packs/` | Layer declarations | **Required** | One JSON file per pack, or one file holding an array | A Layer Pack owns a flat list of independent Layers | See §7; compiles into `theme.layerPack` |
| `representations/` | Complete page styles Studio's Creation Flow offers | Optional | One JSON file per Representation, or one file holding an array | A Representation owns a reference to one Layout + a default Frame, nothing else | See §8; compiles into `theme.representations` |
| `assets/` | Binary/media files the JSON above references | Optional | Images, textures, icons | Nothing on its own — assets are inert until referenced | See §9 |
| `screenshots/` | Documentation/portfolio screenshots | Optional | Raster images | Author's own portfolio material | Never read by loader, validator, or compiler — purely for `README.md` illustrations, marketplace listings, or human review; do not confuse with `preview.png`/`thumbnail.png`, which the Theme Library actually renders |

A Theme Project is **flat at the top level** — no nested theme-within-a-
theme, no symlinks, no build tooling of its own. Everything the compiler
needs is one of the paths above.

---

## 2. Manifest Specification (`manifest.json`)

The manifest is the theme's passport: identity and compatibility, nothing
about how it looks.

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "version": "1.0.0",
  "builderVersion": "1.0.0",
  "minStudioVersion": "9.5.0",
  "author": "Vihu",
  "category": "Official",
  "tags": ["gallery", "art", "museum", "artwork"]
}
```

| Field | Required? | Type | Meaning |
|---|---|---|---|
| `id` | **Required** | string, kebab-case (§10) | The theme's permanent identity. Never changes across versions. |
| `name` | **Required** | string | Display name shown in the Theme Library. |
| `version` | **Required** | semantic version (`MAJOR.MINOR.PATCH`, optional `-prerelease`) | This theme's own version, bumped by the author on every content change. |
| `builderVersion` | **Required** | semantic version | The Theme Builder schema version this project was authored against. Lets Theme Builder refuse (or warn on) a project written for a newer contract than it understands. |
| `minStudioVersion` | **Required** | semantic version | The minimum VihuStudio theme-system version (`ThemeRegistry.THEME_SYSTEM_VERSION`) this package needs. Checked at import time — see §14, naming note. |
| `author` | **Required** | string | Author or studio name. |
| `category` | **Required** | string | Grouping shown in the Theme Library (`"Official"`, `"Imported"`, etc.). Official themes always use `"Official"`. |
| `tags` | **Required** | string array | Free-form search/filter tags. May be an empty array. |
| `description` | **Required** | string | Short one-line summary. May duplicate `metadata.description` for tooling that only reads the manifest. |
| `thumbnail` | **Required** | string | Authoring-time: relative path to the thumbnail image (conventionally `"thumbnail.png"`). Asset Repository Transition (Sprint 2) — the compiler leaves this as the plain reference; it no longer replaces it with an embedded data URI. The real bytes join the compiled `assets` map under the same key, and the code consuming this field resolves it via `ThemeRegistry.resolveAssetRef()` — see `docs/VTHEME_PACKAGE_SPEC.md`. |
| `createdDate` / `updatedDate` | **Required** | `YYYY-MM-DD` | Authoring provenance. Not read by the runtime; required anyway, matching `js/themeRegistry.js`'s `REQUIRED_MANIFEST_FIELDS` exactly — one canonical required-field list, no divergence between authoring and runtime. |
| `type` | Optional | `"story"` \| `"artwork"` | Which of VihuStudio's two theme types this is. Missing/invalid normalizes to `"story"` — never omit it for an Artwork Theme. |

**Required means required everywhere.** Every field marked **Required**
above is checked, under the identical name, by both Theme Builder's
validator (`tools/world-builder/js/services/validator.js`) and the runtime importer's
`REQUIRED_MANIFEST_FIELDS` (`js/themeRegistry.js`) — see §14. A manifest
that passes Theme Builder's validation is guaranteed to pass
`ThemeRegistry.validatePackage()` too.

No other top-level keys are read by the compiler or the runtime today.
An author may still add their own (e.g. an internal tracking key) — they
pass through untouched, but carry no meaning outside this project.

---

## 3. Metadata Specification (`metadata.json`)

Where the manifest is identity, metadata is presentation: what a child
(or their parent) sees in the Theme Library before deciding to use this
theme.

```json
{
  "displayName": "Museum Gallery",
  "description": "A quiet gallery wall — white mat, soft light, centered.",
  "purpose": "Showcase a child's original artwork the way a museum would.",
  "mood": "Calm, refined, quietly proud.",
  "bestFor": ["Fine art & paintings", "Photography", "Portraits", "Keepsake gifts"],
  "notRecommendedFor": ["Silly, high-energy stories"],
  "themeIcon": "🖼️",
  "previewImage": "preview.png",
  "license": "Proprietary — part of VihuStudio",
  "credits": []
}
```

| Field | Required? | Type | Meaning |
|---|---|---|---|
| `displayName` | **Required** | string | Shown as the theme's name in the Theme Library (may differ from `manifest.name`, e.g. for localization later). |
| `description` | **Required** | string | Short description shown under the theme's name. |
| `category` | **Required** | string | Same grouping concept as `manifest.category`; kept here too so metadata is self-contained for Theme Library rendering without needing the manifest. |
| `purpose` | Optional | string | One sentence of creative intent. Shown in the Theme Library card when present (`ThemeEngine._renderThemeCard`). |
| `mood` | Optional | string | Short mood descriptor. Authoring/documentation field today; reserved for future Theme Library filtering. |
| `bestFor` | Optional | string array | Shown as "Best for: …" on the Theme Library card when present. |
| `notRecommendedFor` | Optional | string array | Authoring guidance. Not yet surfaced in the UI — reserved for a future "is this theme right for my story?" prompt. |
| `themeIcon` | Optional | single emoji | Small badge shown in the corner of the Theme Library card. |
| `previewImage` | Optional | relative path | When present, the Theme Library card shows this image instead of the default colour-swatch preview. |
| `tags` | Optional | string array | Duplicates `manifest.tags` for tooling that only reads metadata. |
| `license` | Optional | string | Human-readable licensing note. Authoring/documentation only — not enforced or displayed anywhere yet. |
| `credits` | Optional | array of `{name, role}` | Attribution for artwork, fonts, or assets bundled with the theme. Authoring/documentation only today. |

`purpose`, `mood`, `bestFor`, `notRecommendedFor`, `themeIcon`, and
`previewImage` are not decorative filler — they are the exact field names
`ThemeRegistry.registerOfficial` copies onto an Official Theme's
auto-derived manifest, and `ThemeEngine._renderThemeCard` reads them
directly. Get the names right and the Theme Library picks them up with
zero extra work.

---

## 4. Theme Definition (`theme.json`)

`theme.json` is **not** the runtime theme object. It is the small set of
theme-wide defaults and identity fields that don't belong to any one
Layout, Frame, or Layer Pack — the scaffolding the compiler starts from
before folding in `layouts/`, `frames/`, and `layer-packs/`.

```json
{
  "id": "museum-gallery",
  "name": "Museum Gallery",
  "presentation": "gallery",
  "defaultPalette": {},
  "defaultTypography": {},
  "defaultLayerPack": null
}
```

| Field | Required? | Meaning |
|---|---|---|
| `id` | **Required** | Must match `manifest.id` exactly. Validated as a duplicate-consistency check (§12). |
| `name` | **Required** | Must match `manifest.name`. |
| `presentation` | Optional | For an Artwork Theme, the Presentation Preset id this theme resolves through (see `js/themePresets.js` `HOLDER_PRESETS.image`) before any of this project's own Frame Variations apply as overrides. |
| `defaultPalette` | Reserved | Placeholder object for a future default colour palette. Not read by the runtime today — see §13. |
| `defaultTypography` | Reserved | Placeholder object for a future default type ramp. Not read by the runtime today — see §13. |
| `defaultLayerPack` | Reserved | Placeholder for naming which `layer-packs/` file is the theme's "default" pack, once a theme is allowed to ship more than one. Not read today — every file under `layer-packs/` compiles into one flat pack (§7). |

**No runtime behaviour lives in this file.** It never contains rendering
logic, canvas instructions, or anything the compiler can't express as
plain data. Its entire job is to say "here is this theme, and here is
what it defaults to before Layouts/Frames/Layers add anything."

**Compiled shape.** The Theme Builder compiler is responsible for
producing the final runtime `theme` object by merging:

```
runtime.theme = {
  ...theme.json's own fields (minus id/name, which move to the manifest join),
  layouts:         [ ...every layouts/*.json entry, flattened ],
  frameVariations: [ ...every frames/*.json entry, flattened ],
  layerPack:       [ ...every layer-packs/*.json entry, flattened ],
  representations: [ ...every representations/*.json entry, flattened ]  // omitted entirely if the project has none
}
```

This is the exact shape `ThemeRegistry.get(id)` / `ThemeEngine` expect —
see `official-worlds/MuseumGallery/` (Sprint 10.2 — Official Theme 001)
for a complete, real reference Theme Project, and `themes/
MuseumGallery.vtheme` for what it compiles to.

---

## 5. Layout Specification (`layouts/*.json`)

A Layout decides where the Frame sits on the Slide, and how its caption
is arranged — a **composition**, not just a rectangle.

```json
{
  "id": "wide",
  "name": "Wide",
  "description": "Image on the left, caption on the right.",
  "aspect": "wide",
  "composition": "right",
  "holders": 1,
  "supportedFrames": ["classic-white-mat", "floating-frame"],
  "defaultHolderMode": "fit"
}
```

| Field | Required? | Meaning |
|---|---|---|
| `id` | **Required** | Kebab-case, unique within this theme (§10, §12). |
| `name` | **Required** | Display name shown in the Layout picker. |
| `description` | Optional | One line shown alongside the name. |
| `aspect` | **Required** | Which geometry preset this layout resolves to. **Must be one of the six values the engine already understands: `portrait`, `landscape`, `square`, `wide`, `quote`, `full-bleed`** (`renderer/slideRenderer.js`'s `LAYOUT_RECT`). An unrecognized `aspect` silently falls back to the legacy fixed panel — not an error, but not what the author intended either. |
| `composition` | Optional, default `"below"` | `"below"` — caption sits under the Frame (the default look). `"right"` — Frame on the left, caption in a column to the right (Wide). `"quote"` — no Frame/Holder at all; a centered quote replaces the picture entirely. Composition is deliberately a small closed enum today, not a free-form layout language — see §13's Responsive Layouts. |
| `holders` | Reserved, always `1` in V1 | How many Holders this layout's Frame contains. Every Official Theme ships `1` — multi-Holder layouts (Diptych/Triptych) are a deliberately deferred future sprint, not something to improvise per-theme. |
| `supportedFrames` | Optional | Authoring guidance only: which Frame Variation ids this layout was designed to look good with. Not enforced — every Frame Variation remains selectable with every Layout. |
| `defaultHolderMode` | Optional | Authoring guidance only: `"fit"` \| `"fill"` \| `"original"`. Documents the layout's intended Holder mode; does not currently auto-apply it (Holder mode is chosen independently per picture). |

**Responsibilities.** A Layout owns geometry and composition. It never
owns colour, texture, or border — that's the Frame's job (§6). It never
owns caption *content* — that's the Layer Pack's job (§7); a Layout only
decides where that content is placed.

---

## 6. Frame Specification (`frames/*.json`)

A Frame is the exhibition mount: the presentation container around a
Holder. Frames remain presentation containers only — they never touch
the Element inside them.

```json
{
  "id": "gold-accent",
  "name": "Gold Accent",
  "description": "A warm, premium gold border on a white mat.",
  "fields": {
    "background": "white",
    "frame": "white-mat",
    "paper": "smooth",
    "shadow": "gallery",
    "matWidth": 24,
    "frameThickness": 4,
    "borderColor": "#C9A227",
    "wallTone": "#F8F2E4"
  }
}
```

| Field | Required? | Meaning |
|---|---|---|
| `id` | **Required** | Kebab-case, unique within this theme. |
| `name` | **Required** | Display name shown in the Frame Variation picker. |
| `description` | Optional | One line, e.g. a "mood" note. |
| `fields.background` | Optional | The mat fill, one of the existing background enum values (`white`, `cream`, `kraft-paper`, `watercolor-paper`, `notebook-paper`, `black`, `transparent`, `bulletin-board`). |
| `fields.frame` | Optional | The frame ornament design (`none`, `white-mat`, `floating`, `wood`, `polaroid`, `tape`, `bulletin-board`). |
| `fields.paper` | Optional | A texture pass drawn under the picture (`smooth`, `notebook`, `kraft`, `watercolor`, `canvas`, `handmade`). |
| `fields.shadow` | Optional | Drop-shadow preset (`none`, `soft`, `gallery`, `floating`). |
| `fields.matWidth` | Optional | Padding, in px, between the Frame's outer edge and the picture. Overrides the `composition`-based default padding when present. |
| `fields.frameThickness` | Optional | Border stroke width, in px. `0` (or omitted) means no visible border line. |
| `fields.borderColor` | Optional | Border stroke colour. Only visible when `frameThickness > 0`. |
| `fields.wallTone` | Optional | The **Slide's** background colour behind the Frame — the gallery wall, not the mat. A distinct concept from `background` (which is inside the Frame). Applies even on a Frame-less page (e.g. a Quote layout) since it's a room colour, not a mat colour. |

**Default Holder configuration.** A Frame does not itself configure the
Holder's presentation mode (Fit/Fill/Original) — that is always a
per-picture choice (§ Holder, below), universal across every theme.
What a Frame *does* constrain is the space the Holder has to work with
(`matWidth`) and what shows around it once the Holder's content is
placed (`borderColor`, `wallTone`, `shadow`).

---

## 7. Layer Pack Specification (`layer-packs/*.json`)

**Layers are independent of containership.** A Layer Pack is a flat list
of Layers; each Layer targets exactly one of the four frozen
containership scopes, but the Layer Pack itself does not belong to a
Layout or a Frame — any Layout, with any Frame Variation, renders the
same active Layer Pack.

```json
[
  {
    "id": "museum-caption",
    "type": "text",
    "target": "holder",
    "anchor": "bottom-center",
    "offsetX": 0,
    "offsetY": 16,
    "zIndex": 1,
    "visible": true,
    "text": { "source": "museumCaption", "font": "Georgia, serif", "size": 20, "color": "#3A3A3A" }
  },
  {
    "id": "page-number",
    "type": "text",
    "target": "slide",
    "position": "bottom-left"
  },
  {
    "id": "wax-seal",
    "type": "sticker",
    "target": "frame",
    "anchor": "bottom-right",
    "offsetX": -28,
    "offsetY": -28,
    "zIndex": 2
  }
]
```

| Field | Required? | Meaning |
|---|---|---|
| `id` | **Required** | Kebab-case, unique across the *entire compiled pack* (not just one file — see §12). |
| `type` | **Required** | `"text"` \| `"sticker"` \| `"decoration"`. |
| `target` | **Required** | `"slide"` \| `"frame"` \| `"holder"` \| `"element"` \| `"overlay"` — one of five containership scopes. A Layer never targets more than one scope. |
| `scope` | Optional, default none (global) | A Layout id this Layer is restricted to. Omitted (every hand-authored Layer before the Builder Convergence Sprint) means the Layer is active for every Layout/Representation in the theme, exactly as before. Set, the Layer only renders when the current slide's `metadata.layout` matches — this is how a Builder-authored Scene's own Layers stay scoped to the one Layout/Representation that Scene converged into, without cross-contaminating any other page using the same theme. |
| `rect` | Optional, default none (anchor-based) | A fractional `{ x, y, w, h }` (0–1 of whatever rect the target scope hands it) giving the Layer a free-form absolute position/size, as an alternative to `anchor`/`offsetX`/`offsetY`. Omitted (every hand-authored Layer before the Builder Convergence Sprint), the Layer resolves via anchor exactly as before. This is how a Scene's own Place/Decoration/Text position survives compilation. |
| `anchor` | Optional, default `"bottom-center"` | One of the nine standard anchor points (`top`/`bottom`/`middle` × `left`/`center`/`right`, e.g. `"top-left"`), resolved relative to whatever rect the target scope hands it (or `rect`, when present). |
| `offsetX` / `offsetY` | Optional, default `0` | Pixel nudge from the resolved anchor point. |
| `zIndex` | Optional, default `0` | Draw order within the same target scope. Lower draws first (further back). |
| `visible` | Optional, default `true` | Set `false` to author a Layer that ships disabled by default. |
| `text` | Required when `type: "text"` | `{ source, content, font, size, color }`. `source` names a known dynamic binding (`"museumCaption"`, `"slideCaption"`) or is omitted for a static `content` string. An entry with neither `text.source` nor `text.content` (e.g. `page-number`, `handle`) is a **declarative-only** entry: it documents that this Layer exists in the theme's inventory, but the actual pixels are still drawn by the pre-existing, unrelated engine feature it names (see `position`, below) — never a second, competing renderer for the same content. |
| `sticker` | Required when `type: "sticker"` | `{ glyph, size, color }`. `glyph` may be any single character/emoji; omitted, a themed default (by `id`, where one is registered) or a plain drawn ornament is used instead. |
| `decoration` | Required when `type: "decoration"` | `{ kind, alpha, radius, color, image, fit, ... }`. `kind` selects which decorative effect draws: `"spotlight"` \| `"paperTexture"` \| `"shadowWash"` (the original three, radius/alpha-driven glow/texture/vignette effects) or `"fill"` \| `"image"` (added by the Builder Convergence Sprint — a solid `color` rect, or a real `image` drawn into the Layer's rect per `fit` (`"fit"` \| `"fill"`), resolved the same way any other Theme asset reference resolves — `ThemeRegistry.resolveAssetRef()`). |
| `position` | Optional, only meaningful on the declarative `handle` / `page-number` ids | Pins that engine feature to a specific corner (`"bottom-left"`, `"bottom-right"`, etc.) for this theme, overriding the Story Theme's own default position. |

**Ordering.** Layers of the same `target` draw in ascending `zIndex`;
Layers of different targets draw at the point in the render pipeline
their scope naturally occurs (Slide background → Frame → Holder →
Element → **Overlay**, the last one painted, on top of literally
everything else on the page — footer, page number, legacy Scene
elements, stickers), never interleaved by authored order across scopes.

**The `overlay` target** (Builder Convergence Sprint). The original four
containership scopes each render at one specific point *inside* the
Frame/Panel pipeline, and three of them (`frame`/`holder`/`element`) only
render at all when the page has a resolved Picture Border — correct for
theme-authored ornaments tied to an actual picture, wrong for a Scene's
own foreground content (an image or caption meant to sit above the
artwork unconditionally, at an absolute Scene-canvas position). `overlay`
is a fifth, generic scope with no such gating, painted last, at full-
canvas fractional coordinates. No hand-authored theme uses it directly —
it exists so a Builder-authored Scene's Decoration/Text Layers have
somewhere correct to converge into (see "Builder Convergence Sprint" at
the end of this document's history, below).

**Visibility.** `visible: false` is the only way to ship a Layer that
exists in the pack (and therefore appears in any future layer-management
UI) without rendering by default.

---

## 8. Representation Specification (`representations/*.json`)

**Sprint:** TB-4.7 — Theme Driven Representations.

A Representation is a complete, named page style — what a child actually
picks in Studio's Creation Flow Step 3 ("Choose a Page Style") and in the
Context Panel's "Change Representation." Studio itself knows nothing about
any specific Representation (not "Showcase," not "Portrait," not any future
theme's own names) — it only knows how to render whatever this array
contains. See `js/creationFlow.js` and `js/contextPanel.js`.

```json
{
  "id": "showcase",
  "name": "Showcase",
  "description": "Big and bold — the classic gallery look.",
  "thumbnail": "🖼️",
  "supportedCreationTypes": ["artwork"],
  "layout": "landscape",
  "defaultFrame": "classic-white-mat",
  "defaultLayerPack": null,
  "background": null,
  "actions": ["replaceArtwork", "cropRotate", "frameVariation", "editCaption"]
}
```

| Field | Required? | Meaning |
|---|---|---|
| `id` | **Required** | Kebab-case, unique within this theme (§10). |
| `name` | **Required** | Display name shown on the Representation card and in "Change Representation." Studio never hardcodes this string. |
| `description` | Optional | One line shown on the Representation card. |
| `thumbnail` | Optional | A single emoji glyph (lightweight placeholder — no asset pipeline required), or a relative path / data URI to a real preview image. Studio treats anything matching an image extension or a `data:`/`http(s):` prefix as an image; anything else renders as text. |
| `supportedCreationTypes` | Optional | Which of Studio's Creation Type ids (`js/creationFlow.js`'s hardcoded `CREATION_TYPES` — Creation Types themselves are not yet theme-authorable, see §14) this Representation applies under. Absent or empty means "every Creation Type this theme itself supports" (`manifest`/theme-level `supportedCreationTypes`, below). |
| `layout` | **Required** | The id of one of this theme's own `layouts/*.json` entries (§5). Written to `slide.metadata.layout` when this Representation is chosen — the same field the Layout picker control has always written. |
| `defaultFrame` | Optional | The id of one of this theme's own `frames/*.json` entries (§6). Authoring guidance for which Frame Variation a fresh page should suggest; not currently auto-applied to `slide.metadata.cardOverrides.artwork.frameVariation` (a child can always change it immediately via the Frame Variation control). |
| `defaultLayerPack` | Reserved | Same reservation as `theme.json`'s own `defaultLayerPack` (§4) — this runtime compiles one flat Layer Pack per theme, not several selectable ones. Not read today. |
| `background` | Reserved | Placeholder for a future default Slide-level background override. Not read today — Museum Gallery's wall colour already comes from the chosen Frame Variation's `wallTone` (§6), not this field. |
| `actions` | Optional | Which editing-action ids the Context Panel's "Nothing Selected" default view surfaces for a page created from this Representation. Today Studio recognizes exactly two: `"editCaption"` (Title/Artist/Age/Date fields) and `"editQuote"` (Quote/Attribution fields) — see `js/contextPanel.js`'s `_appendCaptionOrQuote`. Replace/Crop/Rotate/Fit/Fill/Original are universal (always shown when an Artwork Holder exists) and not gated by this list. An unrecognized action id is inert, not an error — Studio only ever renders the ids it already knows. |

**Theme-level Creation Type compatibility.** Separately from any one
Representation's `supportedCreationTypes`, the *theme itself* declares
which Creation Types it's offered under in Step 2 ("Pick a look for
your…") via a flat `supportedCreationTypes` array directly on the
compiled `theme` object (sibling to `layouts`/`frameVariations` — not
inside `theme.json`'s own reserved fields, and not part of this folder):

```json
"supportedCreationTypes": ["artwork"]
```

A theme with no `supportedCreationTypes` at all never appears under any
Creation Type — Studio does not guess. This field is currently only
authored directly on the in-code Official Theme entries in
`js/themeRegistry.js` (see §14); the Theme Project author-time home for it
(likely a `manifest.json`/`theme.json` field) is not yet finalized — do
not invent one ahead of that decision.

**Responsibilities.** A Representation composes — it never invents. It
points at one existing Layout and (optionally) one existing Frame
Variation; it never defines new geometry, colour, or Layer content of its
own. If a Representation needs a page style no existing Layout/Frame
combination provides, author the missing Layout or Frame first (§5, §6),
then reference it here.

---

## 9. Asset Specification (`assets/`)

```
assets/
├── frames/
├── textures/
├── decorations/
├── stickers/
└── icons/
```

| Subfolder | Holds |
|---|---|
| `frames/` | Frame-ornament source images (if a Frame Variation needs a raster asset instead of a drawn design). |
| `textures/` | Paper/wall texture source images. |
| `decorations/` | Decoration Layer source images. |
| `stickers/` | Sticker Layer source images. |
| `icons/` | Small UI/Theme-Library icon images distinct from `thumbnail.png`/`preview.png`. |

**Naming.** Every file is kebab-case, descriptive, and extension-
appropriate (`.png`, `.jpg`, `.svg`, `.webp`). No spaces, no uppercase, no
version numbers baked into the filename (`linen-texture.png`, not
`Linen_Texture_v2.png`).

**References.** A `layouts/`, `frames/`, or `layer-packs/` JSON file
references an asset by its path **relative to `assets/`** — e.g.
`"assets/textures/linen.png"` is referenced as `"textures/linen.png"`.
The compiler resolves every file under `assets/` into a flat
`{ relativePath: dataURI }` map on the compiled package (exactly the
shape `js/zipReader.js` + `js/themeEngine.js`'s
`_buildPackageFromZipFiles` already produce for a zipped package today);
nothing auto-substitutes a reference string into the field that uses
it — the code consuming that field is responsible for the map lookup.

**Supported formats.** PNG, JPEG, WebP, and SVG. Prefer PNG for anything
with transparency, SVG for anything that should stay crisp at any
canvas scale.

---

## 10. Naming Convention

Every id, folder name, JSON filename, and asset filename in a Theme
Project follows one rule:

```
^[a-z0-9-]+$        lowercase letters, digits, hyphens only
```

3–50 characters. No spaces, no underscores, no camelCase, no leading or
trailing hyphens. This is not a style preference — it is the exact
pattern Theme Builder's validator already enforces on every id
(`tools/world-builder/js/services/validator.js`'s `ids.pattern`).

Good:

```
museum-gallery
classic-frame
gallery-wall
museum-shadow
warm-ivory
gallery-spotlight
```

Bad:

```
Museum Gallery       (spaces, capitals)
classic_frame        (underscore)
GalleryWall          (camelCase)
museum-shadow-v2      (version baked into the id — bump manifest.version instead)
```

Filenames inside `layouts/`, `frames/`, `layer-packs/`, and
`representations/` should match the `id` they define wherever one file
holds exactly one entry (e.g. `frames/gold-accent.json`,
`representations/showcase.json`). A file holding an array of entries may
use a plural, descriptive name instead (e.g. `frames/all-variations.json`,
`representations/all-representations.json`) — both forms are valid; see
§12.

---

## 11. Relationships

The ownership hierarchy is a strict tree; the Layer System is
deliberately **not** part of it — an orthogonal system that decorates
any node in the tree without belonging to one.

```
Theme
 └── owns → Layout(s)
              └── references → Frame(s)      (supportedFrames is a hint, not an
                                               exclusive binding — any Frame remains
                                               selectable with any Layout)
              └── is composed of → Holder(s)  (always 1 in V1; see §5)

Frame
 └── contains → Holder

Holder
 └── contains → Element                      (the child's actual content — sacred,
                                               never modified, only presented)

Layer (independent — targets, does not own or get owned by, any of the above)
 └── targets → Slide | Frame | Holder | Element

Representation (independent — a Studio-facing label, not a containership node)
 └── references → one Layout                 (initializes slide.metadata.layout)
 └── references → one Frame (optional)        (defaultFrame — a suggestion, not enforced)
```

This must remain consistent with the frozen containership model
(`CLAUDE.md`'s Theme → Slide → Frame → Holder → Element canon). A Theme
Project never introduces a fifth scope, a parallel hierarchy, or a Layer
that targets more than one scope at once. A Representation is not a fifth
scope either — it is Studio's own picker concept (Creation Flow Step 3 /
"Change Representation"), composed entirely from references to Layouts
and Frames that already exist; it owns no geometry, colour, or content of
its own.

---

## 12. Validation Rules

A Theme Project is **valid** only if every rule below passes. These are
the rules a validator (today's `tools/world-builder/js/services/validator.js`, or
its successor) must enforce before a build is allowed to proceed.

**Structure**
- Required top-level files exist: `manifest.json`, `metadata.json`,
  `theme.json`.
- Required folders exist and contain at least one `.json` file:
  `layouts/`, `frames/`, `layer-packs/` (a Layer Pack folder may
  compile to an empty array, but the folder itself must exist).
- `representations/` is optional — a theme with none of its own simply
  compiles without a `theme.representations` array (§8), exactly like a
  theme authored before this section of the spec existed.
- `preview.png` / `thumbnail.png` / `README.md` missing → warning, not
  an error.

**JSON validity**
- Every `.json` file in the project parses as valid JSON. A parse
  failure in any single file fails the whole build — a Theme Project
  either compiles cleanly or not at all, never partially.

**Manifest / metadata / theme.json required fields**
- `manifest.json`: `id`, `name`, `version`, `builderVersion`,
  `minStudioVersion`, `author`, `description`, `category`, `tags`,
  `thumbnail`, `createdDate`, `updatedDate` all present — the exact set
  `js/themeRegistry.js`'s `REQUIRED_MANIFEST_FIELDS` checks, plus
  `builderVersion` (a Theme-Builder-only authoring gate, not a runtime
  field).
- `metadata.json`: `displayName`, `description`, `category` all present.
- `theme.json`: `id`, `name` present, and both **equal** the manifest's
  `id`/`name` (a mismatch is an error, not a warning — it means the
  project is internally inconsistent about its own identity). A Story
  Theme (`manifest.type` absent or `"story"`) additionally requires
  `frame`, `panel`, `storyText`, `footerText`, `watermark` — an Artwork
  Theme (`manifest.type: "artwork"`) requires nothing beyond `id`/`name`.

**ID rules**
- Every id (`manifest.id`, `theme.id`, every Layout/Frame/Layer/
  Representation id) matches the naming convention (§10).
- **Duplicate IDs are an error**, checked at four scopes independently:
  no two Layouts share an id, no two Frame Variations share an id, no
  two Layers across the *entire compiled* Layer Pack share an id (even
  if they came from different files under `layer-packs/`), and no two
  Representations across the entire compiled `representations/` folder
  share an id.

**Version rules**
- `manifest.version` and `manifest.builderVersion` are valid semantic
  versions.
- `manifest.minStudioVersion` is compatible with the importing
  VihuStudio build (`ThemeRegistry.isCompatible`).

**Reference rules**
- Every `supportedFrames` entry in a Layout names a Frame id that
  actually exists in this project.
- Every asset path referenced from a `layouts/`, `frames/`,
  `layer-packs/`, or `representations/` JSON file resolves to a real
  file under `assets/`.
- Every Layer's `target` is one of the four allowed values; every
  Layer's `type` is one of the three allowed values.
- Every Representation's `layout` names a Layout id that actually
  exists in this project; every Representation's `defaultFrame`, if set,
  names a Frame id that actually exists in this project.

**Missing assets**
- `metadata.previewImage` / `manifest.thumbnail`, if set, name a file
  that exists in the project (either at the project root or under
  `assets/`).

See §14 for which of these today's Theme Builder validator already
implements versus which are newly specified here for a future
validator pass to close.

---

## 13. Reserved Future Sections

The following are named and reserved so a future sprint can add them
without a breaking migration — **none of them are implemented today**,
and no Theme Project should rely on them doing anything yet.

| Reserved area | Where it will live | Notes |
|---|---|---|
| **Typography Tokens** | A new `theme.json.defaultTypography` shape, or a future `typography.json` file | Named font/size/weight tokens a theme can define once and every Text Layer can reference by name, instead of repeating raw font strings. |
| **Colour Palettes** | A new `theme.json.defaultPalette` shape, or a future `palette.json` file | Named colour tokens (`"ink"`, `"accent"`, `"wall"`) Frame/Layer fields could reference instead of raw hex values. |
| **Animation Packs** | A future `animation-packs/` folder, mirroring `layer-packs/` | Motion for Layers (entrance/exit/emphasis). VihuStudio's renderer is presently static-canvas-only; this has no home until that changes. |
| **Accessibility** | A future `accessibility.json`, or fields on `metadata.json` | Alt text for stickers/decorations, contrast requirements, reduced-motion opt-outs. |
| **Localization** | A future `locales/` folder | Per-language `displayName`/`description`/Layer `text.content` overrides. |
| **Responsive Layouts** | An extension to `layouts/*.json`'s schema | Layout variants for non-1080×1350 export targets (the canonical canvas size is otherwise fixed). |
| **Creation Type authoring** | A future `manifest.json`/`theme.json` field, or a project-level `creation-types.json` | Studio's own `js/creationFlow.js` `CREATION_TYPES` list (Story / Artwork Showcase / Quote Design / Poems) is still hardcoded (TB-4.7 — Theme Driven Representations only made theme↔type *compatibility* data-driven, via `theme.supportedCreationTypes`; the Creation Type catalog itself is not yet theme-authorable). |

A Theme Project author should not invent their own version of any of
these ahead of time — wait for the sprint that defines the real shape,
so every Official Theme adopts the same one.

---

## 14. Known Reconciliation Items — Resolved (TB-4.6)

TB-4.5 (this spec's own sprint) found three gaps between Theme Builder and
the live VihuStudio runtime and deliberately left them unfixed —
documentation only. **TB-4.6 (Theme Builder Runtime Alignment) closed all
three.** Recorded here for history, not as an open punch list:

1. **Manifest field name mismatch — resolved.** `minStudioVersion` is now
   the one name used everywhere: this spec, `js/themeRegistry.js`'s
   `REQUIRED_MANIFEST_FIELDS`, and `tools/world-builder/js/services/validator.js`.
   No alias, no fallback lookup.

2. **Compiled package shape — resolved.** `tools/world-builder/js/
   services/builder.js`'s `generateVThemePackage()` now emits the canonical flat
   { manifest, theme, assets }` shape directly — `theme.layouts`/
   `frameVariations`/`layerPack` are real flattened arrays (not `{file,
   data}` pairs), `assets` is a real `{relativePath: dataURI}` map. Asset
   Repository Transition (Sprint 2) — `preview.png`/`thumbnail.png`'s
   real bytes join that same `assets` map (keyed by their own filename)
   rather than being embedded directly onto `manifest.previewImage`/
   `manifest.thumbnail`; those two fields stay the plain relative-path
   reference they always were, resolved via `ThemeRegistry.
   resolveAssetRef()` wherever they're read as an image `src`. See
   `docs/VTHEME_PACKAGE_SPEC.md` for the full compiled-package contract.

3. **Duplicate-ID and reference validation — resolved.** `tools/theme-
   builder/js/validator.js`'s `validateReferences()` now performs real
   checks: duplicate ids within Layouts / Frame Variations / the entire
   compiled Layer Pack (three independent scopes, per §12), broken
   `supportedFrames` references, invalid Layer `type`/`target` values, and
   missing asset-path references. A project with any of these fails
   validation and cannot be built.

A compiled `.vtheme` produced by today's Theme Builder now imports into
VihuStudio without manual editing, compatibility shims, or a conversion
step — the Freeze Criteria a future "Museum Gallery Official Theme 001"
sprint depends on.

---

### TB-4.7 — Theme Driven Representations

Added §8 (Representation Specification) and the `representations/` folder
throughout this spec. This is new schema, not a reconciliation of a
previously-flagged gap — recorded here to keep one running history rather
than starting a second document. Studio's Creation Flow / Context Panel
(`js/creationFlow.js`, `js/contextPanel.js`) no longer hardcode any
theme's Representations; Museum Gallery's own Showcase/Portrait/Quote now
live entirely on `js/themeRegistry.js`'s theme object (`representations`
array) and, for an imported package, in the compiled `theme.representations`
this section defines. Museum Gallery is deliberately still the *only*
theme with real Representations authored this sprint — the reference
implementation, not a special case Studio depends on by name.

---

### Sprint 10.2 — Official Theme 001: Museum Gallery

Museum Gallery moved out of `js/themeRegistry.js`'s `OFFICIAL_ARTWORK_THEMES`
array entirely and now exists only as a Theme Project —
`official-worlds/MuseumGallery/`, the first complete, real-world example of
every section of this spec (3 Layouts, 7 Frame Variations, 1 Layer Pack,
3 Representations). It reaches Studio exactly the way any imported theme
does: Theme Builder compiles it to `themes/MuseumGallery.vtheme`, and a
child (or, today, a developer) imports that file through the ordinary
Import Theme flow — `source: 'imported'`, not `'official'`. Studio's
Creation Flow and Context Panel needed no changes to keep working, because
Sprint 10.1 already made both fully data-driven; this sprint is proof of
that, not a new mechanism. `official-worlds/MuseumGallery/README.md`
documents why the folder trims to exactly 3 Layouts (Wide/Square/Full
Bleed, present in the pre-10.2 in-code version, were never reachable
through the Context Panel and so were not re-authored) and why it has no
`assets/` folder (nothing this theme renders is a raster image — every
Frame field is an enum resolved to a drawn canvas routine).

---

### Builder Convergence Sprint — Scene Convergence

Before this sprint, World Builder produced **two independent, parallel
compiled artifacts**: Engine V1's `{manifest, theme, assets}` (§4 of this
spec — the only shape Publish/the Repository/Studio ever understood) and
Engine V2's `{format:'engine-v2-world-package', scenes, frames, ...}`
(Scene/Place/Experience authoring's own compiled package, `project.
lastSceneBuild`, exportable but never publishable — see the historical
"Engine V2 — Build and Publish" entry in `CLAUDE.md`). A Theme Author's
Scene content — a background, a Decoration, a Text Experience — could be
authored and previewed in the Builder, but never reached a Published
Theme, never reached the Repository, and Studio never rendered it. This
sprint closes that gap by converging Scene content into the one existing
Published Theme representation instead of maintaining a second one.

**The rule**: `tools/world-builder/js/services/builder.js`'s
`packageTheme()` now walks every `scenes/*.json` file (via
`convergeScenes()`/`convergeScene()`/`convergeSceneLayer()`) after its
four pre-existing `collectFolder()` calls, and *appends* to the exact
same `layouts`/`representations`/`layerPack`/`assets` arrays/maps those
calls already populate — a project with no `scenes/` folder (every theme
authored before Scenes existed) appends nothing, so the compiled package
is byte-identical to before this sprint.

**One Scene converges into:**

- **One Layout** (§5), `id: "scene-<sceneId>"`, `aspect` taken directly
  from `scene.canvas.aspectRatio` — the Engine V2 Aspect Ratio vocabulary
  (`portrait`/`landscape`/`square`/`wide`/`full-bleed`/`quote`) is
  already identical to this spec's own `LAYOUT_ASPECTS`, so no
  translation is needed.
- **One Representation** (§8), same id, `layout` pointing at that same
  Layout id, `defaultFrame` taken from the Scene's first Place's `frame`
  reference (a Frame id already compiled by the existing `frames`
  `collectFolder()` call — Place and Frame already share the same id
  space, so no translation is needed there either). Only the *first*
  Place converges onto `defaultFrame` — Engine V1 has exactly one Holder
  per page (§5's "holders: Reserved, always 1 in V1"), a pre-existing,
  disclosed ceiling this sprint does not lift.
- **One Layer Pack entry per Scene Layer** (§7), in Scene Stack order (so
  z-ordering survives), each carrying `scope: "scene-<sceneId>"` so it
  never renders on any other page. A full-bleed fill Layer (a Scene
  Background) converges onto `target: "slide"` (wall-level, behind the
  Frame — correct). Every other Layer (an image Decoration, a partial-
  rect colour patch, Text) converges onto the new `target: "overlay"`
  (foreground content, unconditionally on top — see §7's own `overlay`
  documentation above). A Scene Layer's `.image` field is always a raw
  data URI (Builder upload fields never write a project-relative path
  for Scene content) — `builder.js`'s `externalizeSceneImage()`
  externalizes it into the same `assets` map every other asset already
  uses, under `scenes/<sceneId>/<layerId>.png`, leaving the Layer Pack
  entry holding a plain relative-path reference resolved the same way
  every other asset reference resolves (`ThemeRegistry.resolveAssetRef()`).

**Publish/Export/Repository/Studio needed zero Scene-specific code.**
Publish already reads whatever `packageTheme()`/`buildManifest()`/
`buildTheme()` produced (`project.lastBuild`) and uploads its `assets`
map wholesale (`js/themeRepositoryClient.js`'s `publish()`); Export
already serializes the same compiled package to a `.vtheme` file; Studio
already resolves `theme.layouts`/`theme.representations`/`theme.layerPack`
generically. None of the three needed to learn what a "Scene" is —
convergence happens once, entirely inside `builder.js`.

**`project.lastSceneBuild` is retired** as a concept — World Builder's
Build screen shows exactly one Build action ("🎁 Build Theme") and
Publish shows exactly one Theme's worth of Publish/Export options;
"Scenes" is now shown only as an informational stat (how many Scenes
this Theme has), never a second buildable/publishable artifact. Engine
V2 Scene *Validation* (`EngineV2Validator`, a Scene Model consistency
check, unrelated to compilation) is untouched — Validation still shows
its own separate "Scenes" report alongside the Theme's own Validation
report, since checking a Scene's internal consistency and converging its
content into a Published Theme are different concerns.

Verified end-to-end: a Scene authored with a full-bleed colour
background, an image Decoration, and a Text Layer converges correctly
into `theme.layouts`/`theme.representations`/`theme.layerPack`/`assets`;
the compiled package imports into the real Studio runtime with zero
console errors; rendering a real slide against the Scene-derived
Representation actually paints the background colour, the Decoration
image (pixel-sampled), and reserves space for the Text — all through the
unmodified `renderer/slideRenderer.js` render pipeline, plus one new,
additive `target: "overlay"` render pass and two new `decoration.kind`
values (`"fill"`/`"image"`); Museum Gallery (a theme with no Scenes)
still imports/renders/applies with zero behavior change; the golden-
theme fixture's full 30-assertion regression suite
(`tools/world-builder/verify/goldenBuild.js`) still passes unchanged.
