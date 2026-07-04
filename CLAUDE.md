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
