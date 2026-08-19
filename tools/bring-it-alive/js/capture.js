/* CAPTURE — one decode, one truth.
 *
 * Everything downstream — segmentation decisions, the refine preview, the
 * exported asset and the byte-identity check — reads from the single
 * ImageData produced here. That is not a convenience: a JPEG has no
 * canonical RGB until it is decoded, so if two parts of the pipeline
 * decoded the photograph independently they could legitimately disagree
 * by a bit and the preservation guarantee would be unfalsifiable. One
 * getImageData call defines "the source pixels" for the whole tool.
 *
 * DESKEW (v0.2): the page IS detected and MEASURED — and correction is a
 * disclosed no-op. The sprint allows exactly this ("a no-op with the
 * reason logged to the developer strip is acceptable — do not
 * over-engineer; disclose"), and the reasons are real rather than lazy:
 *
 *   1. A projective warp assumes the page is a PLANE. A notebook page on
 *      fabric is not — it curls, and a homography fitted to its corners
 *      "corrects" the corners while smearing everything between them.
 *   2. Any sub-90° resample replaces EVERY pixel with an interpolation of
 *      its neighbours. The whole of this sprint's verification pins the
 *      extracted pixels byte-identical to the photograph; a warped working
 *      source would make that guarantee unverifiable against anything the
 *      child actually took.
 *
 * So capture finds the page, measures how far off square it sits, and
 * reports the measurement and the declination in photo.notes, which the
 * app puts in the developer log. When a correction that can be honest
 * about curl exists, the measurement is already here waiting for it.
 * Lighting is handled downstream in segment.js on a throwaway decision
 * copy that is never exported.
 */
(function () {
  'use strict';

  /**
   * capture(image) -> Promise<photo>
   * `image` may be a File/Blob (the child's photograph) or a URL string
   * (the test page). The photo object is the source-of-truth handle the
   * rest of the pipeline passes around.
   */
  async function capture(image) {
    let bitmap, filename;
    if (typeof image === 'string') {
      const res = await fetch(image);
      if (!res.ok) throw new Error('capture: could not fetch ' + image);
      bitmap = await createImageBitmap(await res.blob());
      filename = image.split('/').pop();
    } else {
      // Default EXIF handling ('from-image') on purpose: the pixels the
      // child sees in every photo viewer are the pixels we preserve.
      bitmap = await createImageBitmap(image);
      filename = image.name || 'photograph';
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close && bitmap.close();

    // THE one read. 3472×4624 phone photos make this a 64MB buffer; it is
    // the only full-resolution RGBA copy the tool ever holds.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const deskew = analysePage(imageData);
    return {
      filename: filename,
      width: canvas.width,
      height: canvas.height,
      imageData: imageData,
      canvas: canvas, // kept for cheap scaled drawing; same pixels
      deskew: deskew,
      notes: deskewNotes(deskew)
    };
  }

  /* MARK 1 page analysis — measurement, then a disclosed no-op (see the
   * header for why the warp itself is declined). Downsample luminance to a
   * small grid, split paper from background with Otsu's threshold, flood the
   * largest bright region, take its extreme corners, and measure how far
   * its edges sit from square. Cheap, dependency-free, and honest about
   * when it cannot find a page at all. */
  function analysePage(imageData) {
    const w = imageData.width, h = imageData.height, d = imageData.data;
    const step = Math.max(1, Math.round(Math.max(w, h) / 200));
    const gw = Math.floor(w / step), gh = Math.floor(h / step);
    if (gw < 8 || gh < 8) return { found: false, reason: 'image too small to analyse' };

    const lum = new Uint8Array(gw * gh);
    const hist = new Uint32Array(256);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const p = ((y * step) * w + (x * step)) * 4;
        const L = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
        lum[y * gw + x] = L;
        hist[L]++;
      }
    }

    // Otsu: the threshold that best separates the two luminance classes.
    const total = gw * gh;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 127;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }

    // Largest bright component = the page (if there is one to find).
    const label = new Int32Array(gw * gh);
    const stack = new Int32Array(gw * gh);
    let bestSize = 0, bestLabel = 0, nLabels = 0;
    for (let seed = 0; seed < gw * gh; seed++) {
      if (lum[seed] <= thr || label[seed]) continue;
      const id = ++nLabels;
      let top = 0, size = 0;
      stack[top++] = seed; label[seed] = id;
      while (top > 0) {
        const i = stack[--top]; size++;
        const x = i % gw, y = (i / gw) | 0;
        if (x > 0 && !label[i - 1] && lum[i - 1] > thr) { label[i - 1] = id; stack[top++] = i - 1; }
        if (x < gw - 1 && !label[i + 1] && lum[i + 1] > thr) { label[i + 1] = id; stack[top++] = i + 1; }
        if (y > 0 && !label[i - gw] && lum[i - gw] > thr) { label[i - gw] = id; stack[top++] = i - gw; }
        if (y < gh - 1 && !label[i + gw] && lum[i + gw] > thr) { label[i + gw] = id; stack[top++] = i + gw; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = id; }
    }
    const coverage = bestSize / total;
    if (!bestLabel || coverage < 0.15) {
      return { found: false, coverage,
        reason: 'no page-sized bright region against its background (' +
                Math.round(coverage * 100) + '% coverage)' };
    }

    // Extreme corners of the page region (image coordinates).
    let tl = null, tr = null, bl = null, br = null;
    let vTL = Infinity, vTR = -Infinity, vBL = Infinity, vBR = -Infinity;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (label[y * gw + x] !== bestLabel) continue;
      const s = x + y, dd = x - y;
      if (s < vTL) { vTL = s; tl = [x, y]; }
      if (s > vBR) { vBR = s; br = [x, y]; }
      if (dd > vTR) { vTR = dd; tr = [x, y]; }
      if (dd < vBL) { vBL = dd; bl = [x, y]; }
    }
    const deg = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const top = deg(tl, tr), bottom = deg(bl, br);
    const left = deg(tl, bl) - 90, right = deg(tr, br) - 90;
    const skew = Math.max(Math.abs(top), Math.abs(bottom), Math.abs(left), Math.abs(right));
    const px = (p) => [p[0] * step, p[1] * step];
    return {
      found: true, coverage,
      corners: { tl: px(tl), tr: px(tr), bl: px(bl), br: px(br) },
      edges: { top, bottom, left, right }, skew
    };
  }

  /* Turn the analysis into the developer-strip notes the sprint asked for. */
  function deskewNotes(a) {
    const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
    if (!a.found) {
      return ['deskew: no-op — ' + a.reason + '; the photograph is the source, untouched.'];
    }
    const measured = 'deskew: page found (' + Math.round(a.coverage * 100) +
      '% of frame); edge tilt top ' + f1(a.edges.top) + '° bottom ' + f1(a.edges.bottom) +
      '° left ' + f1(a.edges.left) + '° right ' + f1(a.edges.right) +
      '° — max skew ' + f1(a.skew) + '°.';
    const verdict = a.skew <= 1
      ? 'deskew: no-op — the page already sits square (within 1°); nothing worth resampling.'
      : 'deskew: no-op, disclosed — correction declined: paper curls (a projective warp ' +
        'assumes a flat plane) and any resample replaces every source pixel, which would make ' +
        'byte-preservation unverifiable against the photograph the child took. Measurement kept for a future correction.';
    return [measured, verdict];
  }

  window.BIACapture = { capture, analysePage, deskewNotes };
})();
