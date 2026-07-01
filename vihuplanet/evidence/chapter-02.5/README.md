# VihuPlanet Chapter 2.5 · Art Direction v1.0 — Evidence

All captures generated in headless Chromium at
`deviceScaleFactor = 1`, viewport `1440 × 900`, against HEAD.

Art Direction v1.0 is the **permanent** visual identity of
VihuPlanet. Every chapter from 3 onward inherits it verbatim.

## Files

| File                          | What it shows                                                                                                             |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `01-current-vs-new.png`       | Final assembled world under Art Direction v1.0. Prior visual states are documented in `chapter-01/` and `chapter-02/` — those directories are the "before". |
| `02-composition-study.png`    | Universe at rest after all planets settle. Cream paper reads through; horizon glow is a wash, not a gradient stop; five permanent palette colours cover the whole frame. |
| `03-depth-study.png`          | Same universe ~5s later — planets have drifted along their unique paths. Aarav (background) sits at reduced opacity + micro-blur; Vihaan / Meera / Emma (midground) read forward. The depth ramp is the eye's first cue. |
| `04-planet-study.png`         | Crop of the four storyteller planets. Each is a **landmass**, not a sphere. Companions are back-turned or in profile — never front-facing, never mascots. |
| `05-companion-study.png`      | Dreaming Planet awake. The companion is inside the cottage window, barely visible through mist. Halo dims; other planets soften; attention rests on the invitation. |
| `06-dialogue-study.png`       | Sky-caption dialogue — no bubble, no tail, no shadow. Words float against paper in Caveat. Choice pills are pencilled ink outlines at low fill opacity. |
| `07-final-world.png`          | Same as `01-current-vs-new.png` — kept for symmetry with the six-still contract Chapter 1 and 2 established. |
| `08-motion.webm`              | ~14s recording of the world in idle Living motion — moon breathe, stars twinkle, rocket rock, paper plane glide, planets drift, Dreaming Planet breathe, orbiting stars circle. No greeting, no journey, no celebration in frame; only the world existing. |

## The synthesis (why this direction)

The user picked three concepts and asked us to fuse them into one.

- **Concept C — Living Meadow** provided the *structural* language:
  planets are terrain — mountains, meadows, plateaus, islands —
  never spheres, never orbs. Depth is real — background planets
  fall back, midground planets step forward.
- **Concept B — Small Prince's Sky** provided the *emotional*
  language: patience, air, whitespace. Companions face away from
  the viewer. Dialogue is a sky-caption, not a bubble. UI hides.
- **Concept A — Storybook Page** provided the *illustration*
  language: watercolor washes with visible pencil-ink outlines
  on cream sketchbook paper. Every surface reads as hand-drawn.

Concept C gave us bones. Concept B gave us breath. Concept A gave
us skin.

## Permanent palette

Eight paints. Any single scene draws from at most four of them
plus paper.

| Token                    | Colour     | Where it earns its keep                              |
|--------------------------|------------|------------------------------------------------------|
| `--vp-paper`             | `#F1EAD0`  | The page. Reads through every wash. Never gets hidden. |
| `--vp-horizon-apricot`   | `#EBB47A`  | Low sky wash + Dreaming Planet halo hint.            |
| `--vp-sky-cerulean`      | `#7EB1CE`  | High sky wash + rocket window glass + telescope hood.|
| `--vp-ink`               | `#1E2842`  | Every pencil line, every stroke, every text.         |
| `--vp-candle`            | `#E8B871`  | Stars, moon, focus knob — the warm points of light.  |
| `--vp-moss`              | `#7C9C6F`  | Grass fills, hills, meadow landmasses, flower leaves.|
| `--vp-ember`             | `#E4A455`  | Rocket body, telescope tube, planet ridges.          |
| `--vp-dusk`              | `#8E7CB0`  | Dreaming Planet landmass. The unique note we hold in reserve. |

## Permanent rules (locked)

Documented as a live global in
`artDirection/illustrationRules.js` so any future chapter reads
them at runtime. Highlights:

1. **Planets are landmasses.** A planet MUST show terrain —
   mountains, meadows, plateaus, islands. Never a sphere. Never
   an orb.
2. **Companions are inhabitants.** They are rarely front-facing.
   Back-turned or in profile is the default. Never a mascot pose,
   never waving at the viewer.
3. **Dialogue is sky-caption.** Words float against the sky in
   Caveat. No bubble. No tail. No shadow.
4. **Ink is single-colour.** Every outline is `--vp-ink` at
   `1.2 / 1.6 / 2.0 px`. Nothing thicker, nothing thinner.
5. **Palette budget.** A scene draws from at most four palette
   colours plus paper.
6. **Whitespace target 55 %.** More than half the frame is
   paper. If a composition falls below this, it's too busy.
7. **Motion is peripheral.** No greeting, journey, or
   celebration motion plays until the Explorer acts. The idle
   universe uses only Living motion.
8. **UI is the world's quietest layer.** Brand is a whisper.
   Parents entry is a whisper. The hero prompt is smaller than
   the moon.

## What changed from Chapter 1

- Sky wash rebuilt — was a two-stop cerulean gradient, now a
  painterly warm-apricot low + cool-cerulean high with cream
  paper reading through the middle.
- Ground wash rebuilt — was a flat green, now a muted meadow-moss
  over warm shadow.
- Moon redrawn — the smiling mascot face is retired. Now a
  painterly crescent with three small craters and two barely-
  there closed-eye arcs at 0.55 opacity. The moon sleeps; it does
  not perform.
- Rocket, star, flower, hills, telescope, cloud, paper plane —
  all repalletted to the permanent eight colours with `#1E2842`
  ink lines.
- Fonts narrowed — Nunito Rounded retired from Chapter 1 surfaces.
  Caveat + Kalam only.
- Brand moved from top-centre pill to top-left small handwriting
  at 0.82 opacity.
- Parents entry moved from bottom-centre pill to bottom-right
  small pencilled label at 0.55 opacity.
- Hero prompt shrunk to `clamp(22px, 2.4vw, 34px)` at 0.78
  opacity.

## What changed from Chapter 2

- The four storyteller planets are **no longer spheres**. They are
  landmasses — Vihaan's mountain summit, Aarav's lone tree,
  Meera's tilted meadow with easel, Emma's ice plateau with piano
  bench.
- Companions never look at the viewer:
  - Vihaan's dragon watches the sky from behind.
  - Aarav's dragon looks up in profile at the base of the tree.
  - Meera's fox paints, tail arcing away.
  - Emma's penguin plays piano from behind, one wing lifted.
- The Dreaming Planet becomes a cloud-wrapped island. The
  companion lives inside a cottage window — a candle you can
  almost see, not a face waiting for you.
- Dialogue **loses the bubble**. Sky-caption in Caveat is now the
  entire voice of the world.
- Choice pills lose the glossy gradient and become pencilled ink
  outlines at low fill opacity (candle / cerulean / dusk).
- Planet labels lose their card and border — they are handwriting
  now. Name is Caveat 20px at 0.78 opacity; teaser is italic 15px
  at 0.62 opacity.
- A depth ramp is added — `planetsData.js` carries a `depth`
  field (`background` / `midground`) that `planets.css` reads to
  reduce distant planets' opacity and add a hair of blur.

## Inheritance rule

**Every chapter after 2.5 inherits Art Direction v1.0 verbatim.**

New chapters must not:

- Introduce a new palette colour.
- Add new fonts.
- Introduce bubbled dialogue.
- Draw a spherical planet.
- Give a companion a front-facing pose.
- Use more than four palette colours in a single scene.

New chapters may:

- Extend `artDirection/illustrationRules.js` with additional
  guidance (never contradiction).
- Draw new landmass silhouettes, new companions, new plants,
  new terrain.
- Compose new Living / Greeting / Journey / Celebration
  motions in the existing vocabulary.

## Reproducing these captures

```
python3 -m http.server 8765           # from vihuplanet/
node scratchpad/capture.js            # writes into evidence/chapter-02.5/
```
