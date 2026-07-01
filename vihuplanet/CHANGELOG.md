# VihuPlanet CHANGELOG

All notable changes to the VihuPlanet MEP are recorded here.

## v0.2.0 — 2026-07-01

- **Chapter 2 — Storyteller Selection.** Answers the child's first
  question: "Who's creating today?" The Chapter 1 world stays alive
  behind the storyteller row.
  - New module `vihuplanet/storyteller/`:
    - `storyteller.js` — Storyteller registry + `StorytellerManager`
      (mount, hover, focus, select, transition).
    - `storytellerData.js` — Vihaan / Myra / Vilo / Add-Storyteller
      descriptors. No hard-coded cards anywhere else.
    - `storyteller.css` — card geometry + interaction states.
  - Four hand-drawn avatar SVGs under `assets/avatars/`, matching
    the Contract's colour + accent palette.
  - **Nunito Rounded** bundled locally (`assets/fonts/nunito-latin.woff2`),
    single 39 KB Latin subset, variable weights 400–800. Caveat +
    Kalam stay for Chapter 1's handwriting.
  - New motion classes added to `animations/motion.css` under the
    existing WorldMotion vocabulary — no new animation system:
    - `.select-pulse` (Category 4 · Celebration) — soft heartbeat
      on the selected card.
    - `.zoom-out` (Category 3 · Journey) — smooth zoom + fade for
      the transition to Storyteller Home.
    - `.fade-out` (Category 3 · Journey) — quiet exit for the
      Chapter 3 placeholder.
  - Parents entry moved from Chapter 1's top-right to Chapter 2's
    UX-Contract-specified **bottom-centre** small pill.
  - Hero prompt raised to 38 % so the storyteller row at 62 vh has
    clearance. Chapter 1 in isolation still reads correctly.
  - Chapter 3 (Bookshelf) is not yet built; the transition plays
    as spec'd and lands on a small placeholder ("Welcome, {name}.
    Your Bookshelf arrives in Chapter 3.") that fades back after
    ~2.8 s so the app stays fully functional per the Repository &
    Commit Contract's "Never commit incomplete functionality" rule.
  - Evidence packet at `evidence/chapter-02/` covers the four
    required stills (world loaded → selection → selected →
    transition) + a WebM recording + a full README explaining
    implementation, architecture, reusable systems, future
    hooks, limitations, and Chapter 3 readiness.
  - **Chapter 1 code untouched** apart from moving the Parents
    entry (world objects, motion vocabulary, layer stack all
    unchanged). Evidence moved to `evidence/chapter-01/` to
    match the new evidence path convention.
  - **Architecture preserved.** No rewrite of Chapter 1;
    WorldObject / WorldMotion / layer stack all reused; the
    Storyteller module is fully isolated.

## v0.1.0 — 2026-07-01

- **Chapter 1 — Hero World Foundation.** The single-viewport
  hand-drawn sketchbook world that lives on its own before the
  child interacts with anything.
  - Paper backdrop with SVG grain filter.
  - Sky (~62 %) + ground (~38 %) layers with watercolor washes,
    hand-drawn horizon.
  - World Object registry (`shared/worldObject.js` +
    `js/registry.js`) — descriptors for moon, 9 stars, 4 clouds,
    rocket, paper plane, hills, 6 flowers, and the future
    landmark **telescope** (visible but `interactive: false`).
  - WorldMotion vocabulary (`animations/motion.css`) with four
    categories declared (Living / Greeting / Journey /
    Celebration). Chapter 1 exercises Living + Greeting + Journey.
  - Fonts bundled locally: Caveat + Kalam (Latin subsets, ~120 KB).
  - Hero prompt "Who's creating today?" reveals ~2.3 s after
    load via the Greeting `drawn-in` motion; small star-flanked
    underline follows.
  - Evidence packet at `evidence/chapter-01/` covers initial
    scene → hero prompt visible → ambient motion + a WebM
    recording + a full README.
