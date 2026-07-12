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
// Returns { setZoom, reset, fitToViewport, setContentSize } so callers
// (app.js) can drive zoom from UI buttons too, not only the wheel.
//
// Positioning is done entirely through the translate/scale transform
// (originX/originY + zoom) rather than leaning on flex centering, so
// `fitToViewport()` can compute an exact centred position for content
// far larger — or smaller — than the viewport.
export function createZoomController(viewportEl, zoomTargetEl, options) {
  var minZoom = (options && options.min) || 0.02;
  var maxZoom = (options && options.max) || 12;
  var onChange = (options && options.onChange) || function () {};
  var zoom = 1;
  var originX = 0;
  var originY = 0;
  var contentWidth = 0;
  var contentHeight = 0;
  // Tracks whether the *user* has ever driven zoom on this pane
  // (wheel, drag, or an explicit setZoom() call from a toolbar
  // button) — as opposed to a programmatic fitToViewport()/reset().
  // app.js uses this to avoid a real race: processing a large image
  // can take over a second, and if the auto "fit the freshly-arrived
  // processed result" call landed after the user had already started
  // zooming, it would silently yank their zoom back to fit. Callers
  // check wasUserTouched() before applying an automatic one-time fit.
  var userTouched = false;

  function apply() {
    zoomTargetEl.style.transform =
      'translate(' + originX + 'px, ' + originY + 'px) scale(' + zoom + ')';
  }

  // Centres a box of the current content size, scaled by `z`, within
  // the viewport's current on-screen rect.
  function centerAt(z) {
    var rect = viewportEl.getBoundingClientRect();
    originX = (rect.width - contentWidth * z) / 2;
    originY = (rect.height - contentHeight * z) / 2;
  }

  function setZoom(next, anchorClientX, anchorClientY) {
    userTouched = true;
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
    onChange(zoom);
  }

  // Records the natural pixel size of whatever's currently drawn into
  // zoomTargetEl, so fitToViewport()/reset() can centre it. Called by
  // app.js right after each drawPixelBuffer().
  function setContentSize(width, height) {
    contentWidth = width || 0;
    contentHeight = height || 0;
  }

  // Scales content to fit entirely within the viewport ("view it all
  // at one go") and centres it. Falls back to reset() if content size
  // or viewport layout isn't known yet.
  function fitToViewport() {
    var rect = viewportEl.getBoundingClientRect();
    if (!contentWidth || !contentHeight || !rect.width || !rect.height) {
      reset();
      return;
    }
    var fit = Math.min(rect.width / contentWidth, rect.height / contentHeight);
    zoom = clamp(fit, minZoom, maxZoom);
    centerAt(zoom);
    apply();
    onChange(zoom);
  }

  function reset() {
    zoom = 1;
    if (contentWidth && contentHeight) {
      centerAt(zoom);
    } else {
      originX = 0;
      originY = 0;
    }
    apply();
    onChange(zoom);
  }

  viewportEl.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(zoom * delta, e.clientX, e.clientY);
  }, { passive: false });

  // Manual tools (the Cleanup Brush, Manual Crop) need exclusive use
  // of mouse drags on this same viewport — panEnabled lets app.js
  // suspend the pan-on-drag behaviour while one of those is active,
  // without touching wheel-zoom (still useful mid-tool, to get closer
  // to an edge) or tearing down and rebuilding this controller.
  var panEnabled = true;

  var dragging = false;
  var lastX = 0, lastY = 0;
  viewportEl.addEventListener('mousedown', function (e) {
    if (!panEnabled) return;
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
  return {
    setZoom: setZoom,
    reset: reset,
    fitToViewport: fitToViewport,
    setContentSize: setContentSize,
    getZoom: function () { return zoom; },
    wasUserTouched: function () { return userTouched; },
    // Called when a new image is loaded, so the previous image's
    // manual zooming doesn't suppress the new image's first auto-fit.
    resetUserTouched: function () { userTouched = false; },
    setPanEnabled: function (enabled) { panEnabled = enabled; },
    // Maps a mouse event's viewport-relative screen position back to
    // the content's own untransformed pixel space — the inverse of
    // the translate/scale `apply()` uses to place it on screen. The
    // Cleanup Brush and Manual Crop tools both need this to know
    // which image pixels the user is actually pointing at.
    toContentCoords: function (clientX, clientY) {
      var rect = viewportEl.getBoundingClientRect();
      return {
        x: (clientX - rect.left - originX) / zoom,
        y: (clientY - rect.top - originY) / zoom
      };
    }
  };
}
