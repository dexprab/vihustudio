# TASKS and Backlog for VihuStudio

This file lists the current backlog, technical debt, known issues, and a recommended next sprint. All items below are written from the current implementation — no assumptions beyond what is present in the codebase.

## Current backlog (observed from code state)

### Sprint 3 Implementation TODO

- [ ] **Open Project**: Load a saved .vihu project file and restore AppState
- [ ] **Save Project As**: Serialize AppState and export as .vihu JSON file
- [ ] **Auto Save**: Detect changes, save to localStorage, update autosave status display (Unsaved changes → Saving... → Saved locally)
- [ ] **Restore Session**: Load last session from localStorage on app start
- [ ] **Export Page**: Render and export individual page as image/PDF
- [ ] **Set as Cover**: Mark a page as the book cover (visual indicator)
- [ ] **Move to End**: Move a page to the end of the book
- [ ] **Add Before**: Insert a blank page before current page
- [ ] **Add After**: Insert a blank page after current page
- [ ] **Style Panel**: Implement color palette, fonts, page style, layout options
- [ ] **Theme Customization**: Allow custom color schemes and themes

### General backlog (observed from code state)

1. Add safe memory cleanup for uploaded images (revoke object URLs created via `URL.createObjectURL`).
2. Implement undo/redo for page operations.
3. Improve error handling for image loading failures and invalid inputs.
4. Add accessibility improvements (ARIA labels, semantic HTML), a11y keyboard navigation.
5. Add automated tests (unit tests for renderer drawing logic and integration tests).
6. Break `js/app.js` into smaller modules while preserving global contract (longer-term refactor).

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

### TD-004: Context Menu State Management (open)
- **Description**: Context menu uses global `contextMenuTarget` variable; could be refactored into a proper context menu module.
- **Impact**: Low; current implementation is functional and minimal.
- **Priority**: Low.
- **Effort**: 1-2 hours.

### TD-005: Timeline Synchronization (open, introduced in S2-T2.5)
- **Description**: Timeline and left pane list are rendered separately; they could share a common rendering function.
- **Impact**: Low; minor code duplication in renderList() and renderTimeline(). Both functions are nearly identical.
- **Priority**: Low.
- **Effort**: 1 hour (refactor to single renderAllThumbnails() function).

## Known issues (explicitly verified)

- Context menu items for export page, set cover, add before, add after, and move to end show placeholder alerts (features not yet implemented).
- `URL.createObjectURL` is used to set `Image.src` but `URL.revokeObjectURL` is not called anywhere (memory leak risk).
- No undo/redo for page operations (delete is permanent within a session).
- Script order is important and fragile; swapping script tags breaks the app.
- Header buttons (Open Project, Save Project As) are not yet wired to functionality (placeholders).
- Autosave status is mock and always shows "Saved locally" (actual autosave not yet implemented).
- Timeline is read-only; no drag & drop page reordering yet.

## Recommended next sprint (Sprint 3, highest priority first)

1. Implement actual autosave functionality: detect changes, save to localStorage, update autosave status display.
2. Implement project persistence: save/load entire AppState with Save As / Open Project buttons; restore previous session.
3. Implement export page functionality (image/PDF export of single page).
4. Implement set as cover and move to end page operations.
5. Implement add before / add after page operations.
6. Fix object URL memory leak: track created object URLs and revoke them when slides are removed.

