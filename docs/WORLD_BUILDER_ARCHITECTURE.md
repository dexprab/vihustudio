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

### Sprint B1.1 — what exists today

| Stage | Status |
|---|---|
| Builder — Screen 1 (Welcome) | **Implemented** |
| Builder — Screen 2 (Choose a Template) | **Implemented** — selecting a template opens the Builder Workspace immediately (the template disappears; there is no return trip to Screen 1). |
| Project generation (template → World Project) | **Implemented** |
| Builder Workspace shell (permanent Preview + permanent Context Panel + Navigation) | **Implemented** |
| Builder Workspace — Overview state | **Implemented** |
| Builder Workspace — Representations state | **Implemented** |
| Builder Workspace — Layouts state | **Implemented** |
| Builder Workspace — Frames / Layer Packs / Assets states | Stubbed — reachable in Navigation, show "Coming in the next sprint," Preview and Context Panel stay mounted. Not yet built. |
| Validation (UI) | Not yet — future sprint. The validation *engine* (`js/services/validator.js`) already exists and works, reachable today only by internal tooling (`verify/goldenBuild.js`), not by a Builder screen. Stubbed in Navigation this sprint. |
| Build (UI) | Not yet — future sprint. Same story as Validation: `js/services/builder.js` works today, with no Build button anywhere yet. Stubbed in Navigation this sprint. |
| Publish | Not yet — future sprint. Stubbed in Navigation this sprint. |
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

## The Builder Workspace

Introduced in Sprint B1.1, the Builder Workspace is the permanent home
of World editing — everything that happens to a World Project after
Screen 2 happens inside it. It is one screen with three permanent
regions, never a sequence of pages:

```
┌─────────────────────────────────────────────────────────┐
│ Header — World Name · Draft Saved · Preview/Settings/Save│
├───────────┬───────────────────────────────┬──────────────┤
│           │                               │              │
│ Builder   │        Live Preview           │   Context    │
│ Navigation│      (always visible)         │    Panel     │
│           │                               │              │
└───────────┴───────────────────────────────┴──────────────┘
```

- **Header** — shows the World Project's own `manifest.json` name (never
  the template it was created from — the Builder edits a World Project,
  not a Template) and a Draft Saved status. Preview / Settings / Save /
  overflow menu are present per the storyboard; none of them do
  anything beyond this sprint's scope yet.
- **Builder Navigation** (left) — a fixed list of nine states: Overview,
  Representations, Layouts, Frames, Layer Packs, Assets, Validation,
  Build, Publish. Selecting one never opens a new page — it only swaps
  which state is active, exactly like VihuStudio Studio's own object
  selection model (`docs/STUDIO_DESIGN_CANON.md` §7).
- **Live Preview** (center) — permanent; never disappears, regardless of
  which Navigation state is active. Per LOCK 01, this is *not* Studio's
  Runtime renderer reused inside the Builder — the Builder still never
  renders a page the way Studio does. It is an illustrative mockup
  (`tools/world-builder/js/worldBuilderApp.js`'s `_renderPreview`) built
  from the World Project's own data — icon, name, tagline, the active
  Representation's or Layout's aspect ratio and frame colour/thickness —
  so it updates immediately as the Context Panel edits the Project, without
  duplicating Runtime rendering code.
- **Context Panel** (right) — exactly one mount point
  (`#wb-context-panel`), reused by every Navigation state. It never
  spawns a second panel or a dialog; changing Navigation state re-paints
  its contents in place.

### The State System

Each Navigation item maps to one Context Panel renderer function. A
state that isn't built yet (Frames/Layer Packs/Assets/Validation/Build/
Publish, this sprint) renders a stub — an icon, the state's name, and
"Coming in the next sprint." — rather than leaving a broken or dead nav
item; the Preview and Navigation stay fully functional underneath it.
Adding a real state in a future sprint means writing one more renderer
function and removing that state's id from the stub list — the shell
itself does not change.

`tools/world-builder/js/projectModel.js` is the accessor/mutator layer
every Context Panel state reads and writes through — it is the only
code that knows the World Project's file-map shape
(`manifest.json`/`metadata.json`/`theme.json`/`layouts/*.json`/
`frames/*.json`/`representations/all.json`); the Workspace UI itself
never touches `project.files[...]` directly. Every edit calls
`ProjectStore.save()` immediately (`js/projectStore.js`) — there is no
separate "Save" action for Project data; the Header's Save button is
reserved for a future, different purpose (per the storyboard) and is
inert this sprint.

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
- v1.1 — Sprint B1.1 (World Builder Workspace Foundation). Adds the
  Builder Workspace section: three permanent regions (Navigation/Live
  Preview/Context Panel), the nine-item Navigation list, and the State
  System (one Context Panel renderer per Navigation item, unbuilt states
  stubbed rather than left broken). Updates the status table — Overview/
  Representations/Layouts are implemented; Frames/Layer Packs/Assets are
  now stubbed (previously "not yet" with no UI at all); Validation/Build/
  Publish remain engine-only. Records that Screen 2's template selection
  now opens the Workspace directly instead of returning to Screen 1.
