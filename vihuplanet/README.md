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
      child interacts with anything. Evidence:
      [`evidence/chapter-01/README.md`](evidence/chapter-01/README.md).
- [x] **Chapter 2 — Storyteller Selection.** The child chooses who
      is creating today. Chapter 1 world stays alive behind the
      storyteller row. Evidence:
      [`evidence/chapter-02/README.md`](evidence/chapter-02/README.md).
- [ ] **Chapter 3 — My Bookshelf.**

## Structure

```
vihuplanet/
├── index.html               single-viewport entrance
├── BUILD.md                 MEP version + completed / upcoming chapters
├── CHANGELOG.md             per-chapter changelog
├── assets/
│   ├── fonts/               bundled locally — no CDN dependency
│   ├── objects/             one SVG per Chapter 1 World Object
│   └── avatars/             one SVG per Chapter 2 storyteller
├── animations/
│   └── motion.css           WorldMotion vocabulary (Living / Greeting
│                            / Journey / Celebration)
├── css/
│   ├── base.css             paper + reset + typography
│   └── scene.css            layered stage (sky / ground / foreground)
├── hero/
│   └── hero.css             hero prompt styling
├── shared/
│   └── worldObject.js       Chapter 1 registry + mount system
├── storyteller/
│   ├── storyteller.js       Chapter 2 registry + StorytellerManager
│   ├── storytellerData.js   storyteller descriptors
│   └── storyteller.css      Chapter 2 card styling
├── js/
│   ├── registry.js          Chapter 1 World Object descriptors
│   └── scene.js             boot → mount → arm motion → reveal prompt
│                            → mount storytellers
└── evidence/
    ├── chapter-01/          Chapter 1 evidence + README
    └── chapter-02/          Chapter 2 evidence + README
```

## Two systems that grow the world

**WorldObject** (`shared/worldObject.js`, `js/registry.js`). Every
visible thing that lives in Chapter 1 is a `WorldObject.register({...})`
descriptor. Adding a new landmark in a future chapter is one
`register()` call — no HTML shuffling, no CSS refactor.

**WorldMotion** (`animations/motion.css`). Motion is a shared
vocabulary that grows with the world:

- **Living** — always on. `twinkle`, `drift`, `float`, `breathe`.
- **Greeting** — arrival + reveal. `drawn-in`, `warm-in`, `settle`.
- **Journey** — long traversals + transitions. `glide`, `sail`,
  `drift-long`, `zoom-out`, `fade-out`.
- **Celebration** — first entry lands in Chapter 2:
  `select-pulse`.

Chapters extend these systems rather than replace them.

## Chapter 2 addition — Storyteller

Storyteller is a new sibling to WorldObject. Same registry pattern,
different scope: each storyteller is a
`Storyteller.register({ id, name, avatar, themeColor, accent, enabled })`
descriptor. Adding a new storyteller in a future chapter is one
more entry in `storyteller/storytellerData.js`.

## Running

Any static web server pointed at `vihuplanet/` will serve it. No
build step, no dependency install, no runtime CDN. Fonts + SVGs +
scripts all ship in the repo.
