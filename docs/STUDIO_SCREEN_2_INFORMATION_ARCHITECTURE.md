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
Choose World                  (Row 1: Vihu Worlds · Row 2: World Library)
        ↓
Preview Selected World         (Row 3: one world, shown large)
        ↓
Choose First Page              (inside the Preview, only if the world offers Page Styles)
        ↓
Start Creating                 (inside the Preview)
```

Nothing on Screen 2 sits outside this hierarchy. There is exactly one
Creation Type active, exactly one World selected at a time, and exactly
one Page Style picker on the whole screen — the one belonging to the
selected World.

---

## 2. Layout — Master/Detail

Screen 2 is a single master/detail layout, top to bottom:

| Row | Contents |
|---|---|
| Top | Heading: "Choose Your Creative World" |
| Row 1 | **Vihu Worlds** — horizontal scrolling cards |
| Row 2 | **World Library** — horizontal scrolling cards, last card is **Add New World** |
| Row 3 | **Selected World Preview** — one large panel |

Row 3's panel contains, top to bottom: the World's hero artwork, its
name, its description, "Choose Your First Page" with Page Style
previews (only if the World offers any), and Start Creating.

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

Row 2 always ends with an **Add New World** card, styled like a World
card but with a "+" and its own label, in the same place regardless of
how many other cards are in that row. Tapping it opens the same import
flow that has always lived in the Theme Library, brought forward onto
this screen because the Theme Library itself is not reachable while
Screen 1/2 are open. A newly added World appears in Row 2 immediately,
already selected, with its Preview populated — no restart, no reload.

**Empty state.** If a Creation Type has no Vihu Worlds at all, Row 1 is
omitted rather than shown empty. Row 2 is never empty — even with zero
World Library worlds yet, its Add New World card is always present, so
a Creation Type with nothing built in yet is still never a dead end:
the child (or the grown-up helping them) can always add a World right
there. If, after all that, still nothing is selected, the Preview shows
a gentle "add a world to get started" prompt in place of a World's
details, and Start Creating stays disabled.

---

## 4. Selection Model

Only one World can be active at a time, regardless of which row it
came from.

Selecting Museum Gallery, or a freshly imported Dinosaur Adventure,
or Storybook Classic — any of them — updates exactly the same Preview
area. Selecting a World never changes the contents of Row 1 or Row 2
themselves; it only changes which card in those rows shows as selected,
and what the Preview panel below displays. The rows are the menu; the
Preview is the only place a World is actually read about or acted on.

---

## 5. Preview Area

The Preview area is one large visual, shared by every World regardless
of source. It always contains:

- World artwork (large — the World's own preview image, or its icon on
  a soft colour field if it has no image)
- World name
- World description
- "Choose Your First Page" — Page Style previews (present only if the
  selected World defines any; see §6)
- Start Creating

There is exactly one Preview component. It is never duplicated per
World, never duplicated per row — every World, from either source,
renders through this same component.

---

## 6. Page Selection

Pages are contextual: which Page Style cards appear inside the Preview
depends entirely on the selected World. No page list exists anywhere
outside the Preview area.

Today, one shipping World defines Page Styles:

- **Museum Gallery** — Showcase, Portrait, Quote

A World that defines no Page Styles (Storybook Classic, today) skips
straight to Start Creating with no Page Style step at all — the first
page is simply created in that World with no extra choice needed.

The pattern generalizes to any future World. For illustration only —
not yet implemented, and not required by this document — a future
Storybook-family World might offer Cover / Story / Ending, and a
future Comic World might offer Splash / Two Panel / Four Panel. Adding
these later requires no change to this architecture: a World's own
data simply lists its Page Styles, and the Preview renders whatever
list it finds, exactly as it already does for Museum Gallery.

---

## Change History

- v1.0 — Initial canonical IA document, written for Sprint 11.0
  (Studio Arrival Experience), describing the master/detail rebuild of
  Screen 2 (Vihu Worlds / World Library / Selected World Preview)
  replacing the prior grid-based Theme + Page Style screen.
