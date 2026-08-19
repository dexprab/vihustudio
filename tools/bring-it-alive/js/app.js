/* APP — UI state and wiring. All pixel truth lives in the modules; this
 * file moves the child through the four marks (Photograph → Claim → We
 * Found This → Make It Yours) and never touches an exported byte itself.
 *
 * window.__bia is the developer seam: the suite (test/run-tests.js) and a
 * human in devtools read pipeline state through it. It is instrumentation
 * in the same sense as the developer strip — deliberately exposed, never
 * required by the flow.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    photo: null, claim: null, seg: null, asset: null, creation: null,
    marks: [], mode: 'keep', lastExport: null, exports: [],
    displayScale: 1, testCaseId: null
  };
  window.__bia = state;

  // ---- developer honesty channel -----------------------------------------
  function log(msg) {
    console.log('[bia] ' + msg);
    const el = $('devLog');
    el.textContent += msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
  function fail(err) {
    console.error('[bia]', err);
    const el = $('devError');
    el.style.display = 'block';
    el.textContent = 'DEVELOPER: ' + (err && err.message ? err.message : String(err));
  }

  // ---- steps -------------------------------------------------------------
  function go(step) {
    for (const s of document.querySelectorAll('.step')) s.classList.remove('here');
    $(step).classList.add('here');
  }

  // ---- display geometry --------------------------------------------------
  // One display scale for both interactive canvases. The photograph is
  // worked on at full resolution; only its picture on screen is scaled.
  const MAXW = 860, MAXH = 620;
  function setupCanvas(canvas) {
    const s = Math.min(MAXW / state.photo.width, MAXH / state.photo.height, 1);
    state.displayScale = s;
    canvas.width = Math.round(state.photo.width * s);
    canvas.height = Math.round(state.photo.height * s);
    return canvas.getContext('2d');
  }
  function toImage(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    return [
      (ev.clientX - r.left) * (canvas.width / r.width) / state.displayScale,
      (ev.clientY - r.top) * (canvas.height / r.height) / state.displayScale
    ];
  }

  // ---- capture -----------------------------------------------------------
  async function loadPhoto(source, testCaseId) {
    try {
      state.photo = await BIACapture.capture(source);
      state.testCaseId = testCaseId || null;
      state.claim = null; state.seg = null; state.asset = null;
      state.creation = null; state.marks = [];
      log('capture: ' + state.photo.filename + ' ' +
          state.photo.width + 'x' + state.photo.height +
          (testCaseId ? ' (' + testCaseId + ')' : ''));
      for (const n of state.photo.notes || []) log(n);
      drawClaimBase();
      go('stepClaim');
    } catch (e) { fail(e); }
  }

  $('pickBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) loadPhoto(e.target.files[0]);
    e.target.value = '';
  });
  $('testBtn').addEventListener('click', () =>
    loadPhoto('test/surrogate-001.png', 'surrogate-001'));
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('over');
    if (e.dataTransfer.files[0]) loadPhoto(e.dataTransfer.files[0]);
  });

  // ---- claim -------------------------------------------------------------
  let loop = [];        // image-space points of the loop being drawn
  let looping = false;

  function drawClaimBase() {
    const c = $('claimCanvas');
    const ctx = setupCanvas(c);
    ctx.drawImage(state.photo.canvas, 0, 0, c.width, c.height);
    if (loop.length > 1) {
      ctx.strokeStyle = '#dfb169'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      const s = state.displayScale;
      ctx.moveTo(loop[0][0] * s, loop[0][1] * s);
      for (const p of loop) ctx.lineTo(p[0] * s, p[1] * s);
      ctx.stroke();
    }
  }

  const claimCanvas = $('claimCanvas');
  claimCanvas.addEventListener('pointerdown', (e) => {
    looping = true; loop = [toImage(claimCanvas, e)];
    claimCanvas.setPointerCapture(e.pointerId);
    $('nothingFound').style.display = 'none';
  });
  claimCanvas.addEventListener('pointermove', (e) => {
    if (!looping) return;
    loop.push(toImage(claimCanvas, e));
    drawClaimBase();
  });
  claimCanvas.addEventListener('pointerup', () => {
    if (!looping) return;
    looping = false;
    closeClaim();
  });

  function closeClaim() {
    try {
      const cl = BIAClaim.claim(loop, state.photo.width, state.photo.height);
      loop = [];
      if (!cl) {
        drawClaimBase();
        quiet('That loop was too small to hold a drawing — try circling the whole thing.');
        log('claim: degenerate loop rejected');
        return;
      }
      state.claim = cl;
      log('claim: ' + cl.points.length + ' points, area ' + cl.area + ' px');
      const t0 = performance.now();
      state.seg = BIASegment.segment(state.photo, cl);
      state.marks = [];
      log('segment: ' + state.seg.compCount + ' ink components, mask ' +
          state.seg.maskCount + ' px (' + Math.round(performance.now() - t0) + 'ms)');
      if (state.seg.maskCount < 30) {
        // FOUND NOTHING is a first-class honest outcome — never an empty
        // asset dressed as success.
        state.seg = null; state.claim = null;
        drawClaimBase();
        quiet('We looked inside your loop and couldn’t find a drawing there. ' +
              'Try circling closer around your drawing.');
        log('segment: NOTHING FOUND inside claim — no asset will be produced');
        return;
      }
      drawRefine();
      go('stepRefine');
    } catch (e) { fail(e); }
  }

  function quiet(msg) {
    const el = $('nothingFound');
    el.textContent = msg;
    el.style.display = 'block';
  }

  $('claimNewPhoto').addEventListener('click', () => { loop = []; go('stepCapture'); });

  // ---- refine ------------------------------------------------------------
  // The proposal, live: masked pixels in full colour on white; the rest of
  // the photograph ghosted, so "what comes with me" is unmistakable.
  function drawRefine() {
    const c = $('refineCanvas');
    const ctx = setupCanvas(c);
    const w = c.width, h = c.height;
    const seg = state.seg;
    const out = ctx.createImageData(w, h);
    const src = state.photo.imageData.data;
    const iw = state.photo.width, ih = state.photo.height;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(ih - 1, Math.round(y / state.displayScale));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(iw - 1, Math.round(x / state.displayScale));
        const si = (sy * iw + sx), s4 = si * 4, d4 = (y * w + x) * 4;
        if (seg.mask[si]) {
          out.data[d4] = src[s4]; out.data[d4 + 1] = src[s4 + 1]; out.data[d4 + 2] = src[s4 + 2];
        } else {
          // ghost: darkened, desaturated original
          const g = (src[s4] * 77 + src[s4 + 1] * 150 + src[s4 + 2] * 29) >> 8;
          out.data[d4] = out.data[d4 + 1] = (g * 0.25 + 20) | 0;
          out.data[d4 + 2] = (g * 0.25 + 34) | 0;
        }
        out.data[d4 + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function setMode(mode) {
    state.mode = mode;
    $('keepBtn').classList.toggle('on', mode === 'keep');
    $('removeBtn').classList.toggle('on', mode === 'remove');
  }
  $('keepBtn').addEventListener('click', () => setMode('keep'));
  $('removeBtn').addEventListener('click', () => setMode('remove'));

  const refineCanvas = $('refineCanvas');
  let stroke = null;
  function brushRadius() {
    // ~12 on-screen pixels of brush, expressed in image pixels — a finger-
    // sized correction whatever the photograph's resolution.
    return Math.max(10, Math.round(12 / state.displayScale));
  }
  refineCanvas.addEventListener('pointerdown', (e) => {
    stroke = { type: state.mode, points: [toImage(refineCanvas, e)],
               radius: brushRadius(), t: Date.now() };
    refineCanvas.setPointerCapture(e.pointerId);
  });
  refineCanvas.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    stroke.points.push(toImage(refineCanvas, e));
    // live stroke feedback only — the mask updates on release
    const ctx = refineCanvas.getContext('2d');
    ctx.strokeStyle = stroke.type === 'keep' ? 'rgba(143,199,164,.8)' : 'rgba(226,145,122,.8)';
    ctx.lineWidth = brushRadius() * 2 * state.displayScale;
    ctx.lineCap = 'round';
    const n = stroke.points.length, s = state.displayScale;
    if (n >= 2) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[n - 2][0] * s, stroke.points[n - 2][1] * s);
      ctx.lineTo(stroke.points[n - 1][0] * s, stroke.points[n - 1][1] * s);
      ctx.stroke();
    }
  });
  refineCanvas.addEventListener('pointerup', () => {
    if (!stroke) return;
    try {
      const before = state.seg.maskCount;
      BIARefine.applyMark(state.seg, stroke);
      state.marks.push(stroke);
      log('refine: ' + stroke.type + ' stroke, mask ' + before + ' → ' + state.seg.maskCount + ' px');
      stroke = null;
      drawRefine();
    } catch (e) { fail(e); }
  });

  $('reclaimBtn').addEventListener('click', () => {
    state.claim = null; state.seg = null; state.marks = [];
    drawClaimBase(); go('stepClaim');
  });

  // ---- make it yours -------------------------------------------------------
  // The developer strip's layer stack: original / paint / erase-mask, and
  // the op history count. Refreshed on every edit through the editor's
  // onChange — the strip is a window on the creation, never a copy of it.
  function updateLayerStrip() {
    const c = state.creation;
    if (!c) return;
    const w = c.original.width, h = c.original.height;
    const oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    oc.getContext('2d').putImageData(c.original, 0, 0);
    BIAPreview.layer($('devLayerOriginal'), oc);
    BIAPreview.layer($('devLayerPaint'), c.paintCanvas);
    BIAPreview.plane($('devLayerErase'), c.eraseMask, w, h);
    let hidden = 0;
    for (let i = 0; i < c.eraseMask.length; i++) if (c.eraseMask[i]) hidden++;
    $('devOps').textContent =
      'layers: original ' + w + '×' + h + ' (never written) · paint (ops) · erase mask ' +
      hidden + ' px hidden, 0 destroyed · history ' + c.cursor + '/' + c.ops.length +
      ' ops · transform x' + c.transform.x + ' y' + c.transform.y +
      ' scale ' + c.transform.scale.toFixed(2) + ' rot ' + c.transform.rotation + '°';
  }

  function openCreation(creation, viaExtraction) {
    state.creation = creation;
    BIAEditor.mount($('editCanvas'), creation, updateLayerStrip);
    // A creation reopened from JSON has no photograph or claim behind it,
    // so "Make another claim" has nowhere honest to go.
    $('anotherBtn').style.display = viaExtraction ? '' : 'none';
    updateLayerStrip();
    go('stepAlive');
  }

  $('aliveBtn').addEventListener('click', async () => {
    try {
      const asset = BIAExtract.extract(state.photo, state.seg.mask,
        BIASegment.skirt(state.seg));
      if (!asset) {
        go('stepClaim'); drawClaimBase();
        quiet('There isn’t enough drawing left in the claim to bring alive.');
        log('extract: NOTHING FOUND — mask too small, no asset produced');
        return;
      }
      state.asset = asset;
      // The baseline export still runs here — not to be downloaded, but
      // because its verification walk is the loud preservation check, and
      // it must fire BEFORE the child is told the drawing is theirs.
      const exp = await BIAExportAsset.exportAsset(asset, {
        filename: state.photo.filename,
        testCaseId: state.testCaseId,
        claimPoints: state.claim.points
      });
      state.lastExport = exp;
      state.exports.push(exp);
      log('alive: asset ' + asset.crop.w + 'x' + asset.crop.h + ' @(' +
          asset.crop.x + ',' + asset.crop.y + '), ' + exp.verified +
          ' opaque px verified byte-identical, PNG ' + exp.blob.size + ' bytes');

      const creation = BIACreation.create(
        { imageData: asset.imageData, crop: asset.crop, maskPixels: asset.maskLocal },
        { source: { filename: state.photo.filename,
                    width: state.photo.width, height: state.photo.height } });
      log('creation: layered document — original ' + asset.crop.w + '×' + asset.crop.h +
          ' + edits + transform');

      BIAPreview.devCompare($('devOrig'), $('devAsset'), state.photo, asset);
      BIAPreview.maskView($('devMask'), state.seg);
      $('devStats').textContent =
        'crop ' + asset.crop.w + '×' + asset.crop.h + ' at (' + asset.crop.x + ',' + asset.crop.y +
        ') · mask ' + asset.maskPixels + ' px · ' + asset.opaquePixels +
        ' opaque px, every one byte-identical to the photograph · baseline PNG ' +
        exp.blob.size + ' bytes at source resolution';
      openCreation(creation, true);
    } catch (e) { fail(e); }
  });

  // ---- the toolbar ----------------------------------------------------------
  function setTool(tool) {
    BIAEditor.setTool(tool);
    for (const [id, t] of [['toolPaint', 'paint'], ['toolErase', 'erase'], ['toolMove', 'move']]) {
      $(id).classList.toggle('on', t === tool);
    }
  }
  $('toolPaint').addEventListener('click', () => setTool('paint'));
  $('toolErase').addEventListener('click', () => setTool('erase'));
  $('toolMove').addEventListener('click', () => setTool('move'));
  for (const b of document.querySelectorAll('.swatch')) {
    b.addEventListener('click', () => {
      BIAEditor.setColor(b.dataset.color);
      for (const o of document.querySelectorAll('.swatch')) o.classList.toggle('on', o === b);
      setTool('paint'); // choosing a colour means "I want to paint"
    });
  }
  for (const b of document.querySelectorAll('.brush')) {
    b.addEventListener('click', () => {
      BIAEditor.setBrush(Number(b.dataset.size));
      for (const o of document.querySelectorAll('.brush')) o.classList.toggle('on', o === b);
    });
  }
  $('undoBtn').addEventListener('click', () => BIAEditor.undo());
  $('redoBtn').addEventListener('click', () => BIAEditor.redo());
  $('biggerBtn').addEventListener('click', () => BIAEditor.scaleBy(1.15));
  $('smallerBtn').addEventListener('click', () => BIAEditor.scaleBy(1 / 1.15));
  $('rotLBtn').addEventListener('click', () => BIAEditor.rotateBy(-15));
  $('rotRBtn').addEventListener('click', () => BIAEditor.rotateBy(15));

  // ---- downloads -------------------------------------------------------------
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const stem = () => ((state.creation && state.creation.source && state.creation.source.filename) ||
    (state.photo && state.photo.filename) || 'drawing').replace(/\.[^.]+$/, '');
  // Download PNG is a RENDER of the current view — original + edits +
  // transform, over transparency. The canonical creation is the JSON.
  $('downloadBtn').addEventListener('click', () => {
    const r = state.creation.render();
    r.canvas.toBlob((b) => {
      if (!b) { fail(new Error('render: toBlob returned null')); return; }
      download(stem() + '-yours.png', b);
    }, 'image/png');
  });
  $('downloadCreationBtn').addEventListener('click', () =>
    download(stem() + '.vihu-creation.json',
      new Blob([state.creation.toJSONString()], { type: 'application/json' })));

  // ---- reopening a creation ---------------------------------------------------
  $('openCreationBtn').addEventListener('click', () => $('creationInput').click());
  $('creationInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const creation = await BIACreation.fromJSON(await file.text());
      log('creation: reopened ' + file.name + ' — ' + creation.cursor + '/' +
          creation.ops.length + ' ops, crop ' + creation.crop.w + '×' + creation.crop.h);
      openCreation(creation, false);
    } catch (err) { fail(err); }
  });

  $('anotherBtn').addEventListener('click', () => {
    state.claim = null; state.seg = null; state.asset = null;
    state.creation = null; state.marks = [];
    drawClaimBase(); go('stepClaim');
  });
  $('aliveNewPhoto').addEventListener('click', () => go('stepCapture'));

  // Loud by default: anything uncaught lands in the developer banner.
  window.addEventListener('error', (e) => fail(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => fail(e.reason));

  log('bring-it-alive v0.2 ready');
})();
