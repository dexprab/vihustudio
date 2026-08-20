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
 * worker (js/hwLetterWorker.js) importScripts it and the page can also
 * call it directly for the upload path. The reader owns its own ink
 * question now — colour distance from the page's own colour (the
 * governing principle below) — while segment.js stays the DRAWING
 * journey's detector, untouched.
 *
 * THE READ, in order:
 *
 *   1. PREPASS at ~480px wide (area-average downscale — honest darkness,
 *      a dark speck dims its cell instead of vanishing). Everything is
 *      decided at this scale; the native pixels are only touched again
 *      to cut the winner out.
 *   1b. THE PAPER FIRST — and the paper is UNIFORMITY, never brightness.
 *      The product owner, verbatim: "the kid might write on any kind of
 *      paper of any color, with any color its our job to figure that
 *      out." So the page is the large, relatively UNIFORM region the
 *      child is holding: the frame is scored in small cells, smooth
 *      cells of one colour are grouped, and the page is the largest
 *      such region — preferring a region that does not run off the
 *      frame's own edge (a held page is surrounded by the room; a wall
 *      or a desk is cut off by the frame). A dim grey page, a yellow
 *      page, a black page are all pages. The old fence asked for
 *      BRIGHTNESS (an absolute 150-luminance floor), and the field
 *      proved it wrong three ways at once: a bright wall merged with
 *      the page (a face read as the letter), and real evening paper sat
 *      below the floor entirely.
 *   1c. INK IS COLOUR DISTANCE FROM THE PAGE'S OWN COLOUR, in ANY
 *      direction — darker, lighter, or a different hue at the same
 *      brightness. The page's colour is estimated from the page itself
 *      (per-cell, so a corner vignette or a brightness gradient rides
 *      along), and a pixel is ink when it sits far from its own local
 *      page colour. White gel pen on black paper reads exactly as black
 *      pen on white — and blue ink on dim grey paper, which the old
 *      luminance margin shattered into 136–235 fragments (measured on
 *      the field's own scene), binarizes whole.
 *   1d. BACKGROUND CROSSES THE PAGE'S EDGE, by definition. Fingers
 *      gripping the page, a doorframe, a shadow, a face's own body all
 *      spill over the fence boundary; pen strokes never do. Any ink
 *      component substantially touching the fence rim is removed from
 *      letter candidacy BEFORE dominance is judged.
 *   1e. A LETTER IS STROKES. A cluster stands as a letter candidate
 *      only if it is stroke-drawn (stroke width small against its own
 *      size) or a smooth solid fill (a crayon-filled letter — low
 *      perimeter²/area). A face-like blob is neither: its stroke width
 *      is its own diameter AND its boundary is ragged with holes.
 *      Measured separation and the gates live in P.SR_MAX / P.C_SOLID.
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
    RULE_THICK: 0.02, // × frame height — a rule candidate must be this
                      //   thin (median vertical thickness) to be stripped.
                      //   (Was 0.014 under the luminance margin; the
                      //   colour-distance ink plane honestly includes a
                      //   rule's anti-aliased edge rows — measured, a
                      //   3px printed rule reads 5px — and a rule left
                      //   half-stripped stitches the letter to the cut
                      //   boundary. Letter strokes stay safe twice
                      //   over: only frame-spanning runs are candidates,
                      //   and thick crossings are never erased.)
    FULL_FRAC: 0.92,  // ink touching ≥ this of the frame in BOTH
                      //   dimensions is a scene, not a letter
    PAD_FRAC: 0.04,   // native-cut padding around the cluster bbox
    BUDGET_MS: 1000,  // per-read time box (live worker and upload alike)
    // ---- the colour-aware paper fence (the governing principle) ----
    CELL: 12,         // uniformity cell size at the analysed scale
    SMOOTH: 7,        // a cell is smooth when its per-channel mean abs
                      //   deviation averages ≤ this (flat paper through a
                      //   real sensor measures 1–3; a curtain's folds and
                      //   any edge-crossed cell measure far more)
    JOIN: 26,         // neighbouring smooth cells join one region when
                      //   their mean colours sit within this distance —
                      //   wide enough for a vignette's cell-to-cell
                      //   drift, far under any paper-vs-desk difference
    PAPER_MIN: 0.06,  // the page must cover ≥ this of the frame
    RING_FRAC: 0.02,  // a region with ≤ this share of its cells on the
                      //   frame's outermost ring is HELD (a page in a
                      //   hand); held regions are preferred over larger
                      //   run-off-the-frame ones (walls, desks)
    HELD_MIN: 0.10,   // …but only a held region covering ≥ this of the
                      //   frame is page-like: a solid ink mass floats
                      //   inside the page too, and must never outrank
                      //   the page it is written on
    FENCE_TOL: 60,    // a pixel within this colour distance of its local
                      //   page colour belongs to the page region
    PAPER_EDGE: 3,    // px shaved off the paper's row/col spans — the
                      //   boundary's own anti-aliased colours stay out
    INK_MARGIN: 40,   // ink = colour distance from the local page colour
                      //   above this, in ANY direction (measured floor:
                      //   see the paper×ink matrix in the suite)
    FAINT_FRAC: 0.55, // the faint second look: sub-margin ink at ≥ this
                      //   × INK_MARGIN is evidence of a letter the pen
                      //   was too light for → refuse 'faint', kindly
    RIM_TOUCH: 6,     // an ink component with ≥ this many pixels on the
                      //   fence rim (analysed scale) is background —
                      //   it crosses the page's edge (fingers ~15px per
                      //   finger, a doorframe bar ~9px; letters 0)
    SR_MAX: 0.30,     // stroke-drawn: strokeWidth / own max dimension ≤
                      //   this (measured: the fixture alphabet reads
                      //   0.10–0.19 thin to thick; the face-like blob
                      //   0.398 — the gate sits between, wide side
                      //   toward letters)
    C_SOLID: 26,      // …or a smooth solid fill: perimeter²/area ≤ this
                      //   (a crayon-filled letter; a face-like blob's
                      //   ragged, holed boundary measures far above)
    PART_MAX: 6,      // a glyph in more pieces than this is weak
                      //   contrast showing itself (letters read in 1–3;
                      //   the field's shattered blue-on-grey 'd' read in
                      //   136–235) → refuse 'faint', kindly
    ASPECT_NARROW: 11,// bbox aspect caps for the sliver rule: a letter
    ASPECT_SEMI: 7,   //   is never a hairline sliver relative to its
    ASPECT_MAX: 5.5,  //   class ('l' is honestly ~7 tall; a 'd' never is)
    SPECK_FRAC: 0.02  // a SEPARATE cluster under this share of the
                      //   dominant cluster's ink is a speck, not a part
                      //   of the letter: normalize() leaves it out of
                      //   the kept sample so it cannot steer the tile's
                      //   centring (measured: a field-case speck is
                      //   0.1–1% of the letter's ink; an i/j dot is
                      //   4–10% AND rides INSIDE the dominant cluster,
                      //   so it is never judged by this bar at all)
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
  // The factor bounds BOTH dimensions (width to targetW, height to a
  // 4:3-equivalent budget), so a square or portrait frame — the small
  // letter window's crop — pays the same prepass bill as the classic
  // wide frame instead of a bigger one. On any 4:3 frame the answer is
  // exactly what the width rule always gave.
  function downscale(photo, targetW) {
    const W = photo.width, H = photo.height;
    const k = Math.max(1, Math.round(W / targetW),
                          Math.round(H / (targetW * 0.75)));
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
  function stripRules(ink, w, h, rows) {
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
            if (rows) rows.push(y);
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

  /* Erase KNOWN rule bands from a native-cut ink plane. A tight cut
   * around the letter cannot re-derive a rule for itself — the letter
   * dominates the run and the median thickness reads "letter" — but
   * the prepass already measured WHERE the rules run. Only rule-thin
   * vertical runs near those rows are erased; where the letter crosses,
   * the ink is thick and stays (the same guard stripRules itself uses). */
  function stripKnownRules(ink, w, h, rows, thickCap, tol) {
    for (const r of rows) {
      const y0 = Math.max(0, Math.round(r - tol));
      const y1 = Math.min(h - 1, Math.round(r + tol));
      for (let x = 0; x < w; x++) {
        for (let y = y0; y <= y1; y++) {
          if (!ink[y * w + x]) continue;
          let a = y, b = y;
          while (a > 0 && ink[(a - 1) * w + x]) a--;
          while (b < h - 1 && ink[(b + 1) * w + x]) b++;
          if (b - a + 1 <= 2 * thickCap) {
            for (let yy = a; yy <= b; yy++) ink[yy * w + x] = 0;
          }
          y = b;                      // past this run either way
        }
      }
    }
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

  /* The paper fence, rebuilt on the governing principle: the page is
   * the large, relatively UNIFORM region the child is holding — never
   * a brightness. Three steps:
   *
   *  1. CELLS. The frame is scored in CELL-sized cells: mean colour and
   *     mean absolute deviation. A smooth cell is candidate paper (of
   *     any colour); an edge-crossed, textured or ink-heavy cell is not.
   *  2. REGIONS. Smooth cells group by 4-neighbour adjacency when their
   *     mean colours sit within JOIN of each other. Regions covering ≥
   *     PAPER_MIN of the frame are page candidates. A candidate whose
   *     cells stay OFF the frame's outermost ring is HELD — a page in a
   *     hand is surrounded by the room, while a wall or a desk runs off
   *     the frame — and held candidates are preferred; otherwise the
   *     largest candidate stands (a page filling the whole frame is
   *     still the page).
   *  3. THE FENCE. The chosen region's colour is estimated PER CELL
   *     (member cells keep their own means — a vignette or a gradient
   *     rides along; other cells inherit from page neighbours), every
   *     pixel's colour DISTANCE from its local page colour is measured
   *     (kept — it is also the ink question), pixels within FENCE_TOL
   *     form the page mask, thin dark runs are closed (a ruled line
   *     does not divide a page), and the mask's row-and-column spans,
   *     shaved by PAPER_EDGE, are the fence. Spans, so the letter's own
   *     strokes — holes in the page mask — stay inside, whatever colour
   *     they are.
   *
   * Returns null when no uniform region big enough is in view. */
  function paperFence(photo, pfOpts) {
    pfOpts = pfOpts || {};
    const w = photo.width, h = photo.height, n = w * h;
    const data = photo.imageData.data;
    const CELL = P.CELL;
    const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
    const gn = gw * gh;
    const mr = new Float32Array(gn), mg = new Float32Array(gn),
          mb = new Float32Array(gn), cnt = new Float32Array(gn);
    for (let y = 0; y < h; y++) {
      const gy = (y / CELL) | 0;
      for (let x = 0; x < w; x++) {
        const g = gy * gw + ((x / CELL) | 0);
        const p4 = (y * w + x) * 4;
        mr[g] += data[p4]; mg[g] += data[p4 + 1]; mb[g] += data[p4 + 2];
        cnt[g]++;
      }
    }
    for (let g = 0; g < gn; g++) {
      const c = cnt[g] || 1;
      mr[g] /= c; mg[g] /= c; mb[g] /= c;
    }
    // Trimmed smoothness: a thin ruled line, a speck or a stroke's own
    // anti-aliased edge crossing a cell must not make the PAPER cell
    // read as rough — pixels far from the cell's mean are outliers, and
    // the cell is judged (and coloured) by its inliers. A cell is
    // smooth when ≥85% of it is inlier and the inliers sit flat.
    const CLAMP = 12;                            // per-channel outlier bar
    const inC = new Float32Array(gn), inR = new Float32Array(gn),
          inG = new Float32Array(gn), inB = new Float32Array(gn),
          inDev = new Float32Array(gn);
    for (let y = 0; y < h; y++) {
      const gy = (y / CELL) | 0;
      for (let x = 0; x < w; x++) {
        const g = gy * gw + ((x / CELL) | 0);
        const p4 = (y * w + x) * 4;
        const dev = Math.abs(data[p4] - mr[g]) + Math.abs(data[p4 + 1] - mg[g]) +
                    Math.abs(data[p4 + 2] - mb[g]);
        if (dev <= 3 * CLAMP) {
          inC[g]++; inR[g] += data[p4]; inG[g] += data[p4 + 1];
          inB[g] += data[p4 + 2]; inDev[g] += dev;
        }
      }
    }
    const mad = new Float32Array(gn);
    for (let g = 0; g < gn; g++) {
      const c2 = cnt[g] || 1;
      if (inC[g] / c2 >= 0.85 && inC[g] > 0) {
        mad[g] = inDev[g] / (3 * inC[g]);
        mr[g] = inR[g] / inC[g]; mg[g] = inG[g] / inC[g]; mb[g] = inB[g] / inC[g];
      } else {
        mad[g] = 1e9;                            // mixed cell: never smooth
      }
    }
    // Regions of smooth, like-coloured cells.
    const region = new Int32Array(gn);           // 0 = none
    const regions = [];
    const stack = new Int32Array(gn);
    const dist3 = (a, b) => {
      const dr = mr[a] - mr[b], dg = mg[a] - mg[b], db = mb[a] - mb[b];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };
    for (let seed = 0; seed < gn; seed++) {
      if (region[seed] || mad[seed] > P.SMOOTH) continue;
      const id = regions.length + 1;
      let top = 0, size = 0, ring = 0;
      let x0 = gw, x1 = -1, y0 = gh, y1 = -1;
      const cells = [];
      stack[top++] = seed; region[seed] = id;
      while (top > 0) {
        const g = stack[--top];
        size++;
        cells.push(g);
        const gx = g % gw, gy = (g / gw) | 0;
        if (gx === 0 || gy === 0 || gx === gw - 1 || gy === gh - 1) ring++;
        if (gx < x0) x0 = gx; if (gx > x1) x1 = gx;
        if (gy < y0) y0 = gy; if (gy > y1) y1 = gy;
        const step = (j) => {
          if (region[j] || mad[j] > P.SMOOTH) return;
          if (dist3(g, j) > P.JOIN) return;
          region[j] = id; stack[top++] = j;
        };
        if (gx > 0) step(g - 1);
        if (gx < gw - 1) step(g + 1);
        if (gy > 0) step(g - gw);
        if (gy < gh - 1) step(g + gw);
      }
      let sr2 = 0, sg2 = 0, sb2 = 0;
      for (const c2 of cells) { sr2 += mr[c2]; sg2 += mg[c2]; sb2 += mb[c2]; }
      regions.push({ id, size, ring, cells, x0, x1, y0, y1,
                     colour: [sr2 / size, sg2 / size, sb2 / size] });
    }
    const minCells = P.PAPER_MIN * gn;
    const cands = regions.filter((r) => r.size >= minCells);
    if (!cands.length) return null;
    // The page among the candidates. When the caller already KNOWS the
    // page's colour (the native cut re-asking inside the prepass's own
    // fence), the matching region is the page whatever its size or
    // position — the pixels are the same paper. Otherwise a HELD page
    // (surrounded by the room, and big enough to be a page rather than
    // a solid ink mass) beats a run-off-the-frame wall; size settles
    // the rest.
    let pool = null;
    if (pfOpts.expect) {
      const e = pfOpts.expect;
      const near = cands.filter((r) => {
        const dr = r.colour[0] - e[0], dg = r.colour[1] - e[1],
              db = r.colour[2] - e[2];
        return Math.sqrt(dr * dr + dg * dg + db * db) <= P.JOIN + 6;
      });
      pool = near.length ? near : cands;
    } else {
      const held = cands.filter((r) =>
        r.ring / r.size <= P.RING_FRAC && r.size >= P.HELD_MIN * gn);
      pool = held.length ? held : cands;
    }
    let page = pool[0];
    for (const r of pool) if (r.size > page.size) page = r;
    // The page's own colour, per cell: member cells keep their means;
    // the rest inherit from page neighbours (so ink-heavy and off-page
    // cells margin against the surrounding paper, and a gradient or a
    // vignette is tracked rather than fought).
    const isPage = new Uint8Array(gn);
    for (const g of page.cells) isPage[g] = 1;
    const cr = new Float32Array(gn), cg = new Float32Array(gn),
          cb = new Float32Array(gn), got = new Uint8Array(gn);
    let medR = 0, medG = 0, medB = 0;
    {
      const rs = [], gs = [], bs = [];
      for (const g of page.cells) { rs.push(mr[g]); gs.push(mg[g]); bs.push(mb[g]); }
      rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
      medR = rs[rs.length >> 1]; medG = gs[gs.length >> 1]; medB = bs[bs.length >> 1];
    }
    for (let g = 0; g < gn; g++) {
      if (isPage[g]) { cr[g] = mr[g]; cg[g] = mg[g]; cb[g] = mb[g]; got[g] = 1; }
    }
    for (let pass = 0; pass < 8; pass++) {
      let open = 0;
      const nr = cr.slice(), ng = cg.slice(), nb = cb.slice(), nGot = got.slice();
      for (let g = 0; g < gn; g++) {
        if (got[g]) continue;
        const gx = g % gw, gy = (g / gw) | 0;
        let sr = 0, sg = 0, sb = 0, m = 0;
        const take = (j) => { if (got[j]) { sr += cr[j]; sg += cg[j]; sb += cb[j]; m++; } };
        if (gx > 0) take(g - 1);
        if (gx < gw - 1) take(g + 1);
        if (gy > 0) take(g - gw);
        if (gy < gh - 1) take(g + gw);
        if (m) { nr[g] = sr / m; ng[g] = sg / m; nb[g] = sb / m; nGot[g] = 1; }
        else open++;
      }
      cr.set(nr); cg.set(ng); cb.set(nb); got.set(nGot);
      if (!open) break;
    }
    for (let g = 0; g < gn; g++) {
      if (!got[g]) { cr[g] = medR; cg[g] = medG; cb[g] = medB; }
    }
    // Every pixel's colour distance from its local page colour — the
    // page question and the ink question are one measurement.
    const dist = new Uint8Array(n);
    const mask = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      const fy = Math.min(gh - 1.001, Math.max(0, y / CELL - 0.5));
      const y0c = fy | 0, ay = fy - y0c;
      const r0 = y0c * gw, r1 = Math.min(gh - 1, y0c + 1) * gw;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(gw - 1.001, Math.max(0, x / CELL - 0.5));
        const x0c = fx | 0, ax = fx - x0c;
        const x1c = Math.min(gw - 1, x0c + 1);
        const lr = (cr[r0 + x0c] * (1 - ax) + cr[r0 + x1c] * ax) * (1 - ay) +
                   (cr[r1 + x0c] * (1 - ax) + cr[r1 + x1c] * ax) * ay;
        const lg = (cg[r0 + x0c] * (1 - ax) + cg[r0 + x1c] * ax) * (1 - ay) +
                   (cg[r1 + x0c] * (1 - ax) + cg[r1 + x1c] * ax) * ay;
        const lb = (cb[r0 + x0c] * (1 - ax) + cb[r0 + x1c] * ax) * (1 - ay) +
                   (cb[r1 + x0c] * (1 - ax) + cb[r1 + x1c] * ax) * ay;
        const p4 = (y * w + x) * 4;
        const dr = data[p4] - lr, dg = data[p4 + 1] - lg, db = data[p4 + 2] - lb;
        const d = Math.sqrt(dr * dr + dg * dg + db * db);
        const i = y * w + x;
        dist[i] = d > 255 ? 255 : d;
        mask[i] = d <= P.FENCE_TOL ? 1 : 0;
      }
    }
    // A rule-thin dark line does not divide a page: close non-page runs
    // no thicker than a ruled line, in both directions, so notebook
    // rules cannot slice the paper into bands. Letter strokes are
    // several times thicker and are never bridged — and would not
    // matter if they were, since the fence is spans.
    const CLOSE = Math.max(4, Math.round(0.02 * Math.min(w, h)));
    for (let x = 0; x < w; x++) {          // vertical runs (horizontal rules)
      let y = 0;
      while (y < h) {
        if (mask[y * w + x]) { y++; continue; }
        let y1 = y;
        while (y1 + 1 < h && !mask[(y1 + 1) * w + x]) y1++;
        if (y > 0 && y1 < h - 1 && (y1 - y + 1) <= CLOSE) {
          for (let yy = y; yy <= y1; yy++) mask[yy * w + x] = 1;
        }
        y = y1 + 1;
      }
    }
    for (let y = 0; y < h; y++) {          // horizontal runs (vertical rules)
      let x = 0;
      while (x < w) {
        if (mask[y * w + x]) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < w && !mask[y * w + x1 + 1]) x1++;
        if (x > 0 && x1 < w - 1 && (x1 - x + 1) <= CLOSE) {
          for (let xx = x; xx <= x1; xx++) mask[y * w + xx] = 1;
        }
        x = x1 + 1;
      }
    }
    // The page's own pixel component: the one carrying the most of the
    // chosen region's cell centres — so a same-coloured surface
    // elsewhere in the room, or the paper showing through a letter's
    // own counter, can never steal the fence.
    const comps = components(mask, w, h);
    if (!comps.length) return null;
    const centre = new Uint8Array(n);
    for (const g of page.cells) {
      const cx2 = Math.min(w - 1, Math.round(((g % gw) + 0.5) * CELL));
      const cy2 = Math.min(h - 1, Math.round((((g / gw) | 0) + 0.5) * CELL));
      centre[cy2 * w + cx2] = 1;
    }
    let paper = null, best = -1;
    for (const c of comps) {
      let hits = 0;
      for (const p2 of c.px) if (centre[p2]) hits++;
      if (hits > best || (hits === best && paper && c.size > paper.size)) {
        best = hits; paper = c;
      }
    }
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
    // The shave keeps the paper boundary's own anti-aliased colours
    // out — but only where the boundary is a REAL paper edge. Where
    // the page runs off the image (a page bigger than the small letter
    // window, a frame-filling page), the image edge has no anti-
    // aliasing and no desk behind it, and shaving there would plant
    // the rim 9 native px inside the page — close enough for a letter
    // honestly near the window's edge to be read as "crossing" it.
    const E = P.PAPER_EDGE;
    const fence = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      if (rowHi[y] < 0) continue;
      const x0 = rowLo[y] + (rowLo[y] === 0 ? 0 : E);
      const x1 = rowHi[y] - (rowHi[y] === w - 1 ? 0 : E);
      for (let x = x0; x <= x1; x++) {
        const y0c = colLo[x] + (colLo[x] === 0 ? 0 : E);
        const y1c = colHi[x] - (colHi[x] === h - 1 ? 0 : E);
        if (y >= y0c && y <= y1c) fence[y * w + x] = 1;
      }
    }
    return { fence, dist,
             held: page.ring / page.size <= P.RING_FRAC,
             colour: [Math.round(medR), Math.round(medG), Math.round(medB)],
             bbox: { x0: paper.x0, y0: paper.y0, x1: paper.x1, y1: paper.y1 },
             size: paper.size };
  }

  /* The ink plane: colour distance from the local page colour above
   * INK_MARGIN, inside the fence — any direction, any hue. `relax`
   * scales the margin (the faint second look). */
  function inkOf(paper, w, h, relax) {
    const margin = P.INK_MARGIN * (relax || 1);
    const n = w * h;
    const ink = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (paper.fence[i] && paper.dist[i] > margin) ink[i] = 1;
    }
    return ink;
  }

  /* The fence rim: fence pixels bordering the outside. An ink component
   * substantially touching the rim CROSSES the page's edge — fingers
   * gripping the page, a doorframe, a face's own body — and is
   * background by definition, removed before dominance is judged. */
  function rimOf(fence, w, h) {
    const rim = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!fence[i]) continue;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            !fence[i - 1] || !fence[i + 1] || !fence[i - w] || !fence[i + w]) {
          rim[i] = 1;
        }
      }
    }
    return rim;
  }

  /* A letter is strokes: stroke-drawn (stroke width small against its
   * own size), or a smooth solid fill (a crayon-filled letter). A
   * face-like blob is neither — its stroke width IS its diameter and
   * its boundary is ragged with holes. Returns the measurements so the
   * suite can assert the separation. */
  function letterLike(cl, w) {
    const bw = cl.x1 - cl.x0 + 1, bh = cl.y1 - cl.y0 + 1;
    const m = new Uint8Array(bw * bh);
    let area = 0;
    for (const comp of cl.members) {
      for (const p of comp.px) {
        const px = p % w, py = (p / w) | 0;
        m[(py - cl.y0) * bw + (px - cl.x0)] = 1;
        area++;
      }
    }
    const sw = strokeWidthOf(m, bw, bh);
    const dim = Math.max(bw, bh);
    let boundary = 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (!m[i]) continue;
        if (x === 0 || y === 0 || x === bw - 1 || y === bh - 1 ||
            !m[i - 1] || !m[i + 1] || !m[i - bw] || !m[i + bw]) boundary++;
      }
    }
    const ratio = dim ? sw / dim : 1;
    const compact = area ? (boundary * boundary) / area : 1e9;
    return { ok: ratio <= P.SR_MAX || compact <= P.C_SOLID,
             ratio, compact, sw, dim };
  }

  // The sliver rule: a letter is never a hairline sliver relative to
  // its class. The tapped identity (when the caller knows it) chooses
  // the honest cap; without one, the loosest stands.
  function sliverCap(ch) {
    if (!ch) return P.ASPECT_NARROW;
    if ('ilI1'.includes(ch)) return P.ASPECT_NARROW;
    if ('jJtf'.includes(ch)) return P.ASPECT_SEMI;
    return P.ASPECT_MAX;
  }
  function isSliver(w, h, ch) {
    if (w >= h) return w / Math.max(1, h) > P.ASPECT_MAX;
    return h / Math.max(1, w) > sliverCap(ch);
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

  /* strokeWidthOf(mask, w, h) → the letter's own stroke width in px.
   *
   * THE ESTIMATOR: for every ink pixel, take the SHORTER of the
   * horizontal and vertical ink run through it — a stem's pixels
   * measure the stem's width, a bar's pixels the bar's height, and a
   * junction's pixels the thinner of the two strokes that cross there.
   * The answer is the MEDIAN over all ink pixels, so serif flares, the
   * odd blob and the crossings cannot drag it (they are a minority of
   * the ink). Chosen over 2×area/perimeter, which under-reads any
   * letter with holes or rough edges (every hole and every ragged edge
   * inflates the perimeter; measured on the fixture alphabet it read
   * 20–40% thin). Verified against the fixtures: the estimate scales
   * linearly with the written size, as a stroke width must.
   *
   * O(n): two run-length sweeps and a counting median. Returns 0 for
   * an empty mask. */
  function strokeWidthOf(mask, w, h) {
    const n = w * h;
    const runH = new Uint16Array(n);
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (!mask[y * w + x]) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < w && mask[y * w + x1 + 1]) x1++;
        const len = x1 - x + 1;
        for (let xx = x; xx <= x1; xx++) runH[y * w + xx] = len;
        x = x1 + 1;
      }
    }
    // counting median of min(runH, runV) over ink — runs are ≤ 65535
    const hist = new Uint32Array(Math.max(w, h) + 1);
    let ink = 0;
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        if (!mask[y * w + x]) { y++; continue; }
        let y1 = y;
        while (y1 + 1 < h && mask[(y1 + 1) * w + x]) y1++;
        const len = y1 - y + 1;
        for (let yy = y; yy <= y1; yy++) {
          const m = Math.min(runH[yy * w + x], len);
          hist[m]++;
          ink++;
        }
        y = y1 + 1;
      }
    }
    if (!ink) return 0;
    const want = Math.ceil(ink / 2);
    let acc = 0;
    for (let v = 0; v < hist.length; v++) {
      acc += hist[v];
      if (acc >= want) return v;
    }
    return 0;
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
    const ch = opts.ch || null;
    const deadline = opts.deadline || (performance.now() + P.BUDGET_MS);
    const facts = { frameW: photo.width, frameH: photo.height };

    // The faint second look, asked only on the way OUT of a refusal:
    // is there a letter-sized mass of SUB-margin colour distance? If
    // so, "everything is low contrast" can honestly be told apart from
    // "no letter", and the refusal may gently suggest a darker pen.
    function faintly(paper, w, h) {
      const soft = inkOf(paper, w, h, P.FAINT_FRAC);
      stripRules(soft, w, h);
      let comps2 = components(soft, w, h);
      if (!comps2.length || comps2.length > P.COMP_CAP) return false;
      // Background is background at any margin: what crosses the
      // page's edge (a finger over the stroke) is never "faint ink".
      const rim2 = rimOf(paper.fence, w, h);
      comps2 = comps2.filter((c) => {
        let touch = 0;
        for (const p of c.px) if (rim2[p]) touch++;
        return touch < P.RIM_TOUCH;
      });
      if (!comps2.length) return false;
      const cl2 = clusterize(comps2).sort((a, b) => b.size - a.size);
      if (!cl2.length) return false;
      const d2 = cl2[0];
      return Math.max(d2.x1 - d2.x0 + 1, d2.y1 - d2.y0 + 1) * small.k >= P.MIN_INK;
    }

    // 1. prepass
    const small = downscale(photo, P.PRE_W);
    const sp = small.photo, k = small.k;
    if (performance.now() > deadline) return { kind: 'nothing', why: 'time', facts };

    // 1b. the paper first — the large uniform region, of any colour
    const paper = paperFence(sp);
    if (!paper) {
      facts.paper = false;
      return { kind: 'nothing', why: 'blank', facts };
    }
    facts.paper = true;
    facts.pageColour = paper.colour;
    facts.held = paper.held;

    // 1c. ink = colour distance from the page's own colour
    const ink = inkOf(paper, sp.width, sp.height);

    // 2. ruled paper — on the ink INSIDE the fence only. The stripped
    // rows are kept: the native cut is too tight to re-derive a rule
    // for itself and re-erases along these instead.
    const ruleRows = [];
    facts.rulesStripped = stripRules(ink, sp.width, sp.height, ruleRows);

    // 3. clusters — with background rejected FIRST: an ink component
    // touching the fence rim crosses the page's edge (fingers, a
    // doorframe, a shadow, a face's own body) and is background by
    // definition, removed before dominance is judged.
    let comps = components(ink, sp.width, sp.height);
    facts.comps = comps.length;
    if (comps.length > P.COMP_CAP) return { kind: 'nothing', why: 'busy', facts };
    if (performance.now() > deadline) return { kind: 'nothing', why: 'time', facts };
    const rim = rimOf(paper.fence, sp.width, sp.height);
    let rimDropped = 0;
    comps = comps.filter((c) => {
      let touch = 0;
      for (const p of c.px) if (rim[p]) touch++;
      if (touch >= P.RIM_TOUCH) { rimDropped++; return false; }
      return true;
    });
    facts.rimDropped = rimDropped;
    const clusters = clusterize(comps).sort((a, b) =>
      b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0);
    facts.clusters = clusters.length;
    if (!clusters.length) {
      if (faintly(paper, sp.width, sp.height)) {
        return { kind: 'nothing', why: 'faint', facts };
      }
      return { kind: 'nothing', why: 'blank', facts };
    }

    // 3b. a letter is strokes — candidacy is gated on stroke-likeness,
    // so a blob that survived the rim (wholly inside the view) still
    // cannot stand as a letter. Only clusters big enough to matter are
    // measured (the dominant and its possible rivals).
    const cands = [];
    let gateDropped = 0;
    const biggest = clusters[0].size;
    for (const cl of clusters) {
      const floor2 = cands.length ? P.RIVAL_FRAC * cands[0].size
                                  : P.RIVAL_FRAC * biggest;
      if (cl.size < floor2 && cands.length) break;   // sorted: rest are smaller
      if (cands.length + gateDropped >= 8) break;    // bounded work
      const g = letterLike(cl, sp.width);
      if (!facts.gate) {                             // the largest cluster's own
        facts.gate = { ratio: +g.ratio.toFixed(3),   //  measurements, kept even
                       compact: Math.round(g.compact) }; // when it is refused
      }
      if (g.ok) { cl.gate = g; cands.push(cl); }
      else gateDropped++;
    }
    facts.gateDropped = gateDropped;
    if (!cands.length) {
      // Ink stood here but nothing letter-like did — that is a refusal
      // about the SCENE, never about the pen, so no darker-pen nudge.
      return { kind: 'nothing', why: 'blank', facts };
    }

    const dom = cands[0];
    facts.gate = { ratio: +dom.gate.ratio.toFixed(3),
                   compact: Math.round(dom.gate.compact) };
    facts.domInk = dom.size;
    facts.domW = (dom.x1 - dom.x0 + 1) * k;
    facts.domH = (dom.y1 - dom.y0 + 1) * k;

    // 4. refuse rather than guess
    const rivals = cands.slice(1).filter((c) => c.size >= P.RIVAL_FRAC * dom.size);
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
    // Shape sanity: a letter is never a hairline sliver relative to its
    // class, and a glyph in implausibly many pieces is weak contrast
    // showing itself — refuse rather than capture a shard or a shatter.
    if (isSliver(facts.domW, facts.domH, ch)) {
      return { kind: 'nothing', why: 'shape', facts };
    }
    if (dom.parts > P.PART_MAX) {
      return { kind: 'nothing', why: 'faint', facts };
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
    // The same colour question at native scale, EXPECTING the page
    // colour the prepass measured — the cut is inside that page by
    // construction, so its region is chosen by colour, never by the
    // held preference (inside a cut, the letter's own solid ink can be
    // the biggest "held" region). A cut too small to find its own page
    // falls back to the prepass page colour outright.
    const paperN = paperFence(cut, { expect: paper.colour });
    let inkN;
    if (paperN) {
      inkN = inkOf(paperN, cut.width, cut.height);
    } else {
      inkN = new Uint8Array(cut.width * cut.height);
      const d2 = cut.imageData.data;
      const pc = paper.colour;
      for (let i = 0; i < inkN.length; i++) {
        const p4 = i * 4;
        const dr = d2[p4] - pc[0], dg = d2[p4 + 1] - pc[1], db = d2[p4 + 2] - pc[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) > P.INK_MARGIN) inkN[i] = 1;
      }
    }
    stripRules(inkN, cut.width, cut.height);
    if (ruleRows.length) {
      stripKnownRules(inkN, cut.width, cut.height,
        ruleRows.map((y) => (y + 0.5) * k - ny0),
        Math.max(3, Math.round(P.RULE_THICK * photo.height)), k + 2);
    }
    let compsN = components(inkN, cut.width, cut.height);
    if (paperN) {
      const rimN = rimOf(paperN.fence, cut.width, cut.height);
      const scaleN = Math.max(1, Math.round(cut.width / sp.width));
      compsN = compsN.filter((c) => {
        let touch = 0;
        for (const p of c.px) if (rimN[p]) touch++;
        return touch < P.RIM_TOUCH * scaleN;
      });
    }
    if (!compsN.length) return { kind: 'nothing', why: 'blank', facts };
    const clustersN = clusterize(compsN).sort((a, b) =>
      b.size - a.size || a.y0 - b.y0 || a.x0 - b.x0);
    // The final glyph must pass the same gates the candidacy did — the
    // auto-capture quality gate is the read itself.
    let domN = null;
    for (const cl of clustersN.slice(0, 8)) {
      if (letterLike(cl, cut.width).ok) { domN = cl; break; }
    }
    if (!domN) return { kind: 'nothing', why: 'blank', facts };
    const gwN = domN.x1 - domN.x0 + 1, ghN = domN.y1 - domN.y0 + 1;
    if (isSliver(gwN, ghN, ch)) {
      return { kind: 'nothing', why: 'shape', facts };
    }
    if (domN.parts > P.PART_MAX) {
      return { kind: 'nothing', why: 'faint', facts };
    }

    // The kept mask is the winning cluster's own pixels, trimmed tight.
    const gw = gwN, gh = ghN;
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
  /* significantOf(mask, w, h) → the mask cropped to its SIGNIFICANT
   * ink: the dominant proximity cluster plus every separate cluster
   * carrying ≥ SPECK_FRAC of its ink. A tiny far speck — a smudge the
   * eraser missed, a paper mote the cut dragged along — forms its own
   * cluster and falls under the bar, so it can no longer stretch the
   * bounding box and shove the letter off-centre in its tile (the
   * field case: one top-left speck pushed a whole 'a' into the
   * bottom-right corner). A GENUINE part is never dropped: the dot of
   * an i or j rides INSIDE the dominant cluster (proximity merged, as
   * partsOf counts it), and any separate cluster big enough to be real
   * ink clears the 2% bar by measurement (a dot alone is 4–10% of its
   * body). Returns { mask, w, h, parts } — parts is the dominant
   * cluster's own member count, the same number partsOf() reports. */
  function significantOf(mask, w, h) {
    const clusters = clusterize(components(mask, w, h));
    if (!clusters.length) return { mask, w, h, parts: 0 };
    let dom = clusters[0];
    for (const c of clusters) if (c.size > dom.size) dom = c;
    const keep = clusters.filter((c) =>
      c === dom || c.size >= P.SPECK_FRAC * dom.size);
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (const c of keep) {
      if (c.x0 < x0) x0 = c.x0; if (c.x1 > x1) x1 = c.x1;
      if (c.y0 < y0) y0 = c.y0; if (c.y1 > y1) y1 = c.y1;
    }
    const ow = x1 - x0 + 1, oh = y1 - y0 + 1;
    const out = new Uint8Array(ow * oh);
    for (const c of keep) {
      for (const comp of c.members) {
        for (const p of comp.px) {
          const px = p % w, py = (p / w) | 0;
          out[(py - y0) * ow + (px - x0)] = 1;
        }
      }
    }
    return { mask: out, w: ow, h: oh, parts: dom.parts };
  }

  /* normalize(glyph, ch) → an hwFont-ready sample. Uniform scale into
   * the class box — placement and size only, the strokes untouched.
   * Nearest-neighbour resampling keeps it byte-deterministic. The
   * glyph is first cropped to its significant ink (see significantOf),
   * so a stray speck steers neither the box nor the part count. */
  function normalize(rawGlyph, ch) {
    const glyph = significantOf(rawGlyph.mask, rawGlyph.w, rawGlyph.h);
    if (!glyph.parts) {
      glyph.mask = rawGlyph.mask; glyph.w = rawGlyph.w;
      glyph.h = rawGlyph.h; glyph.parts = rawGlyph.parts;
    }
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
                      strokeWidthOf, significantOf,
                      downscale, stripRules, paperFence,
                      inkOf, rimOf, letterLike, isSliver,
                      components, clusterize,
                      PARAMS: P, X_H, CAP, ASC, DESC, DOT_TOP,
                      XCLASS, ASCENDERS, DESCENDERS };
})();
