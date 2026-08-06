// extractor.js — sheet segmentation & extraction, in two modes.
//
// SHEET MODE (the original) — given an image where distinct objects sit on
// a roughly uniform background (a moodboard, sprite sheet, scanned collage,
// or photographed sheet of stickers), this finds each visually separate
// object via connected-component labeling on a background/foreground mask,
// crops it with padding, and produces a real per-pixel alpha cutout — no
// illustration, no guessing: every output pixel is copied directly from the
// source image.
//
// SCAN MODE (additive, for photographed line art) — the same segmentation
// middle, but with two different ends:
//   * the mask is built by LOCAL contrast rather than distance from one
//     global background colour, because a phone photo of a notebook page
//     has a lighting gradient no single threshold can span; and
//   * each object is re-rendered as SOLID INK at a chosen colour with
//     anti-aliasing generated fresh from the traced shape, rather than
//     keeping the original pixels.
// That second half is the whole point: keeping original pixels is exactly
// what makes a photographed pencil line come out blurred (soft camera
// edges), thin (mid-grey graphite, not black) and — if you push a global
// threshold hard enough to fix that — too black (it starts catching
// shadowed paper, paper tooth and bleed-through as well).
//
// Limitations, stated plainly: both modes are pixel segmentation, not
// semantic object detection. Neither will correctly separate two objects
// that visually touch with no gap (they come out as one merged component).
// Scan mode does NOT dewarp a curved or angled page — it reads local
// contrast, so gentle perspective is tolerated, but the cutouts are of the
// page as photographed. For anything beyond that a different technique
// (e.g. ML-based instance segmentation) would be needed — out of scope.
// See README.md for the full, verified account of what this was tested
// against.
//
// Output PNGs are written via PngEncoder.encode() directly from the raw
// pixel buffer — never canvas.toDataURL()/toBlob() — see js/pngEncoder.js's
// own header for why: both modes deliberately give boundary pixels a soft,
// partial alpha (an anti-aliased cutout edge, not a hard jagged one),
// exactly the class of pixel a canvas round-trip's premultiplied-alpha
// storage can silently corrupt.

function colorDist(r1, g1, b1, r2, g2, b2) {
  var dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleBackground(data, w, h, patch) {
  function avg(x0, y0) {
    var rs = 0, gs = 0, bs = 0, n = 0;
    for (var y = y0; y < y0 + patch && y < h; y++) {
      for (var x = x0; x < x0 + patch && x < w; x++) {
        var i = (y * w + x) * 4;
        if (data[i + 3] < 10) continue; // skip already-transparent pixels
        rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; n++;
      }
    }
    return n ? [rs / n, gs / n, bs / n] : null;
  }
  var corners = [
    avg(0, 0),
    avg(Math.max(0, w - patch), 0),
    avg(0, Math.max(0, h - patch)),
    avg(Math.max(0, w - patch), Math.max(0, h - patch))
  ].filter(Boolean);
  if (!corners.length) return [255, 255, 255];
  var r = 0, g = 0, b = 0;
  corners.forEach(function (c) { r += c[0]; g += c[1]; b += c[2]; });
  return [r / corners.length, g / corners.length, b / corners.length];
}

function buildMask(data, w, h, bg, threshold) {
  var mask = new Uint8Array(w * h);
  for (var p = 0; p < w * h; p++) {
    var i = p * 4;
    if (data[i + 3] < 10) { mask[p] = 0; continue; }
    var d = colorDist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]);
    mask[p] = d > threshold ? 1 : 0;
  }
  return mask;
}

// --- Scan mode: local-contrast ("adaptive") ink detection ---

// Perceptual luminance, as a Float32Array so the box blur below has a
// single channel to average rather than three.
function toGray(data, w, h) {
  var g = new Float32Array(w * h);
  for (var p = 0; p < w * h; p++) {
    var i = p * 4;
    // A fully transparent source pixel has no meaningful colour — treat it
    // as paper so it can never read as ink.
    if (data[i + 3] < 10) { g[p] = 255; continue; }
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

// Separable sliding-window box blur → per-pixel local mean. O(w*h) and
// independent of radius: each row and column keeps one running sum and
// only adds/removes a single value per step, so a 90px radius on a phone
// photo costs the same as a 3px one.
function boxBlur(src, w, h, radius) {
  if (radius <= 0) return src;
  var tmp = new Float32Array(w * h);
  var out = new Float32Array(w * h);
  var x, y, i, add, drop;

  for (y = 0; y < h; y++) {
    var rowOff = y * w;
    var sum = 0, n = 0;
    for (i = 0; i <= radius && i < w; i++) { sum += src[rowOff + i]; n++; }
    for (x = 0; x < w; x++) {
      tmp[rowOff + x] = sum / n;
      add = x + radius + 1; if (add < w) { sum += src[rowOff + add]; n++; }
      drop = x - radius;    if (drop >= 0) { sum -= src[rowOff + drop]; n--; }
    }
  }

  for (x = 0; x < w; x++) {
    var sum2 = 0, n2 = 0;
    for (i = 0; i <= radius && i < h; i++) { sum2 += tmp[i * w + x]; n2++; }
    for (y = 0; y < h; y++) {
      out[y * w + x] = sum2 / n2;
      add = y + radius + 1; if (add < h) { sum2 += tmp[add * w + x]; n2++; }
      drop = y - radius;    if (drop >= 0) { sum2 -= tmp[drop * w + x]; n2--; }
    }
  }
  return out;
}

// A pixel is ink if it is `delta` luminance darker than the paper
// immediately around it. This is what lets one setting span a lighting
// gradient: a stroke in the bright corner and the same stroke in the shaded
// corner are each dark *relative to their own neighbourhood*, even though
// their absolute values are nowhere near each other.
//
// `delta` doubles as the minimum-darkness control. Bleed-through from the
// previous page is genuine contrast — just reliably fainter than real
// graphite — so raising delta drops it while keeping the drawing.
function buildScanMask(data, w, h, delta, blurRadius) {
  var gray = toGray(data, w, h);
  var local = boxBlur(gray, w, h, blurRadius);
  var mask = new Uint8Array(w * h);
  for (var p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 10) { mask[p] = 0; continue; }
    mask[p] = (local[p] - gray[p]) > delta ? 1 : 0;
  }
  return mask;
}

// Separable box dilation — O(w*h*radius) instead of O(w*h*radius^2). Used
// to bridge tiny anti-aliasing/compression-noise gaps before labeling,
// without inflating the actual crop boxes (those are computed from the
// original, non-dilated mask — see computeTightBoxes below). Scan mode
// reuses it a second time, per object, as the "Ink Weight" thickener.
function dilate(mask, w, h, radius) {
  if (radius <= 0) return mask;
  var tmp = new Uint8Array(w * h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var v = 0;
      for (var dx = -radius; dx <= radius; dx++) {
        var xx = x + dx; if (xx < 0 || xx >= w) continue;
        if (mask[y * w + xx]) { v = 1; break; }
      }
      tmp[y * w + x] = v;
    }
  }
  var out = new Uint8Array(w * h);
  for (var x2 = 0; x2 < w; x2++) {
    for (var y2 = 0; y2 < h; y2++) {
      var v2 = 0;
      for (var dy = -radius; dy <= radius; dy++) {
        var yy = y2 + dy; if (yy < 0 || yy >= h) continue;
        if (tmp[yy * w + x2]) { v2 = 1; break; }
      }
      out[y2 * w + x2] = v2;
    }
  }
  return out;
}

// Connected-component labeling via iterative BFS (4-connectivity). Each
// pixel is enqueued at most once across the whole mask, so this is
// O(w*h) total regardless of how many components exist.
function labelComponents(mask, w, h) {
  var labels = new Int32Array(w * h).fill(-1);
  var comps = [];
  var queue = new Int32Array(w * h);
  var nextLabel = 0;
  for (var start = 0; start < w * h; start++) {
    if (mask[start] === 0 || labels[start] !== -1) continue;
    var id = nextLabel++;
    var qHead = 0, qTail = 0;
    queue[qTail++] = start; labels[start] = id;
    var minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
    while (qHead < qTail) {
      var p = queue[qHead++];
      var x = p % w, y = (p / w) | 0;
      count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0) { var n = p - 1; if (mask[n] && labels[n] === -1) { labels[n] = id; queue[qTail++] = n; } }
      if (x < w - 1) { var n2 = p + 1; if (mask[n2] && labels[n2] === -1) { labels[n2] = id; queue[qTail++] = n2; } }
      if (y > 0) { var n3 = p - w; if (mask[n3] && labels[n3] === -1) { labels[n3] = id; queue[qTail++] = n3; } }
      if (y < h - 1) { var n4 = p + w; if (mask[n4] && labels[n4] === -1) { labels[n4] = id; queue[qTail++] = n4; } }
    }
    comps.push({ id: id, minX: minX, minY: minY, maxX: maxX, maxY: maxY, count: count });
  }
  return { labels: labels, comps: comps };
}

// Recompute a tight bounding box per component from the ORIGINAL
// (undilated) mask, grouped by the labels the dilated-mask labeling
// assigned. Dilation exists only to bridge small gaps before grouping
// pixels into components — it must never inflate the reported box, or
// "8% padding" ends up being padding on top of an already-padded box.
// Every true-foreground pixel in the original mask is guaranteed to have
// a real label here, since dilation only ever adds pixels, never removes
// them.
function computeTightBoxes(labels, origMask, w, h, comps) {
  var boxes = {};
  comps.forEach(function (c) { boxes[c.id] = { minX: w, minY: h, maxX: -1, maxY: -1 }; });
  for (var p = 0; p < w * h; p++) {
    if (!origMask[p]) continue;
    var id = labels[p];
    var b = boxes[id];
    if (!b) continue; // filtered out by min-area, or somehow unlabeled
    var x = p % w, y = (p / w) | 0;
    if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
  }
  return boxes;
}

// Is a component-pixel adjacent (4-neighbor) to a non-component pixel?
// Used to give boundary pixels a soft, color-distance-based alpha instead
// of a hard cutout edge.
function isBoundary(labels, w, h, x, y, id) {
  if (x > 0 && labels[y * w + x - 1] !== id) return true;
  if (x < w - 1 && labels[y * w + x + 1] !== id) return true;
  if (y > 0 && labels[(y - 1) * w + x] !== id) return true;
  if (y < h - 1 && labels[(y + 1) * w + x] !== id) return true;
  return false;
}

// Sheet mode's per-object render: copy the real source pixels, softening
// only the outermost ring's alpha so the cutout edge isn't jagged.
function renderSheetObject(ctx) {
  var data = ctx.data, labels = ctx.labels, w = ctx.w, h = ctx.h;
  var id = ctx.id, x0 = ctx.x0, y0 = ctx.y0, ow = ctx.ow, oh = ctx.oh;
  var bg = ctx.bg, threshold = ctx.threshold;
  var od = new Uint8ClampedArray(ow * oh * 4);
  for (var yy = 0; yy < oh; yy++) {
    for (var xx = 0; xx < ow; xx++) {
      var sx = x0 + xx, sy = y0 + yy;
      var sp = sy * w + sx;
      var si = sp * 4;
      var di = (yy * ow + xx) * 4;
      if (labels[sp] === id) {
        od[di] = data[si]; od[di + 1] = data[si + 1]; od[di + 2] = data[si + 2];
        var srcAlpha = data[si + 3];
        if (isBoundary(labels, w, h, sx, sy, id)) {
          // soft edge: blend alpha down based on how close to
          // background this boundary pixel's own color is
          var d = colorDist(data[si], data[si + 1], data[si + 2], bg[0], bg[1], bg[2]);
          var soft = Math.max(0, Math.min(255, Math.round((d / threshold) * 255)));
          od[di + 3] = Math.min(srcAlpha, soft > 200 ? srcAlpha : Math.max(soft, Math.round(srcAlpha * 0.55)));
        } else {
          od[di + 3] = srcAlpha;
        }
      } else {
        od[di] = 0; od[di + 1] = 0; od[di + 2] = 0; od[di + 3] = 0;
      }
    }
  }
  return od;
}

// A radius-1 box blur over a binary coverage map reads 1.0 in the interior,
// 0.667 along a straight edge and 0.333 just outside it. Multiplying by
// this gain keeps the interior fully solid and a straight edge nearly so,
// while still leaving the outermost ring as genuine partial coverage —
// anti-aliasing generated fresh from the traced shape rather than inherited
// from the camera's own soft, uneven edges.
var AA_GAIN = 1.35;

// Scan mode's per-object render: trace the shape, then draw it as solid
// ink. None of the source pixel VALUES survive — only the shape does,
// which is precisely why the result is neither blurred nor thin, and why
// the ink colour is free to be anything.
function renderScanObject(ctx) {
  var labels = ctx.labels, origMask = ctx.origMask, w = ctx.w;
  var id = ctx.id, x0 = ctx.x0, y0 = ctx.y0, ow = ctx.ow, oh = ctx.oh;
  var inkWeight = ctx.inkWeight, ink = ctx.ink;

  // This component's real ink pixels only. `labels` came from the DILATED
  // mask (gap bridging), so intersecting it with the original mask keeps a
  // neighbouring component's ink out while still using the grouping that
  // bridging produced.
  var local = new Uint8Array(ow * oh);
  for (var yy = 0; yy < oh; yy++) {
    for (var xx = 0; xx < ow; xx++) {
      var sp = (y0 + yy) * w + (x0 + xx);
      local[yy * ow + xx] = (labels[sp] === id && origMask[sp]) ? 1 : 0;
    }
  }

  // "Ink Weight": thicken the traced line before rendering. A pencil stroke
  // photographed at an angle is often only a pixel or two of real darkness,
  // which reads as thin and broken once re-rendered as solid ink — this is
  // the direct fix for that.
  if (inkWeight > 0) local = dilate(local, ow, oh, inkWeight);

  var cov = new Float32Array(ow * oh);
  for (var p = 0; p < ow * oh; p++) cov[p] = local[p];
  var soft = boxBlur(cov, ow, oh, 1);

  var od = new Uint8ClampedArray(ow * oh * 4);
  for (var q = 0; q < ow * oh; q++) {
    var a = soft[q] * AA_GAIN;
    if (a <= 0) continue;              // already 0,0,0,0
    if (a > 1) a = 1;
    var di = q * 4;
    od[di] = ink[0]; od[di + 1] = ink[1]; od[di + 2] = ink[2];
    od[di + 3] = Math.round(a * 255);
  }
  return od;
}

// A small black-on-white PNG of the raw ink mask, so the local-contrast
// settings can actually be tuned by eye rather than by guesswork. Sampled
// down by nearest neighbour — this is a diagnostic, not an asset.
function buildMaskPreview(mask, w, h, maxDim) {
  var scale = Math.min(1, maxDim / Math.max(w, h));
  var pw = Math.max(1, Math.round(w * scale));
  var ph = Math.max(1, Math.round(h * scale));
  var od = new Uint8ClampedArray(pw * ph * 4);
  for (var y = 0; y < ph; y++) {
    var sy = Math.min(h - 1, Math.floor(y / scale));
    for (var x = 0; x < pw; x++) {
      var sx = Math.min(w - 1, Math.floor(x / scale));
      var v = mask[sy * w + sx] ? 0 : 255;
      var di = (y * pw + x) * 4;
      od[di] = v; od[di + 1] = v; od[di + 2] = v; od[di + 3] = 255;
    }
  }
  return PngEncoder.encode({ data: od, width: pw, height: ph });
}

// extractSheet(imgSrc, opts) -> Promise<{
//   mode, sourceWidth, sourceHeight, crop, background, threshold,
//   componentCountBeforeFilter, maskPreviewUrl,
//   items: [{ index, pixelCount, bboxOriginal, bboxPadded, blob, objectUrl,
//            pixelBuffer }]
//     pixelBuffer: { data, width, height } -- the exact raw RGBA bytes `blob`
//     was encoded from, kept alive so PngCompressor can re-encode this same
//     item at any color-count level later without ever re-running
//     segmentation.
// }>
//
// Every reported coordinate (bboxOriginal, bboxPadded, sourceWidth/Height)
// is relative to the CROPPED region when `opts.crop` is given — that is
// what the user is looking at, and what the cutouts are actually of.
//
// imgSrc: a URL/object URL/data URI the browser's Image element can load.
//
// opts.mode: 'sheet' (default) | 'scan'
//   shared    — padFrac, minAreaFrac, dilateRadius, crop
//   sheet only — threshold, bg
//   scan only  — inkDelta, inkBlurFrac, inkWeight, inkColor
function extractSheet(imgSrc, opts) {
  opts = opts || {};
  var mode = opts.mode === 'scan' ? 'scan' : 'sheet';
  var threshold = opts.threshold != null ? opts.threshold : 24;
  var padFrac = opts.padFrac != null ? opts.padFrac : 0.08;
  var minAreaFrac = opts.minAreaFrac != null ? opts.minAreaFrac : 0.00015; // ~0.015% of image area
  var dilateRadius = opts.dilateRadius != null ? opts.dilateRadius : 2;
  var bgOverride = opts.bg || null; // [r,g,b] if the caller wants to force it
  var crop = opts.crop || null;     // { x, y, w, h } in source pixels

  var inkDelta = opts.inkDelta != null ? opts.inkDelta : 18;
  var inkBlurFrac = opts.inkBlurFrac != null ? opts.inkBlurFrac : 0.03;
  var inkWeight = opts.inkWeight != null ? opts.inkWeight : 1;
  var inkColor = opts.inkColor || [0, 0, 0];

  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onerror = function () { reject(new Error('Could not load image: ' + imgSrc)); };
    img.onload = function () {
      try {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih) { reject(new Error('Image has no size (0x0).')); return; }

        // Cropping happens here, once, by drawing only the requested
        // region — so every stage downstream is unchanged and simply sees
        // a smaller image.
        var cx = 0, cy = 0, w = iw, h = ih;
        if (crop) {
          cx = Math.max(0, Math.min(iw - 1, Math.round(crop.x)));
          cy = Math.max(0, Math.min(ih - 1, Math.round(crop.y)));
          w = Math.max(1, Math.min(iw - cx, Math.round(crop.w)));
          h = Math.max(1, Math.min(ih - cy, Math.round(crop.h)));
        }

        var src = document.createElement('canvas');
        src.width = w; src.height = h;
        var sctx = src.getContext('2d');
        sctx.drawImage(img, cx, cy, w, h, 0, 0, w, h);
        var srcData = sctx.getImageData(0, 0, w, h);
        var data = srcData.data;

        var bg = null;
        var mask;
        if (mode === 'scan') {
          var blurRadius = Math.max(2, Math.round(Math.min(w, h) * inkBlurFrac));
          mask = buildScanMask(data, w, h, inkDelta, blurRadius);
        } else {
          bg = bgOverride || sampleBackground(data, w, h, Math.max(4, Math.round(Math.min(w, h) * 0.02)));
          mask = buildMask(data, w, h, bg, threshold);
        }

        var maskForLabeling = dilate(mask, w, h, dilateRadius);
        var lab = labelComponents(maskForLabeling, w, h);

        var minArea = Math.max(20, Math.round(w * h * minAreaFrac));
        var comps = lab.comps.filter(function (c) { return c.count >= minArea; });
        var tightBoxes = computeTightBoxes(lab.labels, mask, w, h, comps);

        // Reading order: coarse top-to-bottom bands, then left-to-right.
        var bandHeight = Math.max(30, Math.round(h * 0.06));
        comps.sort(function (a, b) {
          var ay = Math.round(((a.minY + a.maxY) / 2) / bandHeight);
          var by = Math.round(((b.minY + b.maxY) / 2) / bandHeight);
          if (ay !== by) return ay - by;
          return a.minX - b.minX;
        });

        // Scan mode thickens the traced line, so its crop box needs real
        // room even on an object whose own box is only a few pixels tall —
        // a percentage of "3px" is zero. Sheet mode keeps a floor of 0, so
        // its padding arithmetic is unchanged.
        var minPad = mode === 'scan' ? inkWeight + 2 : 0;

        var itemPromises = comps.map(function (c, idx) {
          var tb = tightBoxes[c.id];
          var bw = tb.maxX - tb.minX + 1, bh = tb.maxY - tb.minY + 1;
          var padX = Math.max(minPad, Math.round(bw * padFrac));
          var padY = Math.max(minPad, Math.round(bh * padFrac));
          var x0 = Math.max(0, tb.minX - padX), y0 = Math.max(0, tb.minY - padY);
          var x1 = Math.min(w - 1, tb.maxX + padX), y1 = Math.min(h - 1, tb.maxY + padY);
          var ow = x1 - x0 + 1, oh = y1 - y0 + 1;

          // Built directly, no <canvas> involved at any point — the whole
          // point of using PngEncoder for output.
          var rctx = {
            data: data, labels: lab.labels, origMask: mask,
            w: w, h: h, id: c.id,
            x0: x0, y0: y0, ow: ow, oh: oh,
            bg: bg, threshold: threshold,
            inkWeight: inkWeight, ink: inkColor
          };
          var od = mode === 'scan' ? renderScanObject(rctx) : renderSheetObject(rctx);

          return PngEncoder.encode({ data: od, width: ow, height: oh }).then(function (blob) {
            return {
              index: idx,
              pixelCount: c.count,
              bboxOriginal: { x: tb.minX, y: tb.minY, w: bw, h: bh },
              bboxPadded: { x: x0, y: y0, w: ow, h: oh },
              blob: blob,
              objectUrl: URL.createObjectURL(blob),
              // Kept alive so the Compressor can re-encode at any color
              // level later without ever re-running segmentation -- the
              // exact same raw RGBA bytes `blob` above was built from.
              pixelBuffer: { data: od, width: ow, height: oh }
            };
          });
        });

        var maskPromise = opts.wantMaskPreview
          ? buildMaskPreview(mask, w, h, 900).then(function (b) { return URL.createObjectURL(b); })
          : Promise.resolve(null);

        Promise.all([Promise.all(itemPromises), maskPromise]).then(function (both) {
          resolve({
            mode: mode,
            sourceWidth: w, sourceHeight: h,
            crop: crop ? { x: cx, y: cy, w: w, h: h } : null,
            background: bg,
            threshold: threshold,
            componentCountBeforeFilter: lab.comps.length,
            maskPreviewUrl: both[1],
            items: both[0]
          });
        }, reject);
      } catch (e) {
        reject(e);
      }
    };
    img.src = imgSrc;
  });
}

window.extractSheet = extractSheet;
