/* HW FONT — from ink patches to a real font file.
 *
 * The tracer is OUR OWN: pixel-edge contour following (marching squares
 * on the binary mask, expressed as directed pixel-side edges chained
 * into loops), Douglas–Peucker simplification, then a quadratic fit —
 * every simplified vertex becomes an off-curve control point with
 * on-curve points at segment midpoints, the classic TrueType implied
 * on-curve construction. No CDN, no image generation, no AI: the
 * outlines are traced from the child's own ink and nothing else.
 *
 * Disclosed, owner-accepted cost: a vector outline flattens the pencil
 * GRAIN — the texture inside a stroke is gone. The SHAPES are the
 * child's, exactly as traced.
 *
 * Assembly is vendor/opentype.min.js (opentype.js 2.0.0, MIT — vendored,
 * see vendor/README.md). It writes an OpenType font with CFF outlines;
 * our quadratics are converted by the library. Byte-determinism (the
 * suite asserts rebuild-identical): createdTimestamp is pinned AND Date
 * is shimmed around the one toArrayBuffer() call, because
 * makeHeadTable() stamps head.modified with the current time.
 *
 * METRICS are measured, never assumed:
 *   · baseline — the sheet's printed rule, per glyph (hwRead measured
 *     where the rule crosses each patch);
 *   · x-height — median ink height of the x-class letters, mapped to
 *     500/1000 units;
 *   · cap-height — median ink height of the child's own capitals
 *     (ascender fallback only when no capital was captured at all);
 *   · advance — the glyph's own ink width plus the letter gap MEASURED
 *     inside the child's own words;
 *   · space — the median word gap the child actually left.
 * A letter that was never captured is simply ABSENT from the cmap, so
 * text falls back to the next font in the stack — never a blank glyph.
 */
(function () {
  'use strict';

  const UPEM = 1000;
  const XHEIGHT_UNITS = 500;
  const CREATED = 1735689600; // 2025-01-01T00:00:00Z — pinned for determinism

  const XCLASS = 'acemnorsuvwxz';       // letters whose ink top ≈ x-height
  const DESCENDER = 'gjpqy';            // letters whose ink dips below the rule
  const CAPS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // ---- contour tracing -------------------------------------------------------
  /* Directed pixel-side edges with the ink on the LEFT, chained into
   * closed loops. Vertices are pixel corners: (x, y) in [0..w]×[0..h]. */
  function traceLoops(mask, w, h) {
    const at = (x, y) => (x >= 0 && x < w && y >= 0 && y < h && mask[y * w + x] === 1);
    // edge key: (x, y, dir) — dir 0:left(-x) 1:down(+y) 2:right(+x) 3:up(-y)
    const DX = [-1, 0, 1, 0], DY = [0, 1, 0, -1];
    const edges = new Map(); // fromVertexKey → array of dirs
    const used = new Set();
    const vkey = (x, y) => x * (h + 1) + y;
    function addEdge(x, y, dir) {
      const k = vkey(x, y);
      let a = edges.get(k);
      if (!a) { a = []; edges.set(k, a); }
      a.push(dir);
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        if (!at(x, y - 1)) addEdge(x + 1, y, 0);       // top side, going left
        if (!at(x, y + 1)) addEdge(x, y + 1, 2);       // bottom side, going right
        if (!at(x - 1, y)) addEdge(x, y, 1);           // left side, going down
        if (!at(x + 1, y)) addEdge(x + 1, y + 1, 3);   // right side, going up
      }
    }
    const loops = [];
    for (const [startK, dirs] of edges) {
      for (const startDir of dirs) {
        const ek0 = startK * 4 + startDir;
        if (used.has(ek0)) continue;
        let x = Math.floor(startK / (h + 1)), y = startK % (h + 1);
        let dir = startDir;
        const pts = [];
        while (true) {
          const ek = vkey(x, y) * 4 + dir;
          if (used.has(ek)) break;
          used.add(ek);
          pts.push([x, y]);
          x += DX[dir]; y += DY[dir];
          const avail = edges.get(vkey(x, y)) || [];
          // prefer the sharpest LEFT turn so touching corners stay
          // separate loops (deterministic tie-break)
          let next = -1;
          for (const turn of [1, 0, 3]) { // left, straight, right (mod 4)
            const d = (dir + turn) % 4;
            if (avail.includes(d) && !used.has(vkey(x, y) * 4 + d)) { next = d; break; }
          }
          if (next < 0) break;
          dir = next;
        }
        if (pts.length >= 4) loops.push(pts);
      }
    }
    return loops;
  }

  // Drop collinear points, then Douglas–Peucker.
  function simplify(pts, eps) {
    const collapsed = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) collapsed.push(b);
    }
    if (collapsed.length < 4) return collapsed;
    // RDP on a closed loop: split at the point farthest from point 0,
    // simplify the two open chains, concatenate.
    let bi = 0, best = -1;
    for (let i = 0; i < collapsed.length; i++) {
      const dx = collapsed[i][0] - collapsed[0][0], dy = collapsed[i][1] - collapsed[0][1];
      const d = dx * dx + dy * dy;
      if (d > best) { best = d; bi = i; }
    }
    const wrapped = collapsed.concat([collapsed[0]]);
    const out = [];
    rdp(wrapped, 0, bi, eps, out);                  // pushes [0 .. bi)
    rdp(wrapped, bi, wrapped.length - 1, eps, out); // pushes [bi .. point0)
    return out;
  }
  function rdp(pts, i0, i1, eps, out) {
    if (i1 <= i0 + 1) { out.push(pts[i0]); return; }
    const a = pts[i0], b = pts[i1];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const len = Math.hypot(abx, aby) || 1;
    let best = -1, bi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const p = pts[i];
      const d = Math.abs((p[0] - a[0]) * aby - (p[1] - a[1]) * abx) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { rdp(pts, i0, bi, eps, out); rdp(pts, bi, i1, eps, out); }
    else out.push(pts[i0]);
  }

  function shoelace(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }
  function contains(loop, p) {
    // ray cast
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i], b = loop[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /* trace(sample) → contours in FONT-space-ready pixel coordinates:
   * [{pts, outer}] simplified loops with orientation normalised so outer
   * loops and holes wind oppositely (nonzero fill renders both). */
  function trace(sample) {
    const eps = Math.max(1.0, sample.h / 90);
    const raw = traceLoops(sample.mask, sample.w, sample.h)
      .map((l) => simplify(l, eps))
      .filter((l) => l.length >= 3);
    // containment depth decides outer vs hole
    const out = raw.map((pts, i) => {
      let depth = 0;
      for (let j = 0; j < raw.length; j++) {
        if (j !== i && contains(raw[j], pts[0])) depth++;
      }
      return { pts, outer: depth % 2 === 0 };
    });
    for (const c of out) {
      const ccw = shoelace(c.pts) < 0; // image coords, y down: negative = CCW on screen
      // outer loops one way, holes the other — relative winding is what
      // nonzero fill needs
      if (c.outer === ccw) c.pts.reverse();
    }
    return out;
  }

  // ---- metrics ---------------------------------------------------------------
  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  }

  /* measure(samples, lines) → the measured coordinate system.
   * samples: Map ch → sample (hwRead's samplePatch output). */
  function measure(samples, lines) {
    const xTops = [], allTops = [], descents = [], capTops = [];
    for (const [ch, s] of samples) {
      allTops.push(s.topAbove);
      if (XCLASS.includes(ch)) xTops.push(s.topAbove);
      if (DESCENDER.includes(ch)) descents.push(s.belowBase);
      if (CAPS.includes(ch)) capTops.push(s.topAbove);
    }
    const xHeightPx = median(xTops) || median(allTops) * 0.65 || 1;
    const scale = XHEIGHT_UNITS / xHeightPx;
    // Cap-height MEASURED from the child's own capitals (median of the
    // capital ink tops). Only when no capital was captured at all — the
    // capitals line refused or never written — does it fall back to the
    // measured-ascender guess it always was.
    const capHeightPx = capTops.length ? median(capTops) : 0;
    const gapsIntra = [], gapsWord = [];
    for (const ln of lines || []) {
      if (!ln.found) continue;
      for (const g of ln.gapsIntra || []) gapsIntra.push(g);
      for (const g of ln.gapsWord || []) gapsWord.push(g);
    }
    const letterGapPx = median(gapsIntra) || xHeightPx * 0.28;
    const wordGapPx = median(gapsWord) || xHeightPx * 1.1;
    const ascPx = Math.max.apply(null, allTops.concat([xHeightPx * 1.4]));
    const descPx = descents.length ? Math.max.apply(null, descents) : xHeightPx * 0.35;
    const ascender = Math.round(ascPx * scale) + 60;
    return {
      xHeightPx, scale, letterGapPx, wordGapPx, ascender,
      descender: -(Math.round(descPx * scale) + 60),
      capHeightPx,
      capMeasured: capHeightPx > 0,
      capHeight: capHeightPx > 0 ? Math.round(capHeightPx * scale) : ascender
    };
  }

  // ---- assembly --------------------------------------------------------------
  function glyphFor(ch, sample, m) {
    const lsbPx = sample.side != null ? sample.side : m.letterGapPx / 2;
    const path = new opentype.Path();
    for (const c of trace(sample)) {
      const P = c.pts.map(([x, y]) => [
        Math.round((x + lsbPx) * m.scale),
        Math.round((sample.baselineRow - y) * m.scale) // y-flip: rule → baseline 0
      ]);
      // quadratic fit: vertices off-curve, midpoints on-curve
      const n = P.length;
      const mid = (i) => [(P[i][0] + P[(i + 1) % n][0]) / 2,
                          (P[i][1] + P[(i + 1) % n][1]) / 2];
      const m0 = mid(n - 1);
      path.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const mi = mid(i);
        path.quadraticCurveTo(P[i][0], P[i][1], mi[0], mi[1]);
      }
      path.close();
    }
    const advance = Math.round((sample.inkWidth + m.letterGapPx) * m.scale);
    return new opentype.Glyph({
      name: ch, unicode: ch.codePointAt(0), advanceWidth: advance, path
    });
  }

  /* THE STROKE WIDTH OF THE FONT IS CONSISTENT (the product owner,
   * shown 'vihupapa' with fat and thin letters side by side). Each
   * letter is captured at its own camera distance, so normalize()'s
   * per-class height scaling leaves each glyph's STROKE at a different
   * width — a letter written small comes out fat, one written big comes
   * out thin. The originals are sacred (the tiles keep the child's real
   * ink untouched); the FONT is where consistency belongs, so this
   * pre-pass gently thickens or thins each normalized mask toward the
   * MEDIAN stroke width of the set, one morphological step at a time
   * (a dilate/erode step moves a stroke ~2px). Bounded to a few steps
   * so no letter is ever redrawn — only evened — and thinning carries a
   * guard: if an erosion breaks a glyph's ink into more pieces than it
   * had, that glyph reverts to its previous step, because a broken
   * letter is worse than a fat one. Deterministic, like everything
   * here. */
  function _medianStroke(mask, w, h) {
    // median horizontal ink-run length — the same idea HWLetter's
    // strokeWidthOf measures, kept local so the worker-free hosts and
    // this module need no new dependency.
    const runs = [];
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = 0; x <= w; x++) {
        if (x < w && mask[y * w + x]) run++;
        else if (run) { runs.push(run); run = 0; }
      }
    }
    if (!runs.length) return 0;
    runs.sort(function (a, b) { return a - b; });
    return runs[Math.floor(runs.length / 2)];
  }
  function _dilate(mask, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            out[yy * w + xx] = 1;
          }
        }
      }
    }
    return out;
  }
  function _erode(mask, w, h) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        const up = y > 0 ? mask[(y - 1) * w + x] : 0;
        const dn = y < h - 1 ? mask[(y + 1) * w + x] : 0;
        const lf = x > 0 ? mask[y * w + x - 1] : 0;
        const rt = x < w - 1 ? mask[y * w + x + 1] : 0;
        if (up && dn && lf && rt) out[y * w + x] = 1;
      }
    }
    return out;
  }
  function _partsOf(mask, w, h) {
    if (window.HWLetter && HWLetter.partsOf) return HWLetter.partsOf(mask, w, h);
    return 1;   // no counter available → the revert guard simply never fires
  }
  function _equalizeStrokes(samples, log) {
    if (samples.size < 2) return samples;
    const sw = new Map();
    let hSum = 0;
    samples.forEach(function (s, ch) { sw.set(ch, _medianStroke(s.mask, s.w, s.h)); hSum += s.h; });
    const widths = Array.from(sw.values()).filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    if (widths.length < 2) return samples;
    // The target is the set's median, held inside a healthy WEIGHT BAND
    // relative to the normalized letter height (5–12% of it) — so two
    // letters at wild extremes (13px and 60px on a 300px body, the
    // measured real case) meet in readable-pen territory instead of one
    // extreme dragging the whole set fat or spidery.
    const H = hSum / samples.size;
    const target = Math.max(Math.round(0.05 * H),
                   Math.min(Math.round(0.12 * H), widths[Math.floor(widths.length / 2)]));
    const out = new Map();
    samples.forEach(function (s, ch) {
      const from = sw.get(ch);
      let steps = from > 0 ? Math.round((target - from) / 2) : 0;
      if (!steps) { out.set(ch, s); return; }
      let mask = s.mask, parts = _partsOf(s.mask, s.w, s.h);
      let applied = 0, guard = 30;
      while (steps !== 0 && guard-- > 0) {
        const next = steps > 0 ? _dilate(mask, s.w, s.h) : _erode(mask, s.w, s.h);
        if (steps < 0) {
          const nsw = _medianStroke(next, s.w, s.h);
          const nparts = _partsOf(next, s.w, s.h);
          // never thin a stroke away or break the letter apart
          if (nsw < 2 || nparts > parts) break;
        }
        mask = next;
        applied += steps > 0 ? 1 : -1;
        steps += steps > 0 ? -1 : 1;
      }
      if (!applied) { out.set(ch, s); return; }
      const t = {};
      Object.keys(s).forEach(function (k) { t[k] = s[k]; });
      t.mask = mask;
      out.set(ch, t);
      log('hwFont: ' + ch + ' stroke ' + from + 'px → ~' + (from + applied * 2) +
          'px (set target ' + target + 'px)');
    });
    return out;
  }

  /* build(samples, lines, {log}) → {buffer, report}. Deterministic: same
   * samples in, identical bytes out — asserted by the suite. */
  function build(samples, lines, opts) {
    const log = (opts && opts.log) || function () {};
    if (!window.opentype) throw new Error('hwFont: vendor/opentype.min.js did not load');
    samples = _equalizeStrokes(samples, log);
    const m = measure(samples, lines);
    const glyphs = [new opentype.Glyph({
      name: '.notdef', unicode: 0, advanceWidth: Math.round(m.xHeightPx * m.scale),
      path: new opentype.Path()
    })];
    // space — the child's own word gap
    glyphs.push(new opentype.Glyph({
      name: 'space', unicode: 32,
      advanceWidth: Math.round(m.wordGapPx * m.scale), path: new opentype.Path()
    }));
    const chars = Array.from(samples.keys()).sort(); // deterministic glyph order
    const perGlyph = {};
    for (const ch of chars) {
      const g = glyphFor(ch, samples.get(ch), m);
      perGlyph[ch] = { advance: g.advanceWidth };
      glyphs.push(g);
    }
    const font = new opentype.Font({
      familyName: 'My Handwriting', styleName: 'Regular',
      unitsPerEm: UPEM, ascender: m.ascender, descender: m.descender,
      glyphs, createdTimestamp: CREATED
    });
    // makeHeadTable stamps head.modified with the CURRENT time; shim Date
    // around the one call so rebuilding the same sheet gives the same bytes.
    const RealDate = Date;
    const FIXED = CREATED * 1000;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(FIXED); }
      static now() { return FIXED; }
    };
    let buffer;
    try { buffer = font.toArrayBuffer(); } finally { Date = RealDate; }
    const report = {
      glyphCount: glyphs.length, chars,
      unitsPerEm: UPEM,
      xHeightPx: m.xHeightPx, scale: m.scale,
      ascender: m.ascender, descender: m.descender,
      // OS/2 sCapHeight is measured by the assembler itself from the
      // first real capital glyph's outline once capitals exist; this is
      // our own measurement of the same thing, for the report.
      capHeight: m.capHeight, capMeasured: m.capMeasured,
      letterGapPx: m.letterGapPx, wordGapPx: m.wordGapPx,
      spaceAdvance: Math.round(m.wordGapPx * m.scale),
      perGlyph, bytes: buffer.byteLength
    };
    log('hw: font built — ' + chars.length + ' letters (+space), x-height ' +
        Math.round(m.xHeightPx) + 'px → ' + XHEIGHT_UNITS + '/' + UPEM +
        ' units, cap-height ' + m.capHeight +
        (m.capMeasured ? ' (measured from the capitals)' : ' (no capitals — ascender fallback)') +
        ', ascender ' + m.ascender + ', descender ' + m.descender +
        ', ' + buffer.byteLength + ' bytes');
    return { buffer, report };
  }

  window.HWFont = { trace, traceLoops, simplify, measure, build,
                    UPEM, XHEIGHT_UNITS, XCLASS, DESCENDER, CAPS };
})();
