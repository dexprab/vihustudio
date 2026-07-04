# VihuPlanet Hero — Canon

This is the single authoritative record of what the Hero *is* and *why*
it works the way it does. If you are picking up Hero development in a
new session, **read this file first** — it should be enough to
understand product intent and locked decisions without any prior
conversation history.

This file records **permanent philosophy and locked product
decisions**. It is not a status tracker and not a changelog:

| Question                                          | Where to look |
|----------------------------------------------------|----------------|
| Why does the Hero work this way? What's locked?     | **This file.** |
| What's the current MEP version, what's done, what's next? | [`BUILD.md`](BUILD.md) |
| What changed, sprint by sprint, and when?           | [`CHANGELOG.md`](CHANGELOG.md) |
| Where does each file live, how do I run it?         | [`README.md`](README.md) |
| What's the exact palette / line-weight / composition discipline? | [`artDirection/illustrationRules.js`](artDirection/illustrationRules.js) (Art Direction v1.0 — its own single source of truth, referenced here, not duplicated) |
| How do artists add new artwork?                     | [`world-library/README.md`](world-library/README.md) |
| Point-in-time screenshots/recordings per sprint      | [`evidence/`](evidence) — historical captures, not living documentation. If evidence ever conflicts with this file, this file wins. |

Sections marked **(Locked)** are permanent product decisions.
Changing them requires an explicit new sprint that says so — the same
bar as an Art Direction Sprint. Sections marked **(Current)** describe
today's implementation and are expected to evolve.

---

## 1. Hero Philosophy (Locked)

VihuPlanet is not a social network.

The Hero is a magical map of Story Worlds. Children discover places
before they discover storytellers.

Technology remains invisible:

- Authentication becomes **finding home**.
- Registration becomes **awakening**.
- Discovery becomes **exploration**.

Wonder always comes before interaction. Children learn through
touching and exploration. Everything on the Hero should invite
curiosity.

This extends, and does not replace, the canon locked since Chapter
2 (v0.3.0) and Art Direction v1.0 (v0.3.5):

- **Explorer** is the starting state. Everyone entering VihuPlanet
  begins as an Explorer. Exploration is always free — no login, no
  registration, no identity required.
- **Storyteller** is simply an Explorer who accepted a Companion's
  invitation.
- **The Companion chooses the Storyteller.** Never the other way
  around. Children do not choose Companions. This is locked.
- Adults appear only when the real world requires them.
- The universe existed long before the Explorer arrived and will
  continue living long after they leave.
- Companions are independent inhabitants, not mascots. They are
  rarely front-facing.
- Wonder before action. Observation before interaction.
- Illustration before interface. Play before purpose. Curiosity
  before instruction.

**Language canon** (audited every sprint against every visible word):

- **Never**: Login, Register, User, Account, Password, Authentication,
  Profile, Switch User.
- **Always**: Explorer, Storyteller, Story World, Companion, Journey,
  Home, Dreaming Realm, Constellation.

## 2. Hero Purpose (Locked)

The Hero is the opening spread of a premium children's picture book.

It should feel:

- Calm.
- Timeless.
- Handcrafted.
- Magical.

It should never feel:

- Busy.
- Technical.
- Dashboard-like.

## 3. Story World Canon (Locked)

Every storyteller owns one Story World. Every Story World has:

- World Name
- Storyteller
- Stories
- Companion
- Description

**The Hero displays ONLY the World Name.** Examples: *Dragon Valley*,
*The Painted Sky*, *Frostsong Cove*.

Storyteller information intentionally remains hidden on the Hero — not
missing, not deferred by omission, but a deliberate design decision.
Children should remember Story Worlds rather than user profiles. No
aria-label or other assistive-tech fallback exposes it either; the
sighted and screen-reader experiences match.

**World Naming**: Story World names are chosen by storytellers and
become the primary identity of places. Storytellers remain part of
the data model (`planets/planetsData.js`'s `storytellerName` field)
but are revealed later, inside the experience — not on the Hero.

Implementation note: Story Worlds are **landmasses, never spheres or
orbs** (Art Direction v1.0, `illustrationRules.js`) — mountains,
meadows, plateaus, islands. This applies to the four Story World
planets specifically; it does not extend to the Dreaming Realm, which
has always been its own distinct form (§5).

## 4. Dreaming Realm Canon (Locked)

The Hero contains **one Dreaming Realm** — a single interaction, one
wake sequence, one Companion-invitation flow per universe.

The Dreaming Realm contains **multiple canonical Dreaming Homes**.
Dreaming Homes are not cosmetic variants — they are permanent
locations within the VihuPlanet universe. This is not a contradiction
of "one Dreaming Realm": the Realm is the singular *entity* and
*interaction*; a Dreaming Home is which of several canonical
*locations* it visually presents as, chosen once per browser session
(§8). There is still exactly one Dreaming Realm object in the DOM at
any time, exactly as there has always been.

Companions live inside Dreaming Homes. **The Companion chooses the
Storyteller. Children do not choose Companions.** (Restated from §1 —
this is the Dreaming Realm's core mechanic and the philosophy it
exists to express.)

### Dreaming Home Implementation (Current)

- The Dreaming Planet engine — state machine, wake sequence, dialogue,
  companion logic, CSS transitions, interaction handlers — is
  unchanged since Chapter 2 (v0.3.0) and is treated as **frozen
  infrastructure**: sprints that touch Dreaming Home *artwork* must
  not touch this engine.
- Production artwork is **layered into** the existing SVG rather than
  replacing the implementation: `assets/planets/dreaming.svg` clips a
  World-Library-resolved `<image>` to the same landmass silhouette
  the SVG has always drawn, sitting behind the dwelling/companion/mist
  groups that carry every animation hook. An empty World Library falls
  back to the original gradient with zero behavioural change.
- **Three canonical Dreaming Homes are currently supported**
  (`dreaming-world-01/02/03`, `world-library/dreaming-home/`).
- Dreaming Home selection is **session-based** — one home per browser
  session, held steady across reloads (§8's mechanism).
- Future Dreaming Homes can be added by dropping new production art
  into the World Library; the engine does not need to change.

## 5. Hero Composition Canon (Locked)

The Hero's visual hierarchy, front to back:

```
VihuPlanet Logo
      ↓
Story Worlds
      ↓
Dreaming Realm
      ↓
Discovery Telescope
      ↓
Atmosphere
```

Atmosphere exists only to support the Hero. Story Worlds remain the
primary visual focus at all times — nothing atmospheric (sky, clouds,
Story Meadow, Dream Trail) is permitted to compete with them for
attention.

## 6. Hero Atmosphere (Locked philosophy / Current mechanism)

Hero atmosphere changes between browser sessions. Currently varied:

- Sky
- Clouds
- Story Meadow
- Dreaming Home
- Dream Trail (Story Path)
- Telescope appearance (Telescope Library — see §8; the landmark
  itself is permanent, only which canonical telescope it presents as
  varies, same distinction as Dreaming Realm/Dreaming Home in §4)

Selections remain fixed for the duration of the browser session — the
Hero should always feel familiar but never identical.

**Current mechanism** (`shared/worldLibrary.js`): the first
`resolveAt()` call for a session-varied type picks a random offset and
persists it to `sessionStorage`; every later call in that tab reuses
it. A fresh session (new tab/context) picks a new offset. Story Worlds
are permanent (§3) and never vary.

## 7. Story Meadow Canon (Locked)

Story Meadow is the foreground of the Hero. **Story Meadow is not
grass** — it represents the magical foreground where the child begins
exploring VihuPlanet.

Story Meadow is intentionally independent from Sky assets — they vary
separately, are sourced from separate World Library collections, and
carry no assumption that a given sky pairs with a given meadow.

Future seasonal Story Meadows are supported — the World Library
collection can grow without any registry or engine change.

## 8. Discovery Telescope Canon (Locked)

The Telescope is the child's gateway to Story Worlds beyond the
visible Hero. It represents **curiosity, not navigation** — it is not
a menu or a link; it is an invitation to look further.

The telescope is a single permanent landmark, exactly as the Dreaming
Realm is a single permanent entity (§4): a **Telescope Library**
(Sprint H4-H6, `world-library/telescope/`) provides multiple
canonical telescope appearances it may present as, chosen once per
browser session through the same mechanism as every other
session-varied type (§6). This is not a contradiction of "one
telescope" — the landmark's role, position, and behaviour stay
singular; only which canonical telescope it visually presents as
varies. Future telescopes are art + a manifest entry, same as any
other World Library collection (`world-library/README.md`) — no code
change.

A Hero Variant Audit (post-H4-H6) found this folder briefly renamed
to `telescopes/` (plural) in this repo, which broke selection
entirely — the automated World Library sync mirrors the source
repo's own folder names destructively on every run, so a
destination-only rename doesn't survive the next sync. The folder
name here is singular for exactly that reason: it must match
whatever the source pipeline actually calls it, not a name chosen for
readability in this repo alone.

Sprint H4-H6 also gave the telescope hover and click tactile + audio
acknowledgment (`interactive: true`, was `false`) — a response to
being noticed, matching Story Worlds' treatment, not a redesign of
what it does. **"Looking through it" remains undefined and
unimplemented** — no peering interaction, no menu, no navigation
exists yet, and clicking it does not go anywhere. Any future chapter
that defines what looking through the telescope does is still a new
decision this file doesn't make today.

## 9. Hero Performance Philosophy (Locked)

The Hero must remain ultra-light. Performance goals:

- Instant appearance.
- Minimal rendering cost.
- Minimal memory usage.
- Minimal DOM complexity.
- Minimal animation.
- Minimal visual noise.
- Minimal cognitive load.

Default state should feel calm. Magic should appear through
interaction rather than constant animation.

> **Stillness is the default. Magic is earned through interaction.**

This is not a new invention — it restates and locks a rule Art
Direction v1.0 already established: *"Motion is peripheral. No
greeting, journey, or celebration motion plays until the Explorer
acts. The idle universe uses only Living motion."*
(`evidence/chapter-02.5/README.md`)

Every Hero element must justify its existence. **If removing an
element does not reduce wonder, it should not exist.**

## 10. Hero Asset Philosophy (Locked)

**Permanent Hero elements** — define identity, never session-varied:

- Logo
- Story Worlds
- Dreaming Realm
- Discovery Telescope

**Atmospheric Hero elements** — may vary by session (§6):

- Sky
- Clouds
- Story Meadow
- Flowers
- Dream Trail (Story Path)
- Dream particles (Story Seed)

Note on current implementation: not every atmospheric element listed
above is session-varied yet — `SESSION_VARIED_TYPES` in
`shared/worldLibrary.js` currently covers sky, cloud, story-meadow,
dreaming-home, trail, and telescope (§8's Telescope Library — the
telescope itself stays a Permanent element above; only its artwork is
atmospheric). Flowers and Dream particles (Story Seed) are
World-Library-sourced but still resolve deterministically. Extending
variation to them is compatible with this canon and does not require
a new decision — just implementation.

## 11. World Library Canon (Locked)

The World Library remains the single production source of truth for
Hero artwork. Artwork pipeline:

```
Canva → PNG Export → GIMP → 2048×2048 canvas → production/
   → GitHub Action (Asset Normalizer + World Library Sync)
   → Manifest Generation → VihuStudio (vihuplanet/world-library/)
   → Hero (shared/worldLibrary.js)
```

- **Manifest-based loading is the permanent architecture.** Each
  collection folder carries a `manifest.json` (a flat array of PNG
  filenames) that the Hero fetches directly. **No directory
  discovery** — GitHub Pages and most static hosts don't support it,
  and manifest-based loading works identically everywhere.
- Every World Library type resolves through `WorldLibrary.resolve()` /
  `resolveAt()` / `resolveMany()`; an empty or unreachable manifest
  always falls back to the caller's existing placeholder (SVG, or
  nothing at all for foreground-only objects like Story Meadow). This
  fallback behaviour is permanent — it's what lets artwork land
  incrementally without ever breaking the Hero.
- The World Library repository (`vihuplanet-world-library`) is out of
  scope for VihuStudio sprints to modify directly — it is synced in
  automatically. See `world-library/README.md` for the artist-facing
  workflow and the current collection list.

## 12. Hero Design Principles (Locked)

The Hero should:

- Feel like opening a storybook.
- Remain emotionally calm.
- Reward curiosity.
- Encourage exploration.
- Preserve children's originality.
- Never become a dashboard.
- Never resemble a social network.
- Never overwhelm children with information.

**Less is more. Subtraction is preferred over addition. Premium
quality comes through restraint.**

## 13. Hero MEP Status (Current)

See [`BUILD.md`](BUILD.md) for the authoritative, currently-maintained
status table (completed / in progress / future). It is not duplicated
here to avoid the two files drifting out of sync.

## 14. Repository Readiness

This file, together with `BUILD.md` (status), `CHANGELOG.md`
(history), `README.md` (structure), `artDirection/illustrationRules.js`
(visual technique), and `world-library/README.md` (artist workflow),
is intended to be a complete, non-contradictory record of the Hero.
Distinctions this set of documents maintains on purpose:

- **Locked product philosophy** — this file, sections marked (Locked).
- **Locked implementation decisions** — this file (e.g. manifest-based
  loading, session-variation mechanism, frozen Dreaming Planet engine).
- **Current implementation status** — `BUILD.md`.
- **Future roadmap** — `BUILD.md`'s Future section.
- **Completed milestones, chronologically** — `CHANGELOG.md`.
- **Active / deferred work** — `BUILD.md`.

If a future sprint changes a Locked section here, that sprint must
update this file in the same commit — the same discipline
`illustrationRules.js` already holds itself to for Art Direction.
