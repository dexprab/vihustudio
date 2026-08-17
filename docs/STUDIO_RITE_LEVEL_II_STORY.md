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

### Page one — building it

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 1 | Every story needs somewhere to happen. | Choose a colour for the ground. | `bg-set` *(rehearse)* |
| 2 | Someone is going to live here. Let's build them a house. | Add a square. | **`shape-added` ①** |
| 3 | A house needs a roof, or the rain gets in. | Add a triangle on top. | **`shape-added` ②** |
| 4 | The roof does not fit the house yet. | Make it the right size. | `sticker-resized` *(rehearse)* |
| 5 | It is a house now. But there is no way in. | Give it a door. | **`shape-added` ③** |
| 6 | And nobody inside can see out. | Give it a window. | **`shape-added` ④** |
| 7 | A house nobody drew is only shapes. | Draw a path up to the door. | **`doodle-added` ①** |
| 8 | What grows beside your house? | Draw it. | **`doodle-added` ②** |

### Page two — who lives there

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 9 | A house is not a story yet. A story needs a next. | Give your story a new page. | **`blank-page-added` ①** |
| 10 | A new page is a new day. | Choose a colour for this day. | `bg-set` *(rehearse)* |
| 11 | Your house is built. Who lives in it? | Add a picture of them. | **`photo-added` ①** |
| 12 | Draw the thing they love most. | Draw it beside them. | **`doodle-added` ③** |
| 13 | Somebody is coming up your path to visit. | Add a picture of them. | **`photo-added` ②** |
| 14 | What do they say when they reach the door? | Add some words. | `text-added` *(rehearse)* |

### Page three — the last day

| # | Story line | Instruction | Gate |
|---|---|---|---|
| 15 | One more day, then. | Give your story another page. | **`blank-page-added` ②** |
| 16 | What is the last thing that happens at the little house? | Draw it. | **`doodle-added` ④** |
| 17 | Your story needs a name. | Give it one. | `story-named` *(rehearse)* |
| 18 | Let us see it from the beginning. | Play your story. | `story-played` *(rehearse)* |
| 19 | Your little house is not empty any more. It has become a story. | Finish your story. | finish *(rehearse)* |

**Coverage:** Shapes ×4 · Doodle ×4 · Photo ×2 · Add Page ×2.
**Rehearsed:** background ×2 · resize · text · name · play · finish.
Nineteen beats against Level I's twenty-three — proportionate for four new
capabilities instead of ten.

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
