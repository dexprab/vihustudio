// transform.js — plain pixel-buffer transforms (rotate, flip).
//
// Same discipline as cropper.js: no DOM dependency, no Canvas, no
// Worker coupling. Every function takes a { data, width, height }
// pixel buffer (data = RGBA Uint8ClampedArray) and returns a new one,
// leaving the input untouched so upstream state (original buffer,
// undo snapshots) can be preserved by the caller.
//
// Added Feature 1 Phase 1: Image Studio ships with flip and rotate as
// first-class tools alongside the existing crop / background removal /
// cleanup brush. These transforms MUST run before background removal
// re-runs, otherwise the flood-fill sees the pre-rotation geometry —
// which is why they operate on the workingBuffer (post-removal) rather
// than the originalPixelBuffer. That matches the crop path in
// applyManualCrop() already.

// Rotate 90° clockwise. width/height swap in the output.
export function rotate90(pixelBuffer) {
  var src = pixelBuffer.data;
  var w = pixelBuffer.width;
  var h = pixelBuffer.height;
  var out = new Uint8ClampedArray(w * h * 4);
  // (x, y) in source maps to (h - 1 - y, x) in destination — i.e. the
  // pixel that used to sit at column x, row y now sits at column
  // (h - 1 - y), row x of a (h × w) image.
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var si = (y * w + x) * 4;
      var dx = h - 1 - y;
      var dy = x;
      var di = (dy * h + dx) * 4;
      out[di    ] = src[si    ];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { data: out, width: h, height: w };
}

// Rotate 90° counter-clockwise. Same as three cw rotations, but a
// direct implementation is faster and less rounding.
export function rotate270(pixelBuffer) {
  var src = pixelBuffer.data;
  var w = pixelBuffer.width;
  var h = pixelBuffer.height;
  var out = new Uint8ClampedArray(w * h * 4);
  // (x, y) in source maps to (y, w - 1 - x) in destination of an
  // (h × w) image.
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var si = (y * w + x) * 4;
      var dx = y;
      var dy = w - 1 - x;
      var di = (dy * h + dx) * 4;
      out[di    ] = src[si    ];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { data: out, width: h, height: w };
}

// Flip horizontally (mirror across the vertical axis). Same
// dimensions.
export function flipHorizontal(pixelBuffer) {
  var src = pixelBuffer.data;
  var w = pixelBuffer.width;
  var h = pixelBuffer.height;
  var out = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) {
    var rowSrc = y * w * 4;
    var rowDst = y * w * 4;
    for (var x = 0; x < w; x++) {
      var si = rowSrc + x * 4;
      var di = rowDst + (w - 1 - x) * 4;
      out[di    ] = src[si    ];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { data: out, width: w, height: h };
}

// Flip vertically (mirror across the horizontal axis). Same
// dimensions. A single memcpy per row via subarray, no per-pixel work.
export function flipVertical(pixelBuffer) {
  var src = pixelBuffer.data;
  var w = pixelBuffer.width;
  var h = pixelBuffer.height;
  var rowBytes = w * 4;
  var out = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) {
    var srcRow = y * rowBytes;
    var dstRow = (h - 1 - y) * rowBytes;
    out.set(src.subarray(srcRow, srcRow + rowBytes), dstRow);
  }
  return { data: out, width: w, height: h };
}
