# VihuPlanet M0.1 — World Foundation Evidence

All captures below were produced in headless Chromium at
`deviceScaleFactor=1`, viewport 1440 × 900, against the code at HEAD.

| File                          | What it shows                                                                                     |
|-------------------------------|---------------------------------------------------------------------------------------------------|
| `01-initial-scene.jpg`        | The world at load — before the hero prompt reveals. Sky, ground, horizon, all ambient objects, telescope waiting on the ground. |
| `02-hero-prompt-visible.jpg`  | ~2.3 s later — "Who's creating today?" has been drawn onto the page (Greeting motion, `drawn-in`). |
| `03-ambient-motion.jpg`       | +6 s later — moon still breathing, stars still twinkling, clouds have drifted, rocket + paper plane have advanced along their Journey glide, sparkles have shifted. |
| `ambient-motion.webm`         | ~9 s continuous recording covering all three moments above.                                        |

## What each acceptance line maps to

| Acceptance criterion                                    | Where to look                                                     |
|--------------------------------------------------------|-------------------------------------------------------------------|
| The page immediately feels magical.                     | `01-initial-scene.jpg` — the paper texture + watercolor sky read as sketchbook before any UI. |
| No scrolling exists.                                    | Viewport is fixed at 100vh × 100vw (`css/base.css`, `overflow:hidden` on both `html` and `body`). |
| Animations feel alive.                                  | `ambient-motion.webm` — sustained Living motion (twinkle / drift / float / breathe); Journey glide for rocket + paper plane. |
| Nothing feels like software.                            | Everything is hand-drawn SVG; typography is `Caveat` + `Kalam` (bundled locally). No gradients-that-feel-digital. |
| Parents entry is visible but visually secondary.        | Top right, opacity 0.62 by default. Grows on hover.               |
| Only text shown is "VihuPlanet" + "Who's creating today?" | Confirmed in `02-hero-prompt-visible.jpg` — nothing else reads. |
