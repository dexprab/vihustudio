// extractor.js — flat-lay sheet segmentation & extraction.
//
// Given an image where distinct objects sit on a roughly uniform
// background (a moodboard, sprite sheet, scanned collage, or photographed
// sheet of stickers), this finds each visually separate object via
// connected-component labeling on a background/foreground mask, crops it
// with padding, and produces a real per-pixel alpha cutout — no
// illustration, no guessing: every output pixel is copied directly from
// the source image.
//
// Limitations, stated plainly: this is intensity/color-distance
// segmentation, not semantic object detection. It works well when objects
// sit on a clean, mostly-uniform background with visible gaps between
// them. It will NOT correctly separate two objects that visually
// touch/overlap with no gap (they'll come out as one merged component),
// and it will struggle on a busy photographic background. For those cases
// a different technique (e.g. ML-based instance segmentation) would be
// needed — out of scope here. See README.md for the full, verified
// account of what this was tested against.
//
// Output PNGs are written via PngEncoder.encode() directly from the raw
// pixel buffer — never canvas.toDataURL()/toBlob() — see js/pngEncoder.js's
// own header for why: this tool deliberately gives boundary pixels a
// soft, partial alpha (an anti-aliased cutout edge, not a hard jagged
// one), exactly the class of pixel a canvas round-trip's premultiplied-
// alpha storage can silently corrupt.

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

// Separable box dilation — O(w*h*radius) instead of O(w*h*radius^2). Used
// to bridge tiny anti-aliasing/compression-noise gaps before labeling,
// without inflating the actual crop boxes (those are computed from the
// original, non-dilated mask — see computeTightBoxes below).
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

// extractSheet(imgSrc, opts) -> Promise<{
//   sourceWidth, sourceHeight, background, threshold,
//   componentCountBeforeFilter,
//   items: [{ index, pixelCount, bboxOriginal, bboxPadded, blob, objectUrl,
//            pixelBuffer }]
//     pixelBuffer: { data, width, height } -- the exact raw RGBA bytes `blob`
//     was encoded from, kept alive so PngCompressor can re-encode this same
//     item at any color-count level later without ever re-running
//     segmentation.
// }>
//
// imgSrc: a URL/object URL/data URI the browser's Image element can load.
function extractSheet(imgSrc, opts) {
  opts = opts || {};
  var threshold = opts.threshold != null ? opts.threshold : 24;
  var padFrac = opts.padFrac != null ? opts.padFrac : 0.08;
  var minAreaFrac = opts.minAreaFrac != null ? opts.minAreaFrac : 0.00015; // ~0.015% of image area
  var dilateRadius = opts.dilateRadius != null ? opts.dilateRadius : 2;
  var bgOverride = opts.bg || null; // [r,g,b] if the caller wants to force it

  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onerror = function () { reject(new Error('Could not load image: ' + imgSrc)); };
    img.onload = function () {
      try {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error('Image has no size (0x0).')); return; }

        var src = document.createElement('canvas');
        src.width = w; src.height = h;
        var sctx = src.getContext('2d');
        sctx.drawImage(img, 0, 0);
        var srcData = sctx.getImageData(0, 0, w, h);
        var data = srcData.data;

        var bg = bgOverride || sampleBackground(data, w, h, Math.max(4, Math.round(Math.min(w, h) * 0.02)));
        var mask = buildMask(data, w, h, bg, threshold);
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

        var itemPromises = comps.map(function (c, idx) {
          var tb = tightBoxes[c.id];
          var bw = tb.maxX - tb.minX + 1, bh = tb.maxY - tb.minY + 1;
          var padX = Math.round(bw * padFrac), padY = Math.round(bh * padFrac);
          var x0 = Math.max(0, tb.minX - padX), y0 = Math.max(0, tb.minY - padY);
          var x1 = Math.min(w - 1, tb.maxX + padX), y1 = Math.min(h - 1, tb.maxY + padY);
          var ow = x1 - x0 + 1, oh = y1 - y0 + 1;

          // Built directly, no <canvas> involved at any point — the whole
          // point of using PngEncoder for output.
          var od = new Uint8ClampedArray(ow * oh * 4);

          for (var yy = 0; yy < oh; yy++) {
            for (var xx = 0; xx < ow; xx++) {
              var sx = x0 + xx, sy = y0 + yy;
              var sp = sy * w + sx;
              var si = sp * 4;
              var di = (yy * ow + xx) * 4;
              if (lab.labels[sp] === c.id) {
                od[di] = data[si]; od[di + 1] = data[si + 1]; od[di + 2] = data[si + 2];
                var srcAlpha = data[si + 3];
                if (isBoundary(lab.labels, w, h, sx, sy, c.id)) {
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

        Promise.all(itemPromises).then(function (items) {
          resolve({
            sourceWidth: w, sourceHeight: h,
            background: bg,
            threshold: threshold,
            componentCountBeforeFilter: lab.comps.length,
            items: items
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
