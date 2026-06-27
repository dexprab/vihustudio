# AI Development Guide for VihuStudio

This guide explains how AI coding agents (and human collaborators following automated instructions) should work on this repository safely and without breaking existing behavior.

Principles (must follow):

- Read-first: The agent must read the entire repository and evidence the files it relied on before making changes. Relevant files include at minimum `index.html`, `js/state.js`, `js/app.js`, `renderer/slideRenderer.js`, and `css/style.css`.

- Non-destructive edits: Do not modify production runtime files (HTML, CSS, JS, renderer) unless the task explicitly requires it. The repository currently uses global variables and DOM IDs that are fragile; small changes may break the app.

- Preserve public contracts: The following symbols and DOM IDs are effectively public API and must be preserved unless the change includes a coordinated, repository-wide migration and tests:
  - Global variables: `AppState`, `SlideRenderer`.
  - DOM IDs: `uploadBtn`, `scanUpload`, `slideList`, `previewCanvas`, `bookTitle`, `storyBeat`, `pageNumber`, `totalPages`.
  - Slide object shape used in memory: `{id, image, storyBeat, page, totalPages}`.

- Minimal, incremental PRs: Each build should be a single, small, well-tested change. Prefer adding new modules or files rather than editing core files; if a core file must change, do the smallest possible patch and include a regression checklist.

- Preserve script order: `js/state.js` must be loaded before `renderer/slideRenderer.js`, and both must be loaded before `js/app.js`. If you add new scripts, ensure insertion does not break ordering.

- No assumptions: If a required fact cannot be determined from source (e.g., intended behavior of `+ Cover` button), document it and ask for clarification rather than guessing.

Testing and verification (manual checks to run after code changes):

- Open `index.html` in a browser (prefer `python -m http.server` to serve files) and verify:
  - Uploading images works and creates slide entries
  - Preview renders without console errors
  - Story text updates are reflected in the preview
  - Slide list navigation works
  - No new console errors or uncaught exceptions

- Automated checks (if implemented later): add unit tests for any new JS module and an integration test that runs a headless browser to load `index.html`, simulate an upload, and check that the canvas drawing API was called.

Safe editing checklist for agents (mandatory):

1. Identify the minimal set of files to edit.
2. Run a quick static check for references to globals and DOM IDs to avoid regressions.
3. Add new functionality in its own file where possible.
4. Avoid renaming or removing global names and IDs. If you must, update all references and include a migration note in `ARCHITECTURE.md`.
5. If changing the renderer API (`init`/`render`), update `js/app.js` in the same commit and test the preview.
6. Update `CHANGELOG.md` with a single entry describing the change.
7. Include a one-paragraph regression checklist in the commit body and verify it manually in a browser.

If blocked (mandatory):
- Stop and report the blocker instead of guessing. Typical blockers include missing repository permissions, unclear behavior for UI elements, or lack of a test harness.

