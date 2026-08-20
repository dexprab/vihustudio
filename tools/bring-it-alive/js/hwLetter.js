/* HW LETTER — one letter at a time: find it, refuse kindly, keep it honest.
 *
 * The letter-grid redesign (the product owner, verbatim: "make a grid of
 * letters and numerals. a kid can tap on any of them and show the letter
 * in his writing. and we capture that letter") replaced the sentence-card
 * reader wholesale. The tap declares the letter's IDENTITY, so this
 * module never recognises anything: it only answers "does exactly ONE
 * clear letter stand in this picture, and where is its ink?" — which is
 * the whole of what the card reader's alignment machinery existed to
 * make unnecessary.
 *
 * DOM-free on purpose: typed arrays and arithmetic only, so the live
 * worker (js/hwLetterWorker.js) importScripts it beside segment.js and
 * the page can also call it directly for the upload path. The ink
 * question itself is BIASegment's, unchanged — local-paper-relative
 * darkness, the same detector the drawing journey trusts.
 *
 * THE READ, in order:
 *
 *   1. PREPASS at ~480px wide (area-average downscale — honest darkness,
 *      a dark speck dims its cell instead of vanishing). Everything is
 *      decided at this scale; the native pixels are only touched again
 *      to cut the winner out.
 *   1b. THE PAPER FIRST. "Write anywhere" still means ON SOMETHING
 *      light: the reader finds the largest bright region in view (the
 *      page, the whiteboard, the card) and reads only inside its own
 *      row-and-column extent. Without this, the boundary between paper
 *      and desk reads as a giant ring of "ink" — the local-paper
 *      estimate blends across the edge — and the desk would drown any
 *      letter (measured: on a letter fixture the un-fenced desk carried
 *      ~45k prepass ink pixels against the letter's ~2k). No bright
 *      region worth the name → 'nothing', kindly.
 *   2. RULED-PAPER STRIPPING. A long thin horizontal ink run is a
 *      notebook rule, not a stroke: a run spanning ≥ RULE_RUN of the
 *      frame width whose measured vertical thickness is rule-thin is
 *      erased where it is thin — where the letter crosses the line the
 *      ink is thick and stays. Handled as far as honestly measurable;
 *      what a strip leaves behind (a stub where line met letter) is the
 *      fix step's to erase. A FAINT rule needs no handling at all: like
 *      the card print's own grey, it sits below the ink margin and the
 *      detector never sees it.
 *   3. CLUSTERS BY PROXIMITY. Letters come in parts — the dot of i and
 *      j, a child's small pen-lifts — so components are merged when the
 *      gap between them is small against the larger one's own size
 *      (GAP_FRAC). The glyph is the dominant cluster by ink.
 *   4. REFUSE RATHER THAN GUESS. A second cluster with a comparable
 *      share of the ink (≥ RIVAL_FRAC of the dominant) means the view
 *      does not hold one letter → 'many', kindly. Small clutter below
 *      that bar is ignored — specks never block a clear letter. No ink,
 *      ink too small to capture well (MIN_INK, measured against what
 *      the font tracer needs), or a scene too busy to be paper at all →
 *      'nothing'. Never a guess, so never a wrong capture: and identity
 *      cannot be wrong BY CONSTRUCTION, because the tap already said
 *      which letter this is.
 *   5. THE CUT at native resolution: the winning cluster's own region is
 *      re-segmented from the untouched source pixels and the cluster
 *      re-picked there, so the kept mask is the sharpest the camera saw
 *      — the same one-decode honesty the drawing journey keeps.
 *
 * HONEST PROPORTIONS (normalize): the tapped identity gives the letter's
 * typographic CLASS, and the captured ink is scaled — uniformly, never
 * warped — into that class's box:
 *
 *      capitals + digits      cap height        [435 .. 0]
 *      b d f h k l t          ascender          [450 .. 0]
 *      a c e m n o r s u v    x-height          [300 .. 0]
 *        w x z
 *      g p q y                x-height over a   [300 .. -165]
 *                             descender tail
 *      i (with its dot)       dot below the     [415 .. 0]
 *      j (with its dot)        ascender line    [415 .. -165]
 *      i / j drawn as one     x-height, as the  [300 .. 0] / [300 .. -165]
 *        piece (no dot seen)   bare body is
 *
 *   The descender convention: g j p q y keep 300 units above the
 *   baseline (their bowl at x-height) and reach 165 below (0.55 of
 *   x-height — the classic split). The shapes are entirely the child's;
 *   only WHERE the box sits and HOW BIG it is follow the alphabet's
 *   conventions, which is what makes "big letters and small letters
 *   take their proper sizes" true in the built font. The numbers are in
 *   canonical pixels with x-height = 300, chosen so hwFont's untouched
 *   x-height → 500/1000em mapping lands ascenders at ~810 and
 *   descenders at ~-335 units — ordinary alphabet proportions.
 */
(function () {
  'use strict';

  const P = {
    PRE_W: 480,       // prepass width (area-average downscale)
    COMP_CAP: 250,    // components-before-merge cap: over → not paper in
                      //   view (the busy-room refusal, and the bound that
                      //   keeps the proximity merge's O(n²) honest)
    GAP_FRAC: 0.5,    // merge two clusters when their bbox gap ≤ this ×
                      //   the larger one's max dimension (measured: the
                      //   dot of a DejaVu i sits ~0.18 of the body height
                      //   away; a deliberate second letter a full letter
                      //   width away never merges)
    TINY_FRAC: 0.02,  // a component under this share of the core's ink
                      //   is clutter, not a part: it may still join, but
                      //   only from TINY_GAP × the core's size away —
                      //   (an i dot carries ~5–8% of its body's ink, so a
                      //   real letter part is never treated as clutter)
    TINY_GAP: 0.15,   //   (measured: without the tighter bar, 30 seeded
                      //   paper specks grew a 301×349px Q into a
                      //   490×564px "glyph" — specks must not become
                      //   strokes just by lying near the letter)
    RIVAL_FRAC: 0.25, // a second cluster with ≥ this share of the
                      //   dominant cluster's ink → 'many' (measured: an
                      //   i dot carries ~0.04–0.10 of its body's ink, a
                      //   neighbouring letter 0.4–1.6)
    MIN_INK: 90,      // native px, max dimension of the glyph's ink —
                      //   the honest floor for font quality: the mask is
                      //   scaled into a 300px-x-height class box before
                      //   tracing, and below ~90px the upscale staircase
                      //   outgrows the tracer's own smoothing (h/90)
    RULE_RUN: 0.55,   // an ink run ≥ this × frame width is a rule
                      //   candidate, never a stroke (the widest honest
                      //   letter fixture measures ≤ 0.42 of the frame)
    RULE_THICK: 0.014,// × frame height — a rule candidate must be this
                      //   thin (median vertical thickness) to be stripped
    FULL_FRAC: 0.92,  // ink touching ≥ this of the frame in BOTH
                      //   dimensions is a scene, not a letter
    PAD_FRAC: 0.04,   // native-cut padding around the cluster bbox
    BUDGET_MS: 1000,  // per-read time box (live worker and upload alike)
    PAPER_LUM: 150,   // the bright-region floor (absolute)…
    PAPER_REL: 0.78,  // …and relative: ≥ this × the frame's own p99.5
                      //   luminance, so exposure moves the bar honestly
    PAPER_MIN: 0.06,  // the paper must cover ≥ this of the frame
    PAPER_EDGE: 3     // px shaved off the paper's row/col spans — the
                      //   boundary's own anti-aliased darkness stays out
  };

  // ---- typographic classes ---------------------------------------------------
  const X_H = 300, CAP = 435, ASC = 450, DESC = 165, DOT_TOP = 415;
  const XCLASS = 'acemnorsuvwxz';
  const ASCENDERS = 'bdfhklt';
  const DESCENDERS = 'gpqy';

  /* classBox(ch, parts) → { top, bottom } in canonical px above the
   * baseline (bottom negative below it). `parts` is how many proximity
   * clusters the kept ink is made of — i and j drawn without their dot
   * are honestly placed as bare x-height bodies rather than stretched
   * to where a dot would have reached. */
  function classBox(ch, parts) {
    if (ch === 'i') return parts >= 2 ? { top: DOT_TOP, bottom: 0 } : { top: X_H, bottom: 0 };
    if (ch === 'j') return parts >= 2 ? { top: DOT_TOP, bottom: -DESC } : { top: X_H, bottom: -DESC };
    if (DESCENDERS.includes(ch)) return { top: X_H, bottom: -DESC };
    if (ASCENDERS.includes(ch)) return { top: ASC, bottom: 0 };
    if (XCLASS.includes(ch)) return { top: X_H, bottom: 0 };
    return { top: CAP, bottom: 0 };      // capitals and digits
  }

  // ---- small tools -----------------------------------------------------------
  // Area-average downscale by an integer factor (no canvas — honest
  // darkness, worker-safe). Same arithmetic the live worker always used.
  function downscale(photo, targetW) {
    const W = photo.width, H = photo.height;
    const k = Math.max(1, Math.round(W / targetW));
    if (k === 1) return { photo, k };
    const w = Math.floor(W / k), h = Math.floor(H / k);
    const src = photo.imageData.data;
    const out = new ImageData(w, h);
    const d = out.data;
    const n = k * k;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < k; dy++) {
          let row = ((y * k + dy) * W + x * k) * 4;
          for (let dx = 0; dx < k; dx++, row += 4) {
            r += src[row]; g += src[row + 1]; b += src[row + 2];
          }
        }
        const p = (y * w + x) * 4;
        d[p] = r / n; d[p + 1] = g / n; d[p + 2] = b / n; d[p + 3] = 255;
      }
    }
    return { photo: { width: w, height: h, imageData: out,
                      filename: photo.filename }, k };
  }

  // The full-frame rectangle claim, arithmetically — verified pixel-
  // identical to the canvas fill it stands in for (the live worker's own
  // proof, carried forward with the code).
  function rectClaim(width, height) {
    const inside = new Uint8Array(width * height);
    for (let y = 1; y <= height - 3; y++) {
      inside.fill(1, y * width + 1, y * width + width - 2);
    }
    return {
      points: [[1, 1], [width - 2, 1], [width - 2, height - 2], [1, height - 2]],
      inside,
      area: (width - 3) * (height - 3),
      bbox: { x: 1, y: 1, w: width - 3, h: height - 3 }
    };
  }

  function segmentOf(photo) {
    return BIASegment.segment(photo, rectClaim(photo.width, photo.height));
  }

  // Copy a sub-rectangle of a photo (untouched source pixels).
  function cropPhoto(photo, x0, y0, x1, y1) {
    const W = photo.width;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const src = photo.imageData.data;
    const out = new ImageData(w, h);
    const d = out.data;
    for (let y = 0; y < h; y++) {
      const srow = ((y0 + y) * W + x0) * 4;
      d.set(src.subarray(srow, srow + w * 4), y * w * 4);
    }
    return { width: w, height: h, imageData: out, filename: photo.filename };
  }

  /* Strip ruled-notebook lines from an ink plane, in place. A run of ink
   * spanning ≥ RULE_RUN of the width is never a stroke; it is stripped
   * only where it is RULE-THIN, so the letter's own ink crossing the
   * line survives. Returns how many runs were stripped. */
  function stripRules(ink, w, h) {
    const thickCap = Math.max(3, Math.round(P.RULE_THICK * h));
    const minRun = Math.round(P.RULE_RUN * w);
    let stripped = 0;
    const thickAt = (x, y) => {
      let t = 1, yy = y - 1;
      while (yy >= 0 && ink[yy * w + x]) { t++; yy--; }
      yy = y + 1;
      while (yy < h && ink[yy * w + x]) { t++; yy++; }
      return t;
    };
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (!ink[y * w + x]) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < w && ink[y * w + x1 + 1]) x1++;
        const len = x1 - x + 1;
        if (len >= minRun) {
          // Measure the run's thickness at sampled columns; thin →
          // it is a rule. Erase only the thin columns' vertical band.
          const samples = [];
          for (let i = 0; i < 33; i++) {
            samples.push(thickAt(x + Math.round((len - 1) * i / 32), y));
          }
          samples.sort((a, b) => a - b);
          if (samples[16] <= thickCap) {
            stripped++;
            for (let cx = x; cx <= x1; cx++) {
              if (thickAt(cx, y) > 2 * thickCap) continue; // the letter crosses here
              let yy = y;
              while (yy >= 0 && ink[yy * w + cx]) { ink[yy * w + cx] = 0; yy--; }
              yy = y + 1;
              while (yy < h && ink[yy * w + cx]) { ink[yy * w + cx] = 0; yy++; }
            }
          }
        }
        x = x1 + 1;
      }
    }
    return stripped;
  }

  // Connected components (8-connectivity) over an ink plane.
  function components(ink, w, h) {
    const n = w * h;
    const labels = new Int32Array(n);
    const stack = new Int32Array(n);
    const comps = [];
    const speck = Math.max(4, Math.round(n / 200000)); // segment.js's own floor
    for (let seed = 0; seed < n; seed++) {
      if (!ink[seed] || labels[seed]) continue;
      const label = comps.length + 1;
      let top = 0, size = 0;
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      stack[top++] = seed; labels[seed] = label;
      const px = [];
      while (top > 0) {
        const i = stack[--top];
        size++;
        px.push(i);
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (ink[j] && !labels[j]) { labels[j] = label; stack[top] = j; top++; }
          }
        }
      }
      comps.push({ size, x0, x1, y0, y1, px });
    }
    return comps.filter((c) => c.size >= speck);
  }

  /* The paper fence: find the largest bright region (the page itself)
   * and return a mask of its row-and-column extent, shaved by
   * PAPER_EDGE px so the boundary's own darkness stays outside. Spans
   * rather than the region proper, so the letter's dark strokes — holes
   * in the bright region — stay inside, and a tilted page keeps its own
   * shape. Returns null when nothing bright enough and big enough is in
   * view. `lum` is segment.js's own luminance plane. */
  function paperFence(lum, w, h) {
    const n = w * h;
    // p99.5 luminance, from a 256-bin histogram — exposure-honest.
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i++) hist[lum[i]]++;
    let acc = 0, p995 = 255;
    const want = Math.max(1, Math.round(n * 0.005));
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= want) { p995 = v; break; }
    }
    const thr = Math.max(P.PAPER_LUM, Math.round(P.PAPER_REL * p995));
    const bright = new Uint8Array(n);
    for (let i = 0; i < n; i++) bright[i] = lum[i] >= thr ? 1 : 0;
    // A rule-thin dark line does not divide a page: close dark runs no
    // thicker than a ruled line, in both directions, so notebook rules
    // cannot slice the paper into bands (measured: without this, the
    // native cut of a letter on ruled paper found "the paper" to be one
    // 90px strip between two rules and kept a third of the letter).
    // Letter strokes are several times thicker and are never bridged —
    // and would not matter if they were, since the fence is spans.
    const CLOSE = Math.max(4, Math.round(0.02 * Math.min(w, h)));
    for (let x = 0; x < w; x++) {          // vertical runs (horizontal rules)
      let y = 0;
      while (y < h) {
        if (bright[y * w + x]) { y++; continue; }
        let y1 = y;
        while (y1 + 1 < h && !bright[(y1 + 1) * w + x]) y1++;
        if (y > 0 && y1 < h - 1 && (y1 - y + 1) <= CLOSE) {
          for (let yy = y; yy <= y1; yy++) bright[yy * w + x] = 1;
        }
        y = y1 + 1;
      }
    }
    for (let y = 0; y < h; y++) {          // horizontal runs (vertical rules)
      let x = 0;
      while (x < w) {
        if (bright[y * w + x]) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < w && !bright[y * w + x1 + 1]) x1++;
        if (x > 0 && x1 < w - 1 && (x1 - x + 1) <= CLOSE) {
          for (let xx = x; xx <= x1; xx++) bright[y * w + xx] = 1;
        }
        x = x1 + 1;
      }
    }
    const comps = components(bright, w, h);
    if (!comps.length) return null;
    let paper = comps[0];
    for (const c of comps) if (c.size > paper.size) paper = c;
    if (paper.size < P.PAPER_MIN * n) return null;
    const rowLo = new Int32Array(h).fill(w), rowHi = new Int32Array(h).fill(-1);
    const colLo = new Int32Array(w).fill(h), colHi = new Int32Array(w).fill(-1);
    for (const p of paper.px) {
      const x = p % w, y = (p / w) | 0;
      if (x < rowLo[y]) rowLo[y] = x;
      if (x > rowHi[y]) rowHi[y] = x;
      if (y < colLo[x]) colLo[x] = y;
      if (y > colHi[x]) colHi[x] = y;
    }
    const E = P.PAPER_EDGE;
    const fence = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      if (rowHi[y] < 0) continue;
      const x0 = rowLo[y] + E, x1 = rowHi[y] - E;
      for (let x = x0; x <= x1; x++) {
        if (y >= colLo[x] + E && y <= colHi[x] - E) fence[y * w + x] = 1;
      }
    }
    return { fence, thr, p995,
             bbox: { x0: paper.x0, y0: paper.y0, x1: paper.x1, y1: paper.y1 },
             size: paper.size };
  }

  // The gap between two bboxes (0 when they overlap or touch).
  function bboxGap(a, b) {
    const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
    const dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
    return Math.max(dx, dy);
  }

  /* Merge components into proximity clusters. Each cluster grows from a
   * CORE — the largest component still unassigned — and attaches every
   * component whose gap TO THE CORE'S OWN BOX is ≤ GAP_FRAC × the
   * larger of the two dimensions. Satellites attach to the core, never
   * to each other: measured, a fixpoint merge let a trail of paper
   * specks chain outward from a letter until the "glyph" was the whole
   * page (a 30-speck fixture snowballed a 300px letter into an
   * 815×711px cluster). Against the fixed core box, the dot of an i
   * (gap ~0.18 of the body's height) still joins, and a speck a
   * letter-width away still cannot. Deterministic order throughout. */
  function clusterize(comps) {
    const order = comps.slice().sort((a, b) =>
      b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0);
    const used = new Uint8Array(order.length);
    const out = [];
    for (let i = 0; i < order.length; i++) {
      if (used[i]) continue;
      const core = order[i];
      used[i] = 1;
      const coreBox = { x0: core.x0, x1: core.x1, y0: core.y0, y1: core.y1 };
      const coreDim = Math.max(core.x1 - core.x0 + 1, core.y1 - core.y0 + 1);
      const cl = { size: core.size, x0: core.x0, x1: core.x1,
                   y0: core.y0, y1: core.y1, members: [core], parts: 1 };
      for (let j = i + 1; j < order.length; j++) {
        if (used[j]) continue;
        const b = order[j];
        const bDim = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
        const reach = b.size < P.TINY_FRAC * core.size
          ? P.TINY_GAP * coreDim
          : P.GAP_FRAC * Math.max(coreDim, bDim);
        if (bboxGap(coreBox, b) <= reach) {
          used[j] = 1;
          cl.size += b.size;
          cl.x0 = Math.min(cl.x0, b.x0); cl.x1 = Math.max(cl.x1, b.x1);
          cl.y0 = Math.min(cl.y0, b.y0); cl.y1 = Math.max(cl.y1, b.y1);
          cl.members.push(b);
          cl.parts++;
        }
      }
      out.push(cl);
    }
    return out;
  }

  /* How many parts is a kept mask made of? — the DOMINANT cluster's own
   * member count, the same number read() reports. (The check screen
   * re-asks after the child's own pencil and eraser — a drawn-in dot
   * must count, so an i fixed by hand still reaches the dot's box.) */
  function partsOf(mask, w, h) {
    const clusters = clusterize(components(mask, w, h));
    if (!clusters.length) return 0;
    let dom = clusters[0];
    for (const c of clusters) if (c.size > dom.size) dom = c;
    return dom.parts;
  }

  // ---- the read ----------------------------------------------------------------
  /* read(photo, {log, deadline}) →
   *   { kind:'letter', glyph:{ mask, w, h, x0, y0, ink, parts, cx, cy },
   *     facts:{...} }
   * | { kind:'many',    facts:{...} }
   * | { kind:'nothing', why:'blank'|'small'|'busy'|'scene'|'time', facts:{...} }
   *
   * The glyph's x0/y0/cx/cy are NATIVE frame coordinates — the live
   * loop's steadiness guard compares them between verdicts. */
  function read(photo, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const deadline = opts.deadline || (performance.now() + P.BUDGET_MS);
    const facts = { frameW: photo.width, frameH: photo.height };

    // 1. prepass
    const small = downscale(photo, P.PRE_W);
    const sp = small.photo, k = small.k;
    const seg = segmentOf(sp);
    if (performance.now() > deadline) return { kind: 'nothing', why: 'time', facts };

    // 1b. the paper first
    const paper = paperFence(seg.lum, sp.width, sp.height);
    if (!paper) {
      facts.paper = false;
      return { kind: 'nothing', why: 'blank', facts };
    }
    facts.paper = true;
    facts.paperThr = paper.thr;

    // 2. ruled paper — on the ink INSIDE the fence only
    const ink = seg.ink.slice();   // segment's plane, ours to strip
    for (let i = 0; i < ink.length; i++) if (!paper.fence[i]) ink[i] = 0;
    facts.rulesStripped = stripRules(ink, sp.width, sp.height);

    // 3. clusters
    const comps = components(ink, sp.width, sp.height);
    facts.comps = comps.length;
    if (comps.length > P.COMP_CAP) return { kind: 'nothing', why: 'busy', facts };
    if (performance.now() > deadline) return { kind: 'nothing', why: 'time', facts };
    const clusters = clusterize(comps).sort((a, b) =>
      b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0);
    facts.clusters = clusters.length;
    if (!clusters.length) return { kind: 'nothing', why: 'blank', facts };

    const dom = clusters[0];
    facts.domInk = dom.size;
    facts.domW = (dom.x1 - dom.x0 + 1) * k;
    facts.domH = (dom.y1 - dom.y0 + 1) * k;

    // 4. refuse rather than guess
    const rivals = clusters.slice(1).filter((c) => c.size >= P.RIVAL_FRAC * dom.size);
    facts.rivals = rivals.length;
    if (rivals.length) {
      log('hw letter: more than one letter stands in view (' +
          (1 + rivals.length) + ' comparable ink clusters)');
      return { kind: 'many', facts };
    }
    if ((dom.x1 - dom.x0 + 1) >= P.FULL_FRAC * sp.width &&
        (dom.y1 - dom.y0 + 1) >= P.FULL_FRAC * sp.height) {
      return { kind: 'nothing', why: 'scene', facts };
    }
    if (Math.max(facts.domW, facts.domH) < P.MIN_INK) {
      return { kind: 'nothing', why: 'small', facts };
    }

    // 5. the cut, from the untouched native pixels
    const padX = Math.round(P.PAD_FRAC * photo.width);
    const padY = Math.round(P.PAD_FRAC * photo.height);
    const nx0 = Math.max(0, dom.x0 * k - padX);
    const ny0 = Math.max(0, dom.y0 * k - padY);
    const nx1 = Math.min(photo.width - 1, (dom.x1 + 1) * k + padX);
    const ny1 = Math.min(photo.height - 1, (dom.y1 + 1) * k + padY);
    if (performance.now() > deadline) return { kind: 'nothing', why: 'time', facts };
    const cut = cropPhoto(photo, nx0, ny0, nx1, ny1);
    const segN = segmentOf(cut);
    const inkN = segN.ink.slice();
    // The fence again at native scale: the cut is inside the paper, but
    // a letter written near the page's edge can drag a sliver of desk in.
    const paperN = paperFence(segN.lum, cut.width, cut.height);
    if (paperN) {
      for (let i = 0; i < inkN.length; i++) if (!paperN.fence[i]) inkN[i] = 0;
    }
    stripRules(inkN, cut.width, cut.height);
    const compsN = components(inkN, cut.width, cut.height);
    if (!compsN.length) return { kind: 'nothing', why: 'blank', facts };
    const clustersN = clusterize(compsN).sort((a, b) =>
      b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0);
    const domN = clustersN[0];

    // The kept mask is the winning cluster's own pixels, trimmed tight.
    const gw = domN.x1 - domN.x0 + 1, gh = domN.y1 - domN.y0 + 1;
    const mask = new Uint8Array(gw * gh);
    let inkPx = 0;
    for (const c of domN.members) {
      for (const p of c.px) {
        const px = p % cut.width, py = (p / cut.width) | 0;
        mask[(py - domN.y0) * gw + (px - domN.x0)] = 1;
        inkPx++;
      }
    }
    const glyph = {
      mask, w: gw, h: gh,
      x0: nx0 + domN.x0, y0: ny0 + domN.y0,
      ink: inkPx, parts: domN.parts,
      cx: nx0 + (domN.x0 + domN.x1) / 2,
      cy: ny0 + (domN.y0 + domN.y1) / 2
    };
    log('hw letter: one letter stands — ink ' + gw + 'x' + gh + 'px, ' +
        glyph.parts + ' part(s)');
    return { kind: 'letter', glyph, facts };
  }

  // ---- honest proportions ------------------------------------------------------
  /* normalize(glyph, ch) → an hwFont-ready sample. Uniform scale into
   * the class box — placement and size only, the strokes untouched.
   * Nearest-neighbour resampling keeps it byte-deterministic. */
  function normalize(glyph, ch) {
    const box = classBox(ch, glyph.parts);
    const outH = box.top - box.bottom;
    const s = outH / glyph.h;
    const outW = Math.max(1, Math.round(glyph.w * s));
    const mask = new Uint8Array(outW * outH);
    for (let y = 0; y < outH; y++) {
      const sy = Math.min(glyph.h - 1, Math.floor(y / s));
      for (let x = 0; x < outW; x++) {
        const sx = Math.min(glyph.w - 1, Math.floor(x / s));
        mask[y * outW + x] = glyph.mask[sy * glyph.w + sx];
      }
    }
    return {
      mask, w: outW, h: outH, x0: 0, y0: 0,
      baselineRow: box.top,      // the baseline's row inside the patch
      topAbove: box.top,         // ink above the baseline (the class box top)
      belowBase: box.bottom === 0 ? 0 : -box.bottom, // ink below the baseline
      rawTop: box.top,
      inkWidth: outW,
      cx: outW / 2,
      side: null,
      parts: glyph.parts,
      classTop: box.top, classBottom: box.bottom
    };
  }

  window.HWLetter = { read, normalize, classBox, partsOf,
                      downscale, rectClaim, stripRules, paperFence,
                      components, clusterize,
                      PARAMS: P, X_H, CAP, ASC, DESC, DOT_TOP,
                      XCLASS, ASCENDERS, DESCENDERS };
})();
