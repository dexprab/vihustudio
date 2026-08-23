# Rite II — My Garden

**Status: place in the order, no story yet.**
The `my-garden` entry exists in the rite registry (`js/studioRite.js`)
with `screens:null`, which makes it unrunnable by construction: it
refuses to start, the Studio Home offer skips it, and it reveals nothing
to any later rite. **Writing the story below is the only thing that makes
it real.** Nothing else has to change.

This document is the brief, not the script. It says what Level II is for,
what it may and may not do, and the shape a story has to have to teach
it. The script itself — beats, lines, gates — comes next, in the form
`docs/STUDIO_RITE_LEVEL_III_STORY.md` uses.

---

## 1. The one sentence

> **Level I is about placing things. Level III is about making them on
> screen. Level II is about bringing in something that is already real.**

That is the whole difference, and everything below follows from it.

It is also the Product Vision, arriving as a rite for the first time:
*preserve what is real; beautify originals rather than replacing them.*
Level II is where a child learns that VihuStudio will take something they
made with their hands and keep it.

---

## 2. What it teaches

Two capabilities, both living behind **one tile** — 🪴 **My Garden** —
with two rooms inside it:

**Letters first, drawing second** — decided by the product owner. The
order matters more than it looks: letters need only a pen and a scrap of
paper, they come in one at a time so the camera is learned on the
smallest possible thing, and a child who stops after them has still
gained a whole capability. The drawing is the bigger ask — a whole
picture, made away from the screen — and it lands on a child who has
already used the camera once and knows it works.

| Order | Room | What the child learns |
|---|---|---|
| 1 | ✍️ **My Letters** | Their own handwriting can come in one letter at a time, and then be used as writing. |
| 2 | 🖼 **My Drawings** | A drawing made on paper can come into the story, be coloured in, be kept, and be placed on a page. |

Registry ids: `teaches: ['garden', 'handwriting']`,
`reveals: ['library']` — one tile is all that has to stand down, because
both rooms are inside it.

**It teaches nothing else.** Not Shapes, Doodle or Photo (Level III), not
Worlds, Page Style or Voice (Level IV). Note that the colouring tools
*inside* Bring It Alive — pencil, fill, mark, erase, the palette — are
not the Doodle tile and cost nothing from Level III; they are part of the
drawing coming to life.

---

## 3. The defining constraint: this rite leaves the screen

**Level II is the first rite that asks a child to put the laptop down.**
It needs paper, something to draw with, and a camera. Nothing in Level I
or Level III does. Every hard part of this story comes from that, and a
script that ignores it will not survive first contact with a real child.

What it means in practice:

- **There is a gap in the middle where nothing happens on screen.** The
  child is away, drawing. That gap is part of the story and has to be
  written, not left as dead air. Lumo is good at waiting; he should be
  seen to wait.
- **It can fail for reasons that are nobody's fault** — no paper, no pen,
  no camera, a room too dark, a grown-up needed and busy.
- **A child may leave and come back another day.** The rite should
  survive being abandoned mid-way. Decision 22 already settles what
  happens: they keep whatever capability they actually reached, and
  there is no partly-finished rite to model.
- **It must degrade without ever reading as an error.** ✏️ Draw Your
  Stars is the precedent (Decision 16): the fallback path is
  first-class, never styled as a failure. A child who cannot use a
  camera today must still be able to finish this story.

---

## 4. The hook the story needs

Two problems the story has to *create*, so that the capabilities are the
answer rather than an instruction:

**A thing that is not in the box.** Level I's star was an emoji — it was
there, waiting, and the child placed it. Level II's story must need
something that no emoji can be: a particular creature, a particular
friend, a particular house that is *theirs*. The child is not told to
draw; the story simply cannot go on without something only they can make.

**A name that has to be in their own hand.** This is the strongest idea
available and it is worth building the story around: a child writing the
letters of a name, and then seeing that name on the page **in their own
handwriting**. It solves a real design problem too — a font with one
letter is not a font, and "write your name" is a naturally bounded ask of
four to six letters that produces something immediately usable.

*Leave a little bit of yourself behind* is already the invitation
VihuPlanet sends out. Level II is where a child does it literally.

---

## 5. Each capability, used twice

Decision 22's own success metric: **every capability a level introduces
is used at least twice — once to discover it, once to own it.**

| Order | Capability | Discover | Own |
|---|---|---|---|
| 1 | `handwriting` (letters) | Write one letter and see it land on the page as real ink. | Write the rest of a name, and see the whole name in their own hand. |
| 2 | `garden` (drawings) | Bring one paper drawing in, colour it, keep it, place it. | Meet it again on a later page — placed differently, or joined by a second drawing. The point is that it *stayed*: it is theirs and it is still there. |

---

## 6. What the story may never do

- **Never name a control, and never explain what one does** (Decision 8).
  The interface lights the real thing; Lumo does not say "tap My Garden".
  A nudge must bring its target into view first, or not point at all.
- **The camera is the only way in, and the only one described.** Decided
  by the product owner: *"send instructions for camera only, ignore the
  photo button instructions."* Both capture flows are already
  camera-only — there is no file picker in the letter catcher or in
  Bring It Alive — so this is really about the **Photo tile** in the Add
  panel, which is a Level III capability and must not be mentioned,
  pointed at or worked around. A child who cannot use a camera does not
  get told about an upload; see §8.3.
- **Never say that scanning grows the Garden** (Decision 27). The vines
  in the margins will have grown quietly through this whole story. That
  is the reward, and saying so out loud would turn it into a score.
  A child noticing on their own is the entire design.
- **No level, rite, unlock, progress, badge or count** — nothing on
  screen may be comparable with a sibling's (Decision 22).
- **No World.** A World brings Places, Frames and Experiences, and Level
  IV is *about* Worlds. Level II stays on a blank page like Level I.
- **Nothing that requires a Magic Card.** A Traveller who has finished
  Level I and never shared a story holds no card, and Studio Home
  already routes on `StudioRite.isComplete()` alone for exactly that
  reason.

---

## 7. Production notes

- **No recordings.** The product owner cancelled recordings for opt-in
  rites: the generated Lumo voice covers them, and a spoken screen needs
  no hand-measured cues, so rewording a line stays a one-line edit.
  Write every screen with **no `audio` field**. Never invent a
  placeholder audio id.
- **Gates the script will need.** Level I's beats end on events like
  `sticker-added`, `bg-set`, `sticker-resized`. Level II needs its own,
  and they should be dispatched from the real flows rather than faked:
  a drawing kept to My Garden, a drawing placed on a page, a letter
  kept, the handwriting font used on the page. `vihu:creation-captured`
  already exists and already fires from the scanner and from
  handwriting — it is the natural spine.
- **The Studio it runs in.** `reveals: ['library']` and nothing else, so
  the child meets Level I's Studio plus one tile. Every other Add-panel
  control stays hidden by the reduction, and **any control added to that
  panel in future must be added to the reduction in the same commit** —
  My Garden itself leaked into Rite I for exactly this reason.
- **`startsBlank: true`**, like My Little House: this rite opens its own
  blank story when it begins.

---

## 8. Open questions for the product owner

These change the script materially and are not mine to decide.

1. **Whose name is written?** The child's own, or a name they invent for
   the thing they drew? Their own is more personal and gives the font
   the letters most likely to be reused; an invented name is more of a
   story and less of a form. **Note the ordering makes this sharper:**
   with letters first, the name is written *before* the thing it might
   belong to exists, which argues for the child's own.
2. **How many letters is fair?** Four to six is a name. More is a chore
   for a five-year-old, and the letter grid is always there afterwards
   for a child who wants to fill it.
3. **What happens if the camera is not available at all?** Letters-first
   softens this considerably — a child who never gets the camera working
   still finishes the letters and gains a real capability, rather than
   being stopped at the first gate. It does not remove the question: the
   drawing half would be taught in name only, and the Photo tile is not
   an escape hatch (§6).
4. **Does the story assume one sitting?** A child sent to fetch paper may
   come back in ten minutes or tomorrow. Letters-first helps here too:
   the first errand is "find a pen", not "draw a whole picture".

---

## 9. Related

- `docs/STUDIO_RITE_LEVELS.md` — the progression and its sequencing.
- `docs/STUDIO_RITE_STARTER_STORY.md` — Level I.
- `docs/STUDIO_RITE_LEVEL_III_STORY.md` — Level III, *My Little House*,
  and the best available model for how a rite script is written.
- `CLAUDE.md` → Decision 22 (the rites) and Decision 27 (My Garden).
