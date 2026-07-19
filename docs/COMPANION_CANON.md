# VihuPlanet Companion Canon (frozen — V2)

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

## Product Philosophy

A companion is not an assistant, a chatbot, a teacher, or an AI tutor.
A companion is a **creative friend**, whose purpose is to encourage
imagination, celebrate creativity, and make the Studio feel alive. A
companion never critiques or scores a child's work.

**Every Visitor enters VihuPlanet with potential.** That potential is
represented by the **Story Egg**. The Story Egg belongs to nobody. It
quietly accompanies the Visitor during creation. The Story Egg is not a
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

- Represents every Visitor.
- Appears only in Visitor mode.
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
- Appears **only** during Creator Ceremonies — Lumo is not a
  standing "Creator's companion" in the ongoing widget the way earlier
  canon revisions treated it.
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
publish action:

```
Visitor
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

## Magic Card — the permanent record of the Creator Bond

Every claimed Magic Card must contain the bonded Story Companion — the
companion is not an optional decoration, it is part of the Creator's
identity. The card carries: Creator Name, Companion Portrait, Companion
Name, Species, Creator Since, Stories Created, Worlds Created
(Achievements are reserved for a future sprint, not built yet). **Lumo
never appears on the Magic Card** — only the bonded Story Companion.

## Visitor Behaviour

During Visitor mode, quiet accompaniment only — **no speech bubbles, no
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
  story-egg/    role:"visitor"   — 6 of 8 poses real; hero.png + magic.png disclosed pending
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
