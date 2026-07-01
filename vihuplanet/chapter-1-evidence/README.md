# VihuPlanet Chapter 1 · World Foundation — Evidence Packet

## What was implemented

A single-viewport, hand-drawn sketchbook world that lives on its own
before the child interacts with anything. Faithful to the supplied
Visual Contract v1.0:

- **Paper backdrop** — cream (`#F7F2E7`) with an SVG `feTurbulence`
  grain filter stamped as a full-viewport overlay at 32 % opacity
  and `multiply` blend so ink strokes stay readable.
- **Sky layer (~62 %)** — soft blue watercolor wash (`#DDEAF6`),
  populated by moon + 9 amber stars + 4 cottony clouds + rocket +
  paper plane.
- **Ground layer (~38 %)** — green watercolor wash (`#BFE1C6`) with
  two overlapping rolling hills, 6 daisy flowers, and the telescope.
- **Moon** — 180 px, personified with sleeping eyes / rosy cheeks
  / soft smile per the Visual Contract. Breathes gently (Living /
  `breathe`, 6.4 s).
- **Stars** — 9 amber four-point sparkles, hand-authored positions,
  each with its own duration (4.3–5.7 s) and phase offset so they
  twinkle asynchronously.
- **Clouds** — 4 hand-drawn cottony puffs at different heights /
  sizes / drift phases (Living / `drift`, 24–28 s).
- **Rocket** — orange (`#FFB366`) with navy outlines and a flame
  tail, glides left→right through the sky (Journey / `glide`, 22 s).
- **Paper plane** — white origami with a curly dashed trail
  behind, glides left→right at a different height + speed
  (Journey / `glide`, 20 s, 6 s phase offset).
- **Hills** — a single `hills.svg` spanning the ground layer with
  two overlapping mounds and pencilled grass tufts along the ridge.
- **Flowers** — 6 daisies (white petals, amber centre, navy
  outlines, green leaf + stem) scattered across the hills. Living
  `float`, 5.0–5.9 s.
- **Telescope** — wooden tripod + brass tube on the right of the
  ground. Non-interactive in Chapter 1 (`interactive: false`).
  A later chapter will flip the flag on.
- **Logo** — hand-drawn "VihuPlanet" in Caveat 700, navy ink,
  with a small warm gold `✿` and a doodled underline stroke.
- **Parents entry** — top-right, small (`opacity: 0.62`), warms on
  hover.
- **Hero question** — hidden at load, revealed after **2.3 s** via
  the Greeting `drawn-in` motion, then a small hand-drawn
  underline with a warm gold star fades in ~0.6 s later.

## Architecture decisions

Two reusable systems that were built for the world to grow:

**WorldObject** (`shared/worldObject.js` + `js/registry.js`).
Every visible thing in the world is a **World Object** descriptor:
`{ id, label, assetHref, layer, placement, motion, interactive }`.
`WorldObject.register()` adds a descriptor to the registry;
`WorldObject.mount()` fetches every SVG, injects it into the correct
layer wrapper (`.sky` / `.ground` / `.foreground`), and stamps the
placement + motion CSS custom properties. Adding a landmark in a
future chapter is one more `register()` call — no HTML shuffling,
no CSS refactor.

**WorldMotion** (`animations/motion.css`). All motion belongs to
one of four categories. Objects consume motion via class
composition — motion is never per-object.

- **Living** — always on. `twinkle`, `drift`, `float`, `breathe`.
- **Greeting** — arrival + reveal. `drawn-in`, `warm-in`, `settle`.
- **Journey** — long traversals. `glide`, `sail`, `drift-long`.
- **Celebration** — declared, empty in Chapter 1.

## Motion implementation

- **Pure CSS keyframes** with `ease-in-out`, long durations, no
  bouncing, no synchronised looping. Every keyframe reads
  timing / phase / distance from custom properties (e.g.
  `--vp-motion-duration`, `--vp-glide-drop`, `--vp-glide-tilt`)
  that the registry sets per object, so a single keyframe covers
  the whole rocket + paper plane family.
- **Randomised phases via delays.** Stars / clouds / flowers each
  ship with their own duration + delay so no two objects breathe
  in sync — the world feels alive rather than mechanical.
- **`will-change: transform, opacity`** on `.world-object` so
  animations run on the compositor thread. No JS-per-frame work;
  60 FPS confirmed in Chromium.
- **`prefers-reduced-motion`** guard at the bottom of
  `motion.css` short-circuits every animation for accessibility.

## Future hooks intentionally left inactive

- **Telescope** — descriptor is present with `interactive: false`.
  A later chapter flips the flag on and wires a click handler.
- **Foreground layer** — declared as an empty `.foreground` section
  under `.world`. Chapter 2's storyteller cards will mount here.
- **Parents entry** — links to `#`. Chapter 3 wires the target.
- **Celebration motion category** — declared in `motion.css`
  header, no keyframes yet. Chapter 3 (Publishing celebration)
  adds `sparkle-burst`, `confetti-rise`.
- **`.world-object.is-interactive`** hover / focus-visible styling
  is already in place, so flipping any descriptor's `interactive`
  flag is enough — no additional CSS needed.

## Known limitations

- The paper plane and rocket loop continuously; their long delays
  ensure they're visible in the still frames but a very long
  session will see them cycle. A future refinement can space the
  return intervals (25–40 s gap between passes) with a small JS
  scheduler.
- Chromium at DPR = 1 renders the SVG grain filter cheaper than at
  DPR = 2; on retina the noise is denser. Acceptable for MEP.
- No preload/fallback for the local `.woff2` fonts. If a browser
  ever loads them slowly the cursive stack fallback is applied,
  but there is a ~200 ms window where the paper reads with the
  fallback face. `font-display: swap` is on.

## Suggested improvements for Chapter 2

- **Cadence scheduler for Journey objects.** Instead of a
  continuous loop, wake the rocket / paper plane on a randomised
  gap (25–40 s) so a session sees quiet gaps between passes.
- **Persistent horizon.** A hand-drawn wavy line where sky meets
  ground would soften the join further. Currently the hills SVG
  provides the transition; a subtle over-line would help.
- **Reduced-motion still frame.** When `prefers-reduced-motion` is
  set, drop a single non-animating star field composition rather
  than freezing every object mid-drift.
- **Storyteller card mount.** Chapter 2 lands its cards inside
  the `.foreground` layer at ~52–60 vh, so the hero question
  moves up ~4 vh to make room.

## Files in this packet

| File                          | What it shows                                                       |
|-------------------------------|---------------------------------------------------------------------|
| `01-initial-scene.png`        | The world at load — before the hero question reveals.               |
| `02-hero-question-visible.png`| ~2.3 s later — "Who's creating today?" drawn onto the page.         |
| `03-ambient-motion.webm`      | ~9 s recording covering both moments and continued ambient motion.  |
