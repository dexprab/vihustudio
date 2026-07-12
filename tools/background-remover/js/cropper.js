// cropper.js — finds and applies the bounding box of non-transparent
// pixels, so the exported PNG isn't padded with empty space the
// removal left behind.

// Scans the alpha channel for the smallest rectangle containing every
// pixel above `alphaThreshold`. Returns null if the entire image is
// transparent (nothing to crop to) so callers can fall back to the
// original bounds instead of producing a zero-size image.
export function findContentBounds(pixelBuffer, alphaThreshold) {
  var data = pixelBuffer.data;
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var threshold = alphaThreshold == null ? 8 : alphaThreshold;

  var minX = width, minY = height, maxX = -1, maxY = -1;

  for (var y = 0; y < height; y++) {
    var rowBase = y * width;
    for (var x = 0; x < width; x++) {
      var a = data[(rowBase + x) * 4 + 3];
      if (a > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Copies a sub-rectangle of a { data, width, height } pixel buffer
// into a new, tightly-sized one. Plain pixel-buffer in, plain
// pixel-buffer out — no Canvas dependency, so it works the same on
// the main thread or inside a Worker.
export function cropPixelBuffer(pixelBuffer, bounds) {
  var srcData = pixelBuffer.data;
  var srcWidth = pixelBuffer.width;
  var out = new Uint8ClampedArray(bounds.width * bounds.height * 4);

  for (var row = 0; row < bounds.height; row++) {
    var srcRowStart = ((bounds.y + row) * srcWidth + bounds.x) * 4;
    var dstRowStart = row * bounds.width * 4;
    out.set(srcData.subarray(srcRowStart, srcRowStart + bounds.width * 4), dstRowStart);
  }

  return { data: out, width: bounds.width, height: bounds.height };
}
