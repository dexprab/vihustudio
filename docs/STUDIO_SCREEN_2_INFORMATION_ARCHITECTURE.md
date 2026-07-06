# Studio Screen 2 — Information Architecture

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** The complete information architecture of Screen 2 ("Choose
Your Creative World"), the heart of the Studio arrival journey. This
document describes structure and behaviour precisely enough to build
and review against; it is not a sprint changelog. See
`docs/STUDIO_CREATION_JOURNEY_V1.md` for how Screen 2 fits into the
larger journey, and `docs/STUDIO_DESIGN_CANON.md` for the visual
identity it must honor.

---

## 1. Information Hierarchy

```
Choose Creation Type          (decided on Screen 1, carried into Screen 2)
        ↓
Choose World                  (LEFT: Vihu Worlds row + World Library row)
        ↓
Preview every layout           (RIGHT: a swipeable carousel, one slide per layout)
        ↓
Stop on the one you like        (whichever slide is visible IS the selection)
        ↓
Start Creating                 (inside the Preview, below the visible slide)
```

Nothing on Screen 2 sits outside this hierarchy. There is exactly one
Creation Type active, exactly one World selected at a time, and exactly
one Preview on the whole screen — the one belonging to the selected
World. There is no separate layout-selection step: browsing the Preview
*is* choosing a layout (see §5/§6, Sprint 11.1).

---

## 2. Layout — Master/Detail

Screen 2 is a single master/detail layout, arranged as two columns
side by side (stacking vertically only on narrow viewports):

| Column | Contents |
|---|---|
| Top (spans both columns) | Heading: "Choose Your Creative World", subtitle, and the header-level Add New World button |
| LEFT — Sources panel | **Vihu Worlds** row (official worlds) + **World Library** row (imported worlds, last card **Add New World**) — World Sources only, nothing else |
| RIGHT — Preview | One large carousel |

The left column contains only World Sources — it is a selector, not a
preview. The right column contains exactly one component, the Preview,
which is the sole place any World's layouts are shown or chosen: a
small identity heading (the World's icon and name), then a horizontally
scrollable carousel with one slide per layout, then Start Creating
directly below it.

---

## 3. World Sources

Two sections exist:

- **Vihu Worlds** — the built-in worlds VihuStudio ships with.
- **World Library** — worlds a child (or grown-up) has brought in
  themselves, via Add New World.

These are **only** two sources for the same kind of thing. They are
**not** two different experiences. A World Library world is previewed,
selected, and started exactly the same way a Vihu World is. The only
difference between the two rows is where the World came from.

Add New World appears twice, both wired to the same import flow: as a
button at the very top of the screen (beside the heading) and as the
World Library row's own last card, styled like a World card but with a
"+" and its own label. Either one opens the same import flow that has
always lived in the Theme Library, brought forward onto this screen
because the Theme Library itself is not reachable while Screen 1/2 are
open. A newly added World appears in the World Library row immediately,
already selected, with its Preview populated — no restart, no reload.

**Empty state.** If a Creation Type has no Vihu Worlds at all, that row
is omitted rather than shown empty. The World Library row is never
empty — even with zero World Library worlds yet, its Add New World card
is always present, so a Creation Type with nothing built in yet is
still never a dead end: the child (or the grown-up helping them) can
always add a World right there. If, after all that, still nothing is
selected, the Preview shows a gentle "add a world to get started"
prompt in place of a World's details, and Start Creating stays
disabled.

---

## 4. Selection Model

Only one World can be active at a time, regardless of which row it
came from.

Selecting Museum Gallery, or a freshly imported Dinosaur Adventure,
or Storybook Classic — any of them — updates exactly the same Preview
area. Selecting a World never changes the contents of the Vihu Worlds
or World Library rows themselves; it only changes which card in those
rows shows as selected, and what the Preview panel on the right
displays. The left column is the menu; the Preview is the only place a
World is actually read about or acted on.

---

## 5. Preview Area

**The Preview is the layout selector.** It is not a static thumbnail
and not one image — it is a horizontally scrollable carousel showing
every layout the selected World offers, large enough that a child can
understand each one without reading. Browsing it (swipe, trackpad
scroll, mouse wheel, or the optional arrow buttons) is the entire
interaction; there is no separate click-to-select step layered on top.

Top to bottom, the Preview always contains:

- A small identity heading — the selected World's icon and name, not
  interactive, just orienting the child on which World they're browsing
- The carousel itself — one slide per layout, each slide showing that
  layout's own artwork/icon, name, and short description
- Start Creating, directly below the carousel, always acting on
  whichever slide is currently visible

There is exactly one Preview component. It is never duplicated per
World, never duplicated per row — every World, from either source,
renders through this same component. A World with no named layouts
still gets exactly one slide (its own identity), so the carousel is
always the one and only place a layout is chosen, for every World —
never skipped, never replaced with a different picker.

---

## 6. Current Selection = Whatever Is Visible

There is no selection state independent of scroll position. The slide
currently centred in the carousel *is* the current selection — no
checkmarks, no radio buttons, no dropdown, and no separate "choose
representation" or "begin with" step anywhere else on the screen.
Pressing Start Creating reads whichever slide is in view at that
moment and writes its layout to `slide.metadata.layout`, exactly the
same field Studio has always used for this.

Layouts are contextual: which slides appear depends entirely on the
selected World, driven by `theme.representations` (the authored,
user-facing wrapper around `theme.layouts` — see
`docs/THEME_PROJECT_SPEC.md` §8). No layout list exists anywhere
outside the Preview.

Today, one shipping World defines named layouts:

- **Museum Gallery** — Showcase, Portrait, Quote

A World that defines none (Storybook Classic, today) still shows a
Preview — one slide representing that World's own single layout — so
Start Creating always has something to act on, with no extra choice
required when there's nothing to choose between.

The pattern generalizes to any future World. For illustration only —
not yet implemented, and not required by this document — a future
Storybook-family World might offer Cover / Story Page / Ending, and a
future Comic World might offer Splash / Two Panel / Four Panel. Adding
these later requires no change to this architecture: a World's own
data simply lists its layouts, and the Preview carousel renders
whatever list it finds, exactly as it already does for Museum Gallery.

---

## Change History

- v1.2 — Replaced the click-to-select Page Style grid (with its
  "Begin With" heading and checkmark state) with a swipeable carousel
  that is itself the selection mechanism: whichever slide is scrolled
  into view is the current layout, with no separate selector anywhere.
  Renamed §6 from "Page Selection" to "Current Selection = Whatever Is
  Visible" to state this plainly. Dropped the World's own name/
  description from the Preview body in favour of a compact identity
  heading, since layout name/description now live on each slide.
- v1.1 — Corrected the layout from a single stacked column (rows top
  to bottom) to the canonical two-column master/detail: World Sources
  (Vihu Worlds + World Library) on the left, Selected World Preview on
  the right. Added the header-level Add New World button alongside the
  World Library row's own Add New World card. Renamed the Preview's
  Page Style heading to "Begin With" to match the canonical storyboard.
- v1.0 — Initial canonical IA document, written for Sprint 11.0
  (Studio Arrival Experience), describing the master/detail rebuild of
  Screen 2 (Vihu Worlds / World Library / Selected World Preview)
  replacing the prior grid-based Theme + Page Style screen.
