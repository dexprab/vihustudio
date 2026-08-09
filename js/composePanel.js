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
   composites by hand in a raw Uint8ClampedArray and encodes via
   PngEncoder — never through a <canvas> readback, because canvas
   backing stores are premultiplied and corrupt RGB at partial
   alpha. The on-screen compose canvas is DRAW-only (no readback),
   which is safe.
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
  var _pngEncoder = null;    /* PngEncoder (buffer -> PNG blob)    */
  var _onUsePicture = null;  /* function(payload) — the final bake */

  /* Panel DOM (built lazily, once). */
  var _panel = null;
  var _canvas = null;
  var _statusEl = null;
  var _fillColorInput = null;
  var _modeBtns = {};

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
       the stage. Painting/interaction arrive in Stage 3. */
    var canvasWrap = _el('div', 'compose-panel-canvas-wrap checkerboard');
    _canvas = document.createElement('canvas');
    _canvas.className = 'compose-panel-canvas';
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
  }

  /* Stage 4 fills this in. */
  function _scaleSelected(factor) {
    void factor;
  }

  /* Stage 6 fills this in — the hand-composite bake. */
  function _usePicture() {
  }

  /* ---------------------------------------------------------- */
  /* Public API                                                  */
  /* ---------------------------------------------------------- */

  function configure(opts) {
    opts = opts || {};
    if (opts.mount) _mount = opts.mount;
    if (opts.tileEditor) _tileEditor = opts.tileEditor;
    if (opts.pngEncoder) _pngEncoder = opts.pngEncoder;
    if (typeof opts.onUsePicture === 'function') _onUsePicture = opts.onUsePicture;
  }

  /* pixelBuffers: [{data,width,height}, ...] — COPIES belong to
     the caller; we lay them out but never mutate them in place
     (fill operates on a copy, Stage 5). */
  function open(pixelBuffers) {
    if (!_mount || !pixelBuffers || pixelBuffers.length < 2) return false;
    _ensureDom();
    _state = {
      tiles: _initialLayout(pixelBuffers),
      mode: 'move',
      selected: null,
      drag: null
    };
    _setMode('move');
    _panel.classList.remove('hidden');
    return true;
  }

  function close() {
    _state = null;
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
