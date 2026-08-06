// app.js — UI wiring for the Sheet Extractor tool.
//
// Reads a real image file the user provides (upload or drag-and-drop),
// runs it through extractor.js's validated segmentation pipeline, and
// shows each cutout with a real transparency-checked thumbnail, an
// individual download link, and a "download all" ZIP.
//
// Two modes, and they want genuinely different defaults: Sheet mode is
// looking at objects with real gaps between them, Scan mode is looking at
// pen strokes that need pulling back together. So each mode remembers its
// own Gap Bridging / Min Object Size / Padding rather than carrying one
// mode's tuning into the other.
(function () {
    'use strict';

    var els = {};
    var currentObjectUrl = null;   // object URL of the uploaded source image
    var currentResults = null;     // { sourceWidth, sourceHeight, background, threshold, items }
    var lastPrefix = 'asset';
    var currentCompressLevel = 0;  // index into PngCompressor.LEVELS
    var compressDebounceTimer = null;
    var currentMode = 'sheet';
    var sourceSize = null;         // { w, h } natural size of the loaded image
    var crop = null;               // { x, y, w, h } in SOURCE pixels, or null
    var maskPreviewUrl = null;

    // The three shared sliders that genuinely want different values per mode.
    var MODE_DEFAULTS = {
        sheet: { dilate: 2, minarea: 0.00015, pad: 0.08 },
        scan:  { dilate: 8, minarea: 0.0004,  pad: 0.10 }
    };
    var modeState = {
        sheet: Object.assign({}, MODE_DEFAULTS.sheet),
        scan:  Object.assign({}, MODE_DEFAULTS.scan)
    };

    // A drag shorter than this (in SOURCE pixels) is a click, not a crop.
    var CROP_MIN_SOURCE_PX = 8;

    function $(id) { return document.getElementById(id); }

    function init() {
        els.dropzone = $('se-dropzone');
        els.fileInput = $('se-file-input');
        els.previewRow = $('se-preview-row');
        els.previewImg = $('se-preview-img');
        els.previewMeta = $('se-preview-meta');
        els.extractBtn = $('se-extract-btn');
        els.status = $('se-status');
        els.resultsSection = $('se-results-section');
        els.resultsHeader = $('se-results-count');
        els.resultsGrid = $('se-results-grid');
        els.downloadAllBtn = $('se-download-all-btn');
        els.compressLevel = $('se-compress-level');
        els.compressLevelOut = $('se-compress-level-out');
        els.compressSummary = $('se-compress-summary');

        els.threshold = $('se-threshold');
        els.thresholdOut = $('se-threshold-out');
        els.pad = $('se-pad');
        els.padOut = $('se-pad-out');
        els.minarea = $('se-minarea');
        els.minareaOut = $('se-minarea-out');
        els.dilate = $('se-dilate');
        els.dilateOut = $('se-dilate-out');
        els.prefix = $('se-prefix');
        els.bgMode = $('se-bg-mode');
        els.bgColor = $('se-bg-color');

        els.controlsGrid = $('se-controls-grid');
        els.inkDelta = $('se-inkdelta');
        els.inkDeltaOut = $('se-inkdelta-out');
        els.inkBlur = $('se-inkblur');
        els.inkBlurOut = $('se-inkblur-out');
        els.inkWeight = $('se-inkweight');
        els.inkWeightOut = $('se-inkweight-out');
        els.inkColor = $('se-inkcolor');

        els.previewFrame = $('se-preview-frame');
        els.cropBox = $('se-crop-box');
        els.cropStatus = $('se-crop-status');
        els.cropClear = $('se-crop-clear');
        els.maskRow = $('se-mask-row');
        els.maskImg = $('se-mask-img');

        wireDropzone();
        wireSliders();
        wireModeSelector();
        wireCrop();
        els.extractBtn.addEventListener('click', runExtraction);
        els.downloadAllBtn.addEventListener('click', downloadAllAsZip);
        els.bgMode.addEventListener('change', function () {
            els.bgColor.disabled = els.bgMode.value !== 'manual';
        });

        // Compression slider is the source of truth for its own range --
        // PngCompressor.LEVELS is the real level table, never hardcoded here.
        els.compressLevel.max = String(PngCompressor.LEVELS.length - 1);
        updateCompressLevelLabel();
        els.compressLevel.addEventListener('input', function () {
            updateCompressLevelLabel();
            // Debounced so dragging the slider doesn't re-quantize every
            // item on every intermediate value -- only the value it settles
            // on for a beat actually gets recomputed.
            if (compressDebounceTimer) clearTimeout(compressDebounceTimer);
            compressDebounceTimer = setTimeout(function () {
                applyCompression(parseInt(els.compressLevel.value, 10));
            }, 150);
        });
    }

    function updateCompressLevelLabel() {
        var level = PngCompressor.LEVELS[parseInt(els.compressLevel.value, 10)];
        els.compressLevelOut.textContent = level.label;
    }

    function wireDropzone() {
        els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
        els.fileInput.addEventListener('change', function () {
            if (els.fileInput.files && els.fileInput.files[0]) loadFile(els.fileInput.files[0]);
        });
        ['dragenter', 'dragover'].forEach(function (evt) {
            els.dropzone.addEventListener(evt, function (e) {
                e.preventDefault();
                els.dropzone.classList.add('se-dropzone-active');
            });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
            els.dropzone.addEventListener(evt, function (e) {
                e.preventDefault();
                els.dropzone.classList.remove('se-dropzone-active');
            });
        });
        els.dropzone.addEventListener('drop', function (e) {
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) loadFile(file);
        });
    }

    function wireSliders() {
        bindSlider(els.threshold, els.thresholdOut, function (v) { return v; });
        bindSlider(els.pad, els.padOut, function (v) { return Math.round(v * 100) + '%'; });
        bindSlider(els.minarea, els.minareaOut, function (v) { return (v * 100).toFixed(3) + '%'; });
        bindSlider(els.dilate, els.dilateOut, function (v) { return v; });
        bindSlider(els.inkDelta, els.inkDeltaOut, function (v) { return v; });
        bindSlider(els.inkBlur, els.inkBlurOut, function (v) { return Math.round(v * 100) + '%'; });
        bindSlider(els.inkWeight, els.inkWeightOut, function (v) { return v; });
    }

    function bindSlider(input, output, formatter) {
        function update() { output.textContent = formatter(parseFloat(input.value)); }
        input.addEventListener('input', update);
        update();
    }

    // --- Mode ------------------------------------------------------------

    function wireModeSelector() {
        var radios = document.querySelectorAll('input[name="se-mode"]');
        Array.prototype.forEach.call(radios, function (radio) {
            radio.addEventListener('change', function () {
                if (!radio.checked) return;
                switchMode(radio.value);
            });
        });
        applyModeState(currentMode);
    }

    // Saves whatever the outgoing mode was last set to, then restores the
    // incoming mode's own remembered values. The CSS does the showing and
    // hiding off `data-mode`, so this only has to move numbers.
    function switchMode(next) {
        if (next === currentMode) return;
        rememberModeState(currentMode);
        currentMode = next;
        els.controlsGrid.setAttribute('data-mode', next);
        applyModeState(next);
    }

    function rememberModeState(mode) {
        var s = modeState[mode];
        if (!s) return;
        s.dilate = parseInt(els.dilate.value, 10);
        s.minarea = parseFloat(els.minarea.value);
        s.pad = parseFloat(els.pad.value);
    }

    function applyModeState(mode) {
        var s = modeState[mode];
        if (!s) return;
        els.dilate.value = String(s.dilate);
        els.minarea.value = String(s.minarea);
        els.pad.value = String(s.pad);
        // The outputs are bound to 'input', which a programmatic value set
        // does not fire -- so nudge each one directly.
        els.dilate.dispatchEvent(new Event('input'));
        els.minarea.dispatchEvent(new Event('input'));
        els.pad.dispatchEvent(new Event('input'));
    }

    // --- Crop ------------------------------------------------------------

    // Maps a pointer event to the source image's own pixel space. The
    // preview <img> is laid out to fit its frame, so the display-to-source
    // ratio is whatever the browser actually settled on -- read live rather
    // than assumed, since it changes with the window.
    function eventToSource(e) {
        var rect = els.previewImg.getBoundingClientRect();
        if (!rect.width || !rect.height || !sourceSize) return null;
        var sx = sourceSize.w / rect.width;
        var sy = sourceSize.h / rect.height;
        var x = (e.clientX - rect.left) * sx;
        var y = (e.clientY - rect.top) * sy;
        return {
            x: Math.max(0, Math.min(sourceSize.w, x)),
            y: Math.max(0, Math.min(sourceSize.h, y))
        };
    }

    function wireCrop() {
        var dragStart = null;

        els.previewFrame.addEventListener('pointerdown', function (e) {
            if (!sourceSize) return;
            e.preventDefault();
            dragStart = eventToSource(e);
            if (!dragStart) return;
            try { els.previewFrame.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety, not a requirement */ }
        });

        els.previewFrame.addEventListener('pointermove', function (e) {
            if (!dragStart) return;
            var now = eventToSource(e);
            if (!now) return;
            drawCropBox(rectFrom(dragStart, now));
        });

        function finish(e) {
            if (!dragStart) return;
            var now = eventToSource(e) || dragStart;
            var r = rectFrom(dragStart, now);
            dragStart = null;
            // A tap (or a drag so small it was almost certainly a tap)
            // clears the crop rather than setting a useless sliver.
            if (r.w < CROP_MIN_SOURCE_PX || r.h < CROP_MIN_SOURCE_PX) {
                setCrop(null);
                return;
            }
            setCrop(r);
        }
        els.previewFrame.addEventListener('pointerup', finish);
        els.previewFrame.addEventListener('pointercancel', finish);
        els.previewFrame.addEventListener('lostpointercapture', finish);

        els.cropClear.addEventListener('click', function () { setCrop(null); });
    }

    function rectFrom(a, b) {
        var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        return {
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(Math.abs(b.x - a.x)),
            h: Math.round(Math.abs(b.y - a.y))
        };
    }

    function setCrop(r) {
        crop = r;
        drawCropBox(r);
        if (r) {
            els.cropStatus.textContent = 'Using ' + r.w + ' × ' + r.h + 'px of the picture.';
            els.cropClear.hidden = false;
        } else {
            els.cropStatus.textContent = 'Drag on the picture to use only part of it.';
            els.cropClear.hidden = true;
        }
    }

    // Positions the overlay in the DISPLAYED image's own coordinates, which
    // is why it is drawn from the source rect rather than from the raw
    // pointer positions -- the two agree, and only one of them survives a
    // window resize.
    function drawCropBox(r) {
        if (!r || !sourceSize) { els.cropBox.hidden = true; return; }
        var imgRect = els.previewImg.getBoundingClientRect();
        var frameRect = els.previewFrame.getBoundingClientRect();
        var kx = imgRect.width / sourceSize.w;
        var ky = imgRect.height / sourceSize.h;
        var offX = imgRect.left - frameRect.left;
        var offY = imgRect.top - frameRect.top;
        els.cropBox.style.left = (offX + r.x * kx) + 'px';
        els.cropBox.style.top = (offY + r.y * ky) + 'px';
        els.cropBox.style.width = (r.w * kx) + 'px';
        els.cropBox.style.height = (r.h * ky) + 'px';
        els.cropBox.hidden = false;
    }

    function loadFile(file) {
        if (!/^image\//.test(file.type)) {
            showStatus('That file is not an image — please choose a PNG, JPEG, or similar image file.', true);
            return;
        }
        if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = URL.createObjectURL(file);
        lastPrefix = (file.name || 'asset').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase() || 'asset';
        els.prefix.value = lastPrefix;

        var img = new Image();
        img.onload = function () {
            sourceSize = { w: img.naturalWidth, h: img.naturalHeight };
            setCrop(null);
            els.previewImg.src = currentObjectUrl;
            els.previewRow.hidden = false;
            els.previewMeta.innerHTML =
                '<dt>File</dt><dd>' + escapeHtml(file.name) + '</dd>' +
                '<dt>Size</dt><dd>' + img.naturalWidth + ' × ' + img.naturalHeight + 'px, ' + formatBytes(file.size) + '</dd>';
            els.extractBtn.disabled = false;
            clearResults();
            showStatus('Loaded. Adjust the options below if needed, then click Extract.', false);
        };
        img.onerror = function () {
            showStatus('Could not read that image file — it may be corrupted or an unsupported format.', true);
        };
        img.src = currentObjectUrl;
    }

    function runExtraction() {
        if (!currentObjectUrl) return;
        els.extractBtn.disabled = true;
        showStatus('Extracting…', false, true);
        clearResults();

        var opts = {
            mode: currentMode,
            threshold: parseFloat(els.threshold.value),
            padFrac: parseFloat(els.pad.value),
            minAreaFrac: parseFloat(els.minarea.value),
            dilateRadius: parseInt(els.dilate.value, 10)
        };
        if (crop) opts.crop = crop;
        if (currentMode === 'scan') {
            opts.inkDelta = parseFloat(els.inkDelta.value);
            opts.inkBlurFrac = parseFloat(els.inkBlur.value);
            opts.inkWeight = parseInt(els.inkWeight.value, 10);
            opts.inkColor = hexToRgb(els.inkColor.value) || [0, 0, 0];
            opts.wantMaskPreview = true;
        } else if (els.bgMode.value === 'manual') {
            opts.bg = hexToRgb(els.bgColor.value);
        }

        extractSheet(currentObjectUrl, opts).then(function (result) {
            currentResults = result;
            els.extractBtn.disabled = false;
            if (!result.items.length) {
                showStatus(
                    currentMode === 'scan'
                        ? 'Nothing was traced. Try lowering Ink Sensitivity, or raising Ink Weight if the drawing is faint.'
                        : 'No objects were found. Try lowering the Color Threshold, or check that the background is reasonably clean/uniform.',
                    true
                );
                // Finding nothing is exactly when seeing what WAS traced
                // matters most, so the mask panel still opens.
                els.resultsHeader.textContent = 'nothing found';
                showMaskPreview(result.maskPreviewUrl);
                return;
            }
            var skipped = result.componentCountBeforeFilter - result.items.length;
            showStatus(
                'Found ' + result.items.length + ' object' + (result.items.length === 1 ? '' : 's') +
                (skipped > 0 ? ' (' + skipped + ' smaller region' + (skipped === 1 ? '' : 's') + ' discarded as noise)' : '') + '.',
                false
            );
            renderResults(result);
        }).catch(function (err) {
            els.extractBtn.disabled = false;
            showStatus('Extraction failed: ' + (err && err.message ? err.message : String(err)), true);
        });
    }

    // Shows the traced-ink mask (scan mode only -- sheet mode passes no
    // preview, so this hides the panel). Opens the results section itself,
    // because "nothing was found" is exactly when this is worth seeing.
    function showMaskPreview(url) {
        if (maskPreviewUrl) { URL.revokeObjectURL(maskPreviewUrl); maskPreviewUrl = null; }
        if (!url) { els.maskRow.hidden = true; els.maskImg.removeAttribute('src'); return; }
        maskPreviewUrl = url;
        els.maskImg.src = url;
        els.maskRow.hidden = false;
        els.resultsSection.hidden = false;
    }

    function renderResults(result) {
        var prefix = (els.prefix.value || 'asset').trim() || 'asset';
        showMaskPreview(result.maskPreviewUrl);
        els.resultsGrid.innerHTML = '';
        result.items.forEach(function (item) {
            var name = prefix + '-' + String(item.index + 1).padStart(3, '0') + '.png';
            item.fileName = name; // stash for the zip step
            item.activeBlob = item.blob;
            item._activeUrl = item.objectUrl;

            var card = document.createElement('div');
            card.className = 'se-result-card';

            var thumb = document.createElement('div');
            thumb.className = 'se-result-thumb';
            var img = document.createElement('img');
            img.src = item.objectUrl;
            img.alt = name;
            thumb.appendChild(img);
            card.appendChild(thumb);

            var info = document.createElement('div');
            info.className = 'se-result-info';
            var nameEl = document.createElement('div');
            nameEl.className = 'se-result-name';
            nameEl.textContent = name;
            var dimsEl = document.createElement('div');
            dimsEl.className = 'se-result-dims';
            dimsEl.textContent = item.bboxPadded.w + '×' + item.bboxPadded.h + 'px · ' + item.pixelCount.toLocaleString() + 'px object';
            var sizeEl = document.createElement('div');
            sizeEl.className = 'se-result-size';
            sizeEl.textContent = 'Original: ' + formatBytes(item.blob.size);
            var dl = document.createElement('a');
            dl.className = 'se-result-download';
            dl.href = item.objectUrl;
            dl.download = name;
            dl.textContent = '⬇ Download PNG';
            info.appendChild(nameEl);
            info.appendChild(dimsEl);
            info.appendChild(sizeEl);
            info.appendChild(dl);
            card.appendChild(info);

            item._els = { thumbImg: img, sizeEl: sizeEl, dl: dl };
            els.resultsGrid.appendChild(card);
        });

        els.resultsHeader.textContent = result.items.length + ' asset' + (result.items.length === 1 ? '' : 's');
        els.resultsSection.hidden = false;

        // Re-apply whatever compression level is currently selected (rather
        // than always resetting to Lossless) so a second extraction keeps
        // showing sizes at the level the user already chose.
        applyCompression(currentCompressLevel);
    }

    // Swaps an item's "currently downloaded/shown" blob to `blob`. When
    // `blob` is the item's own original lossless blob (level 0, or a
    // fallback), reuses the original object URL instead of minting a new
    // one -- avoids churn and keeps `item.objectUrl` itself always valid.
    function setItemActiveBlob(item, blob) {
        if (blob === item.blob) {
            if (item._activeUrl && item._activeUrl !== item.objectUrl) URL.revokeObjectURL(item._activeUrl);
            item._activeUrl = item.objectUrl;
            item.activeBlob = item.blob;
            return;
        }
        var oldUrl = item._activeUrl;
        item._activeUrl = URL.createObjectURL(blob);
        item.activeBlob = blob;
        if (oldUrl && oldUrl !== item.objectUrl) URL.revokeObjectURL(oldUrl);
    }

    function describeItemCompression(item, result) {
        var originalSize = item.blob.size;
        if (result.level.maxColors === null) {
            return 'Original: ' + formatBytes(originalSize);
        }
        if (result.fellBack) {
            return 'Original: ' + formatBytes(originalSize) +
                ' <span class="se-lossless-note">— kept lossless; a ' + result.colorCount + '-color version came out bigger, not smaller</span>';
        }
        var activeSize = result.blob.size;
        var pct = originalSize > 0 ? Math.round((1 - activeSize / originalSize) * 100) : 0;
        var qualityNote = result.exact
            ? (result.colorCount + ' colors — still lossless, just a smaller file)')
            : (result.colorCount + ' colors)');
        return 'Original: ' + formatBytes(originalSize) + ' → ' + formatBytes(activeSize) +
            ' <span class="se-savings">' + (pct >= 0 ? '-' + pct + '%' : '+' + Math.abs(pct) + '%') + '</span> (' + qualityNote;
    }

    function updateCompressSummary(results) {
        if (!results.length) { els.compressSummary.textContent = ''; return; }
        var totalOriginal = 0, totalActive = 0;
        results.forEach(function (result, i) {
            totalOriginal += currentResults.items[i].blob.size;
            totalActive += result.blob.size;
        });
        if (currentCompressLevel === 0 || totalActive >= totalOriginal) {
            els.compressSummary.innerHTML = 'Total: ' + formatBytes(totalOriginal);
            return;
        }
        var pct = Math.round((1 - totalActive / totalOriginal) * 100);
        els.compressSummary.innerHTML = 'Total: ' + formatBytes(totalActive) +
            ' <span class="se-savings">(' + pct + '% smaller)</span> · was ' + formatBytes(totalOriginal);
    }

    // Re-quantizes every current item at `level` (an index into
    // PngCompressor.LEVELS) and live-updates each card's thumbnail, download
    // link, and size line, plus the aggregate summary line.
    function applyCompression(level) {
        currentCompressLevel = level;
        if (!currentResults || !currentResults.items.length) return;
        els.compressSummary.classList.add('se-compress-busy');
        Promise.all(currentResults.items.map(function (item) {
            return PngCompressor.compress(item.pixelBuffer, level, item.blob).then(function (result) {
                setItemActiveBlob(item, result.blob);
                if (item._els) {
                    item._els.thumbImg.src = item._activeUrl;
                    item._els.dl.href = item._activeUrl;
                    item._els.sizeEl.innerHTML = describeItemCompression(item, result);
                }
                return result;
            });
        })).then(function (results) {
            updateCompressSummary(results);
        }).finally(function () {
            els.compressSummary.classList.remove('se-compress-busy');
        });
    }

    function clearResults() {
        if (currentResults) {
            currentResults.items.forEach(function (item) {
                if (item._activeUrl && item._activeUrl !== item.objectUrl) URL.revokeObjectURL(item._activeUrl);
                if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
            });
        }
        currentResults = null;
        els.resultsGrid.innerHTML = '';
        els.resultsSection.hidden = true;
        els.compressSummary.textContent = '';
        showMaskPreview(null);
    }

    function downloadAllAsZip() {
        if (!currentResults || !currentResults.items.length) return;
        els.downloadAllBtn.disabled = true;
        els.downloadAllBtn.textContent = 'Building ZIP…';

        Promise.all(currentResults.items.map(function (item) {
            return (item.activeBlob || item.blob).arrayBuffer().then(function (buf) {
                return { name: item.fileName, bytes: new Uint8Array(buf) };
            });
        })).then(function (entries) {
            var zipBlob = ZipWriter.build(entries);
            var url = URL.createObjectURL(zipBlob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (els.prefix.value || 'assets').trim() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        }).finally(function () {
            els.downloadAllBtn.disabled = false;
            els.downloadAllBtn.textContent = '⬇ Download All as ZIP';
        });
    }

    function showStatus(msg, isError, isBusy) {
        els.status.textContent = msg;
        els.status.className = 'se-status' + (isError ? ' se-status-error' : '') + (isBusy ? ' se-status-busy' : '');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function formatBytes(n) {
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function hexToRgb(hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
        if (!m) return null;
        return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    }

    document.addEventListener('DOMContentLoaded', init);
})();
