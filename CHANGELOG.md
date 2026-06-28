# CHANGELOG

All notable changes to this project are documented in this file.

## Unreleased

- feat(theme-designer): T3.3 Theme Designer (build 0015, 2026-06-28)
  - Style tab renamed to Theme Designer; layout otherwise unchanged
  - Theme model extended with `variants[]` and `decorations[]` declarations; cross-theme catalogs (`panelStyles`, `footerStyles`, `pageNumberStyles`) live on ThemeEngine
  - Designer sections: Theme Library, Variant, Story Panel (Classic/Rounded/Cloud/Scroll), Footer (Classic/Modern/Minimal/Hidden), Decorations (per-theme set of Stars/Clouds/Birds/Trees/Flowers), Page Numbers (Bottom Right/Bottom Center/Hidden)
  - Each control routes through a single ThemeEngine.setOption / toggleDecoration path which invalidates thumbnails, refreshes preview + filmstrip + left list, and marks dirty for autosave
  - SlideRenderer extended (composition unchanged) to draw the four panel shapes, three page-number positions, three footer styles (plus hidden), and five decoration motifs; theme variants resolve frame color through ThemeEngine.resolveFrameColor
  - On theme switch, themeOptions are reconciled: variants default to the new theme's first; decorations are pruned to those allowed
  - AppState extended with `project.themeOptions`; ProjectManager serializes / restores it (schema extension only, still v1.0)
  - No changes to SlideRenderer API, ThumbnailEngine queue, ThemeManager, ProjectManager architecture, PageOps, or the locked workspace layout
- feat(theme): Theme Engine foundation (T3.2, build 0014, 2026-06-28)
  - New module `js/themeEngine.js` owns theme registry, apply, preview, persistence
  - Four built-in themes: Storybook Classic (default), Adventure, Fun Comic, Minimal Elegant
  - SlideRenderer extended to accept a theme object in its payload (backward compatible — falls back to the active theme or an embedded Storybook Classic if none is provided)
  - ThumbnailEngine forwards the active theme so thumbnails reflect the selected theme
  - Style tab replaced with theme cards (preview swatch + name + description), Theme Info block (name / description / suitable-for), and an informational "Coming in future" placeholder for typography, colors, decorations, layout, frames
  - THEME dropdown in the left sidebar now populated from the registry; both the dropdown and cards stay in sync with the active theme
  - Changing theme immediately repaints preview, refreshes left thumbnails and the filmstrip, and persists via ProjectManager autosave
  - On Open / Restore, the saved theme is re-applied (silent — no extra autosave write); thumbnails are restored as they were saved
  - No changes to SlideRenderer drawing algorithm or layout positions; no changes to ThemeManager (light/dark), ProjectManager architecture, PageOps, or the locked UI layout
- feat(page-ops): complete page management (T3.1, build 0013, 2026-06-28)
  - All eight context-menu actions implemented; no placeholder alerts remain
  - New PageOps methods: addBefore, addAfter, moveToEnd, setAsCover, exportPage
  - Internal helpers introduced (_recalcPageNumbers, _refreshNavigation, _refreshSelection, _reorderPages, _createBlankSlide) to eliminate duplicated page-order logic and unblock future Move Up / Move Down / Drag & Drop
  - Page numbers and totalPages recalculated on every mutation; no stale numbering
  - Selection stability per spec: delete keeps nearest neighbour focused; moveToEnd / setAsCover keep moved page focused; add-before / add-after focus the new page
  - Set as Cover enforces single-cover invariant: any existing cover is converted back to story before the new cover is moved to position 1
  - Export Page renders the selected slide at full resolution 1080x1350 via the existing SlideRenderer and downloads "Page NNN.png" (zero-padded)
  - PageOps now persists internally (calls ProjectManager.markDirty) — app.js no longer needs per-op autosave wiring
  - No changes to SlideRenderer, ThumbnailEngine, ThemeManager, ProjectManager architecture, or the locked UI layout
- feat(persistence): project lifecycle foundation (T3.0, build 0012, 2026-06-28)
  - New module `js/projectManager.js` owns serialize, deserialize, autosave, save-as, open, and session restore
  - Project model v1.0 with `version`, `project` (title/author/bookTitle/theme/createdDate/modifiedDate), `pages` (pageType/image/thumbnail/storyBeat/storyDraft/metadata), `settings` (darkMode/selectedTheme), `session` (currentPage/uiState)
  - Page types introduced: `story`, `cover`, `cta`, `blank` (only `story` and `blank` used this sprint)
  - Autosave to `localStorage` with 500 ms debounce on upload, page operations, theme change, project/author/book-title/story edits
  - Header autosave status now shows live state: Saving... / Saved / Save Failed / Unsaved
  - Save Project As downloads a `.vihu` file (JSON, no compression, image data-URLs encapsulated inside ProjectManager)
  - Open Project (`.vihu`) restores project metadata, pages, thumbnails, theme, and current page
  - On startup, app prompts to Restore or Discard a saved session; corrupt or future-version sessions show a graceful Start New Project / Discard Saved Session dialog
  - Extended `AppState.project` with author, bookTitle, createdDate, modifiedDate (non-breaking)
  - No changes to SlideRenderer, ThumbnailEngine, ThemeManager, PageOps, or the locked UI layout
- refactor(ui): final layout correction — design freeze (T2.6.1, build 0011, 2026-06-28)
  - Filmstrip now spans the full width of the center workspace (removed 444px cap); remains inside the preview column and never extends under the sidebars
  - Added a thin top border to visually anchor the filmstrip as part of the book workspace
  - Increased preview canvas from 444x555 to 500x625 (~12% larger, 4:5 aspect preserved)
  - Scaled responsive preview sizes proportionally at 1600/1440/1366/1280 breakpoints
  - Reclaimed 100px reserved at the bottom of the workspace grid; the filmstrip now lives inside the preview column instead
  - Tightened preview area padding and wrapper margin to reduce dead grey space
  - Consolidated six Style-tab "Coming Soon" cards into a single grouped placeholder
  - No changes to AppState, SlideRenderer, ThumbnailEngine, PageOps, ThemeManager, or Export
- docs: add project architecture and AI development guide (2026-06-27)
- feat(dev): add development build information footer (2026-06-27)
- feat(dev): add dynamic build information loader (2026-06-27)
- feat(slides): implement thumbnail navigation engine (2026-06-27)
- feat(batch): improve batch thumbnail workflow (2026-06-27)
- feat(slides): implement page operations (duplicate, delete, insert blank) (2026-06-27)
- refactor(ui): align workspace to official VihuStudio wireframe (2026-06-27)
  - Redesigned header with project controls, title, and theme toggle
  - Reorganized left pane into sections: MY BOOK, PROJECT, THEME, PAGES
  - Added context menu (⋮) to each thumbnail with page operation shortcuts
  - Expanded right pane with Story and Style tabs (Style placeholder for Sprint 3)
  - Implemented light/dark theme framework with localStorage persistence
  - Added autosave status placeholder for Sprint 3
  - Improved spacing and layout to match wireframe
  - Preserved all existing functionality: upload, thumbnail engine, renderer, export
- refactor(ui): complete VihuStudio wireframe implementation (2026-06-27)
  - Fixed context menu positioning: appears beside thumbnail, auto-repositions at screen edges, closes on Escape or outside click
  - Removed page action buttons from left pane (Duplicate, Delete, Blank) - now accessed only via context menu
  - Restored bottom timeline/filmstrip: horizontal scrollable strip showing all pages with current page highlighted
  - Left pane is now navigation-only (MY BOOK, PROJECT, THEME, PAGES sections)
  - Timeline synchronizes with left pane selection
  - Added Escape key handler for context menu
  - Improved context menu positioning logic for screen edge detection
  - Updated all context menu items to include Insert Blank option
  - Added renderTimeline() function to keep timeline in sync with page changes
- refactor(ui): final UI polish & design freeze (2026-06-27)
  - Expanded left pane from 300px to 340px for better breathing room
  - Redesigned page navigation cards: compact horizontal layout (thumbnail + label + menu)
  - Fixed PROJECT section alignment and hierarchy (Title, Author labels)
  - Increased preview area: canvas expanded from 370x462 to 444x555 (20% increase)
  - Moved timeline inside preview area (below canvas, same width) as part of book workspace
  - Improved header spacing and button sizing (40px height)
  - Reduced upload button visual dominance (less saturated appearance)
  - Enhanced right panel spacing and typography hierarchy
  - Standardized design system: 12px border-radius, 16px card-radius, 16px padding, 24px section gap, 40px button/input height
  - Improved hover states: smooth 0.2s transitions, consistent interaction feedback
  - Added responsive breakpoints for 1920, 1600, 1440, 1366, 1280 px widths
  - Added Vihu Buddy placeholder in Story panel (reserved for Sprint 3)
  - Updated all CSS variables for no hardcoded colors
  - Design LOCKED: no further UI structural changes without explicit approval

## Sprint 2 Complete

The VihuStudio UI is now feature-complete and matches the approved wireframe.
Version 0.4-dev is ready for Sprint 3 (Persistence Engine & Functionality).

