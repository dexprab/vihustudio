// js/bringItAliveStudio.js — Bring It Alive, INSIDE the Studio.
//
// Product decision (the product owner, verbatim): "the tool need to become
// part of studio." And mid-sprint, just as directly: "the same tool page
// ui will not work in studio." So this file is the SECOND HOST of one
// flow — the same modules the standalone page mounts (BIACapture,
// BIACamera, BIAFlow, BIARefine, BIAEditor, BIACreation, CreatorLibrary)
// under a surface designed the way the Studio's own child-facing surfaces
// are designed, not the tool page restyled.
//
// WHAT THIS HOST IS: a full-screen modal overlay following Picture
// Studio's pattern exactly (js/pictureStudio.js → _buildModal: fixed
// modal, panel card, header grid of title/subtitle/close, one body) —
// the closest existing Studio overlay to "a temporary preparation
// workspace that ends with something landing in the Studio". Its layout
// grammar borrows deliberately: the header and close from Picture
// Studio, the big-friendly-CTA pair from Picture Studio's Result view,
// the active-tool gold state from Picture Studio's tiles, and the
// one-headline-one-thought-per-screen rhythm from the Creation Flow.
//
// WHAT THIS HOST IS NOT: the tool page. No developer log, no developer
// strip, no build tag, no downloads (Original PNG / Current PNG /
// creation JSON stay on the standalone page — in the Studio the
// deliverable is the library item, and the still-editable creation
// document travels INSIDE that record). No technical word anywhere a
// child can see. None of the tool page's step-section ids exist here:
// this DOM is its own markup with its own .bia-studio-* classes, so the
// tool page's stylesheet assumptions can never leak in.
//
// WHERE THE TRUTH LIVES: js/../tools/bring-it-alive/js/flow.js. Pipeline
// order, honest-failure thresholds and their child-facing words, and the
// pixel truth of the claim/refine canvases are BIAFlow's, shared with
// the standalone host. The ORIGINAL-is-immutable / no-redraw / no-AI
// rules ride along untouched, including the verified baseline export
// (the loud preservation check) firing before the child is ever told
// the drawing is theirs. The editing canvas keeps its checkerboard —
// BIAEditor paints it itself, by product-owner decision.
//
// LIFECYCLE: open() builds the overlay fresh and always starts at the
// photograph; close() stops any camera tracks and REMOVES the overlay
// DOM entirely, so a closed flow leaves nothing behind and reopening is
// a clean start. The one exit path that isn't ✕ is Keep in My Library:
// on a landed save the overlay closes itself and hands the fresh record
// to opts.onKept — the My Library picker uses that to reopen showing
// the new character, one tap from the page.
//
// window.__biaStudio is the developer seam, same discipline as the tool
// page's window.__bia: deliberately exposed for verification scripts and
// devtools, never shown, never required by the flow.
(function () {
  'use strict';

  const NAME_DEFAULT = 'My Character';
  const SWATCHES = [
    ['#1f2430', 'ink'], ['#e5484d', 'red'], ['#f5a524', 'orange'],
    ['#30a46c', 'green'], ['#3e63dd', 'blue'], ['#8e4ec6', 'purple']
  ];

  let _modal = null;     // the overlay root in the document (null = closed)
  let _els = null;       // this open's elements
  let _state = null;     // this open's flow state
  let _opts = null;
  let _keyHandler = null;

  function _el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function _btn(cls, text, onClick) {
    const b = _el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function _log(msg) {
    // The honesty channel keeps running — in the console only, which is
    // instrumentation, never the child's screen.
    try { console.log('[bring-it-alive/studio] ' + msg); } catch (e) {}
  }

  // A gentle line on the current step; never a technical word.
  function _quiet(msg) {
    if (!_els) return;
    const q = _els.quiet[_els.root.getAttribute('data-step')];
    if (!q) return;
    q.textContent = msg;
    q.style.display = 'block';
  }
  function _clearQuiet() {
    if (!_els) return;
    for (const k in _els.quiet) _els.quiet[k].style.display = 'none';
  }
  function _oops() {
    _quiet('Hmm, that didn’t work just then — let’s try it again.');
  }

  function _goStep(step) {
    _clearQuiet();
    if (step !== 'photo' && window.BIACamera) BIACamera.closePanel();
    _els.root.setAttribute('data-step', step);
    _els.subtitle.textContent = {
      photo: 'A drawing on paper can live in your story.',
      claim: 'Show me which part is yours.',
      found: 'Here’s what we’ll bring with us.',
      yours: 'Your drawing, exactly as you made it — yours.'
    }[step];
  }

  // The stage box a canvas may fill, measured NOW (the step must be
  // visible first — _goStep before _stageBox).
  function _stageBox(stage) {
    const r = stage.getBoundingClientRect();
    return { w: Math.max(320, Math.floor(r.width) - 8),
             h: Math.max(240, Math.floor(r.height) - 8) };
  }

  // ---- photograph -----------------------------------------------------------
  async function _loadPhoto(source) {
    try {
      const photo = await BIACapture.capture(source);
      _state.photo = photo;
      _state.claim = null; _state.seg = null; _state.creation = null;
      _state.loop = [];
      _log('capture: ' + photo.filename + ' ' + photo.width + 'x' + photo.height);
      for (const n of photo.notes || []) _log(n);
      _goStep('claim');
      _drawClaim();
    } catch (e) { _log('capture failed: ' + (e && e.message)); _oops(); }
  }

  // ---- claim ------------------------------------------------------------------
  function _drawClaim() {
    // The stage is measured once per arrival on the step and remembered,
    // so every redraw of the loop-in-progress lands at the exact same
    // display scale the pointer mapping is using.
    _state.claimBox = _stageBox(_els.claimStage);
    _state.scale = BIAFlow.drawClaimBase(_els.claimCanvas, _state.photo,
      _state.loop, _state.claimBox.w, _state.claimBox.h);
  }
  function _closeClaim() {
    try {
      const res = BIAFlow.claimAndSegment(_state.photo, _state.loop, _log);
      _state.loop = [];
      if (!res.ok) {
        _drawClaim();
        _quiet(res.message);
        return;
      }
      _state.claim = res.claim;
      _state.seg = res.seg;
      _goStep('found');
      _drawRefine();
    } catch (e) { _log('claim failed: ' + (e && e.message)); _oops(); }
  }

  // ---- we found this ------------------------------------------------------------
  function _drawRefine() {
    _state.foundBox = _stageBox(_els.foundStage);
    _state.scale = BIAFlow.drawRefine(_els.foundCanvas, _state.photo,
      _state.seg, _state.foundBox.w, _state.foundBox.h);
  }
  function _setMode(mode) {
    _state.mode = mode;
    _els.keepBtn.classList.toggle('active', mode === 'keep');
    _els.removeBtn.classList.toggle('active', mode === 'remove');
  }
  async function _bringAlive() {
    if (_state.busy) return;
    _state.busy = true;
    _els.aliveBtn.disabled = true;
    try {
      const res = await BIAFlow.bringAlive(_state.photo, _state.seg, _state.claim,
        { log: _log });
      if (!res.ok) {
        _goStep('claim');
        _drawClaim();
        _quiet(res.message);
        return;
      }
      _state.creation = res.creation;
      _openYours();
    } catch (e) {
      _log('bring alive failed: ' + (e && e.message));
      _oops();
    } finally {
      _state.busy = false;
      _els.aliveBtn.disabled = false;
    }
  }

  // ---- make it yours ---------------------------------------------------------------
  function _openYours() {
    _goStep('yours');
    const box = _stageBox(_els.yoursStage);
    _els.editCanvas.width = box.w;
    _els.editCanvas.height = box.h;
    BIAEditor.mount(_els.editCanvas, _state.creation, null, _log);
    BIAEditor.setView('mine');
    _setTool('pencil');
    _setSwatch(_els.swatches[0]);
    _setSize(_els.sizes[0]);
    _els.peekBtn.classList.remove('active');
    _els.peekBtn.textContent = '👀 Peek at the paper';
    _els.nameInput.value = NAME_DEFAULT;
    _els.keepStatus.textContent = '';
    _els.libraryBtn.disabled = false;
  }
  function _setTool(tool) {
    BIAEditor.setTool(tool);
    for (const b of _els.tools) b.classList.toggle('active', b.dataset.tool === tool);
  }
  function _setSwatch(btn) {
    BIAEditor.setColor(btn.dataset.color);
    for (const o of _els.swatches) o.classList.toggle('active', o === btn);
  }
  function _setSize(btn) {
    BIAEditor.setSize(btn.dataset.size);
    for (const o of _els.sizes) o.classList.toggle('active', o === btn);
  }
  function _togglePeek() {
    const peeking = !_els.peekBtn.classList.contains('active');
    _els.peekBtn.classList.toggle('active', peeking);
    _els.peekBtn.textContent = peeking ? '🎨 Back to my version' : '👀 Peek at the paper';
    BIAEditor.setView(peeking ? 'original' : 'mine');
  }

  function _keep() {
    if (!_state.creation || _state.saving) return;
    if (typeof CreatorLibrary === 'undefined') { _oops(); return; }
    _state.saving = true;
    _els.libraryBtn.disabled = true;
    _els.keepStatus.textContent = '…';
    try {
      // Same record the standalone host keeps: the placement picture is a
      // RENDER of the current view (original + edits + transform), and the
      // still-editable creation document rides inside the record.
      const r = _state.creation.render();
      const png = r.canvas.toDataURL('image/png');
      const name = (_els.nameInput.value || '').trim() || NAME_DEFAULT;
      CreatorLibrary.save({ name, png, creation: _state.creation.toJSON() })
        .then((res) => {
          if (res && res.ok) {
            _log('library: kept "' + name + '" as ' + res.record.id);
            const onKept = _opts && _opts.onKept;
            close();
            if (onKept) { try { onKept(res.record); } catch (e) {} }
          } else {
            _state.saving = false;
            _els.libraryBtn.disabled = false;
            _els.keepStatus.textContent = 'Couldn’t keep it just now — try again.';
            _log('library: save did not land (' +
              ((res && res.error && res.error.message) || (res && res.error) || 'unknown') + ')');
          }
        });
    } catch (e) {
      _state.saving = false;
      _els.libraryBtn.disabled = false;
      _els.keepStatus.textContent = 'Couldn’t keep it just now — try again.';
      _log('library: save threw (' + (e && e.message ? e.message : e) + ')');
    }
  }

  // ---- pointer wiring (host chrome; geometry through BIAFlow) -------------------
  function _wireClaimCanvas(canvas) {
    let looping = false;
    canvas.addEventListener('pointerdown', (e) => {
      looping = true;
      _state.loop = [BIAFlow.toImage(canvas, e, _state.scale)];
      canvas.setPointerCapture(e.pointerId);
      _clearQuiet();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!looping) return;
      _state.loop.push(BIAFlow.toImage(canvas, e, _state.scale));
      _state.scale = BIAFlow.drawClaimBase(canvas, _state.photo, _state.loop,
        _state.claimBox.w, _state.claimBox.h);
    });
    canvas.addEventListener('pointerup', () => {
      if (!looping) return;
      looping = false;
      _closeClaim();
    });
  }
  function _wireFoundCanvas(canvas) {
    let stroke = null;
    canvas.addEventListener('pointerdown', (e) => {
      stroke = { type: _state.mode,
                 points: [BIAFlow.toImage(canvas, e, _state.scale)],
                 radius: BIAFlow.brushRadius(_state.scale), t: Date.now() };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!stroke) return;
      stroke.points.push(BIAFlow.toImage(canvas, e, _state.scale));
      // live stroke feedback only — the mask updates on release (same
      // colours the flow has always answered a child's brush with)
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = stroke.type === 'keep'
        ? 'rgba(143,199,164,.8)' : 'rgba(226,145,122,.8)';
      ctx.lineWidth = stroke.radius * 2 * _state.scale;
      ctx.lineCap = 'round';
      const n = stroke.points.length, s = _state.scale;
      if (n >= 2) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[n - 2][0] * s, stroke.points[n - 2][1] * s);
        ctx.lineTo(stroke.points[n - 1][0] * s, stroke.points[n - 1][1] * s);
        ctx.stroke();
      }
    });
    canvas.addEventListener('pointerup', () => {
      if (!stroke) return;
      try {
        BIARefine.applyMark(_state.seg, stroke);
        _log('refine: ' + stroke.type + ' stroke, mask now ' + _state.seg.maskCount + ' px');
        stroke = null;
        _state.scale = BIAFlow.drawRefine(canvas, _state.photo, _state.seg,
          _state.foundBox.w, _state.foundBox.h);
      } catch (e) { stroke = null; _log('refine failed: ' + (e && e.message)); _oops(); }
    });
  }

  // ---- build ----------------------------------------------------------------------
  function _build() {
    _modal = _el('div', 'bia-studio-modal');
    const root = _el('div', 'bia-studio');
    root.setAttribute('data-step', 'photo');
    _modal.appendChild(root);

    _els = { root, quiet: {}, tools: [], swatches: [], sizes: [] };

    // Header — Picture Studio's own header grammar: title · subtitle · ✕.
    const header = _el('div', 'bia-studio-header');
    header.appendChild(_el('div', 'bia-studio-title', '✨ Bring a Drawing to Life'));
    _els.subtitle = _el('div', 'bia-studio-subtitle',
      'A drawing on paper can live in your story.');
    header.appendChild(_els.subtitle);
    const closeBtn = _btn('bia-studio-close', '✕', close);
    closeBtn.setAttribute('aria-label', 'Close');
    header.appendChild(closeBtn);
    root.appendChild(header);

    // ---- step: PHOTOGRAPH — one thought: show me your drawing ----
    const photo = _el('section', 'bia-studio-step bia-studio-step-photo');
    const invite = _el('div', 'bia-studio-invite');
    invite.appendChild(_el('div', 'bia-studio-invite-art', '🖍️'));
    invite.appendChild(_el('div', 'bia-studio-invite-line',
      'Show me a drawing you made on paper'));
    const inviteRow = _el('div', 'bia-studio-actions');
    const pickBtn = _btn('bia-studio-btn bia-studio-btn-primary', '🖼️ Choose a photo',
      () => _els.fileInput.click());
    inviteRow.appendChild(pickBtn);
    _els.cameraBtn = _btn('bia-studio-btn', '📷 Use the camera');
    _els.cameraBtn.style.display = 'none';
    inviteRow.appendChild(_els.cameraBtn);
    invite.appendChild(inviteRow);
    photo.appendChild(invite);

    _els.fileInput = document.createElement('input');
    _els.fileInput.type = 'file';
    _els.fileInput.accept = 'image/*';
    _els.fileInput.className = 'bia-studio-file';
    _els.fileInput.style.display = 'none';
    _els.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) _loadPhoto(e.target.files[0]);
      e.target.value = '';
    });
    photo.appendChild(_els.fileInput);

    // The camera — the same BIACamera both hosts share, handed THIS
    // host's elements. Deliberately plain, exactly as the module's own
    // house rules say: the live picture and one big button, nothing that
    // looks like scanning.
    const cam = _el('div', 'bia-studio-camera');
    cam.style.display = 'none';
    const camStage = _el('div', 'bia-studio-camera-stage');
    _els.camLive = document.createElement('video');
    _els.camLive.autoplay = true; _els.camLive.muted = true;
    _els.camLive.setAttribute('playsinline', '');
    _els.camShot = document.createElement('canvas');
    _els.camShot.style.display = 'none';
    camStage.appendChild(_els.camLive);
    camStage.appendChild(_els.camShot);
    cam.appendChild(camStage);
    const camRow = _el('div', 'bia-studio-actions');
    _els.camTake = _btn('bia-studio-btn bia-studio-btn-primary', 'Take the picture');
    _els.camUse = _btn('bia-studio-btn bia-studio-btn-primary', 'Use this one');
    _els.camUse.style.display = 'none';
    _els.camRetake = _btn('bia-studio-btn', 'Take it again');
    _els.camRetake.style.display = 'none';
    _els.camClose = _btn('bia-studio-btn', 'Never mind');
    camRow.appendChild(_els.camTake); camRow.appendChild(_els.camUse);
    camRow.appendChild(_els.camRetake); camRow.appendChild(_els.camClose);
    cam.appendChild(camRow);
    cam.appendChild(_el('p', 'bia-studio-note',
      'Hold your drawing up so the whole page is in the picture.'));
    photo.appendChild(cam);
    _els.camPanel = cam;

    _els.quiet.photo = _el('div', 'bia-studio-quiet');
    photo.appendChild(_els.quiet.photo);
    root.appendChild(photo);

    // ---- step: CLAIM — one thought: circle what's yours ----
    const claim = _el('section', 'bia-studio-step bia-studio-step-claim');
    claim.appendChild(_el('div', 'bia-studio-hint', 'Draw a circle around what you made'));
    _els.claimStage = _el('div', 'bia-studio-stage');
    _els.claimCanvas = document.createElement('canvas');
    _els.claimCanvas.className = 'bia-studio-canvas';
    _els.claimStage.appendChild(_els.claimCanvas);
    claim.appendChild(_els.claimStage);
    _els.quiet.claim = _el('div', 'bia-studio-quiet');
    claim.appendChild(_els.quiet.claim);
    const claimRow = _el('div', 'bia-studio-actions');
    claimRow.appendChild(_btn('bia-studio-btn', '← A different photo',
      () => { _state.loop = []; _goStep('photo'); }));
    claim.appendChild(claimRow);
    root.appendChild(claim);

    // ---- step: WE FOUND THIS — one thought: is this all of it? ----
    const found = _el('section', 'bia-studio-step bia-studio-step-found');
    found.appendChild(_el('div', 'bia-studio-hint', 'We found this!'));
    found.appendChild(_el('p', 'bia-studio-note',
      'Paint Keep over anything of yours we missed · paint Remove over anything that isn’t yours.'));
    const brushRow = _el('div', 'bia-studio-actions');
    _els.keepBtn = _btn('bia-studio-tool active', '🖌️ Keep', () => _setMode('keep'));
    _els.removeBtn = _btn('bia-studio-tool', '🧽 Remove', () => _setMode('remove'));
    brushRow.appendChild(_els.keepBtn);
    brushRow.appendChild(_els.removeBtn);
    found.appendChild(brushRow);
    _els.foundStage = _el('div', 'bia-studio-stage');
    _els.foundCanvas = document.createElement('canvas');
    _els.foundCanvas.className = 'bia-studio-canvas';
    _els.foundStage.appendChild(_els.foundCanvas);
    found.appendChild(_els.foundStage);
    _els.quiet.found = _el('div', 'bia-studio-quiet');
    found.appendChild(_els.quiet.found);
    const foundRow = _el('div', 'bia-studio-actions');
    _els.aliveBtn = _btn('bia-studio-btn bia-studio-btn-primary', '✨ Bring it alive', _bringAlive);
    foundRow.appendChild(_els.aliveBtn);
    foundRow.appendChild(_btn('bia-studio-btn', '← Circle again', () => {
      _state.claim = null; _state.seg = null;
      _goStep('claim'); _drawClaim();
    }));
    found.appendChild(foundRow);
    root.appendChild(found);

    // ---- step: MAKE IT YOURS — one thought: it's yours now ----
    const yours = _el('section', 'bia-studio-step bia-studio-step-yours');
    yours.appendChild(_el('div', 'bia-studio-hint',
      'It’s yours! Colour it in — or keep it just as it is.'));
    const toolRow = _el('div', 'bia-studio-tools');
    for (const [tool, label] of [['pencil', '✏️ Pencil'], ['fill', '🪣 Fill'],
                                 ['mark', '⭕ Mark'], ['erase', '🧽 Erase']]) {
      const b = _btn('bia-studio-tool', label, () => _setTool(tool));
      b.dataset.tool = tool;
      _els.tools.push(b);
      toolRow.appendChild(b);
    }
    toolRow.appendChild(_el('span', 'bia-studio-toolgap'));
    for (const [color, title] of SWATCHES) {
      const b = _btn('bia-studio-swatch', '');
      b.dataset.color = color;
      b.style.background = color;
      b.title = title;
      b.addEventListener('click', () => {
        _setSwatch(b);
        // Choosing a colour means "I want to make a mark" — but never
        // steals the Fill tool, and while a Mark is live it means
        // "colour the marked lines NOW" (same rule as the standalone
        // host, because it is the flow's rule, not a page's).
        const t = BIAEditor.state.tool;
        if (t === 'mark') BIAEditor.tintMarked();
        else if (t !== 'pencil' && t !== 'fill') _setTool('pencil');
      });
      _els.swatches.push(b);
      toolRow.appendChild(b);
    }
    toolRow.appendChild(_el('span', 'bia-studio-toolgap'));
    for (const [size, px] of [['fine', 4], ['medium', 8], ['thick', 13]]) {
      const b = _btn('bia-studio-dot', '');
      b.dataset.size = size;
      b.title = size;
      const i = _el('i');
      i.style.width = px + 'px'; i.style.height = px + 'px';
      b.appendChild(i);
      b.addEventListener('click', () => _setSize(b));
      _els.sizes.push(b);
      toolRow.appendChild(b);
    }
    toolRow.appendChild(_el('span', 'bia-studio-toolgap'));
    toolRow.appendChild(_btn('bia-studio-tool', '↩ Undo', () => BIAEditor.undo()));
    toolRow.appendChild(_btn('bia-studio-tool', '↪ Redo', () => BIAEditor.redo()));
    _els.peekBtn = _btn('bia-studio-tool', '👀 Peek at the paper', _togglePeek);
    toolRow.appendChild(_els.peekBtn);
    yours.appendChild(toolRow);

    _els.yoursStage = _el('div', 'bia-studio-stage');
    _els.editCanvas = document.createElement('canvas');
    _els.editCanvas.className = 'bia-studio-canvas';
    _els.yoursStage.appendChild(_els.editCanvas);
    yours.appendChild(_els.yoursStage);
    _els.quiet.yours = _el('div', 'bia-studio-quiet');
    yours.appendChild(_els.quiet.yours);

    const keepRow = _el('div', 'bia-studio-keep-row');
    keepRow.appendChild(_btn('bia-studio-btn', '← Go back', () => {
      _goStep('found'); _drawRefine();
    }));
    _els.nameInput = document.createElement('input');
    _els.nameInput.type = 'text';
    _els.nameInput.maxLength = 60;
    _els.nameInput.className = 'bia-studio-name';
    _els.nameInput.setAttribute('aria-label', 'What is its name?');
    keepRow.appendChild(_els.nameInput);
    _els.libraryBtn = _btn('bia-studio-btn bia-studio-btn-primary',
      '🌟 Keep in My Library', _keep);
    keepRow.appendChild(_els.libraryBtn);
    _els.keepStatus = _el('span', 'bia-studio-status', '');
    keepRow.appendChild(_els.keepStatus);
    yours.appendChild(keepRow);
    root.appendChild(yours);

    // Camera wiring — only where the camera API exists at all; everywhere
    // else the photograph step simply never mentions a camera.
    if (window.BIACamera && BIACamera.supported()) {
      _els.cameraBtn.style.display = '';
      BIACamera.mount({
        onPicture: (file) => _loadPhoto(file),
        log: _log,
        els: {
          button: _els.cameraBtn, panel: _els.camPanel,
          live: _els.camLive, shot: _els.camShot,
          take: _els.camTake, use: _els.camUse,
          retake: _els.camRetake, close: _els.camClose,
          quiet: _els.quiet.photo, step: null
        }
      });
    }

    _wireClaimCanvas(_els.claimCanvas);
    _wireFoundCanvas(_els.foundCanvas);

    document.body.appendChild(_modal);
  }

  // ---- open / close ------------------------------------------------------------------
  function open(opts) {
    if (_modal) close();
    _opts = opts || {};
    _state = { photo: null, claim: null, seg: null, creation: null,
               loop: [], mode: 'keep', scale: 1, busy: false, saving: false };
    window.__biaStudio = _state;
    _build();
    _keyHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', _keyHandler);
    return true;
  }

  function close() {
    if (!_modal) return;
    if (window.BIACamera) { try { BIACamera.closePanel(); } catch (e) {} }
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    _modal.remove();
    _modal = null; _els = null; _state = null; _opts = null;
    window.__biaStudio = null;
  }

  function isOpen() { return !!_modal; }

  window.BringItAliveStudio = { open, close, isOpen };
})();
