# Museum Gallery — Official Theme 001

Sprint 10.2 — the first Official Theme authored entirely as a Theme
Project against `docs/THEME_PROJECT_SPEC.md`, with zero Museum-Gallery
knowledge left anywhere in Studio's own code. Load this folder into
Theme Builder (`tools/theme-builder/index.html`), Validate, then Build to
produce `MuseumGallery.vtheme`.

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
already here.

## Continuity

Every field value in this project is transcribed unchanged from the
in-code entry that previously lived in `js/themeRegistry.js`'s
`OFFICIAL_ARTWORK_THEMES` array (now removed — see Sprint 10.2's
success metric: delete this project and the compiled package, restart
Studio, Museum Gallery disappears; re-import `MuseumGallery.vtheme`, it
returns exactly as before). `preview.png`/`thumbnail.png` are the same
images already shipped in `themes/MuseumGallery.vtheme` since Sprint 9.6.
