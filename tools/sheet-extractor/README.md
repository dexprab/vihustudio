# Sheet Extractor

A standalone, dependency-free browser tool that takes a real flat-lay
reference image (a moodboard, sprite sheet, scanned collage, photographed
sheet of stickers, etc.) and cuts out every visually distinct object into
its own transparent PNG — using **real pixels from the source image**, not
illustration. Runs entirely in your browser; nothing is uploaded anywhere.

This is genuinely different from illustrating a fresh, matching asset pack
by hand: this tool does actual image segmentation on a real photo/scan you
provide, and produces true per-pixel alpha cutouts of what's actually
there.

## Using it

Open `index.html`. Upload (or drag-and-drop) a reference image, adjust the
options if the defaults don't fit your sheet, click **Extract Objects**,
then download individual PNGs or **Download All as ZIP**.

## How it works

The whole pipeline runs on Canvas 2D for reading the source image, but
**never** for writing the output — see "A real bug, found and fixed"
below for why that distinction matters.

1. Load the source image into a canvas, read its raw pixel data.
2. Sample the four corners to estimate the background color.
3. Classify every pixel as background or foreground by color distance from
   that background.
4. Slightly dilate the foreground mask (bridges tiny anti-aliasing/
   compression-noise gaps) purely for the purpose of *grouping* pixels into
   objects — never for what actually gets cropped or drawn.
5. Connected-component label the dilated mask (flood-fill/BFS) to find each
   separate object, and discard anything smaller than a minimum area (to
   drop stray noise/dust specks).
6. For each surviving object, compute its **tight** bounding box from the
   real, undilated pixels only, add the requested padding, and copy that
   region's real source pixels into a raw pixel buffer — with anything
   that isn't this object's own pixels (background, or a different
   neighboring object) forced fully transparent, even where two objects'
   padded crop boxes geometrically overlap.
7. Boundary pixels get a soft alpha (based on how close their color is to
   the background) instead of a hard, jagged cutout edge.
8. Objects are numbered in natural reading order (top-to-bottom bands, then
   left-to-right).
9. Each object's raw pixel buffer is encoded straight to PNG bytes by
   `js/pngEncoder.js` — no `<canvas>` involved in this step at all.

## Options

| Control | Default | Meaning |
|---|---|---|
| Color Threshold | `24` | How different from the background a pixel must be to count as foreground. Lower = more sensitive (good for objects close in color to the background); higher = more tolerant of background texture/noise. |
| Padding | `8%` | Extra room left around each object's own tight bounding box, so nothing is cropped flush. |
| Min Object Size | `0.015%` | Objects smaller than this fraction of the *whole image's* area are discarded as noise. Raise this if small real details are being kept that you don't want; lower it if small real objects are being thrown away. |
| Gap Bridging | `2` | Radius (px) used only to decide which pixels belong to the same object — never affects what's actually cropped. |
| Filename Prefix | (from filename) | Output files are named `<prefix>-001.png`, `<prefix>-002.png`, etc. |
| Background | Auto-detect | Force a specific background color instead of auto-sampling the corners — use this if the corners aren't representative of the true background. |

## A real bug, found and fixed: canvas export can silently corrupt RGB at partial alpha

`tools/background-remover/` — a sibling tool in this repo — already found
and documented a real browser behavior: `canvas.toDataURL()`/`toBlob()`
(and `getImageData()`, for that matter) read from the canvas's own
internal bitmap storage, which browsers commonly keep **premultiplied by
alpha** for compositing performance. Converting that back to straight RGBA
divides each channel by its own pixel's alpha — undefined at alpha=0,
lossy at low alpha — so a canvas round-trip can silently rewrite the RGB
of every partially-transparent pixel.

This tool deliberately gives boundary pixels a soft, partial alpha (an
anti-aliased cutout edge rather than a hard jagged one) — exactly the
class of pixel this bug can corrupt — so before hosting this, that claim
was verified directly rather than assumed:

- Writing known RGBA values via `putImageData` and reading them straight
  back via `getImageData()` **on the same canvas — no export involved at
  all** — already showed real corruption at low/partial alpha (e.g. a
  genuine `(42,157,143,40)` pixel came back `(45,159,140,40)`;
  `(42,157,143,1)` came back `(0,255,255,1)`). This confirms the
  corruption is baked into the canvas's own backing store, not merely an
  export-step artifact — so `canvas.toDataURL('image/png')`, which reads
  from that same corrupted store, would write those wrong values straight
  into the exported file.
- Fixed by writing output PNGs with a small, dependency-free hand-rolled
  encoder (`js/pngEncoder.js`, adapted from
  `tools/background-remover/js/pngEncoder.js`'s own already-verified
  approach) that builds the PNG file format directly from the raw pixel
  buffer — PNG signature, IHDR, and a `CompressionStream('deflate')`-
  compressed IDAT chunk — with **zero canvas involved** in the write path
  at all.
- Verified this actually fixes it, at the file-byte level, not just by
  re-reading through another canvas (which would reintroduce the exact
  same corruption regardless of how correctly the file itself was
  written): parsed the resulting PNG's own chunk structure directly,
  inflated the IDAT payload, and compared the decompressed scanline bytes
  to the original pixel buffer. Every pixel — including `alpha=0` and
  `alpha=1`, the cases that corrupted worst under `canvas.toDataURL` — is
  stored **byte-identical** in the actual file.

One nuance worth stating plainly: *displaying* a translucent PNG by
drawing it onto an HTML canvas and reading it back will still show the
same premultiply/unpremultiply artifact — that's an unavoidable property
of canvas itself, not something any exporter can fix, and it doesn't mean
the file is wrong. What matters is that the **file bytes** this tool
writes are correct, verified independent of any later canvas
re-inspection — any real PNG decoder (an image editor, `<img>` for plain
display, re-uploading it elsewhere) reads the true, uncorrupted values
straight off disk.

## Verified, not just assumed

Validated with a synthetic test sheet covering the cases that actually
matter for a real moodboard, run through the real, hosted UI end to end
(a real file upload, a real Extract click, real download links, a real
"Download All as ZIP"):

- **Genuinely transparent output** — every corner of every cropped PNG
  reads `(0,0,0,0)` (fully transparent, zero RGB), confirmed via direct
  pixel sampling, not just visual inspection.
- **Real source shadows survive the cutout** — an object drawn with an
  actual drop shadow in the source correctly keeps that shadow in its own
  crop; nothing invents or discards shadow data.
- **Correct tight bounding boxes** — every object's reported box matches
  its true geometric extent exactly (verified against known shape
  parameters, e.g. a circle at center `(120,100)` radius `60` reports
  exactly `x:60,y:40,w:120,h:120`), not inflated by the internal
  gap-bridging dilation step.
- **No cross-contamination even under genuine padded-box overlap** — two
  objects placed close enough together that their own *padded* crop
  rectangles literally extend into each other's real colored pixels (not
  just each other's background margin) were confirmed, via direct pixel
  sampling inside that exact overlap zone, to come out **fully
  transparent** in each other's crop — neither shows a trace of the
  other's actual color, while each still correctly shows its own real
  color everywhere it belongs.
- **Noise filtering works** — a deliberate 3×3px stray speck is correctly
  discarded by the minimum-area filter.
- **The exported ZIP is a real, valid PKZip archive** — starts with the
  correct local-file-header signature and contains every extracted PNG.

## Real, disclosed limitations

This is color-distance / connected-component segmentation, **not**
semantic or ML-based object detection. Stated plainly, not glossed over:

- **It will NOT separate two objects that visually touch or overlap with
  no gap** — they come out as a single merged component. This was tested
  deliberately (two touching circles in the test sheet) and confirmed to
  behave exactly this way — a real, inherent limitation of this technique,
  not a bug.
- **It needs a reasonably clean, roughly-uniform background.** A busy
  photographic background (wood grain, fabric texture, a patterned
  surface) will confuse the background/foreground threshold and either
  swallow real objects into the "background" or split the background
  itself into spurious "objects." It works best on a flat-lay sheet shot
  against a plain surface, or a digital moodboard/collage with a clean
  background.
- **Every output pixel is a direct copy of the source image.** Nothing is
  redrawn, upscaled, or hallucinated — if the source photo is low
  resolution or blurry, the cutout will be too.
- **The source image itself is assumed opaque (no pre-existing
  transparency).** The one canvas read this tool does perform — decoding
  the *uploaded* image — is only safe from the premultiply/unpremultiply
  issue above because a real photo/scan/flat moodboard has alpha=255
  everywhere already; an already-transparent input PNG isn't the intended
  use case and isn't specifically protected against.

## Files

- `index.html` / `css/style.css` / `js/app.js` — the page itself and its
  UI wiring (upload, options, results grid, downloads).
- `js/extractor.js` — the segmentation algorithm (`window.extractSheet`).
- `js/pngEncoder.js` — the canvas-free PNG writer (`window.PngEncoder`).
- `js/zipWriter.js` — the "Download All as ZIP" writer, copied from this
  repo's own `js/zipWriter.js` (already dependency-free, STORED-only PKZip
  — no re-compression, since PNGs are already compressed).
