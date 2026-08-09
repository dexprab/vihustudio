/* ============================================================
   Compose Panel — Ask B of the Cut Out Objects tool.

   "to draw a composite image open a side panel. this way the
    orignal edit is not lost." — the panel lives BESIDE the
   picture in Image Studio's Edit view. The child arranges the
   cutouts they picked (move / resize / fill colour per tile) and
   only "Use This Picture" ever commits anything; until then the
   picture on the stage is completely untouched.

   Deliberately a separate module from js/pictureStudio.js (that
   file is ~3,700 lines already): pictureStudio hands us the
   picked tiles plus its own dependencies via configure() and one
   callback, and we never reach into its closure. Mirrors the
   contextPanel/objectStrip configure({...}) host-binding pattern.

   Classic script, no build step — window.ComposePanel is the API.

   Pixel discipline (this tool's founding rule): the final bake
   composites by hand in a raw Uint8ClampedArray — never through a
   <canvas> readback, because canvas backing stores are premultiplied
   and corrupt RGB at partial alpha. The on-screen compose canvas is
   DRAW-only (no readback), which is safe. Nothing here encodes a PNG:
   pictureStudio's own _applyComposedPicture takes the raw buffer
   straight into _swapWorkingBuffer, so encoding would be work thrown
   away a line later.
   ============================================================ */
(function () {
  'use strict';

  /* Layout constants — same shelf-pack feel as the old one-shot
     compose, so the starting arrangement looks familiar. */
  var GAP = 12;      /* gap between tiles in the initial layout   */
  var PAD = 12;      /* padding around the composed picture       */
  var SCALE_UP = 1.25;
  var SCALE_DOWN = 0.8;
  var MIN_SCALE = 0.1;
  var MAX_SCALE = 8;
  var FILL_TOLERANCE = 32; /* matches the Colour Fill tool's own  */

  /* Host bindings, handed in once via configure(). */
  var _mount = null;         /* element the panel DOM lives in     */
  var _tileEditor = null;    /* TileEditor (pure ops)              */
  var _onUsePicture = null;  /* function(payload) — the final bake */

  /* Panel DOM (built lazily, once). */
  var _panel = null;
  var _canvas = null;
  var _ctx = null;
  var _statusEl = null;
  var _fillColorInput = null;
  var _modeBtns = {};

  /* One reusable offscreen canvas per tile, keyed by the tile's own
     pixel buffer. A raw Uint8ClampedArray cannot be drawn directly —
     it has to go through putImageData first — so caching the scratch
     canvas keeps a drag from re-uploading every tile on every frame. */
  var _tileCanvases = null;

  /* Compose state — nothing here touches the real picture.
     tiles: [{ pb:{data,width,height}, x, y, scale }]
     mode:  'move' | 'fill'
     selected: index into tiles, or null. */
  var _state = null;

  /* ---------------------------------------------------------- */
  /* DOM                                                         */
  /* ---------------------------------------------------------- */

  function _el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text) d.textContent = text;
    return d;
  }

  function _btn(cls, text, onClick) {
    var b = _el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
    return b;
  }

  function _ensureDom() {
    if (_panel || !_mount) return;

    _panel = _el('div', 'picture-studio-compose-panel hidden');

    var head = _el('div', 'compose-panel-head');
    head.appendChild(_el('div', 'compose-panel-title', '🧩 Your New Picture'));
    _statusEl = _el('p', 'picture-studio-subpanel-hint',
      'Tap a piece to pick it, then move it around.');
    head.appendChild(_statusEl);
    _panel.appendChild(head);

    /* The compose surface. Checkerboard = transparency, same as
       the stage. */
    var canvasWrap = _el('div', 'compose-panel-canvas-wrap checkerboard');
    _canvas = document.createElement('canvas');
    _canvas.className = 'compose-panel-canvas';
    _ctx = _canvas.getContext('2d');
    _wireCanvas();
    canvasWrap.appendChild(_canvas);
    _panel.appendChild(canvasWrap);

    /* Mode toggle: Move / Fill. */
    var modeRow = _el('div', 'compose-panel-row');
    _modeBtns.move = _btn('compose-panel-mode-btn active', '↔ Move', function () { _setMode('move'); });
    _modeBtns.fill = _btn('compose-panel-mode-btn', '🪣 Fill', function () { _setMode('fill'); });
    modeRow.appendChild(_modeBtns.move);
    modeRow.appendChild(_modeBtns.fill);
    _fillColorInput = document.createElement('input');
    _fillColorInput.type = 'color';
    _fillColorInput.value = '#e63946';
    _fillColorInput.className = 'picture-studio-color-input compose-panel-fill-color hidden';
    modeRow.appendChild(_fillColorInput);
    _panel.appendChild(modeRow);

    /* Size buttons — act on the selected tile (Stage 4). */
    var sizeRow = _el('div', 'compose-panel-row');
    sizeRow.appendChild(_btn('compose-panel-size-btn', '⬆ Bigger', function () { _scaleSelected(SCALE_UP); }));
    sizeRow.appendChild(_btn('compose-panel-size-btn', '⬇ Smaller', function () { _scaleSelected(SCALE_DOWN); }));
    _panel.appendChild(sizeRow);

    /* Actions. */
    var actRow = _el('div', 'compose-panel-row');
    actRow.appendChild(_btn('compose-panel-use-btn', '✓ Use This Picture', function () { _usePicture(); }));
    actRow.appendChild(_btn('compose-panel-close-btn', '✕ Close', function () { close(); }));
    _panel.appendChild(actRow);

    _mount.appendChild(_panel);
  }

  /* ---------------------------------------------------------- */
  /* State                                                       */
  /* ---------------------------------------------------------- */

  /* Shelf-pack the tiles into a pleasing starting arrangement —
     same target-width heuristic the one-shot compose used, so
     the panel opens looking like the old result rather than a
     pile in the corner. */
  function _initialLayout(pixelBuffers) {
    var widest = 0, area = 0, i;
    for (i = 0; i < pixelBuffers.length; i++) {
      widest = Math.max(widest, pixelBuffers[i].width);
      area += pixelBuffers[i].width * pixelBuffers[i].height;
    }
    var target = Math.max(widest, Math.round(Math.sqrt(area) * 1.3));
    var tiles = [];
    var rowX = 0, rowY = 0, rowH = 0;
    for (i = 0; i < pixelBuffers.length; i++) {
      var pb = pixelBuffers[i];
      if (rowX > 0 && (rowX + GAP + pb.width) > target) {
        rowY += rowH + GAP;
        rowX = 0;
        rowH = 0;
      }
      tiles.push({ pb: pb, x: PAD + rowX, y: PAD + rowY, scale: 1 });
      rowX += (rowX > 0 ? GAP : 0) + pb.width;
      rowH = Math.max(rowH, pb.height);
    }
    return tiles;
  }

  function _setMode(mode) {
    if (!_state) return;
    _state.mode = mode;
    _modeBtns.move.classList.toggle('active', mode === 'move');
    _modeBtns.fill.classList.toggle('active', mode === 'fill');
    _fillColorInput.classList.toggle('hidden', mode !== 'fill');
    _statusEl.textContent = mode === 'fill'
      ? 'Pick a colour, then tap a piece to fill it.'
      : 'Tap a piece to pick it, then move it around.';
    _paint();
  }

  /* ---------------------------------------------------------- */
  /* Painting                                                    */
  /* ---------------------------------------------------------- */

  /* A tile's pixels live in a raw Uint8ClampedArray, which drawImage
     cannot take — it has to become an ImageData on a canvas first.
     That upload is the expensive part, so each buffer keeps its own
     scratch canvas and a drag just re-draws the cached ones. */
  function _tileCanvas(pb) {
    if (!_tileCanvases) _tileCanvases = new Map();
    var c = _tileCanvases.get(pb);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = pb.width;
    c.height = pb.height;
    var g = c.getContext('2d');
    var img = g.createImageData(pb.width, pb.height);
    img.data.set(pb.data);
    g.putImageData(img, 0, 0);
    _tileCanvases.set(pb, c);
    return c;
  }

  /* Where a tile sits on the compose surface, at its current scale. */
  function _tileRect(t) {
    return {
      x: t.x,
      y: t.y,
      w: Math.max(1, Math.round(t.pb.width * t.scale)),
      h: Math.max(1, Math.round(t.pb.height * t.scale))
    };
  }

  /* The surface grows to hold whatever the child has arranged, so
     dragging a piece out to the right doesn't clip it. */
  function _surfaceSize() {
    var w = 1, h = 1, i, r;
    for (i = 0; i < _state.tiles.length; i++) {
      r = _tileRect(_state.tiles[i]);
      w = Math.max(w, r.x + r.w);
      h = Math.max(h, r.y + r.h);
    }
    return { w: w + PAD, h: h + PAD };
  }

  function _paint() {
    if (!_state || !_ctx) return;
    var size = _surfaceSize();
    if (_canvas.width !== size.w) _canvas.width = size.w;
    if (_canvas.height !== size.h) _canvas.height = size.h;

    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    for (var i = 0; i < _state.tiles.length; i++) {
      var t = _state.tiles[i];
      var r = _tileRect(t);
      _ctx.drawImage(_tileCanvas(t.pb), r.x, r.y, r.w, r.h);
    }

    /* Selection ring, drawn last so it sits over every tile. */
    if (_state.selected != null && _state.tiles[_state.selected]) {
      var sr = _tileRect(_state.tiles[_state.selected]);
      _ctx.save();
      _ctx.strokeStyle = '#FFCB45';
      _ctx.lineWidth = 2;
      _ctx.setLineDash([6, 4]);
      _ctx.strokeRect(sr.x - 1, sr.y - 1, sr.w + 2, sr.h + 2);
      _ctx.restore();
    }
  }

  /* ---------------------------------------------------------- */
  /* Interaction                                                 */
  /* ---------------------------------------------------------- */

  /* The canvas is laid out at width:100%, so a pointer's client
     coords have to be scaled back into canvas pixels before they
     mean anything. */
  function _canvasPoint(e) {
    var box = _canvas.getBoundingClientRect();
    if (!box.width || !box.height) return { x: 0, y: 0 };
    return {
      x: (e.clientX - box.left) * (_canvas.width / box.width),
      y: (e.clientY - box.top) * (_canvas.height / box.height)
    };
  }

  /* Topmost first, and transparent pixels don't count — tapping the
     gap inside a ring shape should reach whatever is behind it
     rather than grabbing the ring's bounding box. */
  function _hitTile(pt) {
    for (var i = _state.tiles.length - 1; i >= 0; i--) {
      var t = _state.tiles[i];
      var r = _tileRect(t);
      if (pt.x < r.x || pt.y < r.y || pt.x >= r.x + r.w || pt.y >= r.y + r.h) continue;
      var sx = Math.min(t.pb.width - 1, Math.floor((pt.x - r.x) / t.scale));
      var sy = Math.min(t.pb.height - 1, Math.floor((pt.y - r.y) / t.scale));
      if (t.pb.data[(sy * t.pb.width + sx) * 4 + 3] > 8) return i;
    }
    return null;
  }

  function _wireCanvas() {
    _canvas.addEventListener('pointerdown', function (e) {
      if (!_state) return;
      var pt = _canvasPoint(e);
      var hit = _hitTile(pt);
      _state.selected = hit;
      if (hit == null) { _paint(); return; }

      e.preventDefault();
      if (_state.mode === 'fill') { _fillTile(hit, pt); return; }

      var t = _state.tiles[hit];
      _state.drag = { index: hit, dx: pt.x - t.x, dy: pt.y - t.y };
      try { _canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      _paint();
    });

    _canvas.addEventListener('pointermove', function (e) {
      if (!_state || !_state.drag) return;
      e.preventDefault();
      var pt = _canvasPoint(e);
      var t = _state.tiles[_state.drag.index];
      /* Never below zero — the surface only grows down and right,
         so a negative origin would slide the tile out of frame. */
      t.x = Math.max(0, Math.round(pt.x - _state.drag.dx));
      t.y = Math.max(0, Math.round(pt.y - _state.drag.dy));
      _paint();
    });

    function endDrag(e) {
      if (!_state || !_state.drag) return;
      _state.drag = null;
      try { _canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    }
    _canvas.addEventListener('pointerup', endDrag);
    _canvas.addEventListener('pointercancel', endDrag);
  }

  /* Fill works on a COPY of the tile's pixel buffer, never in place. The
     buffers handed to open() are the extractor's own — the results grid still
     holds them, and Cancel has to leave every one of them exactly as it found
     them. TileEditor.bucketFill is already pure (returns a new buffer), so the
     copy is only about not swapping the tile's reference for something the
     grid no longer recognises... which it would be, since the tile's own pb
     object is the Map key _tileCanvas() caches on. Replacing pb wholesale
     means the next _paint() uploads the filled pixels fresh, which is exactly
     what we want, and the stale entry is dropped with the rest on close(). */
  function _fillTile(index, pt) {
    if (!_state || !_tileEditor || !_tileEditor.bucketFill) return;
    var t = _state.tiles[index];
    if (!t || !pt) return;
    var r = _tileRect(t);
    /* pt is in canvas space; bucketFill wants source pixels. */
    var sx = Math.floor((pt.x - r.x) / t.scale);
    var sy = Math.floor((pt.y - r.y) / t.scale);
    if (sx < 0 || sy < 0 || sx >= t.pb.width || sy >= t.pb.height) return;
    var color = (_fillColorInput && _fillColorInput.value) || '#e63946';
    var next;
    try {
      next = _tileEditor.bucketFill(t.pb, sx, sy, color, FILL_TOLERANCE);
    } catch (e) {
      return;
    }
    if (!next || !next.data) return;
    /* Drop just this tile's cached upload — the key is the old pb object. */
    if (_tileCanvases) _tileCanvases.delete(t.pb);
    t.pb = next;
    _paint();
  }

  /* Bigger / Smaller act on whichever tile is currently picked. Scaling
     anchors at the tile's existing top-left, which is the same corner
     _tileRect() measures from and _surfaceSize() grows around — so a tile
     that grows simply pushes the surface out, and x/y stay non-negative
     with no extra clamping. Scaling about the tile's centre would feel a
     little more natural but would need x/y adjusted and re-clamped to
     zero, for no real gain on a small arrangement canvas. */
  function _scaleSelected(factor) {
    if (!_state || _state.selected === null) return;
    var t = _state.tiles[_state.selected];
    if (!t) return;
    var next = t.scale * factor;
    if (next < MIN_SCALE) next = MIN_SCALE;
    if (next > MAX_SCALE) next = MAX_SCALE;
    if (next === t.scale) return;
    t.scale = next;
    _paint();
  }

  /* The bake — the only destructive step in the whole panel, and the
     only one that ever leaves it.

     Composited by hand in a raw Uint8ClampedArray rather than by
     drawing the tiles onto a canvas and reading it back: a canvas
     backing store is premultiplied, so a readback mangles RGB wherever
     alpha is partial — exactly the fringe pixels a cutout is made of.
     That is this tool family's founding rule and the reason the
     extractor's own PngEncoder keeps a canvas out of its write path.

     Sampling is nearest-neighbour on purpose. Bilinear would invent
     partial alpha along every edge, softening the very cutouts the
     extractor worked to give clean boundaries. At the default scale of
     1 the mapping is exactly 1:1 (r.w === sw, so sx === dx) and no
     resampling happens at all. The consequence, disclosed rather than
     hidden: the on-screen preview uses drawImage and so looks slightly
     smoother than the bake at non-1 scales.

     No close() here — pictureStudio's _applyComposedPicture ends on
     _toggleActiveTool(null), whose own hook closes the panel. */
  function _usePicture() {
    if (!_state || !_state.tiles.length || !_onUsePicture) return;

    var size = _surfaceSize();
    var W = size.w, H = size.h;
    var out = new Uint8ClampedArray(W * H * 4); /* zero-filled = transparent */

    for (var i = 0; i < _state.tiles.length; i++) {
      var t = _state.tiles[i];
      var src = t.pb;
      var sd = src.data, sw = src.width, sh = src.height;
      var r = _tileRect(t);

      for (var dy = 0; dy < r.h; dy++) {
        var oy = r.y + dy;
        if (oy < 0 || oy >= H) continue;
        var sy = Math.min(sh - 1, Math.floor(dy * sh / r.h));

        for (var dx = 0; dx < r.w; dx++) {
          var ox = r.x + dx;
          if (ox < 0 || ox >= W) continue;
          var sx = Math.min(sw - 1, Math.floor(dx * sw / r.w));

          var si = (sy * sw + sx) * 4;
          var sa = sd[si + 3];
          if (!sa) continue;

          var di = (oy * W + ox) * 4;
          if (sa === 255) {
            out[di] = sd[si];
            out[di + 1] = sd[si + 1];
            out[di + 2] = sd[si + 2];
            out[di + 3] = 255;
            continue;
          }

          /* Straight (non-premultiplied) source-over. */
          var a = sa / 255;
          var da = out[di + 3] / 255;
          var oa = a + da * (1 - a);
          if (oa <= 0) continue;
          out[di] = (sd[si] * a + out[di] * da * (1 - a)) / oa;
          out[di + 1] = (sd[si + 1] * a + out[di + 1] * da * (1 - a)) / oa;
          out[di + 2] = (sd[si + 2] * a + out[di + 2] * da * (1 - a)) / oa;
          out[di + 3] = oa * 255;
        }
      }
    }

    _onUsePicture({ data: out, width: W, height: H });
  }

  /* ---------------------------------------------------------- */
  /* Public API                                                  */
  /* ---------------------------------------------------------- */

  function configure(opts) {
    opts = opts || {};
    if (opts.mount) _mount = opts.mount;
    if (opts.tileEditor) _tileEditor = opts.tileEditor;
    if (typeof opts.onUsePicture === 'function') _onUsePicture = opts.onUsePicture;
  }

  /* pixelBuffers: [{data,width,height}, ...] — COPIES belong to
     the caller; we lay them out but never mutate them in place
     (fill operates on a copy, Stage 5). */
  function open(pixelBuffers) {
    if (!_mount || !pixelBuffers || pixelBuffers.length < 2) return false;
    _ensureDom();
    /* Drop the previous session's upload cache. Keys are pixel-buffer
       object identities, so a stale entry could never be MIS-read — but
       every one of those offscreen canvases is real memory nobody can
       reach again. */
    _tileCanvases = null;
    _state = {
      tiles: _initialLayout(pixelBuffers),
      mode: 'move',
      selected: null,
      drag: null
    };
    _setMode('move');
    _panel.classList.remove('hidden');
    /* _setMode paints, but it does so while the panel is still hidden.
       That works (painting is pure canvas-space arithmetic), so this is
       for the reader rather than the pixels: the panel is visible now,
       and the last thing open() does is draw it. */
    _paint();
    return true;
  }

  function close() {
    _state = null;
    _tileCanvases = null;
    if (_panel) _panel.classList.add('hidden');
  }

  function isOpen() {
    return !!(_state && _panel && !_panel.classList.contains('hidden'));
  }

  window.ComposePanel = {
    configure: configure,
    open: open,
    close: close,
    isOpen: isOpen
  };
})();
