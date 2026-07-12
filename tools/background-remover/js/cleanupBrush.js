// cleanupBrush.js — the pixel math behind "Remove More" and
// "Bring It Back" (the erase and restore brushes).
//
// A pure function over a { data, width, height } pixel buffer, same
// convention as backgroundRemoval.js/edgeSmoothing.js/cropper.js — no
// DOM, no canvas, easy to reason about and unit-test on its own.
//
// Both brushes only ever touch the alpha channel — RGB is never
// written here, so a kept pixel's colour is always exactly what it
// was decoded from the source file, satisfying this tool's quality
// contract regardless of which direction a stroke moves alpha in.
// Restoring doesn't need to "find" the original colour from anywhere
// else: it was never lost in the first place, since removal (and
// erasing) never touch it either.

// Moves every alpha value in a soft-edged circle toward `targetAlpha`
// — 0 to erase, 255 to restore. Both `eraseCircle`/`restoreCircle`
// below are this with a fixed target, so the two brushes share
// identical falloff/undo-recording behaviour and can never drift
// apart into two subtly different brushes.
//
// `onBeforeChange(pixelIndex, previousAlpha)` is called exactly once
// per pixel the very first time this call touches it — callers use
// this to build an undo record without needing to pre-snapshot a
// region before knowing how big the stroke will end up being.
function paintAlphaCircle(pixelBuffer, cx, cy, radius, targetAlpha, onBeforeChange) {
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var data = pixelBuffer.data;

  var minX = Math.max(0, Math.floor(cx - radius));
  var maxX = Math.min(width - 1, Math.ceil(cx + radius));
  var minY = Math.max(0, Math.floor(cy - radius));
  var maxY = Math.min(height - 1, Math.ceil(cy + radius));
  if (minX > maxX || minY > maxY) return null;

  // Soft edge: full strength for the inner 55% of the radius, fading
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
      // A plain lerp from currentAlpha (at falloff=1, the outer edge)
      // to targetAlpha (at falloff=0, dead centre) — written in this
      // exact order so that at targetAlpha=0 it reduces to
      // `currentAlpha * falloff`, bit-for-bit the same rounding this
      // brush's erase direction always used, not just an
      // algebraically-equivalent reordering (which, in floating point,
      // rounds differently right at .5 boundaries — confirmed by
      // testing before settling on this form).
      var newAlpha = Math.round(currentAlpha * falloff + targetAlpha * (1 - falloff));

      if (newAlpha !== currentAlpha) {
        if (onBeforeChange) onBeforeChange(pixelIndex, currentAlpha);
        data[alphaOffset] = newAlpha;
      }
    }
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// "Remove More" — erases in a soft-edged circle. Can only ever reduce
// a pixel's alpha (never raise it): with targetAlpha 0, strength moves
// every touched pixel purely downward, so this is exactly the erase-
// only brush the quality contract's "erases only" promise describes.
export function eraseCircle(pixelBuffer, cx, cy, radius, onBeforeChange) {
  return paintAlphaCircle(pixelBuffer, cx, cy, radius, 0, onBeforeChange);
}

// "Bring It Back" — the opposite of eraseCircle: restores alpha
// toward fully opaque (255) in a soft-edged circle, undoing whatever
// the automatic removal or a previous erase stroke took away. Never
// touches RGB, so a restored pixel's colour is always exactly the
// original artwork's — there is nothing to "bring back" there, since
// it was never removed.
export function restoreCircle(pixelBuffer, cx, cy, radius, onBeforeChange) {
  return paintAlphaCircle(pixelBuffer, cx, cy, radius, 255, onBeforeChange);
}

// "Trash It" — the destructive half of Trim Picture. Erases every
// pixel inside a rectangle (hard-edged, not soft — the rectangle
// itself, drawn by the child, is already the exact selection, so
// there's no ambiguous boundary to feather the way a circular brush
// has). Never resizes the buffer, unlike Trim Picture's other action,
// "Keep This" (cropPixelBuffer) — this only ever clears alpha within
// the given bounds, so it composes with Remove More/Bring It Back's
// own undo history instead of the crop-specific one: an eraseRect
// call and a paintAlphaCircle call already record undo the same way
// (onBeforeChange per pixel, called once, before the very first time
// that pixel changes), so callers can push either kind of change onto
// one shared history without it needing to know which brush a given
// entry came from.
export function eraseRect(pixelBuffer, rect, onBeforeChange) {
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var data = pixelBuffer.data;

  var minX = Math.max(0, rect.x);
  var minY = Math.max(0, rect.y);
  var maxX = Math.min(width - 1, rect.x + rect.width - 1);
  var maxY = Math.min(height - 1, rect.y + rect.height - 1);
  if (minX > maxX || minY > maxY) return null;

  for (var y = minY; y <= maxY; y++) {
    for (var x = minX; x <= maxX; x++) {
      var pixelIndex = y * width + x;
      var alphaOffset = pixelIndex * 4 + 3;
      var currentAlpha = data[alphaOffset];
      if (currentAlpha !== 0) {
        if (onBeforeChange) onBeforeChange(pixelIndex, currentAlpha);
        data[alphaOffset] = 0;
      }
    }
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
