# TASKS and Backlog for VihuStudio

This file lists the current backlog, technical debt, known issues, and a recommended next sprint. All items below are written from the current implementation — no assumptions beyond what is present in the codebase.

## Current backlog (observed from code state)

1. Add safe memory cleanup for uploaded images (revoke object URLs created via `URL.createObjectURL`).
2. Implement undo/redo for page operations.
3. Implement export page functionality (placeholder in context menu).
4. Implement set as cover functionality (placeholder in context menu).
5. Implement add before/after page operations (placeholders in context menu).
6. Implement move to end page operation (placeholder in context menu).
7. Implement actual autosave functionality and project persistence (localStorage or server).
8. Wire up project open/save controls in header.
9. Implement theme style, color palette, fonts, and advanced settings panels (currently placeholder).
10. Add project persistence (localStorage export/import) to allow saving/loading projects across sessions.
11. Improve error handling for image loading failures and invalid inputs.
12. Add accessibility improvements (ARIA labels, semantic HTML), a11y keyboard navigation.
13. Add automated tests (unit tests for renderer drawing logic and integration tests).
14. Break `js/app.js` into smaller modules while preserving global contract (longer-term refactor).

## Technical debt (tracked)

### TD-001: SlideRenderer Refactor (open)
- **Description**: Refactor SlideRenderer into a stateless renderer capable of rendering to any target canvas without global initialization.
- **Impact**: Current renderer uses module closure globals and requires init/render calls in sequence; makes temporary rendering for thumbnails fragile.
- **Priority**: Medium (workaround exists; affects maintainability and performance).
- **Effort**: 3-4 hours.

### TD-002: Batch Thumbnail Queue (open)
- **Description**: Current batch thumbnail generation uses Promise chaining; for 100+ images this could be optimized with Web Workers or micro-task yielding.
- **Impact**: Very large batch uploads (100+) may cause minor UI jank; current implementation is adequate for typical use (1-50 pages).
- **Priority**: Low.
- **Effort**: 2-3 hours.

### TD-003: Memory Management for Thumbnails (open)
- **Description**: Thumbnails are cached as data URLs on slide objects; for very large books (500+ pages) this will consume significant memory.
- **Impact**: Memory usage grows linearly with book size; no current limit or LRU eviction.
- **Priority**: Low (typical books are 1-100 pages).
- **Effort**: 2-3 hours (implement Blob-based caching + LRU).

### TD-004: Context Menu State Management (open, introduced in S2-T2.4)
- **Description**: Context menu uses global `contextMenuTarget` variable; could be refactored into a proper context menu module.
- **Impact**: Low; current implementation is functional and minimal.
- **Priority**: Low.
- **Effort**: 1-2 hours.

## Known issues (explicitly verified)

- The `+ Cover` and `+ CTA` buttons have been removed from the main sidebar (replaced by context menu placeholders).
- Context menu items for export, set cover, add before, add after, and move to end show placeholder alerts (feature not yet implemented).
- `URL.createObjectURL` is used to set `Image.src` but `URL.revokeObjectURL` is not called anywhere (memory leak risk).
- No undo/redo for page operations (delete is permanent within a session).
- Script order is important and fragile; swapping script tags breaks the app.
- Header buttons (Open Project, Save Project As) are not yet wired to functionality.
- Autosave status is mock and always shows "Saved locally" (actual autosave not yet implemented).

## Recommended next sprint (Sprint 3, highest priority first)

1. Implement actual autosave functionality: detect changes, save to localStorage, update autosave status display.
2. Implement project persistence: save entire AppState to localStorage with export/import JSON buttons.
3. Implement export page and set as cover functionality (currently context menu placeholders).
4. Add undo/redo support for page operations using a simple command stack.
5. Fix object URL memory leak: track created object URLs and revoke them when slides are removed.

