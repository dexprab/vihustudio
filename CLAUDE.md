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
- Theme Engine
- Theme Designer
- Card Designer (Picture · Frame · Sticker · Text — every object follows the same Object Designer interaction model)
- Page Designer (📖 Story / 📘 Cover / 🪝 Hook / 🏁 End roles; per-role content editors; per-element checklist with Visibility / Lock / Reset)
- Sticker Studio (15 categories, search, favorites + recents, 241 stickers; insertions land in the Card Designer's Sticker section)
- Picture Studio (temporary preparation modal — Crop / Rotate / Flip / Auto Enhance / Fit-Fill / Reset / Before-After; bake-on-Apply through the canonical SlideRenderer path)
- Publish Studio (four-stage flow — 📖 Read My Story → ✨ Almost Ready → 📕 Publishing → 🎉 Celebration; hand-rolled `js/pdfWriter.js` emits a valid PDF 1.4 per book; WYSIWYE preserved from editor canvas to printed PDF)
- Universal Object Consistency (Frame · Sticker · Decoration · Text-Holder · Background all share Select / Move / Resize / Rotate / Layer / Lock / Delete primitives via the `slide.metadata.elementOverrides` bag)

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
