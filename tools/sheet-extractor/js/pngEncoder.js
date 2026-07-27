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
// Public API: PngEncoder.encode({data, width, height}) -> Promise<Blob>
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

  // Every scanline gets a leading filter-type byte. Filter 0 ("None") is
  // always valid and never touches pixel values — correctness matters far
  // more here than the extra few percent a real filter heuristic would
  // save on file size.
  function buildRawScanlines(pixelBuffer) {
    var width = pixelBuffer.width;
    var height = pixelBuffer.height;
    var data = pixelBuffer.data;
    var rowBytes = width * 4;
    var raw = new Uint8Array((rowBytes + 1) * height);
    var offset = 0;
    for (var y = 0; y < height; y++) {
      raw[offset++] = 0; // filter type: None
      raw.set(data.subarray(y * rowBytes, y * rowBytes + rowBytes), offset);
      offset += rowBytes;
    }
    return raw;
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

    var rawScanlines = buildRawScanlines(pixelBuffer);
    var idatData = await deflateZlib(rawScanlines);

    var file = concatBytes([
      PNG_SIGNATURE,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', idatData),
      makeChunk('IEND', new Uint8Array(0))
    ]);

    return new Blob([file], { type: 'image/png' });
  }

  var api = { encode: encode };
  try { window.PngEncoder = api; } catch (e) {}
  return api;
})();
