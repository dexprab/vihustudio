# TASKS and Backlog for VihuStudio

This file lists the current backlog, technical debt, known issues, and a recommended first sprint. All items below are written from the current implementation — no assumptions beyond what is present in the codebase.

## Current backlog (observed from code state)

1. Add safe memory cleanup for uploaded images (revoke object URLs created via `URL.createObjectURL`).
2. Implement slide deletion and reordering UI and handlers.
3. Wire up or implement behaviors for `+ Cover` and `+ CTA` buttons (currently present in HTML but have no handlers in `js/app.js`).
4. Add project persistence (localStorage export/import) to allow saving/loading projects across sessions.
5. Improve error handling for image loading failures and invalid inputs.
6. Add accessibility improvements (ARIA labels, semantic HTML), a11y keyboard navigation.
7. Add automated tests (unit tests for renderer drawing logic and an integration test for file upload + render).
8. Add a documented CHANGELOG process and release notes (this initial commit adds docs).
9. Break `js/app.js` into smaller modules while preserving global contract (longer-term refactor).
10. Add an export feature (image/PDF export of book or pages).

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

## Known issues (explicitly verified)

- The `+ Cover` and `+ CTA` buttons do nothing (no event handlers in `js/app.js`).
- `URL.createObjectURL` is used to set `Image.src` but `URL.revokeObjectURL` is not called anywhere.
- No way to delete or reorder slides via the UI.
- Script order is important and fragile; swapping script tags breaks the app.

## Recommended next sprint (4 tasks, highest priority first)

1. Fix object URL memory leak: track created object URLs per slide and call `URL.revokeObjectURL` when a slide is removed or the app unloads.
2. Implement slide deletion (UI button on each slide list item) with minimal changes to `js/app.js` and add a confirmation dialog.
3. Add handlers for `+ Cover` and `+ CTA` that insert special slides (non-destructive change — create a `type` field for slides and keep render behavior compatible).
4. Add a simple persistence layer using `localStorage` (save/load project) with an explicit "Export" and "Import" JSON button; do not change the shape of `AppState` or SlideRenderer API.

