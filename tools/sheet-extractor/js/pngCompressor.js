// pngCompressor.js — the "compressor for each extracted image" feature.
//
// Two genuinely different techniques, both entirely dependency-free and
// (per pngEncoder.js's own header) never routed through <canvas>, so
// neither one can reintroduce the premultiplied-alpha corruption this
// tool exists to avoid:
//
//   1. Lossless (level 0) — the same pixels, re-filtered/re-deflated via
//      pngEncoder.js's own per-scanline filter selection. Every existing
//      per-object PNG already benefits from this for free (extractor.js's
//      own PngEncoder.encode() call), so level 0 is simply that same
//      output, shown here as the size baseline every other level is
//      compared against.
//   2. Reduced color count (levels 1+) — a real median-cut color
//      quantizer in RGBA space, writing a palette (indexed, color type 3)
//      PNG instead of full RGBA. Fully-transparent pixels are first
//      canonicalized to one shared (0,0,0,0) bucket (their RGB carries no
//      visual information, so collapsing them avoids wasting palette
//      slots on background noise) -- every other pixel's real RGBA is
//      quantized as given. When an image's own real distinct-color count
//      already fits the requested cap, this is *also* fully lossless (the
//      exact same colors, just re-encoded as a smaller indexed file) --
//      the UI discloses this ("still lossless") rather than implying loss
//      that didn't happen.
//
// A quantized result that ends up LARGER than the lossless baseline (can
// happen on a tiny crop, where PLTE/tRNS overhead outweighs the 4-bytes-
// to-1-byte-per-pixel win) is never used -- compress() falls back to the
// lossless blob instead, mirroring this codebase's own established
// "never make a real download bigger" discipline (AV-009's downscale-or-
// keep-original convention).
//
// Public API:
//   PngCompressor.LEVELS -- ordered level definitions for a slider.
//   PngCompressor.compress(pixelBuffer, levelIndex, originalBlob)
//     -> Promise<{ blob, level, quantized, exact, colorCount, fellBack }>
//     pixelBuffer: { data: Uint8ClampedArray (RGBA), width, height }
//     originalBlob: the already-computed lossless PNG Blob for this same
//       pixelBuffer (extractor.js's item.blob) -- passed in so level>0
//       never has to re-encode the lossless path just for comparison.
const PngCompressor = (function () {
  var LEVELS = [
    { key: 'lossless', label: 'Lossless (optimized)', maxColors: null },
    { key: '256', label: 'Great quality — up to 256 colors', maxColors: 256 },
    { key: '128', label: 'Good — up to 128 colors', maxColors: 128 },
    { key: '64', label: 'Balanced — up to 64 colors', maxColors: 64 },
    { key: '32', label: 'Small — up to 32 colors', maxColors: 32 },
    { key: '16', label: 'Smaller — up to 16 colors', maxColors: 16 },
    { key: '8', label: 'Smallest — up to 8 colors', maxColors: 8 }
  ];

  function clampLevel(i) {
    i = i | 0;
    if (i < 0) return 0;
    if (i > LEVELS.length - 1) return LEVELS.length - 1;
    return i;
  }

  function colorKey(r, g, b, a) {
    return (r) | (g << 8) | (b << 16) | (a << 24);
  }

  // Builds the color histogram over every pixel, canonicalizing fully-
  // transparent pixels to (0,0,0,0) first (see header). Returns an array
  // of {r,g,b,a,count} -- the set of genuinely distinct colors present.
  function buildHistogram(pixelBuffer) {
    var data = pixelBuffer.data;
    var n = pixelBuffer.width * pixelBuffer.height;
    var map = new Map();
    for (var p = 0; p < n; p++) {
      var i = p * 4;
      var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a === 0) { r = 0; g = 0; b = 0; }
      var key = colorKey(r, g, b, a);
      var entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, { r: r, g: g, b: b, a: a, count: 1 });
    }
    var colors = [];
    map.forEach(function (c) { colors.push(c); });
    return colors;
  }

  function channelRange(box, ch) {
    var min = 255, max = 0;
    for (var i = 0; i < box.length; i++) {
      var v = box[i][ch];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return max - min;
  }

  function widestChannel(box) {
    var widest = 'r', widestRange = -1;
    ['r', 'g', 'b', 'a'].forEach(function (ch) {
      var range = channelRange(box, ch);
      if (range > widestRange) { widestRange = range; widest = ch; }
    });
    return widest;
  }

  function splitBox(box) {
    var ch = widestChannel(box);
    var sorted = box.slice().sort(function (x, y) { return x[ch] - y[ch]; });
    var total = 0;
    sorted.forEach(function (c) { total += c.count; });
    var half = total / 2, running = 0, splitAt = Math.floor(sorted.length / 2);
    for (var i = 0; i < sorted.length; i++) {
      running += sorted[i].count;
      if (running >= half) { splitAt = i + 1; break; }
    }
    if (splitAt <= 0) splitAt = 1;
    if (splitAt >= sorted.length) splitAt = sorted.length - 1;
    return [sorted.slice(0, splitAt), sorted.slice(splitAt)];
  }

  function averageBox(box) {
    var rs = 0, gs = 0, bs = 0, as = 0, total = 0;
    for (var i = 0; i < box.length; i++) {
      var c = box[i];
      rs += c.r * c.count; gs += c.g * c.count; bs += c.b * c.count; as += c.a * c.count;
      total += c.count;
    }
    if (total === 0) total = 1;
    return [Math.round(rs / total), Math.round(gs / total), Math.round(bs / total), Math.round(as / total)];
  }

  // Standard median-cut: repeatedly split the box with the widest channel
  // range along that channel's own weighted median, until `maxColors`
  // boxes exist (or no box can be split further). Every real color object
  // is unique (built from a Map), so any box with length >= 2 is
  // guaranteed to have a non-zero range on at least one channel --
  // splitting always makes progress, so this always terminates.
  function medianCut(colors, maxColors) {
    var boxes = [colors.slice()];
    while (boxes.length < maxColors) {
      var idx = -1, bestScore = -1;
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        var total = 0;
        boxes[i].forEach(function (c) { total += c.count; });
        var range = 0;
        ['r', 'g', 'b', 'a'].forEach(function (ch) {
          var r = channelRange(boxes[i], ch);
          if (r > range) range = r;
        });
        var score = range * Math.max(1, total);
        if (score > bestScore) { bestScore = score; idx = i; }
      }
      if (idx === -1) break;
      var parts = splitBox(boxes[idx]);
      boxes.splice(idx, 1, parts[0], parts[1]);
    }
    return boxes.map(averageBox);
  }

  // Returns { indices: Uint8Array (one byte per pixel), palette: [[r,g,b,a],...], exact: boolean }.
  // exact === true means the real distinct-color count already fit
  // maxColors, so this is a lossless re-encode, not a quality reduction.
  function quantizeToPalette(pixelBuffer, maxColors) {
    var colors = buildHistogram(pixelBuffer);
    var exact = colors.length <= maxColors;
    var palette = exact ? colors.map(function (c) { return [c.r, c.g, c.b, c.a]; }) : medianCut(colors, maxColors);

    var data = pixelBuffer.data;
    var n = pixelBuffer.width * pixelBuffer.height;
    var indices = new Uint8Array(n);
    var cache = new Map();

    for (var p = 0; p < n; p++) {
      var i = p * 4;
      var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a === 0) { r = 0; g = 0; b = 0; }
      var key = colorKey(r, g, b, a);
      var idx = cache.get(key);
      if (idx === undefined) {
        idx = 0;
        var bestDist = Infinity;
        for (var pi = 0; pi < palette.length; pi++) {
          var pc = palette[pi];
          var dr = r - pc[0], dg = g - pc[1], db = b - pc[2], da = a - pc[3];
          // Weight alpha more heavily so a partially-transparent boundary
          // pixel isn't crushed toward a fully-opaque/-transparent entry.
          var d = dr * dr + dg * dg + db * db + da * da * 4;
          if (d < bestDist) { bestDist = d; idx = pi; }
        }
        cache.set(key, idx);
      }
      indices[p] = idx;
    }

    return { indices: indices, palette: palette, exact: exact };
  }

  // compress(pixelBuffer, levelIndex, originalBlob) -> Promise<result>
  async function compress(pixelBuffer, levelIndex, originalBlob) {
    var level = LEVELS[clampLevel(levelIndex)];
    if (!level.maxColors) {
      return { blob: originalBlob, level: level, quantized: false, exact: true, colorCount: null, fellBack: false };
    }
    var q = quantizeToPalette(pixelBuffer, level.maxColors);
    var indexedBlob = await PngEncoder.encodeIndexed({
      width: pixelBuffer.width, height: pixelBuffer.height,
      indices: q.indices, palette: q.palette
    });
    if (indexedBlob.size >= originalBlob.size) {
      return { blob: originalBlob, level: level, quantized: false, exact: q.exact, colorCount: q.palette.length, fellBack: true };
    }
    return { blob: indexedBlob, level: level, quantized: !q.exact, exact: q.exact, colorCount: q.palette.length, fellBack: false };
  }

  var api = { LEVELS: LEVELS, compress: compress };
  try { window.PngCompressor = api; } catch (e) {}
  return api;
})();
