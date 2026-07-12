// app.js — wires the DOM to the processing pipeline (worker.js).
//
// This file owns UI state only. It never imports backgroundRemoval.js,
// backgroundDetector.js, edgeSmoothing.js, or cropper.js directly —
// it only ever talks to worker.js, which is the one place those are
// composed into a pipeline. That's the boundary that lets the
// strategy behind "process this image" change without app.js caring.

import { drawPixelBuffer, createZoomController } from './js/preview.js';
import { debounce, downloadBlob, formatBytes, formatDimensions, stripExtension } from './js/utils.js';

var els = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  browseBtn: document.getElementById('browseBtn'),
  workspace: document.getElementById('workspace'),

  viewSideBySide: document.getElementById('viewSideBySide'),
  viewToggle: document.getElementById('viewToggle'),
  previewGrid: document.getElementById('previewGrid'),
  originalPane: document.getElementById('originalPane'),
  processedPane: document.getElementById('processedPane'),

  originalCanvas: document.getElementById('originalCanvas'),
  processedCanvas: document.getElementById('processedCanvas'),
  originalViewport: document.getElementById('originalViewport'),
  processedViewport: document.getElementById('processedViewport'),
  originalZoomTarget: document.getElementById('originalZoomTarget'),
  processedZoomTarget: document.getElementById('processedZoomTarget'),

  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),

  toleranceSlider: document.getElementById('toleranceSlider'),
  toleranceValue: document.getElementById('toleranceValue'),
  featherSlider: document.getElementById('featherSlider'),
  featherValue: document.getElementById('featherValue'),
  autoCropToggle: document.getElementById('autoCropToggle'),

  downloadBtn: document.getElementById('downloadBtn'),
  resetBtn: document.getElementById('resetBtn'),

  previewMeta: document.getElementById('previewMeta'),
  previewLoading: document.getElementById('previewLoading'),
  performanceNote: document.getElementById('performanceNote'),
  toast: document.getElementById('toast')
};

var worker = new Worker(new URL('./js/worker.js', import.meta.url), { type: 'module' });
var jobCounter = 0;
var latestJobId = 0;

var state = {
  sourceFile: null,
  originalPixelBuffer: null, // pristine copy, never transferred away
  processedPixelBuffer: null,
  autoDetected: null,        // { color, tolerance } from the first run
  userTolerance: null        // null until the user drags the slider
};

var zoomOriginal = createZoomController(els.originalViewport, els.originalZoomTarget);
var zoomProcessed = createZoomController(els.processedViewport, els.processedZoomTarget);
var zoomLinked = true;

init();

function init() {
  els.browseBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
  els.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  els.fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
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

  els.zoomInBtn.addEventListener('click', function () { adjustZoom(1.25); });
  els.zoomOutBtn.addEventListener('click', function () { adjustZoom(1 / 1.25); });
  els.zoomResetBtn.addEventListener('click', function () {
    zoomOriginal.reset();
    zoomProcessed.reset();
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

  els.downloadBtn.addEventListener('click', handleDownload);
  els.resetBtn.addEventListener('click', resetToUpload);

  worker.onmessage = handleWorkerMessage;
  worker.onerror = function (err) {
    setProcessing(false);
    showToast('Processing failed: ' + err.message, true);
  };
}

function adjustZoom(factor) {
  var current = zoomOriginal.getZoom();
  zoomOriginal.setZoom(current * factor);
  zoomProcessed.setZoom(current * factor);
}

function setViewMode(mode) {
  var isToggle = mode === 'toggle';
  els.previewGrid.classList.toggle('is-toggle-mode', isToggle);
  els.viewSideBySide.classList.toggle('is-active', !isToggle);
  els.viewToggle.classList.toggle('is-active', isToggle);
  els.viewSideBySide.setAttribute('aria-selected', String(!isToggle));
  els.viewToggle.setAttribute('aria-selected', String(isToggle));

  if (isToggle) {
    els.originalPane.hidden = false;
    els.processedPane.hidden = false;
    // Toggle mode starts on the processed image — that's the result
    // people came here for.
    showOnly(els.processedPane);
    els.originalPane.onclick = function () { showOnly(els.originalPane); };
    els.processedPane.onclick = function () { showOnly(els.processedPane); };
  } else {
    els.originalPane.hidden = false;
    els.processedPane.hidden = false;
    els.originalPane.onclick = null;
    els.processedPane.onclick = null;
  }
}

function showOnly(paneToShow) {
  [els.originalPane, els.processedPane].forEach(function (pane) {
    pane.hidden = pane !== paneToShow;
  });
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
    state.autoDetected = null;

    els.dropzone.hidden = true;
    els.workspace.hidden = false;
    drawPixelBuffer(els.originalCanvas, state.originalPixelBuffer);
    zoomOriginal.reset();
    zoomProcessed.reset();
    setViewMode('side-by-side');

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

  state.processedPixelBuffer = msg.pixelBuffer;
  drawPixelBuffer(els.processedCanvas, msg.pixelBuffer);
  setProcessing(false);

  if (state.userTolerance == null) {
    // First run: adopt the auto-detected tolerance as the slider's
    // starting position, per "determine colour tolerance
    // automatically" — the user can still override it from here.
    state.autoDetected = msg.meta;
    els.toleranceSlider.value = msg.meta.tolerance;
    els.toleranceValue.textContent = msg.meta.tolerance;
  }

  updateMeta(msg.meta);
}

function updateMeta(meta) {
  var original = state.originalPixelBuffer;
  var processed = state.processedPixelBuffer;
  var bg = meta.backgroundColor;
  var parts = [
    formatDimensions(original.width, original.height) +
      (meta.cropBounds ? ' → ' + formatDimensions(processed.width, processed.height) + ' (cropped)' : ''),
    'background ≈ rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')'
  ];
  els.previewMeta.textContent = parts.join('  ·  ');
  els.performanceNote.textContent = 'Processed in ' + meta.processingMs + ' ms';
}

function setProcessing(isProcessing) {
  els.previewLoading.hidden = !isProcessing;
  els.downloadBtn.disabled = isProcessing;
}

function handleDownload() {
  if (!els.processedCanvas.width) return;
  els.processedCanvas.toBlob(function (blob) {
    if (!blob) {
      showToast('Could not export the PNG.', true);
      return;
    }
    var baseName = state.sourceFile ? stripExtension(state.sourceFile.name) : 'artwork';
    downloadBlob(blob, baseName + '-transparent.png');
    showToast('Downloaded ' + formatBytes(blob.size) + ' PNG');
  }, 'image/png'); // PNG is always lossless — no quality argument to pass
}

function resetToUpload() {
  state.sourceFile = null;
  state.originalPixelBuffer = null;
  state.processedPixelBuffer = null;
  state.userTolerance = null;
  state.autoDetected = null;
  els.fileInput.value = '';
  els.workspace.hidden = true;
  els.dropzone.hidden = false;
  els.previewMeta.textContent = '';
  els.performanceNote.textContent = '';
}

function showToast(message, isError) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.classList.toggle('is-error', !!isError);
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { els.toast.hidden = true; }, 3200);
}
