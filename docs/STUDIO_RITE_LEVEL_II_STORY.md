# Rite II — *My Little House*

**Status: draft for review. No implementation, no recordings.**
Level II's starter story. Companion to
`docs/STUDIO_RITE_STARTER_STORY.md` (Level I) and
`docs/STUDIO_RITE_LEVELS.md` (the progression).

> **Level I is about placing things. Level II is about making them.**
> That is the whole difference, and this story exists to teach it.

---

## 0. Why the child builds the house

The first draft opened *"A little house appears. But it has no door."*
Both available house emojis — `🏠` and `🛖` — are drawn **with** a door
and windows, so the line could only ever ask a child to fix something
that was not broken. Nothing in the Rite can place an object for a child
either; every gate waits on a child's own action.

So the house is **built, not placed**: a square, a triangle on top, a
door, a window. A house assembled from parts genuinely has no door until
the child puts one there, which makes the story true instead of merely
charming.

And it teaches the right thing. *Make it yours* is not "here are more
stickers to choose from" — it is **you can make a thing out of parts.**
An emoji house is something you pick. A house you assembled is something
you made. Shapes are the only capability that can carry that difference,
which is why they open the story rather than decorate it.

**A child's house will be wonky** — the triangle slightly off the square,
the door floating near the wall. That is correct and must not be
corrected. It is the first thing in the whole product they have built
rather than chosen.

---

## 1. Two ways of making, and they feel different

The division is deliberate and the story never blurs it:

| | For | Feels like |
|---|---|---|
| **Shapes** | the built parts — walls, roof, door, window | straight, deliberate, assembled |
| **Doodle** | the hand-made parts — the path, the garden, what happens | wobbly, personal, theirs |
| **Photo** | the real people who live there | brought from their own life |

A child finishes the story having used three kinds of making — assembled,
drawn and brought — and knowing, without being told, which is for what.

---

## 2. The beats

Every capability Level II introduces is used **at least twice**, per Level
I's own success metric. Rehearsed Level I skills are marked; they are
there so the story reinforces rather than only extends.

### Page one — building the house

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 1 | Once upon a time, there was a little patch of land waiting for a story. | Choose a colour for the ground. | `bg-set` *(rehearse)* |
| 2 | Someone was going to live here. But first, they needed a house. | Add a square. | **`shape-added` ①** |
| 3 | A house needs a roof to keep the rain away. | Add a triangle on top. | **`shape-added` ②** |
| 4 | Roofs are never quite the right size the first time. | Make it the right size. | `sticker-resized` *(rehearse)* |
| 5 | The little house was almost ready. But how would anyone get inside? | Give it a door. | **`shape-added` ③** |
| 6 | And inside the house, there was no window to look through. | Give it a window. | **`shape-added` ④** |
| 7 | There was still no way to reach the door. | Draw a path to the door. | **`doodle-added` ①** |
| 8 | Beside the path, there was a little space waiting for something to grow. | Draw something beside the house. | **`doodle-added` ②** |

### Page two — who lives there?

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 9 | The little house was ready. But a house is lonely without a story. | Give your story a new page. | **`blank-page-added` ①** |
| 10 | Morning came, and the new day was waiting outside. | Choose a colour for this day. | `bg-set` *(rehearse)* |
| 11 | And then, someone finally came home. Who could it be? | Add a picture of them. | **`photo-added` ①** |
| 12 | They had brought their favourite thing with them. | Draw it beside them. | **`doodle-added` ③** |
| 13 | Just then, someone came walking up the little path. A visitor! | Add a picture of them. | **`photo-added` ②** |
| 14 | They reached the door and said something very important. | Add some words. | `text-added` *(rehearse)* |

### Page three — the last day

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 15 | The next morning, something was waiting at the little house. | Give your story another page. | **`blank-page-added` ②** |
| 16 | What do you think happened next? | Draw it. | **`doodle-added` ④** |
| 17 | Every good story deserves a name. What will you call yours? | Give it a name. | `story-named` *(rehearse)* |
| 18 | Now let us see what happened at the little house, from the very beginning. | Play your story. | `story-played` *(rehearse)* |
| 19 | And just like that, the little house had a story of its own. | Finish your story. | finish *(rehearse)* |

### Two rules the prose has to keep

**Never assert a thing before the child makes it.** This is the error the
opening draft made with the house, and it recurs easily. Beats 2, 5, 6 and
7 all get it right by asserting an **absence** (*"there was no window to
look through"*) or a **need** (*"they needed a house"*), never a presence.
An earlier beat 7 read *"A path appeared outside"* — it had not; the child
was about to draw it.

**Never judge the child's work.** An earlier beat 4 read *"Hmm… that roof
looks a little too big."* It might not be — they may have placed a
perfectly good triangle, and Lumo would be telling them it was wrong.
Level I never does this: *"Make your tree bigger"* is a direction, not a
correction. Unconditional wording keeps it safe.

**Coverage:** Shapes ×4 · Doodle ×4 · Photo ×2 · Add Page ×2.
**Rehearsed:** background ×2 · resize · text · name · play · finish.
Nineteen beats against Level I's twenty-three — proportionate for four new
capabilities instead of ten.

**A note on voice.** Level I speaks in the present tense and close up —
*"This new page is the ground."* · *"Now it is morning."* Level II speaks
in past-tense storybook narration — *"Once upon a time, there was a little
patch of land."* That is a deliberate shift, not a drift: a child at Level
II has already made a story, so they are being told one rather than walked
through one. Worth confirming as intended before recording, because it is
the same Lumo in both and the change will be audible.

**Beats 11–12 are the pair that matters.** A real face, in a house the
child built, and then something hand-drawn beside it. The two new ways of
making meet on one page: a photograph they brought and a mark they made,
about the same person. That is a stronger idea than either capability
taught alone, and it is why photos belong in this level rather than the
next one.

---

## 3. The photo beats, and the two ways they can fail

Photos are in Level II, and the pairing with doodle is the reason. But
both photo sources can fail through no fault of the child, so the beats
are written to survive it.

**Photo opens a file picker.** `_addImageObject()` creates a native
`<input type="file" accept="image/*">` — a folder browser. That is a
grown-up's interaction, and a Rite beat that stalls until an adult walks
past is a beat that breaks a mandatory gate.

**Family Photos can be empty.** It is the child-friendly source — a
curated album — but it needs the repository configured *and* a parent to
have put something in it. "Add a picture of who lives here" is a dead end
in a house with an empty album.

Two rules make the beats safe, and neither invents a mechanism:

1. **`photo-added` accepts either source.** Whichever of Photo or Family
   Photos a child reaches for, the beat is satisfied. The gate cares that
   a picture arrived, never where from.
2. **Both photo beats carry a decline.** Screen 22 of Level I already does
   this — `end:{await:…, decline:'Not now'}` — so the pattern exists and is
   shipped. Wording in the child's own voice, never an apology: *"I'll find
   one later."* The story continues; the house is no less theirs for having
   a drawing where a face would go.

That second rule is what makes photos affordable here. Without it, a
capability that depends on a grown-up having done something first cannot
sit inside a Rite at all.

---

## 4. What this needs from engineering

Three gates that do not exist (`docs/STUDIO_RITE_LEVELS.md` → B3):

- **`shape-added`** — shapes come from `StickerLibrary.SHAPE_KINDS` and
  land in the same object list as emojis, so they already satisfy
  `sticker-added`. The new gate must inspect an object's `kind`.
- **`doodle-added`** — `kind:'doodle'`, same discrimination problem.
  Consider also whether "drew at least one stroke" is the real condition:
  an empty doodle object counts as added but is nothing on the page.
- **`blank-page-added`** — `page-added` only counts pages, and Level I
  taught *copying* one, which satisfies the same count. Without this gate,
  beat 9 is passed by the old skill and the new one is never taught.
- **`photo-added`** — satisfied by an image object arriving from either
  `_addImageObject()` (device file) or the Family Photos picker, so the
  gate inspects the object rather than which control produced it.

Verified as already working: the renderer draws multi-stroke doodles with
brush taper (`renderer/slideRenderer.js`), so a child's drawn parts survive
into Play My Story and the finished book. The doodle editor gives a child
colour swatches, thickness, two mediums and `↩ Undo Last Line`.

---

## 5. The ending

**Finish, not Share.** The Creator Ceremony happens once, at Level I, as
the consequence of a first share (`docs/COMPANION_CANON.md` → Canon 6).
Level II ends at Finish Story; the child may of course share afterwards
from the celebration, by their own choice, with no ceremony repeated.
Recorded here so nobody adds sharing back into the script later.
