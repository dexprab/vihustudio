// js/gardenRenderer.js — draws the Living Garden into the Studio's
// center pane, AROUND the play area, never over it.
//
// The sprint's constraint made geometry: this layer is an SVG child of
// <main class='preview-area'> (position:relative, overflow:hidden), and
// every element the engine hands over lives in one of three MARGIN
// BANDS — left of, right of, or above the page canvas. The bands are
// measured from the real .preview-wrapper rect on every render, so
// whatever shape the page takes (tall, wide, resized window), growth
// stays in the space the page does not use. A band narrower than
// MIN_BAND simply draws nothing — graceful, never squeezed onto the
// play area. The layer is pointer-events:none and aria-hidden: it is
// environment, not a control, and it can never intercept a tap meant
// for the page, the strip, or a panel.
//
// It is painted as the preview area's FIRST child with no z-index, so
// every real control (the canvas, the Selection Action Strip, panels)
// paints over it by ordinary document order — the attention hierarchy
// enforced as geometry, the same reasoning Decision 24 records.
//
// GROWTH ANIMATION: when the engine reports a capture, only the newly
// added elements animate — a vine segment draws itself in, a leaf
// unfolds — about 1.4s total, then the garden is completely still.
// Suppressed under prefers-reduced-motion (house rule since Decision
// 10). Re-renders (resize, reopening the Studio) animate nothing.
//
// This module reads LivingGarden.state() and knows nothing about
// captures, cards, or storage. Nothing here is a count, a level, or a
// progress indicator — it draws what the engine grew, and that is all.
(function () {
  'use strict';

  const MIN_BAND = 46;        // px — a margin thinner than this draws nothing
  const PAGE_GAP = 14;        // px of clear air kept between garden and page
  const VINE = '#6E8F6A', LEAF_A = '#8FAF87', LEAF_B = '#7CA076';
  const PETAL = '#F5C542', PETAL_C = '#E2A93C';

  let _layer = null, _pending = 0, _raf = 0;

  function _host() { return document.querySelector('main.preview-area'); }
  // The play area is the page CANVAS itself — .preview-wrapper spans
  // nearly the whole pane (measured: 748px of a 780px pane, canvas
  // 521px centered inside it), so the wrapper is the wrong reserve and
  // would leave the garden nowhere to live.
  function _page() {
    return document.querySelector('main.preview-area .preview-wrapper canvas')
        || document.querySelector('main.preview-area .preview-wrapper');
  }

  // The layer lives INSIDE .preview-wrapper, immediately after the
  // stage sky: the sky's background is opaque and spans nearly the
  // whole pane, so a layer under the wrapper would be painted over and
  // a child would never see their garden (caught by looking at the
  // suite's own screenshot, not by its counts). Document order does the
  // whole attention hierarchy: sky, then garden, then the page canvas
  // and every control — no z-index anywhere.
  function _wrapper() { return document.querySelector('main.preview-area .preview-wrapper'); }
  function _ensureLayer(wrap) {
    if (!_layer || _layer.parentNode !== wrap) {
      _layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      _layer.setAttribute('id', 'livingGardenLayer');
      _layer.setAttribute('aria-hidden', 'true');
      // width/height 100% matter: an SVG is a replaced element, so inset
    // positions it but does NOT size it — without these it stays at the
    // 300×150 default and silently clips the whole garden.
    _layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    }
    const sky = wrap.querySelector(':scope > .stage-sky');
    const want = sky ? sky.nextSibling : wrap.firstChild;
    if (_layer.parentNode !== wrap || (sky && _layer.previousElementSibling !== sky)) wrap.insertBefore(_layer, want);
    return _layer;
  }

  // The three margin bands, in WRAPPER coordinates (the layer's own
  // box), measured fresh every render against the page canvas rect.
  function _bands() {
    const wrap = _wrapper(), page = _page();
    if (!wrap || !page || page === wrap) return null;
    const h = wrap.getBoundingClientRect(), p = page.getBoundingClientRect();
    if (!p.width || !p.height || !h.width) return null;
    const left = { x: 6, y: 10, w: (p.left - h.left) - PAGE_GAP - 6, h: h.height - 20 };
    const right = { x: (p.right - h.left) + PAGE_GAP, y: 10, w: h.right - p.right - PAGE_GAP - 8, h: h.height - 20 };
    const top = { x: (p.left - h.left), y: 4, w: p.width, h: (p.top - h.top) - PAGE_GAP };
    // The play-area reserve — the hard guard below refuses ANY point
    // inside it, whatever a mid-transition band said.
    const reserve = { x0: p.left - h.left - 6, y0: p.top - h.top - 6, x1: p.right - h.left + 6, y1: p.bottom - h.top + 6 };
    return { host: h, left: left, right: right, top: top, reserve: reserve };
  }

  // INSET keeps every element's own reach (a rotated leaf tip is up to
  // ~17px) clear of the band's page-side edge — measured after a leaf
  // at u≈1 grazed the canvas by a pixel in the suite.
  const INSET = 20;
  function _map(bands, el) {
    const b = bands[el.band];
    if (!b || b.w < (el.band === 'top' ? 120 : MIN_BAND) || b.h < (el.band === 'top' ? 30 : 80)) return null;
    let pt;
    if (el.band === 'top') pt = { x: b.x + el.u * b.w, y: b.y + el.v * Math.max(1, b.h - INSET) };
    else if (el.band === 'left') pt = { x: b.x + el.u * Math.max(1, b.w - INSET), y: b.y + el.v * b.h };
    else pt = { x: b.x + INSET + el.u * Math.max(1, b.w - INSET), y: b.y + el.v * b.h };
    // Never over the play area — by construction, not by band arithmetic.
    const r = bands.reserve;
    if (pt.x > r.x0 && pt.x < r.x1 && pt.y > r.y0 && pt.y < r.y1) return null;
    return pt;
  }

  function _svg(tag, attrs) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Every decoration is built at its own LOCAL origin and positioned by
  // an OUTER group's attribute transform, while the breath animates an
  // INNER group. This split is load-bearing: a CSS transform (the
  // breath's keyframes) OVERRIDES an element's attribute transform, so
  // animating the same node that carries translate(...) tears every
  // blade off its vine and piles them at the layer origin — the
  // measured cause of the product owner's fishbone garden.
  function _place(x, y, ang, inner) {
    const outer = _svg('g', { transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + ang.toFixed(0) + ')' });
    outer.appendChild(inner);
    return outer;
  }
  function _leaf(x, y, ang, s) {
    // A real BLADE, not a fleck — rounder and fuller than the first two
    // attempts, which read as bare twigs at reading distance.
    s = s * 1.0;   // measured against a ~110px margin: 1.45 crowded it into blobs
    const g = _svg('g', {});
    g.appendChild(_svg('path', {
      d: 'M0,0 Q' + (5 * s) + ',' + (-9 * s) + ' ' + (14 * s) + ',' + (-3 * s)
       + ' Q' + (16 * s) + ',' + (-1 * s) + ' ' + (14 * s) + ',' + (1 * s)
       + ' Q' + (6 * s) + ',' + (7 * s) + ' 0,0 z',
      fill: ((x + y) | 0) % 2 ? LEAF_A : LEAF_B
    }));
    return _place(x, y, ang, g);
  }
  function _sprig(x, y, ang, s) {
    const g = _svg('g', {});
    g.appendChild(_svg('path', { d: 'M0,0 q' + (8 * s) + ',' + (-14 * s) + ' ' + (4 * s) + ',' + (-30 * s), fill: 'none', stroke: VINE, 'stroke-width': (2 * s).toFixed(1), 'stroke-linecap': 'round' }));
    g.appendChild(_svg('path', { d: 'M' + (2 * s) + ',' + (-10 * s) + ' Q' + (10 * s) + ',' + (-16 * s) + ' ' + (16 * s) + ',' + (-10 * s) + ' Q' + (9 * s) + ',' + (-5 * s) + ' ' + (2 * s) + ',' + (-10 * s) + ' z', fill: LEAF_A }));
    g.appendChild(_svg('path', { d: 'M' + (3 * s) + ',' + (-20 * s) + ' Q' + (-5 * s) + ',' + (-27 * s) + ' ' + (-11 * s) + ',' + (-21 * s) + ' Q' + (-4 * s) + ',' + (-15 * s) + ' ' + (3 * s) + ',' + (-20 * s) + ' z', fill: LEAF_B }));
    return _place(x, y, ang, g);
  }
  function _bud(x, y) {
    const g = _svg('g', {});
    g.appendChild(_svg('line', { x1: 0, y1: 0, x2: 0, y2: -6, stroke: VINE, 'stroke-width': 1.6 }));
    g.appendChild(_svg('circle', { cx: 0, cy: -8, r: 3.4, fill: PETAL }));
    return _place(x, y, 0, g);
  }
  function _flower(x, y) {
    const g = _svg('g', {});
    for (let k = 0; k < 5; k++) {
      const a = (k * 72 - 90) * Math.PI / 180;
      g.appendChild(_svg('circle', { cx: 5.5 * Math.cos(a), cy: 5.5 * Math.sin(a), r: 3.1, fill: PETAL }));
    }
    g.appendChild(_svg('circle', { cx: 0, cy: 0, r: 2.6, fill: PETAL_C }));
    return _place(x, y, 0, g);
  }
  // A ripened flower — a small amber fruit hanging from its stem, with
  // one leaf still on. The vine's late season (~55 captures on).
  function _fruit(x, y) {
    const g = _svg('g', {});
    g.appendChild(_svg('line', { x1: 0, y1: -8, x2: 0, y2: -2, stroke: VINE, 'stroke-width': 1.4 }));
    g.appendChild(_svg('circle', { cx: 0, cy: 3, r: 5, fill: '#E9A93C' }));
    g.appendChild(_svg('circle', { cx: -1.6, cy: 1.4, r: 1.4, fill: '#F5C67A' }));
    g.appendChild(_svg('ellipse', { cx: 3.5, cy: -6, rx: 3.2, ry: 2, fill: LEAF_A, transform: 'rotate(30 3.5 -6)' }));
    return _place(x, y, 0, g);
  }

  function _reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function render(opts) {
    const wrap = _wrapper();
    if (!wrap) return;
    const bands = _bands();
    if (!bands) return;
    if (typeof LivingGarden === 'undefined') return;
    const st = LivingGarden.state();
    const layer = _ensureLayer(wrap);
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!st.elements.length) return;

    const animateFrom = (opts && opts.animate && !_reducedMotion())
      ? Math.max(0, st.elements.length - (opts.added || 0)) : st.elements.length + 1;

    // Vines are drawn per band as one path through their nodes, in the
    // order they grew — a vine is a continuation, never scattered dots.
    const vineNodes = { left: [], right: [], top: [] };
    st.elements.forEach(function (el, ix) {
      if (el.k === 'vine') { const pt = _map(bands, el); if (pt) vineNodes[el.band].push({ pt: pt, ix: ix }); }
    });
    // "The growth is happening but its not living" (the product owner)
    // — the difference was ATTACHMENT: a leaf floating near a vine is
    // decoration; a leaf on a stem FROM the vine is growth. Everything
    // that can reach its band's vine joins it through a short stem.
    function _nearestVinePt(band, pt) {
      let best = null, bd = 1e9;
      (vineNodes[band] || []).forEach(function (n) {
        const d = (n.pt.x - pt.x) * (n.pt.x - pt.x) + (n.pt.y - pt.y) * (n.pt.y - pt.y);
        if (d < bd) { bd = d; best = n.pt; }
      });
      return best && bd < 48 * 48 ? best : null;
    }
    ['left', 'right', 'top'].forEach(function (band) {
      const nodes = vineNodes[band];
      if (nodes.length < 2) return;
      let d = 'M' + nodes[0].pt.x.toFixed(1) + ',' + nodes[0].pt.y.toFixed(1) + ' ';
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1].pt, b = nodes[i].pt;
        d += 'Q' + ((a.x + b.x) / 2 + (i % 2 ? 5 : -5)).toFixed(1) + ',' + ((a.y + b.y) / 2).toFixed(1)
           + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ' ';
      }
      // The growing tip carries a small curl — the gesture of a vine
      // still going somewhere, which is most of what "alive" means.
      const tip = nodes[nodes.length - 1].pt, prev = nodes[nodes.length - 2].pt;
      const tdx = tip.x - prev.x, tdy = tip.y - prev.y;
      const tl = Math.max(1, Math.hypot(tdx, tdy));
      const ux = tdx / tl, uy = tdy / tl;
      d += 'q' + (8 * ux - 6 * uy).toFixed(1) + ',' + (8 * uy + 6 * ux).toFixed(1)
         + ' ' + (2 * ux - 10 * uy).toFixed(1) + ',' + (2 * uy + 10 * ux).toFixed(1) + ' ';
      const path = _svg('path', { d: d, fill: 'none', stroke: VINE, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.92 });
      // SLOW MOTION, and only the NEW growth moves (the product owner:
      // "it looks like… something which appeared out of the blue. think
      // slow motion video… take half a second post action to start").
      // The established vine stays exactly where it was; the tail
      // segment alone grows out of the tip — hidden by dash-offset and
      // released over ~2.6s after the half-second quiet beat.
      if (nodes[nodes.length - 1].ix >= animateFrom) {
        try {
          layer.appendChild(path);
          const len = path.getTotalLength();
          const a = nodes[nodes.length - 2].pt, b2 = nodes[nodes.length - 1].pt;
          const seg = Math.min(len, Math.hypot(b2.x - a.x, b2.y - a.y) + 18);
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(seg);
          path.style.transition = 'stroke-dashoffset 2.6s ease-in-out .5s';
          requestAnimationFrame(function () { path.style.strokeDashoffset = '0'; });
          return;
        } catch (e) {}
      }
      layer.appendChild(path);
    });

    const reduced = _reducedMotion();
    st.elements.forEach(function (el, ix) {
      if (el.k === 'vine') return;
      let pt = _map(bands, el);
      if (!pt) return;
      let node = null;
      const s = el.s || 1;
      // Join the vine where one is in reach: the element sits at the
      // end of a short stem drawn from the vine's own line, oriented
      // outward — grown from it, never beside it.
      const root = _nearestVinePt(el.band, pt);
      let ang = ((el.u * 140 - 70) + (el.band === 'right' ? 140 : 0));
      if (root) {
        let dx = pt.x - root.x, dy = pt.y - root.y;
        const dl = Math.max(1, Math.hypot(dx, dy));
        dx /= dl; dy /= dl;
        const reach = Math.min(dl, 7 + 5 * s);   // blades hug the vine
        pt = { x: root.x + dx * reach, y: root.y + dy * reach };
        ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const stem = _svg('path', {
          d: 'M' + root.x.toFixed(1) + ',' + root.y.toFixed(1)
           + ' Q' + ((root.x + pt.x) / 2 + dy * 3).toFixed(1) + ',' + ((root.y + pt.y) / 2 - dx * 3).toFixed(1)
           + ' ' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1),
          fill: 'none', stroke: VINE, 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: 0.85
        });
        layer.appendChild(stem);
        // a NEW element's stem draws out of the vine after the vine's
        // own tail has mostly grown
        if (ix >= animateFrom && !reduced) {
          try {
            const sl = stem.getTotalLength();
            stem.style.strokeDasharray = String(sl);
            stem.style.strokeDashoffset = String(sl);
            stem.style.transition = 'stroke-dashoffset 1.2s ease-out 2.4s';
            requestAnimationFrame(function () { stem.style.strokeDashoffset = '0'; });
          } catch (e) {}
        }
      }
      if (el.k === 'leaf') node = _leaf(pt.x, pt.y, ang, s);
      else if (el.k === 'sprig') node = _sprig(pt.x, pt.y, (el.u - 0.5) * 40, s);
      else if (el.k === 'bud') node = _bud(pt.x, pt.y);
      else if (el.k === 'flower') node = _flower(pt.x, pt.y);
      else if (el.k === 'fruit') node = _fruit(pt.x, pt.y);
      if (!node) return;
      // The breath and the grow-in animate the INNER group only — its
      // local origin is the attachment point by construction — so the
      // outer group's positioning transform is never overridden.
      const inner = node.firstChild;
      inner.style.transformOrigin = '0px 0px';
      const breath = reduced ? '' : ('vihuGardenBreath ' + (11 + (ix % 5) * 1.7).toFixed(1) + 's ease-in-out '
        + (-(ix % 7) * 1.9).toFixed(1) + 's infinite alternate');
      if (ix >= animateFrom) {
        // The leaf unfolds LAST, slowly — after the quiet beat, the
        // vine's tail and the stem have already grown to meet it.
        inner.style.opacity = '0';
        inner.style.transition = 'opacity 1.4s ease-out 3.2s, transform 2.2s ease-out 3.2s';
        inner.style.transform = 'scale(.3)';
        requestAnimationFrame(function () { inner.style.opacity = '1'; inner.style.transform = 'scale(1)'; });
        if (breath) setTimeout(function () {
          if (inner.isConnected) { inner.style.transition = ''; inner.style.transform = ''; inner.style.animation = breath; }
        }, 6200);
      } else if (breath) {
        inner.style.animation = breath;
      }
      layer.appendChild(node);
    });
  }

  let _settle = 0, _growingUntil = 0;
  function _scheduleRender(opts) {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(function () {
      _raf = 0;
      render(opts);
      if (opts && opts.animate) _growingUntil = Date.now() + 6500;
    });
    // A transform-driven layout (the Rite's beside mode, the gateway
    // standing down) moves the canvas without firing ResizeObserver —
    // one quiet follow-up render on settled geometry covers it. It
    // WAITS OUT a growth in flight: a static re-render mid-growth would
    // rebuild the layer and cut the slow-motion short.
    clearTimeout(_settle);
    const settle = function () {
      const left = _growingUntil - Date.now();
      if (left > 0) { _settle = setTimeout(settle, left + 100); return; }
      render();
    };
    _settle = setTimeout(settle, 600);
  }

  function init() {
    const host = _host();
    if (!host) return;
    if (typeof LivingGarden !== 'undefined') {
      LivingGarden.claim();
      LivingGarden.onChange(function (ev) { _scheduleRender(ev); });
    }
    try {
      const ro = new ResizeObserver(function () { _scheduleRender(); });
      ro.observe(host);
      let observedPage = null;
      const watchPage = function () {
        const page = _page();
        if (page && page !== observedPage) { observedPage = page; ro.observe(page); _scheduleRender(); }
      };
      watchPage();
      // The editor's canvas mounts AFTER this module loads (Studio Home
      // first, then CreationFlow) — watch for it, or a reloaded Studio
      // draws nothing until the next capture.
      new MutationObserver(watchPage).observe(host, { childList: true, subtree: true });
    } catch (e) {
      window.addEventListener('resize', function () { _scheduleRender(); });
    }
    _scheduleRender();

    // Developer prototype trigger (the sprint's Plan Card 10): Author
    // Mode only — a development configuration, never a child-facing
    // control (Decision 13). Every click simulates one successful
    // capture with a fresh id.
    try {
      if (typeof PublishTarget !== 'undefined' && PublishTarget.isAuthorMode && PublishTarget.isAuthorMode()) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'gardenDevAdd';
        btn.textContent = 'Add Creation';
        btn.style.cssText = 'position:absolute;left:10px;bottom:10px;z-index:40;font-size:11px;padding:4px 10px;'
          + 'border-radius:10px;border:1px solid var(--line,#DCE3EE);background:#fff;color:#666;cursor:pointer;opacity:.75;';
        let n = 0;
        btn.addEventListener('click', function () {
          n += 1;
          document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'dev-' + Date.now() + '-' + n } }));
        });
        host.appendChild(btn);
      }
    } catch (e) {}
  }

  const api = { init: init, render: render };
  try { window.GardenRenderer = api; } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
