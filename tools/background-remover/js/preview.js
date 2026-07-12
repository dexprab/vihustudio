// preview.js — canvas rendering, zoom, and pan for the preview panes.
// Pure DOM/canvas concerns only; it knows nothing about how a pixel
// buffer was produced.

import { clamp } from './utils.js';

// Draws a { data, width, height } pixel buffer to a <canvas>,
// resizing the canvas's backing store to match. `data` may be a
// Uint8ClampedArray directly usable by ImageData, or already an
// ImageData-like object.
export function drawPixelBuffer(canvas, pixelBuffer) {
  canvas.width = pixelBuffer.width;
  canvas.height = pixelBuffer.height;
  var ctx = canvas.getContext('2d');
  var imageData = new ImageData(
    pixelBuffer.data instanceof Uint8ClampedArray
      ? pixelBuffer.data
      : new Uint8ClampedArray(pixelBuffer.data),
    pixelBuffer.width,
    pixelBuffer.height
  );
  ctx.putImageData(imageData, 0, 0);
}

// Wires mouse-wheel zoom + drag-to-pan onto a scrollable viewport
// element wrapping a zoomable inner element (the canvas or an <img>).
// Returns { setZoom, reset } so callers (app.js) can drive zoom from
// UI buttons too, not only the wheel.
export function createZoomController(viewportEl, zoomTargetEl, options) {
  var minZoom = (options && options.min) || 0.1;
  var maxZoom = (options && options.max) || 8;
  var zoom = 1;
  var originX = 0;
  var originY = 0;

  function apply() {
    zoomTargetEl.style.transform =
      'translate(' + originX + 'px, ' + originY + 'px) scale(' + zoom + ')';
  }

  function setZoom(next, anchorClientX, anchorClientY) {
    var clamped = clamp(next, minZoom, maxZoom);
    if (anchorClientX != null) {
      var rect = viewportEl.getBoundingClientRect();
      var px = anchorClientX - rect.left - originX;
      var py = anchorClientY - rect.top - originY;
      var scaleRatio = clamped / zoom;
      originX -= px * (scaleRatio - 1);
      originY -= py * (scaleRatio - 1);
    }
    zoom = clamped;
    apply();
  }

  function reset() {
    zoom = 1;
    originX = 0;
    originY = 0;
    apply();
  }

  viewportEl.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(zoom * delta, e.clientX, e.clientY);
  }, { passive: false });

  var dragging = false;
  var lastX = 0, lastY = 0;
  viewportEl.addEventListener('mousedown', function (e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    viewportEl.classList.add('is-panning');
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    originX += e.clientX - lastX;
    originY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    apply();
  });
  window.addEventListener('mouseup', function () {
    dragging = false;
    viewportEl.classList.remove('is-panning');
  });

  apply();
  return { setZoom: setZoom, reset: reset, getZoom: function () { return zoom; } };
}
