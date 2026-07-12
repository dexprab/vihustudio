// edgeSmoothing.js — turns a hard background/foreground mask into a
// softly feathered alpha channel.
//
// The mask from backgroundRemoval.js is binary (0 or 1 per pixel).
// Compositing that directly produces a jagged, aliased cutout edge.
// This module runs a small separable box blur over the mask's alpha
// values (0/255) to soften just the boundary — a box blur of a
// uniformly-0 or uniformly-255 region is unaffected (every neighbour
// in the window is the same value), so only pixels actually near an
// edge change. That keeps the cost and the visual effect both
// proportional to edge length, not image area, no distance-transform
// or gaussian-kernel math needed.

// Separable box blur with a running-sum sliding window: each pass is
// O(width*height) regardless of radius, since the window sum is
// updated incrementally instead of re-summed per pixel.
//
// `src`/`dst` are always laid out as `count` contiguous lines of
// `length` elements each (the vertical pass pre-transposes into that
// shape below) — so each line starts at `line * length`.
function boxBlur1D(src, dst, length, count, radius) {
  var windowSize = radius * 2 + 1;
  for (var line = 0; line < count; line++) {
    var base = line * length;
    var sum = 0;
    var i;
    // Prime the window centred on index 0 (edge-clamped).
    for (i = -radius; i <= radius; i++) {
      var clamped = i < 0 ? 0 : (i >= length ? length - 1 : i);
      sum += src[base + clamped];
    }
    dst[base] = sum / windowSize;
    for (i = 1; i < length; i++) {
      var addIdx = i + radius;
      var removeIdx = i - radius - 1;
      if (addIdx >= length) addIdx = length - 1;
      if (removeIdx < 0) removeIdx = 0;
      sum += src[base + addIdx] - src[base + removeIdx];
      dst[base + i] = sum / windowSize;
    }
  }
}

// mask: Uint8Array (0/1) from backgroundRemoval.js.
// featherRadius: pixels of softening either side of the boundary —
// 0 disables feathering entirely (hard edge, mask copied through
// as-is) so the "Edge Smoothness" control can go all the way down to
// the old binary behaviour.
export function featherMask(mask, width, height, featherRadius) {
  var pixelCount = width * height;
  var alpha = new Float32Array(pixelCount);
  for (var i = 0; i < pixelCount; i++) {
    alpha[i] = mask[i] ? 0 : 255;
  }

  if (!featherRadius || featherRadius <= 0) {
    var hardAlpha = new Uint8ClampedArray(pixelCount);
    for (var j = 0; j < pixelCount; j++) hardAlpha[j] = alpha[j];
    return hardAlpha;
  }

  var tmp = new Float32Array(pixelCount);
  // Horizontal pass: each of `height` rows is a line of length `width`.
  boxBlur1D(alpha, tmp, width, height, featherRadius);
  // Transpose so columns become contiguous lines of length `height`,
  // then run the same 1D blur again for the vertical pass.
  var verticalSrc = new Float32Array(pixelCount);
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      verticalSrc[x * height + y] = tmp[y * width + x];
    }
  }
  var verticalDst = new Float32Array(pixelCount);
  boxBlur1D(verticalSrc, verticalDst, height, width, featherRadius);

  var result = new Uint8ClampedArray(pixelCount);
  for (var yy = 0; yy < height; yy++) {
    for (var xx = 0; xx < width; xx++) {
      result[yy * width + xx] = verticalDst[xx * height + yy];
    }
  }
  return result;
}

// Writes a feathered alpha buffer into an RGBA pixel buffer's alpha
// channel, leaving R/G/B untouched.
export function applyAlpha(pixelBuffer, alpha) {
  var data = pixelBuffer.data;
  var pixelCount = pixelBuffer.width * pixelBuffer.height;
  for (var i = 0; i < pixelCount; i++) {
    data[i * 4 + 3] = alpha[i];
  }
}
