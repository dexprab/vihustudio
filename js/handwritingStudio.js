// js/handwritingStudio.js — My Letters, INSIDE the Studio.
//
// The SECOND HOST of the handwriting capture flow, exactly as
// js/bringItAliveStudio.js is the second host of the drawing flow and
// under the same rule ("the same tool page ui will not work in
// studio"): the modules are shared — BIACamera (element-map mounted,
// square letter window), HWLight, HWLetterLive with its worker,
// HWLetter for stills and stroke measurement — and the surface is the
// Studio's own: a modal in Picture Studio's grammar, wearing the
// workspace's sky, no technical word a child can see.
//
// WHAT OPENS IT: the ✍️ My Letters grid in the My Garden picker. An
// empty tile opens the camera armed for that letter; a kept tile's
// choice card opens it to Make it again (camera) or Fix it up (the
// check screen holding the KEPT ink — open({ch, edit:true})).
//
// TWO SCREENS:
//   · SHOW ME — the live camera; green takes the picture by itself
//     (the light and the shutter share one verdict); 📷 Take stays as
//     the manual way, read by the same HWLetter.read.
//   · CHECK IT — the caught (or kept) ink at capture resolution with
//     breathing room, and the tool page's own fix-up, ported whole
//     ("erase, pencil, move options missing" — the product owner):
//     the pencil draws at the letter's own MEASURED stroke width
//     (HWLetter.strokeWidthOf / 2, clamped [2,40]); the eraser stays
//     larger (cleaning a smudge wants area); Move is one drag to pick
//     a piece up, the next to slide it, letting go puts it down. Keep
//     trims back to the ink, stores the letter, tells the garden, and
//     reopens the picker with the tile filled.
//
// LIFECYCLE: open() builds fresh; close() stops the loop and the
// camera, restores the wide camera preference, removes the DOM whole.
(function () {
  'use strict';

  try { window.HW_WORKER_BASE = window.HW_WORKER_BASE || 'tools/bring-it-alive/js/'; } catch (e) {}

  let _modal = null, _els = null, _opts = null, _state = null;

  function _el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- glyph <-> pixels ------------------------------------------------------
  function _glyphToPng(glyph) {
    const c = document.createElement('canvas');
    c.width = glyph.w; c.height = glyph.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(glyph.w, glyph.h);
    for (let i = 0; i < glyph.mask.length; i++) {
      if (glyph.mask[i]) {
        img.data[i * 4] = 29; img.data[i * 4 + 1] = 52; img.data[i * 4 + 2] = 87; img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  function _pngToGlyph(png, w, h) {
    return new Promise(function (resolve, reject) {
      const im = new Image();
      im.onload = function () {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0);
        const data = x.getImageData(0, 0, w, h).data;
        const mask = new Uint8Array(w * h);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        resolve({ mask: mask, w: w, h: h });
      };
      im.onerror = function () { reject(new Error('letter png failed to decode')); };
      im.src = png;
    });
  }

  // ---- keep ------------------------------------------------------------------
  function _keep() {
    if (!_state.check || _state.saving) return;
    _commitSel();
    const t = _trimmed();
    if (!t) {
      _els.quiet.textContent = 'There’s nothing here yet — draw your ' + _state.ch
        + ' back in with the pencil, or show it to me again.';
      return;
    }
    _state.saving = true;
    const png = _glyphToPng(t);
    const done = function () {
      try {
        document.dispatchEvent(new CustomEvent('vihu:creation-captured',
          { detail: { id: 'hw-' + _state.ch + '-' + Date.now() } }));
      } catch (e) {}
      const onKept = _opts && _opts.onKept, ch = _state.ch;
      close();
      if (onKept) { try { onKept(ch); } catch (e) {} }
    };
    if (typeof HandwritingStore !== 'undefined') {
      HandwritingStore.save({ ch: _state.ch, png: png, w: t.w, h: t.h }).then(done);
    } else done();
  }

  // ---- SHOW ME ---------------------------------------------------------------
  function _showCamera() {
    _state.check = null;
    _els.checkWrap.style.display = 'none';
    _els.camWrap.style.display = '';
    _els.quiet.textContent = '';
    _els.title.textContent = 'Show me your ' + _state.ch;
    _els.subtitle.textContent = 'Write it big anywhere you like and hold it up — the green light takes the picture by itself.';
    try { BIACamera.setPreferredShape('square'); } catch (e) {}
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
      onCapture: function (glyph) {
        _stopLive();
        try { BIACamera.closePanel(); } catch (e) {}
        _enterCheck(glyph);
      }
    });
  }
  function _stopLive() {
    try { if (typeof HWLetterLive !== 'undefined') HWLetterLive.stop(); } catch (e) {}
    try { if (typeof HWLight !== 'undefined') HWLight.hide(); } catch (e) {}
  }
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
        if (res && res.ok && res.glyph) {
          _stopLive();
          try { BIACamera.closePanel(); } catch (e) {}
          _enterCheck(res.glyph);
          return;
        }
        _els.quiet.textContent = 'I couldn’t see one clear letter there — show me just your '
          + _state.ch + ', nice and big.';
        _showCamera();
      } catch (e) { _showCamera(); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); _showCamera(); };
    img.src = url;
  }

  // ---- CHECK IT — the tool page's fix-up, ported whole -----------------------
  // The working mask carries breathing room on every side so a missing
  // dot can be drawn ABOVE the ink the camera found; Keep trims back.
  function _enterCheck(glyph) {
    const pad = Math.max(24, Math.round(0.3 * Math.max(glyph.w, glyph.h)));
    const w = glyph.w + 2 * pad, h = glyph.h + 2 * pad;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < glyph.h; y++) {
      for (let x = 0; x < glyph.w; x++) {
        if (glyph.mask[y * glyph.w + x]) mask[(y + pad) * w + (x + pad)] = 1;
      }
    }
    let brush = 4;
    try { brush = Math.max(2, Math.min(40, Math.round(HWLetter.strokeWidthOf(mask, w, h) / 2))); } catch (e) {}
    _state.check = {
      mask: mask, w: w, h: h, tool: 'pencil', brush: brush,
      wipe: Math.max(Math.round(Math.max(3, Math.round(Math.max(glyph.w, glyph.h) / 45)) * 1.6),
                     Math.round(1.6 * brush)),
      sel: null, band: null, edits: 0
    };
    _els.camWrap.style.display = 'none';
    _els.checkWrap.style.display = '';
    _els.title.textContent = 'Your ' + _state.ch + '!';
    _els.subtitle.textContent = 'Pencil draws a missing bit back in, the eraser cleans a smudge away, and Move slides a piece to a better spot.';
    _els.quiet.textContent = '';
    _setTool('pencil');
    _paintCheck();
  }

  function _effectiveMask() {
    const k = _state.check;
    if (!k.sel) return k.mask;
    const m = k.mask.slice();
    const s = k.sel;
    for (let y = s.y0; y <= s.y1; y++) {
      for (let x = s.x0; x <= s.x1; x++) {
        if (!s.mask[y * k.w + x]) continue;
        const yy = y + s.dy, xx = x + s.dx;
        if (yy >= 0 && yy < k.h && xx >= 0 && xx < k.w) m[yy * k.w + xx] = 1;
      }
    }
    return m;
  }
  function _trimmed() {
    const k = _state.check;
    const em = _effectiveMask();
    let x0 = k.w, x1 = -1, y0 = k.h, y1 = -1;
    for (let y = 0; y < k.h; y++) {
      for (let x = 0; x < k.w; x++) {
        if (em[y * k.w + x]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) mask[y * w + x] = em[(y + y0) * k.w + (x + x0)];
    }
    return { mask: mask, w: w, h: h };
  }

  function _paintCheck() {
    const c = _els.checkCanvas, k = _state.check;
    if (!k) return;
    c.width = k.w; c.height = k.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(k.w, k.h);
    for (let i = 0; i < k.mask.length; i++) {
      const d = i * 4;
      if (k.mask[i]) { img.data[d] = 29; img.data[d + 1] = 52; img.data[d + 2] = 87; }
      else { img.data[d] = 253; img.data[d + 1] = 252; img.data[d + 2] = 248; }
      img.data[d + 3] = 255;
    }
    if (k.sel) {
      const s = k.sel;
      for (let y = s.y0; y <= s.y1; y++) {
        for (let x = s.x0; x <= s.x1; x++) {
          if (!s.mask[y * k.w + x]) continue;
          const yy = y + s.dy, xx = x + s.dx;
          if (yy < 0 || yy >= k.h || xx < 0 || xx >= k.w) continue;
          const d = (yy * k.w + xx) * 4;
          img.data[d] = 43; img.data[d + 1] = 86; img.data[d + 2] = 176;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#4b6fbf';
    ctx.lineWidth = 2;
    if (k.sel) {
      const s = k.sel;
      ctx.strokeRect(s.x0 + s.dx - 3.5, s.y0 + s.dy - 3.5, (s.x1 - s.x0 + 1) + 7, (s.y1 - s.y0 + 1) + 7);
    } else if (k.band) {
      const b = k.band;
      ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
    ctx.setLineDash([]);
  }

  function _makeSelection(b) {
    const k = _state.check;
    const x0 = Math.max(0, Math.round(Math.min(b.x0, b.x1)));
    const x1 = Math.min(k.w - 1, Math.round(Math.max(b.x0, b.x1)));
    const y0 = Math.max(0, Math.round(Math.min(b.y0, b.y1)));
    const y1 = Math.min(k.h - 1, Math.round(Math.max(b.y0, b.y1)));
    const mask = new Uint8Array(k.w * k.h);
    let sx0 = k.w, sx1 = -1, sy0 = k.h, sy1 = -1, got = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!k.mask[y * k.w + x]) continue;
        mask[y * k.w + x] = 1;
        got++;
        if (x < sx0) sx0 = x; if (x > sx1) sx1 = x;
        if (y < sy0) sy0 = y; if (y > sy1) sy1 = y;
      }
    }
    if (!got) return;
    for (let i = 0; i < mask.length; i++) if (mask[i]) k.mask[i] = 0;
    k.sel = { mask: mask, x0: sx0, x1: sx1, y0: sy0, y1: sy1, dx: 0, dy: 0 };
  }
  function _commitSel() {
    const k = _state && _state.check;
    if (!k || !k.sel) return;
    k.mask = _effectiveMask();
    k.sel = null;
    k.edits++;
  }
  function _setTool(tool) {
    const k = _state.check;
    if (!k) return;
    if (k.tool === 'move' && tool !== 'move') _commitSel();
    k.tool = tool;
    k.band = null;
    _els.toolPencil.classList.toggle('hw-studio-tool-active', tool === 'pencil');
    _els.toolEraser.classList.toggle('hw-studio-tool-active', tool === 'eraser');
    _els.toolMove.classList.toggle('hw-studio-tool-active', tool === 'move');
    _els.checkCanvas.style.cursor = tool === 'move' ? 'move' : 'crosshair';
    _paintCheck();
  }
  function _checkPoint(ev) {
    const c = _els.checkCanvas;
    const r = c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (c.width / r.width),
             y: (ev.clientY - r.top) * (c.height / r.height) };
  }
  function _daub(x, y) {
    const k = _state.check;
    const on = k.tool === 'pencil' ? 1 : 0;
    const r = k.tool === 'pencil' ? k.brush : k.wipe;
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const yy = Math.round(y) + dy;
      if (yy < 0 || yy >= k.h) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const xx = Math.round(x) + dx;
        if (xx < 0 || xx >= k.w) continue;
        k.mask[yy * k.w + xx] = on;
      }
    }
  }
  let _fixing = false, _lastPt = null, _moving = null, _banding = null;
  function _wireCheckCanvas() {
    const c = _els.checkCanvas;
    c.addEventListener('pointerdown', function (ev) {
      const k = _state && _state.check;
      if (!k) return;
      const p = _checkPoint(ev);
      try { c.setPointerCapture(ev.pointerId); } catch (e) {}
      if (k.tool === 'move') {
        if (k.sel) { _moving = { x: p.x, y: p.y, dx0: k.sel.dx, dy0: k.sel.dy }; }
        else { _banding = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; k.band = _banding; _paintCheck(); }
        return;
      }
      _fixing = true;
      k.edits++;
      _lastPt = p;
      _daub(p.x, p.y);
      _paintCheck();
    });
    c.addEventListener('pointermove', function (ev) {
      const k = _state && _state.check;
      if (!k) return;
      const p = _checkPoint(ev);
      if (_moving && k.sel) {
        const s = k.sel;
        s.dx = Math.max(-s.x0, Math.min(k.w - 1 - s.x1, Math.round(_moving.dx0 + p.x - _moving.x)));
        s.dy = Math.max(-s.y0, Math.min(k.h - 1 - s.y1, Math.round(_moving.dy0 + p.y - _moving.y)));
        _paintCheck();
        return;
      }
      if (_banding) { _banding.x1 = p.x; _banding.y1 = p.y; _paintCheck(); return; }
      if (!_fixing) return;
      const r = k.tool === 'pencil' ? k.brush : k.wipe;
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - _lastPt.x, p.y - _lastPt.y) / Math.max(1, r / 2)));
      for (let i = 1; i <= steps; i++) {
        _daub(_lastPt.x + (p.x - _lastPt.x) * i / steps, _lastPt.y + (p.y - _lastPt.y) * i / steps);
      }
      _lastPt = p;
      _paintCheck();
    });
    const end = function () {
      const k = _state && _state.check;
      if (_moving) { _moving = null; _commitSel(); _paintCheck(); return; }
      if (_banding) { if (k) { k.band = null; _makeSelection(_banding); } _banding = null; _paintCheck(); return; }
      _fixing = false;
      _lastPt = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  // ---- build -----------------------------------------------------------------
  // The workspace's own sky, quietly behind everything — a couple of
  // soft stars and a cloud in StageSky's palette, never over content.
  function _sky() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hw-studio-sky');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<ellipse cx="88" cy="64" rx="34" ry="13" fill="#ffffff" opacity=".8"/>' +
      '<ellipse cx="66" cy="70" rx="20" ry="10" fill="#ffffff" opacity=".8"/>' +
      '<ellipse cx="480" cy="500" rx="40" ry="14" fill="#ffffff" opacity=".7"/>' +
      '<path d="M472,60 l4,9 10,1 -7,7 2,10 -9,-5 -9,5 2,-10 -7,-7 10,-1 z" fill="#F5C542" opacity=".55"/>' +
      '<path d="M60,430 l3,7 8,1 -6,5 2,8 -7,-4 -7,4 2,-8 -6,-5 8,-1 z" fill="#b58ad1" opacity=".4"/>' +
      '<circle cx="520" cy="200" r="2.5" fill="#7db3e0" opacity=".6"/>' +
      '<circle cx="40" cy="250" r="2" fill="#F5C542" opacity=".6"/>';
    return svg;
  }

  function _build() {
    _modal = _el('div', 'hw-studio-modal');
    const panel = _el('div', 'hw-studio-panel');
    _modal.appendChild(panel);
    panel.appendChild(_sky());

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
    _els.camBtn = _el('button', 'hw-studio-hidden');
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
    _els.camWrap.appendChild(_els.camBtn);
    _els.camWrap.appendChild(_els.camClose);
    panel.appendChild(_els.camWrap);

    // check screen — canvas + the three tools + keep
    _els.checkWrap = _el('div', 'hw-studio-check');
    _els.checkWrap.style.display = 'none';
    _els.checkCanvas = document.createElement('canvas');
    _els.checkCanvas.className = 'hw-studio-check-canvas';
    const tools = _el('div', 'hw-studio-tools');
    _els.toolPencil = _el('button', 'hw-studio-tool', '✏️ Pencil');
    _els.toolEraser = _el('button', 'hw-studio-tool', '🧽 Eraser');
    _els.toolMove = _el('button', 'hw-studio-tool', '✋ Move');
    [_els.toolPencil, _els.toolEraser, _els.toolMove].forEach(function (b) { b.type = 'button'; });
    _els.toolPencil.addEventListener('click', function () { _setTool('pencil'); });
    _els.toolEraser.addEventListener('click', function () { _setTool('eraser'); });
    _els.toolMove.addEventListener('click', function () { _setTool('move'); });
    tools.appendChild(_els.toolPencil);
    tools.appendChild(_els.toolEraser);
    tools.appendChild(_els.toolMove);
    const keepRow = _el('div', 'hw-studio-row');
    const keepBtn = _el('button', 'hw-studio-btn hw-studio-btn-gold', '🌟 Keep it');
    keepBtn.type = 'button';
    keepBtn.addEventListener('click', _keep);
    const againBtn = _el('button', 'hw-studio-btn', '📷 Show me again');
    againBtn.type = 'button';
    againBtn.addEventListener('click', _showCamera);
    keepRow.appendChild(keepBtn);
    keepRow.appendChild(againBtn);
    _els.checkWrap.appendChild(tools);
    _els.checkWrap.appendChild(_els.checkCanvas);
    _els.checkWrap.appendChild(keepRow);
    panel.appendChild(_els.checkWrap);
    panel.appendChild(_els.quiet);
    _wireCheckCanvas();

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
      _els.quiet.textContent = 'This computer has no camera I can use — your letters are waiting whenever there is one.';
    }
    document.body.appendChild(_modal);
  }

  // ---- open / close ----------------------------------------------------------
  // open({ch, onKept, edit}) — edit:true opens the check screen holding
  // the KEPT ink (Fix it up); otherwise the camera opens armed.
  function open(opts) {
    if (_modal) close();
    _opts = opts || {};
    _state = { ch: String(_opts.ch || 'a'), check: null, saving: false };
    _build();
    if (_opts.edit && typeof HandwritingStore !== 'undefined') {
      const rec = HandwritingStore.get(_state.ch);
      if (rec && rec.glyph && rec.glyph.png) {
        _els.camWrap.style.display = 'none';
        _pngToGlyph(rec.glyph.png, rec.glyph.w, rec.glyph.h)
          .then(function (glyph) { if (_state) _enterCheck(glyph); })
          .catch(function () { if (_state) _showCamera(); });
        return;
      }
    }
    _showCamera();
  }
  function close() {
    _stopLive();
    try { BIACamera.closePanel(); } catch (e) {}
    try { BIACamera.stopTracks(); } catch (e) {}
    try { BIACamera.setPreferredShape('wide'); } catch (e) {}
    _fixing = false; _lastPt = null; _moving = null; _banding = null;
    if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal);
    _modal = null; _els = null; _state = null;
  }

  const api = { open: open, close: close, isOpen: function () { return !!_modal; } };
  try { window.HandwritingStudio = api; window.__hwStudio = api; } catch (e) {}
})();
