// backgroundDetector.js — estimates the background colour and a
// starting tolerance from an image's border pixels.
//
// Pure functions over a plain {data, width, height} pixel buffer
// (a Uint8ClampedArray in RGBA order, exactly like ImageData.data) —
// no DOM or Canvas dependency, so this runs identically on the main
// thread or inside a Worker.

// Samples every pixel along the outer edge of the image (top row,
// bottom row, left column, right column). For large images this is
// still only O(perimeter), not O(area), so it stays cheap even at
// 4000x3000.
function sampleBorderPixels(data, width, height) {
  var samples = [];

  function pushAt(x, y) {
    var i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  for (var x = 0; x < width; x++) {
    pushAt(x, 0);
    pushAt(x, height - 1);
  }
  for (var y = 0; y < height; y++) {
    pushAt(0, y);
    pushAt(width - 1, y);
  }

  return samples;
}

// Estimates the background colour as the mean of the border samples,
// then derives a tolerance from how much those samples actually
// varied — a border that's a clean, flat white gives a small
// tolerance; a border with scanner noise or soft shadow gradients
// gives a larger one automatically, rather than a single hardcoded
// number trying to cover every source image.
export function detectBackground(pixelBuffer) {
  var data = pixelBuffer.data;
  var width = pixelBuffer.width;
  var height = pixelBuffer.height;
  var samples = sampleBorderPixels(data, width, height);

  var sumR = 0, sumG = 0, sumB = 0;
  for (var i = 0; i < samples.length; i++) {
    sumR += samples[i][0];
    sumG += samples[i][1];
    sumB += samples[i][2];
  }
  var n = samples.length;
  var meanR = sumR / n;
  var meanG = sumG / n;
  var meanB = sumB / n;

  var sumSqDist = 0;
  var maxDist = 0;
  for (var j = 0; j < samples.length; j++) {
    var dr = samples[j][0] - meanR;
    var dg = samples[j][1] - meanG;
    var db = samples[j][2] - meanB;
    var distSq = dr * dr + dg * dg + db * db;
    sumSqDist += distSq;
    if (distSq > maxDist) maxDist = distSq;
  }
  var variance = sumSqDist / n;
  var stdDev = Math.sqrt(variance);

  // Baseline tolerance: comfortably past the noisiest border samples
  // seen (a few standard deviations, since scanner/photo noise is
  // roughly normally distributed) plus a small fixed floor so a
  // perfectly flat studio-white border still gets a workable
  // tolerance rather than ~0. Clamped to a sane range for the UI
  // slider (see index.html) to sit within.
  var autoTolerance = Math.round(Math.min(80, Math.max(18, stdDev * 3 + 12)));

  return {
    color: { r: Math.round(meanR), g: Math.round(meanG), b: Math.round(meanB) },
    tolerance: autoTolerance,
    sampleCount: n
  };
}
