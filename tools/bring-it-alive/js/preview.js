/* PREVIEW — showing, never touching.
 *
 * Every canvas here is presentation: scaled drawing of pixels that were
 * decided elsewhere. Scaling is allowed HERE and only here, because a
 * preview is a picture of the asset, not the asset — the exported PNG
 * never passes through this module.
 *
 * The night-sky preview exists for one product reason: over a checkerboard
 * a cutout still reads as an image-editor artefact; over a quiet dark sky
 * the child sees THEIR drawing, exactly as photographed, living somewhere
 * — which is the whole claim of "Bring It Alive". The sky is procedural
 * (seeded), in the spirit of VihuPlanet's own "behaviour, not
 * illustration" rule, but it integrates with nothing.
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

  function checkerboard(canvas, asset) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let y = 0; y < h; y += 12) for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = ((x / 12 + y / 12) % 2) ? '#3a4157' : '#2b3147';
      ctx.fillRect(x, y, 12, 12);
    }
    const src = assetCanvas(asset);
    const f = fit(src.width, src.height, w - 24, h - 24);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (w - f.w) / 2, (h - f.h) / 2, f.w, f.h);
  }

  function nightSky(canvas, asset) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0f1e'); g.addColorStop(0.6, '#101830'); g.addColorStop(1, '#141b30');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Seeded stars — the same modest sky every time; this is a preview
    // background, not a place, so it earns no randomness of its own.
    let s = 77;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h, r = rnd() * 1.3 + 0.3;
      ctx.fillStyle = 'rgba(231,234,243,' + (0.25 + rnd() * 0.55).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const src = assetCanvas(asset);
    const f = fit(src.width, src.height, w * 0.72, h * 0.72);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (w - f.w) / 2, (h - f.h) / 2, f.w, f.h);
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

  /* Raw mask view: white = in the mask, black = out. */
  function maskView(canvas, seg) {
    const w = seg.width, h = seg.height;
    const small = document.createElement('canvas');
    // Render at reduced size — a 16MP boolean image does not need 16MP.
    const f = fit(w, h, canvas.width, canvas.height);
    small.width = f.w; small.height = f.h;
    const id = small.getContext('2d').createImageData(f.w, f.h);
    for (let y = 0; y < f.h; y++) {
      const sy = Math.min(h - 1, Math.round(y * h / f.h));
      for (let x = 0; x < f.w; x++) {
        const sx = Math.min(w - 1, Math.round(x * w / f.w));
        const v = seg.mask[sy * w + sx] ? 255 : 0;
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

  window.BIAPreview = { checkerboard, nightSky, devCompare, maskView, fit };
})();
