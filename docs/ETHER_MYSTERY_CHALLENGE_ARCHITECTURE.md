# Ether Mystery & Challenge Architecture

Product/experience foundation for Mysteries and Challenges in the
Ether, written against the real implementation at build 0764 (the
Experience Composer merged at build 0763, plus the Exploration Nudge
and the Ether Ripple). This is the study the Mystery/Challenge sprint
was asked for **before** any large implementation: what these concepts
mean, what already exists, what is only an implementation pattern, and
what is genuinely missing.

The governing sentence, unchanged from the Ether Experience
Architecture: **the Ether is a sea of mysteries.** It is not a Story
browser, a creature showcase, an activity menu, a quest system or a
game. The loop it serves is the product's own:

```
ETHER (sea of mysteries)
  → WORLD STATE → EXPERIENCE COMPOSER → { MYSTERY, CREATURE, CREATION }
  → EXPLORATION → DISCOVERY → STORY → COMPANION
  → "I want to make" → VIHUSTUDIO
```

The Composer owns WHEN / WHAT / WHERE / WHETHER. Providers own HOW.
Nothing in this document proposes an EtherBrain, a MysteryBrain, a
ChallengeBrain, a second scheduler, or LLM-driven orchestration — the
Composer is deterministic and inspectable, and stays so.

---

## 1. Mystery

**Definition.** A Mystery is something in the Ether that does not
fully make sense yet, and that a child can tell does not fully make
sense yet. Its test is that it creates a QUESTION in the child —
*"What's that?" · "Why did that happen?" · "Where did that go?" ·
"Why is it doing that?"* — not that it is rare, unusual-looking, or
animated. An animation nobody wonders about is decoration; a Mystery
is a question wearing the sky's own clothes.

**Purpose.** Mystery is what makes exploration worth doing. The child
should feel *"What's that?" → "Can I find out?" → "Oh!" → "But what is
THAT?"* — and however long they explore, they should never feel they
have completely figured the Ether out. Some of the Ether's questions
must therefore stay open forever, by design.

**Characteristics** (each enforced somewhere real):

- **A Mystery is posed by the world, never announced.** Nothing on
  screen says "mystery"; the Ether never explains itself (no overlay,
  no label, no tutorial voice). The word appears in code, canon and
  documents — never on a child's screen.
- **A Mystery is allowed to stay one.** The `unresolved` outcome is a
  first-class member of the pattern library, not a failure state.
- **A Mystery is never a debt.** Nothing counts unanswered questions,
  nothing nags about them, and an ignored Mystery costs the child
  nothing.
- **A Mystery is stateless across visits** (Decision 19): what was
  wondered about this visit dies with the page. Depth across a LONG
  session comes from session-scoped world state (anchors, the
  discovery ledger, phases), never from a stored profile.

**Types, as they exist against the ten the brief asked to be
investigated** — the verdict is which are genuinely useful, not a
promise to build all ten:

| Type | Verdict | Where it lives today |
| --- | --- | --- |
| Something unusual | USEFUL, EXISTING | `odd-stars`, `sky-bloom`, `distant-passage`, `deep-crossing` |
| Something moving | USEFUL, EXISTING | every crossing; the currents themselves |
| Something unexplained | USEFUL, EXISTING | `unresolved` outcomes; wonders that bloom and go |
| Something distant | USEFUL, EXISTING | `distant-passage` (small, far, uncatchable); the beckon's aim |
| Something that reacts | USEFUL, EXISTING (this sprint) | the Ether Ripple — the sky itself answers a touch |
| Something connected | USEFUL, PARTIAL | anchors + `echo-bloom` / `convergence` / an answered touch; see §6 |
| Something recurring | USEFUL, PARTIAL | the same being passing again with a different manner; nothing yet recurs AS ITSELF |
| Something hidden | PARTIAL | dim Spirits beyond the view (the jellyfish's kindles); nothing is ever deliberately concealed |
| Something changing | THIN — treat with care | only the garden-style slow transformation would honestly fill this; nothing in the Ether transforms over a visit yet |
| Something missing | FUTURE, treat with the most care | requires the child to have a mental model of "what belongs", which a fresh Traveller does not have; a candidate for long sessions only |

**Lifecycle** (derived, never stored as a "mystery object"):

```
POSED (something happens, or is simply there)
  → NOTICED (prox/turning — the world-state ledger reads it)
  → optionally ENGAGED (the child moves toward it / touches it)
  → one of:
      RESOLVED INTO DISCOVERY  (a Story, a wonder, an answer)
      DISSOLVED                (it left; the question stays open)
      STILL OPEN               (it is simply still there)
```

There is deliberately NO mystery table and NO mystery object in the
implementation. The Composer's existing world state — the experience
history ring, the per-Story depth ladder (`unknown → glimpsed →
noticed → approached → interacted → discovered → understood`), the
per-creature outcome record, and the anchors — already carries every
stage of this lifecycle that the product needs. Reifying "a Mystery"
as a record would be the first step toward a quest log, which is the
thing this architecture exists to prevent.

**Relationship to exploration.** Exploration is the child's primary
action, and every Mystery must be answerable BY exploration (turning,
approaching, touching, waiting) — never by reading instructions, by
reflexes, or by guessing what the machine wants. The nudge, the
glance and the beckon exist to teach that exploring is possible; the
Mysteries are why it is worth it.

## 2. Challenge

**Definition.** A Challenge is one possible way a child engages with a
Mystery: *"Can I follow it?" · "Can I find it?" · "Can I make it
happen?" · "Can I notice what changed?"* The world creates the
Challenge; the child chooses whether to engage; and nothing anywhere
acknowledges that a Challenge existed, was taken, or was completed.

**What a Challenge is NOT** (hard lines, all suite-enforced today):
not a level, a score, a quest list, an XP activity, a timed
competition, or a conventional puzzle screen. There is no challenge
menu, no objective marker, and no text of the form "CHALLENGE: FOLLOW
THE STAR TRAIL" — ever. `js/etherLife.js`, `js/etherDiscovery.js`,
`js/etherExperience.js` and `js/etherRipple.js` are all scanned
(comments stripped) for gamification vocabulary.

**Characteristics:**

- **Optional, always.** A Challenge left untaken fades with no cost
  (`trail:faded` — "followed by nobody; nothing owed").
- **Understandable through the world.** The trail's brightness pulses
  TOWARD its target; the starbird's feathers fall where it actually
  flew. Which way is never said, always shown.
- **Solvable through exploration.** Every existing Challenge resolves
  by turning the universe until the target is near the centre of the
  view. No dexterity, no timer, no failure state.
- **Appropriately subtle, never hidden-object frustration.** The
  target's `prox > 0.55` threshold means "roughly centred", not
  "pixel-hunted". The feeling to protect: *"I can probably figure
  this out"*, never *"the game wants me to guess."*

**Types, as they exist against the nine the brief listed:**

| Type | Verdict | Where it lives today |
| --- | --- | --- |
| Follow | EXISTING | the whale's breath-trail (`follow-the-whale`); the starbird's flight (`star-trail`) |
| Find | EXISTING (as the second half of Follow) | the trail's far target; the beckon's aim; the jellyfish's edge-kindles |
| Notice | EXISTING | the notice grammar itself (turn-toward or touch); `silent-crossing` is noticing with nothing further owed |
| Reveal | EXISTING | the jellyfish's ring — light showing where things rest, leading to none of them |
| Experiment | EXISTING (this sprint) | the Ripple: "what happens if I touch the sky?" — and the honest answer is usually "it noticed", occasionally more |
| Navigate | EXISTING (implicitly) | every Follow/Find IS navigation; a separate navigation challenge would be a reskin |
| Connect | PARTIAL | anchors let the sky make connections (`echo-bloom`, `convergence`, an answered touch); the child cannot yet be the one who notices a connection first — see §6 |
| Return | PARTIAL | anchors make returning-to-a-place meaningful to the SKY; nothing yet invites the CHILD to return anywhere |
| Remember | FUTURE, and possibly never | within one visit it collapses into Connect/Return; across visits it contradicts Decision 19 (a stateless Traveller). Do not build without a product decision. |

**When a Challenge should emerge.** From the Composer's own reasoning,
never from a schedule: a creature was noticed and can lead (Follow);
the sky is resting and something faint appears (Notice); a child taps
(Experiment). The Composer's phase model already refuses challenges
during arrival and orientation, and QUIET remains a first-class
choice — long stretches with no Challenge on offer are correct.

## 3. Mystery does not require Challenge — the hard principle

Held today, structurally: `silent-crossing`, `shy-passage`,
`distant-passage`, `deep-crossing`, `odd-stars`, `sky-bloom` and the
free-standing wonders all POSE without ASKING. The `unresolved` and
`vanish` outcomes exist precisely so that some Mysteries simply exist
— a strange light appears and disappears; a distant being passes and
cannot be reached; a few stars were not there before and then are not
there again. The child does not always need a task. Mystery itself is
the experience, and the novelty model deliberately values these
non-challenge patterns as much as the guided ones.

## 4. Discovery

**Definition.** A Discovery is what exploration yields: a Story
Spirit met, a wonder witnessed, a place understood, the sky's answer
felt. It differs from a Challenge in that a Challenge is an
invitation to move and a Discovery is what the moving reached — and a
Discovery can arrive with no Challenge at all (drifting into a Story
nobody pointed at is still a discovery, and the ledger records it the
same way).

**Discovery is the reward, and the only reward.** Nothing else is
granted: no token, no count, no collection. The deepest discovery is
always a Story — and only inside a Story is a Traveller welcomed by
who lives there (the Companion boundary, unchanged: the Companion is
never the Ether's tutorial voice and never appears before a Story
opens).

**Discovery should sometimes create another Mystery.** The
architecture prefers `Mystery → explore → discover → "Oh!" →
something remains unexplained → new Mystery` over `Mystery →
Challenge → answer → END`. What exists for this today:

- the sky RESTS after a find (a drawn 40–90 s quiet), and what comes
  after the rest is chosen for freshness — so a discovery is followed
  by a different KIND of question, not a repeat;
- anchors: the place where something was found, met or answered
  becomes a place a later experience may echo (`echo-bloom` blooms
  where something else once happened; `convergence` routes a crossing
  through an old place; an answered ripple-touch becomes an anchor);
- an `unresolved` pattern is eligible right after a resolution, so a
  find can be followed by a question that never closes.

What does NOT exist: a discovery that carries its own next question
INSIDE it (e.g. a wonder that leaves something faintly behind where
it bloomed). That is the single most valuable missing primitive —
see §6.

## 5. Composer integration

The seams, as they are — this sprint added one (the touch) and
changed no others:

**What the Composer knows** (all derived, all session-only): the
conducted clock; the Traveller's stillness and whether they have ever
turned; eight view sectors and dwell; the per-Story depth ladder; the
per-creature outcome record; the experience history ring; anchors;
the visit's own rarity disposition and tempo; phase (derived from
behaviour, never a timetable); and now the touch — where the child
tapped, and whether the sky has answered a touch recently.

**What a Mystery provider supplies** (HOW, never WHETHER):
- `js/etherLife.js`: `summon(id, manner)` — crossings with manners
  (default / acknowledge / shy / none, band, scale, speed, via an
  anchor); `bloomAt` / `markAt` — wonders and anomalies; `beckonNow`
  — with the anti-nag policy guards staying local to the provider;
  the notice grammar, the trail machinery, departure.
- `js/etherRipple.js` (new): the immediate acknowledgment of a touch
  (provider grammar, like a creature's swell-ack), the `touched`
  event upward, and `echoAt` — the one seam through which the
  Composer may answer a touch in the ripple's own fabric.

**What a Challenge provider supplies:** `js/etherDiscovery.js` owns
the activity registry (`ACTIVITIES`: a creature, a kind of guidance,
what it may lead to), the pickers (which Story, which wonder), the
one-at-a-time rule and the rest-after-found rule. A conductor may
lengthen the rest and lean the target preference — nothing else is
steerable.

**What remains deterministic:** everything. Every decision is a
weighted choice over world state with named rejections, logged to the
`?etherdebug=1` decision ring. No model, no network, no LLM anywhere
in the Ether's orchestration (the Companion Mind stays a separate
system that only exists inside an opened Story).

**What belongs to World State vs. providers:** if it is a fact about
the visit (what happened, where, how deep), it is the Composer's;
if it is a fact about how a being or an effect behaves, it is the
provider's. The touch decision honoured this: the ripple ack is
provider grammar; the response policy is Composer state.

## 6. Existing feature mapping

Each of the named ingredients, marked as the brief requires:

| Ingredient | Status | As a Mystery/Challenge experience |
| --- | --- | --- |
| **Whale** (points — breath trail) | **EXISTING** | Mystery (a vast being crossing) + optional Follow Challenge + Discovery. Complete end-to-end. Also participates challenge-free via manners (silent, shy, distant, deep) — ASSET ≠ EXPERIENCE holds. |
| **Starbird** (carries — flight trail) | **EXISTING** | Same composition, different grammar (`star-trail`); its trail is its real flight. Complete. |
| **Jellyfish** (reveals — ring + kindles) | **EXISTING** | A Notice/Reveal experience: light shows where things rest, leads to none of them. Repeatable with a gathering recharge (V2.2). Complete. |
| **Beckon** | **EXISTING** | Subtle guidance, not a Mystery: it answers un-started exploration, stops forever once answered. Correctly classified as an invitation. |
| **Wonders** (trail-end + free blooms) | **EXISTING** | Pure Mystery without Challenge — blooms, shines, goes, unexplained. **PARTIAL** as a chain-starter: a wonder never leaves a question behind it. |
| **Story Spirits** | **EXISTING** | The discovery substrate, and quiet Mysteries in their own right (a dim soul before an identity). The depth ladder reads engagement without storing a profile. |
| **Star Trail** | **EXISTING** | Second row of the activity registry, distinct grammar from the whale's. |
| **Sky patterns** (`odd-stars`, `sky-bloom`, `echo-bloom`, `distant/silent/shy/deep crossings`, `convergence`) | **EXISTING** | The challenge-free Mystery family, plus the first Connected Mysteries (anchor echoes). These ARE child-facing experiences, not just implementation patterns — but only when noticed; nothing measures whether they ever are (see gaps). |
| **Ripple** (this sprint) | **EXISTING** | The "something that reacts" Mystery and the Experiment Challenge: tap → the Ether noticed → occasionally, unpredictably, a little more. Deliberately unlearnable as a reward. |
| **Exploration Nudge** (this sprint) | **EXISTING** | Not a Mystery — the one direct invitation, once, gone on first exploration. |
| **Story Hunt** | **FUTURE** | Named in the registry's own comment as a future row. Do not build until the Connect primitive exists, or it degenerates into Follow with a different name. |
| **Missing character / what-doesn't-belong** | **FUTURE** | Requires the "something missing" Mystery type and a child-held mental model; long-session material, own product decision needed. |

**What is only an implementation pattern, not (yet) a child-facing
experience:** the DEPTH ladder and the phase model (internal reasoning
— correct, and must stay invisible); the anchors (invisible
machinery whose visible half is the echoes); the decision log
(developer-only, correct). None of these should be reclassified or
surfaced.

**What should be retained unchanged:** everything above marked
EXISTING. Nothing was rewritten in this sprint to rename it, per the
brief's own instruction.

## 7. Missing architecture (the honest list)

1. **A discovery that poses the next question.** The single seam that
   would make `discover → "Oh!" → new Mystery` structural rather than
   coincidental: a target the composition can mark as *leaving
   something behind* (a faint mark where a wonder bloomed, a
   direction hinted at where a trail ended). Cheap — `markAt` already
   exists; what is missing is the Composer choosing to chain it, and
   a rule for how rarely. **Recommended next step** (see the report's
   final section).
2. **Child-first connections.** Anchors let the SKY connect places;
   there is no way for the composition to notice that the CHILD
   returned somewhere on their own and let the sky acknowledge it.
   Would need only the existing sector/dwell state read against
   anchors — no new stores.
3. **Noticed-ness for sky patterns.** `odd-stars` and the blooms are
   posed whether or not anyone ever looks at them; the creature layer
   has a notice grammar, the sky patterns have none. The novelty
   model therefore cannot tell a mystery that landed from one that
   played to an empty house.
4. **Long-session depth beyond rarity.** Phases + rarity + per-visit
   disposition give a 20-minute sitting different texture from a
   20-second one, but a 60-minute sitting is currently "more of the
   deep phase" rather than structurally deeper relationships. The
   brief's own rule binds any fix: depth must follow the child's
   behaviour, never elapsed time alone.
5. **The "changing" and "missing" Mystery types** — absent, and
   correctly so until 1–3 exist.

None of these gaps was filled with placeholder features in this
sprint, and none of them requires a new brain, a new scheduler, a
task queue, an objective system, or any reward framework — every one
is a new pattern row, provider seam, or Composer reading over state
that already exists.

## 8. Boundaries carried forward (so nobody re-litigates them)

- The Ether never explains itself: no "this is a Mystery", no
  "challenge complete", no clue text. The one line of instruction in
  VihuPlanet is the Exploration Nudge, by the product owner's
  explicit decision, and it is about exploring — never about any
  Mystery.
- The Companion appears only inside an opened Story. It is not the
  Ether's narrator and never will be.
- No LLM orchestrates Mystery or Challenge. The Composer stays
  deterministic and inspectable.
- A Traveller is stateless (Decision 19). Every mechanism above is
  session-scoped, and any future cross-visit memory is a canon
  change, not a feature.
- Ether may repeat ingredients, never experience patterns: the
  novelty model punishes pattern repetition hardest, and CREATURE ≠
  FIXED CHALLENGE is enforced by manners (the whale that points is
  also the whale that passes silently, flees, or crosses vast and
  unexplained).

---

*Companion documents:* `docs/ETHER_EXPERIENCE_ARCHITECTURE.md` (the
Composer itself) · CLAUDE.md → Decision 58 (the locked product
decisions) · `assets/canon/vihuplanet.canon.json` → section 23 (what
a Companion may say about any of this).
