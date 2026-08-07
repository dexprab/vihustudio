# Sheet Extractor

A standalone, dependency-free browser tool that takes a real reference
image and cuts out every visually distinct object into its own transparent
PNG. Runs entirely in your browser; nothing is uploaded anywhere.

It offers **two independent choices**, deliberately not one switch,
because they genuinely are two separate questions:

**Mode — how objects are FOUND.**

- **Sheet** — one global colour distance from a sampled background. Right
  for a moodboard, sprite sheet, scanned collage, or flat-lay of stickers:
  something with a clean, roughly-uniform background and real gaps between
  objects.
- **Scan** — **local** contrast against the paper's own brightness right
  there. Right for a phone photo of a drawn page, whose lighting gradient
  defeats any single global threshold. See "Scan mode" below for the four
  separate ways a photographed page breaks the sheet approach.

**Redraw as solid ink — how each object is DRAWN.**

- **off** — keep the **real pixels from the source image**, so the cutout
  *is* the original object. This is real image segmentation on a photo or
  scan you provide, producing true per-pixel alpha cutouts of what's
  actually there — genuinely different from illustrating a matching asset
  pack by hand.
- **on** — throw the pixel values away, keep only the traced shape, and
  redraw it in one colour with anti-aliasing generated fresh.

Ink is what fixes photographed line art — keeping the original pixels is
exactly what makes a pencil line come out blurred, thin, or (pushed
harder) too black — but it is just as useful on a clean sheet of
flat-colour shapes someone wants recoloured, so it is offered in **both**
modes. The defaults keep the obvious pairing: Scan inks, Sheet doesn't.
Either can be flipped.

## Using it

Open `index.html`. Upload (or drag-and-drop) an image, pick the mode and
whether to redraw as solid ink (the defaults pair them the obvious way, so
usually just the mode), adjust the options if the defaults don't fit, click
**Extract Objects**,
then download individual PNGs or **Download All as ZIP**. A **Compression**
slider above the results lets you trade file size for color count on the
extracted PNGs — see "Compressing extracted images" below.

**Cropping.** Drag a box directly on the preview to use only part of the
image. This matters most for a phone photo, where the page rarely fills the
frame and whatever else is on the table is otherwise just another object to
be found. Every coordinate the tool reports back — object bounding boxes,
the reported source size — is relative to the crop, because that's what
you're actually looking at and what the cutouts are actually of. **Clear
crop** puts it back.

## How it works

The whole pipeline runs on Canvas 2D for *reading* the source image, but
**never** for writing the output — see "A real bug, found and fixed"
below for why that distinction matters.

Everything shares the same middle: build a binary mask of what counts as
"object", group the mask into connected components, discard the small ones,
compute each survivor's tight bounding box, and encode one PNG per object.
What differs is at the two ends — how the mask is built at the front (the
**mode**) and what gets drawn at the back (the **ink** switch). Those are
genuinely independent, so they're described separately below; any of the
four combinations is valid.

### Shared: grouping pixels into objects

1. Load the source image into a canvas (applying the crop, if any) and read
   its raw pixel data.
2. *(mode-specific: build the mask — see below)*
3. Slightly dilate the mask (bridging tiny gaps) purely for the purpose of
   *grouping* pixels into objects — never for what actually gets cropped or
   drawn.
4. Connected-component label the dilated mask (iterative BFS, 4-connectivity)
   to find each separate object, and discard anything smaller than a minimum
   area (to drop stray noise/dust specks).
5. For each survivor, compute its **tight** bounding box from the real,
   *undilated* mask only, and add the requested padding.
6. *(mode-specific: render the object — see below)*
7. Objects are numbered in natural reading order (top-to-bottom bands, then
   left-to-right).
8. Each object's raw pixel buffer is encoded straight to PNG bytes by
   `js/pngEncoder.js` — no `<canvas>` involved in this step at all.

### Finding objects: Sheet mode (one global colour distance)

Sample the four corners to estimate the background colour, then classify
every pixel by Euclidean colour distance from it against a single global
threshold. Simple, fast, and exactly right when the background genuinely
is one colour.

### Finding objects: Scan mode (local contrast)

A phone photo of a drawn page defeats the global approach in four separate
ways at once, and each one is worth naming because each one drove a
specific part of this mode:

- The four corners are the *table*, not the paper, so the sampled
  "background" is wrong before anything else happens.
- Lighting falls off across the page. There is no single global threshold
  that keeps the lit corner clean *and* still finds the drawing in the
  shaded one — a threshold low enough to catch pencil in shadow has already
  turned half the paper into one giant object.
- Pencil is mid-grey, not black, and photographed at an angle it's often
  only a pixel or two of real darkness.
- The previous page bleeds through, and that bleed-through is *genuine*
  contrast — it isn't noise you can filter away by area.

So the mask goes local. Convert to perceptual grayscale, then take a
separable box blur to get a per-pixel **local mean** — "what is the paper
right *here*". A pixel is ink when it is darker than its own local mean by
more than **Ink Sensitivity**. That one change is what lets a single
setting span a lit corner and a shaded one, and it's why the bleed-through
control is the same knob: bleed-through is faint *relative to its own local
paper*, so raising the sensitivity drops it while leaving real strokes
alone. The blur is a sliding-window sum, so it costs the same at a 90px
radius as at a 3px one — a phone photo wants a large radius.

A **What was traced** preview appears above the results in scan mode,
showing the mask itself in black-on-white. If the drawing is coming out
broken, that's where you can see it, and whether to reach for Ink
Sensitivity or Ink Weight.

### Drawing each object: ink off (keep the real pixels)

Copy that region's real source pixels into the output buffer, with anything
that isn't this object's own pixels (background, or a different
neighbouring object) forced fully transparent — even where two objects'
padded crop boxes geometrically overlap.

The cutout edge is softened by measuring each boundary pixel against the
**known background colour**, so it fades out instead of ending in a hard,
jagged step. That measurement only exists in Sheet mode: Scan detection has
no single background — that's its whole point — so **scan + ink off keeps
each boundary pixel's own source alpha and gives a hard edge**. A hard edge
is the honest answer when there's nothing to measure against; inventing a
softening factor would just be a guess wearing a number.

### Drawing each object: ink on (redraw the traced shape)

Throw the pixel values away and keep only the shape. It is optionally
thickened by **Ink Weight**, then filled with your chosen **Ink Colour** —
none of the source's own colours survive at all. The anti-aliased edge is
generated *fresh*, by blurring the **coverage** (the binary mask) rather
than the colour, so the interior stays solid and the edge is genuinely soft
rather than merely a faded copy of a blurry photograph.

That last point is the whole reason ink exists. Background *removal*
preserves original pixels and softens the boundary; line art wants the
opposite. And because the output is a clean single-colour mask rather than
photographic pixels, recolouring it later is nearly free — a `fillStyle`
plus `source-in` — rather than needing the tone-mapping tricks you'd
otherwise be stuck with.

## Options

Shared by both modes:

| Control | Default | Meaning |
|---|---|---|
| Padding | `8%` (sheet) / `10%` (scan) | Extra room left around each object's own tight bounding box, so nothing is cropped flush. |
| Min Object Size | `0.015%` (sheet) / `0.04%` (scan) | Objects smaller than this fraction of the *whole image's* area are discarded as noise. Raise this if small real details are being kept that you don't want; lower it if small real objects are being thrown away. |
| Gap Bridging | `2` (sheet) / `8` (scan) | Radius (px) used only to decide which pixels belong to the same object — never affects what's actually cropped. Scan mode wants this much higher: it's what pulls separate pen strokes into one drawing, or letters into one word. |
| Filename Prefix | (from filename) | Output files are named `<prefix>-001.png`, `<prefix>-002.png`, etc. |

Sheet mode only:

| Control | Default | Meaning |
|---|---|---|
| Color Threshold | `24` | How different from the background a pixel must be to count as foreground. Lower = more sensitive (good for objects close in color to the background); higher = more tolerant of background texture/noise. |
| Background | Auto-detect | Force a specific background color instead of auto-sampling the corners — use this if the corners aren't representative of the true background. |

Scan mode only:

| Control | Default | Meaning |
|---|---|---|
| Ink Sensitivity | `18` | How much darker than the paper *around it* a pixel must be to count as ink. Lower catches faint pencil; raise it to drop bleed-through from the previous page and paper texture. |
| Paper Radius | `3%` | How far out to look when working out what "the paper right here" is. This is what lets one setting span a lit corner and a shaded one. Too small and thick strokes hollow out (the middle of a fat stroke *is* its own local mean); too large and it behaves like a global threshold again. |

Ink fill only (either mode) — hidden entirely when **Redraw as solid ink**
is off:

| Control | Default | Meaning |
|---|---|---|
| Ink Weight | `1` | Thickens the traced shape before it's drawn. A pencil stroke photographed at an angle is often only a pixel or two of real darkness, which reads as thin and broken once redrawn. Applied *after* tracing, so it can never change what gets found. |
| Ink Colour | black | Every cutout is drawn in this colour. None of the source's own colours survive, so this is free to be anything. |

## Compressing extracted images

Once objects are extracted, the Results section shows a **Compression**
slider above the grid. It's a real, honest trade-off control, not just a
"make it smaller" button — every card's thumbnail and size line update
live as you move it, so you can actually see what a given setting looks
like and costs before downloading anything.

Two genuinely different techniques sit behind the slider's levels:

1. **Lossless (the leftmost/default position)** — every extracted PNG
   already benefits from this for free at extraction time: `pngEncoder.js`
   picks, per scanline, whichever of the 5 standard PNG filters (None/
   Sub/Up/Average/Paeth) compresses best, the same heuristic `libpng`'s
   own default encoder uses. This is fully invertible — the pixels this
   reconstructs to on decode are byte-for-byte identical no matter which
   filter was picked — so it costs nothing in quality, only in file size.
2. **Reduced color count (every other level)** — a real median-cut color
   quantizer, written entirely in JS: it finds the actual distinct colors
   used, groups them by splitting the group with the widest color range
   until the requested count is reached, and writes a **palette (indexed)
   PNG** instead of full RGBA — each pixel costs 1 byte instead of 4, on
   top of whatever DEFLATE saves. Fully-transparent pixels are first
   canonicalized to one shared color (their RGB carries no visual
   information, so this avoids wasting palette slots on background noise).

**When a level is honestly still lossless.** If an object's own real
distinct-color count already fits the level you picked (a flat-color
sticker with only a handful of real colors, say), the result is labeled
*"still lossless, just a smaller file"* rather than implying quality loss
that didn't actually happen — verified directly: the tool checks the real
color count against the cap before deciding what to say, it doesn't guess.

**Never makes a download bigger.** If quantizing an object would somehow
produce a *larger* file than the lossless version (can happen on a tiny
crop, where the palette table's own overhead outweighs the per-pixel
savings), the tool silently keeps the lossless bytes instead and says so
("kept lossless — a smaller version came out bigger, not smaller") — the
same "never make a real download bigger" discipline used elsewhere in
this codebase for image uploads.

**Still never touches `<canvas>`.** The indexed-PNG writer
(`PngEncoder.encodeIndexed`) is built the same way as the original RGBA
writer — straight from the raw pixel buffer, with a real `PLTE` (palette)
chunk and, when needed, a `tRNS` chunk carrying per-color transparency —
so the premultiplied-alpha corruption this whole tool exists to avoid (see
below) can never sneak back in through the compression step either.

**Everything downstream uses whichever level is currently selected** — the
individual "Download PNG" links, "Download All as ZIP", and even
re-running Extract on the same file (the selected level is remembered and
automatically re-applied, not reset to Lossless).

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

### Sheet mode

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
- **Compression genuinely does what it claims** — verified against the
  real, hosted UI (a real upload, a real Extract, a real slider drag): a
  high-color-count object (a radial gradient) compressed at the most
  aggressive level produces a real indexed PNG whose own palette (parsed
  directly from the file's `PLTE` chunk, no `<canvas>` involved) never
  exceeds the requested color count, and whose real byte size shrinks; a
  low-color-count object (a flat, non-anti-aliased shape) is correctly
  labeled "still lossless" rather than falsely implying loss; reverting to
  Lossless restores the *exact original* blob, not a new re-encode of it;
  and "Download All as ZIP" / re-running Extract both correctly use
  whichever compression level is currently selected.

### Scan mode

47 assertions, all passing. The fixture is a synthetic "notebook photo"
built to carry the four hazards named above at once: paper shading from
245 down to 155 left-to-right with per-pixel grain, a fabric-coloured strip
along one edge standing in for the table, a faint bleed-through line at 3.5%
opacity, and two drawings — a ring in the lit half, a square in the shaded
half — deliberately placed so no single global threshold can reach both.

- **It genuinely spans the gradient.** Both drawings are found, one in each
  region, each roughly its own drawn size (~69px and ~75px across), neither
  a runaway blob, with the bleed-through correctly *not* becoming a third
  object — and `background` reported as `null`, because scan mode samples
  no background at all.
- **A single global threshold provably cannot do the same job** — this is
  the claim the whole mode rests on, so it's tested as a claim rather than
  asserted. Sweeping the sheet-mode threshold from 30 to 70 over the same
  fixture: no value yields two clean objects, one per region; low values
  swallow the shaded half into one blob covering **88%** of the page; and
  raising the threshold never escapes it — at 60 and 70 the largest object
  is still **73%** and **57%** of the page. (What *does* change at the top
  of the sweep is that a 27×7 fragment of the bleed-through line crosses
  over and becomes its own "object" — so pushing higher changes what is
  wrong, not whether.)
- **The ink is genuinely redrawn, not preserved** — with Ink Colour set to
  `(220,30,30)`, *every* visible pixel across every cutout is **exactly**
  that colour, and none of the photo's own greys survive anywhere. The
  fresh anti-aliasing is real, not decorative: fully-opaque pixels are
  present (a solid interior), partial-alpha pixels are present (a soft
  edge), and more than two distinct alpha levels exist (a genuine ramp,
  not a hard on/off).
- **Ink Weight really thickens** — weight 2 lays down 3408 opaque pixels
  against 1278 at weight 0, without merging the two drawings into one or
  losing either.
- **Ink Sensitivity really is the bleed-through control** — at sensitivity
  4 the faint bleed-through *is* picked up (11 components); at the default
  18 it is not (2 components, the two real drawings).
- **Crop is honoured and every coordinate is crop-relative** — the reported
  source dimensions are the *cropped* ones, the clamped crop rect is
  reported back, every bounding box sits inside the crop in crop
  coordinates, and an object's box shifts by exactly the crop origin. An
  oversized crop is clamped to the image rather than throwing, and `crop`
  is `null` when none was asked for.
- **Sheet mode is untouched** — the same suite re-runs the original path
  and confirms it still hands back the **actual source pixels**
  (`(200,50,30,255)` and `(30,94,200,255)`, the fixture's own real colours,
  not a redraw), still samples a real background, and still runs by
  default when no mode is given.
- **The mask preview is a real file** — produced only when asked for, and
  carrying the real PNG signature read off the blob itself.
- **Housekeeping** — an impossible sensitivity returns nothing rather than
  throwing, and still hands back a mask so you can see why; zero page
  errors throughout.

### Both axes, all four combinations

32 assertions, all passing, alongside the 47 above and the 12 covering ink
colour end to end — all three still green after the split.

- **The two switches really are independent** — the mode radio flips only
  the detection fields (Ink Sensitivity and Paper Radius appear, Color
  Threshold and Background disappear), the ink checkbox flips only the
  render fields (Ink Weight and Ink Colour appear and disappear), and Ink
  Colour is reachable in *Sheet* mode, which is the whole point.
- **Sheet + ink off is unchanged** — the two fixture shapes come back
  carrying their own real source colours, `(200,30,30)` and `(30,94,200)`,
  neither leaking into the other's crop.
- **Sheet + ink on genuinely redraws** — every fully-opaque pixel across
  every cutout is exactly the chosen magenta, and none of the fixture's own
  red or blue survives anywhere.
- **Sheet + ink still honours the sheet-only background override** — a
  manual background colour is applied, and reported back, exactly as it is
  with ink off.
- **Scan + ink off keeps the real photographed pixels** — the previously
  unreachable combination now returns real mid-grey strokes rather than a
  redraw, and doesn't crash (it did, before; see below).
- **The API stayed backward compatible** — a call with no `inkFill` at all
  still inks in scan mode and doesn't in sheet mode, and the resolve
  payload reports both `mode` and `inkFill` so a caller can tell what it
  got.

## Real, disclosed limitations

This is threshold / connected-component segmentation, **not** semantic or
ML-based object detection. Stated plainly, not glossed over.

Both modes:

- **Neither mode will separate two objects that visually touch or overlap
  with no gap** — they come out as a single merged component. This was
  tested deliberately (two touching circles in the sheet-mode test sheet)
  and confirmed to behave exactly this way — a real, inherent limitation of
  this technique, not a bug. Scan mode makes this *more* likely, not less,
  because its much larger Gap Bridging default is deliberately trying to
  pull separate strokes into one drawing.
- **The source image itself is assumed opaque (no pre-existing
  transparency).** The one canvas read this tool does perform — decoding
  the *uploaded* image — is only safe from the premultiply/unpremultiply
  issue above because a real photo/scan/flat moodboard has alpha=255
  everywhere already; an already-transparent input PNG isn't the intended
  use case and isn't specifically protected against.

Sheet detection:

- **It needs a reasonably clean, roughly-uniform background.** A busy
  photographic background (wood grain, fabric texture, a patterned
  surface) will confuse the background/foreground threshold and either
  swallow real objects into the "background" or split the background
  itself into spurious "objects." It works best on a flat-lay sheet shot
  against a plain surface, or a digital moodboard/collage with a clean
  background. If you're hitting this on a *photo of a drawn page*, that's
  the case scan detection exists for.

Ink off (keep the real pixels):

- **Every output pixel is a direct copy of the source image.** Nothing is
  redrawn, upscaled, or hallucinated — if the source photo is low
  resolution or blurry, the cutout will be too.
- **With scan detection, the cutout edge is hard, not soft.** The soft
  edge is measured against a known background colour, and scan detection
  deliberately never establishes one. Turning ink on gives a soft edge in
  either mode, because it generates that edge fresh from the traced shape
  rather than measuring against anything.
- **A cutout can carry a thin opaque halo of background.** Which pixels
  belong to an object is decided on the *dilated* mask (that's what Gap
  Bridging does), while only the outermost ring gets its alpha softened —
  so at the default Gap Bridging of 2 there's an inner ring that stays
  fully opaque. The crop *box* is unaffected (it's recomputed from the
  undilated mask), and ink fill doesn't have this at all, because it reads
  the undilated mask directly. Pre-existing and deliberately left alone:
  changing it would change every existing sheet cutout's edges.

Scan detection:

- **It does not dewarp.** A page photographed at an angle, or bowed near
  the spine of a bound notebook, comes out at that angle and that bow.
  Local-mean thresholding is not bothered by the *lighting* that curvature
  causes, but it does nothing about the geometry itself. Deliberately out
  of scope.
- **Paper Radius has a real range where it's wrong in both directions.**
  Too small and thick strokes hollow out — the middle of a fat stroke *is*
  its own local mean, so it stops reading as darker than its surroundings.
  Too large and it degenerates back into the global threshold this mode
  exists to avoid.
- **Bleed-through versus faint pencil is a genuine judgement call, on one
  knob.** They are the same kind of signal — slightly darker than the paper
  around them — differing only in degree, so Ink Sensitivity cannot cleanly
  separate them in principle, only in practice, on a given page. The **What
  was traced** preview is there precisely because this is the setting most
  likely to need a look rather than a guess.
- **The verification fixture is synthetic.** It was built to carry the
  hazards a real phone photo has (lighting falloff, grain, a non-paper
  edge, bleed-through), and it does — but a synthetic page is not a real
  one. Whether *your* page comes out right is still your own eyes to judge.

Ink on (redraw the traced shape):

- **It throws the original pixels away, on purpose.** Shading, tonal
  variation, coloured pencil, anything painted — none of it survives; you
  get a single-colour silhouette of the traced shape. For line art that's
  the point; for anything with real tone in it, turn ink off.

## Files

- `index.html` / `css/style.css` / `js/app.js` — the page itself and its
  UI wiring (upload, mode switch, ink switch, crop overlay, options, mask
  preview, results grid, downloads). Each mode remembers its own settings
  for the shared controls that want different defaults — including whether
  ink was on — so switching back and forth doesn't lose what you'd already
  dialled in.
- `js/extractor.js` — segmentation (`window.extractSheet`): the shared
  component-labelling core; the two detection masks (sheet's global
  colour-distance one, scan's local-mean one, plus scan's mask preview);
  and the two renders (the real-pixel copy and the fresh-anti-aliased ink
  redraw). Detection and render are selected independently, so any of the
  four combinations is reachable.
- `js/pngEncoder.js` — the canvas-free PNG writer (`window.PngEncoder`),
  including the per-scanline filter selection both `encode`/`encodeIndexed`
  share, and the indexed-PNG (palette + `tRNS`) writer the Compressor uses.
- `js/pngCompressor.js` — the Compressor (`window.PngCompressor`): the
  slider's level table and the median-cut color quantizer.
- `js/zipWriter.js` — the "Download All as ZIP" writer, copied from this
  repo's own `js/zipWriter.js` (already dependency-free, STORED-only PKZip
  — no re-compression, since PNGs are already compressed).
