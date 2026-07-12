// analysisView.js — renders the Overlay and Difference inspection
// views onto a plain <canvas>. Pure presentation: reads two pixel
// buffers, draws pixels, has no opinion about tools, state, or UI.
//
// Both views compare `working` (the current result — automatic
// removal plus any manual cleanup/crop) against the region of
// `original` it came from, using `offsetX`/`offsetY` (working's
// top-left corner in original's coordinate space) so the comparison
// stays correctly aligned after a crop shifts working's origin.

// Overlay: the untouched original underneath, the current working
// result composited on top at partial opacity — lets a person see
// through the cutout to check the removed edge lines up with the
// artwork's real boundary, and spot any leftover paper fragments as
// faint mismatched patches against the original beneath them.
export function drawOverlay(canvas, original, working, offsetX, offsetY) {
  canvas.width = original.width;
  canvas.height = original.height;
  var ctx = canvas.getContext('2d');

  var base = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
  ctx.putImageData(base, 0, 0);

  var overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = working.width;
  overlayCanvas.height = working.height;
  overlayCanvas.getContext('2d').putImageData(
    new ImageData(new Uint8ClampedArray(working.data), working.width, working.height), 0, 0
  );

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.drawImage(overlayCanvas, offsetX, offsetY);
  ctx.restore();
}

// Difference: for every pixel working currently covers, shows how far
// its RGB has drifted from the corresponding original pixel — bright
// red where anything changed, black where it's untouched. Per this
// tool's quality contract (only alpha may ever change), a correctly
// behaving pipeline should render this view as flat black everywhere;
// any visible red is a genuine, real change to the artwork's colour
// and is exactly what this view exists to catch.
export function drawDifference(canvas, original, working, offsetX, offsetY) {
  canvas.width = working.width;
  canvas.height = working.height;
  var ctx = canvas.getContext('2d');

  var out = new Uint8ClampedArray(working.width * working.height * 4);
  var wData = working.data;
  var oData = original.data;
  var oWidth = original.width;
  var oHeight = original.height;
  var AMPLIFY = 8; // small drifts are otherwise nearly invisible at 1x

  for (var y = 0; y < working.height; y++) {
    var srcY = y + offsetY;
    for (var x = 0; x < working.width; x++) {
      var srcX = x + offsetX;
      var dstIdx = (y * working.width + x) * 4;

      if (srcX < 0 || srcY < 0 || srcX >= oWidth || srcY >= oHeight) {
        // Outside the original's own bounds entirely (shouldn't
        // normally happen — working is always a sub-region of
        // original — but fail safe rather than read garbage).
        out[dstIdx] = out[dstIdx + 1] = out[dstIdx + 2] = 0;
        out[dstIdx + 3] = 255;
        continue;
      }

      var wIdx = (y * working.width + x) * 4;
      var oIdx = (srcY * oWidth + srcX) * 4;
      var dr = Math.abs(wData[wIdx] - oData[oIdx]);
      var dg = Math.abs(wData[wIdx + 1] - oData[oIdx + 1]);
      var db = Math.abs(wData[wIdx + 2] - oData[oIdx + 2]);
      var diff = Math.min(255, Math.max(dr, dg, db) * AMPLIFY);

      out[dstIdx] = diff;     // red channel carries the signal
      out[dstIdx + 1] = 0;
      out[dstIdx + 2] = 0;
      out[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(out, working.width, working.height), 0, 0);
}
