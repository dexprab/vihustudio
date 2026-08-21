/* APP — the STANDALONE host's UI state and wiring. All pixel truth lives
 * in the modules; the flow's own decisions (pipeline order, honest-failure
 * thresholds and their words, what the claim/refine canvases show) live in
 * js/flow.js — shared with the Studio host (js/bringItAliveStudio.js) so
 * the two can never drift. This file moves the child through the four
 * marks (Photograph → Claim → We Found This → Make It Yours) and never
 * touches an exported byte itself.
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
  // One display scale for both interactive canvases (BIAFlow owns the
  // geometry; this host only remembers the scale the flow chose).
  const MAXW = 860, MAXH = 620;
  function toImage(canvas, ev) {
    return BIAFlow.toImage(canvas, ev, state.displayScale);
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

  // The camera is the second way a photograph arrives (v0.3) — it hands a
  // File into the exact same loadPhoto as the picker; one pipeline.
  BIACamera.mount({ onPicture: (file) => loadPhoto(file), log });

  // My Handwriting photographs ONE LETTER, and one letter needs no wide
  // view (the product owner: "minimize the camera view. we are showing
  // single letters") — so while the letter journey is armed the camera
  // prefers the SMALL SQUARE WINDOW: the centred square crop of the
  // native frame, presented compact. The crop is also what the letter
  // reader analyses (hwApp hands the loop camera.js's own
  // analysisRect), so preview, analysis and capture are one picture —
  // and the flanks of the room (a curtain, a doorframe) never even
  // enter it. Disarmed, the drawing journey's own wide default returns.
  // Watched off the arm banner hwApp.js already shows and hides; the
  // seam (BIACamera.setPreferredShape) never overrides a shape the
  // child chose themselves, and the child's toggle stays for the whole
  // page.
  const hwArmedBanner = $('hwArmed');
  if (hwArmedBanner && BIACamera.setPreferredShape) {
    new MutationObserver(() => {
      BIACamera.setPreferredShape(
        hwArmedBanner.style.display === 'block' ? 'square' : 'wide');
    }).observe(hwArmedBanner, { attributes: true, attributeFilter: ['style'] });
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
    state.displayScale =
      BIAFlow.drawClaimBase($('claimCanvas'), state.photo, loop, MAXW, MAXH);
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
      // The pipeline and both honest-failure outcomes live in BIAFlow —
      // FOUND NOTHING is a first-class honest outcome there, never an
      // empty asset dressed as success.
      const res = BIAFlow.claimAndSegment(state.photo, loop, log);
      loop = [];
      if (!res.ok) {
        state.seg = null; state.claim = null;
        drawClaimBase();
        quiet(res.message);
        return;
      }
      state.claim = res.claim;
      state.seg = res.seg;
      state.marks = [];
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
    state.displayScale =
      BIAFlow.drawRefine($('refineCanvas'), state.photo, state.seg, MAXW, MAXH);
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
    // sized correction whatever the photograph's resolution (BIAFlow owns
    // the number).
    return BIAFlow.brushRadius(state.displayScale);
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
  // The developer strip's layer stack: original / pencil & paint / fills,
  // and the op history count. Refreshed on every edit through the editor's
  // onChange — the strip is a window on the creation, never a copy of it.
  function updateLayerStrip() {
    const c = state.creation;
    if (!c) return;
    const w = c.original.width, h = c.original.height;
    BIAPreview.layer($('devLayerOriginal'), c.originalCanvas());
    BIAPreview.layer($('devLayerPaint'), c.paintCanvas);
    const fc = document.createElement('canvas');
    fc.width = w; fc.height = h;
    fc.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(c.fillPlane), w, h), 0, 0);
    BIAPreview.layer($('devLayerFills'), fc);
    let fills = 0;
    for (let i = 3; i < c.fillPlane.length; i += 4) if (c.fillPlane[i]) fills++;
    const lines = Object.keys(c._lines).length;
    let marked = 0;
    if (c.inkTintPlane) for (let i = 0; i < c.inkTintPlane.length; i++) if (c.inkTintPlane[i]) marked++;
    const regionInfo = c._regions
      ? (c._regions.none ? 'none found' : c._regions.count + ' found') : 'not yet asked';
    $('devOps').textContent =
      'layers: original ' + w + '×' + h + ' (never written) · pencil & paint (ops) · fills ' +
      fills + ' px under the lines · marked-line tint ' + marked +
      ' px · line edits on ' + lines + ' area(s) · regions ' +
      regionInfo + ' · history ' + c.cursor + '/' + c.ops.length +
      ' ops · transform x' + c.transform.x + ' y' + c.transform.y +
      ' scale ' + c.transform.scale.toFixed(2) + ' rot ' + c.transform.rotation + '°';
    updateLineButtons();
  }

  // The Lines row reflects the last shape the child touched.
  function updateLineButtons() {
    const r = BIAEditor.state.lastRegion;
    const st = (r && state.creation) ? state.creation.lineStateOf(r)
                                     : { width: 'original' };
    $('lineThinBtn').classList.toggle('on', st.width === 'thin');
    $('lineOriginalBtn').classList.toggle('on', st.width === 'original');
    $('lineThickBtn').classList.toggle('on', st.width === 'thick');
  }

  function setView(mode) {
    BIAEditor.setView(mode);
    $('viewOriginalBtn').classList.toggle('on', mode === 'original');
    $('viewMineBtn').classList.toggle('on', mode === 'mine');
  }
  $('viewOriginalBtn').addEventListener('click', () => setView('original'));
  $('viewMineBtn').addEventListener('click', () => setView('mine'));

  function openCreation(creation, viaExtraction) {
    state.creation = creation;
    BIAEditor.mount($('editCanvas'), creation, updateLayerStrip, log);
    setView('mine');
    setTool('pencil');
    // A creation reopened from JSON has no photograph or claim behind it,
    // so "Make another claim" has nowhere honest to go.
    $('anotherBtn').style.display = viaExtraction ? '' : 'none';
    prepareLibraryRow();
    updateLayerStrip();
    go('stepAlive');
  }

  $('aliveBtn').addEventListener('click', async () => {
    try {
      // Extract → verified baseline export → the layered creation, all in
      // BIAFlow (the export's verification walk is the loud preservation
      // check, and the flow fires it BEFORE the child is told the drawing
      // is theirs).
      const res = await BIAFlow.bringAlive(state.photo, state.seg, state.claim,
        { testCaseId: state.testCaseId, log });
      if (!res.ok) {
        go('stepClaim'); drawClaimBase();
        quiet(res.message);
        return;
      }
      const asset = res.asset, exp = res.exp, creation = res.creation;
      state.asset = asset;
      state.lastExport = exp;
      state.exports.push(exp);

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
    for (const [id, t] of [['toolPencil', 'pencil'], ['toolFill', 'fill'],
                           ['toolMark', 'mark'], ['toolErase', 'erase'],
                           ['toolMove', 'move']]) {
      $(id).classList.toggle('on', t === tool);
    }
  }
  $('toolPencil').addEventListener('click', () => setTool('pencil'));
  $('toolFill').addEventListener('click', () => setTool('fill'));
  $('toolMark').addEventListener('click', () => setTool('mark'));
  $('toolErase').addEventListener('click', () => setTool('erase'));
  $('toolMove').addEventListener('click', () => setTool('move'));
  for (const b of document.querySelectorAll('.swatch')) {
    b.addEventListener('click', () => {
      BIAEditor.setColor(b.dataset.color);
      for (const o of document.querySelectorAll('.swatch')) o.classList.toggle('on', o === b);
      // Choosing a colour means "I want to make a mark" — but never steals
      // the Fill tool (pick blue, then tap the shape), and while a Mark is
      // live it means "colour the marked lines NOW"; the mark stays live
      // so another colour can be tried.
      const t = BIAEditor.state.tool;
      if (t === 'mark') BIAEditor.tintMarked();
      else if (t !== 'pencil' && t !== 'fill') setTool('pencil');
    });
  }
  for (const b of document.querySelectorAll('.brush')) {
    b.addEventListener('click', () => {
      BIAEditor.setSize(b.dataset.size);
      for (const o of document.querySelectorAll('.brush')) o.classList.toggle('on', o === b);
    });
  }
  function lineWidth(width) {
    if (!BIAEditor.setLineWidth(width)) {
      log('lines: touch a shape first (Fill, then tap inside or on its line)');
    }
  }
  $('lineThinBtn').addEventListener('click', () => lineWidth('thin'));
  $('lineOriginalBtn').addEventListener('click', () => lineWidth('original'));
  $('lineThickBtn').addEventListener('click', () => lineWidth('thick'));
  $('undoBtn').addEventListener('click', () => BIAEditor.undo());
  $('redoBtn').addEventListener('click', () => BIAEditor.redo());
  $('resetBtn').addEventListener('click', () => BIAEditor.reset());
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
  // Current PNG is a RENDER of the current view — original + edits +
  // transform, over transparency. Original PNG renders the untouched
  // ORIGINAL layer. The canonical creation is the JSON.
  $('downloadBtn').addEventListener('click', () => {
    const r = state.creation.render();
    r.canvas.toBlob((b) => {
      if (!b) { fail(new Error('render: toBlob returned null')); return; }
      download(stem() + '-yours.png', b);
    }, 'image/png');
  });
  $('downloadOriginalBtn').addEventListener('click', () => {
    state.creation.originalCanvas().toBlob((b) => {
      if (!b) { fail(new Error('render: toBlob returned null')); return; }
      download(stem() + '-original.png', b);
    }, 'image/png');
  });
  $('downloadCreationBtn').addEventListener('click', () =>
    download(stem() + '.vihu-creation.json',
      new Blob([state.creation.toJSONString()], { type: 'application/json' })));

  // ---- my library ------------------------------------------------------------
  // "kid can save their characters of these extractions" — the character
  // goes to My Library (js/creatorLibrary.js, this tool's first outside
  // link) and the Studio's Add panel places it on any page. The save is
  // LOCAL FIRST: it lands in IndexedDB (shared per-origin, so the Studio
  // sees it immediately) whether or not any platform is configured; the
  // cloud catches up silently in the store's own background sync. The
  // row hides entirely when js/creatorLibrary.js didn't load (a bare
  // copy of the tool), so the tool keeps working standalone.
  function prepareLibraryRow() {
    const row = $('libraryRow');
    if (!window.CreatorLibrary) { row.style.display = 'none'; return; }
    row.style.display = '';
    $('libraryStatus').textContent = '';
    $('libraryBtn').disabled = false;
    const s = stem();
    $('libraryName').value = (s && s !== 'drawing') ? s : 'My Character';
  }
  $('libraryBtn').addEventListener('click', () => {
    if (!window.CreatorLibrary || !state.creation) return;
    const btn = $('libraryBtn'), status = $('libraryStatus');
    btn.disabled = true;
    status.textContent = '…';
    try {
      // The placement PNG is a RENDER of the current view with the live
      // transform applied (creation.render()); the record also carries
      // the still-editable creation JSON itself. Downscale (1600px /
      // 1.5MB, AssetStore's own discipline) and the ~256px thumbnail
      // happen inside CreatorLibrary.save().
      const r = state.creation.render();
      const png = r.canvas.toDataURL('image/png');
      const name = ($('libraryName').value || '').trim() || 'My Character';
      window.CreatorLibrary.save({ name, png, creation: state.creation.toJSON() })
        .then((res) => {
          btn.disabled = false;
          if (res && res.ok) {
            status.textContent = 'Saved to My Library ✓';
            // MY GARDEN — a creation entered the garden; the record id
            // makes one capture exactly one growth (Decision 27).
            try {
              document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: res.record.id } }));
            } catch (e) {}
            log('library: kept "' + name + '" as ' + res.record.id +
                ' (png ' + png.length + ' chars' +
                (res.record.png && res.record.png.length !== png.length
                  ? ', stored ' + res.record.png.length : '') + ')');
          } else {
            // Never an error at the child — the honest quiet state.
            status.textContent = 'Couldn’t keep it just now — try again.';
            log('library: save did not land (' + ((res && res.error && res.error.message) || res && res.error || 'unknown') + ')');
          }
        });
    } catch (e) {
      btn.disabled = false;
      status.textContent = 'Couldn’t keep it just now — try again.';
      log('library: save threw (' + (e && e.message ? e.message : e) + ')');
    }
  });

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
