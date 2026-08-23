# Rite II — *The Name on the Green*

**Status: built and walkable. No recordings.**
The twelve beats below are in `js/studioRite.js` as `SCREENS_GARDEN`,
attached to the `my-garden` entry of the rite registry, with five new
gates. No screen carries an `audio` field and none will — opt-in rites
use the generated Lumo voice, so there are no cues to keep in step and
rewording a line stays a one-line edit.

Level II's starter story. Written from
`docs/STUDIO_RITE_LEVEL_II_GARDEN.md` (the brief). Companion to
`docs/STUDIO_RITE_STARTER_STORY.md` (Level I) and
`docs/STUDIO_RITE_LEVEL_III_STORY.md` (Level III).

> **Level I is about placing things. Level III is about making them on
> screen. Level II is about bringing in something that is already
> real** — and this story exists to teach that.

---

## 1. The story

A small green place at the far end of everywhere. Nobody has ever said
whose it is, so the child writes their name — by hand, on paper, one
letter at a time — and puts it on the green. Then the green is quiet, and
somebody should live there: somebody nobody has ever seen before, who
therefore cannot be found in any box. The child draws them, brings them
in, and lets them into the green. The next day comes, and **they are
still there.**

That last beat is the point of the whole story and no line explains it.
The thing the child drew on paper is still there the next day. It stayed.
That is what My Garden *is*, and nothing says so.

---

## 2. The twelve beats

| # | Act | Line | Gate |
|---|---|---|---|
| 1 | I | *At the far end of everywhere there is a small green place.* | `bg-set` |
| 2 | I | *Nobody has ever said whose it is.* / *Things that belong to somebody have their name on them. Written by hand.* | `letter-kept` |
| 3 | I | *That is your letter. Nobody else in the world makes that shape.* / *A name needs all of itself.* | `letters-grown` |
| 4 | I | *Now everyone will know.* | `letters-placed` |
| 5 | II | *It is a lovely green place. It is also very quiet.* / *Somebody should live here. Somebody nobody has ever seen before.* | `drawing-kept` |
| 6 | II | *There you are. Nobody has ever made one of those.* | `drawing-placed` |
| 7 | II | *Nobody is ever quite the right size when they first arrive.* | `sticker-resized` |
| 8 | III | *And then it was the next day.* / *Your page can make a copy of itself.* | `page-added` |
| 9 | III | *They are still here. They live here now.* | `sticker-moved` |
| 10 | III | *They found something while you were away.* | `sticker-added` |
| 11 | IV | *This is a story about a green place with your name on it.* | `story-named` |
| 12 | IV | *Let us see it from the beginning.* | `story-played` |

---

## 3. Why the letters come first

Decided by the product owner, and the order does more work than it looks.

A letter needs a pen and the corner of a page. It comes in **one at a
time**. So the camera — the genuinely new and genuinely fragile thing in
this level — is learned on the smallest possible object, in the smallest
possible errand. By beat 5, when the story asks for a whole drawing and
the child really does leave the room, they have already held paper up to
a camera once and watched it work.

It also softens the two worst failure modes in the brief. A child whose
camera never cooperates still finishes the letters and gains a whole real
capability instead of being stopped at the first gate. And the first
errand is *"find a pen"*, not *"draw a whole picture"* — a much better
thing to send a five-year-old away to do.

**Whose name?** The child's own. The brief left this open, and the
ordering settles it: with letters first, the name is written before the
thing it might otherwise belong to exists. Nothing else is available to
name.

**How many letters?** Beat 2 asks for exactly one. Beat 3 asks for *the
rest of your name*, and the gate is simply "more letters than before" —
never a count. A child called Jo passes it with one more; a child called
Anastasia passes it with one more too, and may keep going as long as they
like. Counting to a number would have invented a wall.

---

## 4. The long errand

**Beat 5 is where the child leaves the screen**, and it is the only beat
in any rite that does. Its `nudgeDelay` is **25 seconds** — the longest
in the product — because a child who is off finding paper is not stuck
and must not be treated as though they were. Every other beat in this
story waits 6–12s.

Lumo's line ends *"I will wait."* and then he does. That is the whole
design of the gap: it is written, not left as dead air.

---

## 5. Rules this script is holding to

- **No line names a control** (Decision 8). The nudges say *where* a
  thing is — "your letters live on the right, with the things you can
  add" — which is allowed; none says what any control does.
- **The camera is the only way in, and the Photo tile is never
  mentioned.** It belongs to Level III and must not become the escape
  hatch when a camera is difficult. Both capture flows are camera-only
  already, so nothing here has to steer around an upload.
- **Nothing says that any of this grows the garden** (Decision 27). The
  vines in the margins will have grown right through this story. A child
  noticing that on their own is the entire design.
- **Unconditional wording about the child's work.** *"Nobody is ever
  quite the right size when they first arrive"* is about arriving, not
  about this child's drawing — the same discipline Rite III adopted after
  a draft had Lumo judging work he cannot see.
- **The page is copied, never added blank** (beat 8), for Rite I's own
  reason: the green, the name and the new arrival all have to travel, or
  beat 9 asks a child to move somebody who is not there.
- **It ends on playing, not on finishing or sharing.** Rite I owns that
  ending. This rite is opt-in and must never push a child toward giving
  anything away — finishing and sharing are separate acts and neither is
  ever mandatory (Decision 12).

---

## 6. The five new gates

All five live in `_conditionMet`, all five are in `PAGE_LEVEL`, and all
five have nudges. Both stores are **synchronous in-memory maps**, so a
condition asks them the same way it asks the page — no await inside a
condition, and no second source of truth.

| Gate | Condition |
|---|---|
| `letter-kept` | `HandwritingStore.list().length` grew |
| `letters-grown` | the same — each beat re-baselines, so one condition serves both |
| `letters-placed` | `_kindCount('image')` grew |
| `drawing-kept` | `CreatorLibrary.list().length` grew |
| `drawing-placed` | `_kindCount('image')` grew |

Two pairs share a condition and stay separate **kinds** because their
nudges differ — *"there is a letter waiting for every one you need"* is
not the same help as *"tap a letter you made"*.

Anything coming out of My Garden onto the page arrives as an image
object, letters and drawings alike, which is the same count `photo-added`
already watches. Since every beat re-baselines, and the letters are
placed before the drawing is, the two never shadow each other.

---

## 7. What making this runnable changed elsewhere

Two things followed automatically, both proven in `tools/rite-test/`:

- **The Studio Home offer now opens My Garden**, not *My Little House*.
  Nothing was edited to make that happen — the offer asks the registry
  for the first opt-in rite with a story written, and now there is one.
- **Rite III inherits My Garden's tile.** `reveals` accumulates in
  registry order and only runnable rites contribute, so while this story
  did not exist the tile stayed out of Rite III — correctly, since
  nobody had been taught it — and the moment the story existed it
  appeared, with neither registry entry naming the other.

---

## 8. Still open

- **Not yet walked end to end by a real child**, and it is the one rite
  where that matters most: every other rite can be verified entirely on
  screen, and this one cannot. What a camera does with a five-year-old's
  pencil letter in a real kitchen is not something a suite can answer.
- **The 25-second wait is a guess.** It is the right shape — long — but
  the number came from reasoning, not from watching somebody fetch a pen.
