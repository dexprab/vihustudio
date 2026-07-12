# Background Remover

A small, standalone browser utility that turns a photographed or
scanned image into a transparent PNG by removing its background —
entirely client-side, with no backend, no accounts, and no AI APIs.

This tool has **zero dependencies** on VihuStudio's Builder, Studio,
Engine, Runtime, or Theme packages. It doesn't import from anywhere
outside `tools/background-remover/`, and nothing outside this folder
imports from it. It can be deleted, moved, or open-sourced on its own
without touching the rest of the repository.

## Purpose

Children's artwork is often photographed or scanned on plain paper.
This utility exists to validate — before any of it gets wired into
VihuStudio's Asset Normalizer — that a robust, purely client-side
background-removal workflow is actually achievable, fast, and correct
on that kind of image.

## Running it

No build step. Open `index.html` directly, or serve the folder with
any static file server (it also works unmodified via GitHub Pages,
since everything is a relative import):

```
cd tools/background-remover
python3 -m http.server 8080
# open http://localhost:8080
```

## Architecture

```
app.js                     UI state + DOM wiring only.
  └── js/preview.js        Canvas rendering, zoom/pan. No pipeline knowledge.
  └── js/worker.js         Runs OFF the main thread. The only place the
      │                    pipeline below is actually assembled.
      ├── js/backgroundDetector.js   Border sampling → background colour + tolerance.
      ├── js/backgroundRemoval.js    Strategy registry + the flood-fill algorithm.
      ├── js/edgeSmoothing.js        Binary mask → feathered alpha channel.
      └── js/cropper.js              Alpha bounding box → auto-crop.
```

`app.js` never imports `backgroundRemoval.js` or the other pipeline
modules directly — it only ever posts a raw pixel buffer to
`worker.js` and receives one back. That boundary is deliberate: it's
what lets the removal *strategy* change (see below) without the UI,
or the fact that processing happens in a Worker, changing at all.

### Strategy pattern

```
BackgroundRemovalStrategy   (contract: process(pixelBuffer, options) -> mask)
        │
        ├── WhitePaperStrategy        implemented (V1)
        ├── UniformColourStrategy     future (V2)
        ├── AISegmentationStrategy    future (V3, still fully local/offline)
        └── ManualRefinementStrategy  future (V4)
```

A strategy is any object shaped like
`{ id, label, process(pixelBuffer, options) }`, registered with
`registerStrategy()` in `backgroundRemoval.js`. `worker.js` selects
one by string id (`options.strategy`) — nothing else in the codebase
ever references a strategy by name, which is what keeps adding a new
one a one-file change.

### Pixel buffers, not `ImageData`

Every pipeline module operates on a plain
`{ data: Uint8ClampedArray, width, height }` object rather than a
real `ImageData` instance. `ImageData` only exists on the main thread
in some browsers unless explicitly constructed; using a plain object
means every algorithm file runs identically on the main thread or
inside `worker.js`, and is trivially unit-testable without a DOM.

## The algorithm (WhitePaperStrategy)

1. **Sample the border.** Every pixel along the image's outer edge
   (top row, bottom row, left column, right column) is sampled —
   `O(perimeter)`, not `O(area)`, so this stays cheap even on a large
   photo.
2. **Estimate the background colour and tolerance.** The mean of the
   border samples is the background colour; the standard deviation of
   those same samples drives an automatic tolerance (a noisy scan or
   a soft-shadowed photo gets a larger tolerance than a flat, clean
   white border) — see `backgroundDetector.js`.
3. **Flood fill from the border, not a global colour test.** A
   multi-source, iterative, 4-connected BFS is seeded from every
   border pixel that matches the background colour within tolerance.
   Only pixels **connected** to the border through other
   background-coloured pixels are ever marked for removal. This is
   the one property the whole strategy depends on: a colour test
   alone (`pixel is roughly white → remove it`) would also delete the
   white hole inside a letter "O", a character's white eyes, white
   teeth, clouds, or highlights drawn *inside* the artwork. Flood fill
   can't reach those regions without first crossing a non-background
   pixel (the ink), so they're left alone automatically — no special
   case for "eyes" or "clouds" anywhere in the code, connectivity
   alone is what protects them.
4. **Feather the edge.** The binary mask from step 3 is converted to
   an alpha channel and softened with a small separable box blur
   (`edgeSmoothing.js`). A box blur of a uniformly-0 or uniformly-255
   region is unaffected — only pixels actually near the cutout
   boundary change, so the cost and the visual effect both scale with
   edge length, not image area.
5. **Auto-crop.** The alpha channel's bounding box is found and the
   image is cropped to it (`cropper.js`), removing the empty
   transparent border the removal left behind. Optional — the "Auto
   Crop" toggle disables this and keeps the original canvas size.
6. **Export.** `canvas.toBlob('image/png')` — PNG is lossless by
   definition, so there's no quality/compression trade-off to expose
   in the UI; resolution is never altered unless Auto Crop is on
   (which only trims transparent margin, never rescales content).

## Performance

Processing runs inside a dedicated Web Worker (`js/worker.js`, loaded
as an ES module worker) so a large image never blocks the page. The
flood fill and box blur both use typed arrays (`Uint8Array`,
`Int32Array`, `Float32Array`) and avoid per-pixel allocation — the
flood-fill queue is a single pre-sized `Int32Array` rather than a
growing JS array, and the feather blur uses a sliding-window running
sum so its cost is independent of blur radius. Pixel buffers are
transferred between the main thread and the worker (`postMessage`'s
transfer list), not copied, except for the one clone kept on the main
thread so the user can keep adjusting sliders without re-reading the
source file.

## Current limitations

- Single background colour/region per image (by design — see V2
  below). An image with two very different background zones (e.g.
  half white paper, half wood desk) will only cleanly remove
  whichever one the border pixels are dominated by.
- Feathering is a uniform box blur, not a true alpha matte estimator
  — very fine, hair-thin details (a single stray pencil line touching
  the background) can lose a little softness at the very tip.
- No manual correction tools yet (a brush to restore or remove
  specific areas) — see V4.

## Version roadmap

- **V1 — White paper removal** *(this version)*. Flood-fill based
  removal targeting artwork photographed or scanned on a roughly
  uniform light background.
- **V2 — Uniform colour removal.** Generalizes `WhitePaperStrategy`'s
  approach to any single dominant background colour (green screen,
  coloured construction paper, a solid-colour desk), not just white/
  near-white.
- **V3 — Local AI segmentation.** A locally-run, offline segmentation
  model (still no network calls, still no external API) for artwork
  photographed against a busy or non-uniform background where
  flood-fill alone can't separate subject from background.
- **V4 — Manual refinement tools.** Brush-based add/remove correction
  layered on top of any strategy's output, for the cases none of V1–V3
  get perfectly right on their own.

## Becoming an Asset Normalizer step

The entire pipeline this tool runs is the four-function sequence
`worker.js` composes:
`detectBackground → run(strategy) → featherMask/applyAlpha → cropPixelBuffer`.
All four are plain functions over `{ data, width, height }` objects
with no DOM, Canvas, or Worker dependency — `worker.js` is a thin
wrapper that happens to run them off the main thread and talk to it
over `postMessage`. A future Asset Normalizer step can call the same
four functions directly (e.g. from a Node script using a `Canvas`-like
`Uint8ClampedArray` source), without needing a browser, a Worker, or
any of this UI.
