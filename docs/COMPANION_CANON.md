# VihuPlanet Companion Canon (frozen — V3)

> Sprint: Companion Canon V2 (Guardian & Creator Bond), superseding the
> earlier "Companion Canon Freeze & Asset Integration" sprint's own
> canon wherever the two disagree — per that sprint's own governing
> instruction, "this sprint is a product canon update, not a feature
> implementation... where existing code conflicts with the new canon,
> the canon takes precedence." This document freezes the product
> philosophy and every entity's properties. The technical
> implementation — the Companion Package Contract, the generic runtime,
> and Studio's mode-driven integration — lives in
> `docs/COMPANION_ENGINE.md`; this document is the "why" and "what,"
> that one is the "how."
>
> **V3** adds two canon sections and one vocabulary correction, all from
> locked product decisions:
>
> - **Canon 5 — the Guide responsibility** (Companion v1 Foundation):
>   *"Companion is the creator's guide inside VihuStudio. Its
>   responsibility is to help children successfully use the platform."*
> - **Canon 6 — Studio Rite** (Studio Rite Product Decision): a
>   mandatory first chapter before Studio Home, guided by Lumo, ending
>   before Publish.
> - **"Visitor" → "Traveller"** throughout. This document and
>   `docs/KID_JOURNEY.md` were the last two places using the older word;
>   the product, the Gateway, `assets/registry.json` and the code have
>   always said Traveller.
>
> Nothing in V2 is removed, weakened, or reinterpreted — the Story Egg,
> Lumo, Story Companions, the Creator Ceremony, and the Magic Card bond
> are all unchanged. Canon 2 gained exactly one widened clause (Lumo
> appears at two thresholds rather than one); **Canon 1 was not touched
> at all.**

## Product Philosophy

A companion is not an assistant, a chatbot, a teacher, or an AI tutor.
A companion is a **creative friend**, whose purpose is to encourage
imagination, celebrate creativity, and make the Studio feel alive. A
companion never critiques or scores a child's work.

**A friend who knows the place.** V3 does not soften the sentence above
— it names what was always implicit in it. A friend who watches a child
struggle with a door they cannot open, and says nothing, is not being a
good friend. Helping a child work the Studio is *friendship inside a
place both of them live in*; it is not tutoring, and it is not
assistance in the productivity sense. The line the canon draws has never
been "the companion must not be useful." It is **the companion must
never take over the creating.** Canon 5 states exactly where that line
falls.

**Every Traveller enters VihuPlanet with potential.** That potential is
represented by the **Story Egg**. The Story Egg belongs to nobody. It
quietly accompanies the Traveller during creation. The Story Egg is not a
companion. It is waiting for a Creator.

**Lumo is not the user's companion — Lumo never bonds with any Creator.**
Lumo is the **Guardian of Story Companions**: the first Story Dragon,
keeper of Creator Ceremonies, and the official mascot of VihuPlanet.
Lumo belongs to VihuPlanet, cannot be claimed, and never appears on a
Magic Card. Lumo welcomes every Creator during their own Creator
Ceremony, but is never owned by any of them.

**Every Creator receives exactly one Story Companion, during their
Creator Ceremony.** The Story Companion chooses the Creator — the
Creator never manually selects one. This choice is part of the
mythology of VihuPlanet; the implementation may use deterministic
assignment or configuration today while future logic (avoiding repeats
across siblings, seasonal companions, generations) evolves without
changing this canon.

## Canon 1 — Story Egg

Frozen as an official platform entity.

**Properties**

- Represents every Traveller.
- Appears only in Traveller mode.
- Has no face.
- Has no limbs.
- Never speaks.
- Expresses itself only through pose, glow, and magical effects — it
  never receives emotional poses such as `happy`/`sad`.
- Exists only until the first Creator Ceremony.
- Permanently disappears once the Creator is born.

**Supported canonical poses**

`hero` · `idle` · `curious` · `thinking` · `excited` · `sleep` · `magic` · `hatching`

(`magic` is new in V2 — used during the Creator Ceremony's own Glow
beat, see Canon 4 below.)

## Canon 2 — Lumo, the Guardian

Frozen as the official mascot of VihuPlanet.

**Properties**

- Species: Story Dragon
- Role: **Guardian of Story Companions** — keeper of Creator Ceremonies.
- Owner: VihuPlanet.
- Cannot be claimed by users. Never bonds with any Creator.
- Appears **only at the two thresholds** — the **Studio Rite** (Canon 6)
  and the **Creator Ceremony** (Canon 4). Widened from "only during
  Creator Ceremonies" when Studio Rite was locked; the principle is
  unchanged, and the set of thresholds is closed at two. Lumo is still
  not a standing "Creator's companion" in the ongoing widget the way
  earlier canon revisions treated it, and is still torn down when a
  threshold ends.
- Never appears on a Magic Card.
- Introduces the concept of Story Companions and blesses the Story Egg
  during the ceremony.

**Supported canonical poses**

`hero` · `idle` · `wave` · `curious` · `think` · `celebrate` · `sleep`

(Lumo's real, uploaded asset set also ships `talk` — real art the
engine already supports via `speak()`'s own settle mechanism, kept
rather than discarded. The Companion Pose Contract v2 below applies to
Story Companions, not to the Guardian — Lumo is deliberately not
expanded to that 12-pose list, since Lumo never hatches and never needs
`sad`/`surprised`/`hatching` etc.)

## Canon 3 — Story Companions & Species

Every Creator's own bonded companion is a **Story Companion** — a
distinct entity from the Guardian, belonging to a **Species**. Species
are first-class metadata (`assets/registry.json`'s own `species` field,
also carried on every claimed Magic Card):

```
Story Dragon      -> Lumo (the Guardian, not a Story Companion)
Dream Sprite      -> Nimbus
Ink Spirit        -> Quill
Bloomling
Stardust Wisp
Crystal Keeper
Melody Spirit
Ember Sprite
Water Whisper
Stone Guardian
```

Only the species/companion pairs actually registered in
`assets/registry.json` (`role:"companion"`) are real, bondable
companions today — see "Asset Registration" below. The remaining
species names above are reserved vocabulary for future companions, not
yet implemented.

**Companion Pose Contract v2** — every Story Companion implements the
exact same 12-pose vocabulary:

`hero` · `idle` · `wave` · `curious` · `think` · `happy` · `celebrate` · `sleep` · `sad` · `surprised` · `magic` · `hatching`

`hatching` is mandatory and used **only** during the Creator Ceremony's
birth sequence (Canon 4) — a Story Companion never re-hatches.

## Canon 4 — Creator Ceremony (the official onboarding flow)

The first successful Publish is the **Creator Ceremony**, not merely a
publish action. "First" means the first *real* Publish of the Creator's
own story: Studio Rite (Canon 6) never reaches Publish, so it can never
consume this moment. The Ceremony fires at most once, ever
(`MagicCard.shouldOfferAwakening()`), and it is reserved for a story the
child actually meant to make:

```
Traveller
  ↓
Story Egg
  ↓
Create
  ↓
First Publish
  ↓
Magic Card awakens
  ↓
Lumo arrives
  ↓
Lumo blesses the Story Egg
  ↓
Story Egg hatches
  ↓
A Story Companion is born
  ↓
The Companion chooses the Creator
  ↓
Magic Card is permanently bonded
  ↓
Creator Journey begins
```

Implemented as a reusable, data-driven beat sequence
(`CompanionDirector.getCeremonySequence()`, `js/companionDirector.js`)
rendered on a big, centered ceremony stage (`js/magicCardUI.js`):
Story Egg (idle) → **Glow** (Story Egg, `magic` pose) → **Cracks**
(Story Egg, `hatching` pose) → **Lumo arrives** (`wave`, speech) →
**Blessing** (Lumo, `celebrate` pose + a real sparkle burst) →
**Companion Hatching pose** (the randomly-bonded Story Companion,
`hatching`) → **Companion Hero pose** (`hero`, speech) → the Magic Card
updates, now permanently bonded → Creator Home. The sequence is pure
data — reusable for any future companion with zero code change.

## Canon 5 — The Guide Responsibility (added in V3)

Frozen as the Companion's second responsibility, alongside presence.

A Story Companion has two jobs. The first, from V2, is **to be there** —
pose, glow, greet, celebrate. The second, new here, is **to help its
Creator successfully use VihuStudio**.

**Properties**

- The Companion answers questions about **VihuStudio before it answers
  questions about the world.** Platform guidance is the responsibility;
  everything else is a later version or nothing at all.
- The Companion is **the creator's guide inside VihuStudio** — it knows
  where things are, what a control does, why something is locked, and
  what is worth doing next.
- The Companion **explains and points. It does not create.** It may show
  a child where the button is; it never presses it on the child's
  behalf without the child asking for exactly that, and never at all for
  anything that cannot be undone.
- The Companion is **honest about the Guardrails**. When a Theme Author
  has marked an object un-moveable, the Companion says so kindly and
  truthfully. It never tells a child to try something the platform will
  refuse — that teaches a child the app is broken.
- The Companion **must work with no network and no AI.** Every question
  in the Guide responsibility is answered from VihuStudio's own live
  state and its own authored knowledge. An external model may only ever
  make an answer *warmer* — never *possible*.
- **Silence remains the default.** The Guide responsibility is
  answering, not volunteering. The Companion earns each thing it says.
- **The Story Egg is exempt.** A Traveller's Story Egg never speaks
  (Traveller Behaviour, below) and therefore never guides. The Guide
  responsibility belongs to a bonded Story Companion, and to Lumo only
  within a Creator Ceremony.

**The line, stated once**

| The Companion may | The Companion may not |
|---|---|
| Say where a control is | Decide what the story should say |
| Explain what a button does | Write, rewrite, or continue a story |
| Explain why something is locked | Override or work around a Guardrail |
| Say what is missing before publishing | Score, grade, rank, or critique |
| Offer to take the child to a control | Perform an unrepeatable change unasked |
| Notice a hidden or off-page object | Remember the child across sessions |

## Canon 6 — Studio Rite

Frozen as an official platform capability. The three questions this
section previously left open were answered by the product owner in the
Studio Rite Product Decision, and are resolved below.

**What is locked**:

- Studio Home is no longer the first thing a user reaches. A mandatory
  **Studio Rite** precedes it.
- Every user completes the Rite **exactly once**. Studio Home stays
  locked until it is complete. This is permanent.
- The Rite is **not** a tutorial, feature onboarding, or a product
  walkthrough. It is the creator's **first chapter inside VihuPlanet**,
  establishing what VihuStudio is, why it exists, who the user is, what
  they are about to create, and the rhythm of creation.
- **It teaches through creation, not explanation.** A user finishes the
  Rite having made something, not having read something.
- Platform vocabulary — Traveller, Creator, Companion, Story Egg, World,
  Place, Experience — is **introduced during the Rite** and must not
  appear unexplained before it.
- The Rite always has a guide, and the guide depends on lifecycle: a
  first-time user is guided differently from a returning Creator, who is
  guided by their own bonded Companion. **The Rite itself is identical
  either way; only the guide changes.**
- Completion permanently unlocks the Studio. Afterwards the Companion may
  assume the user holds the shared vocabulary.

**The three questions, answered**

1. **Lumo guides the Rite.** The Story Egg is unchanged and unchallenged
   — it never speaks, never teaches, never guides, and expresses itself
   through animation alone, exactly as Canon 1 and Traveller Behaviour
   already state. Lumo's remit widens by one clause (Canon 2) to cover
   **both thresholds**. Nothing in Canon 1 changes.
2. **The Rite ends before Publish.** It never reaches Publish, never
   triggers the Creator Ceremony, and never awakens the Story Egg. The
   first real Publish remains sacred (Canon 4).
3. **The platform says Traveller.** This document and
   `docs/KID_JOURNEY.md` were the only two places still saying
   "Visitor"; both now match the product, the Gateway,
   `assets/registry.json` and the code. Asset Registration's
   `role:"visitor"` was additionally a factual error — the registry has
   always said `traveller` — and is corrected here.

**The Story Egg during the Rite**

Lumo guides, but the Story Egg **accompanies** — the Rite is meant to
strengthen the child's bond with the Egg, not to sideline it while
someone else talks. The Egg reacts through animation only.

Its reactions are drawn from the canonical Traveller pose set, and two
of those are unavailable to the Rite by construction: `hatching` and
`magic` belong exclusively to the Creator Ceremony (Canon 4), which the
Rite never triggers. `hero` has no art yet (disclosed under Asset
Registration). **The Rite's Egg vocabulary is therefore exactly five
real poses — `idle`, `curious`, `thinking`, `excited`, `sleep`** — and
it needs no others. The Egg still never receives an emotional pose such
as `happy`/`sad`; Canon 1 is untouched.

**Relationship to the Gateway**

Studio Rite **extends** the Traveller Gateway; it does not replace it.
Lumo already opens the Gateway and introduces himself there, so the
Gateway's arrival and the Rite's first chapter are one continuous
journey with one guide. The Gateway is not redesigned.

## Companion Versions

The canon grows by version; each version adds responsibility without
removing any earlier one.

| Version | Responsibility | Status |
|---|---|---|
| V1 — Presence | Story Egg, Lumo, Story Companions, Creator Ceremony, the Magic Card bond | Shipped (Canon V2 above) |
| V1 — Guide | Platform guidance: where things are, what controls do, why something is locked, what to do next | **Next** (Canon 5) |
| Later — Voice | Warmer, per-companion phrasing of answers the platform already computes | Not started |
| Later — Curiosity | Educational and world questions; requires an external model | Not started |
| Later — Memory | Anything remembered across sessions | Not started |
| Later — Story Journey | Replay of how a story was made | **Out of scope. Do not implement.** |

Explicitly **not** Companion responsibilities at any version currently
planned: AI storytelling, creative writing, story continuation,
internet search, and creator memory.

## Magic Card — the permanent record of the Creator Bond

Every claimed Magic Card must contain the bonded Story Companion — the
companion is not an optional decoration, it is part of the Creator's
identity. The card carries: Creator Name, Companion Portrait, Companion
Name, Species, Creator Since, Stories Created, Worlds Created
(Achievements are reserved for a future sprint, not built yet). **Lumo
never appears on the Magic Card** — only the bonded Story Companion.

## Traveller Behaviour

During Traveller mode, quiet accompaniment only — **no speech bubbles, no
onboarding dialogue, no tutorial.**

| Studio Event | Story Egg Pose |
|---|---|
| Studio opens | `idle` |
| User typing | `curious` |
| Creating content | `thinking` |
| Artwork inserted | `excited` |
| User inactive | `sleep` |
| Publish | `hatching` |

## Creator Behaviour

After a successful Creator Ceremony:

- The Story Egg never appears again for that Creator.
- The Creator's own **bonded Story Companion** (never Lumo) becomes the
  ongoing presence — greeting on boot/wake, reacting to typing/creating/
  artwork/publishing.
- Lumo is not shown again outside of any future Creator Ceremony.

## Asset Registration

Four canonical asset folders, registered through the existing Companion
Registry (`assets/registry.json`) — no new registry mechanism, no
hardcoded paths. Real, uploaded canonical art lives directly under
`assets/` (top-level):

```
assets/
  registry.json
  story-egg/    role:"traveller"   — 6 of 8 poses real; hero.png + magic.png disclosed pending
  lumo/         role:"guardian"  — 8 real poses (a superset of Canon 2's 7)
  nimbus/       role:"companion" — Dream Sprite; declared, ALL 12 poses pending upload (disclosed)
  quill/        role:"companion" — Ink Spirit; declared, ALL 12 poses pending upload (disclosed)
```

Nimbus and Quill are seeded so the Creator Ceremony's random
Companion-chooses-the-Creator assignment has a real pool of more than
one entry to prove genuine randomness from — their `companion.json`/
`animations.json` declare the full 12-pose contract, but **no
placeholder art was generated for either** (unlike Lumo's own original
Sprint C1 bootstrap, which drew placeholder Canvas art before real art
existed) — every pose image 404s gracefully via
`CompanionEngine`'s existing, proven degradation until real production
art replaces this disclosed gap.

## Implementation Constraints (honoured, not just stated)

- The Companion Runtime (`js/companionEngine.js`) was **not** touched
  by this sprint — zero lines changed, verified via `git diff`. It has
  no idea whether it's rendering a Story Egg, Lumo, or any Story
  Companion; it only ever receives a plain registered id and a plain
  pose name.
- The Companion Registry mechanism (`CompanionEngine.loadRegistry()`)
  was **not** redesigned — `registry.json` simply gained a third role
  value (`companion`) and two more entries.
- The Companion Package Contract (`companion.json` /
  `personality.json` / `animations.json`) was **not** redesigned — the
  12-pose vocabulary is product data authored into each package's own
  `states` map, not a new required schema field.
- There is no `if (id === 'lumo')` / `if (id === 'nimbus')` / etc.
  anywhere in `js/companionEngine.js` or `js/companionDirector.js` —
  verified via the same comment-stripped static scan this project's
  Companion sprints have used from the start. A Creator's specific
  bonded companion is resolved from their own Magic Card's
  `companionId` field, matched against the registry — never a
  hardcoded id.

See `docs/COMPANION_ENGINE.md` for the full technical account.

## Where the rest lives

| Document | Answers |
|---|---|
| This file | *Why* and *what* — product philosophy, entities, responsibilities, boundaries |
| `docs/COMPANION_ENGINE.md` | *How* the runtime, package contract and Studio integration work today |
| `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` | The long-range intelligence architecture — context/brain/actions/gateway, knowledge tiers, AI boundary |
| `docs/COMPANION_V1_PROPOSAL.md` | The Companion v1 (Guide) implementation proposal — the near-term slice of the above, plus the ask surface |

Canon 5 is the product decision. `docs/COMPANION_V1_PROPOSAL.md` is the
proposed implementation of it, and is still subject to `CLAUDE.md`'s
standing rule that architecture changes require explicit approval.
