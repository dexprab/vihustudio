# CHANGELOG

All notable changes to this project are documented in this file.

## Unreleased

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

