// pngEncoder.js — encodes a raw { data, width, height } RGBA pixel buffer
// straight to PNG bytes, with no <canvas> involved.
//
// Adapted from tools/background-remover/js/pngEncoder.js (same algorithm,
// verified there and re-verified independently here — see
// test_premultiply.js in this tool's own history for the confirming
// measurement) — rewritten as a plain window-attached IIFE instead of an
// ES module, matching this repo's own established convention for a
// dependency-free utility script (js/zipWriter.js is the same shape),
// rather than requiring a <script type="module"> or a bundler.
//
// Why this exists: canvas.toDataURL('image/png')/toBlob() (and
// getImageData(), for that matter) read from the canvas's own internal
// bitmap storage, which browsers commonly keep premultiplied by alpha for
// compositing performance. Converting that back to straight RGBA divides
// each channel by its own pixel's alpha — undefined at alpha=0, lossy at
// low alpha — so a canvas round-trip can silently rewrite the RGB of every
// partially-transparent pixel. Confirmed directly for this tool (not just
// assumed from precedent): writing known RGBA values via putImageData and
// reading them straight back via getImageData on the SAME canvas — no
// export involved at all — already showed real corruption at low/partial
// alpha (e.g. a genuine (42,157,143,40) pixel came back (45,159,140,40);
// (42,157,143,1) came back (0,255,255,1)), confirming the corruption is
// baked into the canvas's own backing store, not merely an export-step
// artifact. This tool's own segmentation deliberately gives boundary
// pixels a soft, partial alpha (an anti-aliased cutout edge rather than a
// hard jagged one) — exactly the class of pixel this bug can corrupt — so
// bypassing canvas for the final write matters here, not just in theory.
//
// Uses the native CompressionStream('deflate') API for the IDAT payload —
// that format is zlib-wrapped DEFLATE per the Compression Streams spec,
// exactly what a PNG IDAT chunk requires, so no deflate implementation or
// external dependency is needed either.
//
// Public API:
//   PngEncoder.encode({data, width, height}) -> Promise<Blob>
//     Lossless 8-bit RGBA PNG (color type 6).
//   PngEncoder.encodeIndexed({indices, width, height, palette}) -> Promise<Blob>
//     A palette (color type 3) PNG for the Compressor's quantized output —
//     `indices` is one byte per pixel (0..palette.length-1), `palette` is
//     an array of [r,g,b,a] tuples. A tRNS chunk carrying per-index alpha
//     is written whenever any palette entry isn't fully opaque, so
//     transparency survives exactly like the RGBA path — this still never
//     touches <canvas>, matching this module's own header discipline.
const PngEncoder = (function(){
  var CRC_TABLE = buildCrcTable();

  function buildCrcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u32(value) {
    return new Uint8Array([
      (value >>> 24) & 0xFF,
      (value >>> 16) & 0xFF,
      (value >>> 8) & 0xFF,
      value & 0xFF
    ]);
  }

  function concatBytes(arrays) {
    var total = 0;
    for (var i = 0; i < arrays.length; i++) total += arrays[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < arrays.length; j++) {
      out.set(arrays[j], offset);
      offset += arrays[j].length;
    }
    return out;
  }

  // length(4) + type(4) + data + crc32-of(type+data)(4)
  function makeChunk(type, data) {
    var typeBytes = new Uint8Array(type.length);
    for (var i = 0; i < type.length; i++) typeBytes[i] = type.charCodeAt(i);
    var typeAndData = concatBytes([typeBytes, data]);
    return concatBytes([u32(data.length), typeAndData, u32(crc32(typeAndData))]);
  }

  function paethPredictor(a, b, c) {
    var p = a + b - c;
    var pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  // Every scanline gets a leading filter-type byte, one of the 5 standard
  // PNG filters (None/Sub/Up/Average/Paeth). For each row this tries all
  // 5, scores each by the sum of absolute (signed-byte) differences --
  // the same "minimum sum of absolute differences" heuristic libpng's own
  // default encoder uses -- and keeps whichever compresses best. This is
  // purely a smaller-file-size improvement: every filter type is fully
  // invertible, so the pixel bytes this reconstructs to on decode are
  // byte-for-byte identical no matter which filter was picked; only the
  // representation handed to DEFLATE changes. bytesPerPixel is 4 for the
  // RGBA path (encode) and 1 for the indexed path (encodeIndexed).
  function filterScanlines(rowData, width, height, bytesPerPixel) {
    var stride = width * bytesPerPixel;
    var out = new Uint8Array((stride + 1) * height);
    var prior = new Uint8Array(stride); // all zero -- the spec's "row above the first row"
    var candidates = [
      new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride),
      new Uint8Array(stride), new Uint8Array(stride)
    ];
    var offset = 0;
    for (var y = 0; y < height; y++) {
      var raw = rowData.subarray(y * stride, y * stride + stride);
      var bestType = 0, bestScore = Infinity, bestRow = candidates[0];
      for (var t = 0; t < 5; t++) {
        var cand = candidates[t];
        var score = 0;
        for (var x = 0; x < stride; x++) {
          var a = x >= bytesPerPixel ? raw[x - bytesPerPixel] : 0;
          var b = prior[x];
          var c = x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0;
          var v;
          if (t === 0) v = raw[x];
          else if (t === 1) v = (raw[x] - a) & 0xFF;
          else if (t === 2) v = (raw[x] - b) & 0xFF;
          else if (t === 3) v = (raw[x] - ((a + b) >> 1)) & 0xFF;
          else v = (raw[x] - paethPredictor(a, b, c)) & 0xFF;
          cand[x] = v;
          score += v > 127 ? 256 - v : v;
        }
        if (score < bestScore) { bestScore = score; bestType = t; bestRow = cand; }
      }
      out[offset++] = bestType;
      out.set(bestRow, offset);
      offset += stride;
      prior = raw;
    }
    return out;
  }

  async function deflateZlib(bytes) {
    var stream = new CompressionStream('deflate');
    var writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    var chunks = [];
    var reader = stream.readable.getReader();
    for (;;) {
      var next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
    }
    return concatBytes(chunks);
  }

  var PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // pixelBuffer: { data: Uint8ClampedArray|Uint8Array (RGBA), width, height }
  // Returns a Promise<Blob> of a lossless 8-bit RGBA PNG — every byte of
  // `data` ends up in the file exactly as given, no resampling, no
  // recompression, no canvas involved at any point.
  async function encode(pixelBuffer) {
    var width = pixelBuffer.width;
    var height = pixelBuffer.height;

    var ihdr = concatBytes([
      u32(width),
      u32(height),
      new Uint8Array([8, 6, 0, 0, 0]) // bit depth 8, color type 6 (RGBA), default compression/filter/interlace
    ]);

    var rawScanlines = filterScanlines(pixelBuffer.data, width, height, 4);
    var idatData = await deflateZlib(rawScanlines);

    var file = concatBytes([
      PNG_SIGNATURE,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', idatData),
      makeChunk('IEND', new Uint8Array(0))
    ]);

    return new Blob([file], { type: 'image/png' });
  }

  // pixelBuffer: { indices: Uint8Array (one byte per pixel, values
  // 0..palette.length-1), width, height, palette: [[r,g,b,a], ...] } --
  // the Compressor's quantized output. A palette (color type 3) PNG is
  // typically far smaller than the RGBA path for illustration-style
  // content with a bounded number of distinct colors, since each pixel
  // costs 1 byte instead of 4 even before DEFLATE. A tRNS chunk carrying
  // per-index alpha is written whenever any palette entry isn't fully
  // opaque (255) -- omitted entirely when every entry is opaque, since an
  // absent tRNS already means "fully opaque" per the PNG spec.
  async function encodeIndexed(pixelBuffer) {
    var width = pixelBuffer.width;
    var height = pixelBuffer.height;
    var palette = pixelBuffer.palette;

    var ihdr = concatBytes([
      u32(width),
      u32(height),
      new Uint8Array([8, 3, 0, 0, 0]) // bit depth 8, color type 3 (indexed)
    ]);

    var plte = new Uint8Array(palette.length * 3);
    var needsTrns = false;
    for (var i = 0; i < palette.length; i++) {
      plte[i * 3] = palette[i][0];
      plte[i * 3 + 1] = palette[i][1];
      plte[i * 3 + 2] = palette[i][2];
      if (palette[i][3] !== 255) needsTrns = true;
    }

    var chunks = [PNG_SIGNATURE, makeChunk('IHDR', ihdr), makeChunk('PLTE', plte)];
    if (needsTrns) {
      var trns = new Uint8Array(palette.length);
      for (var j = 0; j < palette.length; j++) trns[j] = palette[j][3];
      chunks.push(makeChunk('tRNS', trns));
    }

    var rawScanlines = filterScanlines(pixelBuffer.indices, width, height, 1);
    var idatData = await deflateZlib(rawScanlines);
    chunks.push(makeChunk('IDAT', idatData));
    chunks.push(makeChunk('IEND', new Uint8Array(0)));

    return new Blob([concatBytes(chunks)], { type: 'image/png' });
  }

  var api = { encode: encode, encodeIndexed: encodeIndexed };
  try { window.PngEncoder = api; } catch (e) {}
  return api;
})();
