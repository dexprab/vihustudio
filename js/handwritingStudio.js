// js/handwritingStudio.js — My Letters, INSIDE the Studio.
//
// The SECOND HOST of the handwriting capture flow, exactly as
// js/bringItAliveStudio.js is the second host of the drawing flow and
// under the same rule ("the same tool page ui will not work in
// studio"): the modules are shared — BIACamera (element-map mounted),
// HWLight, HWLetterLive with its worker, HWLetter for a still
// photograph — and the surface is the Studio's own: a full-screen
// modal following Picture Studio's grammar (panel card, header
// title/close, one thought per screen), no developer log, no build
// tag, no technical word a child can see.
//
// WHAT OPENS IT: the ✍️ My Letters grid in the My Garden picker
// (js/contextPanel.js). A tap on an empty tile opens this overlay
// already armed for that letter; a kept tile's ↻ opens it the same
// way. The grid itself lives in the picker — this overlay is only the
// catching and the checking.
//
// TWO SCREENS:
//   · SHOW ME — the live camera in the letter's small square window,
//     the ready light attached, the loop reading. Green takes the
//     picture by itself (the light and the shutter share one verdict,
//     by construction); 📷 Take the picture stays as the manual way,
//     read by the same HWLetter.read a pressed Take on the tool uses.
//     A refusal is never blame: the quiet line says what to try, the
//     child stays armed.
//   · KEEP IT — the caught ink, large, on paper-white. 🌟 Keep it ·
//     📷 Show me again. Keep stores the letter (HandwritingStore —
//     local first, cloud after, silently), tells the garden
//     (vihu:creation-captured — one keep, one growth), and hands the
//     record to opts.onKept so the picker reopens with the tile
//     filled. (The tool page's pencil/eraser fix-up is not ported yet
//     — disclosed; Show me again is the whole recovery here.)
//
// LIFECYCLE: open({ch, onKept}) builds fresh; close() stops the loop,
// stops the camera tracks, restores the wide camera preference and
// removes the DOM entirely. window.__hwStudio is the developer seam.
(function () {
  'use strict';

  // The live loop's worker rides at the tool path when loaded by the
  // Studio (see hwLetterLive.js's ensureWorker seam).
  try { window.HW_WORKER_BASE = window.HW_WORKER_BASE || 'tools/bring-it-alive/js/'; } catch (e) {}

  let _modal = null, _els = null, _opts = null, _state = null;

  function _el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- keep ------------------------------------------------------------------
  function _glyphToPng(glyph) {
    const c = document.createElement('canvas');
    c.width = glyph.w; c.height = glyph.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(glyph.w, glyph.h);
    for (let i = 0; i < glyph.mask.length; i++) {
      if (glyph.mask[i]) {
        img.data[i * 4] = 26; img.data[i * 4 + 1] = 26; img.data[i * 4 + 2] = 26; img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  function _keep() {
    const g = _state.glyph;
    if (!g || _state.saving) return;
    _state.saving = true;
    const png = _glyphToPng(g);
    const done = function () {
      // A creation entered My Garden — one keep, one growth, whatever
      // the capture id dedup already guarantees (Decision 27).
      try {
        document.dispatchEvent(new CustomEvent('vihu:creation-captured',
          { detail: { id: 'hw-' + _state.ch + '-' + Date.now() } }));
      } catch (e) {}
      const onKept = _opts && _opts.onKept;
      close();
      if (onKept) { try { onKept(_state && _state.ch); } catch (e) {} }
    };
    if (typeof HandwritingStore !== 'undefined') {
      HandwritingStore.save({ ch: _state.ch, png: png, w: g.w, h: g.h }).then(done);
    } else done();
  }

  // ---- screens ---------------------------------------------------------------
  function _showCamera() {
    _state.glyph = null;
    _els.checkWrap.style.display = 'none';
    _els.camWrap.style.display = '';
    _els.quiet.textContent = '';
    _els.title.textContent = 'Show me your ' + _state.ch;
    _els.subtitle.textContent = 'Write it big anywhere you like and hold it up — the green light takes the picture by itself.';
    try { BIACamera.setPreferredShape('square'); } catch (e) {}
    // The button BIACamera.mount wired is the door to its own panel.
    _els.camBtn.click();
    _startLive();
  }

  function _startLive() {
    if (typeof HWLetterLive === 'undefined') return;
    try { HWLight.show(_els.camLive); } catch (e) {}
    HWLetterLive.start(_els.camLive, {
      ch: _state.ch,
      rect: function () { return BIACamera.analysisRect(_els.camLive); },
      onVerdict: function (kind) { try { HWLight.verdict(kind === 'letter'); } catch (e) {} },
      onMany: function (on) {
        _els.quiet.textContent = on
          ? 'One letter at a time, please — show me just your ' + _state.ch + ', nice and big.'
          : '';
      },
      onCapture: function (glyph) { _caught(glyph); }
    });
  }
  function _stopLive() {
    try { if (typeof HWLetterLive !== 'undefined') HWLetterLive.stop(); } catch (e) {}
    try { if (typeof HWLight !== 'undefined') HWLight.hide(); } catch (e) {}
  }

  function _caught(glyph) {
    _stopLive();
    try { BIACamera.closePanel(); } catch (e) {}
    _state.glyph = glyph;
    _els.camWrap.style.display = 'none';
    _els.checkWrap.style.display = '';
    _els.title.textContent = 'Your ' + _state.ch + '!';
    _els.subtitle.textContent = 'Keep it, or show it to me again.';
    const c = _els.checkCanvas, pad = 24;
    const scale = Math.min(1, 300 / Math.max(glyph.w, glyph.h));
    c.width = Math.round(glyph.w * scale) + pad * 2;
    c.height = Math.round(glyph.h * scale) + pad * 2;
    const x = c.getContext('2d');
    x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height);
    const img = new Image();
    img.onload = function () {
      x.imageSmoothingEnabled = true;
      x.drawImage(img, pad, pad, Math.round(glyph.w * scale), Math.round(glyph.h * scale));
    };
    img.src = _glyphToPng(glyph);
  }

  // A still photograph, read by the same one-letter reader the tool's
  // pressed Take uses; a refusal keeps the child armed and kind.
  function _readStill(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        const photo = x.getImageData(0, 0, c.width, c.height);
        const res = HWLetter.read(photo, { ch: _state.ch });
        if (res && res.ok && res.glyph) { _caught(res.glyph); return; }
        _els.quiet.textContent = 'I couldn’t see one clear letter there — show me just your '
          + _state.ch + ', nice and big.';
        _showCamera();
      } catch (e) {
        _els.quiet.textContent = 'Let’s try that again — show me your ' + _state.ch + '.';
        _showCamera();
      }
    };
    img.onerror = function () { URL.revokeObjectURL(url); _showCamera(); };
    img.src = url;
  }

  // ---- build -----------------------------------------------------------------
  function _build() {
    _modal = _el('div', 'hw-studio-modal');
    const panel = _el('div', 'hw-studio-panel');
    _modal.appendChild(panel);

    const head = _el('div', 'hw-studio-head');
    const headText = _el('div', 'hw-studio-head-text');
    _els = {};
    _els.title = _el('div', 'hw-studio-title', '');
    _els.subtitle = _el('div', 'hw-studio-subtitle', '');
    headText.appendChild(_els.title);
    headText.appendChild(_els.subtitle);
    head.appendChild(headText);
    const closeBtn = _el('button', 'hw-studio-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', close);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // camera screen
    _els.camWrap = _el('div', 'hw-studio-cam');
    _els.camBtn = _el('button', 'hw-studio-hidden');   // BIACamera's door
    _els.camBtn.type = 'button';
    _els.camPanel = _el('div', 'hw-studio-cam-panel');
    _els.camLive = document.createElement('video');
    _els.camLive.autoplay = true; _els.camLive.muted = true;
    _els.camLive.setAttribute('playsinline', '');
    _els.camShot = document.createElement('canvas');
    _els.camShot.style.display = 'none';
    _els.camTake = _el('button', 'hw-studio-btn', '📷 Take the picture');
    _els.camTake.type = 'button';
    _els.camUse = _el('button', 'hw-studio-btn hw-studio-btn-gold', 'Use this one');
    _els.camUse.type = 'button';
    _els.camRetake = _el('button', 'hw-studio-btn', 'Try again');
    _els.camRetake.type = 'button';
    _els.camClose = _el('button', 'hw-studio-hidden', '');
    _els.camClose.type = 'button';
    _els.quiet = _el('div', 'hw-studio-quiet', '');
    _els.camPanel.appendChild(_els.camLive);
    _els.camPanel.appendChild(_els.camShot);
    const camRow = _el('div', 'hw-studio-row');
    camRow.appendChild(_els.camTake);
    camRow.appendChild(_els.camUse);
    camRow.appendChild(_els.camRetake);
    _els.camWrap.appendChild(_els.camPanel);
    _els.camWrap.appendChild(camRow);
    _els.camWrap.appendChild(_els.quiet);
    _els.camWrap.appendChild(_els.camBtn);
    _els.camWrap.appendChild(_els.camClose);
    panel.appendChild(_els.camWrap);

    // check screen
    _els.checkWrap = _el('div', 'hw-studio-check');
    _els.checkWrap.style.display = 'none';
    _els.checkCanvas = document.createElement('canvas');
    _els.checkCanvas.className = 'hw-studio-check-canvas';
    const keepRow = _el('div', 'hw-studio-row');
    const keepBtn = _el('button', 'hw-studio-btn hw-studio-btn-gold', '🌟 Keep it');
    keepBtn.type = 'button';
    keepBtn.addEventListener('click', _keep);
    const againBtn = _el('button', 'hw-studio-btn', '📷 Show me again');
    againBtn.type = 'button';
    againBtn.addEventListener('click', _showCamera);
    keepRow.appendChild(keepBtn);
    keepRow.appendChild(againBtn);
    _els.checkWrap.appendChild(_els.checkCanvas);
    _els.checkWrap.appendChild(keepRow);
    panel.appendChild(_els.checkWrap);

    if (typeof BIACamera !== 'undefined' && BIACamera.supported()) {
      BIACamera.mount({
        onPicture: function (file) { _readStill(file); },
        els: {
          button: _els.camBtn, panel: _els.camPanel,
          live: _els.camLive, shot: _els.camShot,
          take: _els.camTake, use: _els.camUse,
          retake: _els.camRetake, close: _els.camClose,
          quiet: _els.quiet, step: null
        }
      });
    } else {
      // No camera on this machine: the truthful quiet state, no blame.
      _els.quiet.textContent = 'This computer has no camera I can use — your letters are waiting whenever there is one.';
    }
    document.body.appendChild(_modal);
  }

  // ---- open / close ----------------------------------------------------------
  function open(opts) {
    if (_modal) close();
    _opts = opts || {};
    _state = { ch: String(_opts.ch || 'a'), glyph: null, saving: false };
    _build();
    _showCamera();
  }
  function close() {
    _stopLive();
    try { BIACamera.closePanel(); } catch (e) {}
    try { BIACamera.stopTracks(); } catch (e) {}
    try { BIACamera.setPreferredShape('wide'); } catch (e) {}
    if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal);
    _modal = null; _els = null; _state = null;
  }

  const api = { open: open, close: close, isOpen: function () { return !!_modal; } };
  try { window.HandwritingStudio = api; window.__hwStudio = api; } catch (e) {}
})();
