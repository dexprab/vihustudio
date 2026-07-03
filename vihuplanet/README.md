# VihuPlanet

The entrance to a universe.

This is **not** VihuStudio. VihuStudio is one of several destinations
that will live inside VihuPlanet; a future chapter plugs it in as one
landmark alongside others.

- **MEP Version:** see [`BUILD.md`](BUILD.md)
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md)
- **Evidence packets:** [`evidence/`](evidence)

## Chapters

- [x] **Chapter 1 — Hero World Foundation.** A single-viewport
      hand-drawn sketchbook world that lives on its own before the
      Explorer interacts with anything. Evidence:
      [`evidence/chapter-01/README.md`](evidence/chapter-01/README.md).
- [x] **Chapter 2 — The Dreaming Planet.** The Explorer discovers
      floating storyteller planets and one **Dreaming Planet**,
      wakes its **Companion**, and receives an invitation.
      Evidence:
      [`evidence/chapter-02/README.md`](evidence/chapter-02/README.md).
- [ ] **Chapter 3A — Returning Home** (for *"I already have a planet."*)
- [ ] **Chapter 3B — Getting to Know You** (for *"Yes, I'd love to!"*)

Infrastructure sprints (not Chapters — they don't add Hero features):

- [x] **MEP-01 — World Library Integration.** Replaces hardcoded
      artwork filenames with a filename-agnostic asset provider. See
      [`world-library/README.md`](world-library/README.md). Evidence:
      [`evidence/mep-01/README.md`](evidence/mep-01/README.md).

## Canon (immutable)

- **Explorer** is the starting state. Everyone entering
  VihuPlanet begins as an Explorer.
- **Exploration is always free.** No login. No registration.
  No identity required.
- **Storyteller** is simply an Explorer who accepted a
  **Companion**'s invitation.
- Every Storyteller has one **Home Planet**.
- There is always exactly one **Dreaming Planet** per universe.
- **Companions choose Storytellers.** Never the other way around.
- The browser remembers quietly (future).
- Every technical action must become a magical interaction.
- Illustration before interface. Play before purpose. Curiosity
  before instruction.

## Structure

```
vihuplanet/
├── index.html               single-viewport entrance
├── BUILD.md                 MEP version + completed / upcoming chapters
├── CHANGELOG.md             per-chapter changelog
├── assets/
│   ├── fonts/               bundled locally — no CDN dependency
│   ├── objects/             one SVG per Chapter 1 World Object (fallback art)
│   └── planets/             one SVG per Chapter 2 planet (fallback art)
├── world-library/           MEP-01 — filename-agnostic artwork tree.
│                            See world-library/README.md.
├── animations/
│   └── motion.css           WorldMotion vocabulary (Living / Greeting
│                            / Journey / Celebration)
├── css/
│   ├── base.css             paper + reset + typography
│   └── scene.css            layered stage (sky / ground / foreground)
├── hero/
│   └── hero.css             hero prompt styling
├── shared/
│   ├── worldLibrary.js      MEP-01 — World Library asset provider
│   ├── worldObject.js       Chapter 1 registry + mount system
│   └── services/            Chapter 2 placeholder interfaces
│       ├── RecognitionService.js
│       ├── CompanionService.js
│       └── PlanetService.js
├── planets/                 Chapter 2 storyteller planet module
│   ├── planets.js
│   ├── planetsData.js
│   └── planets.css
├── dreamingPlanet/          Chapter 2 Dreaming Planet module
│   ├── dreamingPlanet.js
│   ├── dreamingPlanetManager.js
│   └── dreamingPlanet.css
├── js/
│   ├── registry.js          Chapter 1 World Object descriptors
│   └── scene.js             boot → mount sky → mount → arm motion →
│                            reveal prompt → mount planets → mount
│                            Dreaming Planet
└── evidence/
    ├── chapter-01/          Chapter 1 evidence + README
    ├── chapter-02/          Chapter 2 evidence + README
    ├── chapter-02.5/        Art Direction v1.0 evidence + README
    └── mep-01/              MEP-01 World Library evidence + README
```

## Systems that grow the world

**WorldLibrary** (`shared/worldLibrary.js`, MEP-01). Filename-agnostic
artwork provider. Renderers ask for an object *type* (`cloud`,
`flower`, `story-home`, `sky`, ...); WorldLibrary auto-discovers
whatever PNGs exist in the matching `world-library/` folder and hands
back a URL, or `null` if none exist yet — callers fall back to their
existing SVG in that case. See `world-library/README.md` for the
artist workflow.

**WorldObject** (`shared/worldObject.js`, `js/registry.js`). Every
visible Chapter 1 landmark is a `WorldObject.register({...})`
descriptor. Descriptors may declare `libraryType` to opt into
WorldLibrary artwork (currently: clouds, flowers) — everything else
renders exactly as before MEP-01.

**WorldMotion** (`animations/motion.css`). Motion is a shared
vocabulary in four categories:

- **Living** — always on. `twinkle`, `drift`, `float`, `breathe`,
  `sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`.
- **Greeting** — arrival + reveal. `drawn-in`, `warm-in`,
  `settle`, `awakening`.
- **Journey** — long traversals + transitions. `glide`, `sail`,
  `drift-long`, `zoom-out`, `fade-out`.
- **Celebration** — reserved for future joyful moments.

**Planet** (`planets/planets.js`, `planets/planetsData.js`). The
floating storyteller planets. Same registry pattern as WorldObject.
Each descriptor carries a storyteller name and a one-line story
teaser, and (MEP-01) a `libraryType: 'story-home'` that tries
WorldLibrary before falling back to its SVG.

**DreamingPlanet** (`dreamingPlanet/dreamingPlanet.js`). Registry
with the single Dreaming Planet descriptor.
`DreamingPlanetManager` drives the wake sequence, dialogue, and
three choice paths.

## Running

Any static web server pointed at `vihuplanet/` will serve it. No
build step, no dependency install, no runtime CDN. Fonts + SVGs +
scripts all ship in the repo.
