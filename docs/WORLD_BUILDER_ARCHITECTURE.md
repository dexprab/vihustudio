# World Builder Architecture

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** The permanent architecture of World Builder — the pipeline a
World moves through, and the non-negotiable rules (locks) that govern
every future feature added to it. This document does not describe any
single screen's visual design (see the World Builder Storyboard, the
canonical product reference for World Builder's screens) — it describes
the structural rules those screens must never violate. See
`docs/WORLD_PROJECT_CONTRACT.md` for what a World Project actually
contains, and `docs/PRODUCT_ASSETS.md` / `docs/WORLD_ASSET_CONTRACT.md`
for the asset ownership split this architecture assumes.

---

## The pipeline

```
Builder                (creates and edits Worlds — a creative application)
   ↓
Project                 (an editable, Builder-owned World Project)
   ↓
Validation               (checks a Project against the World Project Contract)
   ↓
Build                      (compiles a valid Project into a .vtheme package)
   ↓
Publish                     (shares the package — Official/Community/Export)
   ↓
Runtime                      (VihuStudio consumes the compiled package)
```

Each stage only ever hands the next one its own well-defined output —
Builder never reaches into Runtime, and Runtime never knows a World
came from Builder rather than being emailed as a raw `.vtheme` file
(`docs/WORLD_ASSET_CONTRACT.md`'s Import Parity rule). This is the same
separation `docs/THEME_PROJECT_SPEC.md` §0 already draws between a
Theme Project, Theme Builder, and VihuStudio — World Builder is that
same pipeline, given a creative front door instead of a developer one.

### Sprint B1.0 — what exists today

| Stage | Status |
|---|---|
| Builder — Screen 1 (Welcome) | **Implemented** |
| Builder — Screen 2 (Choose a Template) | **Implemented** |
| Project generation (template → World Project) | **Implemented** |
| Builder Workspace (Overview/Representations/Layouts/Frames/Layer Packs/Assets) | Not yet — future sprint |
| Validation (UI) | Not yet — future sprint. The validation *engine* (`js/services/validator.js`) already exists and works, reachable today only by internal tooling (`verify/goldenBuild.js`), not by a Builder screen. |
| Build (UI) | Not yet — future sprint. Same story as Validation: `js/services/builder.js` works today, with no Build button anywhere yet. |
| Publish | Not yet — future sprint |
| Runtime | **Unchanged** — VihuStudio still imports a `.vtheme` exactly as it always has (`docs/VTHEME_PACKAGE_SPEC.md`); nothing about how Studio consumes a World changed this sprint. |

---

## Architecture Locks

These are permanent rules, not sprint-scoped suggestions. A future
sprint that appears to require breaking one of them should be treated
as a signal to re-read this document, not a reason to make an exception.

### LOCK 01 — The Runtime consumes Worlds; the Builder creates Worlds

VihuStudio (the Runtime) only ever imports a compiled `.vtheme`
package. It has no concept of "Builder," "Project," or "template" — a
World that reaches Studio by being built in World Builder and one that
reaches Studio by being emailed as a raw file are indistinguishable at
import time (`docs/WORLD_ASSET_CONTRACT.md`'s Import Parity rule,
established in Sprint 11.2 and unbroken by this one). The Builder, in
turn, never renders a page the way Studio does — it edits and validates
Project data, nothing more.

### LOCK 02 — The Builder owns Projects; the Runtime owns Worlds

```
Project
   ↓ editable
Builder
   ↓ build
World Package (.vtheme)
   ↓
Runtime
```

A **Project** is Builder-owned, mutable, and has no meaning to Studio.
A **World Package** is Runtime-owned, immutable once built, and has no
editable state — Studio never mutates a `.vtheme` in place. Nothing
ever holds both roles at once.

### LOCK 03 — A New World is born valid

The moment a creator picks a template, the Builder generates a complete
World Project already satisfying `docs/WORLD_PROJECT_CONTRACT.md` — a
real manifest, real starter Layouts/Representations/Frame Variations,
real starter content everywhere the contract requires something. There
is no "empty project" state, no folder scaffold the creator must fill
in by hand, and no dialog asking the creator to configure anything
before the Project is considered real. See
`docs/WORLD_PROJECT_CONTRACT.md`'s own LOCK 03 section for the
per-file detail.

### LOCK 04 — The Builder is visual-first

No JSON editors. No folder browsers. No developer terminology anywhere
a creator can see it ("Theme," "Compiler," "manifest," "schema," and
similar words stay confined to internal code/docs, never surfaced in
Builder UI copy). Every future Builder Workspace screen edits Project
data through visual controls — pickers, sliders, cards, previews — the
same interaction discipline `docs/STUDIO_DESIGN_CANON.md` already holds
Studio itself to (§7, Interaction Philosophy: "Objects drive the UI.
Never tools.").

---

## Retirement note

The World Builder Storyboard is the canonical product reference for
every future World Builder screen. Sprint B1.0 retired the old Theme
Builder dashboard (a developer tool: Load Project / Validate / Build
buttons, a raw validation report) entirely — it is not preserved, not
evolved, and not reachable from World Builder's UI. Its validate/
compile logic survives, unchanged, as internal services
(`tools/world-builder/js/services/`) that a future Builder Workspace
will call the same way any other internal service is called — see
`docs/WORLD_PROJECT_CONTRACT.md` and `tools/world-builder/README.md`
for exactly what was kept and why.

---

## Change History

- v1.0 — Initial canonical document, written for Sprint B1.0 (World
  Builder Foundation — Product Reset). Documents the Builder → Project
  → Validation → Build → Publish → Runtime pipeline and the four
  architecture locks; records that only Screens 1–2 and Project
  generation exist so far.
