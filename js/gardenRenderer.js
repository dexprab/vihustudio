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
// GROWTH ANIMATION: the engine reports WHAT CHANGED — which elements
// appeared, which ones transformed without appearing, and which ones
// aged, fell, withered or went — and this animates exactly those. A vine segment draws itself in, a leaf
// unfolds, a bud opens into a flower, a flower ripens into fruit, a
// leaf swells; every one of them GLOWS while it arrives and goes dark
// again as it settles. Nothing keeps a light, so there is never a "these
// are the newest" marker to read backwards from.
//
// THE LIFE CYCLE NEVER GLOWS, and that is deliberate. The light means
// NEW GROWTH — it arrives with a thing and goes out as it settles. A
// leaf turning gold, letting go and drifting to the floor is the
// opposite event, and lighting it up would both dilute what the glow
// says and make an ending look like a reward. Aging is shown by colour
// and by movement, and by nothing else. Suppressed under
// prefers-reduced-motion (house rule since Decision 10). Re-renders
// (resize, reopening the Studio) carry no growth report at all, so they
// animate nothing and light nothing — rendering can never look like
// growing.
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

  // ---- THE LIFE CYCLE'S PALETTE -------------------------------------------
  // Autumnal, gentle, natural — never decay. The sprint is explicit: no
  // black, no brown, no disease, no drama. "This has had its time", not
  // "something bad happened". So an aging leaf is a PALE GOLD a shade
  // off its own green (deliberately subtle — §7 asks for visibly
  // different and subtle in the same sentence), a fallen one is a warm
  // autumn gold, and a dried sprig is a sage that has lost its blue.
  //
  // The phase palette is passed INTO the drawing vocabulary rather than
  // painted on afterwards, which is what keeps a settled render free of
  // inline styles — two renders still produce byte-identical markup, and
  // rendering still cannot look like growing.
  const FRESH = { A: LEAF_A, B: LEAF_B, vine: VINE, petal: PETAL, petalC: PETAL_C,
                  berry: '#E9A93C', berryHi: '#F5C67A', op: 1 };
  const PHASE_PAL = {
    // An aging leaf is a pale YELLOW-GREEN, not a gold one. The first
    // attempt used gold, and looking at the seventy-capture garden it
    // was wrong twice over: too loud for a stage the sprint asks to be
    // "visibly different but subtle", and the same hue as the flowers
    // and the fruit, so a plant halfway through its season read as one
    // yellow mass with nothing telling a bloom from an old blade. This
    // is unmistakably paler than the green beside it and unmistakably
    // not a flower.
    age:    { A: '#BCC079', B: '#ADB570', vine: '#7E9573', petal: '#F0DFA8', petalC: '#DDC489',
              berry: '#E0A552', berryHi: '#F0C689', op: 1 },
    fall:   { A: '#D9BE6E', B: '#CDB165', vine: '#93966F', petal: '#E6D4A0', petalC: '#D2BD8A',
              berry: '#D69B49', berryHi: '#E7BE84', op: 0.88 },
    wither: { A: '#B3AE83', B: '#A9A47C', vine: '#9FA279', petal: '#D9CFA6', petalC: '#C6BC96',
              berry: '#C09A64', berryHi: '#D9C79A', op: 0.9 }
  };
  function _pal(phase) { return (phase && PHASE_PAL[phase]) || FRESH; }
  // NEW GROWTH CARRIES LIGHT. Asked for by the product owner: "anything
  // which new grows should have a glow." It is the growth that glows,
  // not the garden — the light arrives with the new leaf, holds for a
  // moment, and goes out, leaving the garden exactly as it always is.
  //
  // It deliberately does NOT stay. A permanent glow on the newest
  // elements would be a marker saying "these are the latest ones", and
  // a child could count backwards from it — which is the quiet kind of
  // counter Decision 27 rules out ("no counts, scores, levels, badges,
  // progress bars, percentages, rewards, unlocks or comparisons"). The
  // garden's own rule is a growth response, then still.
  //
  // Suppressed under reduced motion for free: the growth report is
  // dropped there, so nothing is ever marked as changed.
  const GLOW = '#F5C542';
  const GLOW_ON  = 'drop-shadow(0 0 3px rgba(245,197,66,.95)) drop-shadow(0 0 10px rgba(245,197,66,.5))';
  const GLOW_OFF = 'drop-shadow(0 0 0 rgba(245,197,66,0)) drop-shadow(0 0 0 rgba(245,197,66,0))';

  let _layer = null, _raf = 0;

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
  // ---- the growth vocabulary ----------------------------------------------
  // CONTROLLED VARIETY: a restrained set of FORMS per kind, chosen by
  // the engine's seeded rng and drawn here. A form is an expression of
  // the same growth, never a new decoration — a paired leaf is still
  // ONE leaf on one stem, so the garden gains variety without gaining
  // objects and the density ceiling means exactly what it meant.
  function _blade(s, m, fill) {
    return _svg('path', {
      d: 'M0,0 Q' + (5 * s) + ',' + (m * -9 * s) + ' ' + (14 * s) + ',' + (m * -3 * s)
       + ' Q' + (16 * s) + ',' + (m * -1 * s) + ' ' + (14 * s) + ',' + (m * 1 * s)
       + ' Q' + (6 * s) + ',' + (m * 7 * s) + ' 0,0 z',
      fill: fill
    });
  }
  function _leaf(x, y, ang, s, f, pal) {
    // A real BLADE, not a fleck — rounder and fuller than the first two
    // attempts, which read as bare twigs at reading distance.
    pal = pal || FRESH;
    const g = _svg('g', {});
    const A = ((x + y) | 0) % 2 ? pal.A : pal.B;
    const B = A === pal.A ? pal.B : pal.A;
    if (f === 'pair') {
      // Two blades facing off one point. Each is SMALLER than a single
      // leaf, so a pair reads as a different gesture rather than as
      // twice the mass — measured against a ~110px margin, where two
      // full-size blades simply became a blob.
      // ±24°, measured: at ±15 the two blades overlapped so heavily
      // that a pair read as one notched leaf.
      const q = s * 0.82;
      const up = _svg('g', { transform: 'rotate(-24)' }); up.appendChild(_blade(q, 1, A));
      const dn = _svg('g', { transform: 'rotate(24)' }); dn.appendChild(_blade(q, -1, B));
      g.appendChild(up); g.appendChild(dn);
    } else if (f === 'curl') {
      // A young leaf, still uncurling — a shorter blade with the tip
      // rolled over. This is the one that reads as NEW growth.
      // A shorter blade so the curl costs no extra REACH — the play-area
      // inset is measured against a leaf tip and must not move.
      const q = s * 0.72;
      g.appendChild(_blade(q, 1, A));
      g.appendChild(_svg('path', {
        d: 'M' + (13 * q) + ',' + (-3 * q) + ' q' + (6.5 * q) + ',' + (-1.5 * q) + ' ' + (5.5 * q) + ',' + (4 * q)
         + ' q' + (-1.4 * q) + ',' + (3.6 * q) + ' ' + (-5.5 * q) + ',' + (1.6 * q),
        fill: 'none', stroke: A, 'stroke-width': Math.max(1.6, 2.6 * q).toFixed(1), 'stroke-linecap': 'round'
      }));
    } else {
      g.appendChild(_blade(s, 1, A));
    }
    return _place(x, y, ang, g);
  }
  function _sprig(x, y, ang, s, f, pal) {
    pal = pal || FRESH;
    const g = _svg('g', {});
    g.appendChild(_svg('path', { d: 'M0,0 q' + (8 * s) + ',' + (-14 * s) + ' ' + (4 * s) + ',' + (-30 * s), fill: 'none', stroke: pal.vine, 'stroke-width': (2 * s).toFixed(1), 'stroke-linecap': 'round' }));
    g.appendChild(_svg('path', { d: 'M' + (2 * s) + ',' + (-10 * s) + ' Q' + (10 * s) + ',' + (-16 * s) + ' ' + (16 * s) + ',' + (-10 * s) + ' Q' + (9 * s) + ',' + (-5 * s) + ' ' + (2 * s) + ',' + (-10 * s) + ' z', fill: pal.A }));
    g.appendChild(_svg('path', { d: 'M' + (3 * s) + ',' + (-20 * s) + ' Q' + (-5 * s) + ',' + (-27 * s) + ' ' + (-11 * s) + ',' + (-21 * s) + ' Q' + (-4 * s) + ',' + (-15 * s) + ' ' + (3 * s) + ',' + (-20 * s) + ' z', fill: pal.B }));
    if (f === 'fork') {
      // A second stem leaving the first — the smallest structural
      // variation there is, and the one that makes a stand of sprigs
      // stop looking stamped from one template.
      g.appendChild(_svg('path', { d: 'M' + (5 * s) + ',' + (-13 * s) + ' q' + (-9 * s) + ',' + (-6 * s) + ' ' + (-11 * s) + ',' + (-16 * s), fill: 'none', stroke: pal.vine, 'stroke-width': (1.6 * s).toFixed(1), 'stroke-linecap': 'round' }));
      g.appendChild(_svg('path', { d: 'M' + (-6 * s) + ',' + (-29 * s) + ' Q' + (-13 * s) + ',' + (-34 * s) + ' ' + (-17 * s) + ',' + (-27 * s) + ' Q' + (-11 * s) + ',' + (-23 * s) + ' ' + (-6 * s) + ',' + (-29 * s) + ' z', fill: pal.A }));
    }
    return _place(x, y, ang, g);
  }
  function _bud(x, y, f, pal) {
    pal = pal || FRESH;
    const g = _svg('g', {});
    if (f === 'pair') {
      g.appendChild(_svg('line', { x1: 0, y1: 0, x2: 0, y2: -4, stroke: pal.vine, 'stroke-width': 1.6 }));
      g.appendChild(_svg('path', { d: 'M0,-4 q-4,-2 -4.6,-5.5', fill: 'none', stroke: pal.vine, 'stroke-width': 1.3 }));
      g.appendChild(_svg('path', { d: 'M0,-4 q4,-2 4.4,-5', fill: 'none', stroke: pal.vine, 'stroke-width': 1.3 }));
      g.appendChild(_svg('circle', { cx: -5, cy: -11, r: 2.9, fill: pal.petal }));
      g.appendChild(_svg('circle', { cx: 4.8, cy: -10.4, r: 2.5, fill: pal.petal }));
    } else {
      g.appendChild(_svg('line', { x1: 0, y1: 0, x2: 0, y2: -6, stroke: pal.vine, 'stroke-width': 1.6 }));
      g.appendChild(_svg('circle', { cx: 0, cy: -8, r: 3.4, fill: pal.petal }));
    }
    return _place(x, y, 0, g);
  }
  function _petals(into, n, ring, pr, cr, tx, ty, pal) {
    for (let k = 0; k < n; k++) {
      const a = (k * (360 / n) - 90) * Math.PI / 180;
      into.appendChild(_svg('circle', { cx: tx + ring * Math.cos(a), cy: ty + ring * Math.sin(a), r: pr, fill: pal.petal }));
    }
    into.appendChild(_svg('circle', { cx: tx, cy: ty, r: cr, fill: pal.petalC }));
  }
  // A FADED FLOWER IS NOT A REMOVED FLOWER. The sprint is explicit: when
  // a bloom is done, the petals fall and THE STEM REMAINS, and the stem
  // goes some time later. So a withered flower still occupies its place
  // on the vine and still reads as somewhere a flower was — a bare
  // stalk with the calyx still on it, the smallest honest drawing of
  // "this has had its time".
  function _spentFlower(x, y, pal) {
    const g = _svg('g', {});
    g.appendChild(_svg('path', { d: 'M0,2 q1.5,-5 0.5,-9', fill: 'none', stroke: pal.vine, 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
    g.appendChild(_svg('path', { d: 'M-2.6,-7 q2.6,-3.4 5.2,0 q-2.6,2.2 -5.2,0 z', fill: pal.petalC }));
    return _place(x, y, 0, g);
  }
  function _flower(x, y, f, pal) {
    pal = pal || FRESH;
    if (pal === PHASE_PAL.wither) return _spentFlower(x, y, pal);
    const g = _svg('g', {});
    if (f === 'open') {
      _petals(g, 6, 6.6, 3.4, 2.9, 0, 0, pal);
    } else if (f === 'cluster') {
      _petals(g, 5, 5.5, 3.1, 2.6, 0, 0, pal);
      _petals(g, 5, 3.4, 1.9, 1.6, -9.5, 5, pal);
      _petals(g, 5, 3.1, 1.7, 1.5, 8.5, 5.5, pal);
    } else {
      _petals(g, 5, 5.5, 3.1, 2.6, 0, 0, pal);
    }
    return _place(x, y, 0, g);
  }
  // A ripened flower — a small amber fruit hanging from its stem, with
  // one leaf still on. The vine's late season (~55 captures on).
  function _fruit(x, y, f, pal) {
    pal = pal || FRESH;
    const g = _svg('g', {});
    function berry(cx, cy, r) {
      g.appendChild(_svg('circle', { cx: cx, cy: cy, r: r, fill: pal.berry }));
      g.appendChild(_svg('circle', { cx: cx - r * 0.32, cy: cy - r * 0.32, r: r * 0.28, fill: pal.berryHi }));
    }
    // A DROPPED FRUIT HAS NO STEM. It is off the vine and lying on the
    // garden floor, so the stalk and the little leaf that held it are
    // exactly what it no longer has.
    if (pal === PHASE_PAL.fall) {
      if (f === 'pair') { berry(-4, 0, 4.1); berry(4.4, 1.4, 3.4); }
      else berry(0, 0, 5);
      return _place(x, y, 0, g);
    }
    if (f === 'pair') {
      g.appendChild(_svg('path', { d: 'M0,-9 q-4,3 -4.6,6', fill: 'none', stroke: pal.vine, 'stroke-width': 1.3 }));
      g.appendChild(_svg('path', { d: 'M0,-9 q4.5,3 5,5', fill: 'none', stroke: pal.vine, 'stroke-width': 1.3 }));
      berry(-5, 1, 4.1);
      berry(5.4, 2.6, 3.4);
      g.appendChild(_svg('ellipse', { cx: 3.2, cy: -8.5, rx: 3, ry: 1.9, fill: pal.A, transform: 'rotate(30 3.2 -8.5)' }));
    } else {
      g.appendChild(_svg('line', { x1: 0, y1: -8, x2: 0, y2: -2, stroke: pal.vine, 'stroke-width': 1.4 }));
      berry(0, 3, 5);
      g.appendChild(_svg('ellipse', { cx: 3.5, cy: -6, rx: 3.2, ry: 2, fill: pal.A, transform: 'rotate(30 3.5 -6)' }));
    }
    return _place(x, y, 0, g);
  }

  function _reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // Lights one piece of new growth as it arrives, then puts the light
  // out. The two filter strings have the SAME function count so the
  // browser interpolates them rather than snapping; a bare '' at either
  // end would give a hard cut.
  //
  // It writes to the OUTER group only. The inner group carries the
  // unfold transition and later the breath animation, and the handoff
  // between those clears `style.transition` — a glow living there would
  // be cut off mid-fade.
  function _glow(el, delayMs) {
    try {
      el.style.filter = GLOW_OFF;
      el.style.transition = 'filter .9s ease-out ' + (delayMs / 1000).toFixed(2) + 's';
      requestAnimationFrame(function () { el.style.filter = GLOW_ON; });
      setTimeout(function () {
        if (!el.isConnected) return;
        el.style.transition = 'filter 2.4s ease-in-out';
        el.style.filter = GLOW_OFF;
        setTimeout(function () {
          if (!el.isConnected) return;
          // Nothing left behind: no filter, no transition, no trace
          // that this element was ever the new one.
          el.style.filter = ''; el.style.transition = '';
        }, 2500);
      }, delayMs + 1500);
    } catch (e) {}
  }

  // A TRANSFORMATION animates too. This is the whole point of the
  // Living Growth pass: a bud opening into a flower, a flower ripening
  // into fruit and a leaf filling out change the garden without
  // changing its element count, and the renderer used to be told only
  // how many elements had been ADDED. Measured on five seeds, 188 of
  // 600 captures added nothing and therefore animated nothing — every
  // capture past the density ceiling among them. `added` was the wrong
  // signal; the engine now reports WHAT CHANGED, and this draws it.
  //
  // The change animation lives on the INNER group like the unfold and
  // the breath, and the glow stays on the OUTER group — the same split
  // that keeps a CSS transform from overriding the positioning
  // attribute transform and tearing every blade off its vine.
  function _ghostOf(kind, x, y) {
    if (kind === 'bud') return _bud(x, y, 'plain', FRESH);
    if (kind === 'flower') return _flower(x, y, 'plain', FRESH);
    if (kind === 'leaf') return null;
    return null;
  }

  // A ghost of ANY element, in any phase — what the life cycle needs to
  // show something GIVING WAY rather than blinking out. Used three ways:
  // the green leaf that fades to reveal the gold one underneath (a
  // colour transition drawn as a cross-fade, so a settled render keeps
  // no inline styles and two renders stay byte-identical); the petalled
  // flower that fades and sinks as its stem is left behind; and the last
  // sight of an element that has gone, fading where it lay.
  function _ghostEl(el, x, y, ang, phase) {
    const pal = _pal(phase);
    const s = el.s || 1;
    if (el.k === 'leaf') return _leaf(x, y, ang, s, el.f, pal);
    if (el.k === 'sprig') return _sprig(x, y, (el.u - 0.5) * 40, s, el.f, pal);
    if (el.k === 'bud') return _bud(x, y, el.f, pal);
    if (el.k === 'flower') return _flower(x, y, el.f, pal);
    if (el.k === 'fruit') return _fruit(x, y, el.f, pal);
    return null;
  }
  // A fallen thing lies roughly flat, and it lies at an angle that is
  // ITS OWN — derived from its own coordinate, so it is the same every
  // render and nothing here is deciding anything the engine did not.
  function _restAngle(el) { return (((el.u * 9973) | 0) % 46) - 23; }

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

    // Only a CAPTURE carries a growth report. A re-render (resize, the
    // Studio reopening, the settle pass) has none, so it animates and
    // lights nothing — rendering can never look like growing.
    const growth = (opts && opts.animate && !_reducedMotion() && opts.growth) ? opts.growth : null;
    const addedSet = growth ? new Set(growth.added || []) : null;
    const transSet = growth ? new Set(growth.transformed || []) : null;
    const wasKinds = (growth && growth.was) || null;
    // The LIFE CYCLE's own report. Exactly like `added` and
    // `transformed`, these are indices into the list being drawn — the
    // engine compacts before it grows, so they are never stale — and
    // `removed` carries whole descriptors, because those elements are
    // not in the list any more.
    const agedSet = growth ? new Set(growth.aged || []) : null;
    const fellSet = growth ? new Set(growth.fell || []) : null;
    const withSet = growth ? new Set(growth.withered || []) : null;
    const removedEls = (growth && growth.removed) || [];

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
    function _dashIn(path, seg, dur, delay) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(Math.min(len, seg));
      path.style.transition = 'stroke-dashoffset ' + dur + 's ease-in-out ' + delay + 's';
      requestAnimationFrame(function () { path.style.strokeDashoffset = '0'; });
      return len;
    }
    ['left', 'right', 'top'].forEach(function (band) {
      const nodes = vineNodes[band];
      // A BAND'S FIRST NODE is a new chapter, not a dot: the right vine
      // begins at its own foot around capture eighteen, and with fewer
      // than two nodes there is no path to draw at all. A short stub
      // gives that beginning something a child can actually see.
      if (nodes.length < 2) {
        if (nodes.length === 1 && band !== 'top') {
          const p0 = nodes[0].pt;
          const stub = _svg('path', {
            d: 'M' + p0.x.toFixed(1) + ',' + (p0.y + 5).toFixed(1) + ' q3,-7 0,-13',
            fill: 'none', stroke: VINE, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.92
          });
          layer.appendChild(stub);
          if (addedSet && addedSet.has(nodes[0].ix)) {
            try { _dashIn(stub, stub.getTotalLength(), 1.8, 0.5); _glow(stub, 500); } catch (e) {}
          }
        }
        return;
      }
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
      // released over ~2.6s after the half-second quiet beat. When the
      // WHOLE band is new (the top arc closing, which is the moment the
      // two sides become one garden) the entire span draws instead.
      const lastNew = addedSet && addedSet.has(nodes[nodes.length - 1].ix);
      if (lastNew) {
        try {
          layer.appendChild(path);
          const wholeNew = nodes.every(function (n) { return addedSet.has(n.ix); });
          const len = path.getTotalLength();
          const a = nodes[nodes.length - 2].pt, b2 = nodes[nodes.length - 1].pt;
          const seg = wholeNew ? len : Math.min(len, Math.hypot(b2.x - a.x, b2.y - a.y) + 18);
          _dashIn(path, seg, wholeNew ? 3.2 : 2.6, 0.5);
          // The light travels with the tip. A SECOND path over the same
          // line, dashed so only the NEW tail segment is visible — the
          // established vine keeps no glow at all, which is the whole
          // point. Pattern is [dash 0][gap old][dash tail][gap 0], so it
          // covers the path exactly once.
          try {
            const glowPath = _svg('path', {
              d: d, fill: 'none', stroke: GLOW, 'stroke-width': 3,
              'stroke-linecap': 'round', opacity: '0'
            });
            glowPath.style.strokeDasharray = '0 ' + Math.max(0, len - seg).toFixed(1) + ' ' + seg.toFixed(1) + ' 0';
            glowPath.style.filter = 'drop-shadow(0 0 6px rgba(245,197,66,.85))';
            glowPath.style.transition = 'opacity 1.1s ease-out .5s';
            layer.appendChild(glowPath);
            requestAnimationFrame(function () { glowPath.style.opacity = '.8'; });
            setTimeout(function () {
              if (!glowPath.isConnected) return;
              glowPath.style.transition = 'opacity 2.4s ease-in-out';
              glowPath.style.opacity = '0';
              setTimeout(function () {
                if (glowPath.parentNode) glowPath.parentNode.removeChild(glowPath);
              }, 2500);
            }, 3400);
          } catch (e) {}
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
      const isNew = !!(addedSet && addedSet.has(ix));
      const isChanged = !isNew && !!(transSet && transSet.has(ix));
      const justAged = !!(agedSet && agedSet.has(ix));
      const justFell = !!(fellSet && fellSet.has(ix));
      const justWithered = !!(withSet && withSet.has(ix));
      const pal = _pal(el.p);
      // A FALLEN THING IS OFF THE VINE. It gets no stem, no attachment
      // and no breath: it is lying on the garden floor where the engine
      // put it, at an angle of its own, waiting to fade. Everything
      // else — including a faded flower, whose stem is exactly what
      // remains — is still attached and still joins its vine.
      const down = el.p === 'fall';
      // Join the vine where one is in reach: the element sits at the
      // end of a short stem drawn from the vine's own line, oriented
      // outward — grown from it, never beside it.
      const root = down ? null : _nearestVinePt(el.band, pt);
      let ang = down ? _restAngle(el) : ((el.u * 140 - 70) + (el.band === 'right' ? 140 : 0));
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
        // own tail has mostly grown. A transformation has no new stem —
        // the thing was already attached, it is what it IS that changed.
        if (isNew && !reduced) {
          try {
            const sl = stem.getTotalLength();
            stem.style.strokeDasharray = String(sl);
            stem.style.strokeDashoffset = String(sl);
            stem.style.transition = 'stroke-dashoffset 1.2s ease-out 2.4s';
            requestAnimationFrame(function () { stem.style.strokeDashoffset = '0'; });
            _glow(stem, 2400);
          } catch (e) {}
        }
      }
      if (el.k === 'leaf') node = _leaf(pt.x, pt.y, ang, s, el.f, pal);
      else if (el.k === 'sprig') node = _sprig(pt.x, pt.y, (el.u - 0.5) * 40, s, el.f, pal);
      else if (el.k === 'bud') node = _bud(pt.x, pt.y, el.f, pal);
      else if (el.k === 'flower') node = _flower(pt.x, pt.y, el.f, pal);
      else if (el.k === 'fruit') node = _fruit(pt.x, pt.y, el.f, pal);
      if (!node) return;
      if (pal.op !== 1) node.setAttribute('opacity', String(pal.op));
      if (el.p) node.setAttribute('data-garden-phase', el.p);
      // The breath and the grow-in animate the INNER group only — its
      // local origin is the attachment point by construction — so the
      // outer group's positioning transform is never overridden.
      const inner = node.firstChild;
      inner.style.transformOrigin = '0px 0px';
      const breath = (reduced || down) ? '' : ('vihuGardenBreath ' + (11 + (ix % 5) * 1.7).toFixed(1) + 's ease-in-out '
        + (-(ix % 7) * 1.9).toFixed(1) + 's infinite alternate');
      if (justFell && !reduced) {
        // FALLING IS A REAL EVENT (§8), not visible:false. The outer
        // group is already at the LANDING point the engine chose, so
        // the inner group starts displaced to where the leaf let go and
        // travels home: a tip away from the vine, a slow drift down
        // with the blade rocking over once, and a settle. Both ends
        // were decided during replay — this only draws the journey.
        //
        // It animates the INNER group on purpose. The outer group
        // carries the attribute transform that positions it, and a CSS
        // transform on that same node overrides the attribute and tears
        // the element off its place entirely — the trap this file has
        // paid for twice.
        const from = _map(bands, { band: el.band, u: (el.o || el).u, v: (el.o || el).v });
        const dx = from ? (from.x - pt.x) : 0, dy = from ? (from.y - pt.y) : -60;
        // the stem it let go of, fading where it was
        const oldRoot = from ? _nearestVinePt(el.band, from) : null;
        if (oldRoot) {
          const gone = _svg('path', {
            d: 'M' + oldRoot.x.toFixed(1) + ',' + oldRoot.y.toFixed(1) + ' L' + from.x.toFixed(1) + ',' + from.y.toFixed(1),
            fill: 'none', stroke: VINE, 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: 0.85
          });
          layer.appendChild(gone);
          gone.style.transition = 'opacity 1.1s ease-in .35s';
          requestAnimationFrame(function () { gone.style.opacity = '0'; });
          setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 2200);
        }
        inner.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + (-ang - 16).toFixed(0) + 'deg)';
        inner.style.transition = 'none';
        requestAnimationFrame(function () {
          inner.style.transition = 'transform 1.5s cubic-bezier(.4,0,.7,.6)';
          inner.style.transform = 'translate(' + (dx * 0.42).toFixed(1) + 'px,' + (dy * 0.42).toFixed(1) + 'px) rotate(' + (-ang + 22).toFixed(0) + 'deg)';
          setTimeout(function () {
            if (!inner.isConnected) return;
            inner.style.transition = 'transform 1.6s cubic-bezier(.3,0,.4,1)';
            inner.style.transform = 'translate(0px,0px) rotate(0deg)';
            setTimeout(function () {
              if (inner.isConnected) { inner.style.transition = ''; inner.style.transform = ''; }
            }, 1800);
          }, 1500);
        });
      } else if (justAged && !reduced) {
        // GREEN → GOLD, drawn as a cross-fade rather than as a colour
        // written onto the node: the gold leaf is already there and the
        // green one it was fades off the top of it. Subtle by
        // construction — the two colours are a shade apart — and it
        // leaves no inline paint behind, so a re-render of a settled
        // garden is still byte-identical markup.
        const was = _ghostEl(el, pt.x, pt.y, ang, null);
        if (was) {
          was.setAttribute('data-garden-ghost', 'age');
          layer.appendChild(was);
          was.style.transition = 'opacity 2s ease-in-out .3s';
          requestAnimationFrame(function () { was.style.opacity = '0'; });
          setTimeout(function () { if (was.parentNode) was.parentNode.removeChild(was); }, 2600);
        }
        if (breath) inner.style.animation = breath;
      } else if (justWithered && !reduced) {
        // The petals go and the stem stays. What fades is the bloom it
        // was, sinking a little as it goes — petals dropping, without
        // one new object being added to the garden to draw them.
        const was = _ghostEl(el, pt.x, pt.y, ang, 'age');
        if (was) {
          was.setAttribute('data-garden-ghost', 'wither');
          layer.appendChild(was);
          const wi = was.firstChild;
          wi.style.transformOrigin = '0px 0px';
          wi.style.transition = 'opacity 1.6s ease-in .2s, transform 1.6s ease-in .2s';
          requestAnimationFrame(function () { wi.style.opacity = '0'; wi.style.transform = 'translate(0px,7px) scale(.7)'; });
          setTimeout(function () { if (was.parentNode) was.parentNode.removeChild(was); }, 2200);
        }
        inner.style.animation = 'vihuGardenOpen 1.4s ease-out .5s both';
        if (breath) setTimeout(function () {
          if (inner.isConnected) { inner.style.transition = ''; inner.style.transform = ''; inner.style.animation = breath; }
        }, 2200);
      } else if (isNew && !reduced) {
        // The leaf unfolds LAST, slowly — after the quiet beat, the
        // vine's tail and the stem have already grown to meet it.
        inner.style.opacity = '0';
        inner.style.transition = 'opacity 1.4s ease-out 3.2s, transform 2.2s ease-out 3.2s';
        inner.style.transform = 'scale(.3)';
        requestAnimationFrame(function () { inner.style.opacity = '1'; inner.style.transform = 'scale(1)'; });
        // The new leaf arrives already lit, and the light goes out as
        // it settles into the garden.
        _glow(node, 3200);
        if (breath) setTimeout(function () {
          if (inner.isConnected) { inner.style.transition = ''; inner.style.transform = ''; inner.style.animation = breath; }
        }, 6200);
      } else if (isChanged && !reduced) {
        // WHAT IT WAS fades where it stood while what it became opens
        // in its place — a bud actually opening rather than a flower
        // appearing where a bud used to be. Only a genuine change of
        // kind gets a ghost; a fruit becoming a pair does not sprout a
        // phantom flower.
        const was = wasKinds ? wasKinds[ix] : null;
        if (was && was !== el.k) {
          const ghost = _ghostOf(was, pt.x, pt.y);
          if (ghost) {
            // Named so the suite can prove the bud was actually SHOWN
            // opening rather than the flower simply appearing.
            ghost.setAttribute('data-garden-ghost', was);
            layer.appendChild(ghost);
            const gi = ghost.firstChild;
            gi.style.transformOrigin = '0px 0px';
            gi.style.transition = 'opacity .9s ease-in .55s, transform .9s ease-in .55s';
            requestAnimationFrame(function () { gi.style.opacity = '0'; gi.style.transform = 'scale(.45)'; });
            setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 2400);
          }
        }
        // A leaf filling out SWELLS where it stands; anything opening
        // into something else OPENS. Both are short, local and quiet —
        // no burst, no particles, nothing that reads as a reward.
        const swell = (el.k === 'leaf' && !was);
        inner.style.animation = (swell ? 'vihuGardenSwell 1.5s' : 'vihuGardenOpen 1.7s') + ' ease-out .6s both';
        _glow(node, 600);
        if (breath) setTimeout(function () {
          if (inner.isConnected) { inner.style.transition = ''; inner.style.transform = ''; inner.style.animation = breath; }
        }, 2600);
      } else if (breath) {
        inner.style.animation = breath;
      }
      layer.appendChild(node);
    });

    // AND THE LAST SIGHT OF WHAT HAS GONE. These elements are no longer
    // in the garden — the engine removed them before it grew — so they
    // arrive as descriptors rather than indices and are drawn once,
    // where they lay, fading. A slight fade and then nothing: no
    // shrivel, no drama, no message. "This has had its time."
    if (removedEls.length && !reduced) {
      removedEls.forEach(function (el) {
        const pt = _map(bands, el);
        if (!pt) return;
        const ghost = _ghostEl(el, pt.x, pt.y, el.p === 'fall' ? _restAngle(el) : 0, el.p || 'fall');
        if (!ghost) return;
        ghost.setAttribute('data-garden-ghost', 'gone');
        layer.appendChild(ghost);
        const gi = ghost.firstChild;
        gi.style.transformOrigin = '0px 0px';
        gi.style.transition = 'opacity 1.8s ease-in .4s, transform 1.8s ease-in .4s';
        requestAnimationFrame(function () { gi.style.opacity = '0'; gi.style.transform = 'scale(.82)'; });
        setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 2600);
      });
    }
  }

  let _settle = 0, _growingUntil = 0, _liveGrowth = null;
  // A GROWTH RESPONSE OUTRANKS A RE-RENDER, and this is the whole of
  // that rule. Both paths go through one rAF and the last caller used to
  // win, so a plain re-render — a ResizeObserver firing as the right
  // panel's banner appears, a window nudge, the MutationObserver
  // noticing the canvas — could land in the same frame as a capture and
  // replace the animated render, or land a moment after it and rebuild
  // the layer with the animation stripped out. Either way the child got
  // nothing back for their creation. Measured as an unanswered capture
  // in the suite's twenty-in-a-row run.
  //
  // So the growth report stays LIVE for as long as its animation does:
  // any plain render inside that window redraws with it rather than
  // without it. Geometry is therefore always correct — a real resize
  // still re-renders immediately — and the growth is never swallowed.
  // The window is anchored to the capture, not to the re-render, so a
  // stream of resizes cannot extend it.
  function _scheduleRender(opts) {
    if (opts && opts.animate && opts.growth) {
      _liveGrowth = opts;
      // Long enough for the LIGHT to go out too, not just the growth to
      // finish — a settle re-render at 6.5s would rebuild the layer
      // mid-fade and snuff every glow at once.
      _growingUntil = Date.now() + 8800;
    }
    const use = (opts && opts.animate) ? opts
      : ((_liveGrowth && Date.now() < _growingUntil) ? _liveGrowth : (opts || null));
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(function () { _raf = 0; render(use); });
    // A transform-driven layout (the Rite's beside mode, the gateway
    // standing down) moves the canvas without firing ResizeObserver —
    // one quiet follow-up render on settled geometry covers it. It
    // WAITS OUT a growth in flight: a static re-render mid-growth would
    // rebuild the layer and cut the slow-motion short.
    clearTimeout(_settle);
    const settle = function () {
      const left = _growingUntil - Date.now();
      if (left > 0) { _settle = setTimeout(settle, left + 100); return; }
      _liveGrowth = null;
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
