/* APP — UI state and wiring. All pixel truth lives in the modules; this
 * file moves the child through the four marks (Capture → Claim → Refine →
 * Bring It Alive) and never touches an exported byte itself.
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
    photo: null, claim: null, seg: null, asset: null,
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
      state.claim = null; state.seg = null; state.asset = null; state.marks = [];
      log('capture: ' + state.photo.filename + ' ' +
          state.photo.width + 'x' + state.photo.height +
          (testCaseId ? ' (' + testCaseId + ')' : ''));
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

  // ---- bring it alive ----------------------------------------------------
  $('aliveBtn').addEventListener('click', async () => {
    try {
      const asset = BIAExtract.extract(state.photo, state.seg.mask);
      if (!asset) {
        go('stepClaim'); drawClaimBase();
        quiet('There isn’t enough drawing left in the claim to bring alive.');
        log('extract: NOTHING FOUND — mask too small, no asset produced');
        return;
      }
      state.asset = asset;
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

      BIAPreview.checkerboard($('checkerCanvas'), asset);
      BIAPreview.nightSky($('skyCanvas'), asset);
      BIAPreview.devCompare($('devOrig'), $('devAsset'), state.photo, asset);
      BIAPreview.maskView($('devMask'), state.seg);
      $('devStats').textContent =
        'crop ' + asset.crop.w + '×' + asset.crop.h + ' at (' + asset.crop.x + ',' + asset.crop.y +
        ') · mask ' + asset.maskPixels + ' px · ' + asset.opaquePixels +
        ' opaque px, every one byte-identical to the photograph · PNG ' +
        exp.blob.size + ' bytes at source resolution';
      go('stepAlive');
    } catch (e) { fail(e); }
  });

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const stem = () => (state.photo.filename || 'drawing').replace(/\.[^.]+$/, '');
  $('downloadBtn').addEventListener('click', () =>
    download(stem() + '-alive.png', state.lastExport.blob));
  $('downloadJsonBtn').addEventListener('click', () =>
    download(stem() + '-alive.json',
      new Blob([JSON.stringify(state.lastExport.sidecar, null, 2)], { type: 'application/json' })));

  $('anotherBtn').addEventListener('click', () => {
    state.claim = null; state.seg = null; state.asset = null; state.marks = [];
    drawClaimBase(); go('stepClaim');
  });
  $('aliveNewPhoto').addEventListener('click', () => go('stepCapture'));

  // Loud by default: anything uncaught lands in the developer banner.
  window.addEventListener('error', (e) => fail(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => fail(e.reason));

  log('bring-it-alive v0.1 ready');
})();
