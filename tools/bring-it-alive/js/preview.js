/* PREVIEW — showing, never touching.
 *
 * Every canvas here is presentation: scaled drawing of pixels that were
 * decided elsewhere. Scaling is allowed HERE and only here, because a
 * preview is a picture of the asset, not the asset — the exported PNG
 * never passes through this module.
 *
 * v0.1's night-sky preview is GONE, removed by the sprint's correction:
 * the output of this tool is not an Ether scene, it is an editable
 * VihuPlanet creation, and the child decides later where it belongs. The
 * final step's surface now lives in editor.js (a light checkerboard —
 * transparency shown honestly). What remains here is the developer strip:
 * the original-vs-asset comparison and views of each layer of the
 * creation document, so a human can SEE that original / paint / erase-mask
 * are separate things.
 */
(function () {
  'use strict';

  function fit(iw, ih, cw, chh) {
    const s = Math.min(cw / iw, chh / ih, 1);
    return { w: Math.max(1, Math.round(iw * s)), h: Math.max(1, Math.round(ih * s)) };
  }

  function assetCanvas(asset) {
    const c = document.createElement('canvas');
    c.width = asset.imageData.width; c.height = asset.imageData.height;
    c.getContext('2d').putImageData(asset.imageData, 0, 0);
    return c;
  }

  /* Developer side-by-side: the original photograph's crop next to the
   * extracted asset at the SAME scale, so a replaced or redrawn pixel
   * would be visible as disagreement between neighbours. */
  function devCompare(canvasOrig, canvasAsset, photo, asset) {
    const crop = asset.crop;
    const f = fit(crop.w, crop.h, canvasOrig.width, canvasOrig.height);
    for (const c of [canvasOrig, canvasAsset]) {
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0f1526'; ctx.fillRect(0, 0, c.width, c.height);
    }
    const octx = canvasOrig.getContext('2d');
    octx.drawImage(photo.canvas, crop.x, crop.y, crop.w, crop.h,
      (canvasOrig.width - f.w) / 2, (canvasOrig.height - f.h) / 2, f.w, f.h);
    const actx = canvasAsset.getContext('2d');
    actx.drawImage(assetCanvas(asset),
      (canvasAsset.width - f.w) / 2, (canvasAsset.height - f.h) / 2, f.w, f.h);
  }

  /* A binary plane (mask / erase-mask), white = set. */
  function plane(canvas, bits, w, h) {
    const small = document.createElement('canvas');
    // Render at reduced size — a 16MP boolean image does not need 16MP.
    const f = fit(w, h, canvas.width, canvas.height);
    small.width = f.w; small.height = f.h;
    const id = small.getContext('2d').createImageData(f.w, f.h);
    for (let y = 0; y < f.h; y++) {
      const sy = Math.min(h - 1, Math.round(y * h / f.h));
      for (let x = 0; x < f.w; x++) {
        const sx = Math.min(w - 1, Math.round(x * w / f.w));
        const v = bits[sy * w + sx] ? 255 : 0;
        const di = (y * f.w + x) * 4;
        id.data[di] = id.data[di + 1] = id.data[di + 2] = v; id.data[di + 3] = 255;
      }
    }
    small.getContext('2d').putImageData(id, 0, 0);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, (canvas.width - f.w) / 2, (canvas.height - f.h) / 2);
  }

  /* Raw segmentation mask view, kept from v0.1. */
  function maskView(canvas, seg) { plane(canvas, seg.mask, seg.width, seg.height); }

  /* An RGBA layer (a canvas — the creation's original or paint layer),
   * scaled onto a dark neutral so transparent regions read as empty. */
  function layer(canvas, srcCanvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f1526'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const f = fit(srcCanvas.width, srcCanvas.height, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, (canvas.width - f.w) / 2, (canvas.height - f.h) / 2, f.w, f.h);
  }

  window.BIAPreview = { devCompare, maskView, plane, layer, fit };
})();
