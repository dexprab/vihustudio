// cleanupBrush.js — the Manual Cleanup tool's pixel math.
//
// A pure function over a { data, width, height } pixel buffer, same
// convention as backgroundRemoval.js/edgeSmoothing.js/cropper.js — no
// DOM, no canvas, easy to reason about and unit-test on its own.
//
// This is explicitly an ERASER only: it can only ever reduce a
// pixel's alpha, never raise it back up. There is no restore brush by
// design (see the sprint brief) — Undo is the only way back.

// Erases in a soft-edged circle centred at (cx, cy) — both in the
// pixel buffer's own coordinate space (not screen pixels). Returns
// the bounding box actually touched (clamped to the buffer), or null
// if the circle didn't intersect the buffer at all.
//
// `onBeforeChange(pixelIndex, previousAlpha)` is called exactly once
// per pixel the very first time this call touches it — callers use
// this to build an undo record without needing to pre-snapshot a
// region before knowing how big the stroke will end up being.
export function eraseCircle(pixelBuffer, cx, cy, radius, onBeforeChange) {
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var data = pixelBuffer.data;

  var minX = Math.max(0, Math.floor(cx - radius));
  var maxX = Math.min(width - 1, Math.ceil(cx + radius));
  var minY = Math.max(0, Math.floor(cy - radius));
  var maxY = Math.min(height - 1, Math.ceil(cy + radius));
  if (minX > maxX || minY > maxY) return null;

  // Soft edge: fully erased for the inner 55% of the radius, fading
  // linearly to no change at all by the outer edge.
  var innerRadius = radius * 0.55;
  var falloffRange = Math.max(radius - innerRadius, 0.0001);

  for (var y = minY; y <= maxY; y++) {
    for (var x = minX; x <= maxX; x++) {
      var dx = x + 0.5 - cx;
      var dy = y + 0.5 - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      var falloff = dist <= innerRadius ? 0 : (dist - innerRadius) / falloffRange;
      var pixelIndex = y * width + x;
      var alphaOffset = pixelIndex * 4 + 3;
      var currentAlpha = data[alphaOffset];
      var newAlpha = Math.round(currentAlpha * falloff);

      if (newAlpha < currentAlpha) {
        if (onBeforeChange) onBeforeChange(pixelIndex, currentAlpha);
        data[alphaOffset] = newAlpha;
      }
    }
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
