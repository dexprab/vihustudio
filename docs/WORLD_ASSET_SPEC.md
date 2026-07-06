# World Asset Spec

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Defines the full asset contract the World Builder's Assets
Workspace state generates its entire interface from
(`tools/world-builder/js/assetSpec.js`) — every category, every slot,
and every field a slot definition must carry. This document is the
prose mirror of that module, the same relationship
`docs/THEME_PROJECT_SPEC.md` already has with
`tools/world-builder/js/services/constants.js`. It does not redefine
the packaging convention `docs/WORLD_ASSET_CONTRACT.md` already
reserves — it defines the *authoring* contract the Builder's Assets
screen is generated from, one layer up from where a slot's file
ultimately lands.

---

## Why this exists

Sprint B2.0's ticket was explicit: "The Assets screen MUST NOT be a
generic upload page. The Builder reads WORLD_ASSET_SPEC.md and
dynamically builds the Asset interface." A generic "drag files here"
uploader can't tell a creator what's required, what it's for, or how
complete their World is — so instead, every asset slot the Assets state
can ever show is declared once, here and in `assetSpec.js`, and the
screen is generated entirely from that declaration. Adding a new asset
slot in a future sprint means editing `assetSpec.js`, never editing the
Assets screen's markup.

---

## Every Asset Definition

Every slot in `assetSpec.js` — whether one of the fixed slots below or
one dynamically generated per the creator's own authored Frames — must
carry all of these fields:

| Field | Meaning |
|---|---|
| `id` | Stable identifier for this slot within its category. |
| `displayName` | What the creator sees on the Assets screen. |
| `category` | Which of the seven categories below this slot belongs to. |
| `purpose` | One sentence: why this asset exists. |
| `required` | `true`/`false` — whether a World Project can validate/Build without it. Only Identity's two slots are `true` today. |
| `formats` | Which file extensions this slot accepts. |
| `recommendedDimensions` | Suggested pixel dimensions, shown as a hint (never enforced — a creator's own image is never rejected for being the "wrong" size). |
| `recommendedResolution` | Suggested DPI/resolution, same non-enforcing hint. |
| `aspectRatio` | Suggested aspect ratio as a hint (e.g. `1:1`, `16:9`) — same non-enforcing status as `recommendedDimensions`. |
| `maxFileSizeMB` | Suggested maximum upload size in megabytes, shown as a hint — not enforced by `validator.js`. |
| `usedBy` | Which manifest/theme/representation field or rendering role this asset feeds. |
| `previewType` | `square` \| `landscape` \| `none` — how the Assets screen previews it. |
| `validationRules` | Human-readable authoring guidance (e.g. "Should tile seamlessly") — advisory, not enforced by `validator.js`. |

`path` (not itself part of the creator-facing contract, but present on
every resolved slot) is where the asset lands in the World Project's
own file map once uploaded — `thumbnail.png` / `preview.png` at the
Project root for Identity (matching the shipped, working
`docs/THEME_PROJECT_SPEC.md` §2–3 convention `manifest.thumbnail` /
`metadata.previewImage` already resolve), or `assets/<category>/<slot>.<ext>`
for every other category (matching `docs/VTHEME_PACKAGE_SPEC.md`'s
`assets/{relativePath: dataURI}` compiled shape).

---

## Categories

### Identity — required

The two images every World must have. `thumbnail` feeds
`manifest.thumbnail` (the card shown in every World-picker list);
`hero` feeds `metadata.previewImage` (a larger identity image, reserved
for a future World detail view per `docs/WORLD_ASSET_CONTRACT.md`).
Both are required — a World Project cannot pass Validation without
them.

### Frames — dynamic, optional

One optional preview-image slot per Frame Variation the creator has
actually authored in the Frames Workspace state — this category is not
a fixed list; it's generated fresh from `ProjectModel.frames(project)`
every time the Assets screen renders. A World whose Frames are drawn
programmatically (enum fields resolved to canvas routines — Museum
Gallery's own frames, matching Sprint 9.7's "every Frame field is an
enum resolved to a drawn canvas routine, not a raster image") needs
none of these filled to be valid.

### Textures, Decorations, Icons, Fonts, Backgrounds — optional

A small, fixed set of generic slots per category (2 Textures, 2
Decorations, 1 Icon, 1 Font, 1 Background as of Sprint B2.0) for
Layouts/Frames/Layer Packs that want to reference a raster asset
instead of a drawn/enum one. None are required — a valid World can ship
with any or all of these empty; the Assets screen's own progress bar
(`AssetSpec.stats`) reports completion honestly rather than blocking
Build on them.

---

## Completion tracking

`AssetSpec.stats(project)` reduces every resolved category to `{total,
filled, requiredMissing}` — `filled` counts any slot whose `path`
resolves to a real file in the Project; `requiredMissing` lists only
the Identity slots still empty (the only ones that can ever be
missing-and-blocking). The Assets screen's own progress bar and
Validation's "Assets" category read directly from this, so a creator
is never guessing what's left — see `docs/WORLD_PROJECT_CONTRACT.md`
for how this feeds the Validation state.

---

## Change History

- v1.0 — Initial canonical document, written for Sprint B2.0 (First
  Official World Platform Validation). Documents the full per-slot
  asset schema and the seven categories `tools/world-builder/js/assetSpec.js`
  generates the Assets Workspace state from.
- v1.1 — Sprint B2.0.1 (Builder Stabilization). Adds `aspectRatio` and
  `maxFileSizeMB` to every slot's contract so the Assets screen can show
  Purpose/Recommended Dimensions/Aspect Ratio/Formats/Maximum File Size
  without a second, duplicated source of truth — `assetSpec.js` remains
  the single place these values are declared.
