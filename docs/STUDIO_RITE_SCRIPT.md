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

> **LUMO:** Welcome to VihuStudio.
> *Every story in VihuPlanet begins here.*

`[EGG: curious]` — the Egg glows softly as it is named, then settles.

> **LUMO:** This Story Egg has been entrusted to you.
> *Every story you create helps it grow a little stronger.*

`[EGG: idle]`

> **LUMO:** One day it will be ready.
> *Until then, it will quietly travel beside you on every adventure.*

→ **Let's Begin**

**Emotional beat:** *arrival, and being entrusted.* The child has not been asked
to do anything yet. Something was already waiting for them, and it is now
theirs to look after.

**Vocabulary introduced:** **Story**, **Story Egg** — used, never defined.

---

## Act II — Who am I?

> **LUMO:** Everyone who arrives here is a Traveller.
> *Today, your journey begins.*

`[EGG: curious]`

> **LUMO:** Travellers create stories.
> *Every story you create nurtures your Egg and helps it grow.*

`[EGG: excited]`

> **LUMO:** When the time is right...
> *Your Egg will become a lifelong Companion, and every story after that will
> help your Companion learn, grow and mature with you.*

→ **Start My First Story**

`[CHILD: begins]` — a single, unmissable way forward. No choice of type, no
World to pick, no settings.

*The blank page opens. The Egg comes with it and stays for the rest of the
Rite.*

`[EGG: excited]` → settles to `idle`

> **LUMO:** There. Your first page.
> *It's empty on purpose. Empty is where everything starts.*

**Emotional beat:** *the promotion is earned, not granted.* Lumo names what a
Traveller does, then immediately offers the child the doing of it. The word
"Creator" is never applied to the child by announcement — they will simply have
become one by Act IV.

**Open against canon, flagged not silently resolved.** This screen promises
that the Egg grows over *many* stories and hatches "when the time is right",
but `COMPANION_CANON.md` Canon 4 hatches it at the **first** Publish — which
may be minutes later. It also promises a Companion that will "learn, grow and
mature with you", which is Canon 5's *Memory* tier, listed as **not started**
and explicitly out of scope for Companion v1. Either the copy softens or the
canon moves; both are product decisions, and neither has been made here.

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

**The Rite is a sequence of SCREENS.** A screen's lines appear one after
another *on their own* — the child never clicks to hear the next thing Lumo
says. Earlier lines of the same screen stay on show, dimmed, so nothing that
was said is taken away while it is still being read.

A screen ends in exactly one of three ways, and only then:

| Ending | Used by |
|---|---|
| **Move ahead** button | Act I, Act IV's reflection, and the closing screen (*Into the Studio*) |
| **Yes** — the one unmissable way forward | Act II, which opens the Studio |
| Something the child **makes** | every Act III screen, and Act IV's naming |

Moving to the next screen clears the conversation, so it never grows without
bound and the stage never reflows.

This replaced two earlier attempts, both corrected from testing. The first put
every line on a timer and moved far too fast. The second let the child click
through line by line, which turned out to be worse in a different way: the
column grew, Lumo drifted upward as it did, and a scrollbar appeared — the
guide should never move because his own dialogue arrived.

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
