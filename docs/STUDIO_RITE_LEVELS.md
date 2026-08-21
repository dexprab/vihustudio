# Studio Rite — Three Levels

**Status: approved in shape by the product owner. Step 1 of §6 is built
— the rite registry, Rite II's script and its four gates, and the
Background `Picture` hook. Its recordings, Rite III, the card record,
the opt-in and the persistence are all still to come, in that order.**
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

It is also not quite complete: the Background panel's own `Picture` row
was never hidden, so a device file picker is reachable from Level I's
first beat. That is a defect rather than a design question, and it is
recorded with the pictures below.

---

## 1. What the three levels are

Each level is a Rite, and each level's unlocks are things the previous
level's story had no use for.

| | Rite | What it teaches |
|---|---|---|
| **I** | *The Night a Star Came Down* (exists) | emoji, background, resize, rotate, move, text, copy a page, name it, play it, finish it, share it |
| **II** | *My Little House* (`docs/STUDIO_RITE_LEVEL_II_STORY.md`) | building a thing out of parts, drawing by hand, bringing a real picture in, a page made from nothing rather than copied |
| **III** | *make it live somewhere* | a World, **its Places**, a voice, an audience |

### Every control, and the level it appears at

Measured against build 0562 — the "now" column is what the shipped
`body.studio-rite-running` block actually does today, so the gaps are
visible rather than assumed.

| Control | Now (Rite running) | Should be |
|---|---|---|
| Add · Emojis | visible | **I** |
| Add · Text | visible | **I** |
| Set · Background | visible | **I** |
| Set · Caption / Your Quote | visible | **I** |
| Page thumbnails and ⋮ | visible | **I** |
| Object Strip (cards) | visible | **I** |
| Book name (`#bookTitle`) | visible | **I** |
| Play My Story | visible | **I** |
| Finish Story | visible | **I** |
| Back to the Ether | visible | **all levels, always** |
| Add · Shapes | hidden | **II** |
| Add · Doodle | hidden | **II** |
| Add · Photo (device file) | hidden | **II** |
| Add Page (blank) | hidden | **II** |
| Add · Family Photos | hidden | **II**, and *not a level capability* — see below |
| Set · Background → Picture row | **visible — leak** | **II** *(with the pictures)* |
| Add · From This World | hidden | **III** |
| A Scene's Artwork Places | *(only exist with a World)* | **III** — see §1.1 |
| Add · Voice | hidden | **III** |
| Set · Story Title | hidden | **III** |
| Set · Page Shape | hidden | **III** |
| Page Style / Change Look | hidden | **III** |
| Story Carousel · Story Reel · Magic Creation | *(Publish Studio)* | **III** |
| Story Adventure (book) | *(Publish Studio)* | **I** |
| Open · Save · Home · Theme toggle · Object Strip legend | hidden | never during a Rite |

### Pictures are two kinds of thing, and three surfaces

The product owner: *"regarding photos we have two types."* Correct, and an
earlier draft of the Rite II story conflated them into one gate. Measured
in `js/contextPanel.js`:

| | Control | What it opens | Present when |
|---|---|---|---|
| **Photo** | `data-add-id='photo'` → `_addImageObject()` | the device's own `<input type=file>` folder browser | always |
| **Family Photos** | `data-add-id='family'` → `_showFamilyPhotosPicker()` | a wall of thumbnails from an album a grown-up shared | `_familyPhotosAvailable()` — the repository layer configured **and** a parent has added an album |

**Family Photos is not a control, it is a source, and it appears at three
surfaces** — Add Something (`js/contextPanel.js` line 3326), a Scene
Place's picture (line 1806, `📷 From Family Album`) and the page
background (line 2145, same label). Device upload is the same: `🖼️ Add /
Replace Artwork` on a Place, `🖼️ Upload Picture` on the background.

Two consequences follow, and the second is a shipped defect.

**Family Photos cannot be a level capability.** A Rite may only teach a
control that is on the screen, and on most devices this one is absent —
it needs a grown-up to have done something first. So it gets no beat and
no gate. Its rule is the one it already has: it appears wherever pictures
can go, whenever somebody has set one up. That is not "hidden then
unlocked" — it is the second door on a room the child has already been
shown. **What a level gates is Photo**; Family Photos rides along with it
from Level II onward, at all three surfaces.

**The unlock set must equal the taught set.** The Rite II draft said
`photo-added` accepts either source, which was a sound engineering answer
and the wrong product one: it would teach one capability and unlock two.
The gate is a device image landing, and the story's two photo beats teach
that.

**The leak — closed.** `.context-bg-picture-section` now wraps the whole
row (`js/contextPanel.js` → `_appendBackgroundImageControls`), and the
reduction hides it for any rite that has not taught pictures. The
original finding follows.

`_appendBackground()` renders `Colour`, then a `Picture` row
carrying `🖼️ Upload Picture` and — when configured — `📷 From Family
Album`, then `Picture Area · Transparent`. That is the panel Level I's
**very first beat** opens (*"Choose a colour for the ground"*), so a child
in the first minute of the mandatory Rite can already reach a device file
picker. The `data-add-id` rules cannot reach it: those buttons carry no id
and no data attribute. Fixing it needs a hook on the row — the same
`.context-rep-section` treatment Page Style already got, which was added
for exactly this reason ("it used to append a heading, a name and a button
loose into the column, which left nothing to hide").

### 1.1 Places — the thing no level covered

The product owner: *"we have not covered places in any of the levels."*
True, and the reason it was invisible to the control table is that **a
Place is not a control that can be hidden.** It is a picture-holder
authored into a World's Scene (`image-holder` for Place 1,
`image-place-N` for the rest), so it does not exist on a blank page at
all. Level I and Level II are both World-free, so nothing there could
have leaked and nothing there could be gated.

Selecting one gives, from `_renderArtworkActions()`: a `Your Picture`
banner, a status pill — `✏️ You can edit this` or `🔒 Locked` — then
`🖼️ Add Artwork`, `📷 From Family Album` when configured, `✂️ Crop /
Rotate` once filled, and Card Designer's image and frame sections below.

**Places belong to Level III, as its central act rather than an item on
its list.** *Make it live somewhere* is precisely: choose a World → the
page becomes a Scene → the Scene has places waiting → put your own
picture into the world's own frame. That is the strongest beat available
to Level III and the draft omitted it.

Two things follow that change what Level III costs.

**A Place is the first object a child meets that they did not make and may
not be allowed to move.** The `🔒 Locked` pill is a guardrail
(`CLAUDE.md` → Creator Governing Rule 2) and no earlier level has anything
resembling it. Level III's story therefore has to have a beat for a locked
Place as well as an editable one — otherwise the first padlock a child
ever sees arrives unexplained, in a product whose rule is that nothing is
ever explained. That is a writing problem, and it is the interesting one
in the level.

**Level III's first beat happens before the Studio opens.** Both existing
levels start with `CreationFlow.startBlank()`, which the Rite calls
directly — *"no type screen, no World picker"* (`js/studioRite.js`).
Choosing a World is `CreationFlow.start()`, a screen outside the editor
and outside the `body.studio-rite-running` block entirely. Every Rite beat
that exists today lives in the editor, so Level III needs either beats
that can play over the Creation Flow screens or a Rite that pre-selects a
World and starts the story already on a Scene. **This is unlisted
engineering, and it is the only level that needs it.**

And Level III's story cannot be written until a World is chosen to write
it against: the beats have to name what is in the Scene. Levels I and II
depend on no content asset; this one depends on a specific, stable World
existing. Worth knowing before the writing is scheduled — it is the
largest hidden item in R1.

### The editor's tabs are not a surface at all

`studio.html` carries a tab row — Story · Card Designer · ✨ Emojis ·
World Designer — and an earlier draft of this document listed the last
two as leaking into Level I. **That was wrong**, and the correction
matters because it removes a whole category of work.

`js/contextPanel.js` adds `context-panel-mode` to the right sidebar once
at init, and that rule is `.tabs { display: none }`. Measured in the real
DOM: the tab row is `display:none` in the normal Studio and during the
Rite alike. Nobody sees those tabs. The earlier finding came from a test
that planted stand-in elements on `document.body`, outside the
`.right-sidebar.context-panel-mode` ancestor the rule needs — the probe
was wrong, not the product.

**So Card Designer is not a control to gate.** It is the module behind the
right panel's *object* controls — its sections are Sticker, Picture Frame
and Picture — surfaced inline by the Context Panel whenever a child
selects an object. It arrives automatically with the objects it refines,
so gating Doodle and Photo at Level II gates their controls too. Nothing
extra to hide, nothing extra to unlock.

The same is true of the World Designer tab: what Level III actually gates
is the World itself and the Page Style / Page Shape tiles, not a tab.

**Back to the Ether stays alive throughout**, at every level and at every
moment of a Rite — decided by the product owner. It is a way out rather
than a capability, and a mandatory gate that cannot be left is a trap
rather than a threshold.

**With one consequence recorded rather than designed around.** The Rite
stores a single completion flag (`vihu.studioRite.v1`) and no progress, so
a child who leaves part-way and returns starts the Rite at screen 1 — and
their half-made story is still there, autosaved. Each beat captures its
own baseline when it begins and waits for a *change* against it, so the
star already on the page does not satisfy "add a star": the child adds a
second one, and works through the whole story again on top of the first
attempt.

Deliberately not fixed now. Worth knowing before the levels ship, because
resuming becomes more valuable the more levels there are — Rite III is the
longest and the likeliest to be interrupted.

**Publish destinations are the fourth surface.** Story Adventure (the
book) is what Level I's story finishes into. Carousel, Reel and Magic
Creation are Level III. They live inside Publish Studio rather than the
editor, so they need the manifest too — the CSS block has never touched
them.

The arc is **make a story → make it yours → make it live somewhere.**

**Each level has its own starter story — one each, for now.** Not a
feature tour with a narrative wrapper. A real story that happens to need
the things that level teaches, because the Rite may show where a control
is and may never explain what it does — so the only way to introduce
Doodle is to write a story that wants a drawing in it. Every capability a
level introduces is used **at least twice**, once to discover it and once
to own it, which is Level I's own success metric applied to its
successors.

That makes the writing the critical path, not the code. Level II came out
at nineteen beats for four new capabilities — the estimate here was ten,
and continuity is what the other nine bought. Level III will be longer
again, because a World is a bigger subject than a house.

### The pack is deferred, not cancelled

One story per level for now. Level I's is written and recorded, so the
content left is **two stories**, not fifteen.

The pack was proposed to stop the Ether filling with the same first
story. That concern is real but weaker than it first appears: what a
Story Spirit actually shows in the Ether is its **cover** (the child's own
page 1 — their colours, their stickers, where they put them), its
**name** (they name it) and its **maker**. All three are child-authored,
so two children who both made the Starter Story produce two Spirits that
look nothing alike. The sameness lives in the narrative beats, which a
Traveller only meets after opening and reading.

Revisit once there are enough real shared stories to judge whether
sameness is visible in practice rather than in theory.

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

**The offer is quiet, and it never asks a question.** See §2.1 — the
original wording of this rule was *"made once … never returns after being
declined"*, and building it proved both halves wrong.

**Nothing about a level is ever displayed.** See §4.

### 2.1 Where the offer lives — LOCKED

Locked by the product owner: *"agreed with placement. you can lock it."*
Rendered into the running Studio and measured at build 0562. **One slot,
on Studio Home, showing one story — never two.** A child who has done
Rite I sees *My Little House* there; a child who has done that sees
whatever is next; a child who has done them all sees nothing, and the band
is absent rather than empty. There is never more than one, so there is no
ladder on screen to count or compare.

It sits in `_renderTypeScreen()` between the creation-type grid and
`.creation-flow-secondary-options`, reusing that band's own dashed rule,
width and card treatment. It reads **A new story is waiting**, then the
story's own name and one line about what happens in it.

**Four of the five candidate surfaces are closed by decisions already
locked**, and that elimination is the argument rather than a preference:

| Surface | | Why |
|---|---|---|
| VihuPlanet home | closed | Two permanent actions, forever. Decision 10 names this case: *no new button may appear as a child progresses.* |
| The Finish Story celebration | closed | Exactly two equal choices, neither primary. A third makes one of them the thing you skip — Decision 12. |
| Inside the editor | closed | Never mid-story; and in the Add panel it would read as *more tools*, which is the one thing a Rite is not. |
| My Projects | closed | *Continue a Project* has one job. |
| **Studio Home** | **open** | Between stories, already a screen about what to make, already has a quiet secondary band. |

**And not as a pill, a badge or a seventh card.** The two pills are
*things of mine* — my projects, my card — and a story nobody has made yet
is not one of those; a third starts reading as permanent navigation. A
seventh card in the type grid is worse: those are *kinds* of story and a
Rite is *one specific* story, so sitting it among categories gives it
equal permanent weight. Nothing goes on the Magic Card's face
(`growthSignals()`).

**It names a story, never a capability.** *My Little House* tells a child
what they would be making; *Learn shapes and drawing* tells them what they
are being taught, which is the sentence this product does not write
(Decision 8). Nothing on it says level, rite, two, three, next, progress,
unlock, or the name of any control.

**There is no decline, and no dismiss** — which amends this section's own
original rule. Both halves of *"made once, never returns after being
declined"* were written assuming a prompt, and a prompt is the wrong form:

- **A prompt that must be answered is a nag; a card on a shelf can be
  walked past forever.** The invitation simply sits there every time
  Studio Home opens, until the child takes it. It never interrupts, never
  covers anything and never asks anything, so it does not need answering
  in order to stop.
- **A decline would build the wall this design forbids.** One tap of *No
  thanks* by a five-year-old and progression is closed permanently, with
  nowhere else to reach it from. The rule says a child who never takes
  Rite II *loses nothing* — a dismissible offer makes that false by
  accident.

**It is the last piece, not the first.** One function, additive, nothing
in the editor or VihuPlanet touched — and it cannot ship before there is a
Rite II for it to offer.

---

## 3. Rites are the delivery mechanism, not onboarding

> *"the rites is our way of introducing new features, options in the
> product."*

This is the statement with the longest reach in this document. The Rite
is not onboarding that happens three times — it is how the Studio will
gain **everything** it ever gains. Two things follow, and they bind
every future change:

**Build a rite registry, not three levels.** Level I/II/III is today's
count, not the design. Rites will be added, split and reordered for as
long as the product grows, so the code must take a list of rites — each
with its script, its gates and the capabilities it teaches — and never
hard-code an ordinal.

**Built** — `RITES` in `js/studioRite.js`. Each entry carries its `id`,
its `mission`, its `screens`, the capabilities it `teaches`, what it
`reveals` and whether it `unlocksStudio`. Nothing reads a position out
of the list: a rite is found by id, and the mandatory one is the one
that says it unlocks the Studio, so adding, splitting or reordering
rites needs no code change. `reveals` is what makes this more than a
list of scripts — the reduction in `css/style.css` now stands down for
exactly the capabilities the rite being performed teaches, written onto
`<body>` as `studio-rite-shows-<capability>`, so a rite about drawing
has a drawing control on the screen and the first rite meets the Studio
of five controls it always has. `StudioRite.start(id)` runs a named rite
over a Studio that is already open; that is the seam §2.1's offer will
call, and the offer itself is deliberately not built (§6).

**Every new capability ships with a story that teaches it.** Writing and
a recording session are part of the cost of a feature, not an extra
afterwards. That is a real and permanent tax, and it is the price of the
"never explain, always teach through creation" rule.

---

## 4. What is stored, and where

**Capabilities, not rite indices.** Because rites get added, split and
reordered, a rite index is a moving reference; a capability is stable.
Storing `['shapes','doodle','photo',…]` survives any future
reorganisation of the rites that taught them.

It also settles a question that was open: **a child who abandons a rite
half way keeps whatever they actually reached.** There is no
partly-finished rite to model, because completion was never the unit.

**It must live on the card, and `hasEverPublished` is the wrong model to
copy.** That flag lives in `FLAGS_KEY` in `localStorage`
(`js/magicCard.js`), so it is per-*device*. Copying its shape would
reproduce precisely the failure this is meant to avoid: a Creator opening
the Studio on a grandparent's laptop, dropped to Level I with their own
Level III stories in front of them — `CLAUDE.md` → Decision 19 had to fix
exactly that for projects.

So the record is a **column on `magic_card_identities`**, returned by
`recall_magic_card()` so a strange device receives it along with the
pattern. There is clean precedent for both halves: `companion_id`,
`companion_name`, `companion_species` and `parent_email` were all added
to that table in later sprints via `add column if not exists`, and
Decision 18 already made `recall_magic_card()` return the stored pattern.

**Never a level, rank, score or percentage. Never displayed anywhere** —
not on the card's face, not in the Studio. The card gains no new visible
field. A set of things learned is not a rank, which is what keeps this
inside the card's own *"no counters, no levels"* discipline
(`growthSignals()`). Kept, never shown — exactly as Cheer keeps its count
and shows only growth.

A child's Studio being larger is the only thing they ever see, and that
reads as *I know how to do more*, not *I am a higher level*.

---

## 5. Existing Creators

Anyone who completed the Rite before this ships has been using the
**whole** Studio. They must not lose controls they have been using for
weeks, so they are treated as having completed all three — grandfathered
by their claimed Magic Card, the same mechanism Decision 8 already uses.

---

## 6. Sequencing — read this before writing code

**The persistence must not ship on its own.** Making the Level I
reduction survive the end of the Rite, before Rites II and III exist,
would leave every new child permanently at Level I with no way forward.
That is the wall this design forbids, so it would be worse than the
cliff it replaces.

The order is therefore:

1. Rite II's script and its recordings. *(Script drafted —
   `docs/STUDIO_RITE_LEVEL_II_STORY.md`. Needs four new gates and the
   Background `Picture` row hook.)*
2. **Choose the World Rite III is written against**, then Rite III's
   script and its recordings.
3. The level record on the Magic Card, and the opt-in.
4. Only then: make the reduction outlive the Rite.

Step 2 gained a first half it did not have. Rite III's beats have to name
what is in the Scene, so a specific, stable World has to exist before a
word of it can be written — and it needs beats that play over the Creation
Flow, or a Rite that starts already on a Scene (§1.1). Neither is content
work, and neither is on the R1 engineering list.

**The cost is writing, then voice — but Rite II's voice is settled.**
Each level needs its own starter story written first — a real story, not
a tour. Level I is 23 screens of dialogue and cost 16 recordings.

**Rite II is spoken, not recorded** (build 0581, the product owner:
*"for story rite 2 plug the eleven labs lumo voice. we wont be recording
it."*). Its nineteen beats are written and in the registry, they carry no
`audio` field by design, and Lumo speaks them in his own generated voice
with no cues to measure. So Rite II is **complete** and is not waiting on
a recording session.

What is left is therefore **one story to write** (Rite III's), and the
open question of whether it is spoken or recorded.

**Levels II and III are in Release 1**, by the product owner's decision.
So this is the largest item in R1 by a wide margin, and it is *mostly*
content work — Level II's is content plus four gates and one CSS hook,
which can proceed in parallel with anything. Level III is the one with a
real dependency in front of it.

---

## 7. Out of scope

Level names shown to a child · badges · progress bars · percentages ·
locked controls · anything that can be compared between children ·
required progression of any kind.
