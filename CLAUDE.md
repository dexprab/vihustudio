# CLAUDE.md

Canonical project context for VihuStudio. Read this first before making any change.

## Product Vision

- Preserve what is real.
- Beautify originals rather than replacing them.
- VihuStudio is a non-destructive visual storytelling studio.

## Core Principles

- Visual controls for visual properties.
- Text controls for textual properties.
- Reusable components over one-off implementations.
- Editor UI should only contain controls that improve the active workflow.
- Metadata should not occupy permanent workspace.
- Architecture changes require explicit approval.
- Repository is the source of truth.

## Current Status

### Frozen (Version 1.0)

- Workspace
- Project Management
- Persistence
- Page Management (Sprint 8.2 drag-and-drop reorder + trimmed context menu)
- Theme Engine (Sprint 9.2 — sits atop `ThemeRegistry`, not a hardcoded array; every public method keeps its pre-9.2 signature; Sprint 9.3 adds `getActiveArtworkTheme(Id)` / `applyArtworkTheme` alongside, same signature-preservation discipline)
- Theme Registry / Theme Library (Sprint 9.2 — Theme Library Foundation: `js/themeRegistry.js` merges Official + Imported themes into one catalog behind `get(id) / list() / getCatalog()`; `.vtheme` package format — plain JSON, `{manifest, theme, assets}` — validated on import with friendly failures, never crashes; duplicate-id imports prompt Replace / Keep Both / Cancel; imported themes persist to `localStorage`, official themes ship with the app; architecture is additive-ready for Theme Creator / Theme Editor / Theme Export / Community Themes without another redesign — none of those ship in 9.2)
- Artwork Themes (Sprint 9.3 — second theme type on the same registry, `manifest.type: 'story'|'artwork'`, missing/invalid `type` normalizes to `'story'` so every pre-9.3 package keeps loading with zero migration; controls ONLY how a child's picture is presented — background / frame / paper / caption / shadow / lighting / composition — NEVER touches artwork pixels; layered into the existing Sprint 6.5/6.5.1 Picture Border system as one more `_resolveBorder` fallback layer, not a parallel rendering engine; opt-in, no default, a "None" tile clears it; five Official Artwork Themes — Museum Gallery · Sketchbook · Watercolor Portfolio · Classroom Display · Scrapbook; Theme Library shows Story Themes / Artwork Themes as two sections in the same modal)
- Dynamic Theme Workspace (Sprint 9.4 — an optional `theme.editor` block, resolved by the new `js/workspaceBuilder.js`, decides which presentational controls the right-side designer shows, in what order, per theme; editor-only — never touches rendering. Single active-workspace-theme rule, no merging: an active Artwork Theme's `editor` governs Slide/Frame/Holder if present, otherwise the Story Theme's does. Slide = Page Designer's Story tab (Decorations, theme-gated; Background/Title stay core, always shown); Frame = Card Designer's Frame Look + Frame Style groups inside the Picture section (`frameStyle`/`fill`/`border`/`radius`/`shadow`, plus new `paper`/`mat`); Holder = Card Designer's Picture/Text/Sticker sections' presentation controls (`presentation`/`artworkFrame`/`lighting`/`caption` for Image, `typography`/`alignment` for Text, `stickerShadow` for Sticker — all additive to the always-present manipulation controls). Five official themes ship an `editor` block (Storybook Classic, Comic, Museum Gallery, Sketchbook, Watercolor Portfolio); Adventure/Minimal/Classroom Display/Scrapbook have none and fall back to today's fixed control set unchanged — the real backward-compatibility proof)
- Theme Language v2 (Sprint 9.5 — new `js/themePresets.js` registry adds a Presentation Preset layer that resolves Presentation Preset → Theme Overrides → System Defaults, so a theme can name creative intent (`presentation:'gallery'`) instead of spelling out every low-level field; does not redesign Theme Registry / Theme Engine / Workspace Builder. A Story Theme opts in with an optional `slide` block (page-furniture defaults — panelStyle/footerStyle/pageNumber/bookTitle*/handle*/decorations, read by `ThemeEngine._defaultOptionsFor`) and/or an optional `holder` block (Picture Holder look defaults — cornerRadius/padding/shadow/fill, the sprint's "Frame" scope; named `holder` to match the existing `themeOptions.holder` schema and avoid colliding with the pre-existing `theme.frame` field, which is the book's outer frame COLOR, an unrelated concept). An Artwork Theme's existing `presentation` field (Sprint 9.3) now resolves through `HOLDER_PRESETS.image` in `renderer/slideRenderer.js`'s `_artworkBorder`. `js/workspaceBuilder.js`'s Presentation control sources its options from `ThemePresets.listHolderPresets` instead of a hardcoded list, and a theme with a `presentation` but no `editor` block gets a non-empty control list from that preset's `editorControls` metadata. Storybook Classic's `slide`/`holder` presets reproduce its pre-9.5 hardcoded values exactly (byte-identical render verified) so the app's default theme has zero regression; Museum Gallery / Sketchbook / Watercolor Portfolio are refactored to the shorthand form, Comic gets richer `slide`/`holder` presets, Classroom Display / Scrapbook are untouched — all backward compatible, no migration required)
- Museum Gallery Theme Support (Sprint 9.6 — Phase 2, Official Theme Collection kickoff. Museum Gallery is the reference implementation; the engine only grew where this one theme needed it, nothing speculative. New capabilities, all additive: (1) **Folder-based `.vtheme` packages** — `js/zipReader.js` (dependency-free ZIP reader, `DecompressionStream('deflate-raw')`) lets `ThemeEngine.importThemeFile` accept a real zipped package (manifest+theme `.vtheme`, `metadata.json`, `preview.png`/`thumbnail.png`, `layouts/` `frames/` `layer-packs/` `assets/`) alongside the untouched legacy flat-JSON path; `themes/MuseumGallery.vtheme` ships as a real importable package proving zero app-code changes are needed after import. (2) **Slide layout presets** — `theme.layouts` (Portrait/Landscape/Square/Wide/Quote/Full Bleed) resolves the Frame rect via `renderer/slideRenderer.js`'s `_resolveLayout`/`_panelRectFor`, replacing the hardcoded PANEL_X/Y/W/H; `portrait` is byte-identical to the old fixed rect so every theme without `layouts` (everything but Museum Gallery) is unaffected. `holders:1` on every preset reserves — but doesn't yet build — multi-Holder layouts (Diptych/Triptych are a deliberate future sprint, not bolted on here). (3) **Frame Variations** — `theme.frameVariations` (named artwork-field bundles: Classic White Mat, Warm Ivory, Natural Linen, Floating Frame, Black Matte, Gold Accent, Dark Gallery), chosen per-card and resolved as one more override layer on the Sprint 9.5 preset ladder; this is also where Sprint 9.4's per-card Holder controls (Presentation/Frame/Lighting/Caption/Paper/Mat), written since 9.4 but never rendered, finally activate. (4) **Holder "Original" mode** — `ImageViewEngine`'s third mode alongside Fit/Fill (natural pixel size, zoom still applies on top); a universal core control (`_setMode` in `js/cardDesigner.js`), not theme-gated. (5) **The Layer System** — `js/layerEngine.js`, a small generic engine (layer = `{type:text|sticker|decoration, target:slide|frame|holder|element, anchor, zIndex, visible, ...}`) with zero canvas code of its own (SlideRenderer supplies the draw primitives); Museum Gallery's 5-layer pack (Museum Caption, Page Number, Handle, Gallery Spotlight, Wax Seal) is the only consumer this sprint — Page Number/Handle are declarative-only entries (no `text` payload) since they keep rendering via the pre-existing `_drawHandle`/`_drawPageNumber`, never duplicated. (6) **Rich theme metadata** — optional manifest fields (`purpose`/`mood`/`bestFor`/`notRecommendedFor`/`themeIcon`/`previewImage`), shown in the Theme Library picker card when present; `ThemeRegistry.registerOfficial` copies them from an official theme's own object onto its auto-derived manifest. (7) **Global packs** — Social + Shape sticker categories added to `js/stickerLibrary.js`'s existing extensible catalog (no architecture change), and `js/emojiPicker.js` wires an insert-emoji control onto every Text Element content field via `js/pageDesigner.js`'s shared `_makeTextInput`. Every change verified byte-identical-render-safe for themes that don't opt in)
- Museum Gallery Fidelity (Sprint 9.7 — matched Museum Gallery against the approved Design Board; visual fidelity, not new functionality, extending the theme language only where the board demanded it. (1) **Frame Variations carry real values** — `matWidth`/`frameThickness`/`borderColor`/`wallTone` on each variation (not just enum lookups); `frameThickness>0` finally enables the artwork border stroke (`lineEnabled` was hardcoded off for every artwork theme through 9.6); `wallTone` is the gallery-room paint colour, a Slide-level concept distinct from the mat, resolved independently of the image-gated Picture Border pipeline (`_resolveWallTone`) so it applies even on image-less pages (Quote). Base "Classic White" values live on `js/themePresets.js`'s `gallery` preset so the variation itself can stay an empty override. (2) **Layouts are compositions, not just rects** — a layout preset's `composition` (`'below'` default, `'right'` for Wide, `'quote'` for Quote) decides where the Museum Caption sits and whether the Frame/Holder pipeline runs at all; Quote drops the Frame entirely for a centered, word-wrapped quote + attribution (`_drawQuoteText`), Wide moves the caption beside the Frame (`_captionRectFor`) instead of below it. (3) **Museum Caption composes real fields** — `slide.metadata.artworkTitle/artist/age/date`, rendered as a two-line museum label (`_drawMuseumCaption`) via the Layer Engine's `museumCaption` text source; edited through a new `museumCaption` Workspace control (Title/Artist/Age/Date, each with emoji insertion). (4) **Handle/Page Number position + colour are theme-drivable** — a Layer Pack entry's optional `position` field pins Handle/Page Number to a corner regardless of the Story Theme's own default (Museum Gallery: page number bottom-left, handle bottom-right, matching the board); a wall-tone luminance check (`_chromeTextColor`) keeps that text legible against both light and dark gallery walls without hardcoding one mood. Every change verified against a live render comparison with the board and byte-identical for themes that don't opt in)
- Theme Designer (Sprint 8.4.2 — Book Style · Branding · Typography · Colours · Picture Holder Defaults · Page Layout · Decorations · Navigation; sub-options ride on `themeOptions` and reach the renderer via `ThemeEngine.resolveTheme()`)
- Card Designer (Sprint 8.4.3 — explicit Theme → Card inheritance: header note + per-section "Theme / This Page" badge; Picture Holder · Picture · Sticker · Text · Decoration sections — every object follows the same Object Designer interaction model)
- Page Designer (📖 Story / 📘 Cover / 🪝 Hook / 🏁 End roles; per-role content editors; per-element checklist with Visibility / Lock / Reset)
- Sticker Studio (15 categories, search, favorites + recents, 241 stickers; insertions land in the Card Designer's Sticker section)
- Picture Studio (temporary preparation modal — Crop / Rotate / Flip / Auto Enhance / Fit-Fill / Reset / Before-After; bake-on-Apply through the canonical SlideRenderer path)
- Publish Studio (Sprint 9.0 — five-stage flow: 📖 Read My Story → ✨ Almost Ready → 🎯 Choose Story Destination → 📕 Publishing → 🎉 Celebration; destination-driven — Story Book (Digital / Print-ready PDF via `js/pdfWriter.js`), Story Carousel (Instagram Portrait / Square PNGs; ZIP for multi-page via `js/zipWriter.js`), Story Reel (Coming Soon, plug-in-ready via `StoryDestinations.register()`); WYSIWYE holds byte-identically between the editor canvas and Carousel Portrait PNG)
- WYSIWYE Rendering (Sprint 9.0.2 + 9.1.2 — `SlideRenderer.init(canvas, opts)` accepts `{dpr}`, defaults to `window.devicePixelRatio`; `#previewCanvas` is CSS-fluid so the display fills the preview column up to native 1080 CSS px; the editor and the published Carousel Portrait PNG are byte-identical for the same slide — `SHA-256=86e6910993d29932`; `SlideRenderer.buildPayload` stamps the *resolved* theme so Theme Designer overrides reach every render surface; hit-testing reads canonical size via `SlideRenderer.getCanvasSize()`)
- Story Destinations Registry (Sprint 9.0.4 — `StoryDestinations.list / find / findFormat / register / validate` — future destinations plug in from outside `storyDestinations.js` without editing PublishStudio; documented interface contract in the module header)
- Theme Designer Global Behaviour (Sprint 9.1.3 — Theme changes propagate to every page + every thumbnail + publish output immediately; NO object selection required; `_invalidateThumbnails` clears every slide's cache, `buildPayload` uses `resolveTheme()` so Typography / Colours overrides reach the renderer through the payload)
- Publishing Language (Sprint 9.1.4 — Export terminology is removed from the editor UI entirely; `📖 Publish` is the only publishing CTA; page context menu carries the six child-friendly actions: Publish This Page · Duplicate Page · Move Page Up · Move Page Down · Add Blank Page After · Delete Page; `PublishStudio.open({slides:[oneSlide]})` accepts a single-page slice for the Publish This Page flow)
- Universal Object Consistency (Frame · Sticker · Decoration · Text-Holder · Background all share Select / Move / Resize / Rotate / Layer / Lock / Delete primitives via the `slide.metadata.elementOverrides` bag)
- Universal Object Selection (Sprint 8.4.1 — any object click switches to the Card Designer, expands the matching section, and smoothly scrolls it into view; one `SCENE_TYPE_TO_SECTION` mapping covers every selectable element type)
- Picture Holder Completion (Sprint 8.4.4 — Selection · Free Move · Free W/H Resize · Rotation · Layer · Lock · Delete on the holder; Border / Corner Radius / Shadow shared with the Picture section's Frame Look + Frame Style; the picture inside the holder remains independently editable — Zoom / Move / Replace / Fit / Fill)

## Locked Product Decisions

### 1. Workspace Simplification

- Hide Project Title, Author and editable Book Name from the editor.
- Preserve metadata in the project model.

### 2. Asset Pack System

- Decorations use installable packs.
- Local import first.
- Cloud repository later.
- Design for reusable pack architecture.

### 3. Card Designer

Reusable component supporting:

- Image scale
- Image position
- Fit modes
- Typography
- Card styling
- Theme defaults with per-card overrides

### 4. Audio Studio

- Per-card narration
- Record/import audio
- Audio linked to cards
- Foundation for narrated exports

### 5. Social-First Export

Priority:

1. Instagram Carousel
2. Instagram Reel

## Roadmap

1. Theme Designer Polish
2. Card Designer
3. Story Designer
4. Cover Designer
5. CTA Designer
6. Audio Studio
7. Asset Pack System
8. Export Studio
9. VihuPipe

## Development Rules

- Keep prompts minimal.
- Never refactor architecture without approval.
- Prefer extending reusable components.
- Preserve backward compatibility.
- Keep commits focused and atomic.
- Update CLAUDE.md whenever a major architectural or product decision is approved.
