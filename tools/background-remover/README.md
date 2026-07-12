# Drawing Magic (née Background Remover)

A small, standalone browser utility that turns a photographed or
scanned child's drawing into a production-quality transparent PNG —
entirely client-side, with no backend, no accounts, and no AI APIs.
Branded to the child using it as **✨ Drawing Magic**; this document
keeps the original, more precise technical name for the underlying
tool and its files, matching the code itself (nothing was renamed on
disk — see [The child-facing UX layer](#the-child-facing-ux-layer)).

This tool has **zero dependencies** on VihuStudio's Builder, Studio,
Engine, Runtime, or Theme packages. It doesn't import from anywhere
outside `tools/background-remover/`, and nothing outside this folder
imports from it. It can be deleted, moved, or open-sourced on its own
without touching the rest of the repository.

## Purpose

Children's artwork is often photographed or scanned on plain paper.
This utility exists to validate — before any of it gets wired into
VihuStudio's Asset Normalizer — that a robust, purely client-side
background-removal workflow is actually achievable, fast, and
*trustworthy* on that kind of image: it must never quietly degrade the
one thing that matters, the artwork itself. See
[Quality Contract](#quality-contract) below — that requirement sits
above background-removal quality itself. Its presentation is aimed at
the child actually using it — a creative "bring your drawing to life"
moment, not an image-editing workflow — while every technical
guarantee below still holds exactly as described.

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
app.js                     UI state + DOM wiring + the manual tools' own
  │                        pixel edits (Cleanup Brush, Manual Crop — see below).
  ├── js/preview.js        Canvas rendering, zoom/pan. No pipeline knowledge.
  ├── js/pngEncoder.js     Encodes a pixel buffer straight to PNG bytes,
  │                        bypassing <canvas> entirely (see Quality Contract).
  ├── js/cleanupBrush.js   Pure soft-edged eraser math for the Cleanup Brush.
  ├── js/analysisView.js   Renders the Overlay / Difference inspection views.
  ├── js/cropper.js        Shared by the automatic pipeline AND Manual Crop.
  └── js/worker.js         Runs OFF the main thread. The only place the
      │                    *automatic* pipeline below is assembled.
      ├── js/backgroundDetector.js   Border sampling → background colour + tolerance.
      ├── js/backgroundRemoval.js    Strategy registry + the flood-fill algorithm.
      ├── js/edgeSmoothing.js        Binary mask → feathered alpha channel.
      └── js/cropper.js              Alpha bounding box → auto-crop.
```

`app.js` never imports `backgroundRemoval.js` or the other *automatic*
pipeline modules directly — it only ever posts a raw pixel buffer to
`worker.js` and receives one back. That boundary is deliberate: it's
what lets the removal *strategy* change (see below) without the UI, or
the fact that processing happens in a Worker, changing at all. The
manual tools (Cleanup Brush, Manual Crop) are different in kind — they
react to a live mouse drag, not a debounced slider — so they run
synchronously on the main thread as plain functions over a pixel
buffer, called directly from `app.js`. `cropper.js` is shared as-is by
both: auto-crop and Manual Crop are the exact same
`cropPixelBuffer(buffer, rect)` call with a different-sourced `rect`.

### Strategy pattern

```
BackgroundRemovalStrategy   (contract: process(pixelBuffer, options) -> mask)
        │
        ├── WhitePaperStrategy        implemented (V1)
        ├── UniformColourStrategy     future (V2)
        ├── AISegmentationStrategy    future (V3, still fully local/offline)
        └── ManualRefinementStrategy  superseded by the real Cleanup Brush (V1.1)
```

A strategy is any object shaped like
`{ id, label, process(pixelBuffer, options) }`, registered with
`registerStrategy()` in `backgroundRemoval.js`. `worker.js` selects
one by string id (`options.strategy`) — nothing else in the codebase
ever references a strategy by name, which is what keeps adding a new
one a one-file change.

### Pixel buffers, not `ImageData`

Every pipeline module — automatic *and* manual — operates on a plain
`{ data: Uint8ClampedArray, width, height }` object rather than a real
`ImageData` instance or a `<canvas>`. This isn't just a Worker
convenience: it's also what makes the Quality Contract enforceable at
all (see below) — canvas has its own opinions about pixel data that
this tool cannot allow near anything the user will actually receive.

## The child-facing UX layer

"Drawing Magic" wraps the pipeline above in a screen flow — Welcome →
a short magic-messages moment while the automatic pass runs → a
celebratory Result screen → an optional "Make It Better" editing
screen — built entirely additively on top of the existing DOM and
`app.js` functions, not a rewrite of either:

- Every element `app.js`'s pipeline/tool code already reads by id
  (Tolerance/Edge Smoothness/Auto Crop, the zoom buttons, the
  Overlay/Difference tabs, `previewMeta`/`performanceNote`, ...) is
  still present in `index.html`, completely functional — `kids.css`
  only ever hides it from view (`.technical-hidden`, `display:none`)
  or relabels its container. Deleting `kids.css` would turn the tool
  back into the plain technical editor it was before this layer,
  with zero JS changes needed either way.
- The Result screen's "My Drawing"/"My Magic Drawing" before/after
  slider is a deliberately separate, simple, non-zoomable pair of
  canvases (`renderBeforeAfter()`/`updateBeforeAfterClip()` in
  `app.js`) — reusing `cropPixelBuffer()` once, purely to align the
  original to the working buffer's own crop offset, and `drawPixelBuffer()`
  to paint both layers, never the zoom-capable `originalCanvas`/
  `processedCanvas` pair the Edit screen's Trim/Remove More/Bring It
  Back tools actually operate on. Keeping these separate means a
  slider drag on the Result screen can never interfere with — or be
  confused by — the Edit screen's own zoom/pan/tool state.
  A CSS `clip-path` split at the slider's percentage is the entire
  reveal mechanic; no new pixel logic.
- The Edit screen reuses the pre-existing "toggle" view mode
  (`setViewMode('toggle')`, originally the "Original / Processed"
  tab) to show only the current result full-size — a child doesn't
  need a technical side-by-side while editing. Because that screen is
  `hidden` while the Welcome/magic/Result screens show, any zoom fit
  computed before it's ever revealed measures a 0×0 layout rect and
  silently no-ops (`fitToViewport()`'s own documented fallback); the
  "Make It Better" button click explicitly re-fits
  (`zoomProcessed.fitToViewport()`) at the moment `editView` actually
  becomes visible, once its layout is real.
- The "magic" screen (`beginMagic()`/`endMagicProcessing()` in
  `app.js`, hooked into the existing `setProcessing()` — the same
  function that already correctly fired at the start/end of every
  pipeline run) cycles three messages and stays up for a minimum
  ~1.4s even if processing finishes faster, so the moment always
  reads as intentional rather than a flash — but it only actually
  hides once BOTH that minimum time *and* the real processing are
  done, so a slow, very large image is never cut off early to hit a
  fake deadline. Since Tolerance/Edge Smoothness/Auto Crop are no
  longer reachable in the child UI, `runPipeline()` now only ever
  runs once per loaded picture, which is what makes one single magic
  moment (rather than a repeating one on every slider tweak, as in
  the pre-"Drawing Magic" UI) the correct behaviour.

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
   edge length, not image area. This is the *only* step allowed to
   touch alpha for reasons other than "this pixel is background" —
   see the Quality Contract.
5. **Auto-crop.** The alpha channel's bounding box is found and the
   image is cropped to it (`cropper.js`), removing the empty
   transparent border the removal left behind. Optional — the "Auto
   Crop" toggle disables this and keeps the original canvas size.
6. **Manual Cleanup and Manual Crop** (optional, V1.1) run *after*
   this — see below.
7. **Export.** A dedicated PNG encoder (`pngEncoder.js`), not
   `canvas.toBlob()` — see [Quality Contract](#quality-contract) for
   why that distinction is load-bearing, not stylistic.

## Manual cleanup workflow

The automatic algorithm is always the primary workflow. Manual tools
exist only to clean up what it leaves behind — this utility is not a
general image editor, and deliberately doesn't grow into one. Child-
facing labels are in quotes; the underlying element/function names
(unchanged since Sprint 2) are noted alongside for anyone reading code.

- **"Remove More" (Cleanup Brush)** — a circular, soft-edged eraser
  (`js/cleanupBrush.js`'s `eraseCircle`). Can only ever *reduce* a
  pixel's alpha, never raise it.
- **"Bring It Back" (Restore Brush)** — the opposite: restores alpha
  toward fully opaque in a soft-edged circle (`restoreCircle`),
  undoing whatever the automatic removal or an erase stroke took away.
  Added in the "Drawing Magic" UX sprint specifically so a child can
  never lose part of their drawing to an over-eager automatic pass —
  previously Undo was the only way back. Both brushes share one
  generic primitive, `paintAlphaCircle(pixelBuffer, cx, cy, radius,
  targetAlpha, onBeforeChange)` — erase targets alpha 0, restore
  targets 255 — so they can't drift into two subtly different
  brushes, and both record undo history identically (a `Map` from
  pixel index to its alpha *before* the stroke touched it — not a
  whole-canvas snapshot, so an undo step's cost scales with how much
  was actually painted, not image size). "Oops!"/"Redo that" undo/redo
  either brush's strokes interchangeably, since the history doesn't
  care which direction a stroke moved alpha in. Brush size is three
  fixed choices (Small/Medium/Large) rather than a numeric slider —
  the slider element itself (`brushSizeSlider`) still exists, hidden,
  as the one thing both brushes and the size buttons actually read.
- **"Trim Picture" (Manual Crop)** — drag a free rectangle directly on
  the picture, then apply. No rotation, no perspective correction, no
  resizing — a plain rectangular crop, reusing the exact same
  `cropPixelBuffer()` the automatic Auto Crop step already uses. Manual
  Crop is explicitly downstream of Cleanup, matching how a person
  actually works: clean up stray fragments (or bring some back) first,
  then frame the final result.
- **Tolerance / Edge Smoothness / Auto Crop** are no longer
  child-editable controls — the child-facing UI hides them entirely
  (Auto Crop stays fixed on) so a picture only ever needs one
  automatic pass. The underlying elements and their `input`/`change`
  listeners are all still present and functional (see
  [The child-facing UX layer](#the-child-facing-ux-layer)); if
  something ever did change one of them post-load, the automatic
  pipeline would still correctly rerun and reset any manual edits with
  an explanatory toast — there's no sound way to replay a brush stroke
  or a crop rectangle onto a differently-processed image, so the tool
  stays honest about that rather than trying to fake it.

## Quality Contract

**This is the tool's highest-priority requirement — above background
removal quality itself.** The utility exists to remove backgrounds; it
must never, in the process, alter the artwork itself. Concretely:

- Only the alpha channel may ever change. A kept pixel's RGB must be
  byte-identical to the original file's RGB, always.
- No resizing, blurring, sharpening, denoising, contrast/saturation/
  gamma/brightness adjustment, JPEG recompression, or any other
  quality-reducing step, anywhere in the pipeline.
- Export is always a lossless PNG at the image's own resolution
  (cropping trims transparent margin; it never rescales content).

Every module in the automatic pipeline and both manual tools already
holds to this by construction: `backgroundRemoval.js`'s flood fill
only ever *reads* RGB (to classify a pixel), `edgeSmoothing.js`'s
`applyAlpha` only ever writes byte offset `+3` (alpha) of each pixel,
`cleanupBrush.js`'s `eraseCircle` does the same, and `cropper.js`
only ever copies whole pixels into a smaller rectangle. None of them
can rewrite a kept pixel's colour, by construction, not by convention.

**A real violation was found and fixed while building this.** It
didn't come from any of those modules — it came from `<canvas>`
itself. Browsers commonly store a canvas's bitmap premultiplied by
alpha internally; reading it back via `getImageData()` or
`canvas.toBlob()` un-premultiplies by dividing each channel by its own
pixel's alpha, which is lossy at low alpha and undefined at alpha=0.
Verified empirically: a background pixel that should have stayed
`rgb(250,248,245)` at alpha 0 came back as flat `rgb(0,0,0)`, and even
lightly-feathered edge pixels (alpha 10–50) drifted by several channel
values — and since `canvas.toBlob('image/png')` reads from that same
backing store, **the exported file itself was affected**, not just an
in-memory display quirk.

The fix: nothing that needs faithful RGB is allowed to round-trip
through canvas pixel readback.

- **Export** (`js/pngEncoder.js`) hand-builds the PNG file format
  directly from the authoritative pixel buffer — PNG signature, IHDR,
  and an IDAT chunk deflated with the native `CompressionStream`
  Web API (which produces zlib-wrapped output, exactly what a PNG
  IDAT needs) — with no `<canvas>` involved at any point. A CRC32
  implementation is the only supporting code; there is no external
  PNG library.
- **The Difference view** (see below) compares the authoritative
  `original` and `working` pixel buffers directly, never via
  `getImageData()` on a canvas that's had non-opaque pixels drawn
  into it.
- **The Cleanup Brush and Manual Crop** both mutate the authoritative
  buffer in place; `<canvas>` is used only to *display* the result
  (which is visually correct regardless of this quirk, since a
  fully-transparent pixel composites as nothing either way) — never
  to read it back.

Verified end to end: a full pixel-by-pixel comparison of a real
exported PNG against its source image shows **zero RGB mismatches**,
including at fully-transparent and partially-feathered pixels, and the
in-app Difference view (which amplifies any RGB drift ×8 into a bright
red signal) renders flat black across the entire image on a correctly
processed result — the same guarantee the export file itself carries.

## Preview experience

- **Side by side** — Original and Transparent, always both visible.
- **Original / Processed** — a single pane, toggled by clicking it.
- **Overlay** (`js/analysisView.js`'s `drawOverlay`) — the current
  result composited at partial opacity on top of the untouched
  original, correctly positioned even after a crop has shifted the
  result's own origin. Useful for checking the removed edge actually
  lines up with the artwork's real boundary.
- **Difference** (`drawDifference`) — for every pixel the current
  result covers, shows `max(|Δr|,|Δg|,|Δb|)` against the original,
  amplified ×8 and rendered as red intensity: black means untouched,
  any visible red is a genuine colour change. This is the tool's own
  proof that the Quality Contract holds, not just a debugging aid —
  see above.

Both views correctly track a Manual Crop's offset (`workingOffsetX/Y`
in `app.js`), so they keep comparing against the right sub-region of
the original after cropping, not a coordinate-shifted mismatch.

## Performance

Automatic processing runs inside a dedicated Web Worker (`js/worker.js`,
loaded as an ES module worker) so a large image never blocks the page.
The flood fill and box blur both use typed arrays (`Uint8Array`,
`Int32Array`, `Float32Array`) and avoid per-pixel allocation — the
flood-fill queue is a single pre-sized `Int32Array` rather than a
growing JS array, and the feather blur uses a sliding-window running
sum so its cost is independent of blur radius. Pixel buffers are
transferred between the main thread and the worker (`postMessage`'s
transfer list), not copied, except for the one clone kept on the main
thread so the user can keep adjusting sliders without re-reading the
source file. A 4000×3000 test image processes in roughly half a
second to just over one second depending on content, well under the
~3 second target; PNG export of the same image (the hand-rolled
encoder, `CompressionStream`-backed) adds well under a second more.
The Cleanup Brush and Manual Crop run synchronously on the main thread
rather than in the Worker — they react to a live drag and need to
redraw every frame, and are cheap enough (bounded by brush size, or a
one-time rectangular copy) not to need one.

## Current limitations

- Single background colour/region per image (by design — see V2
  below). An image with two very different background zones (e.g.
  half white paper, half wood desk) will only cleanly remove
  whichever one the border pixels are dominated by.
- Feathering is a uniform box blur, not a true alpha matte estimator
  — very fine, hair-thin details (a single stray pencil line touching
  the background) can lose a little softness at the very tip.
- The Cleanup Brush undo/redo history has no size cap. In ordinary
  use (a handful of small corrective strokes) this is a non-issue,
  since each entry only stores the pixels that stroke actually
  touched — but an unusually long, sweeping-stroke-heavy session on a
  very large uncropped image could accumulate meaningfully.
- The Cleanup Brush redraws the whole canvas on every mouse-move tick
  of a stroke; on a very large, unfitted working buffer this is more
  work per frame than on an already auto-cropped one, though still
  well within interactive frame budgets in testing.

## Version roadmap

- **V1 — White paper removal.** Flood-fill based removal targeting
  artwork photographed or scanned on a roughly uniform light
  background.
- **V1.1 — Upload reliability, manual finishing tools, and quality
  hardening.** Fixed a real double-file-chooser race in the Browse
  button (a click bubbling from the button to its parent dropzone
  fired `fileInput.click()` twice); found and fixed the canvas
  premultiplied-alpha RGB corruption described above with a
  dependency-free PNG encoder; added the Cleanup Brush, Manual Crop,
  and the Overlay/Difference preview views; live-updating, fit-to-view
  zoom with independently resizable preview panes.
- **V1.2 — "Drawing Magic": the child-facing UX transformation**
  *(this version)*. No pipeline/algorithm change — see
  [The child-facing UX layer](#the-child-facing-ux-layer). Added the
  Restore Brush ("Bring It Back," the one genuinely new capability —
  V1.1's own roadmap entry below had flagged this as a possible V4
  item; it turned out to be needed now, not later, once a child could
  actually lose part of a drawing to an over-eager automatic pass with
  no way back but Undo) alongside a full screen-flow/branding/copy
  pass (Welcome → magic-processing moment → celebratory Result screen
  with a before/after slider → optional "Make It Better" editing
  screen with three fixed brush sizes instead of a numeric slider).
- **V2 — Uniform colour removal.** Generalizes `WhitePaperStrategy`'s
  approach to any single dominant background colour (green screen,
  coloured construction paper, a solid-colour desk), not just white/
  near-white.
- **V3 — Local AI segmentation.** A locally-run, offline segmentation
  model (still no network calls, still no external API) for artwork
  photographed against a busy or non-uniform background where
  flood-fill alone can't separate subject from background.
- **V4 — Further manual refinement**, as real usage surfaces concrete
  gaps Remove More/Bring It Back/Trim Picture still don't cover.

## Becoming an Asset Normalizer step

The entire pipeline this tool runs is the four-function sequence
`worker.js` composes:
`detectBackground → run(strategy) → featherMask/applyAlpha → cropPixelBuffer`,
plus, optionally, the same `cropPixelBuffer()` again for a manual crop
and `eraseCircle()` for manual cleanup. All of these are plain
functions over `{ data, width, height }` objects with no DOM, Canvas,
or Worker dependency — `worker.js` is a thin wrapper that happens to
run the automatic ones off the main thread and talk to it over
`postMessage`. A future Asset Normalizer step can call the same
functions directly (e.g. from a Node script using a `Canvas`-like
`Uint8ClampedArray` source), without needing a browser, a Worker, or
any of this UI — including `js/pngEncoder.js`, which needs only the
`CompressionStream` Web API, available in Node via `node:stream/web`.
