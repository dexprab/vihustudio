# Studio Rite — Three Levels

**Status: approved in shape by the product owner. No implementation yet.**
This document records the decision and the design. It amends
`CLAUDE.md` → Decision 8 on two points and must be read before any of it
is built.

> **The Studio a child meets is the one they completed a Rite in.**
> That sentence is the whole reason this exists.

---

## 0. The problem this fixes

`body.studio-rite-running` hides the controls the Starter Story never
asks for — Shapes, Doodle, Photo, Family Photos, From This World, Voice,
Story Title, Page Shape, Page Style, Add Page, and the project plumbing.
It is scoped to the Rite *running*, so every one of them reappears the
instant the Rite ends.

A child therefore makes their first story in a Studio of five controls
and is handed a Studio of forty at the exact moment they are least
equipped to read it. The reduction was right; its lifetime was wrong.

---

## 1. What the three levels are

Each level is a Rite, and each level's unlocks are things the previous
level's story had no use for.

| | Rite | What it teaches | What it leaves visible |
|---|---|---|---|
| **I** | *The Night a Star Came Down* (exists) | emoji, background, resize, rotate, move, text, copy a page, name it, play it, finish it, share it | Emojis · Text · Background · Caption · page thumbnails and ⋮ · Object Strip · `#bookTitle` · Play · Finish |
| **II** | *make it yours* | their own marks and their own pictures; a page made from nothing rather than copied | **+** Shapes · Doodle · Photo · Add Page · Card Designer |
| **III** | *make it live somewhere* | a World, a voice, an audience | **+** World Designer · Page Style · Page Shape · From This World · Family Photos · Voice · the other publish formats |

The arc is **make a story → make it yours → make it live somewhere.**

**Each level has its own starter story.** Not a feature tour with a
narrative wrapper. A real story that happens to need the things that
level teaches, because the Rite may show where a control is and may
never explain what it does — so the only way to introduce Doodle is to
write a story that wants a drawing in it. Every capability a level
introduces is used **at least twice**, once to discover it and once to
own it, which is Level I's own success metric applied to its successors.

That makes the writing the critical path, not the code. Level II needs
roughly ten beats for five capabilities before continuity; Level III
more.

### Level I keeps its blank page, for a new reason

The recorded reason was offline safety: Studio ships with zero built-in
Worlds, the Theme Repository is remote, and a mandatory gate that needed
a World would hard-fail on a first launch with no network
(`docs/STUDIO_RITE_PROPOSAL.md` §, `docs/STUDIO_RITE_STARTER_STORY.md`
§0). **That argument is void** — the complete system is online
(`CLAUDE.md` → Core Principles), and nothing is designed around a
network being absent.

The decision survives on stronger grounds:

- A World brings Places, Frames and Experiences. A child making their
  very first story has no use for any of them, and Level I's whole
  discipline is that it contains only what the story asks for.
- **Level III is about Worlds.** Handing one to Level I would take away
  Level III's subject and leave it as a bag of leftovers.

So the blank page is now a progression choice rather than a
compatibility one, which is a better reason to keep doing it.

---

## 2. The rules that govern it

**Level I is mandatory. Levels II and III are purely opt-in.**
Completing Level I is what makes a child a Creator, exactly as Decision 8
already has it. Nothing else is ever required of anybody, ever.

**A child who never takes Rite II loses nothing.** They keep making
stories, finishing them and sharing them with the Level I set for as
long as they like. Progression is an invitation; it must never become a
wall, a prompt that returns, or a reason anything is refused.

**Hidden, never locked.** No padlocks, no greyed-out controls with a
"Level 2" tooltip, no progress bar, no badge. A control a child has not
been taught is simply not there yet; when they learn it, it appears.
The moment a level has a name on screen, a child can compare theirs with
a sibling's — which is precisely the reasoning `CLAUDE.md` → Decision 20
used to refuse growth stages for Cheer, and it applies here without
modification.

**The offer is quiet, and it is made once.** An opt-in has to be
discoverable or it is not an opt-in, so there is one unobtrusive way to
ask for the next Rite. It never nags, never returns after being
declined, and never appears mid-story.

**Nothing about a level is ever displayed.** See §3.

---

## 3. Where the level lives, and why that is delicate

It must travel with the **Magic Card**, not the browser. The current
completion flag is one `localStorage` key, so a Creator opening the
Studio on a grandparent's laptop would be dropped to Level I with their
own Level III stories in front of them — the identical failure
`CLAUDE.md` → Decision 19 already had to fix for projects.

**But the Magic Card has a stated "no counters, no levels" discipline**
(`js/magicCard.js` → `growthSignals()`), which derives Stories and
Worlds from real data rather than storing a score. A "Creator Level"
field would break that rule outright.

The resolution is what is stored, and what is not:

- **Stored:** which Rites have been completed. A record of what a child
  has *learned* — the same shape as `hasEverPublished`, which records
  that something happened and not how much.
- **Never stored:** a level number, a rank, a score, a percentage.
- **Never shown:** not on the card's face, not in the Studio, not
  anywhere. The card gains no new visible field. Kept, never displayed —
  exactly as Cheer keeps its count and shows only growth.

A child's Studio being larger is the only thing they ever see, and that
reads as *I know how to do more*, not *I am a higher level*.

---

## 4. Existing Creators

Anyone who completed the Rite before this ships has been using the
**whole** Studio. They must not lose controls they have been using for
weeks, so they are treated as having completed all three — grandfathered
by their claimed Magic Card, the same mechanism Decision 8 already uses.

---

## 5. Sequencing — read this before writing code

**The persistence must not ship on its own.** Making the Level I
reduction survive the end of the Rite, before Rites II and III exist,
would leave every new child permanently at Level I with no way forward.
That is the wall this design forbids, so it would be worse than the
cliff it replaces.

The order is therefore:

1. Rite II's script and its recordings.
2. Rite III's script and its recordings.
3. The level record on the Magic Card, and the opt-in.
4. Only then: make the reduction outlive the Rite.

**The cost is writing, then voice.** Each level needs its own starter
story written first — a real story, not a tour — and then recorded. Level
I is 23 screens of dialogue and cost 16 recordings. This compounds with
the starter-story *pack*, where the bill already multiplies per story: a
pack of five at three levels is fifteen stories, and every one of them
has to be both written and voiced.

That makes this the largest item on the Release 1 list by a wide margin,
and it is a fair question whether Levels II and III are the right shape
but the wrong release.

---

## 6. Out of scope

Level names shown to a child · badges · progress bars · percentages ·
locked controls · anything that can be compared between children ·
required progression of any kind.
