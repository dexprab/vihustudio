# TASKS and Backlog for VihuStudio

## DESIGN FREEZE NOTICE

**As of Sprint 2 Task 2.6 (2026-06-27)**

The VihuStudio workspace layout is now officially LOCKED.

Future sprints may:
- Add functionality
- Enable placeholders
- Improve performance
- Fix bugs

But should NOT move panels or redesign the workspace unless explicitly approved by the VihuStudio Design Council.

---

This file lists the current backlog, technical debt, known issues, and a recommended next sprint. All items below are written from the current implementation — no assumptions beyond what is present in the codebase.

## Current backlog (observed from code state)

### Sprint 3 Implementation TODO

- [x] **Open Project**: Load a saved .vihu project file and restore AppState (T3.0)
- [x] **Save Project As**: Serialize AppState and export as .vihu JSON file (T3.0)
- [x] **Auto Save**: Detect changes, save to localStorage, update autosave status display (T3.0)
- [x] **Restore Session**: Load last session from localStorage on app start (T3.0)
- [x] **Export Page**: Render and export individual page as image (T3.1)
- [x] **Set as Cover**: Mark a page as the book cover (T3.1)
- [x] **Move to End**: Move a page to the end of the book (T3.1)
- [x] **Add Before**: Insert a blank page before current page (T3.1)
- [x] **Add After**: Insert a blank page after current page (T3.1)
- [x] **Style Panel**: Replaced with Theme Designer (T3.3)
- [x] **Theme Customization**: Theme Engine + Designer with variants, decorations, branding controls (T3.2 – T3.3.3)
- [x] **Workspace Simplification**: Hide Project Title, Author, editable Book Name; preserve metadata in the model (T3.3.4)
- [ ] **Vihu Buddy**: AI assistant panel (research & design)

> Canonical project context now lives in [CLAUDE.md](./CLAUDE.md). This TODO list is retained for historical traceability of Sprint 3.

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

### TD-005: Timeline Synchronization (open)
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

1. **Persistence Engine**: Implement actual autosave functionality and project save/load with .vihu file format.
2. **Export functionality**: Implement page and book export (image/PDF).
3. **Page Operations**: Implement remaining context menu features (set as cover, move to end, add before/after).
4. **Session Restoration**: Load previous session from localStorage on app start.
5. **Memory Optimization**: Fix object URL memory leak and implement thumbnail memory management.

