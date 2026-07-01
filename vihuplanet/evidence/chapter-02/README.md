# VihuPlanet Chapter 2 · The Dreaming Planet — Evidence

All captures generated in headless Chromium at
`deviceScaleFactor = 1`, viewport `1440 × 900`, against HEAD.

## Files

| File                          | What it shows                                                                                                             |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `01-universe.png`             | The universe at rest. Chapter 1 world alive; four storyteller planets floating with names + one-line teasers; Dreaming Planet sleeping on the right with its orbiting stars. |
| `02-floating-planets.png`     | ~1.5 s later — planets have drifted along their unique paths (proves the drift motion is per-planet, not synchronised).  |
| `03-dreaming-planet.png`      | Focus on the Dreaming Planet still asleep, halo faint, companion barely visible.                                          |
| `04-companion-awakens.png`    | After the explorer clicks the Dreaming Planet — the universe has quietened (ambient objects dimmed), the companion has woken, eyes open, smiling. |
| `05-invitation.png`           | Dialogue bubble reads *"I've been dreaming of meeting my storyteller… Would you be my storyteller?"* with three soft choices: 🌟 Yes, I'd love to! · 🏠 I already have a planet. · 🌙 Maybe later. |
| `06-motion.webm`              | ~20 s recording covering: universe → quieten → wake sequence (sleeping → stirring → waking → looking → smiling → speaking) → invitation → chose "Maybe later" → companion returns to sleep → universe brightens back. |

## Implementation

### The Explorer arrives

The child (canonically an **Explorer**) enters `vihuplanet/`. The
Chapter 1 world loads exactly as it did before. Nothing about the
sky / ground / horizon / hero prompt / moon / stars / rocket /
paper plane / hills / flowers / telescope was touched — the "The
Chapter 1 world remains untouched. Nothing disappears." rule holds.

### Four storyteller planets appear

~1.1 s after the hero prompt starts drawing in, four floating
planets settle into the sky one at a time via the shared `.settle`
Greeting motion. Each planet:

- carries a **storyteller name** (Vihaan / Aarav / Meera / Emma)
  and a **one-line teaser** (e.g. *"The dragon finally learned to
  fly."*);
- drifts along a unique gentle path (Living / `.planet-drift`,
  26–32 s per loop, staggered delays so no two planets sync);
- shows a small hand-drawn **companion** on top — dragon, star-
  dragon, fox, penguin — matching the teaser.

### The Dreaming Planet awakens curiosity

~0.4 s after the storyteller planets settle, the **Dreaming
Planet** appears on the right. It's slightly larger, has a wider
soft halo, its companion is asleep (closed eyes, tiny sleeping
"o" mouth), and four warm gold stars quietly **orbit** its centre.
It breathes gently (Living / `.breathing`, 8 s — slower than the
moon's `.breathe`). Nothing about it flashes; it simply asks to
be looked at.

### Click → quieten → wake → speak → invite

`DreamingPlanetManager.begin()` walks a state machine driven by
the `data-dp-state` attribute:

    sleeping → stirring (0.9s) → waking (1.0s) → looking (0.9s)
             → smiling (0.7s) → speaking (dialogue reveals) → chosen

The state class swaps the companion's SVG eye + mouth layers by
CSS opacity, so the awakening reads as small hand-drawn frames
turning:

- **sleeping** — closed-eye arcs, small "o" mouth
- **stirring** — half-open eye arcs, yawn mouth
- **waking** — open eyes, yawn mouth
- **looking** — open eyes, no mouth (curious pause)
- **smiling** — open eyes, smile mouth
- **speaking** — open eyes, smile, dialogue bubble visible

The moment the state leaves `sleeping`, `body.universe-quieting`
dims every ambient object except the Dreaming Planet so the
child's attention naturally follows the wake.

### Three choices

- **🌟 Yes, I'd love to!** → Companion: *"Really? Then let's get
  to know each other."* → world fades out (Journey `.fade-out`)
  → Chapter 3B will pick up here.
- **🏠 I already have a planet.** → Companion: *"Wonderful!
  Let's find your way home."* → world fades out → Chapter 3A will
  pick up here.
- **🌙 Maybe later.** → Companion: *"That's alright. I'll keep
  dreaming until you're ready."* → dialogue fades → planet
  gently returns to `sleeping`. The universe wakes back up and
  the explorer keeps exploring.

None of the three paths ever traps the explorer, per the UX
Contract's "Every choice is valid" rule.

## Architecture

Chapter 2 ships as two **new isolated modules** + three **service
placeholders**. Chapter 1 remained untouched.

    vihuplanet/
    ├── planets/               NEW — floating storyteller planets
    │   ├── planets.js         Planet registry + PlanetsManager.mount()
    │   ├── planetsData.js     4 planet descriptors
    │   └── planets.css        Planet + label styling
    ├── dreamingPlanet/        NEW — the singular Dreaming Planet
    │   ├── dreamingPlanet.js  Registry with the descriptor
    │   ├── dreamingPlanetManager.js  Wake sequence + dialogue + choices
    │   └── dreamingPlanet.css Sphere / companion states / dialogue / choices
    ├── shared/services/       NEW — placeholder interfaces only
    │   ├── RecognitionService.js
    │   ├── CompanionService.js
    │   └── PlanetService.js
    └── assets/planets/        NEW — SVG assets for all 5 planets

The retired `storyteller/` module (v0.2.0's card grid) has been
removed — the previous approach was superseded by v0.3 canon.

## Reusable systems

Every animation in Chapter 2 came from Chapter 1's `WorldMotion`
vocabulary, extended (not replaced) with new named motions:

- **Living** — `sleeping`, `breathing`, `listening`, `orbit`,
  `planet-drift` (all new in Chapter 2, all filed under the
  Living category alongside `twinkle` / `drift` / `float` /
  `breathe`).
- **Greeting** — `awakening` (a small stretch keyframe used at
  the moment the companion first opens their eyes) alongside the
  existing `drawn-in` / `warm-in` / `settle`.
- **Journey** — inherits `fade-out` (already in Chapter 2 v0.2);
  no new entries.
- **Celebration** — declared, no new entries in Chapter 2 v0.3.

The `prefers-reduced-motion` guard was extended to include every
new class + the body-level `.universe-quieting` marker.

## Placeholder services

Per the Architecture Contract (Section 6): *"Prepare interfaces
only. Do not implement."* Three services ship as declared
surfaces:

- `RecognitionService` — `identify()` / `remember()` / `findHome()`.
  A later chapter (Companion's First Meeting, Constellation
  recognition, Returning Home) implements these; MEP always
  resolves "not recognised".
- `CompanionService` — `current()` / `say()` / `setMood()`. MEP
  no-ops; Chapter 2 speaks through DreamingPlanetManager directly.
- `PlanetService` — `find()` / `all()` / `grow()` / `focus()`.
  MEP delegates to the two live registries (Planet + DreamingPlanet).

Each service module documents its future responsibility inline
so a later chapter can drop in an implementation with zero
consumer changes.

## Language canon

Every visible word in Chapter 2 was audited against the Creative
Contract:

- **Never**: Login, Register, User, Account, Password,
  Authentication, Profile, Switch User.
- **Always**: Explorer, Storyteller, Planet, Companion, Journey,
  Home, Dreaming Planet, Constellation.

The three choice labels read *"Yes, I'd love to!"*, *"I already
have a planet."*, *"Maybe later."* — no "sign in", no "continue
as", no "welcome back". The companion's response after "I
already have a planet." says *"Let's find your way home."* —
never "recover" or "restore".

## Future hooks (reserved, not implemented)

Interfaces for the extension points listed in Section 11:

- **Companion's First Meeting** — `CompanionService.setMood`,
  `RecognitionService.remember`.
- **Camera recognition** — `RecognitionService.identify` returns a
  promise that a later chapter fulfils by asking the camera; the
  MEP promise always resolves `{ recognised: false }`.
- **Constellation recognition** — `RecognitionService.findHome`
  accepts a `constellationPattern` argument; MEP no-ops.
- **Returning Home** — `PlanetService.focus(planetId)` will bring
  the storyteller's home planet to centre; MEP no-ops.
- **Traveller's Star / Home Planet / Planet growth** —
  `PlanetService.grow(planetId, delta)`; MEP no-ops.

## Known limitations

- The three "Yes" / "Already" fade-outs land on a black screen
  (there is no Chapter 3 destination yet). The Repository &
  Commit Contract says the build must stay fully functional; a
  refresh returns the explorer to a live universe. **"Maybe
  later"** always brings the universe back automatically — that
  path is fully in-Chapter-2.
- Companions on the storyteller planets are cute but simple
  silhouettes. A future polish pass can grow their expressions
  into small idle animations (e.g. the fox wags its tail; the
  penguin sways in place).
- Emma's teaser text sits close to the horizon line at 1440 ×
  900. On narrower desktops the ground green blends slightly
  with the last line of italic teaser text. Not a blocker; the
  next Chapter 2 polish pass will constrain the ground band.

## Chapter 3 readiness

Chapter 3 (A: "Returning Home" — for the explorer who says "I
already have a planet"; B: "Getting to Know You" — for the
explorer who says "Yes") plugs in through three seams:

1. `DreamingPlanetManager.onEnd(function (path) { ... })` fires
   with `'yes'`, `'already'`, or `'later'`. A future
   `chapter03/router.js` listens and mounts the appropriate
   destination.
2. `body.dreaming-fade-out` is applied for `yes` / `already` so
   the destination has a clean canvas to warm into.
3. `PlanetService.find(id)` + `PlanetService.focus(id)` are the
   entry points Chapter 3A will use to bring the explorer's home
   planet to the centre.
