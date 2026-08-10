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
| The Rite never says "Publish" to a child; it ends by **sharing** the story with VihuPlanet | D7 *(rewritten)*, Canon 7 |
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

**⚠ This copy now contradicts the Rite's own ending, and needs a decision.**
Decision 7's rewrite puts the Creator Ceremony at the *end of this same Rite* —
roughly six minutes after these lines are read. So:

- *"One day it will be ready"* → it is ready today.
- *"Until then, it will quietly travel beside you on every adventure"* → there
  are no other adventures; there is one story.
- *"When the time is right..."* → the time is right almost immediately.

A child will feel this. It is the only place in the Rite that makes a promise
the next five minutes break.

**Proposed replacement**, keeping the entrusting and dropping the long wait:

| Line | From | To |
|---|---|---|
| I.2 | Every story you create helps it grow a little stronger. | *It has been waiting a long time for a story of its own.* |
| I.3 | One day it will be ready. / Until then, it will quietly travel beside you on every adventure. | *It will stay beside you while you make one.* / *Story Eggs know when something is about to happen.* |
| II.3 | When the time is right... / Your Egg will become a lifelong Companion, and every story after that will help your Companion learn, grow and mature with you. | *Nobody knows what is inside a Story Egg.* / *Not even Lumo. It depends entirely on the story you make.* |

This keeps every promise the platform actually keeps, and turns the
foreshadowing into anticipation rather than a schedule. **Not applied — the
copy is the product owner's.** The alternative is to move the hatch back out of
the Rite, which would undo Decision 7's rewrite.

Separately, *"learn, grow and mature with you"* remains Canon 5's **Memory**
tier — still listed as not started and out of scope for Companion v1 — so it
promises a capability with no roadmap regardless of which option is chosen.

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

## Completion — sharing the story with VihuPlanet

*Rewritten under the new Decision 7. The Rite no longer stops short; it ends
with the child deciding what happens to what they made.*

> **LUMO:** You made a story. It's real now.
> *It didn't exist this morning.*

`[EGG: excited]` → `idle`

> **LUMO:** Stories don't have to stay in here with us.
> *VihuPlanet is made of the stories people give it.*

`[EGG: curious]` — the Egg turns toward the child.

> **LUMO:** Would you like yours to become part of VihuPlanet?
> *You don't have to. It's yours either way.*

`[CHILD: chooses]`

→ **Share It With VihuPlanet**  ·  *keep it just for me*

**If they share** — the Creator Ceremony begins (Canon 4, unchanged). Lumo is
already on stage, so it continues rather than starts: the Magic Card awakens,
Lumo blesses the Story Egg, it hatches, and a Story Companion chooses them.

**If they decline** — nothing is lost and nothing is withheld. The story stays
theirs, the Studio unlocks exactly the same, and the Ceremony waits for
whichever story they do share one day.

> **LUMO:** *(either way)* The Studio is yours now.
> *Go and see what else is in it.*

**→ Studio Home. The Rite is complete and never runs again.**

**Emotional beat:** *giving, and what giving returns.* The child is not
rewarded for finishing an onboarding — they are answered. They made something,
they chose to let the world have it, and the world answered by giving them a
Companion. That causal order is the whole point of the rewrite, and it only
works because declining is genuinely allowed: a choice with one option is not a
choice, and a Ceremony that arrives regardless would be a prize for compliance.

**Language:** the word *Publish* never appears. Internally this is the existing
Publish path, unchanged (Canon 7).

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
