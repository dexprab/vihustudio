// backgroundRemoval.js — background removal strategies.
//
// Every strategy implements the same contract:
//
//   process(pixelBuffer, options) -> Uint8Array mask
//
// pixelBuffer is a plain { data, width, height } object where `data`
// is a Uint8ClampedArray in RGBA order (the same shape as
// ImageData — deliberately not ImageData itself, so this file has no
// DOM dependency and runs unchanged inside a Worker).
//
// The returned mask is one byte per pixel: 1 means "this pixel is
// background and should become transparent", 0 means "keep it".
// Callers (edgeSmoothing.js, the pipeline in worker.js) turn that
// mask into an alpha channel — this module only ever decides
// background vs. foreground, never touches alpha/feathering/crop
// itself, so each concern stays independently testable.
//
// Callers (app.js, worker.js) never reference WhitePaperStrategy or
// any other strategy by name beyond a string id — see run() at the
// bottom. That's what lets a future UniformColourStrategy,
// AISegmentationStrategy, or ManualRefinementStrategy be added
// without the UI changing at all.

import { colorDistanceSquared } from './utils.js';

// ---- WhitePaperStrategy --------------------------------------------
//
// Multi-source flood fill seeded from every border pixel whose colour
// is within `tolerance` of the detected background colour. Only
// pixels *connected* to the border through other background-coloured
// pixels are ever marked — a white region fully enclosed by ink
// (the hole in a letter "O", an eye, a highlight) is never reached by
// the fill and stays opaque, because reaching it would require
// passing through a non-background pixel first. This is the one
// property that matters most for this strategy: it operates on
// connectivity, not on a global "is this pixel white" test.
function whitePaperProcess(pixelBuffer, options) {
  var data = pixelBuffer.data;
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var bg = options.backgroundColor;
  var toleranceSq = options.tolerance * options.tolerance;
  var pixelCount = width * height;

  var mask = new Uint8Array(pixelCount);    // 1 = background (to remove)
  var visited = new Uint8Array(pixelCount);
  // Every pixel enters the queue at most once (guarded by `visited`),
  // so a flat pixelCount-sized typed array is always large enough —
  // no reallocation, no push()/shift() overhead on multi-megapixel
  // images.
  var queue = new Int32Array(pixelCount);
  var qHead = 0;
  var qTail = 0;

  function matchesBackground(idx) {
    var o = idx * 4;
    return colorDistanceSquared(
      data[o], data[o + 1], data[o + 2],
      bg.r, bg.g, bg.b
    ) <= toleranceSq;
  }

  function visit(idx) {
    if (visited[idx]) return;
    visited[idx] = 1;
    if (matchesBackground(idx)) {
      mask[idx] = 1;
      queue[qTail++] = idx;
    }
  }

  // Seed from the full border — this is what makes the fill "start
  // from the edges" per the spec, and why artwork touching the frame
  // on one side doesn't block removal on the other three: each
  // border pixel is seeded independently.
  var lastRow = (height - 1) * width;
  for (var x = 0; x < width; x++) {
    visit(x);
    visit(lastRow + x);
  }
  for (var y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + (width - 1));
  }

  // Iterative 4-connected BFS. Iterative (not recursive) on purpose —
  // a recursive flood fill blows the call stack well before it
  // reaches a 4000x3000 image's worth of connected background.
  while (qHead < qTail) {
    var idx = queue[qHead++];
    var px = idx % width;
    var py = (idx - px) / width;

    if (px > 0) visit(idx - 1);
    if (px < width - 1) visit(idx + 1);
    if (py > 0) visit(idx - width);
    if (py < height - 1) visit(idx + width);
  }

  return mask;
}

var WhitePaperStrategy = {
  id: 'white-paper',
  label: 'White Paper',
  process: whitePaperProcess
};

// ---- Strategy registry ----------------------------------------------
//
// Future strategies (UniformColourStrategy, AISegmentationStrategy,
// ManualRefinementStrategy) register here the same way. The UI and
// worker only ever call run(id, ...) — see README.md's Architecture
// section for the intended shape of a future strategy.
var STRATEGIES = {};
STRATEGIES[WhitePaperStrategy.id] = WhitePaperStrategy;

export function registerStrategy(strategy) {
  if (!strategy || !strategy.id || typeof strategy.process !== 'function') {
    throw new Error('A strategy needs at least { id, process(pixelBuffer, options) }');
  }
  STRATEGIES[strategy.id] = strategy;
}

export function listStrategies() {
  return Object.keys(STRATEGIES).map(function (id) {
    return { id: id, label: STRATEGIES[id].label || id };
  });
}

export function run(strategyId, pixelBuffer, options) {
  var strategy = STRATEGIES[strategyId];
  if (!strategy) throw new Error('Unknown background removal strategy: ' + strategyId);
  return strategy.process(pixelBuffer, options || {});
}

export { WhitePaperStrategy };
