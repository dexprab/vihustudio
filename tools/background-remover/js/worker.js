// worker.js — runs the full background-removal pipeline off the main
// thread, so a 4000x3000 image never blocks the UI.
//
// This is deliberately the *only* place that wires detector + removal
// strategy + feathering + crop together into one pipeline. app.js
// never touches backgroundRemoval.js or the others directly — it
// only ever posts a pixel buffer in and receives one back. That keeps
// "how removal works" and "how the page stays responsive" as two
// separate concerns, and it's also the exact shape a future Asset
// Normalizer step could call (see README.md).
//
// Loaded as an ES module worker (`new Worker(url, { type: 'module' })`
// in app.js) so it can `import` the other files directly — no bundler
// needed.

import { detectBackground } from './backgroundDetector.js';
import { run as runStrategy } from './backgroundRemoval.js';
import { featherMask, applyAlpha } from './edgeSmoothing.js';
import { findContentBounds, cropPixelBuffer } from './cropper.js';

self.onmessage = function (event) {
  var msg = event.data;
  if (msg.type !== 'process') return;

  var jobId = msg.jobId;
  try {
    var result = processImage(msg.pixelBuffer, msg.options);
    self.postMessage({
      type: 'result',
      jobId: jobId,
      pixelBuffer: result.pixelBuffer,
      meta: result.meta
    }, [result.pixelBuffer.data.buffer]); // transfer, not copy
  } catch (err) {
    self.postMessage({
      type: 'error',
      jobId: jobId,
      message: err && err.message ? err.message : String(err)
    });
  }
};

function processImage(pixelBuffer, options) {
  var startedAt = performance.now();

  var detected = detectBackground(pixelBuffer);
  var backgroundColor = options.backgroundColor || detected.color;
  var tolerance = options.tolerance == null ? detected.tolerance : options.tolerance;

  var mask = runStrategy(options.strategy || 'white-paper', pixelBuffer, {
    backgroundColor: backgroundColor,
    tolerance: tolerance
  });

  var alpha = featherMask(mask, pixelBuffer.width, pixelBuffer.height, options.featherRadius || 0);
  applyAlpha(pixelBuffer, alpha);

  var finalBuffer = pixelBuffer;
  var cropBounds = null;
  if (options.autoCrop) {
    cropBounds = findContentBounds(finalBuffer, 8);
    if (cropBounds) {
      finalBuffer = cropPixelBuffer(finalBuffer, cropBounds);
    }
  }

  return {
    pixelBuffer: finalBuffer,
    meta: {
      backgroundColor: backgroundColor,
      tolerance: tolerance,
      autoDetected: options.backgroundColor == null,
      cropBounds: cropBounds,
      processingMs: Math.round(performance.now() - startedAt)
    }
  };
}
