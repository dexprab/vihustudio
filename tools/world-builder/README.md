# World Builder

A creative application for building Worlds for VihuStudio.

## Overview

World Builder is where a creator (official or third-party) makes a
World: a Story or Artwork experience a child can pick in Studio's
Creation Flow. It is **not** a developer tool — the creator never edits
JSON, never creates folders, and never sees package internals. Choosing
a starting template is enough to produce a complete, valid World
Project; everything about how the World looks and behaves is customized
visually from there (in a future sprint's Builder Workspace).

```
Welcome                 (Screen 1 — this sprint)
   ↓
Choose a Template        (Screen 2 — this sprint)
   ↓
World Project             (Builder-owned, editable, born valid)
   ↓
Builder Workspace          (a future sprint)
   ↓
Validate → Build           (a future sprint)
   ↓
.vtheme package             (Runtime format — see docs/VTHEME_PACKAGE_SPEC.md)
   ↓
VihuStudio Import
```

See `docs/WORLD_PROJECT_CONTRACT.md` for what a World Project contains
and `docs/WORLD_BUILDER_ARCHITECTURE.md` for the full Builder → Project
→ Validation → Build → Publish → Runtime pipeline and the architecture
locks this sprint introduced.

## Sprint B1.0 — Product Reset

The old **Theme Builder** — a developer-facing dashboard (Load Project /
Validate / Build buttons, a folder picker, a validation report) — is
retired. Its user-facing workflow is gone; nothing here evolves it or
preserves its screens. What survives, unchanged, are the parts of it
that were never UI in the first place:

- `js/services/projectLoader.js` — reads a Theme Project folder into
  memory
- `js/services/validator.js` — checks it against
  `docs/THEME_PROJECT_SPEC.md`
- `js/services/builder.js` — compiles a validated project into the
  canonical `.vtheme` shape (`docs/VTHEME_PACKAGE_SPEC.md`)
- `js/services/constants.js` — the runtime-contract enums `validator.js`
  checks against (mirrors `js/themeRegistry.js` exactly)

These three service classes have zero dependency on the retired
dashboard's state/event/routing machinery (confirmed before the old UI
was removed) — they are plain, callable APIs a future Builder Workspace
screen will drive directly. Until that exists, they're exercised only
by `verify/goldenBuild.js` via `services-harness.html`, a minimal,
non-user-facing loader page that exists purely so that test can call
them without a dashboard to click through.

## This Sprint's Scope

Only two screens are implemented:

1. **Welcome** — Create New World (the one primary action), My World
   Projects (Builder-owned drafts, persisted locally), Explore Worlds
   (Official/Community/Templates — static, informational, no behaviour
   behind them yet).
2. **Choose a Template** — six starting points (Artwork Gallery,
   Storybook, Quotes, Sketchbook, Greeting Cards, Blank World).
   Selecting one immediately generates a complete, valid World Project
   — no wizard, no dialog, no manual folder/JSON authoring — and
   returns to Welcome with it now listed as a draft.

Explicitly **not** implemented yet, per this sprint's own scope: the
Builder Workspace (Overview/Representations/Layouts/Frames/Layer
Packs/Assets sections), Validation, Build, Publish, AI assistance,
Official World authoring inside the Builder, or Community publishing.
Those are future sprints layered on top of the same reusable services
above.

## Local Persistence

World Projects a creator is working on are Builder-owned, editable
working copies — not files on the creator's disk, and not synced to
GitHub or any cloud service. They persist in the browser via
`localStorage` (`js/projectStore.js`), the same mechanism
`js/themeRegistry.js` already uses for imported themes in the main
Studio app. Nothing here introduces new infrastructure for that.

## Browser Support

- Modern browsers with ES6 support
- No build step required
- No external dependencies
