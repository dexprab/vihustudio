// app.js — wires the DOM to the processing pipeline (worker.js) and
// the manual finishing tools (Cleanup Brush, Manual Crop) that run on
// its result.
//
// This file owns UI state only. It never imports backgroundRemoval.js,
// backgroundDetector.js, edgeSmoothing.js, or cropper.js directly —
// it only ever talks to worker.js, which is the one place those are
// composed into a pipeline. That's the boundary that lets the
// strategy behind "process this image" change without app.js caring.
// The manual tools follow the same discipline: cleanupBrush.js and
// cropper.js are plain functions over a pixel buffer, called directly
// here (synchronously — they're cheap enough not to need a worker)
// rather than folded into worker.js's automatic pipeline, since they
// react to a live mouse drag rather than a slider's debounced value.

import { drawPixelBuffer, createZoomController } from './js/preview.js';
import { debounce, downloadBlob, formatBytes, formatDimensions, stripExtension } from './js/utils.js';
import { encodePixelBufferToPNG } from './js/pngEncoder.js';
import { eraseCircle, restoreCircle, eraseRect } from './js/cleanupBrush.js';
import { cropPixelBuffer } from './js/cropper.js';
import { drawOverlay, drawDifference } from './js/analysisView.js';

var els = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  workspace: document.getElementById('workspace'),

  viewSideBySide: document.getElementById('viewSideBySide'),
  viewToggle: document.getElementById('viewToggle'),
  viewOverlay: document.getElementById('viewOverlay'),
  viewDifference: document.getElementById('viewDifference'),
  previewGrid: document.getElementById('previewGrid'),
  originalPane: document.getElementById('originalPane'),
  processedPane: document.getElementById('processedPane'),
  analysisPane: document.getElementById('analysisPane'),
  analysisLabel: document.getElementById('analysisLabel'),

  originalCanvas: document.getElementById('originalCanvas'),
  processedCanvas: document.getElementById('processedCanvas'),
  analysisCanvas: document.getElementById('analysisCanvas'),
  originalViewport: document.getElementById('originalViewport'),
  processedViewport: document.getElementById('processedViewport'),
  analysisViewport: document.getElementById('analysisViewport'),
  originalZoomTarget: document.getElementById('originalZoomTarget'),
  processedZoomTarget: document.getElementById('processedZoomTarget'),
  analysisZoomTarget: document.getElementById('analysisZoomTarget'),

  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  kidZoomSlider: document.getElementById('kidZoomSlider'),

  toleranceSlider: document.getElementById('toleranceSlider'),
  toleranceValue: document.getElementById('toleranceValue'),
  featherSlider: document.getElementById('featherSlider'),
  featherValue: document.getElementById('featherValue'),
  autoCropToggle: document.getElementById('autoCropToggle'),

  brushSizeSlider: document.getElementById('brushSizeSlider'),
  brushSizeValue: document.getElementById('brushSizeValue'),
  cleanupToggleBtn: document.getElementById('cleanupToggleBtn'),
  restoreToggleBtn: document.getElementById('restoreToggleBtn'),
  cleanupUndoBtn: document.getElementById('cleanupUndoBtn'),
  cleanupRedoBtn: document.getElementById('cleanupRedoBtn'),
  cleanupResetBtn: document.getElementById('cleanupResetBtn'),
  brushCursor: document.getElementById('brushCursor'),
  brushSizePanel: document.getElementById('brushSizePanel'),
  brushSmallBtn: document.getElementById('brushSmallBtn'),
  brushMediumBtn: document.getElementById('brushMediumBtn'),
  brushLargeBtn: document.getElementById('brushLargeBtn'),

  cropToggleBtn: document.getElementById('cropToggleBtn'),
  cropApplyBtn: document.getElementById('cropApplyBtn'),
  cropTrashBtn: document.getElementById('cropTrashBtn'),
  cropResetBtn: document.getElementById('cropResetBtn'),
  cropSelectionBox: document.getElementById('cropSelectionBox'),
  cropPanel: document.getElementById('cropPanel'),

  downloadBtn: document.getElementById('downloadBtn'),
  resetBtn: document.getElementById('resetBtn'),

  previewMeta: document.getElementById('previewMeta'),
  previewLoading: document.getElementById('previewLoading'),
  performanceNote: document.getElementById('performanceNote'),
  toast: document.getElementById('toast'),

  magicOverlay: document.getElementById('magicOverlay'),
  magicMessage: document.getElementById('magicMessage'),
  resultView: document.getElementById('resultView'),
  editView: document.getElementById('editView'),
  looksGreatBtn: document.getElementById('looksGreatBtn'),
  makeItBetterBtn: document.getElementById('makeItBetterBtn'),
  beforeAfter: document.getElementById('beforeAfter'),
  beforeAfterStage: document.getElementById('beforeAfterStage'),
  baCanvasBefore: document.getElementById('baCanvasBefore'),
  baCanvasAfter: document.getElementById('baCanvasAfter'),
  baSlider: document.getElementById('baSlider')
};

var worker = new Worker(new URL('./js/worker.js', import.meta.url), { type: 'module' });
var jobCounter = 0;
var latestJobId = 0;

var state = {
  sourceFile: null,
  originalPixelBuffer: null, // pristine copy, never mutated after load

  // The result of the automatic pipeline (background removal +
  // feathering + auto-crop) for the current slider settings, kept
  // untouched so "Reset Cleanup" always has a clean copy to return
  // to. Replaced wholesale whenever tolerance/feather/auto-crop change.
  autoProcessedBuffer: null,

  // The buffer actually shown in the Transparent pane and exported —
  // starts as a clone of autoProcessedBuffer, then the Cleanup Brush
  // and Manual Crop mutate it directly. This is the single source of
  // truth for "the current result"; nothing re-derives it from canvas
  // pixel data (see handleDownload's own comment on why that matters).
  workingBuffer: null,
  // Where workingBuffer's (0,0) sits within originalPixelBuffer — the
  // auto-crop offset, plus any further manual-crop offset — so the
  // Difference view can always compare the right sub-region.
  workingOffsetX: 0,
  workingOffsetY: 0,
  // The auto-crop offset alone (before any manual crop) — kept so
  // "Reset Cleanup" can restore workingOffsetX/Y correctly even after
  // a manual crop has shifted them further.
  autoOffsetX: 0,
  autoOffsetY: 0,

  lastMeta: null,        // meta from the most recent automatic run (kept fresh every run)
  userTolerance: null,  // null until the user drags the slider

  activeTool: 'pan',    // 'pan' | 'brush' (Remove More) | 'restore' (Bring It Back) | 'crop'
  viewMode: 'side-by-side',
  screenMode: 'result', // 'result' | 'edit' — which of the two post-magic screens is showing

  cleanupHistory: [],   // undo stack: [{ changes: Map<pixelIndex, alphaBefore> }]
  cleanupRedoStack: [],
  strokeChanges: null,  // in-progress stroke's Map, or null between strokes

  cropRect: null,          // pending rect (workingBuffer-local px), while drawing/before Apply
  preCropSnapshot: null    // { buffer, offsetX, offsetY } for Reset Crop
};

// Both controllers report through the same callback, so the zoom
// label reflects whichever pane's zoom last actually changed — the
// wheel over either pane, or the shared +/- buttons below.
function handleZoomChange(zoom) {
  els.zoomResetBtn.textContent = Math.round(zoom * 100) + '%';
}
// zoomProcessed also drives the child-facing zoom slider — kept as its
// own callback (rather than folded into the shared handleZoomChange)
// so a zoomOriginal/zoomAnalysis change never overwrites it with an
// unrelated pane's zoom level; only the picture the child is actually
// looking at (My Magic Drawing, in Edit mode) should move that slider.
function handleProcessedZoomChange(zoom) {
  handleZoomChange(zoom);
  if (els.kidZoomSlider) {
    els.kidZoomSlider.value = Math.round(zoom * 100);
  }
}
var zoomOriginal = createZoomController(els.originalViewport, els.originalZoomTarget, { onChange: handleZoomChange });
var zoomProcessed = createZoomController(els.processedViewport, els.processedZoomTarget, { onChange: handleProcessedZoomChange });
var zoomAnalysis = createZoomController(els.analysisViewport, els.analysisZoomTarget, { onChange: handleZoomChange });

init();

function init() {
  // browseBtn lives *inside* dropzone, which also opens the file
  // picker on click (as a "click anywhere in the dropzone" affordance).
  // Without stopPropagation, a Browse click bubbles up to dropzone's
  // own listener too, firing fileInput.click() twice in the same
  // tick — this raced two file-chooser requests against each other
  // (confirmed: a single Browse click fired two 'filechooser' events),
  // so the first dialog's selection was frequently lost and only a
  // second, separate click-and-select actually loaded the image. Only
  // one thing should ever open the picker for a given user click.
  els.browseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    els.fileInput.click();
  });
  els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
  els.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  els.fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
    // Clear so re-selecting the exact same file (e.g. after Reset)
    // still fires 'change' — otherwise the browser sees an unchanged
    // value and silently skips the event on the second attempt.
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    els.dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      els.dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    els.dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      els.dropzone.classList.remove('is-dragover');
    });
  });
  els.dropzone.addEventListener('drop', function (e) {
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  window.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        var file = items[i].getAsFile();
        if (file) { loadFile(file); break; }
      }
    }
  });

  els.viewSideBySide.addEventListener('click', function () { setViewMode('side-by-side'); });
  els.viewToggle.addEventListener('click', function () { setViewMode('toggle'); });
  els.viewOverlay.addEventListener('click', function () { setViewMode('overlay'); });
  els.viewDifference.addEventListener('click', function () { setViewMode('difference'); });

  els.zoomInBtn.addEventListener('click', function () { adjustZoom(1.25); });
  els.zoomOutBtn.addEventListener('click', function () { adjustZoom(1 / 1.25); });
  // The label doubles as a "Fit" button — re-fit each pane to its own
  // current content rather than jumping to a hardcoded 100%, so a
  // large photo is viewable in one go again after manual zooming.
  els.zoomResetBtn.addEventListener('click', function () {
    // Same reasoning as adjustZoom() — only fit whichever pane(s) the
    // current view mode actually shows, so a hidden pane's
    // fitToViewport()/reset() fallback can't win the shared label.
    if (state.viewMode === 'overlay' || state.viewMode === 'difference') {
      zoomAnalysis.fitToViewport();
      return;
    }
    zoomOriginal.fitToViewport();
    zoomProcessed.fitToViewport();
  });

  var reprocess = debounce(function () { runPipeline(); }, 180);

  els.toleranceSlider.addEventListener('input', function () {
    state.userTolerance = Number(els.toleranceSlider.value);
    els.toleranceValue.textContent = state.userTolerance;
    reprocess();
  });
  els.featherSlider.addEventListener('input', function () {
    els.featherValue.textContent = els.featherSlider.value;
    reprocess();
  });
  els.autoCropToggle.addEventListener('change', reprocess);

  initCleanupBrush();
  initManualCrop();
  initBrushSizeChoices();
  initScreenFlow();
  initKidZoomSlider();

  els.downloadBtn.addEventListener('click', handleDownload);
  els.resetBtn.addEventListener('click', resetToUpload);

  worker.onmessage = handleWorkerMessage;
  worker.onerror = function (err) {
    setProcessing(false);
    showToast('Processing failed: ' + err.message, true);
  };
}

function adjustZoom(factor) {
  // Only adjust whichever pane(s) are actually visible for the
  // current view mode. Touching a hidden pane's zoom controller was a
  // real bug, not just wasted work: all three controllers report
  // through the same handleZoomChange label, and a hidden pane (e.g.
  // zoomAnalysis while showing Side by side) is never fitted, so its
  // stale default zoom (1) would win the shared label the moment its
  // setZoom() ran after the visible pane's own correct update.
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') {
    zoomAnalysis.setZoom(zoomAnalysis.getZoom() * factor);
    return;
  }
  // Multiply each pane's own current zoom rather than forcing both to
  // one absolute value — original and processed can have different
  // pixel dimensions (auto-crop shrinks the processed canvas) and
  // therefore different fit baselines, so this keeps them moving
  // together proportionally without fighting fitToViewport().
  zoomOriginal.setZoom(zoomOriginal.getZoom() * factor);
  zoomProcessed.setZoom(zoomProcessed.getZoom() * factor);
}

function setViewMode(mode) {
  state.viewMode = mode;
  var isToggle = mode === 'toggle';
  var isAnalysis = mode === 'overlay' || mode === 'difference';

  els.previewGrid.classList.toggle('is-toggle-mode', isToggle);
  els.previewGrid.classList.toggle('is-single-mode', isAnalysis);

  [els.viewSideBySide, els.viewToggle, els.viewOverlay, els.viewDifference].forEach(function (btn) {
    btn.classList.remove('is-active');
    btn.setAttribute('aria-selected', 'false');
  });
  var activeBtn = mode === 'side-by-side' ? els.viewSideBySide
    : mode === 'toggle' ? els.viewToggle
    : mode === 'overlay' ? els.viewOverlay
    : els.viewDifference;
  activeBtn.classList.add('is-active');
  activeBtn.setAttribute('aria-selected', 'true');

  if (isAnalysis) {
    els.originalPane.hidden = true;
    els.processedPane.hidden = true;
    els.analysisPane.hidden = false;
    els.analysisLabel.textContent = mode === 'overlay' ? 'Overlay' : 'Difference';
    renderAnalysisView();
    return;
  }

  els.analysisPane.hidden = true;
  els.originalPane.hidden = false;
  els.processedPane.hidden = false;
  // Returning from Overlay/Difference leaves the shared zoom label
  // showing zoomAnalysis's last value — refresh it to the pane that's
  // actually visible again now.
  handleZoomChange(zoomProcessed.getZoom());

  if (isToggle) {
    // Toggle mode starts on the processed image — that's the result
    // people came here for.
    showOnly(els.processedPane);
    els.originalPane.onclick = function () { showOnly(els.originalPane); };
    els.processedPane.onclick = function () { showOnly(els.processedPane); };
  } else {
    els.originalPane.onclick = null;
    els.processedPane.onclick = null;
  }
}

function showOnly(paneToShow) {
  [els.originalPane, els.processedPane].forEach(function (pane) {
    pane.hidden = pane !== paneToShow;
  });
}

function renderAnalysisView() {
  if (!state.originalPixelBuffer || !state.workingBuffer) return;
  if (state.viewMode === 'overlay') {
    drawOverlay(els.analysisCanvas, state.originalPixelBuffer, state.workingBuffer, state.workingOffsetX, state.workingOffsetY);
  } else if (state.viewMode === 'difference') {
    drawDifference(els.analysisCanvas, state.originalPixelBuffer, state.workingBuffer, state.workingOffsetX, state.workingOffsetY);
  } else {
    return;
  }
  zoomAnalysis.setContentSize(els.analysisCanvas.width, els.analysisCanvas.height);
  if (!zoomAnalysis.wasUserTouched()) zoomAnalysis.fitToViewport();
}

function loadFile(file) {
  if (file.type.indexOf('image/') !== 0) {
    showToast('That file is not an image.', true);
    return;
  }

  createImageBitmap(file).then(function (bitmap) {
    state.sourceFile = file;

    var canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.originalPixelBuffer = {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height
    };
    state.userTolerance = null;
    clearManualEdits();

    els.dropzone.hidden = true;
    els.workspace.hidden = false;
    drawPixelBuffer(els.originalCanvas, state.originalPixelBuffer);
    // A fresh image resets what "the user already zoomed" means —
    // otherwise leftover manual zoom from a previously loaded image
    // would suppress this image's very first auto-fit below.
    zoomOriginal.resetUserTouched();
    zoomProcessed.resetUserTouched();
    zoomAnalysis.resetUserTouched();
    // Fit the original to its viewport immediately so a large photo
    // (e.g. a 4000x3000 scan) is visible in one go rather than
    // opening at 100% and overflowing the pane. The processed pane
    // gets the same treatment once its own (possibly cropped) size is
    // known, in handleWorkerMessage.
    zoomOriginal.setContentSize(state.originalPixelBuffer.width, state.originalPixelBuffer.height);
    zoomOriginal.fitToViewport();
    setViewMode('side-by-side');

    // The processed pane has nothing in it until the first automatic
    // result arrives — which, for a large image, can take over a
    // second — so its zoom controls are disabled until then. Without
    // this, a click during that window would zoom from zoomProcessed's
    // untouched default (1) instead of a real fit ratio, and the
    // wasUserTouched() guard (see handleWorkerMessage) would then
    // correctly honour that click and never fit at all — technically
    // not the silent-overwrite bug that guard exists for, but still a
    // confusing zoom level with no real image to have zoomed from.
    setZoomControlsEnabled(false);

    runPipeline();
  }).catch(function (err) {
    showToast('Could not read that image: ' + err.message, true);
  });
}

function runPipeline() {
  if (!state.originalPixelBuffer) return;

  var jobId = ++jobCounter;
  latestJobId = jobId;
  setProcessing(true);

  // Clone the pristine buffer — postMessage's transfer list neuters
  // the sender's copy, and the user can move the sliders again before
  // this job even finishes, so the original has to survive every run.
  var clonedData = new Uint8ClampedArray(state.originalPixelBuffer.data);

  var options = {
    strategy: 'white-paper',
    tolerance: state.userTolerance, // null on first run -> worker auto-detects
    featherRadius: Number(els.featherSlider.value),
    autoCrop: els.autoCropToggle.checked
  };

  worker.postMessage({
    type: 'process',
    jobId: jobId,
    pixelBuffer: {
      data: clonedData,
      width: state.originalPixelBuffer.width,
      height: state.originalPixelBuffer.height
    },
    options: options
  }, [clonedData.buffer]);
}

function handleWorkerMessage(event) {
  var msg = event.data;
  if (msg.jobId !== latestJobId) return; // a newer job superseded this one

  if (msg.type === 'error') {
    setProcessing(false);
    showToast('Processing failed: ' + msg.message, true);
    return;
  }
  if (msg.type !== 'result') return;

  // A fresh automatic result invalidates any in-progress manual work —
  // cleanup edits and a manual crop were both made against the
  // *previous* automatic result, and there's no sound way to replay
  // them onto a differently-processed image. The automatic algorithm
  // stays the primary workflow; manual tools only ever refine its
  // current output (see the sprint brief).
  var hadManualEdits = state.cleanupHistory.length > 0 || state.preCropSnapshot != null;

  state.autoProcessedBuffer = msg.pixelBuffer;
  state.workingBuffer = clonePixelBuffer(msg.pixelBuffer);
  state.autoOffsetX = msg.meta.cropBounds ? msg.meta.cropBounds.x : 0;
  state.autoOffsetY = msg.meta.cropBounds ? msg.meta.cropBounds.y : 0;
  state.workingOffsetX = state.autoOffsetX;
  state.workingOffsetY = state.autoOffsetY;
  // Kept fresh on every result (not just the first) so Reset
  // Cleanup/Reset Crop can redraw the meta line without a stale
  // tolerance/background reading from this image's very first run.
  state.lastMeta = msg.meta;
  clearManualEdits();

  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  setProcessing(false);

  if (hadManualEdits) {
    showToast('Automatic settings changed — manual cleanup/crop was reset.');
  }

  if (state.userTolerance == null) {
    // First run: adopt the auto-detected tolerance as the slider's
    // starting position, per "determine colour tolerance
    // automatically" — the user can still override it from here.
    els.toleranceSlider.value = msg.meta.tolerance;
    els.toleranceValue.textContent = msg.meta.tolerance;

    // Also fit the processed pane now that its (possibly cropped)
    // size is known for the first time. Content size is recorded
    // unconditionally (a later manual "Fit" click needs it either
    // way), but the fit itself only auto-applies if the user hasn't
    // already started zooming — large images can take over a second
    // to process, and without this guard, zoom clicks made while
    // still waiting for this very first result would get silently
    // overwritten the instant it arrives.
    zoomProcessed.setContentSize(state.workingBuffer.width, state.workingBuffer.height);
    if (!zoomProcessed.wasUserTouched()) {
      zoomProcessed.fitToViewport();
    }
    setZoomControlsEnabled(true);
  } else {
    zoomProcessed.setContentSize(state.workingBuffer.width, state.workingBuffer.height);
  }

  if (state.viewMode === 'overlay' || state.viewMode === 'difference') {
    renderAnalysisView();
  }

  updateMeta(msg.meta);
}

function updateMeta(meta) {
  var original = state.originalPixelBuffer;
  var working = state.workingBuffer;
  var bg = meta.backgroundColor;
  var sizeChanged = working.width !== original.width || working.height !== original.height;
  var parts = [
    formatDimensions(original.width, original.height) +
      (sizeChanged ? ' → ' + formatDimensions(working.width, working.height) + ' (cropped)' : ''),
    'background ≈ rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')'
  ];
  els.previewMeta.textContent = parts.join('  ·  ');
  els.performanceNote.textContent = 'Processed in ' + meta.processingMs + ' ms';
}

function setProcessing(isProcessing) {
  els.previewLoading.hidden = !isProcessing;
  els.downloadBtn.disabled = isProcessing;
  if (isProcessing) {
    beginMagic();
  } else {
    endMagicProcessing();
  }
}

function setZoomControlsEnabled(enabled) {
  els.zoomInBtn.disabled = !enabled;
  els.zoomOutBtn.disabled = !enabled;
  els.zoomResetBtn.disabled = !enabled;
}

function clonePixelBuffer(pixelBuffer) {
  return {
    data: new Uint8ClampedArray(pixelBuffer.data),
    width: pixelBuffer.width,
    height: pixelBuffer.height
  };
}

// ---- Manual Cleanup (erase brush) + Bring It Back (restore brush) -----

function initCleanupBrush() {
  els.brushSizeSlider.addEventListener('input', function () {
    els.brushSizeValue.textContent = els.brushSizeSlider.value;
  });

  els.cleanupToggleBtn.addEventListener('click', function () {
    setActiveTool(state.activeTool === 'brush' ? 'pan' : 'brush');
  });
  els.restoreToggleBtn.addEventListener('click', function () {
    setActiveTool(state.activeTool === 'restore' ? 'pan' : 'restore');
  });
  els.cleanupUndoBtn.addEventListener('click', undoCleanup);
  els.cleanupRedoBtn.addEventListener('click', redoCleanup);
  els.cleanupResetBtn.addEventListener('click', function () { resetCleanup(); });

  var painting = false;

  els.processedViewport.addEventListener('mousedown', function (e) {
    var tool = state.activeTool;
    if ((tool !== 'brush' && tool !== 'restore') || !state.workingBuffer) return;
    painting = true;
    state.strokeChanges = new Map();
    paintAt(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', function (e) {
    if (state.activeTool === 'brush' || state.activeTool === 'restore') {
      updateBrushCursor(e.clientX, e.clientY);
    }
    if (!painting) return;
    paintAt(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', function () {
    if (!painting) return;
    painting = false;
    finishStroke();
  });
  els.processedViewport.addEventListener('mouseleave', function () {
    els.brushCursor.hidden = true;
  });

  function paintAt(clientX, clientY) {
    var pt = zoomProcessed.toContentCoords(clientX, clientY);
    var radius = Number(els.brushSizeSlider.value) / 2;
    // "Remove More" erases (targetAlpha 0), "Bring It Back" restores
    // (targetAlpha 255) — both share the exact same soft-edge falloff
    // and undo-recording, see cleanupBrush.js.
    var paintFn = state.activeTool === 'restore' ? restoreCircle : eraseCircle;
    paintFn(state.workingBuffer, pt.x, pt.y, radius, function (pixelIndex, alphaBefore) {
      if (!state.strokeChanges.has(pixelIndex)) {
        state.strokeChanges.set(pixelIndex, alphaBefore);
      }
    });
    drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  }

  function updateBrushCursor(clientX, clientY) {
    var rect = els.processedViewport.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      els.brushCursor.hidden = true;
      return;
    }
    var diameterPx = Number(els.brushSizeSlider.value) * zoomProcessed.getZoom();
    els.brushCursor.style.width = diameterPx + 'px';
    els.brushCursor.style.height = diameterPx + 'px';
    els.brushCursor.style.left = (clientX - rect.left) + 'px';
    els.brushCursor.style.top = (clientY - rect.top) + 'px';
    els.brushCursor.hidden = false;
  }
}

function finishStroke() {
  if (state.strokeChanges && state.strokeChanges.size > 0) {
    state.cleanupHistory.push({ changes: state.strokeChanges });
    state.cleanupRedoStack = [];
    updateCleanupButtons();
  }
  state.strokeChanges = null;
}

function undoCleanup() {
  var entry = state.cleanupHistory.pop();
  if (!entry || !state.workingBuffer) return;
  var data = state.workingBuffer.data;
  var redoChanges = new Map();
  entry.changes.forEach(function (alphaBefore, pixelIndex) {
    redoChanges.set(pixelIndex, data[pixelIndex * 4 + 3]);
    data[pixelIndex * 4 + 3] = alphaBefore;
  });
  state.cleanupRedoStack.push({ changes: redoChanges });
  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  updateCleanupButtons();
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

function redoCleanup() {
  var entry = state.cleanupRedoStack.pop();
  if (!entry || !state.workingBuffer) return;
  var data = state.workingBuffer.data;
  var undoChanges = new Map();
  entry.changes.forEach(function (alphaAfter, pixelIndex) {
    undoChanges.set(pixelIndex, data[pixelIndex * 4 + 3]);
    data[pixelIndex * 4 + 3] = alphaAfter;
  });
  state.cleanupHistory.push({ changes: undoChanges });
  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  updateCleanupButtons();
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

function resetCleanup() {
  if (!state.autoProcessedBuffer) return;
  // Reset always returns to the pure automatic result — cleanup edits
  // AND any manual crop layered on top of them, since a crop only
  // ever applies to a post-cleanup buffer (see the sprint's own
  // "cropping should happen after background removal and cleanup").
  state.workingBuffer = clonePixelBuffer(state.autoProcessedBuffer);
  state.workingOffsetX = state.autoOffsetX;
  state.workingOffsetY = state.autoOffsetY;
  clearManualEdits();
  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  zoomProcessed.setContentSize(state.workingBuffer.width, state.workingBuffer.height);
  zoomProcessed.fitToViewport();
  if (state.lastMeta) updateMeta(state.lastMeta);
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

function clearManualEdits() {
  state.cleanupHistory = [];
  state.cleanupRedoStack = [];
  state.strokeChanges = null;
  state.cropRect = null;
  state.preCropSnapshot = null;
  els.cropSelectionBox.hidden = true;
  setActiveTool('pan');
  updateCleanupButtons();
  updateCropButtons();
}

function updateCleanupButtons() {
  els.cleanupUndoBtn.disabled = state.cleanupHistory.length === 0;
  els.cleanupRedoBtn.disabled = state.cleanupRedoStack.length === 0;
}

// ---- Manual Crop -------------------------------------------------------

function initManualCrop() {
  els.cropToggleBtn.addEventListener('click', function () {
    setActiveTool(state.activeTool === 'crop' ? 'pan' : 'crop');
  });
  els.cropApplyBtn.addEventListener('click', applyManualCrop);
  els.cropTrashBtn.addEventListener('click', applyTrimTrash);
  els.cropResetBtn.addEventListener('click', resetManualCrop);

  var dragging = false;
  var startClientX = 0, startClientY = 0;

  els.processedViewport.addEventListener('mousedown', function (e) {
    if (state.activeTool !== 'crop' || !state.workingBuffer) return;
    dragging = true;
    startClientX = e.clientX;
    startClientY = e.clientY;
    drawSelectionBoxScreen(startClientX, startClientY, startClientX, startClientY);
    els.cropSelectionBox.hidden = false;
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    drawSelectionBoxScreen(startClientX, startClientY, e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', function (e) {
    if (!dragging) return;
    dragging = false;
    finalizeCropDrag(startClientX, startClientY, e.clientX, e.clientY);
  });

  function drawSelectionBoxScreen(x0, y0, x1, y1) {
    var rect = els.processedViewport.getBoundingClientRect();
    var left = Math.min(x0, x1) - rect.left;
    var top = Math.min(y0, y1) - rect.top;
    var width = Math.abs(x1 - x0);
    var height = Math.abs(y1 - y0);
    els.cropSelectionBox.style.left = left + 'px';
    els.cropSelectionBox.style.top = top + 'px';
    els.cropSelectionBox.style.width = width + 'px';
    els.cropSelectionBox.style.height = height + 'px';
  }

  function finalizeCropDrag(x0, y0, x1, y1) {
    var p0 = zoomProcessed.toContentCoords(x0, y0);
    var p1 = zoomProcessed.toContentCoords(x1, y1);
    var buf = state.workingBuffer;
    var x = Math.max(0, Math.min(buf.width, Math.round(Math.min(p0.x, p1.x))));
    var y = Math.max(0, Math.min(buf.height, Math.round(Math.min(p0.y, p1.y))));
    var right = Math.max(0, Math.min(buf.width, Math.round(Math.max(p0.x, p1.x))));
    var bottom = Math.max(0, Math.min(buf.height, Math.round(Math.max(p0.y, p1.y))));
    var width = right - x;
    var height = bottom - y;

    if (width < 2 || height < 2) {
      state.cropRect = null;
      els.cropSelectionBox.hidden = true;
      updateCropButtons();
      return;
    }
    state.cropRect = { x: x, y: y, width: width, height: height };
    updateCropButtons();
  }
}

function applyManualCrop() {
  if (!state.cropRect || !state.workingBuffer) return;
  state.preCropSnapshot = {
    buffer: clonePixelBuffer(state.workingBuffer),
    offsetX: state.workingOffsetX,
    offsetY: state.workingOffsetY
  };

  var rect = state.cropRect;
  state.workingBuffer = cropPixelBuffer(state.workingBuffer, rect);
  state.workingOffsetX += rect.x;
  state.workingOffsetY += rect.y;
  state.cropRect = null;
  els.cropSelectionBox.hidden = true;

  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  zoomProcessed.setContentSize(state.workingBuffer.width, state.workingBuffer.height);
  zoomProcessed.fitToViewport();
  // Deliberately stay in the Trim Picture tool (not setActiveTool('pan'))
  // rather than switching tools on Apply — that used to hide cropPanel
  // entirely, so "Undo Trim" (still enabled underneath) became
  // unreachable the instant a crop was applied, reading as "doesn't
  // work." Staying in Trim Picture keeps the panel, and Undo Trim,
  // visible right where the child just used it.
  updateCropButtons();
  if (state.lastMeta) updateMeta(state.lastMeta);
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

// "Trash It" — the other half of Trim Picture. Unlike "Keep This"
// (applyManualCrop, above), the drawn box is the part that goes AWAY;
// everything outside it stays exactly as it was. The canvas itself
// never resizes (there's no "outside" to crop to), so this is really
// a rectangular erase, not a crop — it goes through eraseRect and
// records onto the same cleanupHistory/cleanupRedoStack stack
// Remove More/Bring It Back already use (see cleanupBrush.js's own
// doc comment on eraseRect), rather than the crop-specific
// preCropSnapshot. That means "Oops!" undoes a Trash the same way it
// undoes a brush stroke, while "Undo Trim" (resetManualCrop) stays
// dedicated to undoing a "Keep This" resize, exactly as before.
function applyTrimTrash() {
  if (!state.cropRect || !state.workingBuffer) return;

  var rect = state.cropRect;
  var changes = new Map();
  eraseRect(state.workingBuffer, rect, function (pixelIndex, alphaBefore) {
    if (!changes.has(pixelIndex)) changes.set(pixelIndex, alphaBefore);
  });
  if (changes.size > 0) {
    state.cleanupHistory.push({ changes: changes });
    state.cleanupRedoStack = [];
    updateCleanupButtons();
  }

  state.cropRect = null;
  els.cropSelectionBox.hidden = true;

  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  // Same reasoning as applyManualCrop() above — stay in the Trim
  // Picture tool so cropPanel (Trash It/Keep This/Undo Trim/Oops!)
  // stays visible right after the action that just used it.
  updateCropButtons();
  if (state.lastMeta) updateMeta(state.lastMeta);
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

function resetManualCrop() {
  if (!state.preCropSnapshot) return;
  state.workingBuffer = state.preCropSnapshot.buffer;
  state.workingOffsetX = state.preCropSnapshot.offsetX;
  state.workingOffsetY = state.preCropSnapshot.offsetY;
  state.preCropSnapshot = null;
  drawPixelBuffer(els.processedCanvas, state.workingBuffer);
  zoomProcessed.setContentSize(state.workingBuffer.width, state.workingBuffer.height);
  zoomProcessed.fitToViewport();
  updateCropButtons();
  if (state.lastMeta) updateMeta(state.lastMeta);
  if (state.viewMode === 'overlay' || state.viewMode === 'difference') renderAnalysisView();
}

function updateCropButtons() {
  els.cropApplyBtn.disabled = !state.cropRect;
  els.cropTrashBtn.disabled = !state.cropRect;
  els.cropResetBtn.disabled = !state.preCropSnapshot;
}

// ---- Tool switching (pan / brush / crop share one viewport) -----------

function setActiveTool(tool) {
  state.activeTool = tool;
  var isPaintTool = tool === 'brush' || tool === 'restore';

  els.cleanupToggleBtn.setAttribute('aria-pressed', String(tool === 'brush'));
  els.restoreToggleBtn.setAttribute('aria-pressed', String(tool === 'restore'));
  els.cropToggleBtn.setAttribute('aria-pressed', String(tool === 'crop'));
  els.processedViewport.classList.toggle('is-brush-active', isPaintTool);
  els.processedViewport.classList.toggle('is-restore-active', tool === 'restore');
  els.processedViewport.classList.toggle('is-crop-active', tool === 'crop');

  zoomProcessed.setPanEnabled(tool === 'pan');

  if (!isPaintTool) {
    els.brushCursor.hidden = true;
  }
  if (tool !== 'crop') {
    state.cropRect = null;
    els.cropSelectionBox.hidden = true;
    els.cropApplyBtn.disabled = true;
    els.cropTrashBtn.disabled = true;
  }

  // Reveal whichever tool's own sub-panel matches (brush size choices
  // for Remove More/Bring It Back, the Trim controls for Trim
  // Picture) — both elements are optional (only present once the
  // child-facing kids UI's markup exists), so this is guarded rather
  // than assumed.
  if (els.brushSizePanel) els.brushSizePanel.hidden = !isPaintTool;
  if (els.cropPanel) els.cropPanel.hidden = tool !== 'crop';
}

// ---- Screen flow: Welcome -> Magic -> Result -> Make It Better --------
//
// The underlying pipeline is unchanged — this section only decides
// which of the DOM's already-existing pieces are visible and when.
// Because the technical Tolerance/Edge Smoothness/Auto Crop controls
// are permanently hidden from the child-facing UI (see kids.css) and
// nothing else in this file ever changes their values, runPipeline()
// only ever runs once per loaded picture now, which is what makes a
// single "magic" moment (rather than a repeating one) correct.

var MAGIC_MESSAGES = [
  '✨ Looking at your drawing...',
  '✨ Making the paper disappear...',
  '✨ Almost ready...'
];
var MAGIC_MIN_VISIBLE_MS = 1400;
var MAGIC_MESSAGE_INTERVAL_MS = 650;

var magicMessageTimer = null;
var magicMinTimeTimer = null;
var magicMinTimeElapsed = false;
var magicProcessingDone = false;

function beginMagic() {
  magicMinTimeElapsed = false;
  magicProcessingDone = false;
  els.magicOverlay.hidden = false;

  var index = 0;
  els.magicMessage.textContent = MAGIC_MESSAGES[0];
  clearInterval(magicMessageTimer);
  magicMessageTimer = setInterval(function () {
    index = (index + 1) % MAGIC_MESSAGES.length;
    els.magicMessage.textContent = MAGIC_MESSAGES[index];
  }, MAGIC_MESSAGE_INTERVAL_MS);

  clearTimeout(magicMinTimeTimer);
  magicMinTimeTimer = setTimeout(function () {
    magicMinTimeElapsed = true;
    maybeFinishMagic();
  }, MAGIC_MIN_VISIBLE_MS);
}

function endMagicProcessing() {
  magicProcessingDone = true;
  maybeFinishMagic();
}

// Only actually reveals the result once BOTH the real processing has
// finished AND the overlay has been up for at least its minimum time —
// so a fast image still gets a satisfying moment of "magic," and a
// slow one never gets cut off mid-processing to hit a fake deadline.
function maybeFinishMagic() {
  if (!magicMinTimeElapsed || !magicProcessingDone) return;
  clearInterval(magicMessageTimer);
  clearTimeout(magicMinTimeTimer);
  els.magicOverlay.hidden = true;
  renderBeforeAfter();
  showResultMode();
}

function initScreenFlow() {
  els.looksGreatBtn.addEventListener('click', function () {
    handleDownload();
  });
  els.makeItBetterBtn.addEventListener('click', showEditMode);
  els.baSlider.addEventListener('input', updateBeforeAfterClip);

  // Re-fit the before/after stage if the window is resized (rotating
  // a tablet, resizing a desktop window) — the fit-both-budgets
  // computation depends on window.innerHeight/the container's own
  // width, both of which can change after the initial render.
  window.addEventListener('resize', debounce(function () {
    if (state.workingBuffer) {
      sizeBeforeAfterStage(state.workingBuffer.width, state.workingBuffer.height);
    }
  }, 150));
}

function showResultMode() {
  state.screenMode = 'result';
  els.resultView.hidden = false;
  els.editView.hidden = true;
}

function showEditMode() {
  state.screenMode = 'edit';
  els.resultView.hidden = true;
  els.editView.hidden = false;
  // Show only "My Magic Drawing" (the existing "toggle" view mode
  // already does exactly this, including a tap-to-peek-at-the-original
  // interaction, for free) and re-fit it now that editView's layout
  // actually has a real, non-zero size — any earlier fit attempt while
  // this screen was hidden would have measured a 0x0 rect and silently
  // no-op'd.
  setViewMode('toggle');
  zoomProcessed.fitToViewport();
}

// Draws the Result screen's simple, non-zoomable before/after
// comparison. Deliberately its own pair of canvases rather than
// reusing originalCanvas/processedCanvas — those stay dedicated to the
// zoom/pan-capable editing surface in the Edit screen, so this
// celebratory view can't accidentally interfere with (or be confused
// by) that machinery. Crops the original to the working buffer's own
// offset/size first (reusing cropPixelBuffer, already used for Manual
// Crop) purely so the two layers are pixel-aligned and the same size —
// no new pixel logic, just consistent framing for the reveal.
function renderBeforeAfter() {
  if (!state.originalPixelBuffer || !state.workingBuffer) return;
  var beforeCrop = cropPixelBuffer(state.originalPixelBuffer, {
    x: state.workingOffsetX,
    y: state.workingOffsetY,
    width: state.workingBuffer.width,
    height: state.workingBuffer.height
  });
  drawPixelBuffer(els.baCanvasBefore, beforeCrop);
  drawPixelBuffer(els.baCanvasAfter, state.workingBuffer);
  sizeBeforeAfterStage(state.workingBuffer.width, state.workingBuffer.height);
  updateBeforeAfterClip();
}

// Sizes the Result screen's stage to fit within BOTH an available
// width and an available height, preserving the photo's own aspect
// ratio — plain CSS `aspect-ratio` + `max-width` can't do this on its
// own (it clamps height without also shrinking width to match), so a
// tall/portrait photo (very common — a phone photo of a canvas
// standing upright) could grow past the viewport height and force the
// whole page to scroll, exactly as reported. Explicit pixel sizing
// here guarantees the stage is always the largest size that fits with
// zero page scroll, however the photo is shaped.
//
// A fixed fraction of the viewport (e.g. "half the window") was tried
// first and measured wrong: everything else on the Result screen
// (header, New Drawing link, headline, hint text, slider, action
// buttons, page padding) doesn't shrink proportionally to viewport
// height, so on a shorter window that fixed fraction still left the
// page taller than the viewport. This measures that other content's
// *real* height directly instead of guessing it.
function sizeBeforeAfterStage(width, height) {
  var maxWidth = Math.min(560, els.beforeAfter.clientWidth || 560);
  var currentStageHeight = els.beforeAfterStage.getBoundingClientRect().height;
  var otherContentHeight = document.documentElement.scrollHeight - currentStageHeight;
  var availableHeight = window.innerHeight - otherContentHeight - 16; // small safety margin
  var maxHeight = Math.max(160, availableHeight);
  var scale = Math.min(maxWidth / width, maxHeight / height);
  els.beforeAfterStage.style.width = Math.round(width * scale) + 'px';
  els.beforeAfterStage.style.height = Math.round(height * scale) + 'px';
}

function updateBeforeAfterClip() {
  var revealPercent = Number(els.baSlider.value); // 0 (all "before") .. 100 (all "after")
  els.baCanvasAfter.style.clipPath = 'inset(0 ' + (100 - revealPercent) + '% 0 0)';
  els.baCanvasBefore.style.clipPath = 'inset(0 0 0 ' + revealPercent + '%)';
}

// ---- Brush size choices (Small / Medium / Large) -----------------------
//
// The underlying brush-size *value* is still just els.brushSizeSlider —
// completely unchanged, still read by paintAt()/updateBrushCursor()
// above. These three buttons only ever set that hidden slider's value
// and dispatch the same 'input' event a real drag already would, so
// nothing downstream needed to change to support them.
var BRUSH_SIZE_CHOICES = { small: 30, medium: 90, large: 220 };

function initBrushSizeChoices() {
  var buttons = {
    small: els.brushSmallBtn,
    medium: els.brushMediumBtn,
    large: els.brushLargeBtn
  };

  function selectSize(key) {
    // Re-tapping the already-active size is how a child turns the
    // brush off — there was previously no way to leave Remove
    // More/Bring It Back once picked, other than tapping a *different*
    // tool. This only fires when a size is actually active (isPaintTool),
    // so it can never fire from, say, an initial no-tool state.
    if (buttons[key].classList.contains('is-active') && state.activeTool !== 'pan') {
      setActiveTool('pan');
      return;
    }
    els.brushSizeSlider.value = BRUSH_SIZE_CHOICES[key];
    els.brushSizeSlider.dispatchEvent(new Event('input', { bubbles: true }));
    Object.keys(buttons).forEach(function (k) {
      buttons[k].classList.toggle('is-active', k === key);
    });
  }

  Object.keys(buttons).forEach(function (key) {
    buttons[key].addEventListener('click', function () { selectSize(key); });
  });
}

// ---- Picture zoom slider (child-facing) --------------------------------
//
// A single plain slider, standing in for the hidden technical
// +/-/Fit controls (.zoom-controls, see kids.css) — a child can drag
// it directly rather than needing to hit small +/- buttons repeatedly.
// Only ever drives zoomProcessed (the picture actually being edited in
// Edit mode); its value is kept in sync the other direction too via
// handleProcessedZoomChange, so wheel-zoom/fit-to-viewport/the shared
// +/- buttons all keep this slider showing the truth.
function initKidZoomSlider() {
  if (!els.kidZoomSlider) return;
  els.kidZoomSlider.addEventListener('input', function () {
    var percent = Number(els.kidZoomSlider.value);
    if (!percent || percent <= 0) return;
    zoomProcessed.setZoom(percent / 100);
  });
}

// ---- Export --------------------------------------------------------------

function handleDownload() {
  if (!state.workingBuffer) return;
  // Encode straight from the authoritative pixel buffer, not
  // els.processedCanvas.toBlob(). Canvas keeps its bitmap premultiplied
  // internally, and un-premultiplying to export straight RGBA loses
  // colour at any pixel with alpha < 255 (confirmed: fully transparent
  // pixels came back as flat black, and even lightly-feathered edge
  // pixels shifted several channel values) — exactly the RGB
  // corruption the quality contract forbids. state.workingBuffer is
  // only ever alpha-edited (background removal, feathering, the
  // cleanup brush) or rectangularly cropped, so its RGB always
  // matches the original artwork exactly.
  encodePixelBufferToPNG(state.workingBuffer).then(function (blob) {
    var baseName = state.sourceFile ? stripExtension(state.sourceFile.name) : 'artwork';
    downloadBlob(blob, baseName + '-transparent.png');
    showToast('💾 Saved! Great job!');
  }).catch(function () {
    showToast('Oops, that didn’t save. Try again?', true);
  });
}

function resetToUpload() {
  state.sourceFile = null;
  state.originalPixelBuffer = null;
  state.autoProcessedBuffer = null;
  state.workingBuffer = null;
  state.workingOffsetX = 0;
  state.workingOffsetY = 0;
  state.autoOffsetX = 0;
  state.autoOffsetY = 0;
  state.userTolerance = null;
  state.lastMeta = null;
  clearManualEdits();
  els.fileInput.value = '';
  els.workspace.hidden = true;
  els.dropzone.hidden = false;
  els.previewMeta.textContent = '';
  els.performanceNote.textContent = '';

  // Back to the very first screen state for the next picture — magic
  // overlay off, Result screen the default once it's shown again, the
  // before/after slider centred, brush size back to Medium.
  clearInterval(magicMessageTimer);
  clearTimeout(magicMinTimeTimer);
  els.magicOverlay.hidden = true;
  showResultMode();
  els.baSlider.value = 50;
  updateBeforeAfterClip();
  els.brushSizeSlider.value = BRUSH_SIZE_CHOICES.medium;
  [els.brushSmallBtn, els.brushMediumBtn, els.brushLargeBtn].forEach(function (btn) {
    btn.classList.toggle('is-active', btn === els.brushMediumBtn);
  });
}

function showToast(message, isError) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.classList.toggle('is-error', !!isError);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { els.toast.hidden = true; }, 3200);
}
