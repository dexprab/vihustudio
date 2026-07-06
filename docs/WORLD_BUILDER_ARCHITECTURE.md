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

### Sprint B2.0 — what exists today

Every Builder Workspace state from the storyboard is now implemented.
Museum Gallery was authored entirely through this pipeline — Overview
through Publish — with zero manual JSON/folder editing, then imported
into a clean Runtime and verified end-to-end; see
`FIRST_OFFICIAL_WORLD_REPORT.md` for the full account.

| Stage | Status |
|---|---|
| Builder — Screen 1 (Welcome) | **Implemented** |
| Builder — Screen 2 (Choose a Template) | **Implemented** — selecting a template opens the Builder Workspace immediately (the template disappears; there is no return trip to Screen 1). |
| Project generation (template → World Project) | **Implemented** |
| Builder Workspace shell (permanent Preview + permanent Context Panel + Navigation) | **Implemented** |
| Builder Workspace — Overview state | **Implemented** |
| Builder Workspace — Representations state | **Implemented** |
| Builder Workspace — Layouts state | **Implemented** |
| Builder Workspace — Frames state | **Implemented** (Sprint B2.0) — create/duplicate/rename/delete/reorder, full field editor (thickness/padding/inset/border/wall tone/shadow/corner radius/default margin), all through `ProjectModel`. |
| Builder Workspace — Layer Packs state | **Implemented** (Sprint B2.0) — multiple named packs (Builder-only organization; the compiled Runtime still merges every `layer-packs/*.json` file into one flat array, unchanged), Default Layer Pack writes the real, previously-reserved `theme.json.defaultLayerPack` field, per-layer visibility/lock/reorder/type/target/anchor/position/offset/z-index/text-source. |
| Builder Workspace — Assets state | **Implemented** (Sprint B2.0) — generated entirely from `docs/WORLD_ASSET_SPEC.md` / `js/assetSpec.js`; real file upload (FileReader → data URI) for Identity (required) and Frames/Textures/Decorations/Icons/Fonts/Backgrounds (optional); live completion tracking. |
| Validation (UI) | **Implemented** (Sprint B2.0) — runs the real, unmodified `js/services/validator.js` via a new in-memory adapter (`js/projectCompiler.js`), not a second opinion of "valid." Reports pass/warning/error grouped by category (World Contract/Representations/Layouts/Frames/Layer Packs/Assets/References/Metadata/Version). |
| Build (UI) | **Implemented** (Sprint B2.0) — runs the real, unmodified `js/services/builder.js` via the same adapter, producing a genuine `{manifest, theme, assets}` `.vtheme` package stored on the Project (`project.lastBuild`). |
| Publish (UI) | **Implemented** (Sprint B2.0) — Export Package and Official World both download exactly the Build-produced package, byte-for-byte; Community World is an honest, inert "Coming soon" placeholder. |
| Runtime | **Unchanged** — VihuStudio still imports a `.vtheme` exactly as it always has (`docs/VTHEME_PACKAGE_SPEC.md`); verified this sprint against a Builder-produced (not hand-authored) package for the first time. |

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

### Validation and Build reuse the real engines (Sprint B2.0)

`tools/world-builder/js/projectCompiler.js` is the adapter that makes
good on this document's own earlier promise — "a future Build stage can
feed [a World Project] to the same unmodified `validator.js`/`builder.js`
with no translation layer." Both engines only ever talk to the global
`projectLoader` singleton (`js/services/projectLoader.js`), populated
historically by picking a real folder via `<input webkitdirectory>`.
`projectCompiler.js`'s entire job is populating that same singleton from
an in-memory World Project instead — every `project.files[path]` entry
becomes a real `Blob` (JSON-stringified for `.json` files, decoded from
its stored data URI for an asset) so `projectLoader`'s own
`FileReader`-based `readFile`/`readFileAsDataURL` work unmodified. This
means Validation and Build are not a second, Builder-specific opinion
of "valid" or "compiled" — they are the identical rules and identical
compiled output a hand-authored Theme Project would get from the same
services, proven this sprint by running Museum Gallery through them for
the first time (`FIRST_OFFICIAL_WORLD_REPORT.md`).

The Assets Workspace state is generated entirely from
`tools/world-builder/js/assetSpec.js` (the Builder-readable mirror of
`docs/WORLD_ASSET_SPEC.md`) — every category and slot the Assets screen
can ever show is declared once there; the screen itself contains no
per-category markup.

### The Toolbar reuses the real Runtime engine, never a Builder-only mock (Sprint B2.0.1)

Preview (the header's `👁️ Preview` button) does not draw its own
approximation of a World — it packages the current Project through the
same `builder.js` service Validation/Build already use
(`builder.packageTheme()` → `buildManifest()` → `buildTheme()`, all
called as bare global identifiers since `services/builder.js` exports
only a lexical `const builder`, not `window.builder` — see the Sprint
B1.0-era gotcha this repeats), then hands the compiled theme straight to
`renderer/slideRenderer.js`'s real `SlideRenderer.init()`/`.render()` —
the exact module the main app renders every page with. A synthetic slide
object carries `theme`/`artworkTheme`/`metadata` directly rather than
going through `ThemeEngine`, which `slideRenderer.js` already guards with
`typeof ThemeEngine!=='undefined'` checks and so tolerates being absent.
`js/themePresets.js` and `js/layerEngine.js` are loaded alongside for
full Frame Variation and Layer Pack fidelity, guarded the same way. This
means Preview cannot drift from what Runtime actually renders, because
it is not a second rendering path — it is the same one, fed Builder data
instead of `AppState`.

Save performs a real, immediate `ProjectStore.save(currentProject)` with
visible confirmation feedback; it does not simulate success. The
three-dot menu's Duplicate/Delete call the corresponding real
`ProjectStore.duplicate()`/`ProjectStore.remove()` functions. No Sprint
B2.0.1 toolbar control fires without a working handler behind it.

### Publish installs the built package via the same import path Runtime already trusts (Sprint B2.0.1)

"Publish to Official Themes" (renamed from the placeholder "Official
World," which previously behaved identically to Export Package and did
nothing distinct) operates only on `project.lastBuild` — the immutable
package Build produced — never on `project.files`, preserving the
Builder-owns-Projects/Runtime-owns-Packages split (LOCK 02). It calls
the real, unmodified `window.ThemeRegistry.importPackage(pkg,
{onDuplicate:'replace'})`, loaded into the Builder's own page via a
`<script src="../../js/themeRegistry.js">` tag. Because World Builder and
the main VihuStudio app are served from the same origin, this writes to
the exact `localStorage` key (`vihu.themeRegistry.imported.v1`) the main
app already reads at boot — giving genuine automatic Runtime discovery
and "replace existing versions" behavior with zero Runtime code changes,
zero duplicated import logic, and no fabricated backend/filesystem
write. This is the same reasoning `FIRST_OFFICIAL_WORLD_REPORT.md`
disclosed as the honest constraint of a client-side browser tool with no
literal access to the git-tracked `official-worlds/`/`themes/` folders;
Publish satisfies the ticket's functional requirement ("Runtime
automatically discovers the updated package") through the closest real
mechanism available rather than simulating one. Export Package is
unchanged — it still downloads the built `.vtheme` for sharing/backup/
manual import. Community World remains Coming Soon.

### Overview consumes the same shared selection state as Representations (Sprint B2.0.1)

Sprint B2.0's Overview panel never rendered a Representation-driven Live
Preview at all — `_renderPreview()`'s `AAF_STATES` set only covered
`representations`/`layouts`/`frames`, so Overview always fell back to a
generic identity card regardless of which Representation chip a user had
clicked (the click itself correctly updated the shared
`currentRepresentationId` module variable and re-highlighted the chip,
which made the bug easy to miss). The fix is a single new predicate,
`_showsRepresentationPreview()`, that also returns true for Overview
when the Project has at least one Representation — no second selection
variable was introduced; Overview reads the exact same
`currentRepresentationId` state Representations already writes.

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
- v2.0 — Sprint B2.0 (First Official World Platform Validation). Every
  remaining Builder Workspace state is implemented (Frames, Layer Packs,
  Assets, Validation, Build, Publish). Adds the "Validation and Build
  reuse the real engines" section documenting `projectCompiler.js`'s
  in-memory adapter over the unmodified `validator.js`/`builder.js`, and
  notes the Assets state is entirely generated from
  `docs/WORLD_ASSET_SPEC.md`/`assetSpec.js`. Records that Museum Gallery
  was authored end-to-end through this pipeline with zero manual
  JSON/folder editing, built into a real `.vtheme`, and verified against
  a clean Runtime import — see `FIRST_OFFICIAL_WORLD_REPORT.md`.
- v2.1 — Sprint B2.0.1 (Builder Stabilization). No new screens, states,
  or architecture — usability fixes to the existing, now-frozen Builder
  only. Adds the "Toolbar reuses the real Runtime engine" section
  (Preview renders through the real `slideRenderer.js`/`builder.js`,
  Save/Duplicate/Delete are real, no dead header controls remain) and
  the "Publish installs the built package via the same import path
  Runtime already trusts" section ("Official World" renamed to "Publish
  to Official Themes," now genuinely calls `ThemeRegistry.importPackage`
  via same-origin `localStorage` instead of duplicating Export Package's
  behavior). Fixes the Overview state's Representation-selection bug
  (`_showsRepresentationPreview()` — Overview now consumes the shared
  `currentRepresentationId` state instead of never reading it). Every
  Workspace state gained a concise guidance intro; the Assets state's
  slot rows now show Purpose/Dimensions/Aspect Ratio/Formats/Max Size
  sourced from `assetSpec.js`; Validation messages gained a "Why" line
  and, where actionable, a "Fix Now" button that navigates straight to
  the offending state; the Build state's success view now shows Package
  Name/Size/Timestamp and a "Continue to Publish" action.
