# Museum Gallery — Official Theme 001

Sprint 10.2 — the first Official Theme authored entirely as a Theme
Project against `docs/THEME_PROJECT_SPEC.md`, with zero Museum-Gallery
knowledge left anywhere in Studio's own code.

Sprint B1.0 — the old Theme Builder dashboard (Load Project/Validate/
Build buttons) is retired; its compile engine survives as internal
Build services (`tools/world-builder/js/services/`) with no visual
Build UI yet (a future Builder Workspace sprint adds one). Until then,
recompiling this project into `MuseumGallery.vtheme` means driving
those services directly — see `tools/world-builder/verify/goldenBuild.js`
for the reference example (loads a Theme Project folder, calls
`projectLoader.loadProjectFromFiles()` → `validator.validate()` →
`builder.build()` against `tools/world-builder/services-harness.html`,
no dashboard required).

Sprint 11.2 — this folder moved from `theme-projects/MuseumGallery/` to
its permanent home at `official-worlds/MuseumGallery/` (the repository
convention for every Official World's source, per
`docs/THEME_PROJECT_SPEC.md` §0), and Museum Gallery became the
reference implementation for the Official World Platform: it follows
the exact same Theme Project → Validate → Compile → `.vtheme` → Import
lifecycle as any third-party World, with no privileged pipeline, no
hardcoding, and no synthetic fallback data anywhere in Studio. See
`docs/WORLD_ASSET_CONTRACT.md`'s Import Parity rule — the standing bar
every Official World, including this one, must clear.

## What's here

- **3 Layouts** (`layouts/`) — Landscape, Portrait, Quote. (Wide/Square/
  Full Bleed existed in an earlier in-code version of this theme but were
  never reachable through Studio's Context Panel — Studio only ever
  initializes a page from a Representation, and only three Representations
  exist — so they are not re-authored here. Add them back as their own
  Layouts, referenced by a new Representation, if a future sprint wants
  them reachable again.)
- **7 Frame Variations** (`frames/`) — Classic White, Warm Ivory, Natural
  Linen, Floating Frame, Dark Gallery, Black Matte, Gold Accent.
- **1 Layer Pack** (`layer-packs/museum-basic.json`) — Museum Caption,
  Page Number, Handle, Gallery Spotlight, Wax Seal (the same 5 Layers
  this theme has shipped with since Sprint 9.6/9.7, unchanged).
- **3 Representations** (`representations/`) — Showcase (Landscape),
  Portrait (Portrait), Quote (Quote) — exactly what Studio's Creation
  Flow Step 3 and Context Panel's "Change Representation" render.

## `theme.json`'s `supportedCreationTypes`

`["artwork", "artwork-collection"]`. Only `"artwork"` (Studio's "Artwork
Showcase" Creation Type) has a Step 1 card today — `"artwork-collection"`
is a forward-compatible reservation for a future "Artwork Collection"
Creation Type. An id with no matching Creation Type card is simply inert,
not an error — Studio's `CREATION_TYPES` list stays hardcoded and small
per Sprint 10.1's own scope; only theme↔type *compatibility* is data.

## Why no `assets/` folder

Nothing this theme renders is a raster asset — every Frame field
(`background`/`frame`/`paper`/`shadow`) is an enum resolved to a drawn
canvas routine, not a loaded image. `preview.png`/`thumbnail.png` at the
project root are the only images this theme actually needs, and they're
already here. An `assets/` folder is optional per
`docs/THEME_PROJECT_SPEC.md` §9 — required only when a theme actually
references raster files from its JSON, which this one doesn't.

Each Representation's `thumbnail` field (§8) is a single emoji glyph —
🖼️ / 🧍 / 💬 — which `docs/THEME_PROJECT_SPEC.md` §8 documents as a
fully valid, lightweight form of "preview artwork for every
representation," not a placeholder standing in for a missing image.

## Continuity

Every field value in this project is transcribed unchanged from the
in-code entry that previously lived in `js/themeRegistry.js`'s
`OFFICIAL_ARTWORK_THEMES` array (now removed — see Sprint 10.2's
success metric: delete this project and the compiled package, restart
Studio, Museum Gallery disappears; re-import `MuseumGallery.vtheme`, it
returns exactly as before). `preview.png`/`thumbnail.png` are the same
images already shipped in `themes/MuseumGallery.vtheme` since Sprint 9.6.
