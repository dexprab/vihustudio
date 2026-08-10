# Studio Rite — The Script

The screenplay for the first chapter of VihuPlanet. Written before code, per
the approved direction. Implementation realises this script faithfully.

**Canon:** `docs/COMPANION_CANON.md` → Canon 6 · **Architecture:**
`docs/STUDIO_RITE_PROPOSAL.md`

---

## Rules the script obeys

| Rule | Source |
|---|---|
| Lumo speaks. The Story Egg never speaks, teaches or guides | D5, Canon 1 |
| The Egg reacts only through `idle` · `curious` · `thinking` · `excited` · `sleep` | D6, Canon 1 |
| No line explains a button, menu or tool | D3 |
| Every concept is introduced by being *used*, never defined | D4 |
| The Rite never reaches Publish, never hatches the Egg | D7 |
| It opens mid-breath from the Gateway, in the same voice | D2 |

**Lumo's voice**, matched to his existing Gateway lines
(`js/gatewaySequence.js:163-166`): short, warm, two beats — a statement and a
softer second line. Never instructional. Never more than two sentences.

**Stage direction key:** `[EGG: pose]` · `[BEAT]` a held pause ·
`[CHILD: action]` the Rite waits for this, indefinitely and without nagging.

---

## Act I — Where am I?

*Opens the instant the Gateway's last line fades. No new screen, no loading
state, no title card. The Gateway ends on `'Every Creator begins here.'` — this
is the next breath.*

`[EGG: idle]` — the Egg is simply there, close, already his.

> **LUMO:** This is VihuStudio.
> *Every story in VihuPlanet begins in a place like this.*

`[BEAT]`

> **LUMO:** Stories are how we keep the things we love.
> *A day, a friend, a dragon you invented — a story keeps it real.*

`[EGG: curious]` — the Egg tilts toward the child, as if it heard the word
*dragon*.

> **LUMO:** Someone brought this Egg here for you.
> *It has been waiting.*

`[BEAT]` — the Egg glows softly, then settles.

`[EGG: idle]`

**Emotional beat:** *arrival, and being expected.* The child has not been asked
to do anything yet. Something was already waiting for them.

**Vocabulary introduced:** **Story** — used, never defined.

---

## Act II — Who am I?

> **LUMO:** Everyone who finds their way here is a Traveller.
> *You are a Traveller. You just arrived.*

`[EGG: curious]`

> **LUMO:** Travellers who make something become Creators.
> *That's the only difference. Making something.*

`[BEAT]`

> **LUMO:** Would you like to make something?

`[CHILD: begins]` — a single, unmissable way forward. No choice of type, no
World to pick, no settings.

*The blank page opens. The Egg comes with it and stays for the rest of the
Rite.*

`[EGG: excited]` → settles to `idle`

> **LUMO:** There. Your first page.
> *It's empty on purpose. Empty is where everything starts.*

**Emotional beat:** *the promotion is earned, not granted.* Lumo defines
Traveller and Creator by the act that separates them, then immediately offers
the child that act. The word "Creator" is never applied to the child by
announcement — they will simply have become one by Act IV.

**Vocabulary introduced:** **Traveller**, **Creator**.

---

## Act III — What do I do here?

*Three small makings. Lumo asks for a thing; he never says where to tap.*

### Beat 1 — someone to put there

> **LUMO:** A story needs someone in it.
> *Choose whoever you like. It's your story.*

`[EGG: thinking]` — the Egg watches while the child decides.

`[CHILD: places a character on the page]`

`[EGG: excited]` → `idle`

> **LUMO:** Oh — hello.
> *They're yours now.*

### Beat 2 — somewhere to be

> **LUMO:** They don't have to stay there.
> *Put them wherever the story needs them.*

`[CHILD: moves the character]`

`[EGG: curious]` — following the movement.

> **LUMO:** That's it. Nothing here is stuck.

### Beat 3 — how big they are

> **LUMO:** Big things feel close. Small things feel far away.
> *How close is this one?*

`[CHILD: resizes the character]`

`[EGG: excited]` → `idle`

> **LUMO:** You're deciding how it feels.
> *That's the whole job.*

**Emotional beat:** *authority.* Three actions, each framed as a decision about
the story rather than an operation on an object. No control is named. If the
child pauses, the Egg drifts to `sleep` and wakes to `curious` the moment they
move again — the Rite never nags, never re-explains, never advances itself.

---

## Act IV — Why do stories matter?

> **LUMO:** Every story has a name.
> *What is this one called?*

`[CHILD: names the story]`

`[EGG: excited]` — the strongest reaction in the Rite.

`[BEAT]` — hold it. Let the name sit on the page.

> **LUMO:** *(quietly)* You made that.
> *It didn't exist, and now it does.*

`[EGG: idle]` — settled, close to the child.

> **LUMO:** That's why we keep stories.
> *Because someone made them, and then they were real.*

**Emotional beat:** *the answer to the fourth question, felt rather than
stated.* The child does not learn why stories matter; they have just made one
exist, and Lumo names what happened.

**This is the peak of the Rite. Nothing after it adds — it only closes.**

---

## Completion

> **LUMO:** You're not a Traveller any more.
> *You made something. That makes you a Creator.*

`[EGG: excited]` → `idle`

> **LUMO:** One day this Egg will hatch, and someone will choose you.
> *Not today. Today you just made your first story.*

`[BEAT]`

> **LUMO:** The Studio is yours now.
> *Go and see what else is in it.*

*Lumo leaves — the same departure the Gateway already uses. The Egg does not
leave. It follows the child into the Studio and stays.*

**→ Studio Home. The Rite is complete and never runs again.**

**Emotional beat:** *earned entry, and a promise kept for later.* The hatch is
named so the child knows it is coming, and explicitly deferred so D7 is honoured
in the fiction as well as in the code. The Egg walking into the Studio with them
is the handoff: Lumo guided the threshold, the Egg is the companion.

---

## Beat sheet — implementation reference

| # | Act | Lumo lines | Egg | Child action | Blocks? |
|---|---|---|---|---|---|
| 1 | I | 3 | `idle` → `curious` → `idle` | — | no |
| 2 | II | 3 | `curious` → `excited` → `idle` | begins | **yes** |
| 3 | III.1 | 2 | `thinking` → `excited` → `idle` | place character | **yes** |
| 4 | III.2 | 2 | `curious` | move character | **yes** |
| 5 | III.3 | 2 | `excited` → `idle` | resize character | **yes** |
| 6 | IV | 3 | `excited` → `idle` | name the story | **yes** |
| 7 | Complete | 3 | `excited` → `idle` | — | no |

**18 Lumo lines. 5 blocking child actions. 5 Egg poses, all with real art.**

**Nothing in the Rite is timed.** Lumo's lines accumulate as a *conversation* —
each new line joins the ones before it rather than replacing them — and the
child clicks **Move ahead** to continue. Earlier lines stay on screen, dimmed
and scrollable, so a child who reads slowly, or who is being read to, can look
back at anything already said.

This replaced a first version whose lines were on timers. Testing reported it
moved too fast, and the fix was not a longer timer: a timer makes the Rite
something to *keep up with* rather than something to read. The pace is the
child's now, in both directions — they can dwell as long as they like, and a
confident reader is never made to wait.

Blocking beats wait indefinitely on the child's own making. `sleep` on idle,
`curious` on re-engagement. No timeouts, no skips, no auto-advance — D1 makes
the Rite mandatory, so it must never be possible to get stuck *or* to be
rushed.

---

## Deliberately not in this script

Publish · the Creator Ceremony · hatching · My Projects · Worlds, Places or
Experiences · themes · audio · stickers beyond the one character · any second
page · any control named aloud · any settings.

D10 protects this list. **Additions to the Rite are a canon change, not a
feature.**
