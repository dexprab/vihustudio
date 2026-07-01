# VihuPlanet

The entrance to a universe.

This is **not** VihuStudio. VihuStudio is one of several destinations
inside VihuPlanet; a future sprint (M1.x) plugs it in as one landmark
alongside others.

## Chapter 1 — World Foundation

The first thing a child sees when they arrive: a hand-drawn
sketchbook world that lives on its own before they touch anything.
See `chapter-1-evidence/README.md` for the full delivery notes,
architecture decisions, motion implementation, and known
limitations.

## Structure

```
vihuplanet/
├── index.html               single-viewport entrance
├── assets/
│   ├── fonts/               bundled locally — no CDN dependency
│   └── objects/             one SVG per World Object
├── animations/
│   └── motion.css           WorldMotion vocabulary (Living / Greeting
│                            / Journey / Celebration)
├── css/
│   ├── base.css             paper + reset + typography
│   └── scene.css            layered stage (sky / ground / foreground)
├── hero/
│   └── hero.css             hero prompt styling
├── shared/
│   └── worldObject.js       registry + mount system
├── js/
│   ├── registry.js          M0.1 World Object descriptors
│   └── scene.js             boot → mount → arm motion → reveal prompt
└── docs/
    └── m0.1-evidence/       screenshots + short clip
```

## Two systems worth knowing

**World Objects** (`shared/worldObject.js`, `js/registry.js`).
Every visible thing in the world (moon, stars, clouds, rocket, paper
plane, tufts, telescope, and every future landmark) is a **World
Object**: a descriptor that pairs an SVG asset with placement +
motion metadata. Adding a new landmark in a future sprint is
`WorldObject.register({...})` and nothing else.

**WorldMotion** (`animations/motion.css`). Motion is a shared
vocabulary, not per-object CSS. Four categories:

- **Living** — always on. `twinkle`, `drift`, `float`, `breathe`.
- **Greeting** — arrival + reveal. `drawn-in`, `warm-in`, `settle`.
- **Journey** — long traversals. `glide`, `sail`, `drift-long`.
- **Celebration** — reserved for M0.3+ (empty in M0.1).

An object joins by declaring its category + name; the scene
bootstrap does the class arithmetic.

## Running

Any static web server pointed at `vihuplanet/` will serve it. No
build step, no dependency install, no runtime CDN. Fonts + SVGs +
scripts all ship in the repo.
