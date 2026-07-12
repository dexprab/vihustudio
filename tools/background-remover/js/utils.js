// utils.js — small, dependency-free helpers shared across the utility.
// No imports from anywhere outside this directory.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function debounce(fn, wait) {
  var timer = null;
  return function debounced() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  var value = bytes / Math.pow(1024, i);
  return (i === 0 ? value : value.toFixed(1)) + ' ' + units[i];
}

export function formatDimensions(width, height) {
  return width + ' × ' + height;
}

// Squared Euclidean distance in RGB space — squared so callers can
// compare against a squared tolerance and skip a sqrt per pixel in
// hot loops (the flood fill runs this once per border-adjacent
// candidate, on multi-megapixel images).
export function colorDistanceSquared(r1, g1, b1, r2, g2, b2) {
  var dr = r1 - r2;
  var dg = g1 - g2;
  var db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

// Triggers a browser download of a Blob under the given filename.
export function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on a delay — some browsers cancel the download if the
  // object URL is revoked synchronously.
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

export function stripExtension(filename) {
  var idx = filename.lastIndexOf('.');
  return idx === -1 ? filename : filename.slice(0, idx);
}
