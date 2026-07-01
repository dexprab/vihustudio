# Sprint 9.0.1 — Rendering Audit

Investigation into why the editor preview looks softer than the published PDF.

## The three rendering pipelines

Every rendered slide flows through `SlideRenderer.render(payload)`. The
renderer is stateful only in that `init(canvas)` binds a target canvas +
2D context; every subsequent `render(payload)` draws into whatever
canvas `init` most recently bound.

### 1. Editor pipeline (`js/app.js`)

```
SlideRenderer.init(previewCanvas)   // once at DOMContentLoaded
SlideRenderer.render(payload)       // every draw()/redrawPreview()
```

`previewCanvas` backing store: 1080 × 1350 (set by `SlideRenderer.init`).
CSS display size: **500 × 625** (see `#previewCanvas` in `css/style.css`
line 242). Browser resamples 1080 → 500 CSS px = 2.16× downscale.

### 2. Publish Studio Read pipeline (`js/publishStudio.js`)

```
SlideRenderer.init(_readCanvas)     // 1080 × 1350 backing
SlideRenderer.render(payload)
SlideRenderer.init(previewCanvas)   // rebind so editor stays live
```

`.publish-read-canvas` CSS: `width:100%; height:100%` — sized to the
book stage inside the modal, typically 550 × 690 CSS px. Same CSS
downscale problem as the editor.

### 3. PDF export pipeline (`js/publishStudio.js` → `js/pdfWriter.js`)

```
offscreenCanvas = 1080 × 1350
SlideRenderer.init(offscreenCanvas)
SlideRenderer.render(payload)
dataURL = offscreenCanvas.toDataURL('image/jpeg', 0.92)
pdfWriter.build(pages, 540, 675)     // 540 × 675 pt PDF page
```

No CSS involvement. The 1080 × 1350 JPEG is embedded straight into a
540 × 675 pt page (= 144 DPI). PDF readers rasterise at the display's
device pixel ratio, so the full 1080 × 1350 detail survives.

## Where the pipelines diverge

| Aspect                     | Editor           | Read             | PDF              |
|----------------------------|------------------|------------------|------------------|
| Canvas backing             | 1080 × 1350      | 1080 × 1350      | 1080 × 1350      |
| `imageSmoothingEnabled`    | `true`           | `true`           | `true`           |
| `imageSmoothingQuality`    | `'high'`         | `'high'`         | `'high'`         |
| Renderer code path         | shared           | shared           | shared           |
| CSS display size           | 500 × 625        | ~550 × 690       | n/a              |
| **DPR-aware backing**      | ❌ **no**        | ❌ **no**        | n/a              |
| Downstream consumer        | browser resample | browser resample | PDF reader @ DPR |

**The only divergence that matters is the third-to-last row.** Editor
and Read both back the canvas at 1080 × 1350 device pixels while CSS
paints it at ~500–550 CSS px. On a DPR = 1 display, this is a lossy
resample. On DPR = 2, backing store = 1080 device px for a 500 CSS px
element = 500 × 2 = 1000 device px viewport — near 1:1, so retina
users perceive very little softness.

The PDF reader, in contrast, always rasterises at the device DPR from
the embedded 1080 × 1350 bitmap. So the PDF is always crisp regardless
of user DPR.

## Text, images, and decoration

- **Story title / beat / footer / handle:** all use `x.font =
  '<style> <size>px <family>'` with the resolved theme font. Text is
  drawn once at 1080 × 1350 units; the softness the user perceives is
  from the CSS downscale, not from the text rasteriser.
- **Child artwork (uploaded image):** goes through `ImageViewEngine`
  with `imageSmoothingQuality='high'`. Downscale to the holder rect
  is one high-quality resample. The PDF preserves this; the editor
  then does a *second* lossy CSS resample when it shrinks 1080 → 500.
- **Decorations:** rendered as Unicode glyphs sized in canvas px.
  Identical across pipelines.
- **Stickers:** SVG data-URL → `Image` → `drawImage` at holder rect.
  Identical across pipelines.
- **Borders / shadows / frame designs:** rendered via
  `_drawPictureFrameFill / _drawPictureFrameOrnament /
  _drawPictureFrameStroke`. Identical across pipelines.

## The convergence plan (Sprint 9.0.2)

1. Extend `SlideRenderer.init(canvas, opts)` to accept an optional
   `{dpr}` in `opts` (default = `window.devicePixelRatio || 1`).
   Backing store becomes `1080 * dpr × 1350 * dpr`; canvas gets
   `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so the entire renderer
   continues to draw in 1080 × 1350 coordinate units without touching
   any downstream code.
2. Export paths (`PublishStudio._renderNextPage`, thumbnails,
   sticker decodes) explicitly pass `{dpr: 1}` — their output must
   stay 1080 × 1350 pixels because a) that's what the PDF embeds, and
   b) that's what `toDataURL` should produce.
3. Publish Studio Read canvas gets the same DPR-aware `init` so it
   matches the editor exactly.

Once (1–3) land, the editor, the Read canvas, and the PDF export all
draw from identical 1080 × 1350 canvas backing store logic. The only
remaining difference is the medium (CSS canvas vs PDF reader), and
each medium now renders at the display's full DPR — so what the child
sees IS what they'll get.

## Success criteria

- SHA-256 of `SlideRenderer.render(payload)` output at DPR = 1 equals
  the SHA-256 of the equivalent 1080 × 1350 JPEG the PDF embeds
  (pending: JPEG's inherent lossiness will shift the hash; instead
  we compare the PNG-encoded canvas bitmap byte-identically).
- The editor canvas, when rendered at DPR = 2, contains 2160 × 2700
  device pixels of detail — same order of magnitude as the printed
  page renders at 144 DPI in a PDF reader on the same device.
