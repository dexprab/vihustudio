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

## Technical debt (concise)

- Global variables (AppState, SlideRenderer) and direct DOM ID coupling.
- No tests or CI.
- No persistence or export mechanism.
- Potential memory leak: created object URLs are never revoked.
- Minimal error handling and validation.

## Known issues (explicitly verified)

- The `+ Cover` and `+ CTA` buttons do nothing (no event handlers in `js/app.js`).
- `URL.createObjectURL` is used to set `Image.src` but `URL.revokeObjectURL` is not called anywhere.
- No way to delete or reorder slides via the UI.
- Script order is important and fragile; swapping script tags breaks the app.

## Recommended next sprint (4 tasks, highest priority first)

1. Fix object URL memory leak: track created object URLs per slide and call `URL.revokeObjectURL` when a slide is removed or the app unloads.
2. Implement slide deletion (UI button on each slide list item) with minimal changes to `js/app.js` and add a confirmation dialog.
3. Add handlers for `+ Cover` and `+ CTA` that insert special slides (non-destructive change—create a `type` field for slides and keep render behavior compatible).
4. Add a simple persistence layer using `localStorage` (save/load project) with an explicit "Export" and "Import" JSON button; do not change the shape of `AppState` or SlideRenderer API.

