# VihuPlanet Companion Canon (frozen)

> Sprint: Companion Canon Freeze & Asset Integration. This document
> freezes the product philosophy and the two entities' properties. The
> technical implementation of this canon — the Companion Package
> Contract, the generic runtime, and Studio's mode-driven integration —
> lives in `docs/COMPANION_ENGINE.md`; this document is the "why" and
> "what," that one is the "how."

## Product Philosophy

A companion is not an assistant, a chatbot, a teacher, or an AI tutor.
A companion is a **creative friend**, whose purpose is to encourage
imagination, celebrate creativity, and make the Studio feel alive. A
companion never critiques or scores a child's work.

**A Visitor is not yet a Creator.** A Visitor therefore does not have a
companion — instead, every Visitor is represented by a **Story Egg**,
symbolizing creative potential. Only after the first successful publish
and Magic Card creation does the Creator officially begin their
journey.

**Lumo is not the user's companion.** Lumo is the **Guardian of Story
Companions** and the official mascot of VihuPlanet. Lumo belongs to
VihuPlanet. Future personal companions will belong to individual
Creators — a concept this canon reserves but does not build.

## Canon 1 — Story Egg

Frozen as an official platform entity.

**Properties**

- Represents every Visitor.
- Appears only in Visitor mode.
- Has no face.
- Has no limbs.
- Never speaks.
- Expresses itself only through pose, glow, and magical effects.
- Exists only until the first Creator ceremony.
- Permanently disappears once the Creator is born.

**Supported canonical poses**

`hero` · `idle` · `curious` · `thinking` · `excited` · `sleep` · `hatching`

## Canon 2 — Lumo

Frozen as the official mascot of VihuPlanet.

**Properties**

- Species: Story Dragon
- Role: Guardian of Story Companions
- Owner: VihuPlanet
- Cannot be claimed by users.
- Appears during Creator ceremonies.
- May welcome returning Creators.
- Introduces the concept of Story Companions.
- Does not replace the user's future personal companion.

**Supported canonical poses**

`hero` · `idle` · `wave` · `curious` · `think` · `celebrate` · `sleep`

(Lumo's real, uploaded asset set also ships `talk` — a real pose with
real art the engine already supports via `speak()`'s own settle
mechanism, kept rather than discarded once the canonical upload
arrived as a superset of this list; Director's own choreography still
never sets it directly. See `docs/COMPANION_ENGINE.md`'s changelog for
the full asset-integration account, including the correction of this
document's own original path assumption.)

## Canon 3 — Creator Lifecycle

Frozen as the canonical onboarding flow:

```
Visitor
  ↓
Story Egg
  ↓
Create
  ↓
Publish
  ↓
Magic Card
  ↓
Lumo Ceremony
  ↓
Creator
  ↓
Future Personal Companion
```

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

After a successful Creator ceremony:

- The Story Egg never appears again for that Creator.
- Lumo becomes available as the Guardian.
- Lumo may greet returning Creators using existing pose animations.

## Asset Registration

Two canonical asset folders, registered through the existing Companion
Registry (`assets/registry.json`) — no new registry mechanism, no
hardcoded paths. Real, uploaded canonical art lives directly under
`assets/` (top-level, matching the sprint's own literal expected
structure — an earlier draft of this integration mistakenly nested
these under `assets/companions/`, corrected once the real upload
landed at the real, un-nested location; see
`docs/COMPANION_ENGINE.md`'s changelog):

```
assets/
  registry.json
  story-egg/
    idle.png · curious.png · thinking.png ·
    excited.png · sleep.png · hatching.png
    companion.json
    animations.json
  lumo/
    hero.png · idle.png · wave.png · curious.png ·
    think.png · talk.png · celebrate.png · sleep.png
    companion.json
    personality.json
    animations.json
```

Lumo's 8 real, uploaded PNGs are a superset of Canon 2's own 7-pose
list above (`talk` included) — kept, not trimmed, since discarding
real uploaded art to match a frozen list exactly would have thrown
away genuine canonical content for no reason. Story Egg's real,
uploaded PNGs cover 6 of Canon 1's 7 poses — `hero.png` is the one
file not yet uploaded; see `docs/COMPANION_ENGINE.md`'s "Asset Status"
section for exactly what's disclosed as outstanding and why nothing
was fabricated in its place.

## Implementation Constraints (honoured, not just stated)

- The Companion Runtime (`js/companionEngine.js`) was **not** touched
  by this sprint — zero lines changed. It still has no idea whether
  it's rendering a Story Egg or a Companion; it only ever receives a
  plain registered id and a plain pose name.
- The Companion Registry mechanism (`CompanionEngine.loadRegistry()`)
  was **not** redesigned — `registry.json` simply gained one new
  optional field per entry (`role`) and a second entry.
- The Companion Package Contract (`companion.json` /
  `personality.json` / `animations.json`) was **not** redesigned — no
  new required fields, no new file types.
- There is no `if (id === 'lumo')` or `if (id === 'story-egg')`
  anywhere in `js/companionEngine.js` or `js/companionDirector.js` —
  verified via the same comment-stripped static scan this project's
  Companion Engine sprints have used from the start. Visitor-vs-Creator
  behaviour is expressed as one small, data-driven `MODES` table in
  `js/companionDirector.js`, keyed by mode (`visitor`/`creator`), never
  by literal companion id.

See `docs/COMPANION_ENGINE.md` for the full technical account —
architecture, the updated Package Contract, the frozen public API, and
exactly how Studio now resolves Visitor vs. Creator mode.
