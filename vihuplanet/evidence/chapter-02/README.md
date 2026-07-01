# VihuPlanet Chapter 2 · Storyteller Selection — Evidence

All captures generated in headless Chromium at
`deviceScaleFactor = 1`, viewport `1440 × 900`, against HEAD.

## Files

| File                              | What it shows                                                     |
|-----------------------------------|-------------------------------------------------------------------|
| `01-world-loaded.png`             | Chapter 1 world at load — before the storyteller cards arrive.    |
| `02-storyteller-selection.png`    | Cards settled in. Hero prompt + subtitle + Vihaan / Myra / Vilo / Add Storyteller row + Parents pill at the bottom. |
| `03-storyteller-selected.png`     | Myra selected — soft pulse ring + gold sparkle burst around her card. |
| `04-transition-still.png`         | Storyteller Home transition mid-play — "Welcome, Myra. Your Bookshelf arrives in Chapter 3." over the zoom-faded world. |
| `04-transition.webm`              | ~9 s recording covering settle, selection, and transition.        |

## Implementation

- **New module** `vihuplanet/storyteller/` with three files:
  - `storyteller.js` — Storyteller registry + StorytellerManager
    (mount / select / transition).
  - `storytellerData.js` — Vihaan / Myra / Vilo / Add-Storyteller
    descriptors. No hard-coded cards in HTML.
  - `storyteller.css` — Card geometry + idle / hover / focus /
    selected styling. All motion classes reused from
    `animations/motion.css`.
- **Four hand-drawn avatars** as SVG assets under
  `vihuplanet/assets/avatars/`. Each SVG stays under 3 KB, uses
  the same navy ink outline (`#1D3457`) and warm skin palette as
  Chapter 1's moon so the avatars belong to the same world.
- **Nunito Rounded** added to `assets/fonts/` (variable-weight
  Latin subset, single 39 KB `.woff2`). Zero CDN dependency at
  runtime.
- **Parents entry** moved from Chapter 1's top-right to Chapter 2's
  UX-Contract-specified bottom-centre — smaller pill, secondary,
  never competes with the storyteller row.

## Architecture

Storyteller is a **new, isolated module** that plugs into the
Chapter 1 shell without touching Chapter 1's code:

- `.foreground` layer (declared as empty in Chapter 1's HTML,
  waiting for exactly this) is the mount point. No changes to
  `.sky` / `.ground` / horizon / brand / hero.
- `StorytellerManager.mount(host)` is called once by
  `js/scene.js`, 1.3 s after the hero prompt starts drawing in.
- The registry pattern from `WorldObject` (Chapter 1) is
  re-used verbatim: `Storyteller.register({...})` +
  `Storyteller.list()` + `Storyteller.find(id)`. Same shape,
  different scope. This is deliberate — one mental model, two
  domains.
- The transition CSS class (`.zoom-out`) lives in
  `animations/motion.css` under Journey, so any future chapter
  that needs a zoom-out has the same helper.
- The `Storyteller.register()` API accepts `enabled: false` so
  future storytellers can ship dark and be toggled on later,
  matching WorldObject's descriptor pattern.

## Reusable systems

Every animation Chapter 2 uses comes from Chapter 1's
`WorldMotion` vocabulary:

- **Living** — the avatar in the selected card breathes softly
  via `.select-pulse` (Category 4 · Celebration, new in Chapter 2).
- **Greeting** — cards fade + rise in with `.settle` at a
  staggered delay per card. Subtitle uses the same class.
- **Journey** — `.zoom-out` (new in Chapter 2, filed under
  Category 3 · Journey) drives the transition to Storyteller Home.
- **Celebration** — `.select-pulse` is the first entry that
  category has; the category header notes it lands in Chapter 2.

No new animation system was introduced. `storyteller.css` only
owns geometry, colour, and interaction states (idle / hover /
focus / selected).

## Motion implementation notes

- **Hover** uses a CSS transition (`transform 0.35s
  cubic-bezier(.2, .8, .2, 1)`), not a keyframe. Hover is a
  user-driven state; keyframes are for autonomous / repeated
  motion. Matches the sprint's motion rules.
- **Selected pulse** is a keyframe (`vp-select-pulse`) so it
  animates on its own once the state is set. Runs at 1.6 s per
  cycle to feel like a soft heartbeat, not a distraction.
- **Sparkles** wrap the avatar in 5 tiny star SVGs that only
  animate when the card carries `.is-selected`. Uses the
  existing `.twinkle` keyframe (Living) with a longer 2.4 s
  duration so the stars read as calm.
- **Transition** targets `.world` — the WHOLE Chapter 1 world
  fades + scales, and the Chapter 3 placeholder warms in over the
  top. Feels like arriving somewhere new instead of leaving.
- **Reduced motion** guard updated in `motion.css` to disable
  the pulse, zoom-out, fade-out, and the body-level transition
  class so accessibility settings still hold.

## Future hooks intentionally left inactive

- **Add Storyteller** currently pulses + shows a bottom toast
  ("Adding a new storyteller lives in a later chapter."). A
  later chapter wires the flow.
- **`Storyteller.register({ enabled: false })`** honoured but
  no dark-shipped storyteller today.
- **`StorytellerManager.onTransition(cb)`** exposes a callback
  hook that Chapter 3 will use to swap the placeholder for the
  real Bookshelf.
- **Storyteller Home placeholder** auto-fades back after 2.8 s
  so the child returns to a live scene rather than a dead end —
  removed once Chapter 3 lands.

## Known limitations

- The placeholder Storyteller Home is deliberately minimal (a
  book glyph + "Welcome, {name}. Your Bookshelf arrives in
  Chapter 3."). It's a stub, not a state.
- No sound effect on select. The Contract mentions a soft
  audio cue; audio assets weren't shipped in this sprint per
  the "Bundle assets locally" rule. A `select.wav` will drop
  into `assets/audio/` when the wider audio pass lands.
- On very narrow desktops (< 1024 px) the four cards may wrap.
  Contract calls out "Minimum desktop width 1024 px" and the
  layout respects that.

## Chapter 3 readiness

Chapter 3 (Bookshelf) plugs in through three seams:

1. `StorytellerManager.onTransition(function(descriptor) { ... })`
   fires with the chosen storyteller. The callback can mount
   the Bookshelf inside the transitioning body.
2. `.storyteller-home-placeholder` in `storyteller.css` is the
   fill-in for Chapter 3's mount point; delete or replace once
   the real Bookshelf ships.
3. `Storyteller.find(id).themeColor / accent` are the palette
   Chapter 3 should tint its Bookshelf with, so each storyteller's
   world reads as theirs.
