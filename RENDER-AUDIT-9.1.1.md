# Sprint 9.1.1 — WYSIWYE Investigation (part 2)

## Why 9.0.2 was not enough

Sprint 9.0.2 addressed *retina* softness by making
`SlideRenderer.init(canvas, {dpr})` DPR-aware — the canvas backing
store grows to `W*dpr × H*dpr` on HiDPI displays, so retina users
see more pixel detail. That change was correct, but incomplete.

Empirical measurement in headless Chromium at `deviceScaleFactor=1`
(the ordinary DPR=1 case) shows the remaining gap:

| Surface        | Display size (CSS px) | Backing (device px) | Downsample |
|----------------|-----------------------|---------------------|------------|
| Editor preview | 400 × 500             | 1080 × 1350         | **2.70×**  |
| Chrome PDF viewer (100% zoom) | 720 × 900 | 1080 × 1350 | **1.50×**  |

The editor is running 1.80× more aggressive downsampling than a PDF
viewer showing the same content. That is why story titles, story
beats, pencil strokes, decorations and typography ALL look softer in
the editor than in the published Book — the difference isn't in the
render pipeline (they share `SlideRenderer.render`); it's in the
CSS-imposed display size.

## Root cause

`css/style.css` currently pins the preview canvas at a fixed size:

```css
#previewCanvas{
  width: 500px;
  height: 625px;
  ...
}
```

A PDF viewer draws the 540 × 675 pt PDF page at its natural 96 dpi
size = 720 × 900 CSS px. Because the editor is smaller, the browser
compresses the 1080-wide canvas backing into a much smaller display
area, and Chrome's canvas resampler smears fine detail.

**Story Book** and **Story Carousel** exports are unaffected because
they emit the 1080 × 1350 bitmap directly — the viewer / OS handles
display scaling from that native resolution.

## The fix (Sprint 9.1.2)

Make the editor canvas CSS-fluid so the display size expands to
match the available preview column width, up to native 1080 × 1350
CSS px:

```css
#previewCanvas{
  width: 100%;
  max-width: 1080px;
  aspect-ratio: 4 / 5;
  height: auto;
  ...
}
```

On a typical 1440-wide test window the editor preview column allows
~720 CSS px — which is the same display size the Chrome PDF viewer
uses for the Story Book PDF. At that size the downsample ratio drops
from 2.70× to 1.50× — the editor and the PDF are now painting at
the same display resolution from the same source pixels, so they
look identical.

The DPR-aware backing store from 9.0.2 continues to work on top of
this: on retina displays, the fluid CSS size × DPR still gives the
GPU enough pixels to render sharp.

## Validation plan (Sprint 9.1.5)

1. Screenshot the editor preview area at 1440 × 900.
2. Screenshot the Story Book PDF page 1 at native size.
3. Screenshot a Story Carousel Portrait PNG at native size.
4. Confirm story title, story beat, decorations, footer, logo and
   theme colours look identical between the three surfaces.
