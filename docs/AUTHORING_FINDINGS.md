# Authoring Findings

**Scope:** A living log of usability gaps and platform observations
surfaced by actually *using* World Builder to author a World — as
distinct from `docs/WORLD_BUILDER_ARCHITECTURE.md` (how the Builder is
built) and `docs/WORLD_PROJECT_CONTRACT.md`/`docs/THEME_PROJECT_SPEC.md`
(what a World Project/Package must contain). This document records what
authoring *felt* like, split into two kinds of finding:

- **Builder Issues** — real usability gaps fixed (or fixable) inside
  the Builder itself, with no World/Runtime contract change required.
- **Future Product Insights** — observations that would require a
  Runtime or World Project Contract change, a larger architectural
  decision, or more Official Worlds authored before deciding. These are
  **documented only, never implemented** on the strength of one
  authoring pass — see each sprint's own "do not implement" scope.

Per-sprint sections are appended in order; nothing here is retroactively
rewritten, only added to.

---

## Sprint B2.0.3 — Working View + Runtime Preview

### Builder Issues (fixed this sprint)

**The old Preview button/modal was a one-shot, on-demand surface; the
Builder is now two continuously-synced surfaces.** Before this sprint,
seeing a real render meant clicking "Preview," waiting for a heavier
compile (`ProjectCompiler.loadIntoProjectLoader` → `builder.js`'s
Blob/FileReader-based `packageTheme()`), and looking at a modal that
closed the moment you wanted to keep editing. Now the Workspace has a
permanent **Working View** (center — context-aware, shows Builder-only
guide overlays) and **Runtime Preview** (right column — always visible,
guide-free, literally "what the reader will see"), both re-rendered on
every edit with no Save/Build/Validate step. Making this fast enough to
re-run per keystroke required a second, *lightweight* theme resolver —
`_collectFolderLight`/`_buildLiveManifest`/`_buildLiveTheme` in
`worldBuilderApp.js` — that mirrors `builder.js`'s own
`buildManifest()`/`buildTheme()` merge rules exactly but reads
`project.files` directly (already-parsed JS values) instead of round-
tripping through Blobs. This is *not* a second interpretation of "what
the compiled theme looks like" — it is the same merge rules, computed
synchronously because the heavier path is provably too slow for
continuous live authoring. Validate/Build still use the original,
unmodified `ProjectCompiler`/`builder.js` path, since that one-shot
compile is exactly where the real validator belongs.

**Sample content was entirely missing.** Editing a Layout/Frame/
Representation with no artwork placed and an empty default Layer Pack
rendered a blank Holder and no caption at all — nothing to visually
judge. A generic Sample Artwork image (drawn once into an offscreen
canvas and cached as a real `Image`) and generic sample metadata
(`artworkTitle`/`artist`/`age`/`date`/`caption`/`quoteText`/
`quoteAttribution` — see `SAMPLE_METADATA` in `worldBuilderApp.js`) are
now always fed into both surfaces. Never part of the Project, never
exported.

**Layout editing had five fields that silently updated data with no
visible feedback** (Composition, Caption Position, Padding, Spacing,
Alignment). Composition and (indirectly) Aspect are real Runtime
contract fields, so feeding them into the live-rendered slide alone
made them visibly change both surfaces. Caption Position/Padding/
Alignment are not consumed by the Runtime at all (see the Future
Product Insight below) — these now drive Working-View-only guide
overlays (`_renderWorkingOverlays`): a Padding inset box, an Alignment
guide line, and a sample-caption placeholder that moves per Caption
Position. Honestly labeled as Builder-only annotations, not implied to
be literal Runtime behavior.

**"Must be Quote for a Quote-aspect Layout to render correctly" was a
warning about a reachable invalid state, not a preventer of it.** Aspect
and Composition now stay in lockstep automatically: setting Aspect to
`quote` forces Composition to `quote` and disables that selector (there
is nothing else valid to choose); leaving `quote` resets Composition to
`below`. The invalid combination is no longer reachable through the UI,
so the warning text was deleted rather than reworded.

**Layout Library gained "Used By."** Each Layout row now lists every
Representation whose Default Layout points at it (or "Not used by any
Representation yet"), making Layout reuse visible without opening each
Representation individually.

### Future Product Insights (not implemented — documented only)

**Layout's Padding/Spacing/Alignment/Caption Position fields have no
effect on the real Runtime render.** `renderer/slideRenderer.js` never
reads `layout.padding`/`layout.spacing`/`layout.alignment`/
`layout.captionPosition` anywhere — they are, and always have been,
Builder-only data with no corresponding Runtime concept. This sprint
made them visibly affect the *Working View* (honestly, via overlays
that are never mistaken for the real render, since Runtime Preview sits
right beside it showing no change), but did not — and per this sprint's
explicit "no Runtime contract changes" instruction, could not — make
them affect Runtime Preview or the actual published page. Two paths
forward, neither decided here: (a) the Runtime/World Project Contract
grows a real caption-layout concept these fields feed (a Slide→Frame→
Holder→Element-shaped addition, matching the existing containership
model), or (b) the Builder stops presenting them as independently
authorable until it does, since right now a creator can carefully tune
values that visibly do nothing once published.

**Composition's "Below" vs "Right" only visibly differ when the active
Layer Pack actually draws a caption.** Every starter template ships an
empty default "Basic" Layer Pack (`layerPack: []` in `templates.js`).
With no caption-drawing Layer authored, `below` and `right` composition
render pixel-identical (both only affect *where* a caption would sit,
and Below's own "caption rect" isn't even a real, independent Runtime
concept — see above). This isn't a Working View bug; it's a real
authoring-order dependency worth surfacing to a first-time creator
("Composition won't look different until you add a caption Layer") that
the Builder does not currently explain anywhere.

**Working View's "Caption Area" for the default (Below) composition is
a Builder-only illustrative approximation**, not derived from the real
per-Layer anchor math the Layer Engine actually uses (a caption Layer
anchors to wherever its own `anchor`/`offset` fields say, not to one
fixed rect). Only the "Right" composition has a genuine, renderer-
resolved caption rect (`SlideRenderer.getCaptionRect`). A future
iteration could resolve the *actual* position of the active Layer
Pack's caption-sourced Layer(s) instead of guessing a fixed band, but
that requires the Working View overlay logic to become Layer Pack-aware,
which this sprint's scope didn't require.

**Per-state Working View highlighting beyond Layouts is unbuilt.** This
sprint's ticket described Working View as context-aware with
illustrative examples per state (Overview: Hero/Thumbnail; Frame:
Border/Mat/Shadow/Corner Radius; Layer Pack: Image/Text/Decoration
Layers; Assets: the slot being configured) but its concrete P0/P1
requirements were scoped to Layouts specifically (Composition/Caption
Position/Padding/Spacing/Alignment + guides). Layouts got the full guide
treatment; the other states render the real page (so editing a Frame's
thickness, for instance, is already visible in both surfaces) but have
no bespoke highlight overlay yet. A natural next increment, not started
here.

**A-005 / A-006 (carried over from Sprint B2.0.2, still open):**
whether a Layout should become owned by a single Representation instead
of staying independent/reusable, and whether "Portrait" (currently a
Representation) belongs as a Layout instead. Still unresolved pending
more Official Worlds authored for comparison.

**Visual Theme Composer** — interactive page anatomy, click-to-edit
page layers, drag-resizable Holders, context-aware object selection —
remains the long-term direction, explicitly out of scope for this and
every B2.x sprint per its own ticket. Recorded here only so the
direction stays on record.

---

## Sprint B2.0.4 — Workspace Ergonomics

### Builder Issues (fixed this sprint)

**Runtime Preview shared a column with the Inspector, starving the
Inspector of usable width.** Sprint B2.0.3's Runtime Preview sat at the
top of the same right-hand flex column the Inspector filled below it —
correct for making Runtime Preview *exist*, wrong for how much of the
Workspace the Inspector (where a creator actually spends their editing
time) got to use. As more Builder options were added to any one panel,
the Inspector required excessive scrolling in a column barely a third
of the Workspace's width. Fixed by making the Workspace one CSS Grid
instead of nested flex columns — Runtime Preview and the Inspector are
now full grid siblings, the Inspector spanning the entire width beneath
Working View and Runtime Preview rather than squeezed beside them. See
`docs/WORLD_BUILDER_ARCHITECTURE.md`'s "The Workspace is one CSS Grid"
section for the mechanics.

**A guide-label clipping bug, surfaced by the layout change itself.**
Working View's guide labels (Sprint B2.0.3) floated *above* their guide
box by default — harmless when Working View owned the whole right-hand
column's height, but once its grid row shrank to a fixed percentage of
the Workspace, a label near the canvas's own top edge could spill past
`.wb-working-canvas-wrap`'s `overflow:hidden` and get clipped. Fixed by
moving every label inside its box's own edge instead of floating outside
it — cosmetic only, no guide geometry logic changed.

**The Inspector never used its own `.wb-field-row` pairing mechanism.**
`.wb-field-row`/`.wb-field-group` CSS existed since Sprint B1.1 but no
panel had ever actually used it — every field stacked vertically
regardless of how short or related two fields were. A new
`_fieldRow()`/`_buildFieldGroup()` pair wires it up for Layouts
(Aspect|Composition, Padding|Spacing, Caption Position|Alignment),
Frames (Thickness|Padding, Inset|Corner Radius, Border Color|Wall Tone,
Shadow|Default Margin), Representations (Default Layout|Default Frame),
and Overview (Publisher|Version, Purpose|Mood) — reducing vertical
scroll length in the panels that had grown longest.

### Future Product Insights (not implemented — documented only)

None recorded this sprint — B2.0.4 was scoped to Workspace layout only,
with no new authoring surfaces to observe gaps in.

## Sprint B2.0.5 — Builder Workspace Polish

### Builder Issues (fixed this sprint)

**The `#wb-root` ancestor-padding bug.** `#wb-root` carried padding and
a max-width meant for Screens 1–2's comfortable reading-column layout,
but as an ancestor of `.wb-screen-workspace` (a fixed `100vh` region,
independent of ancestor padding) it caused the Workspace's true
rendered footprint to overflow the viewport by exactly that padding
amount, while also stealing width — measured directly via
`getBoundingClientRect()`, not a subjective "feels tight" complaint.
This was the largest single contributor to the sprint's "excessive
whitespace" / "not edge-to-edge" observation. Fixed by moving that
padding/max-width onto `.wb-screen-welcome, .wb-screen-templates`
specifically.

**A flex + `aspect-ratio` distortion bug in Working View and Runtime
Preview.** Combining `flex:1` with `aspect-ratio` and `max-width:100%`
on one element let the browser resolve height via flex-grow before
`max-width` clamped width, so height was never retroactively corrected
to match — a real, measured distortion (Runtime Preview's canvas
measured ratio 1.573 against a correct 1.25). This was not something
the sprint ticket named as a known defect — it only asked to "review
scaling logic... do not distort aspect ratios" — but turned out to be a
literal, verifiable bug once measured. Fixed with the same two-layer
outer-sizing/inner-aspect-locked split the Sprint B2.0.2 Preview modal
already used successfully.

**The project card grid overlapped its own new controls.** Adding
Rename/Duplicate/Delete buttons to the Welcome screen's project card
(this sprint's Draft Management requirement) immediately collided with
the pre-existing `minmax(220px, 1fr)` card grid — a width that was never
wrong until the card grew new button-shaped content, at which point the
name column collapsed to a few pixels and visibly overlapped the
buttons. Fixed by widening the floor to `minmax(320px, 1fr)`, verified
via screenshot before and after.

### Future Product Insights (not implemented — documented only)

None recorded this sprint — B2.0.5 was scoped to visual polish and
Draft Management, both of which reused existing engines/functions with
no new authoring surface to observe gaps in.

## Sprint B2.0.6 — Property Editor + Editing Confidence + Workspace Customisation

### Builder Issues (fixed this sprint)

**A synchronous save has no real "Saving…" moment to show.** The
sprint's own spec asked for a Dirty/Saving/Saved cycle, but
`ProjectStore.save()` is a plain, instant `localStorage.setItem()` — an
actual "Saving…" sub-state would never be visually distinct from
"dirty" in the same synchronous tick, since nothing yields between them.
Rather than fake a state the engine doesn't have, the indicator collapses
to the two states that are real (dirty/saved), and the debounce is
applied only to the *display's* return to "saved" — not to the write
itself, which stays immediate specifically so a quick navigate-away can
never lose an edit. This is a deliberate, disclosed simplification, not
an oversight.

**Property grouping choices that don't map onto real fields weren't
fabricated.** The ticket's own Overview example listed a "Category |
Visibility" pair; neither field exists anywhere in the World Project
Contract or `ProjectModel`, and inventing two new unused fields just to
match an illustrative example would have produced dead UI with no
backing data — a "half-finished implementation" by this codebase's own
standing rule. Overview's actual pairing (World Name|Tagline,
Publisher|Version, Purpose|Mood, Thumbnail|Hero Image) uses only fields
that already exist and are already read by Validation/Build/Runtime.

### Future Product Insights (not implemented — documented only)

**Workspace layout preference is Builder-wide, not per-Project.** Nav
width / Runtime Preview width / Property Editor height persist to one
shared `localStorage` key rather than one key per World Project. This
was a deliberate reading of "remember the creator's preferred workspace
layout" as a personal tool preference (like an IDE remembering panel
sizes across every file you open) rather than per-document state — but
it's worth revisiting if a future creator reports wanting different
layouts for, say, a Quote-heavy World versus an Artwork-heavy one.
