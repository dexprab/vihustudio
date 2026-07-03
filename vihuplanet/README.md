# VihuPlanet

The entrance to a universe.

This is **not** VihuStudio. VihuStudio is one of several destinations
that will live inside VihuPlanet; a future chapter plugs it in as one
landmark alongside others.

- **Hero canon:** [`HERO_CANON.md`](HERO_CANON.md) — start here.
  Permanent philosophy and locked product decisions; read this before
  making any Hero change.
- **MEP Version + status:** see [`BUILD.md`](BUILD.md)
- **Changelog:** [`CHANGELOG.md`](CHANGELOG.md)
- **Evidence packets:** [`evidence/`](evidence) — historical
  point-in-time captures, not living documentation. If evidence ever
  conflicts with `HERO_CANON.md`, `HERO_CANON.md` wins.

## Chapters

The Hero began as a numbered-chapter roadmap; from Sprint 2 onward,
work is tracked as named sprints in [`CHANGELOG.md`](CHANGELOG.md)
rather than new chapter numbers. Current status lives in
[`BUILD.md`](BUILD.md); this list is kept only for the two chapters
that still use chapter numbering:

- [x] **Chapter 1 — Hero World Foundation.** A single-viewport
      hand-drawn sketchbook world that lives on its own before the
      Explorer interacts with anything. Evidence:
      [`evidence/chapter-01/README.md`](evidence/chapter-01/README.md).
- [x] **Chapter 2 — The Dreaming Planet.** The Explorer discovers
      floating Story Worlds and one **Dreaming Realm**,
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

## Canon

See [`HERO_CANON.md`](HERO_CANON.md) for the full, permanent record —
philosophy, Story World / Dreaming Realm / Story Meadow / Telescope
canon, performance principles, and locked language rules. Not
duplicated here.

## Structure

```
vihuplanet/
├── index.html               single-viewport entrance
├── HERO_CANON.md             permanent philosophy + locked decisions — read first
├── BUILD.md                 MEP version + status (completed / in progress / future)
├── CHANGELOG.md             per-sprint changelog
├── build-info.json          dev-only build indicator data (see js/buildInfo.js)
├── assets/
│   ├── fonts/               bundled locally — no CDN dependency
│   ├── objects/             one SVG per Chapter 1 World Object (fallback art)
│   ├── planets/             one SVG per Story World + the Dreaming Realm (fallback art)
│   └── avatars/             orphaned from the retired v0.2.0 storyteller-card
│                            module — unused by anything today
├── world-library/           MEP-01 — filename-agnostic artwork tree, synced
│                            from vihuplanet-world-library. See
│                            world-library/README.md for the artist workflow.
├── artDirection/
│   └── illustrationRules.js Art Direction v1.0 (permanent) — single source of
│                            truth for palette, line quality, composition
├── animations/
│   └── motion.css           WorldMotion vocabulary (Living / Greeting
│                            / Journey / Celebration)
├── css/
│   ├── base.css             paper + reset + typography
│   └── scene.css            layered stage (sky / ground / foreground)
├── shared/
│   ├── worldLibrary.js      MEP-01 — World Library asset provider
│   ├── worldObject.js       Chapter 1 registry + mount system
│   └── services/            Chapter 2 placeholder interfaces
│       ├── RecognitionService.js
│       ├── CompanionService.js
│       └── PlanetService.js
├── planets/                 Story World registry module
│   ├── planets.js
│   ├── planetsData.js
│   └── planets.css
├── dreamingPlanet/          Dreaming Realm module
│   ├── dreamingPlanet.js
│   ├── dreamingPlanetManager.js
│   └── dreamingPlanet.css
├── js/
│   ├── registry.js          World Object descriptors
│   ├── buildInfo.js         dev-only build indicator (reads build-info.json)
│   └── scene.js             boot → mount → arm motion → mount Story Worlds
│                            → mount Dreaming Realm → mount sky
└── evidence/                historical point-in-time captures (see note above)
    ├── chapter-01/          Chapter 1 evidence + README
    ├── chapter-02/          Chapter 2 evidence + README
    ├── chapter-02.5/        Art Direction v1.0 evidence + README
    └── mep-01/              MEP-01 World Library evidence + README
```

## Systems that grow the world

**WorldLibrary** (`shared/worldLibrary.js`, MEP-01). Filename-agnostic
artwork provider. Renderers ask for an object *type* (`cloud`,
`flower`, `story-home`, `sky`, `dreaming-home`, ...); WorldLibrary
auto-discovers whatever PNGs exist in the matching `world-library/`
folder (via that folder's `manifest.json` — no directory listing) and
hands back a URL, or `null` if none exist yet — callers fall back to
their existing SVG (or don't mount at all) in that case. Some types
vary once per browser session (`SESSION_VARIED_TYPES`); some types
filter out specific filenames without deleting them from the World
Library (`FILE_FILTERS`). See `world-library/README.md` for the
artist workflow and `HERO_CANON.md` §6/§11 for the philosophy.

**WorldObject** (`shared/worldObject.js`, `js/registry.js`). Every
visible Hero landmark is a `WorldObject.register({...})` descriptor.
Descriptors may declare `libraryType` to opt into WorldLibrary artwork
— everything else renders exactly as it did before MEP-01. A
descriptor may omit `assetHref` entirely (no SVG fallback); if the
World Library also has nothing for that type, the object simply
doesn't mount (Story Meadow).

**WorldMotion** (`animations/motion.css`). Motion is a shared
vocabulary in four categories:

- **Living** — always on. `twinkle`, `drift`, `float`, `breathe`,
  `sway`, `shadow-breathe`, `shimmer`, `wander`, `sleeping`,
  `breathing`, `listening`, `orbit`, `planet-drift`.
- **Greeting** — arrival + reveal. `drawn-in`, `warm-in`, `settle`,
  `awakening`.
- **Journey** — long traversals + transitions. `sail`, `drift-long`,
  `zoom-out`, `fade-out`.
- **Celebration** — `select-pulse` so far; reserved for future joyful
  moments.

Per `HERO_CANON.md` §9, no Greeting/Journey/Celebration motion plays
until the Explorer acts — the idle Hero uses only Living motion.

**Planet** (`planets/planets.js`, `planets/planetsData.js`). The
Story World registry. Same pattern as WorldObject. Each descriptor
carries `worldName` + `storytellerName` + `teaser`, and a
`libraryType: 'story-home'` that tries WorldLibrary before falling
back to its SVG — but the Hero only ever displays `worldName`
(`HERO_CANON.md` §3); `storytellerName` and `teaser` stay on the
descriptor, unused by the Hero today.

**DreamingPlanet** (`dreamingPlanet/dreamingPlanet.js`,
`dreamingPlanet/dreamingPlanetManager.js`). Registry with the single
Dreaming Realm descriptor, now carrying `libraryType: 'dreaming-home'`.
`DreamingPlanetManager` drives the wake sequence, dialogue, and three
choice paths — unchanged since Chapter 2 and treated as frozen
infrastructure (`HERO_CANON.md` §4). Production artwork is resolved
from the World Library and clipped into the existing SVG's landmass
silhouette; it does not replace any part of the engine.

## Running

Any static web server pointed at `vihuplanet/` will serve it. No
build step, no dependency install, no runtime CDN. Fonts + SVGs +
scripts all ship in the repo.
