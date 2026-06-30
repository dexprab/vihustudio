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

### Frozen

- Workspace
- Project Management
- Persistence
- Page Management
- Theme Engine
- Theme Designer
- Card Designer Foundation

### In Progress

- Card Designer · Image module (Sprint 4.2 shipped scale, fit/fill, pan, reset; Sprint 4.5 added composition / light / color / detail / effects fine tuning)
- Card Designer · Text module (Sprint 4.3 shipped canvas-first selection + font size / color / alignment overrides + reset; Sprint 4.4 added position drag + arrow nudge + full typography)
- Page Designer Foundation (Sprint 6.0 introduces the page role selector — 📖 Story / 📘 Cover / 🪝 Hook / 🏁 End — with role-specific content editors)
- Sticker Studio (Sprint 6.6 ships the Sticker Studio tab — 15 categories, search, favorites + recents, and per-slide sticker objects persisted at `slide.metadata.stickers`; stickers reuse the existing object selection, resize handles, and Object Designer chrome)

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
