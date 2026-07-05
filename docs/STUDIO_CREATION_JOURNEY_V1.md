# Studio Creation Journey V1

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** The complete product flow a child experiences in Studio, from
opening the app to sharing a finished creation. This document describes
product behaviour only — purpose, entry/exit criteria, intent, and what
is shown or hidden at each stage. It intentionally contains no
implementation detail; see the relevant CLAUDE.md sprint entries and
`docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md` for how each stage is
actually built.

The journey has five stages:

```
Screen 1 (Choose What To Create)
        ↓
Screen 2 (Choose Your Creative World)
        ↓
Workspace
        ↓
Workspace Context States  (states within Workspace, not a new screen)
        ↓
Publish
```

---

## Stage 1 — Screen 1: Choose What To Create

**Purpose**

Welcome the child into VihuPlanet and let them declare, in one tap, the
kind of thing they want to make.

**Entry criteria**

Studio opens with no restorable session (a brand-new project, or a
child choosing to start something new). A child resuming a saved
project never sees this stage.

**Exit criteria**

The child taps one Creation Type card. Studio moves to Screen 2 for
that Creation Type.

**User intent**

"I want to make something — show me my options in words I understand,
not in software terms."

**Objects shown**

- The illustrated Story Meadow (or Open Sky) environment
- Creation Type cards: Tell a Story, Showcase My Artwork, Create
  Quotes, Write a Poem, Make a Greeting Card, More Ideas

**Objects hidden**

- The app header (Open / Save As / Publish)
- Any sidebar
- Any settings
- Any developer or theme-system terminology
- Import Theme (it belongs to Screen 2, once a Creation Type is known)

---

## Stage 2 — Screen 2: Choose Your Creative World

**Purpose**

Let the child pick the "world" their creation will live in, see that
world previewed at full size, and pick how their first page looks
inside it.

**Entry criteria**

A Creation Type has just been chosen on Screen 1.

**Exit criteria**

The child taps Start Creating. Studio creates the first page in the
chosen World, applies the chosen Page Style (if any), and opens the
Workspace.

**User intent**

"Show me the worlds that fit what I just chose, let me see one big and
clearly before I commit, and let me pick how my first page looks."

**Objects shown**

- Vihu Worlds — the built-in worlds for this Creation Type
- World Library — worlds the child (or a grown-up) has brought in,
  ending with Add New World
- The Selected World Preview — one world shown large, with its first
  Page Style choices and Start Creating
- The Story Meadow environment, faded behind the cards

**Objects hidden**

- Every other Creation Type's worlds
- Page Style choices for any world other than the one currently
  selected — there is exactly one Page Style picker on the whole
  screen, and it always belongs to whichever world is currently
  selected
- The app header and dev-only build indicator stay governed by the
  same rule as Screen 1

Full detail on this stage's layout and behaviour lives in
`docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md`.

---

## Stage 3 — Workspace

**Purpose**

The actual creation surface: the canvas, the page strip, and the
editing surfaces a child uses to shape their page.

**Entry criteria**

Either Screen 2's Start Creating was just pressed, or a saved project
was restored (which skips Screens 1 and 2 entirely — resuming work is
never re-interrupted by the arrival journey).

**Exit criteria**

The child leaves this stage only by choosing to Publish, or by closing
Studio (the project autosaves and resumes here next time).

**User intent**

"Let me see my page and change the things on it."

**Objects shown**

- The canvas, showing the current page exactly as it will be shared
- The page strip (add / reorder / duplicate / delete pages)
- The app header (Open / Save As / Publish)
- Whatever the current Workspace Context State shows (see Stage 4)

**Objects hidden**

- Screens 1 and 2, and everything belonging to them (the illustrated
  environment, Creation Type cards, World cards)
- Any control not relevant to the object currently selected on the
  canvas — Workspace shows editing surfaces driven by selection, not a
  permanent, always-visible tool panel

---

## Stage 4 — Workspace Context States

**Purpose**

Show the child exactly the controls that matter for whatever they just
touched on the canvas, and nothing else.

**Entry criteria**

The child is in the Workspace and either has nothing selected (the
default state) or has just selected something on the canvas.

**Exit criteria**

The child selects something else (moves to a different Context State)
or deselects (returns to the default state). This stage never itself
leads anywhere except back to Workspace — it is a set of states within
Workspace, not a separate screen.

**User intent**

"I touched this thing — show me what I can do to it."

**Objects shown, per state**

- **Nothing selected (default):** the current world and page style,
  a Change Representation shortcut back into the Page Style picker,
  the caption or quote fields this world's page style calls for, the
  page background colour, and a way to add a sticker.
- **Artwork or its frame selected:** how the picture sits in its frame
  — fit, fill, or original size; bigger/smaller; move; frame look,
  frame style, and (for worlds that offer them) frame variations.
- **Text selected:** typography controls for that text.
- **Sticker selected:** the sticker's own shadow/appearance controls.

**Objects hidden**

Every control that does not apply to the current selection. A child
who has selected a sticker never sees typography controls; a child who
has selected nothing never sees frame controls.

---

## Stage 5 — Publish

**Purpose**

Turn the finished pages into something the child can share or keep.

**Entry criteria**

The child presses Publish from the Workspace (for the whole book) or
"Publish This Page" from a single page's context menu.

**Exit criteria**

The child reaches the Celebration moment (their creation is produced)
or backs out to return to the Workspace unchanged.

**User intent**

"I'm done — help me turn this into something real, without asking me
anything technical."

**Objects shown**

A five-stage flow — Read My Story → Almost Ready → Choose Story
Destination → Publishing → Celebration — ending in the format the
child chose (a Story Book, a Story Carousel of images, or a Story Reel
once that destination is ready).

**Objects hidden**

Every editing surface from the Workspace. Publish is a distinct,
single-purpose moment — it does not show the canvas mid-edit, and it
never asks the child to configure export settings directly.

---

## Change History

- v1.0 — Initial canonical journey document, written for Sprint 11.0
  (Studio Arrival Experience). Stages 3–5 describe already-shipped
  Workspace/Context Panel/Publish Studio behaviour (Sprints 8.4.x,
  9.0, 10.0) for completeness of the end-to-end journey; this sprint
  changes only Stages 1–2.
