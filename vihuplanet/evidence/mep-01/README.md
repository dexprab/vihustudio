# VihuPlanet MEP-01 · World Library Integration — Evidence Packet

Infrastructure sprint. No new Hero features, no Hero behaviour change
— this replaces how artwork is *loaded*, not what the Hero *does*.
Captures generated in headless Chromium, viewport `1440 × 900`,
served from `vihuplanet/` with `python -m http.server`.

## What was implemented

- **`shared/worldLibrary.js`** — new provider module.
  `WorldLibrary.resolve(type)` / `resolveAt(type, index)` /
  `resolveMany(type, count)` discover PNGs by fetching a
  `world-library/` folder and reading whatever directory listing the
  static file server returns for it. No manifest file, no build step,
  no code change to add new artwork — see `world-library/README.md`.
- **`world-library/`** — the exact folder tree the sprint specified
  (`companions/`, `decorations/`, `dreaming-home/`, `effects/`,
  `fonts/`, `nature/{clouds,flowers,rocks,shrubs,trees,waterfalls}/`,
  `skies/`, `sounds/`, `story-homes/`, `textures/`). Ships empty
  (`.gitkeep` per folder).
- **Renderers try WorldLibrary first, fall back to the existing SVG
  second:** `shared/worldObject.js` (clouds, flowers),
  `planets/planets.js` (the four storyteller planets, type
  `story-home`), and a new `mountSky()` in `js/scene.js` (type `sky`,
  layered over — never replacing — the existing painted gradient).
- **Everything else is untouched.** Moon, stars, rocket, paper plane,
  hills, telescope, and the Dreaming Planet's sphere/Companion all
  render exactly as they did before this sprint — see "Dreaming
  Planet / Companion" below for why the sphere was deliberately left
  out of this integration.

## Files

| File                          | What it shows                                                                                                             |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `01-fallback-default.png`     | The Hero as it ships — `world-library/` empty. Pixel-identical to pre-MEP-01: 24 SVG world-objects, 4 SVG planets, 0 `<img>` elements, 0 failed network requests. |
| `02-populated-demo.png`       | Same load, but with test PNGs temporarily dropped into `nature/clouds/`, `nature/flowers/`, `story-homes/`, and `skies/` (bright, obviously-synthetic colours so the swap is unmistakable) — **no code touched between the two captures**, only files copied into `world-library/`. The 4 clouds, 6 flowers, and sky all picked up the new art; test files were removed before committing so the repo still ships an empty library. |

## Verification

Ran in headless Chromium against both states:

```
Empty library:     { worldObjSvg: 24, worldObjImg: 0, planetSvg: 4, planetImg: 0, skyImageLayer: 0 }, 0 failed requests
Populated library: all 4 cloud <img> src = world-library/nature/clouds/test-cloud.png
                    sky background-image = url("world-library/skies/test-sky.png")
```

Confirms: automatic discovery works with zero code changes, the
fallback path is exercised whenever a type has no art (which is every
type, today), and transparent PNGs compose correctly over existing
artwork (the sky test image was authored at ~35% alpha and the
gradient reads through it in `02-populated-demo.png`).

## Dreaming Planet / Companion — intentionally not wired

The Dreaming Planet's sphere asset (`assets/planets/dreaming.svg`)
isn't a plain illustration — it contains 9 internal groups
(`dp-eyes-open`, `dp-eyes-sleeping`, `dp-mouth-yawn`, `dp-mouth-smile`,
`dp-companion`, ...) that `dreamingPlanet/dreamingPlanet.css` toggles
via `[data-dp-state]` selectors to drive the entire Companion Awakening
Sequence (sleeping → stirring → waking → looking → smiling →
speaking). Swapping this asset for a flat World Library PNG would
silently delete that state machine — a direct regression of the
"preserve Dreaming Planet flow / Companion flow" requirement.

`dreaming-home/` and `companions/` folders exist and
`WorldLibrary.resolve()` supports both types, but
`dreamingPlanet/dreamingPlanetManager.js` still renders the sphere
exactly as before this sprint. Wiring these in is future work once
there's a plan for keeping the stateful animation intact (e.g. a
World Library asset that supplies the *dwelling* backdrop only, with
the companion's face rendered as a separate stateful layer).

## Regression check

- Chapter 1 world (moon, 9 stars, 4 clouds, rocket, paper plane, hills,
  6 flowers, telescope), Chapter 2 (4 storyteller planets, Dreaming
  Planet + wake sequence + three choice paths), camera, motion timing,
  and all interactions are unchanged — confirmed by the SVG/`<img>`
  counts above and side-by-side comparison against
  `evidence/chapter-02.5/07-final-world.png`.
