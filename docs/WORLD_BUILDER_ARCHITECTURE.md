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

### LOCK 02 — The Builder owns Projects; Studio consumes Published Themes

```
Builder Project
   ↓ editable
Builder
   ↓ build
Published Theme
   ↓
Studio
```

A **Builder Project** is Builder-owned, mutable, and has no meaning to
Studio. A **Published Theme** — installed into a Repository by Publish,
or a portable `.vtheme` produced by the separate Export operation — is
Runtime-owned, immutable once built, and has no editable state — Studio
never mutates a Published Theme in place. Nothing ever holds both roles
at once. (Terminology locked by the Platform Hardening Closure Sprint —
see `docs/THEME_REPOSITORY_ARCHITECTURE.md` §11 for the full Publish vs.
Export contract this diagram now reflects.)

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
Screen 2 happens inside it. It is one screen, never a sequence of pages.
Sprint B2.0.3 introduced Working View + Runtime Preview; Sprint B2.0.4
(Workspace Ergonomics) rearranged the same four regions into a CSS Grid
so the Inspector — "where creators spend most of their time," per that
sprint's own framing — is no longer squeezed into a narrow column
shared with Runtime Preview. Still the same one screen, no new physical
screen, no new region:

```
┌─────────────────────────────────────────────────────────┐
│ Header — World Name · Draft Saved · Settings/Save/⋮      │
├───────────┬───────────────────────────────┬─────────────┤
│           │                               │  Runtime    │
│ Builder   │        Working View           │  Preview    │
│ Navigation│  (context-aware, + guide      │ (always,    │
│  (spans   │        overlays)              │ no guides)  │
│   both    │                               │             │
│   rows)   ├───────────────────────────────┴─────────────┤
│           │              Inspector                       │
│           │   (the primary editing surface — full        │
│           │    width, independent scroll, paired          │
│           │    fields where related — Sprint B2.0.4)      │
└───────────┴───────────────────────────────────────────────┘
```

- **Header** — shows the World Project's own `manifest.json` name (never
  the template it was created from — the Builder edits a World Project,
  not a Template) and a Draft Saved status. Settings/Save/overflow menu
  are all real (Sprint B2.0.1); the header's own Preview button was
  removed in Sprint B2.0.3 once Preview became two permanently-visible
  surfaces instead of an on-demand modal — see below.
- **Builder Navigation** (left) — a fixed list of nine states: Overview,
  Representations, Layouts, Frames, Layer Packs, Assets, Validation,
  Build, Publish. Selecting one never opens a new page — it only swaps
  which state is active, exactly like VihuStudio Studio's own object
  selection model (`docs/STUDIO_DESIGN_CANON.md` §7). Spans the full
  height of both grid rows (Sprint B2.0.4's `.wb-workspace-body` grid),
  so it stays present and fixed regardless of what's being edited.
- **Working View** (top-center) — permanent; never disappears, regardless
  of which Navigation state is active, and never scrolls (Sprint B2.0.4 —
  its canvas now scales by *height* first, the same fit-to-viewport
  technique the old Preview modal used, since its grid row is a fixed
  percentage of the Workspace's height rather than "however much the
  column needs"). Renders through VihuStudio's own real
  `renderer/slideRenderer.js` (the same engine Runtime uses — see
  "Working View and Runtime Preview reuse the real engine" below), with
  Builder-only guide overlays drawn on top in DOM for the Layouts state.
  Overview is the one exception: it isn't editing a rendered page at all
  (World identity has no Slide concept), so it keeps a small identity
  card instead.
- **Runtime Preview** (top-right) — permanent, never scrolls; the same
  render Working View shows, with zero overlays, answering "what will
  the reader see?" Replaces the pre-B2.0.3 on-demand Preview modal.
  Sprint B2.0.4 gave it its own grid cell — previously it sat *above* the
  Inspector in a shared right-hand column, competing for the same
  vertical space; now the two are full siblings in the Workspace grid,
  and neither can push on the other.
- **Inspector** (bottom row, spanning under both Working View and Runtime
  Preview, `#wb-context-panel`) — exactly one mount point, reused by
  every Navigation state; still never spawns a second panel or a dialog.
  Sprint B2.0.4 made it the Workspace's primary surface: full width
  instead of a ~340px shared column, and the *only* region allowed to
  scroll (Working View/Runtime Preview explicitly never do). Panels with
  several short, related fields now pair them side by side via a new
  `_fieldRow()` helper (Layouts: Aspect|Composition, Padding|Spacing,
  Caption Position|Alignment; Frames: Thickness|Padding, Inset|Corner
  Radius, Border Color|Wall Tone, Shadow|Default Margin; Representations:
  Default Layout|Default Frame; Overview: Publisher|Version,
  Purpose|Mood) — the pre-existing `.wb-field-row` CSS class from Sprint
  B1.1 had never actually been wired up to anything until now.

### Working View and Runtime Preview reuse the real engine (Sprint B2.0.3)

Both surfaces call the exact same `window.SlideRenderer.render(s)` —
one function, two target canvases — fed by one synthetic slide object
`_buildPreviewSlide()` builds per render. There is no second, Builder-
owned rendering implementation; Working View's guide overlays are a
separate DOM layer drawn *after* the canvas render, never touching the
canvas pixels themselves, which is exactly why Runtime Preview (a second
`render()` call against a different canvas, no overlay pass) never shows
them.

Because every edit must re-render with **no Save/Build/Validate step**,
neither surface can afford the heavier, Blob/FileReader-based
`ProjectCompiler`/`builder.js` pipeline Validate/Build use (see below) —
that path is correct for a one-shot compile, not for continuous
per-keystroke re-rendering. Instead, `worldBuilderApp.js` computes a
*lightweight* live theme synchronously: `_collectFolderLight` mirrors
`builder.js`'s own `collectFolder()` flattening rule (a folder's `.json`
files each hold one object or an array; flatten to one array either way)
by reading `project.files` directly — already-parsed JS values in
memory, no Blob round trip — and `_buildLiveManifest`/`_buildLiveTheme`
mirror `buildManifest()`/`buildTheme()`'s merge rules exactly. Same
rules, computed cheaply; Validate/Build still run the real,
unmodified services for the one-shot compile that actually matters for
correctness.

A generic Sample Artwork image (drawn once into an offscreen canvas,
cached as a real `Image`) and generic sample metadata (title/artist/
age/date/caption/quote/attribution — `SAMPLE_METADATA`) are fed into
every render, so Layout/Frame/Representation editing always has
something to look at even before a creator uploads real artwork or
authors a real caption Layer. Neither is ever part of the Project or the
compiled Package.

See `docs/AUTHORING_FINDINGS.md` (Sprint B2.0.3 section) for what this
did and did not make visually change, including the honest limits of
Working View's guide overlays where the Runtime contract itself has no
equivalent concept yet (Layout's Padding/Spacing/Alignment/Caption
Position fields).

### The Workspace is one CSS Grid, not nested flex columns (Sprint B2.0.4)

`.wb-workspace-body` is a single `display:grid` with named areas
(`nav`/`working`/`runtime`/`inspector`) rather than the Sprint B2.0.3
arrangement of nested flex columns (a right-hand column whose own two
flex children were Runtime Preview and the Inspector). Nav spans both
grid rows; the top row splits between Working View and Runtime Preview;
the bottom row is the Inspector alone, spanning both of the top row's
columns. This is what actually decouples Runtime Preview from the
Inspector — they are full siblings in the grid, so nothing about the
Inspector's height (however long a panel's form gets) can push on
Runtime Preview, and nothing about Runtime Preview's width can shrink
the Inspector.

Making Working View and Runtime Preview literally never scroll — a
named acceptance criterion — required switching their canvases from a
*width*-first fit (`width:100%; max-width:420px; aspect-ratio:...`,
correct when the column had as much height as it needed) to a
*height*-first fit (`height:100%; max-width:100%; aspect-ratio:...`,
the same technique the Sprint B2.0.2 Preview modal used to guarantee no
scrollbar), since both regions are now a fixed percentage of the
Workspace's height (`grid-template-rows: 40% 60%`) rather than sized to
their content. A guide-label positioning bug surfaced by this: Working
View's guide labels (Sprint B2.0.3) rendered *above* their guide box by
default, relying on the column having enough surrounding padding for
that overflow to stay visible — true when Working View owned the whole
right-hand column's height, false in the new, shorter top row, where
the label would clip against `.wb-working-canvas-wrap`'s own
`overflow:hidden`. Fixed by moving every guide label inside its box's
own top (or bottom, for the Padding guide) edge instead of floating
outside it — a purely cosmetic change, no guide geometry logic touched.

### Workspace Polish — edge-to-edge, correct aspect ratio, Draft Management (Sprint B2.0.5)

Sprint B2.0.5 is a visual-polish sprint on top of Sprint B2.0.4's grid —
no new screens, no Workspace states, no rendering pipeline change. Real
authoring surfaced two genuine defects and one missing capability.

**The `#wb-root` ancestor-padding bug.** `#wb-root` (wrapping all three
Screens) carried `max-width:1080px; margin:0 auto; padding:48px 32px
96px;` intended for Screens 1–2's comfortable reading-column layout. The
Workspace (`.wb-screen-workspace`, `height:100vh`) inherited it too —
and because `100vh` is viewport-relative, independent of an ancestor's
padding, the Workspace's own fixed height plus its parent's 144px of
vertical padding together overflowed the true viewport, while the 64px
of horizontal padding stole width from every Workspace region. This was
the single largest contributor to "excessive whitespace" / "not
edge-to-edge." Fixed by moving that padding/max-width/margin onto
`.wb-screen-welcome, .wb-screen-templates` specifically — the two
screens that actually want it — leaving `#wb-root` as bare
`min-height:100%`. The Workspace now measures exactly `0,0,<viewport
width>,<viewport height>`.

**The flex + aspect-ratio distortion bug.** Working View's and Runtime
Preview's canvas-wrap elements combined `flex:1` (which resolves a
definite main-axis size — height, in a column flex container — via
flex-grow) with `aspect-ratio` and `max-width:100%` on the same element.
When `max-width` later became the binding cross-axis constraint, the
browser did not retroactively shrink the already-flex-resolved height to
match — a real, measurable distortion (Runtime Preview measured ratio
1.573 against a correct 1.25; Working View happened to escape the bug
only because its wider column never triggered the `max-width` clamp).
Fixed with the same two-layer technique the Sprint B2.0.2 Preview modal
already used: an outer plain `flex:1` sizing container (no
`aspect-ratio`, just `display:flex; align-items:center;
justify-content:center; overflow:hidden;`) wrapping a new inner box
(`.wb-working-canvas-inner` / `.wb-runtime-preview-canvas-inner`) that
alone carries `width:auto; height:auto; max-width:100%; max-height:100%;
aspect-ratio:1080/1350;` plus the visual styling (radius/shadow/
background). Splitting the sizing role from the aspect-locking role
across two elements is what lets the browser's standard
fit-within-both-constraints algorithm apply correctly. `index.html`
gained the corresponding wrapper `<div>`s; canvas element ids are
unchanged, so no JS changed.

**Space reallocation.** `.wb-workspace-body`'s grid columns moved from
Sprint B2.0.4's implicit split to explicit `170px 1fr 380px` (Nav /
Working View / Runtime Preview), and rows from `40% 60%` to `64% 36%`
(top row / Inspector) — Nav shrinks to what its icon+label+padding
actually need, and the reclaimed width/height goes to Working View and
Runtime Preview per the sprint's explicit P0 priority, not split evenly.
Inspector's row-height share shrank in the process, but its architecture
(full-width, beneath both, independently scrollable) is unchanged — it
remains fully usable at any height since it was already the one region
allowed to scroll. Padding/gap values were tightened throughout Nav,
Working View, Runtime Preview, and Inspector (each by a few px, not
rearchitected) as the "reduce gutters" P0 item.

A container being the largest and most prominent *region* of the screen
is not the same claim as its rendered *page* filling that region
edge-to-edge — a portrait page (0.8:1) inside a wide container can only
do the latter through distortion or cropping, both explicitly
prohibited by the ticket ("Do NOT simply stretch," "Do not distort
aspect ratios"). Working View satisfies "the largest visual region" by
being the widest column on screen; the empty horizontal margin around
its smaller portrait page is the same relationship Figma's own canvas
has to a smaller artboard — not a defect.

**Draft Management.** The Welcome screen's project cards previously had
no way to Rename, Duplicate, or Delete a draft — the only way to "start
over" was manually clearing `localStorage`. All three actions reuse
existing, already-real functions rather than adding new persistence:
`ProjectModel.setIdentity(project, {name})` (the same function Overview's
own World Name field already calls) for Rename; `ProjectStore.duplicate()`
/ `ProjectStore.remove()` (both shipped in Sprint B2.0.1 for the
Workspace header's overflow menu, just never exposed on the Welcome
screen) for Duplicate/Delete. `window.prompt()`/`window.confirm()` are
used for the same reason the header's own Delete already uses
`window.confirm()` — a consistent, zero-new-infrastructure pattern.
Because `ProjectStore.remove()` only ever touches `ProjectStore`'s own
`localStorage` key — a Builder-only draft record — it has no code path
that can reach `ThemeRegistry`'s imported-themes key, `official-worlds/`,
`themes/`, or a downloaded `.vtheme` file; those are architecturally
separate persistence layers that were never wired together, so "never
delete a published World" holds by construction, not by an added guard.
The project card itself changed from a `<button>` to a `role="button"`
`<div>` (with a matching `keydown` handler for Enter/Space) since a
native button cannot legally contain the three new nested action
buttons — the same pattern already used for Frame/Layout list rows,
each of whose own controls call `e.stopPropagation()` so a control click
never also triggers the row's open action. Widening the card grid's
`minmax()` floor from 220px to 320px was a companion fix: the original
220px card had no button-shaped content in it, so the exact same
`repeat(auto-fill, minmax(...))` value collapsed the name column to
a few pixels and overlapped it with the new controls once they were
added — a real, verified-via-screenshot layout defect, not a subjective
tightening choice.

### Property Editor grouping, Editing Confidence, and Workspace Customisation (Sprint B2.0.6)

Sprint B2.0.6 is the Workspace's final maturity pass before it freezes —
no new screens, no new states, no architecture change. It turns the
Inspector into a genuine Property Editor and gives the Workspace two
capabilities real authoring had been missing: an honest save-state
indicator, and creator-adjustable region sizes.

**Property Editor grouping.** Every state's field order was re-paired to
match related fields side by side instead of one field per row —
Overview (World Name|Tagline, Publisher|Version, Purpose|Mood,
Thumbnail|Hero Image as upload cards, Description last since it's the
only multiline field), Representations (Name|Default Layout, Default
Frame|Layer Pack, Supported Actions, Description), Layouts (Layout
Name|Aspect, Composition|Caption Position, Padding|Spacing,
Alignment|Used By — "Used By" is a new compact readout of the same
reuse data the Layout list already showed per row, now also visible in
the Selected Layout detail per the sprint's own property grid), Frames
(Frame Name|Wall Tone, Border|Corner Radius, Shadow|Inset,
Padding|Margin, Thickness alone since nothing pairs with it,
Description last), and the Layer Packs' Selected Layer form
(Type|Target Container, Anchor|Position, Offset X|Offset Y — Visibility
and Lock were already inline icon buttons on each Layer List row, not
stacked fields, so they already satisfied "avoid long vertical forms"
before this sprint). Every pairing uses the pre-existing `_fieldRow()`/
`_buildFieldGroup()` machinery from Sprint B2.0.4 — no new field-layout
mechanism, only different field-to-row assignments.

**Assets became upload cards.** `_renderAssetsPanel`'s per-category
slots now render into a `.wb-asset-card-grid` (a real CSS grid,
`repeat(auto-fill, minmax(190px,1fr))`) instead of a single stacked
column of full-width rows; `_assetSlotRow` was rebuilt from a horizontal
row into a vertical card (thumb on top, name/badge, purpose, a
condensed one-line spec summary, status, upload button) so several fit
side by side. Every value shown is still read straight off
`AssetSpec.resolve()`'s own slot object — no duplicated spec data, just
a different layout for the same information.

**Build and Publish became compact cards.** Build's two info boxes
(Output File/Version/Last Validation; Package Name/Size/Timestamp) were
stacked `<p><strong>` lines; a new shared `_statCardGrid()` renders them
as a grid of small `.wb-build-stat` cards instead. Publish's three
options (Export Package/Community World/Publish to Official Themes)
now sit in a `.wb-publish-grid` instead of stacked full-width rows —
same three buttons, same handlers, just arranged as a grid of vertical
cards.

**Builder Information Density.** The Sprint B2.0.1 What/Why/Do/Next
guidance block, previously always-visible above every state's fields,
is now a native `<details>`/`<summary>` (`_stateIntro()`) — collapsed by
default, one click away, no JS toggle logic needed since the browser
already handles open/closed state correctly. Short single-purpose status
banners ("Previewing:", "Current Representation:") were split into a
separate, always-visible `.wb-info-banner` class so they're not
mistakenly treated as collapsible guidance.

**Editing Confidence — Dirty/Saved state.** The static "Draft Saved"
label is replaced by a real two-state indicator (`_setSaveState()`):
🟠 "Unsaved Changes" the instant `_persist()` is called (i.e. the moment
an edit's handler runs, before the write), 🟢 "All Changes Saved" once
it settles. There is deliberately no separate "Saving…" sub-state: the
actual write (`ProjectStore.save()`, a synchronous `localStorage` call)
always happens immediately inside `_persist()` — never debounced —
because deferring the real write risks losing an edit if the creator
navigates away before a debounce timer fires. What *is* debounced
(600ms) is only the visible return to "saved," so rapid typing shows one
continuous "Unsaved Changes" instead of flickering on every keystroke,
while the data is already safe in `localStorage` the whole time. The
Header Save button gets a matching `wb-save-btn-dirty` ring so the
button itself, not just the badge, communicates state; clicking it still
performs the same explicit, user-visible confirmation Sprint B2.0.1
gave it.

**Workspace Customisation — resize handles.** `.wb-workspace-body`'s
grid gained three 6px sash tracks (`navsash`/`rtsash`/`tbsash`,
`grid-template-areas` unchanged in region names — see the diagram in
"The Workspace is one CSS Grid" above, now with sash columns/rows
threaded through it) carrying real, draggable handle elements
(`#wb-resize-nav`/`#wb-resize-runtime`/`#wb-resize-inspector`). Each
handle only ever writes one CSS custom property
(`--wb-nav-w`/`--wb-runtime-w`/`--wb-inspector-h`) via a shared
`_wireResizeHandle()` mouse-drag driver — because the handles are real
grid tracks (not absolutely-positioned overlays recomputed after every
render), they can never drift out of sync with the panel boundary they
drag. Nav clamps to [180,280]px; the Working View ↔ Runtime Preview
handle clamps Runtime Preview's width to [25%,65%] of the combined
Working+Runtime space (Working View, styled `1fr`, always takes
whatever's left, so its own effective minimum is the complementary
35%); the Inspector's height clamps to [220px, 65% of viewport height].
The layout persists to one Builder-wide `localStorage` key
(`vihustudio.worldBuilder.workspaceLayout`, deliberately not per-Project
— it's a creator's workspace preference, not World data) and is
reapplied via `_applyWorkspaceLayout()` every time a Workspace opens.
"Reset Workspace Layout," a new item in the header's three-dot menu,
clears that key and reapplies the shipped defaults immediately, no
reload required.

Verified via a new 34-assertion Playwright suite covering every
re-paired field row, the collapsed-by-default/opens-on-click guidance
panel, the full dirty→saved cycle (including that the edit is actually
in `localStorage` throughout, proving the debounce never risks data
loss), all three resize handles (drag direction, clamping, persistence
across a Workspace reopen), Reset Workspace Layout, the Assets/Build/
Publish grid layouts, and that Sprint B2.0.5's Draft Management is
unaffected — plus full regression across every prior sprint's suite and
`goldenBuild.js`.

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
separate "Save" action for Project data; the Header's Save button
(Sprint B2.0.1) is a real, explicit confirmation that nothing is
pending, not a second save mechanism.

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

### Authoring feedback from the first Museum Gallery pass (Sprint B2.0.2)

Producing Museum Gallery through the Builder end-to-end (Sprint B2.0)
surfaced usability gaps a real authoring session exposes that
unit-level testing doesn't. None of these change the Builder's three
screens, its nine Workspace states, or any World Project/Package
contract — they are fixes to the existing surfaces only.

**World Id is now read-only.** It was previously a free-text field that
silently re-slugified whatever was typed — inviting a creator to rename
it after other data (Representations, links) already depended on the
original value. `manifest.id`/`theme.id` are auto-generated once, at
Project creation (`templates.js`'s `_slug(name) + '-' + _uid()`), and
Overview now only ever displays them (`_readOnlyField`), never edits
them. **The Icon field was removed** for the same reason in reverse —
it was free-text emoji entry with no real identity purpose beyond a
list-row fallback glyph; per this sprint's instruction, a future visual
Icon (from Category, or an uploaded Asset) replaces it rather than
reintroducing free text.

**The Preview modal (Sprint B2.0.1) was showing real Story-runtime
chrome that has nothing to do with the World being authored.** Its
synthetic slide object left `handle`/`bookTitle` empty and
`themeOptions` null, which — with no `ThemeEngine` loaded in the
Builder's page — resolved to `renderer/slideRenderer.js`'s own
`FALLBACK_OPTIONS` (`bookTitleVisibility:'show'`, `pageNumber:
'bottom-right'`, `handleVisibility:'show'`), and an empty handle string
falls through to the renderer's own hardcoded placeholder branding text,
`'@vihuplanet'` (`_drawHandle`, line ~1885). The result: every World's
generic sample page showed an unrelated page number, a footer named
after the World itself (not a book title), and a stray `@vihuplanet`
watermark — three pieces of Story-runtime furniture invented by the
renderer's own fallbacks, not authored by the World. The fix passes an
explicit `themeOptions` object with `bookTitleVisibility:'hide'`,
`pageNumber:'hidden'`, `handleVisibility:'hide'`, so the Preview shows
only what the World itself defines — Frame, Layout, Layer Pack — a
genuinely generic sample page, matching the Preview Contract: "what
would this World look like if used right now?"

**The Preview modal no longer scrolls.** `.wb-preview-modal-box` is a
fixed `88vh` height; `.wb-preview-modal-body` is a flex column where a
new `.wb-preview-canvas-wrap` (flex:1, min-height:0) claims exactly the
space left after the header and the note text, and the canvas scales
within that wrapper (`height:100%` + `aspect-ratio` + `max-width:100%`)
rather than against the whole body — so the canvas always shrinks to
fit, on any viewport, with `overflow:hidden` on the body guaranteeing no
scrollbar ever appears.

**Layouts now show a "Current Representation" banner.** Layouts are a
shared, reusable resource — any Representation can reference the same
Layout via its Default Layout field — so this banner reads the same
`currentRepresentationId` every other state already uses (no new
selection model) rather than claiming an ownership relationship that
doesn't exist. Whether Layout should eventually become a
per-Representation concept, or Representation should collapse into
Layout, is intentionally left open — see "Open authoring findings"
below.

**Representations' Layer Pack field explains why "Basic" exists.**
Every new World Project starts with one Layer Pack (named "Basic") so a
Representation always has a valid default to point at (`docs/
WORLD_PROJECT_CONTRACT.md`'s "born valid" guarantee, LOCK 03) — the
field's help text now says so directly, instead of just naming what a
Layer Pack is.

#### Open authoring findings (not resolved this sprint)

- **A-005 — Representation vs. Layout relationship.** Today a Layout is
  independent, reusable geometry; a Representation merely points at one.
  Whether that's the right mental model, or whether Layouts should
  become owned by a single Representation, needs more Official Worlds
  authored before deciding — changing it now on one data point (Museum
  Gallery) would be premature.
- **A-006 — Representation's own value.** Whether "Portrait" (currently
  a Representation) should instead be modeled as a Layout, once more
  Official Worlds exist to compare against, is likewise left open.

Neither finding changes any code or contract this sprint; both are
recorded here so the next Official World's authoring pass has them in
view.

#### Future vision (explicitly out of scope)

A **Visual Theme Composer** — interactive page anatomy, click-to-edit
page layers, a fully creator-centric Builder — is the long-term
direction discussed alongside this sprint's feedback, but is
deliberately not started here. This paragraph exists only so the
direction is on record; no B2.x sprint should treat it as implied scope.

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
- v2.2 — Sprint B2.0.2 (Museum Gallery Authoring Feedback). Real-world
  authoring feedback from producing the first Official World; no new
  screens/states/contracts. World Id is now read-only (auto-generated
  at Project creation, never editable); the free-text Icon field is
  removed. The Preview modal's synthetic slide no longer resolves to
  `slideRenderer.js`'s own Story-runtime fallbacks — an unset handle no
  longer falls through to the renderer's hardcoded `'@vihuplanet'`
  placeholder, and footer/page-number are explicitly hidden via
  `themeOptions`, so Preview shows only what the World itself defines.
  The Preview modal's CSS was restructured (a new `.wb-preview-
  canvas-wrap` flex child) so it always fits the viewport with no
  scrollbar, on any screen height. Layouts gained a "Current
  Representation" banner (reusing the existing shared
  `currentRepresentationId`, no new selection model) since a Layout is
  reusable across Representations and creators had no way to know whose
  context they were editing in. Representations' Layer Pack field now
  explains why every new World starts with a Layer Pack named "Basic."
  Two authoring findings (Representation-vs-Layout relationship;
  whether "Portrait" belongs as a Layout instead) are recorded as open,
  deliberately unresolved pending more Official Worlds to compare
  against; a future Visual Theme Composer is noted as out of scope.
- v2.3 — Sprint B2.0.3 (Working View + Runtime Preview). Replaces the
  illustrative DOM-mockup Live Preview and the on-demand Preview modal
  with two permanently-visible surfaces that both render through the
  real `renderer/slideRenderer.js` — Working View (center, context-aware,
  Builder-only guide overlays) and Runtime Preview (right column,
  always-clean). Adds a lightweight, synchronous live-theme resolver
  (`_collectFolderLight`/`_buildLiveManifest`/`_buildLiveTheme`) so every
  edit can re-render with no Save/Build/Validate step, mirroring
  `builder.js`'s own merge rules without its Blob/FileReader overhead.
  Adds generic sample artwork/caption/metadata so Layout/Frame/
  Representation editing always has something to show. Layouts gained
  guide overlays (Holder Boundary, Caption Area, Safe Margin, Padding,
  Alignment line, a caption-position-aware sample caption) and an
  automatic Aspect↔Composition lock that makes the invalid "Quote aspect
  without Quote composition" combination unreachable through the UI
  instead of merely warning about it; the Layout list gained "Used By."
  Introduces `docs/AUTHORING_FINDINGS.md`, splitting what real authoring
  surfaces into Builder Issues (fixed) and Future Product Insights
  (documented only, not implemented) — most notably that Layout's
  Padding/Spacing/Alignment/Caption Position fields have no effect on
  the real Runtime render today, a gap Working View's overlays make
  honest rather than hide. Verified via a new 35-assertion Playwright
  suite plus full regression across every prior sprint's suite.
- v2.4 — Sprint B2.0.4 (Workspace Ergonomics). Layout-only sprint — no
  Builder logic, rendering, contracts, Project model, Runtime,
  Validation, Build, or Publish changes. Real authoring exposed that
  Sprint B2.0.3's Runtime Preview shared a column with the Inspector,
  starving the Inspector of usable width as more Builder options were
  added. `.wb-workspace-body` becomes one CSS Grid (`nav`/`working`/
  `runtime`/`inspector` named areas) instead of nested flex columns: Nav
  spans both rows; the top row splits Working View (center) and Runtime
  Preview (right); the bottom row is the Inspector alone, spanning the
  full width beneath both. Working View and Runtime Preview switch from
  width-first to height-first canvas fitting (mirroring the Sprint
  B2.0.2 Preview modal's own fit-to-viewport technique) so neither ever
  scrolls now that each is a fixed percentage of the Workspace's height;
  fixes a guide-label clipping bug this surfaced (labels floating above
  their guide box, fine when Working View owned a whole column's height,
  clipped once it didn't). A new `_fieldRow()`/`_buildFieldGroup()` pair
  wires up the previously-unused Sprint B1.1 `.wb-field-row` CSS class
  to pair short, related fields side by side in Layouts, Frames,
  Representations, and Overview. Verified via a new 25-assertion
  Playwright suite plus full regression across every prior sprint's
  suite (all passing unchanged).
- v2.5 — Sprint B2.0.5 (Builder Workspace Polish). Visual-polish and
  Draft Management sprint — no new screens, no architecture change.
  Fixes two real, measured CSS defects: the `#wb-root` ancestor-padding
  bug (the always-`100vh` Workspace was rendered inside 144px of dead
  vertical and 64px of dead horizontal padding meant only for Screens
  1–2's reading-column layout, the largest single contributor to
  "excessive whitespace"), and a flex+`aspect-ratio` distortion bug in
  Working View's and Runtime Preview's canvases (combining `flex:1` with
  `aspect-ratio`+`max-width` on one element let `max-width` clamp width
  without retroactively correcting the already flex-resolved height;
  fixed with the same outer-sizing/inner-aspect-locked two-layer split
  the Sprint B2.0.2 Preview modal already used). Rebalances
  `.wb-workspace-body`'s grid to `170px 1fr 380px` columns / `64% 36%`
  rows, giving Nav only what its icon+label+padding need and the
  reclaimed space to Working View/Runtime Preview per the ticket's P0
  priority; Inspector's architecture (full-width, beneath both,
  independently scrollable) is unchanged. Adds basic Draft Management to
  the Welcome screen's project cards — Rename/Duplicate/Delete, each
  reusing an existing function (`ProjectModel.setIdentity`/
  `ProjectStore.duplicate`/`ProjectStore.remove`) rather than adding new
  persistence, with Delete architecturally incapable of touching a
  published Official Theme or exported `.vtheme` since those live in
  entirely separate persistence layers; the project card changed from a
  `<button>` to a `role="button"` `div` so it can legally contain its
  own nested action buttons, and the card grid's `minmax()` floor widened
  from 220px to 320px to fix a real overlap the new controls caused at
  the old width. Verified via a new 20-assertion Playwright suite plus
  full regression across every prior sprint's suite (all passing
  unchanged).
- v2.6 — Sprint B2.0.6 (Property Editor + Editing Confidence + Workspace
  Customisation). The Workspace's final maturity pass — no new screens,
  no new states, no architecture change; this sprint freezes the
  Workspace. Every state's fields were re-paired into a genuine property
  grid (Overview, Representations, Layouts, Frames, and the Layer Packs
  Selected Layer form all gained new side-by-side field pairings — see
  "Property Editor grouping" above for the exact pairs); Assets moved
  from stacked full-width rows to a real `.wb-asset-card-grid`; Build's
  info boxes and Publish's three options both moved from stacked
  elements to compact card grids via a shared `_statCardGrid()`/
  `.wb-publish-grid`. The Sprint B2.0.1 guidance block is now a native
  `<details>`, collapsed by default. Replaces the static "Draft Saved"
  label with a real two-state 🟠 Unsaved Changes / 🟢 All Changes Saved
  indicator (`_setSaveState()`) — the underlying `localStorage` write
  stays synchronous and immediate inside `_persist()` (never debounced,
  so a quick navigate-away can never lose an edit); only the *visible*
  return to "saved" debounces 600ms so continuous typing doesn't flicker
  the indicator. Adds three real CSS-grid resize handles (Nav↔Working
  View, Working View↔Runtime Preview, Top Workspace↕Property Editor),
  each writing one CSS custom property with its own clamp range, backed
  by one Builder-wide `localStorage` key and a new "Reset Workspace
  Layout" item in the header's three-dot menu. Verified via a new
  34-assertion Playwright suite (every field pairing, the collapsed/
  expandable guidance panel, the full dirty→saved cycle with a
  `localStorage` data-loss check, all three resize handles including
  drag direction/clamping/cross-reopen persistence, Reset Workspace
  Layout, the Assets/Build/Publish grids, and that Sprint B2.0.5's Draft
  Management still works) plus full regression across every prior
  sprint's suite and `goldenBuild.js`.
