/* HW READ — find the card, cut the ink apart, and ALIGN, never recognise.
 *
 * The reader's whole contract: it is handed a photograph of a filled
 * writing CARD (hwSheet.js) and the KNOWN text of every line, and it
 * answers "which known letter is this blob of ink standing where" — by
 * sequence alignment with gap tolerance, never by OCR, never by guessing
 * what a child's letter looks like. The house rule is REFUSE RATHER THAN
 * GUESS: letters that touched each other, marks that fit nowhere, and
 * alignments that are not confident are SKIPPED, never mislabeled. A
 * skipped letter costs the child nothing but an empty slot in the
 * alphabet grid, and recovery is per-card ("show me this card once
 * more"), never start-over.
 *
 * STRICTLY ONE CARD AT A TIME (the product owner, verbatim: "only 1
 * question at a time will be shown, if camera sees more, it can show a
 * message overlay 1 question at a time"). Every card carries its own
 * two anchor stars and its own printed sentence, so each card registers
 * and identifies itself — there is no page identity anywhere, and none
 * to get wrong. A view in which the survey (surveyCards) surely names
 * MORE than one card reads NOTHING: the live loop shows a gentle
 * overlay, the upload path a kind one-card-per-photo message.
 *
 * LEGACY: the whole-sheet machinery below (the 5-rung anchor ladder and
 * the rule-pattern fallback) is FROZEN against HWSheet.LEGACY.GEOM and
 * exists only so one-page sheets printed before the two-page redesign
 * keep reading, whole-page, exactly as they always did. The new card
 * print cannot form a 5-rung ladder, so the two worlds cannot collide.
 *
 * Five stages:
 *
 * 1. INK. BIASegment.segment() over the whole frame — the existing
 *    illumination-flattened ink detection, reused as-is. Nothing here
 *    re-invents "what is ink"; this module only decides what the ink
 *    MEANS on this particular sheet.
 *
 * 2. REGISTRATION — end-marks first, printed rules second (the Magic
 *    Card reader's exact fall-through shape, Decision 17).
 *
 *    2a. ANCHORS. The sheet prints a solid-ink star at both ends of
 *    every rule (hwSheet.js). The reader finds dark compact marks,
 *    matches them to the sheet's known ladder AS A WHOLE — five pairs;
 *    each column exactly collinear (anchors sit on a straight sheet
 *    line, and a projective transform keeps straight lines straight);
 *    pitch and rung length varying only smoothly; every mark the size
 *    the ladder itself implies; almost every mark isolated in clear
 *    margin — and each line's writing band then derives from ITS OWN
 *    pair: position, tilt, length, and (from the measured pitch) the
 *    vertical scale, so a webcam's foreshortening is absorbed per line
 *    with no flat-plane assumption and no global even-pitch requirement.
 *    A partial or fake ladder matches nothing: the pattern is accepted
 *    whole or not at all, so a mark-like blob in a wrong place cannot
 *    invent a registration. A ladder found upside down flips the photo
 *    and reads again; one whose way up cannot be told is refused.
 *
 *    2b. RULES (fallback — sheets printed before the marks existed).
 *    The ruled baselines are found as long horizontal darker-than-paper
 *    runs, then the set matching the sheet's known pattern (even pitch,
 *    equal length, aligned ends, pitch/length ratio from HWSheet.GEOM)
 *    is chosen by scoring every combination. This is the path the field
 *    proved too faint for a real camera — it remains for old printouts
 *    held square-on, and refuses honestly everywhere else.
 *
 * 3. RULE REMOVAL. The printed rule is ink to the detector, and a child's
 *    letters SIT on it — left in place it would weld a whole line into
 *    one component. It is removed by vertical run-length (the OMR
 *    staff-line move): inside the rule band, a thin vertical run is rule
 *    and is cleared; a tall run is a letter stroke crossing the rule and
 *    is kept. Cost, disclosed: where a letter touches the rule it keeps a
 *    rule-thick foot the width of the contact — a few source pixels.
 *
 * 4. LETTERS. Connected components inside each line's writing zone,
 *    speck-filtered relative to the zone, satellites merged (an i/j dot
 *    floats above its stem: strong x-overlap plus small vertical gap),
 *    ordered left to right.
 *
 * 5. ALIGNMENT. Dynamic programming of blobs against the line's known
 *    characters. A blob may stand for one letter (match), swallow 2–4
 *    letters (they touched — all of them are REFUSED), pair with its
 *    neighbour as one letter (a dot the merge missed), or be a stray;
 *    a letter may be missing entirely (the child skipped it — gap
 *    tolerance). Only 1:1 matches with a sane width and a low local cost
 *    are accepted; everything else is skipped with its reason recorded.
 */
(function () {
  'use strict';

  const P = {
    RULE_DARK: 12,        // "part of a rule" — faintly darker than local paper
    RUN_FRAC: 0.25,       // candidate rule row: bridged run ≥ this × frame width
    RUN_FRAC_RETRY: 0.15,
    PITCH_VAR: 0.08,      // rule pitch may vary this much and still be the sheet
    ALIGN_TOL: 0.06,      // rule end misalignment tolerance (× rule length)
    LEN_TOL: 0.15,        // rule length dissimilarity tolerance
    MERGE_XOVER: 0.55,    // satellite: x-overlap ≥ this × narrower width
    MERGE_VGAP: 0.5,      // satellite: vertical gap ≤ this × zone ascent
    SPECK_DIV: 100,       // absolute speck floor = (ascentPx / this)²
    SMALL_DIV: 22,        // "small" mark = under (ascentPx / this)² …
    FAINT: 34,            // … and kept only when at least this dark on average
    // Alignment costs (dimensionless; wcost caps at 6)
    COST_TOUCH: 1.0,      // per extra letter a blob swallows
    COST_SPLIT: 0.9,      // a letter standing as two close pieces
    SPLIT_GAP: 0.35,      // the two pieces may sit this far apart (× unit)
    COST_MISSING: 2.4,    // a letter nobody wrote
    COST_STRAY_BASE: 1.2, // a mark that stands for nothing…
    COST_STRAY_PER_U: 2.2,// …costs more the more ink it is (× width/unit)
    COST_TIGHT_SPACE: 2.0,// a word gap that isn't a gap…
    SPACE_MIN_GAP: 0.55,  // …a real word gap is at least this (× unit)
    COST_WIDE_JOIN: 1.2,  // an intra-word neighbour a word-gap away
    WIDE_JOIN: 1.2,       // "a word-gap away" (× unit)
    ACCEPT_COST: 1.5,     // accept a 1:1 match only under this local cost
    ACCEPT_RATIO_LO: 0.45,
    ACCEPT_RATIO_HI: 2.1,
    // "This looks joined-up" — when touching-refusals DOMINATE a line it
    // is a writing STYLE (the letters hold hands), not a messy line, and
    // the child deserves to be told what happened rather than a generic
    // retake. Thresholds measured against the suite's fixtures: a line
    // whose words are all welded measures 22/30 touching-refused with 0
    // accepted; a line with two touching pairs measures 2/33 touching
    // (6%) with the rest accepted. Halfway (50%) sits far from both.
    JOINED_TOUCH_FRAC: 0.5,   // touching ≥ this × expected → joined-up
    // Secondary net for partial welds the DP labels as a mix of touching
    // and stray/missing: almost nothing accepted AND a solid third
    // touching is still a style, not a smudge.
    JOINED_ACCEPT_FRAC: 0.2,
    JOINED_TOUCH_FRAC_LO: 0.35,
    // ---- end-mark (anchor) registration — stage 2a ----
    A_MIN_PX: 4,           // smallest credible mark, px of ink
    A_BBOX_FRAC: 0.035,    // mark bbox side ≤ this × frame width
    A_ASPECT_LO: 0.25,     // bbox height/width — squash makes marks flat.
                           //   MEASURED at 640×360 under the field warp:
                           //   the last line's star ended 2px of ink on a
                           //   7px width (0.29), and the old 0.3 floor
                           //   threw a REAL anchor away — with one anchor
                           //   gone the true ladder was impossible and a
                           //   look-alike registered wrong. The floor is
                           //   for flat junk (dashes, edges); those are
                           //   refused by darkness and size, not by this.
    A_ASPECT_HI: 3.2,
    A_FILL: 0.22,          // ink fill of own bbox ≥ this (a star is ~0.31)
    A_DARK_REL: 0.45,      // candidate ≥ this × the darkest mark's darkness
    A_CAP: 400,            // at most this many candidates (darkest kept)
    A_COL_TOL_FRAC: 0.0035,// column collinearity tolerance × frame width
    A_COL_MIN_DY: 0.10,    // column seed pairs ≥ this × frame height apart
    A_COL_MAX: 12,         // a "column" with more inliers is the letter mass
    A_SPAN_MIN: 0.22,      // rung ≥ this × frame width
    A_RUNG_TILT: 0.4,      // rung |dy| ≤ this × dx (≈ 22°)
    A_TILT_SPREAD: 0.18,   // rung slopes within this of their median (≈ 10°)
    A_GAP_VAR: 1.6,        // rung pitch max/min — perspective, never chaos
    A_GAP_STEP: 1.45,      // …and consecutive pitch ratio bound
    A_LEN_VAR: 1.7,        // rung length max/min
    A_LEN_STEP: 1.35,
    A_RATIO_LO: 2.6,       // span/pitch — open because a webcam looking down
    A_RATIO_HI: 12,        //   foreshortens the page vertically
    A_SIZE_LO: 0.25,       // mark area vs the ladder's own implied mark size
    A_SIZE_HI: 3.5,
    A_ISO_RING: 0.35,      // isolation ring × the mark's own bbox diagonal
    A_ISO_MIN: 8,          // ≥ this many of the 10 marks in clear margin
    ORIENT_RATIO: 2.5,     // which-way-up: winning band ≥ this × the other…
    ORIENT_MIN: 0.015,     // …and at least this ink-dense (the title block)
    // The MODEL-PRINT witness on the whole-ladder path. A registration
    // is only believed when the sheet's own printed model line stands
    // above EVERY implied rule at the model offset — the same witness
    // the one-card path has always required (PL.MODEL_MIN), extended to
    // the ladder. MEASURED need: at 640×360 under the field warp, a
    // look-alike ladder (the true right-anchor column paired with a
    // collinear diagonal of letter blobs) passed every pattern gate and
    // registered the page HALF A PITCH HIGH — the DP then "confidently"
    // accepted wrong letters. A true registration has solid print above
    // all five rules at any resolution a photo can be read at (the
    // print is solid ink — unlike the faint rule, a real camera never
    // loses it while the letters are still readable): measured 0.06–0.15
    // across the flat page, the 720p warp, the 640×360 warp and the
    // markless fallback. A misregistration has to find that much ink
    // above every one of five wrong places at once.
    MODEL_BAND_MIN: 0.045,
    COARSE_XH: 14,         // px x-height under which glyphs are honestly coarse
    // The whole aligner runs on WIDTH evidence, and under ~5 camera
    // pixels of unit width there is none: measured at 640×360, the two
    // lines whose strokes shattered derived units of 2–3.7px and the DP
    // then "confidently" accepted 18 wrong letters, while every line with
    // unit ≥ 6px stayed at zero mislabels. Below this floor a line
    // refuses everything — refuse-rather-than-guess is absolute.
    MIN_UNIT_PX: 5,
    // ---- live-frame budgets — refuse-not-grind (hwLiveWorker.js) ----
    // Active ONLY when a caller passes opts.deadline; the upload path
    // never does, so a child's one deliberate photograph keeps the full
    // exhaustive search it always had. The live loop offers dozens of
    // frames a minute, so a frame that cannot be finished in time is
    // simply skipped — the next one is 500ms away and skipping is
    // invisible (the slot just doesn't tick yet). MEASURED need: a
    // noisy room frame (no sheet, ~600 components, the mark list at its
    // 400 cap) cost 12.4 SECONDS in readFrame — 3.6s of it in
    // findLadder's seed-pair RANSAC alone — while the heaviest honest
    // frame (the whole sheet in view) costs ~350ms. The combination
    // caps below bound the two combinatorial searches even between
    // deadline checks.
    LIVE_SEED_PAIRS: 20000,  // findLadder seed-pair evaluations under budget
    // findLinePairs under a live budget: raw mark-pair combos are a
    // cheap O(1) gate chain, so their cap is the theoretical maximum at
    // the 400-mark cap (the overtime check every 256 combos is the real
    // bound); the EXPENSIVE step — sampling a candidate's model band —
    // gets its own small cap. The old single 30000-combo cap silently
    // refused an honest whole-page view (three cards ≈ 200 marks ≈
    // 40000 raw combos, measured), so the many-card overlay never fired
    // on exactly the frame it exists for.
    LIVE_PAIR_COMBOS: 160000,
    LIVE_PAIR_DENSE: 400     // model-band density samplings under budget
  };

  // Under a live budget, has the frame's time run out? Checked at loop
  // boundaries; `deadline` of 0 (the upload path) disables it entirely.
  function overtime(deadline) {
    return deadline > 0 && performance.now() > deadline;
  }

  // Expected RELATIVE ink widths (advance-ish) per character. Only used
  // to align — never to decide what a letter looks like. Capitals are on
  // their own line, so only their widths RELATIVE TO EACH OTHER matter
  // (the line's unit is derived from the line's own ink).
  const WIDTH = { i: 0.40, l: 0.40, j: 0.50, t: 0.62, f: 0.62, r: 0.68,
                  m: 1.55, w: 1.48, '1': 0.55,
                  I: 0.45, J: 0.68, L: 0.82, E: 0.88, F: 0.82, T: 0.90,
                  M: 1.40, W: 1.55 };
  function wt(ch) { return WIDTH[ch] || 1.0; }
  function wcost(w, e) { const d = (w - e) / e; return Math.min(6, 3 * d * d); }

  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[(s.length / 2) | 0];
  }

  // ---- 2a. ANCHORS -----------------------------------------------------------
  /* Candidate end-marks: compact, well-filled, and nearly as dark as the
   * darkest ink in the photo. Reuses the labelling BIASegment already did
   * — this only measures each component once. The darkness gate is
   * RELATIVE (0.45 × the darkest mark), so a dim capture keeps working:
   * the printed marks are solid ink and set the maximum themselves, while
   * the sheet's own light-grey line numbers sit at ~0.29 by construction
   * (hwSheet.js NUMBER_COLOR) and can never qualify. */
  function collectMarks(seg) {
    const w = seg.width, h = seg.height, n = w * h;
    const N = seg.compCount;
    const sx = new Float64Array(N + 1), sy = new Float64Array(N + 1);
    const dk = new Float64Array(N + 1);
    const bx0 = new Int32Array(N + 1).fill(w), bx1 = new Int32Array(N + 1).fill(-1);
    const by0 = new Int32Array(N + 1).fill(h), by1 = new Int32Array(N + 1).fill(-1);
    for (let i = 0; i < n; i++) {
      const c = seg.labels[i];
      if (!c) continue;
      const x = i % w, y = (i / w) | 0;
      sx[c] += x; sy[c] += y; dk[c] += seg.paper[i] - seg.lum[i];
      if (x < bx0[c]) bx0[c] = x; if (x > bx1[c]) bx1[c] = x;
      if (y < by0[c]) by0[c] = y; if (y > by1[c]) by1[c] = y;
    }
    const maxB = P.A_BBOX_FRAC * w;
    let marks = [];
    for (let c = 1; c <= N; c++) {
      const size = seg.compSize[c];
      if (size < P.A_MIN_PX) continue;
      const bw = bx1[c] - bx0[c] + 1, bh = by1[c] - by0[c] + 1;
      if (bw > maxB || bh > maxB) continue;
      const asp = bh / bw;
      if (asp < P.A_ASPECT_LO || asp > P.A_ASPECT_HI) continue;
      if (size / (bw * bh) < P.A_FILL) continue;
      marks.push({ label: c, size, cx: sx[c] / size, cy: sy[c] / size,
                   x0: bx0[c], x1: bx1[c], y0: by0[c], y1: by1[c],
                   dark: dk[c] / size });
    }
    if (!marks.length) return { marks, darkGate: 0 };
    let dmax = 0;
    for (const m of marks) if (m.dark > dmax) dmax = m.dark;
    const darkGate = P.A_DARK_REL * dmax;
    marks = marks.filter((m) => m.dark >= darkGate);
    marks.sort((a, b) => b.dark - a.dark);
    if (marks.length > P.A_CAP) marks.length = P.A_CAP;
    return { marks, darkGate };
  }

  /* A printed end-mark stands in clear margin; a letter has neighbours.
   * "Isolated" = no DARK ink of another component within a ring scaled by
   * the mark's own bbox — dark, so the sheet's own light number and the
   * faint rule never count against a real mark. */
  function isIsolated(seg, m, darkGate) {
    const w = seg.width, h = seg.height;
    const bw = m.x1 - m.x0 + 1, bh = m.y1 - m.y0 + 1;
    const ring = Math.max(2, Math.round(P.A_ISO_RING * Math.hypot(bw, bh)));
    const X0 = Math.max(0, m.x0 - ring), X1 = Math.min(w - 1, m.x1 + ring);
    const Y0 = Math.max(0, m.y0 - ring), Y1 = Math.min(h - 1, m.y1 + ring);
    for (let y = Y0; y <= Y1; y++) {
      const row = y * w;
      for (let x = X0; x <= X1; x++) {
        const c = seg.labels[row + x];
        if (!c || c === m.label) continue;
        if (seg.paper[row + x] - seg.lum[row + x] >= darkGate) return false;
      }
    }
    return true;
  }

  function eachSubset5(arr, fn) {
    const n = arr.length, sel = new Array(5);
    (function pick(k, from) {
      if (k === 5) { fn(sel.slice()); return; }
      for (let i = from; i <= n - (5 - k); i++) { sel[k] = arr[i]; pick(k + 1, i + 1); }
    })(0, 0);
  }

  /* Score five rungs as THE ladder, or reject them. LEGACY: the ladder
   * is the one-page five-card sheet's registration, and every number
   * here measures against HWSheet.LEGACY.GEOM — the print as it already
   * exists on children's desks. The two-page card print has no ladder;
   * a new-print photo can never form five rungs and falls through to
   * the one-card path. Every gate is a fact about the printed sheet
   * under a projective camera: smooth pitch, smooth lengths,
   * near-parallel rungs, and — the decisive one against ink lookalikes
   * — every mark the SIZE the ladder itself implies for a printed star
   * at that page scale. Returns null unless the whole pattern holds. */
  function scoreLadder(sel, W, H, iso) {
    const G = HWSheet.LEGACY.GEOM;
    const aSpan = G.anchorXRight - G.anchorXLeft;
    const gaps = [], lens = [], tilts = [];
    for (let i = 0; i < sel.length; i++) {
      const dx = sel[i].R.cx - sel[i].L.cx;
      lens.push(dx);
      tilts.push((sel[i].R.cy - sel[i].L.cy) / dx);
      if (i) gaps.push(sel[i].y - sel[i - 1].y);
    }
    let gMin = Infinity, gMax = 0;
    for (const g of gaps) { if (g < gMin) gMin = g; if (g > gMax) gMax = g; }
    if (gMin <= 0.02 * H) return null;
    if (gMax / gMin > P.A_GAP_VAR) return null;
    for (let i = 1; i < gaps.length; i++) {
      const r = gaps[i] / gaps[i - 1];
      if (r > P.A_GAP_STEP || r < 1 / P.A_GAP_STEP) return null;
    }
    let lMin = Infinity, lMax = 0;
    for (const l of lens) { if (l < lMin) lMin = l; if (l > lMax) lMax = l; }
    if (lMax / lMin > P.A_LEN_VAR) return null;
    for (let i = 1; i < lens.length; i++) {
      const r = lens[i] / lens[i - 1];
      if (r > P.A_LEN_STEP || r < 1 / P.A_LEN_STEP) return null;
    }
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const meanLen = lens.reduce((a, b) => a + b, 0) / lens.length;
    const ratio = meanLen / meanGap;
    if (ratio < P.A_RATIO_LO || ratio > P.A_RATIO_HI) return null;
    const ts = tilts.slice().sort((a, b) => a - b);
    const tMed = ts[2];
    let tSpread = 0;
    for (const t of tilts) tSpread = Math.max(tSpread, Math.abs(t - tMed));
    if (tSpread > P.A_TILT_SPREAD) return null;
    // vertical scale relative to horizontal, from the ladder's own numbers
    const anis = (meanGap / G.blockStep) / ((meanLen / aSpan) * G.aspect);
    let sizePenalty = 0;
    for (const r of sel) {
      const pageW = (r.R.cx - r.L.cx) / aSpan;
      const exp = HWSheet.anchorAreaPx(pageW, G) *
                  Math.min(1.6, Math.max(0.25, anis));
      for (const m of [r.L, r.R]) {
        const q = m.size / exp;
        if (q < P.A_SIZE_LO || q > P.A_SIZE_HI) return null;
        sizePenalty += Math.abs(Math.log(q));
      }
    }
    let isolated = 0;
    for (const r of sel) { if (iso(r.L)) isolated++; if (iso(r.R)) isolated++; }
    if (isolated < P.A_ISO_MIN) return null;
    const score = (gMax / gMin - 1) + (lMax / lMin - 1) + 2 * tSpread +
                  0.25 * sizePenalty + 0.3 * (10 - isolated);
    return { score, anis, isolated, meanGap, meanLen };
  }

  /* Find the ten end-marks. Columns are found by RANSAC over mark pairs
   * (each column is exactly collinear under any projective camera), then
   * column pairs are matched into rungs and every 5-rung subset is held
   * to the whole pattern. Returns the best ladder or null. */
  function findLadder(seg, log, deadline) {
    const { marks, darkGate } = collectMarks(seg);
    if (marks.length < 10) return null;
    deadline = deadline || 0;
    let seedCombos = 0;
    const W = seg.width, H = seg.height;
    const tol = Math.max(2.5, P.A_COL_TOL_FRAC * W);
    const isoCache = new Map();
    const iso = (m) => {
      let v = isoCache.get(m.label);
      if (v === undefined) { v = isIsolated(seg, m, darkGate); isoCache.set(m.label, v); }
      return v;
    };
    // Only ISOLATED marks may seed a column line: a printed end-mark
    // stands in clear margin by construction, while almost every ink
    // lookalike has neighbours — this is a pure speed cut (from ~400²
    // seed pairs to a few thousand), not a new gate, because a real
    // column needs only two of its five marks isolated to be seeded and
    // the ladder itself already requires 8 of 10.
    const seeds = marks.filter((m) => iso(m));
    const cols = new Map();
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        // Live budget: a room scene keeps hundreds of isolated dark
        // specks, and this pair search over them is the measured 3.6s.
        // A frame that needs more than the cap is not a printed sheet.
        if (deadline) {
          if (++seedCombos > P.LIVE_SEED_PAIRS) return null;
          if ((seedCombos & 255) === 0 && overtime(deadline)) return null;
        }
        const dy = seeds[j].cy - seeds[i].cy;
        if (Math.abs(dy) < P.A_COL_MIN_DY * H) continue;
        const dx = seeds[j].cx - seeds[i].cx;
        if (Math.abs(dx) > 1.2 * Math.abs(dy)) continue;
        const b = dx / dy, a = seeds[i].cx - b * seeds[i].cy;
        const inl = [];
        for (const m of marks) {
          if (Math.abs(m.cx - (a + b * m.cy)) <= tol) inl.push(m);
        }
        if (inl.length < 5 || inl.length > P.A_COL_MAX) continue;
        inl.sort((p, q) => p.cy - q.cy);
        const key = inl.map((m) => m.label).join(',');
        if (!cols.has(key)) {
          cols.set(key, { inl, mx: inl.reduce((s, m) => s + m.cx, 0) / inl.length });
        }
      }
    }
    let best = null;
    const colList = Array.from(cols.values());
    for (const A of colList) {
      if (overtime(deadline)) return null;
      for (const B of colList) {
        if (B.mx - A.mx < P.A_SPAN_MIN * W) continue;
        if (overtime(deadline)) return null;
        // greedy nearest-in-y pairing, left column driving
        const usedB = new Set();
        const rungs = [];
        for (const a of A.inl) {
          let pick = null, bd = Infinity;
          for (const b of B.inl) {
            if (usedB.has(b.label) || b.label === a.label) continue;
            const d = Math.abs(b.cy - a.cy);
            if (d < bd) { bd = d; pick = b; }
          }
          if (!pick) continue;
          const dx = pick.cx - a.cx;
          if (dx < P.A_SPAN_MIN * W) continue;
          if (Math.abs(pick.cy - a.cy) > P.A_RUNG_TILT * dx) continue;
          const s = Math.max(a.size, pick.size) / Math.min(a.size, pick.size);
          if (s > 4) continue;
          usedB.add(pick.label);
          rungs.push({ L: a, R: pick, y: (a.cy + pick.cy) / 2 });
        }
        if (rungs.length < 5 || rungs.length > 10) continue;
        rungs.sort((p, q) => p.y - q.y);
        eachSubset5(rungs, (sel) => {
          const sc = scoreLadder(sel, W, H, iso);
          if (sc && (!best || sc.score < best.score)) {
            best = Object.assign({ rungs: sel }, sc);
          }
        });
      }
    }
    if (best) {
      log('hw: anchor ladder — 10 of 10 end-marks (score ' + best.score.toFixed(3) +
          ', ' + best.isolated + '/10 in clear margin, vertical scale ' +
          best.anis.toFixed(2) + '× the horizontal)');
    }
    return best;
  }

  /* Each line's registration from ITS OWN pair of end-marks: the writing
   * span's endpoints are interpolated along the rung (the marks sit at
   * known sheet fractions), the baseline is the segment between them, and
   * the vertical scale comes from the measured pitch to the neighbouring
   * rungs — no flat-plane assumption anywhere. */
  function anchorFits(ladder) {
    const G = HWSheet.LEGACY.GEOM;   // the ladder is legacy-only
    const span = G.anchorXRight - G.anchorXLeft;
    const t0 = (G.xLeft - G.anchorXLeft) / span;
    const t1 = (G.xRight - G.anchorXLeft) / span;
    const mids = ladder.rungs.map((r) => (r.L.cy + r.R.cy) / 2);
    const gaps = [];
    for (let i = 1; i < mids.length; i++) gaps.push(mids[i] - mids[i - 1]);
    const fits = [], zones = [];
    for (let i = 0; i < ladder.rungs.length; i++) {
      const L = ladder.rungs[i].L, R = ladder.rungs[i].R;
      const x0 = L.cx + t0 * (R.cx - L.cx), y0 = L.cy + t0 * (R.cy - L.cy);
      const x1 = L.cx + t1 * (R.cx - L.cx), y1 = L.cy + t1 * (R.cy - L.cy);
      const b = (y1 - y0) / Math.max(1e-6, x1 - x0);
      const a = y0 - b * x0;
      const pitch = i === 0 ? gaps[0]
        : i === ladder.rungs.length - 1 ? gaps[gaps.length - 1]
        : (gaps[i - 1] + gaps[i]) / 2;
      const zone = HWSheet.lineZoneFor(x1 - x0 + 1, pitch, G);
      zones.push(zone);
      fits.push({ a, b, x0: Math.round(x0), x1: Math.round(x1),
                  len: x1 - x0 + 1,
                  thickness: Math.max(1, Math.round(zone.ruleThicknessPx)),
                  yAt(x) { return this.a + this.b * x; } });
    }
    return { fits, zones, gaps };
  }

  /* Which way up? The ladder alone is top-bottom symmetric, so ask the
   * sheet: the title/instruction/callout block lives 0.8–1.2 pitches
   * ABOVE the first rule, and beyond the last rule the page simply ends.
   * Upside down, those two bands swap. A clear winner decides; no clear
   * winner refuses — an inverted sheet fed onward could let the aligner
   * accept wrong letters, and refuse-rather-than-guess is absolute. */
  function whichWayUp(seg, fits, gaps) {
    const w = seg.width, h = seg.height;
    const bandInk = (fit, pitch, sign) => {
      let on = 0, total = 0;
      const xa = Math.round(fit.x0 + 0.25 * (fit.x1 - fit.x0));
      const xb = Math.round(fit.x0 + 0.75 * (fit.x1 - fit.x0));
      for (let x = xa; x <= xb; x += 2) {
        if (x < 0 || x >= w) continue;
        const yr = fit.yAt(x);
        const ya = Math.round(yr + sign * 0.8 * pitch);
        const yb = Math.round(yr + sign * 1.2 * pitch);
        const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
        for (let y = y0; y <= y1; y += 2) {
          if (y < 0 || y >= h) continue;
          total++;
          if (seg.ink[y * w + x]) on++;
        }
      }
      return total >= 40 ? on / total : 0;
    };
    const above = bandInk(fits[0], gaps[0], -1);
    const below = bandInk(fits[fits.length - 1], gaps[gaps.length - 1], +1);
    if (above >= P.ORIENT_MIN && above >= P.ORIENT_RATIO * below) return 'upright';
    if (below >= P.ORIENT_MIN && below >= P.ORIENT_RATIO * above) return 'inverted';
    return 'unclear';
  }

  /* THE MODEL-PRINT WITNESS (P.MODEL_BAND_MIN). The printed model line
   * stands a known distance above every rule, it is solid ink, and it is
   * always there — so a whole-page registration is believed only when
   * ink stands in that band above EVERY implied rule. The one-card path
   * has required exactly this since it existed (findLinePairs); the
   * ladder path gained it after a measured failure — see the constant.
   * Legacy-only, so it measures against the legacy print's offsets. */
  function modelBandDensity(seg, fit, zone) {
    const G = HWSheet.LEGACY.GEOM;
    const H = zone.pageH;
    const lo = (G.ruleOffset - G.modelBaseline) * H;  // model baseline above the rule
    const dyA = Math.round(lo + G.modelSize * H);
    const dyB = Math.round(lo - G.modelSize * 0.35 * H);
    let on = 0, total = 0;
    const xa = Math.round(fit.x0 + 0.1 * (fit.x1 - fit.x0));
    const xb = Math.round(fit.x0 + 0.9 * (fit.x1 - fit.x0));
    for (let x = xa; x <= xb; x += 2) {
      if (x < 0 || x >= seg.width) continue;
      const yr = fit.yAt(x);
      for (let dy = dyB; dy <= dyA; dy += 2) {
        const y = Math.round(yr - dy);
        if (y < 0 || y >= seg.height) continue;
        total++;
        if (seg.ink[y * seg.width + x]) on++;
      }
    }
    return total > 40 ? on / total : 0;
  }

  // Exact pixel permutation — rotating twice reproduces the original
  // bytes, so a flipped read is the same read the right way up.
  function rotate180(photo) {
    const w = photo.width, h = photo.height, n = w * h;
    const src = photo.imageData.data;
    const out = new ImageData(w, h);
    const d = out.data;
    for (let i = 0; i < n; i++) {
      const j = (n - 1 - i) * 4, k = i * 4;
      d[k] = src[j]; d[k + 1] = src[j + 1];
      d[k + 2] = src[j + 2]; d[k + 3] = src[j + 3];
    }
    return { width: w, height: h, imageData: out, filename: photo.filename };
  }

  // ---- 2b. RULES (fallback) --------------------------------------------------
  // Longest bridged horizontal darker-than-paper run per row.
  function rowRuns(seg) {
    const w = seg.width, h = seg.height;
    const bridge = Math.max(2, Math.round(w / 700));
    const out = new Array(h);
    for (let y = 0; y < h; y++) {
      let best = 0, bx0 = 0, bx1 = 0, run = 0, gap = bridge + 1, start = 0;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (seg.paper[i] - seg.lum[i] > P.RULE_DARK) {
          if (gap > bridge) { start = x; run = 0; }
          gap = 0; run = x - start + 1;
          if (run > best) { best = run; bx0 = start; bx1 = x; }
        } else { gap++; }
      }
      out[y] = { len: best, x0: bx0, x1: bx1 };
    }
    return out;
  }

  function candidateBands(runs, w, h, frac) {
    const min = frac * w;
    const bands = [];
    let cur = null;
    for (let y = 0; y < h; y++) {
      if (runs[y].len >= min) {
        if (!cur) cur = { y0: y, y1: y };
        else cur.y1 = y;
      } else if (cur && y - cur.y1 > 1) { bands.push(cur); cur = null; }
    }
    if (cur) bands.push(cur);
    // A rule is thin. A band taller than ~3% of the frame is a shadow or
    // a dark region boundary, not a printed line.
    return bands.filter((b) => b.y1 - b.y0 + 1 <= 0.03 * h).map((b) => {
      let bestY = b.y0;
      for (let y = b.y0; y <= b.y1; y++) if (runs[y].len > runs[bestY].len) bestY = y;
      return { y: (b.y0 + b.y1) / 2, y0: b.y0, y1: b.y1,
               len: runs[bestY].len, x0: runs[bestY].x0, x1: runs[bestY].x1 };
    });
  }

  // Choose the bands that ARE the legacy sheet: even pitch, equal
  // lengths, aligned ends, pitch/length ratio near the OLD geometry's
  // own — this fallback exists for sheets printed before the end-marks,
  // which are all one-page five-rule sheets.
  function chooseRules(bands, log) {
    const G = HWSheet.LEGACY.GEOM;
    const want = HWSheet.LINES.length;
    if (bands.length < want) return null;
    const expRatio = (G.blockStep * G.aspect) / (G.xRight - G.xLeft);
    let best = null, bestScore = Infinity;
    const n = Math.min(bands.length, 16);
    const idx = new Array(want);
    (function pick(k, from) {
      if (k === want) {
        const sel = idx.map((i) => bands[i]);
        const d = [];
        for (let i = 1; i < want; i++) d.push(sel[i].y - sel[i - 1].y);
        const md = d.reduce((a, b) => a + b, 0) / d.length;
        if (md <= 0) return;
        let pv = 0; for (const v of d) pv = Math.max(pv, Math.abs(v - md) / md);
        const ml = sel.reduce((a, b) => a + b.len, 0) / want;
        let lv = 0, av = 0;
        const mx0 = sel.reduce((a, b) => a + b.x0, 0) / want;
        const mx1 = sel.reduce((a, b) => a + b.x1, 0) / want;
        for (const s of sel) {
          lv = Math.max(lv, Math.abs(s.len - ml) / ml);
          av = Math.max(av, Math.abs(s.x0 - mx0) / ml, Math.abs(s.x1 - mx1) / ml);
        }
        const ratio = md / ml;
        if (pv > P.PITCH_VAR || lv > P.LEN_TOL || av > P.ALIGN_TOL) return;
        if (ratio < expRatio * 0.75 || ratio > expRatio * 1.25) return;
        const score = pv + lv + av + Math.abs(ratio - expRatio) * 4;
        if (score < bestScore) { bestScore = score; best = sel.slice(); }
        return;
      }
      for (let i = from; i < n; i++) { idx[k] = i; pick(k + 1, i + 1); }
    })(0, 0);
    if (best) log('hw: rules chosen, score ' + bestScore.toFixed(3) +
      ' of ' + bands.length + ' candidate band(s)');
    return best;
  }

  // Least-squares fit of one rule: y = a + b·x, plus measured thickness.
  // Per column, only the dark run CONTAINING the band's own row counts —
  // first-dark-to-last-dark across the whole window let ink hovering
  // above the rule (a joined-up child's welded strokes, a low descender)
  // drag the fitted centre off the printed line, measured at three
  // quarters of a rule thickness.
  function fitRule(seg, band) {
    const w = seg.width, h = seg.height;
    const yPad = Math.max(3, (band.y1 - band.y0 + 1) * 2);
    const dark = (x, y) => seg.paper[y * w + x] - seg.lum[y * w + x] > P.RULE_DARK;
    const yMid = Math.round((band.y0 + band.y1) / 2);
    const xs = [], ys = [], ts = [];
    for (let x = band.x0; x <= band.x1; x += 4) {
      let seed = -1;
      for (let dy = 0; dy <= 2 && seed < 0; dy++) {
        if (yMid - dy >= 0 && dark(x, yMid - dy)) seed = yMid - dy;
        else if (yMid + dy <= h - 1 && dark(x, yMid + dy)) seed = yMid + dy;
      }
      if (seed < 0) continue;
      const yLo = Math.max(0, band.y0 - yPad), yHi = Math.min(h - 1, band.y1 + yPad);
      let y0 = seed; while (y0 > yLo && dark(x, y0 - 1)) y0--;
      let y1 = seed; while (y1 < yHi && dark(x, y1 + 1)) y1++;
      xs.push(x); ys.push((y0 + y1) / 2); ts.push(y1 - y0 + 1);
    }
    if (xs.length < 8) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) {
      sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i];
    }
    const nn = xs.length;
    const b = (nn * sxy - sx * sy) / Math.max(1e-6, nn * sxx - sx * sx);
    const a = (sy - b * sx) / nn;
    ts.sort((p, q) => p - q);
    return { a, b, x0: band.x0, x1: band.x1, len: band.x1 - band.x0 + 1,
             thickness: ts[(ts.length / 2) | 0],
             yAt(x) { return this.a + this.b * x; } };
  }

  // ---- 3. RULE REMOVAL -------------------------------------------------------
  // The BACKSTOP only. The printed rule sits below the ink margin by
  // construction (hwSheet.js), so normally none of it is ink and there is
  // nothing to remove — this runs only when a dim capture pushed the rule
  // over the margin, and says so in the log.
  //
  // Only BARE stretches of the rule — no ink standing just above — may
  // testify. A child pressing firmly puts ink at the rule's own row at
  // every letter foot, and counting those said "the rule is ink" about
  // handwriting (measured: flat sans-like letter bottoms alone crossed
  // the 30% gate), which sent the run-length remover through the child's
  // letter bottoms on a perfectly bright capture.
  function ruleReadsAsInk(seg, rule) {
    const w = seg.width;
    const t = Math.max(2, rule.thickness);
    let on = 0, total = 0;
    for (let x = rule.x0; x <= rule.x1; x += 3) {
      const y = Math.round(rule.yAt(x));
      if (y < 0 || y >= seg.height) continue;
      let letterAbove = false;
      for (let dy = t + 2; dy <= t + 6; dy++) {
        const yy = y - dy;
        if (yy >= 0 && seg.ink[yy * w + x]) { letterAbove = true; break; }
      }
      if (letterAbove) continue; // a letter stands here — its foot is not the rule
      total++;
      if (seg.ink[y * w + x]) on++;
    }
    return total > 8 && on / total > 0.3;
  }

  function removeRule(cleaned, seg, rule, pad) {
    const w = seg.width, h = seg.height;
    const T = rule.thickness;
    const keepIf = T + 3; // a vertical run taller than this is a letter stroke
    for (let x = Math.max(0, rule.x0 - pad); x <= Math.min(w - 1, rule.x1 + pad); x++) {
      const yc = Math.round(rule.yAt(x));
      for (let y = Math.max(0, yc - T - 2); y <= Math.min(h - 1, yc + T + 2); y++) {
        if (!cleaned[y * w + x]) continue;
        // measure the full vertical run through (x, y)
        let top = y; while (top > 0 && cleaned[(top - 1) * w + x]) top--;
        let bot = y; while (bot < h - 1 && cleaned[(bot + 1) * w + x]) bot++;
        if (bot - top + 1 <= keepIf) {
          for (let yy = top; yy <= bot; yy++) cleaned[yy * w + x] = 0;
        }
        y = bot; // the run is decided; skip past it
      }
    }
  }

  // ---- 4. LETTERS ------------------------------------------------------------
  function lineComponents(cleaned, seg, rule, zone) {
    const w = seg.width, h = seg.height;
    const padX = Math.round(0.012 * zone.pageW);
    const bx0 = Math.max(0, rule.x0 - padX), bx1 = Math.min(w - 1, rule.x1 + padX);
    const yTop = Math.max(0, Math.round(Math.min(rule.yAt(bx0), rule.yAt(bx1)) - zone.ascentPx));
    const yBot = Math.min(h - 1, Math.round(Math.max(rule.yAt(bx0), rule.yAt(bx1)) + zone.descentPx));
    const seen = new Uint8Array(w * h); // local to this line; frame-sized for O(1) addressing
    const comps = [];
    const stack = [];
    for (let y = yTop; y <= yBot; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const s = y * w + x;
        if (!cleaned[s] || seen[s]) continue;
        // flood (8-connectivity), unbounded — a letter may poke out of the box
        const px = [];
        let sx = 0, sy = 0, x0 = x, x1 = x, y0 = y, y1 = y;
        stack.length = 0; stack.push(s); seen[s] = 1;
        while (stack.length) {
          const i = stack.pop();
          px.push(i);
          const ix = i % w, iy = (i / w) | 0;
          sx += ix; sy += iy;
          if (ix < x0) x0 = ix; if (ix > x1) x1 = ix;
          if (iy < y0) y0 = iy; if (iy > y1) y1 = iy;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = iy + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = ix + dx; if (xx < 0 || xx >= w) continue;
              const j = yy * w + xx;
              if (cleaned[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
            }
          }
        }
        comps.push({ px, x0, x1, y0, y1, cx: sx / px.length, cy: sy / px.length });
      }
    }
    // Keep components whose CENTRE lives in this line's writing band.
    // The speck rule is two-tier: an absolute floor, and above it a mark
    // may be SMALL only if it is clearly DARK (an i-dot is tiny but
    // deliberate; paper grain is tiny and faint — this is what separates
    // them without ever asking what a letter looks like).
    const speck = Math.max(4, Math.round(Math.pow(zone.ascentPx / P.SPECK_DIV, 2)));
    const small = Math.round(Math.pow(zone.ascentPx / P.SMALL_DIV, 2));
    return comps.filter((c) => {
      if (c.px.length < speck) return false;
      if (c.px.length < small) {
        let dark = 0;
        for (const p of c.px) dark += seg.paper[p] - seg.lum[p];
        if (dark / c.px.length < P.FAINT) return false;
      }
      const ry = rule.yAt(c.cx);
      return c.cy > ry - zone.ascentPx && c.cy < ry + zone.descentPx * 1.15 &&
             c.cx > rule.x0 - padX && c.cx < rule.x1 + padX;
    });
  }

  function mergeSatellites(comps, zone) {
    let merged = true;
    while (merged) {
      merged = false;
      outer:
      for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
          const A = comps[i], B = comps[j];
          const over = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + 1;
          if (over <= 0) continue;
          const wMin = Math.min(A.x1 - A.x0 + 1, B.x1 - B.x0 + 1);
          const vGap = Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1); // >0 → disjoint
          const near = vGap > 0
            ? (over >= P.MERGE_XOVER * wMin && vGap <= P.MERGE_VGAP * zone.ascentPx)
            : (over >= 0.8 * wMin);
          if (!near) continue;
          // merge B into A
          const n = A.px.length + B.px.length;
          A.cx = (A.cx * A.px.length + B.cx * B.px.length) / n;
          A.cy = (A.cy * A.px.length + B.cy * B.px.length) / n;
          for (const p of B.px) A.px.push(p);
          A.x0 = Math.min(A.x0, B.x0); A.x1 = Math.max(A.x1, B.x1);
          A.y0 = Math.min(A.y0, B.y0); A.y1 = Math.max(A.y1, B.y1);
          comps.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    comps.sort((a, b) => a.cx - b.cx);
    return comps;
  }

  // ---- 5. ALIGNMENT ----------------------------------------------------------
  /* DP of ordered blobs against the line's known characters. Returns per
   * TOKEN: {ch, kind:'match'|'split'|'touching'|'missing', blob?, cost}.
   * kind 'match'/'split' may still be refused by the acceptance rule. */
  function align(text, blobs) {
    const T = text.length, B = blobs.length;
    const bw = blobs.map((b) => b.x1 - b.x0 + 1);
    let wSum = 0, eSum = 0;
    for (const w of bw) wSum += w;
    for (const ch of text) if (ch !== ' ') eSum += wt(ch);
    const u = eSum > 0 ? wSum / eSum : 1;
    if (!B || u <= 0) {
      return { unit: u, tokens: [...text].map((ch) => ({ ch, kind: 'missing', cost: P.COST_MISSING })) };
    }

    const W = B + 1;
    const INF = 1e9;
    const cost = new Float64Array((T + 1) * W).fill(INF);
    const from = new Int32Array((T + 1) * W).fill(-1); // encodes the move
    cost[0] = 0;
    // moves: 0 match · 1..3 merge(k=2..4) · 4/5 split(2/3 pieces) ·
    //        6 skip-letter · 7 skip-blob · 8 space
    function relax(t, b, nt, nb, c, move) {
      const s = cost[t * W + b] + c, d = nt * W + nb;
      if (s < cost[d] - 1e-12) { cost[d] = s; from[d] = (t * W + b) * 16 + move; }
    }
    // A stray costs more the more ink it is: declaring a letter-sized
    // blob "stands for nothing" must never be cheaper than admitting the
    // letter arrived in two pieces — that exact preference once shifted a
    // whole word one blob to the right and mislabeled four letters.
    const strayCost = (b) =>
      P.COST_STRAY_BASE + P.COST_STRAY_PER_U * Math.min(2, bw[b] / u);
    for (let t = 0; t <= T; t++) {
      for (let b = 0; b <= B; b++) {
        if (cost[t * W + b] >= INF) continue;
        if (b < B) relax(t, b, t, b + 1, strayCost(b), 7);
        if (t >= T) continue;
        const ch = text[t];
        if (ch === ' ') {
          // A space is EVIDENCE, not filler: the ink on either side of it
          // must actually be a word-gap apart. Without this, a chain
          // shifted by one blob can slide a word boundary into the middle
          // of a word and pay nothing — measured doing exactly that.
          let c = 0;
          if (b > 0 && b < B) {
            const gap = blobs[b].x0 - blobs[b - 1].x1;
            if (gap < P.SPACE_MIN_GAP * u) c = P.COST_TIGHT_SPACE;
          }
          relax(t, b, t + 1, b, c, 8);
          continue;
        }
        relax(t, b, t + 1, b, P.COST_MISSING, 6);
        if (b < B) {
          // …and the converse: two letters INSIDE one word sitting a
          // word-gap apart is equally suspicious.
          let joinC = 0;
          if (t > 0 && text[t - 1] !== ' ' && b > 0) {
            const gap = blobs[b].x0 - blobs[b - 1].x1;
            if (gap > P.WIDE_JOIN * u) joinC = P.COST_WIDE_JOIN;
          }
          relax(t, b, t + 1, b + 1, wcost(bw[b], u * wt(ch)) + joinC, 0);
          // merge: this blob swallows k consecutive letters — but only if
          // it is actually WIDE enough to be k touching letters. Without
          // the width gate the DP once "merged" two visibly separate
          // letters into one of them to dodge a missing-letter cost, and
          // the freed blob impersonated the letter that was never written.
          let ew = wt(ch);
          for (let k = 2; k <= 4 && t + k <= T; k++) {
            const ch2 = text[t + k - 1];
            if (ch2 === ' ') break;
            ew += wt(ch2);
            if (bw[b] < 0.72 * u * ew) break;
            relax(t, b, t + k, b + 1, wcost(bw[b], u * ew) + P.COST_TOUCH * (k - 1), k - 1);
          }
          // split: one letter standing as 2–3 close pieces (a dot the
          // merge missed, or a thin stroke the ink threshold broke — a
          // 'w' has been measured arriving in three)
          for (let k = 2; k <= 3 && b + k <= B; k++) {
            const gap = blobs[b + k - 1].x0 - blobs[b + k - 2].x1;
            if (gap > P.SPLIT_GAP * u) break;
            const wk = blobs[b + k - 1].x1 - blobs[b].x0 + 1;
            relax(t, b, t + 1, b + k,
              wcost(wk, u * wt(ch)) + P.COST_SPLIT * (k - 1), 3 + k - 1);
          }
        }
      }
    }

    // backtrack
    const tokens = new Array(T);
    let t = T, b = B;
    const strays = [];
    while (t > 0 || b > 0) {
      const enc = from[t * W + b];
      if (enc < 0) break; // unreachable — treat the rest as missing
      const move = enc % 16, src = (enc - move) / 16;
      const pt = (src / W) | 0, pb = src % W;
      const local = cost[t * W + b] - cost[src];
      if (move === 0) tokens[pt] = { ch: text[pt], kind: 'match', blob: pb, cost: local };
      else if (move >= 1 && move <= 3) {
        for (let k = pt; k < t; k++) tokens[k] = { ch: text[k], kind: 'touching', blob: pb, cost: local };
      } else if (move === 4 || move === 5) {
        tokens[pt] = { ch: text[pt], kind: 'split', blob: pb,
                       blobs: move === 4 ? [pb, pb + 1] : [pb, pb + 1, pb + 2], cost: local };
      } else if (move === 6) tokens[pt] = { ch: text[pt], kind: 'missing', cost: local };
      else if (move === 7) strays.push(pb);
      else if (move === 8) tokens[pt] = { ch: ' ', kind: 'space', cost: local };
      t = pt; b = pb;
    }
    for (let i = 0; i < T; i++) {
      if (!tokens[i]) tokens[i] = { ch: text[i], kind: text[i] === ' ' ? 'space' : 'missing', cost: 0 };
    }
    // AMBIGUITY: a matched letter directly beside a MISSING one of about
    // the same expected width is a coin toss — the blob could equally be
    // the neighbour that was never written ("boxing" without its x: the
    // o's ink fits o and x identically). Refuse rather than guess.
    for (let i = 0; i < T; i++) {
      const tok = tokens[i];
      if (tok.kind !== 'match' && tok.kind !== 'split') continue;
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= T) continue;
        const nb = tokens[j];
        if (nb.kind === 'missing' && Math.abs(wt(nb.ch) - wt(tok.ch)) <= 0.25) {
          tok.ambiguous = true;
        }
      }
    }
    return { unit: u, tokens, strays, total: cost[T * W + B] };
  }

  // Acceptance — the refuse-rather-than-guess gate.
  function accept(tok, blobs, unit) {
    if (tok.ambiguous) { tok.refused = 'unconfident'; return false; }
    if (tok.kind === 'match') {
      const b = blobs[tok.blob];
      const ratio = (b.x1 - b.x0 + 1) / (unit * wt(tok.ch));
      if (tok.cost <= P.ACCEPT_COST &&
          ratio >= P.ACCEPT_RATIO_LO && ratio <= P.ACCEPT_RATIO_HI) return true;
      tok.refused = tok.cost > P.ACCEPT_COST ? 'unconfident' : 'width';
      return false;
    }
    if (tok.kind === 'split') {
      // the split penalty itself plus a good width fit
      if (tok.cost <= P.COST_SPLIT * (tok.blobs.length - 1) + 0.4) return true;
      tok.refused = 'unconfident';
      return false;
    }
    return false;
  }

  // Cut an accepted letter's pixels out as a standalone mask patch.
  // `anis` is the line's measured vertical scale relative to horizontal
  // (zone.anis): a webcam looking down photographs letters vertically
  // squashed, and a font traced from squashed masks would be squashed
  // forever. The ladder measured the squash exactly, so the patch is
  // resampled back to square pixels — arithmetic, not guessing. A flat
  // capture (anis ≈ 1) is returned byte-identical to before.
  function samplePatch(pieces, seg, rule, anis) {
    const w = seg.width;
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
    for (const c of pieces) {
      x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1);
      y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1);
    }
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    let mask = new Uint8Array(pw * ph);
    for (const src of pieces) {
      for (const p of src.px) {
        const px = p % w, py = (p / w) | 0;
        mask[(py - y0) * pw + (px - x0)] = 1;
      }
    }
    const cx = (x0 + x1) / 2;
    const ruleY = rule.yAt(cx);
    const rawTop = ruleY - y0;               // camera pixels — the capture fact
    let outH = ph, k = 1;
    if (anis && Math.abs(anis - 1) > 0.05) {
      k = 1 / Math.max(0.2, Math.min(3, anis));
      outH = Math.max(1, Math.round(ph * k));
      const stretched = new Uint8Array(pw * outH);
      for (let y = 0; y < outH; y++) {
        const sy = Math.min(ph - 1, Math.floor(y / k));
        stretched.set(mask.subarray(sy * pw, sy * pw + pw), y * pw);
      }
      mask = stretched;
    }
    return { mask, w: pw, h: outH, x0, y0,
             baselineRow: rawTop * k,        // where the rule crosses the patch
             topAbove: rawTop * k,           // px of letter above the baseline
             belowBase: (y1 - ruleY) * k,    // px below (descender or contact foot)
             rawTop,                         // uncorrected, for capture honesty
             inkWidth: pw, cx };
  }

  /* One line's read result from its aligned components — the shared tail
   * of the whole-sheet path and the single-line (free-motion) path, so
   * the two can never drift in what a "read line" means. Appends the
   * accepted x-class letters' raw ink heights to xTops. */
  function assembleLine(i, text, comps, al, rule, zone, seg, xTops, log) {
    const XC = (window.HWFont && HWFont.XCLASS) || 'acemnorsuvwxz';
    // Under MIN_UNIT_PX of unit width the aligner's only evidence is
    // gone — nothing on this line may be accepted (see P.MIN_UNIT_PX).
    const unitTooSmall = comps.length > 0 && al.unit > 0 && al.unit < P.MIN_UNIT_PX;
    const blobs = comps.map((c) => ({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, n: c.px.length }));
    const letters = [];
    const gapsIntra = [], gapsWord = [];
    let prevMatch = null, prevSpace = false;
    for (let t = 0; t < al.tokens.length; t++) {
      const tok = al.tokens[t];
      if (tok.ch === ' ') { prevSpace = true; continue; }
      const ok = !unitTooSmall && accept(tok, comps, al.unit);
      if (unitTooSmall && (tok.kind === 'match' || tok.kind === 'split')) {
        tok.refused = 'coarse';
      }
      const entry = { ch: tok.ch, kind: tok.kind, accepted: ok,
                      refused: tok.refused || (ok ? null : tok.kind), cost: tok.cost,
                      blobIndex: tok.blob != null ? tok.blob : null };
      if (ok) {
        const pieces = (tok.kind === 'split' ? tok.blobs : [tok.blob]).map((b) => comps[b]);
        entry.sample = samplePatch(pieces, seg, rule, zone.anis);
        if (XC.includes(tok.ch)) xTops.push(entry.sample.rawTop);
        entry.blobX0 = entry.sample.x0;
        entry.blobX1 = entry.sample.x0 + entry.sample.w - 1;
        if (prevMatch != null) {
          const gap = pieces[0].x0 - prevMatch;
          (prevSpace ? gapsWord : gapsIntra).push(gap);
        }
        prevMatch = pieces[pieces.length - 1].x1;
        prevSpace = false;
      } else {
        prevMatch = null; prevSpace = false;
      }
      letters.push(entry);
    }
    const expected = letters.length;
    const got = letters.filter((l) => l.accepted).length;
    const touching = letters.filter((l) => l.kind === 'touching').length;
    // Joined-up: touching-refusals dominate → the letters held hands.
    // A merely messy line (a couple of touching pairs, the rest read)
    // stays below both gates and keeps the generic retake.
    // A line whose unit collapsed is a resolution problem, never a
    // writing-style diagnosis — it must not claim "joined-up".
    const joined = !unitTooSmall && expected > 0 &&
      (touching >= P.JOINED_TOUCH_FRAC * expected ||
       (got <= P.JOINED_ACCEPT_FRAC * expected &&
        touching >= P.JOINED_TOUCH_FRAC_LO * expected));
    log('hw: line ' + (i + 1) + ' — ' + comps.length + ' blobs vs ' + expected +
        ' letters: ' + got + ' accepted, ' +
        touching + ' touching-refused, ' +
        letters.filter((l) => l.kind === 'missing').length + ' missing (unit ' +
        Math.round(al.unit) + 'px)' + (joined ? ' — READS AS JOINED-UP' : '') +
        (unitTooSmall ? ' — UNIT UNDER ' + P.MIN_UNIT_PX +
          'px: too coarse to verify, everything refused' : ''));
    return { index: i, text, found: true, rule,
             letters, expected, accepted: got, touching, joined, blobs,
             unit: al.unit, gapsIntra, gapsWord };
  }

  // ---- 2c. ONE LINE — free-motion close-up registration -----------------------
  /* The free-motion capture mode: the child sweeps the camera over the
   * sheet and lines are collected one at a time, in any order. A frame
   * holds a SINGLE line when one anchor-star pair registers it — two
   * star-sized dark isolated marks, horizontally separated by a
   * plausible rule length, with the printed MODEL text's ink above the
   * rule they imply. WHICH line it is is decided by ALIGNMENT, never
   * recognition: the child's ink is DP-aligned against ALL FIVE known
   * texts and the best is taken only when it wins by a clear margin AND
   * meets the normal acceptance quality. Ambiguity refuses the frame —
   * the child keeps sweeping; a wrong line identity is never possible
   * to accept quietly, and the suite asserts zero. */
  const PL = {
    SPAN_MIN: 0.35,     // pair span ≥ this × frame width — a line fills the frame
    SIZE_LO: 0.2,       // mark area vs the pair's own implied star size…
    SIZE_HI: 4.0,       //   (wider than the ladder's gate: no anis known yet)
    MODEL_MIN: 0.012,   // printed model-text band ink density ≥ this
    PAIR_CAP: 6,        // at most this many candidate pairs tried per frame
    // Identity gates. Measured (close-up fixtures, all five lines):
    // child ink ALONE is not identity-safe — the true text accepted
    // 30–31 letters but the best wrong text 20–25 (three full pangrams
    // align each other's ink far too well: margin ~1.35×), and a stray
    // dot-sized pair once dropped a zone onto arbitrary ink that the
    // forgiving digits text accepted. So identity is TWO witnesses that
    // must agree: the printed MODEL line (clean print at a known offset,
    // aligned by the same DP — measured margin on the fixtures: true
    // text 30–36 accepted, best wrong text ≤ a third of that) names the
    // line, and the child's ink's own best alignment must name the SAME
    // line at the normal acceptance quality. Both are alignment against
    // known text — nothing recognises a letter anywhere.
    MODEL_FRAC: 0.72,        // the model line is print: ≥ this fraction aligns
    // In-class margins measured on the close-up fixtures: 1.47–2.0 flat,
    // degrading to 1.22–1.25 under blur + JPEG + a couple of degrees of
    // roll. The margin alone never inverted (the true text stayed the
    // argmax in every measurement); junk pairs are refused by the OTHER
    // witnesses (class agreement and the child argmax), so the gate sits
    // under the degraded true margins rather than above the junk ones.
    MODEL_ID_MARGIN: 1.15,   // …and beats the runner-up IN ITS CLASS by this
    ID_MIN: 12,              // the child's ink: at least this accepted…
    ID_FRAC: 0.4,            // …and ≥ this fraction of the line's letters
    // The case classes. A width DP cannot tell the capitals line from
    // its lowercase twin (same sentence — measured 28 vs 27 on clean
    // print), but the INK TOPS can, scale-free: a caps or digits line
    // is height-UNIFORM above its baseline, a lowercase pangram is
    // bimodal (x-height plus its ascenders, ≥23% of its letters by
    // construction of the texts). u = p85(top)/median(top).
    CASE_UNIFORM: 1.15,      // u ≤ this → caps/digits class
    CASE_MIXED: 1.25,        // u ≥ this → lowercase class; between → refuse
    // THE NAMING STANDARD IS THE READING STANDARD — the phantom-card
    // fix. A field photograph of ONE card was refused as "cards 1, 3":
    // junk pairs (two specks of clutter, star-sized and isolated,
    // horizontally apart) implied a card that was never there, their
    // model band caught the REAL card's print at a wrong offset and
    // scale, and the clipped slice aligned "surely" to a wrong text —
    // the caps twin, or a sibling pangram. Reproduced and measured:
    // junk namings carried model units of 8–10px on pairs whose own
    // span implied 18–24px, and their "print" covered under half the
    // rule they claimed. A REAL card's print, read through its OWN
    // pair, cannot do either — so a surely-named pair must also fit
    // the card it claims, two ways:
    // 1. UNIT AGREEMENT. The model print's measured unit must be the
    //    unit the pair's own span implies (expected = 0.016 × the
    //    implied pageW — measured 0.0155–0.0167 across card widths
    //    580–1600). Measured on genuine reads of all five cards — flat,
    //    the 720p projective warp, and the 640×360 warp — the ratio of
    //    measured to implied unit stayed in 0.89–1.33 (the caps and
    //    digits lines print a little wide of the estimate); the junk
    //    namings measured 0.42–0.45. The gate sits between, wide side
    //    out. A pair whose implied unit is below MIN_UNIT_PX can never
    //    surely-name (already true via the aligner's own floor: a
    //    too-coarse band accepts nothing, so MODEL_FRAC cannot be met).
    MODEL_UNIT_FRAC: 0.016,  // expected model unit = this × implied pageW
    MODEL_UNIT_LO: 0.62,     // genuine ≥ 0.89 measured; junk ≤ 0.45
    MODEL_UNIT_HI: 1.6,      // genuine ≤ 1.33 measured
    // 2. PRINT COVERAGE. The printed sentence spans its own rule.
    //    Measured on the same genuine reads: extent/rule-span 0.74–1.00
    //    (the shortest sentences at default size cover 74–77%); the
    //    junk namings covered 0.47–0.60. Junk that fails this never
    //    claimed a real region of paper — refusing it cannot hide a
    //    card.
    MODEL_COVER: 0.65        // model comps' x-extent ≥ this × the rule span
  };

  // The ink-top uniformity signal above a baseline fit, and a text's
  // case class. Both sides of the identity check speak this: the band's
  // measured class must match the class of the text it claims to be.
  function caseSignal(comps, fit) {
    const tops = [];
    for (const c of comps) {
      const t = fit.yAt(c.cx) - c.y0;
      if (t > 0) tops.push(t);
    }
    if (tops.length < 6) return null;
    tops.sort((a, b) => a - b);
    const q = (p) => tops[Math.min(tops.length - 1, Math.round(p * (tops.length - 1)))];
    const med = q(0.5);
    return med > 0 ? q(0.85) / med : null;
  }
  function isUniformText(text) { return !/[a-z]/.test(text); }
  function classOf(u) {
    if (u == null) return null;
    if (u <= PL.CASE_UNIFORM) return 'uniform';
    if (u >= PL.CASE_MIXED) return 'mixed';
    return null;
  }

  /* Candidate anchor pairs for a single line, best first. Reuses the
   * ladder's own mark candidacy (collectMarks) and isolation test —
   * one machinery, two registrations. */
  function findLinePairs(seg, deadline) {
    const { marks, darkGate } = collectMarks(seg);
    if (marks.length < 2) return [];
    deadline = deadline || 0;
    let combos = 0, dense = 0;
    const W = seg.width;
    const G = HWSheet.GEOM;
    const aSpan = G.anchorXRight - G.anchorXLeft;
    const isoCache = new Map();
    const iso = (m) => {
      let v = isoCache.get(m.label);
      if (v === undefined) { v = isIsolated(seg, m, darkGate); isoCache.set(m.label, v); }
      return v;
    };
    const t0 = (G.xLeft - G.anchorXLeft) / aSpan;
    const t1 = (G.xRight - G.anchorXLeft) / aSpan;
    const modelLo = G.ruleOffset - G.modelBaseline; // model baseline above the rule (of H)
    const pairs = [];
    for (let i = 0; i < marks.length; i++) {
      for (let j = 0; j < marks.length; j++) {
        if (i === j) continue;
        // Live budget: over the cap or out of time → the frame is
        // skipped whole (an empty list refuses), never half-searched.
        if (deadline) {
          if (++combos > P.LIVE_PAIR_COMBOS) return [];
          if ((combos & 255) === 0 && overtime(deadline)) return [];
        }
        const L = marks[i], R = marks[j];
        const dx = R.cx - L.cx;
        if (dx < PL.SPAN_MIN * W) continue;
        if (Math.abs(R.cy - L.cy) > P.A_RUNG_TILT * dx) continue;
        const s = Math.max(L.size, R.size) / Math.min(L.size, R.size);
        if (s > 4) continue;
        const pageW = dx / aSpan;
        const exp = HWSheet.anchorAreaPx(pageW);
        const qL = L.size / exp, qR = R.size / exp;
        if (qL < PL.SIZE_LO || qL > PL.SIZE_HI ||
            qR < PL.SIZE_LO || qR > PL.SIZE_HI) continue;
        if (!iso(L) || !iso(R)) continue;
        // The expensive step starts here — its own live budget.
        if (deadline && ++dense > P.LIVE_PAIR_DENSE) return [];
        // The rule's endpoints, interpolated along the pair (the marks
        // sit at known sheet fractions — the ladder's own arithmetic).
        const x0 = L.cx + t0 * dx, y0 = L.cy + t0 * (R.cy - L.cy);
        const x1 = L.cx + t1 * dx, y1 = L.cy + t1 * (R.cy - L.cy);
        // The printed MODEL text stands a known distance above the rule.
        // A pair with no ink there is not a writing line — two stray
        // marks cannot fake the sheet's own print.
        const Hpage = pageW * G.aspect;
        const b = (y1 - y0) / Math.max(1e-6, x1 - x0);
        let on = 0, total = 0;
        const xa = Math.round(x0 + 0.1 * (x1 - x0));
        const xb = Math.round(x0 + 0.9 * (x1 - x0));
        const dyA = Math.round((modelLo + G.modelSize) * Hpage);
        const dyB = Math.round((modelLo - G.modelSize * 0.35) * Hpage);
        for (let x = xa; x <= xb; x += 2) {
          if (x < 0 || x >= W) continue;
          const yr = y0 + b * (x - x0);
          for (let dy = dyB; dy <= dyA; dy += 2) {
            const y = Math.round(yr - dy);
            if (y < 0 || y >= seg.height) continue;
            total++;
            if (seg.ink[y * W + x]) on++;
          }
        }
        const density = total > 40 ? on / total : 0;
        if (density < PL.MODEL_MIN) continue;
        const tilt = Math.abs(R.cy - L.cy) / dx;
        pairs.push({ x0, y0, x1, y1, b, dx, tilt, pageW, density,
                     sizeErr: Math.abs(Math.log(qL)) + Math.abs(Math.log(qR)) });
      }
    }
    // Longest first: the anchors are the OUTERMOST marks of their line,
    // so the true pair is the widest — a dot-and-anchor pair is always
    // shorter. Ties (there are none in practice) break flatter-first.
    pairs.sort((p, q) => (q.dx - p.dx) || (p.tilt - q.tilt));
    if (pairs.length > PL.PAIR_CAP) pairs.length = PL.PAIR_CAP;
    return pairs;
  }

  // The accepted-letter count of one component list against one known
  // text — the identity scorer's unit of evidence.
  function scoreAgainst(text, comps) {
    const al = align(text, comps);
    const unitTooSmall = al.unit > 0 && al.unit < P.MIN_UNIT_PX;
    let acc = 0, expected = 0;
    for (const tok of al.tokens) {
      if (tok.ch === ' ') continue;
      expected++;
      if (!unitTooSmall && accept(tok, comps, al.unit)) acc++;
    }
    return { acc, expected, unit: al.unit };
  }

  // Close-up bands only: drop what cannot be writing at all — a
  // component most of the rule's own width, or taller than the whole
  // writing zone, is the sheet's edge or the room, never a letter and
  // never even a welded word (a weld is per word, a fraction of the
  // rule). See the caller for the measured failure this closes.
  function dropNonWriting(comps, fit, zone) {
    const maxW = 0.6 * fit.len;
    const maxH = 1.5 * (zone.ascentPx + zone.descentPx);
    return comps.filter((c) =>
      (c.x1 - c.x0 + 1) <= maxW && (c.y1 - c.y0 + 1) <= maxH);
  }

  /* One candidate pair's rule fit and card zone. No pitch is measurable
   * from one pair, so the zone is isotropic (anis = 1): a close-up is
   * held roughly square-on, and a frame that is not simply fails the
   * identity gates and is re-swept. */
  function cardFitOf(pr) {
    const zone = HWSheet.lineZoneFor(pr.x1 - pr.x0 + 1);
    const fit = { a: pr.y0 - pr.b * pr.x0, b: pr.b,
                  x0: Math.round(pr.x0), x1: Math.round(pr.x1),
                  len: pr.x1 - pr.x0 + 1,
                  thickness: Math.max(1, Math.round(zone.ruleThicknessPx)),
                  yAt(x) { return this.a + this.b * x; } };
    return { fit, zone };
  }

  /* THE PRINTED MODEL LINE IS A WITNESS. It stands at a known offset
   * above the rule, it is clean print, and it is one of the same five
   * known texts — so it is read by the same alignment (never
   * recognition) and names its own card. Measured, this is what makes
   * identity safe: the child-ink DP alone separated the true text from
   * its neighbours by only ~1.35× (three full pangrams align each
   * other's ink far too well), and a stray pair of dot-sized marks
   * could drop a zone onto arbitrary ink and have the forgiving digits
   * text accept it. The model band refuses both: a wrong pair has no
   * clean print at the model offset, and the print names its own line.
   * Returns { sure, t, mClass, mBest, fit, zone } — sure:false when the
   * pair carries no nameable print. */
  function nameModel(seg, pr, log) {
    const G = HWSheet.GEOM;
    const { fit, zone } = cardFitOf(pr);
    const Hpage = zone.pageH;
    const modelFit = { a: fit.a - (G.ruleOffset - G.modelBaseline) * Hpage,
                       b: fit.b, x0: fit.x0, x1: fit.x1, len: fit.len,
                       thickness: 1, yAt(x) { return this.a + this.b * x; } };
    const modelZone = { pageW: zone.pageW, pageH: Hpage,
                        ascentPx: G.modelSize * 1.3 * Hpage,
                        descentPx: G.modelSize * 0.45 * Hpage,
                        blockStepPx: zone.blockStepPx,
                        ruleThicknessPx: 1, anis: 1 };
    let modelComps = lineComponents(seg.ink, seg, modelFit, modelZone);
    modelComps = dropNonWriting(modelComps, modelFit, modelZone);
    modelComps = mergeSatellites(modelComps, modelZone);
    if (modelComps.length < 8) {           // no print here → not a card
      log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px) — no printed ' +
          'model text above it (' + modelComps.length + ' marks) — keep sweeping');
      return { sure: false, fit, zone };
    }
    // The model band's CASE CLASS first — it halves the candidate list
    // and is what separates the capitals line from its lowercase twin,
    // which the width DP alone cannot (measured 28 vs 27).
    const uModel = caseSignal(modelComps, modelFit);
    const mClass = classOf(uModel);
    if (!mClass) {
      log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px) — the model ' +
          'band\'s case is unclear (u=' + (uModel == null ? '—' : uModel.toFixed(2)) +
          ') — keep sweeping');
      return { sure: false, fit, zone };
    }
    const candidates = [];
    for (let t = 0; t < HWSheet.LINES.length; t++) {
      if ((isUniformText(HWSheet.LINES[t].text) ? 'uniform' : 'mixed') === mClass) {
        candidates.push(Object.assign({ t },
          scoreAgainst(HWSheet.LINES[t].text, modelComps)));
      }
    }
    candidates.sort((a, b) => b.acc - a.acc);
    const mBest = candidates[0], mSecond = candidates[1];
    const sure = mBest.acc >= PL.MODEL_FRAC * mBest.expected &&
      mBest.acc >= PL.MODEL_ID_MARGIN * Math.max(1, mSecond ? mSecond.acc : 0);
    if (!sure) {
      log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px) — the printed ' +
          'model line did not name a card clearly (' + mClass + ' u=' +
          uModel.toFixed(2) + '; ' +
          candidates.map((s) => 'card ' + (s.t + 1) + ':' + s.acc).join(' ') +
          ') — keep sweeping');
      return { sure: false, fit, zone };
    }
    // THE NAMING STANDARD IS THE READING STANDARD (see the PL comment).
    // A naming may only stand when the print it read FITS the card this
    // pair implies: its unit at the pair's own scale, and its sentence
    // covering the rule. A clipped slice of some OTHER card's print —
    // the phantom-card mechanism — fails both.
    const expUnit = PL.MODEL_UNIT_FRAC * zone.pageW;
    const uRatio = mBest.unit / Math.max(1e-6, expUnit);
    let mx0 = Infinity, mx1 = -Infinity;
    for (const mc of modelComps) {
      if (mc.x0 < mx0) mx0 = mc.x0;
      if (mc.x1 > mx1) mx1 = mc.x1;
    }
    const cover = (mx1 - mx0 + 1) / fit.len;
    if (uRatio < PL.MODEL_UNIT_LO || uRatio > PL.MODEL_UNIT_HI ||
        cover < PL.MODEL_COVER) {
      log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px) — print aligns ' +
          'to card ' + (mBest.t + 1) + ' but does not FIT this pair\'s card ' +
          '(unit ' + Math.round(mBest.unit) + 'px where the pair implies ' +
          Math.round(expUnit) + 'px; print covers ' + Math.round(cover * 100) +
          '% of the rule) — not this pair\'s print, keep sweeping');
      return { sure: false, fit, zone };
    }
    // The SURE namings go to the dev log too — the field log that found
    // the phantom-card bug showed only the UNSURE pairs, so the very
    // evidence that produced "2 cards stand" was invisible in it.
    log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px, rule mid y ' +
        Math.round(fit.yAt((fit.x0 + fit.x1) / 2)) + 'px) — the printed model ' +
        'line names card ' + (mBest.t + 1) + ' surely (' + mClass + ' u=' +
        uModel.toFixed(2) + ', unit ' + Math.round(mBest.unit) + 'px of ' +
        Math.round(expUnit) + 'px implied, print covers ' +
        Math.round(cover * 100) + '%; ' +
        candidates.map((s) => 'card ' + (s.t + 1) + ':' + s.acc).join(' ') + ')');
    return { sure: true, t: mBest.t, mClass, uModel, mBest, fit, zone };
  }

  /* THE SURVEY — how many cards stand in this view? Every candidate
   * pair's model print is named first, then the surely-named pairs are
   * clustered by the REGION they claim: two pairs whose implied rules
   * lie on the same stretch of paper are two candidate registrations
   * of ONE card, never two cards — measured, a junk pair (an anchor
   * paired with an isolated speck of the child's ink) implies a rule
   * a few percent off the true one, its model band catches a clipped
   * slice of the true print, and the clipped glyphs can align "surely"
   * to a WRONG text; counting names alone therefore over-counted a
   * single card as two. Physically distinct cards are what the rule is
   * about, and distinct cards are geometrically DISJOINT: neighbouring
   * rules stand a full card apart (0.30·H ≈ 2.8× the ascent), while
   * every junk twin of a pair overlaps its card's own writing zone.
   * The product rule is STRICTLY ONE CARD AT A TIME: two or more
   * disjoint cards in view reads NOTHING and the caller shows a kind
   * message instead. */
  function surveyCards(seg, pairs, log, deadline) {
    const named = [];
    const sure = [];
    for (const pr of pairs) {
      if (overtime(deadline)) return null;   // out of time — skip the frame
      const n = nameModel(seg, pr, log);
      named.push(n);
      if (n.sure) sure.push(n);
    }
    // Cluster by claimed region: same card iff the rule midlines sit
    // within 0.6× the smaller ascent of each other AND the rule spans
    // overlap by half the shorter one. Real neighbours are ~2.8 ascents
    // apart, so the margin is wide on both sides.
    const clusters = [];
    for (const n of sure) {
      const yMid = n.fit.yAt((n.fit.x0 + n.fit.x1) / 2);
      let home = null;
      for (const c of clusters) {
        const dy = Math.abs(yMid - c.yMid);
        const over = Math.min(n.fit.x1, c.x1) - Math.max(n.fit.x0, c.x0);
        const shorter = Math.min(n.fit.len, c.x1 - c.x0 + 1);
        if (dy < 0.6 * Math.min(n.zone.ascentPx, c.ascentPx) &&
            over >= 0.5 * shorter) { home = c; break; }
      }
      if (home) home.lines.add(n.t);
      else clusters.push({ yMid, x0: n.fit.x0, x1: n.fit.x1,
                           ascentPx: n.zone.ascentPx,
                           lines: new Set([n.t]) });
    }
    const lines = new Set();
    for (const c of clusters) {
      // a cluster is one card; it answers to its best pair's name, and
      // the pairs are span-ordered best first, so the first name wins
      lines.add(c.lines.values().next().value);
    }
    return { named, lines, clusters: clusters.length };
  }

  /* Read ONE card from an already-segmented frame. Returns
   * { ok:true, index, line, capture, scores }, { ok:false, many:true }
   * when more than one card stands in view (strictly one at a time —
   * the product owner's rule), or { ok:false } — never a guess: an
   * ambiguous identity is a refusal. */
  function readLineFromSeg(seg, log, deadline) {
    const pairs = findLinePairs(seg, deadline);
    if (!pairs.length) return { ok: false };
    const survey = surveyCards(seg, pairs, log, deadline);
    if (!survey) return { ok: false };
    if (survey.clusters >= 2) {
      log('hw: ' + survey.clusters + ' cards stand in this view (cards ' +
          Array.from(survey.lines).sort().map((t) => t + 1).join(', ') +
          ') — one card at a time, nothing read');
      return { ok: false, many: true,
               cards: Array.from(survey.lines).sort() };
    }
    // TWO PASSES over the candidate pairs. The first leaves the ink
    // exactly as segmented — on a bright capture the printed rule is
    // below the ink margin and nothing needs removing, so nothing pays
    // the sweep's disclosed cost (round letter bottoms can split at the
    // rule). If NO pair collects, the second pass sweeps the rule band:
    // a JPEG camera frame pushes patches of the faint rule over the ink
    // margin — too few for the 30% backstop gate, plenty to weld the
    // whole line into one blob (measured: 1 component where 35 stood).
    for (const sweep of [false, true]) {
      const got = tryPairs(seg, pairs, survey.named, sweep, log, deadline);
      if (got) return got;
    }
    return { ok: false };
  }

  function tryPairs(seg, pairs, named, sweep, log, deadline) {
    for (let pi = 0; pi < pairs.length; pi++) {
      const pr = pairs[pi];
      if (overtime(deadline)) return null;   // out of time — skip the frame
      const nm = named[pi];
      if (!nm || !nm.sure) continue;         // named by the survey, once
      const fit = nm.fit, zone = nm.zone;
      const mBest = nm.mBest, mClass = nm.mClass, uModel = nm.uModel;
      let cleaned = seg.ink;
      if (sweep) {
        cleaned = Uint8Array.from(seg.ink);
        removeRule(cleaned, seg, fit, Math.round(0.012 * zone.pageW));
      }
      let comps = lineComponents(cleaned, seg, fit, zone);
      // NOT-WRITING FILTER, close-up only. A close-up frame has the
      // sheet's own edge in it, and that edge's anti-aliased boundary
      // against the room segments as one frame-wide component whose
      // centroid can land inside the writing band — mergeSatellites
      // then swallows every letter into it (measured: 1 component where
      // 35 stood, with every letter intact underneath). Nothing on a
      // writing line is anywhere near the rule's own width or the whole
      // zone's height, so the cap costs no letter and no welded word.
      comps = dropNonWriting(comps, fit, zone);
      comps = mergeSatellites(comps, zone);
      if (comps.length < 4) {                // an unwritten card collects nothing
        log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px) — the writing ' +
            'line under the model is empty (' + comps.length + ' marks) — keep sweeping');
        continue;
      }
      // The child's ink must AGREE, twice over: its measured case class
      // matches the model's, and its own best alignment WITHIN that
      // class is the very card the model named, at the normal
      // acceptance quality. Disagreement refuses the frame — never a
      // guess, never a wrong card identity.
      const uChild = caseSignal(comps, fit);
      const cClass = classOf(uChild);
      const scores = [];
      for (let t = 0; t < HWSheet.LINES.length; t++) {
        scores.push(Object.assign({ t },
          scoreAgainst(HWSheet.LINES[t].text, comps)));
      }
      let best = null;
      for (const s of scores) {
        if ((isUniformText(HWSheet.LINES[s.t].text) ? 'uniform' : 'mixed') !== mClass) continue;
        if (!best || s.acc > best.acc) best = s;
      }
      const confident = cClass === mClass && best && best.t === mBest.t &&
        best.acc >= PL.ID_MIN &&
        best.acc >= PL.ID_FRAC * best.expected;
      // JOINED-UP IDENTITY. A card whose letters all hold hands accepts
      // ~nothing, so the child witness above can never pass — under the
      // whole-sheet era the ladder still registered such a line and the
      // child got the kind "holding hands" diagnosis; a card must not
      // lose it. When the model print alone has surely named the card,
      // the child ink aligned against THAT text is examined for the
      // joined signature (assembleLine's own thresholds): touching-
      // refusals dominating is a writing STYLE, not junk. Nothing is
      // ever ACCEPTED from such a card — every welded letter is refused
      // — so the zero-mislabel contract is untouched; what is at stake
      // is only which row carries the retake message, and the model
      // witness (72% of a full printed line, with margin) is the same
      // gate the confident path trusts for the same fact. The child
      // case class is deliberately not required here: welded word-blobs
      // top out at their tallest letter, so a joined lowercase line
      // measures 'uniform' by construction.
      let index = confident ? best.t : null;
      let viaJoined = false;
      if (index == null) {
        const alM = align(HWSheet.LINES[mBest.t].text, comps);
        if (alM.unit >= P.MIN_UNIT_PX) {
          let expected = 0, touching = 0, acc = 0;
          for (const tok of alM.tokens) {
            if (tok.ch === ' ') continue;
            expected++;
            if (tok.kind === 'touching') touching++;
            else if (accept(tok, comps, alM.unit)) acc++;
          }
          const joinedSig = expected > 0 &&
            (touching >= P.JOINED_TOUCH_FRAC * expected ||
             (acc <= P.JOINED_ACCEPT_FRAC * expected &&
              touching >= P.JOINED_TOUCH_FRAC_LO * expected));
          if (joinedSig) { index = mBest.t; viaJoined = true; }
        }
      }
      log('hw: one-card pair (span ' + Math.round(pr.dx) + 'px, tilt ' +
          (Math.atan(pr.b) * 180 / Math.PI).toFixed(1) + '°) — model says card ' +
          (mBest.t + 1) + ' (' + mClass + ', ' + mBest.acc + ' of ' + mBest.expected +
          '); child ink (u=' +
          (uChild == null ? '—' : uChild.toFixed(2)) + ') accepted per text: ' +
          scores.map((s) => 'card ' + (s.t + 1) + ':' + s.acc).join(' ') +
          (index != null
            ? ' → card ' + (index + 1) + (viaJoined ? ' (reads as joined-up)' : '')
            : ' → not sure enough, keep sweeping'));
      if (index == null) continue;
      const xTops = [];
      const line = assembleLine(index, HWSheet.LINES[index].text, comps,
                                align(HWSheet.LINES[index].text, comps),
                                fit, zone, seg, xTops, log);
      const xh = median(xTops) || 0.4 * zone.ascentPx;
      log('hw: one card met — card ' + (index + 1) + ', ' + line.accepted +
          ' of ' + line.expected + ' letters, x-height ~' + Math.round(xh) +
          'px' + (xTops.length ? ' (measured)' : ' (estimated)'));
      return { ok: true, index, line, scores,
               capture: { xHeightPx: xh, xHeightMeasured: xTops.length > 0,
                          coarse: xh < P.COARSE_XH, unit: line.unit,
                          pageW: zone.pageW,
                          tilt: Math.atan(pr.b) * 180 / Math.PI } };
    }
    return null;
  }

  /* One live frame of the free-motion loop. A LEGACY whole sheet wins
   * when it is there — a frame where the old print's full ladder
   * registers reads that whole sheet at once (all five lines land
   * together, exactly as an old sheet's photo always did) — otherwise
   * the frame is offered to the one-card reader. STRICTLY ONE CARD:
   * more than one card of the new print in view answers kind:'many'
   * and the page shows a gentle "one card at a time" overlay instead
   * of reading anything. */
  function readFrame(photo, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    // opts.deadline (performance.now()-based, live frames only): the
    // whole analysis is time-boxed — a frame that cannot be finished in
    // time answers 'nothing' and the loop simply offers the next one.
    const deadline = opts.deadline || 0;
    const loop = [[1, 1], [photo.width - 2, 1],
                  [photo.width - 2, photo.height - 2], [1, photo.height - 2]];
    const claim = BIAClaim.claim(loop, photo.width, photo.height);
    const seg = BIASegment.segment(photo, claim);
    if (findLadder(seg, function () {}, deadline)) {
      const res = read(photo, opts);
      if (res.ok) return { kind: 'sheet', result: res };
      return { kind: 'nothing' };
    }
    if (overtime(deadline)) return { kind: 'nothing' };
    const one = readLineFromSeg(seg, log, deadline);
    if (one.many) return { kind: 'many', cards: one.cards };
    if (one.ok) return { kind: 'line', index: one.index, line: one.line,
                         capture: one.capture, scores: one.scores };
    return { kind: 'nothing' };
  }

  // ---- the reader ------------------------------------------------------------
  /* read(photo, {log, onlyLine}) → result. `onlyLine` limits the merge a
   * per-line retake wants; the whole sheet is still located (the rules
   * are the registration), but letters are read only for that line. */
  function read(photo, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const t0 = performance.now();

    const loop = [[1, 1], [photo.width - 2, 1],
                  [photo.width - 2, photo.height - 2], [1, photo.height - 2]];
    const claim = BIAClaim.claim(loop, photo.width, photo.height);
    const seg = BIASegment.segment(photo, claim);
    log('hw: ink plane ready — ' + seg.compCount + ' raw components (' +
        Math.round(performance.now() - t0) + 'ms)');

    // ---- registration: end-marks first, printed rules second ---------------
    let fits = null, zones = null, viaAnchors = false, anis = 1;
    const ladder = findLadder(seg, log, opts.deadline || 0);
    if (ladder) {
      const reg = anchorFits(ladder);
      const up = whichWayUp(seg, reg.fits, reg.gaps);
      if (up === 'inverted' && !opts._flipped) {
        log('hw: the end-marks read upside down — turning the photograph around and reading again');
        return read(rotate180(photo), Object.assign({}, opts, { _flipped: true }));
      }
      if (up !== 'upright') {
        log('hw: REFUSED — end-marks found, but I could not tell which way up the sheet is (' +
            up + '; the title block was not where either way up puts it)');
        return { ok: false, reason: 'lines' };
      }
      fits = reg.fits; zones = reg.zones; viaAnchors = true; anis = ladder.anis;
    } else {
      log('hw: no legacy sheet ladder — trying an old sheet\'s printed rules, ' +
          'then the cards themselves');
      const runs = rowRuns(seg);
      let bands = candidateBands(runs, seg.width, seg.height, P.RUN_FRAC);
      let rules = chooseRules(bands, log);
      if (!rules) {
        bands = candidateBands(runs, seg.width, seg.height, P.RUN_FRAC_RETRY);
        rules = chooseRules(bands, log);
      }
      if (!rules) {
        // Not an old whole sheet — this photograph is offered to the
        // ONE-CARD reader (the current print is cards, strictly one at
        // a time).
        return readCardPhoto(photo, seg, opts, log, t0);
      }
      fits = [];
      let broken = false;
      for (const band of rules) {
        const fit = fitRule(seg, band);
        if (!fit) { broken = true; break; }
        fits.push(fit);
      }
      if (broken) {
        log('hw: a rule band would not fit a line — trying the cards themselves');
        return readCardPhoto(photo, seg, opts, log, t0);
      }
      // Per-line zones from measured length AND measured pitch, exactly as
      // the anchor path derives them — a flat capture measures anis ≈ 1
      // and everything downstream behaves as it always did. Legacy
      // geometry: this fallback only ever matches the old print.
      const mids = fits.map((f) => f.yAt((f.x0 + f.x1) / 2));
      const gaps = [];
      for (let i = 1; i < mids.length; i++) gaps.push(mids[i] - mids[i - 1]);
      zones = fits.map((f, i) => {
        const pitch = i === 0 ? gaps[0]
          : i === fits.length - 1 ? gaps[gaps.length - 1]
          : (gaps[i - 1] + gaps[i]) / 2;
        return HWSheet.lineZoneFor(f.len, pitch, HWSheet.LEGACY.GEOM);
      });
      anis = zones.reduce((a, z) => a + z.anis, 0) / zones.length;
    }

    // The model-print witness, on BOTH registrations: the sheet's own
    // printed model line must stand above every implied rule, or the
    // pattern that matched was not the writing page (see MODEL_BAND_MIN
    // for the measured failure this refuses).
    const modelDens = fits.map((f, i) => modelBandDensity(seg, f, zones[i]));
    if (!modelDens.every((d) => d >= P.MODEL_BAND_MIN)) {
      log('hw: REFUSED — marks lined up, but the printed model lines were not above ' +
          'the rules they imply (band ink ' +
          modelDens.map((d) => d.toFixed(3)).join(' ') +
          ', floor ' + P.MODEL_BAND_MIN + ') — that pattern is not the writing page');
      return { ok: false, reason: 'lines' };
    }
    log('hw: model print stands above every rule (band ink ' +
        modelDens.map((d) => d.toFixed(2)).join(' ') + ')');

    const cleaned = Uint8Array.from(seg.ink);
    const meanW = zones.reduce((a, z) => a + z.pageW, 0) / zones.length;
    let backstopped = 0;
    for (let i = 0; i < fits.length; i++) {
      if (ruleReadsAsInk(seg, fits[i])) {
        removeRule(cleaned, seg, fits[i], Math.round(0.012 * zones[i].pageW));
        backstopped++;
      }
    }
    log('hw: ' + fits.length + ' rules fit (page ~' + Math.round(meanW) + 'px wide, rule ' +
        fits[0].thickness + 'px thick, registered by ' +
        (viaAnchors ? 'end-marks' : 'the rules themselves') + ')' + (backstopped
          ? ' — ' + backstopped + ' read as ink and removed by run-length ' +
            '(dim capture; round letter bottoms may split there)'
          : ' — none read as ink, nothing removed'));

    const lines = [];
    const xTops = []; // raw camera-pixel ink heights of accepted x-class letters
    for (let i = 0; i < HWSheet.LINES.length; i++) {
      const text = HWSheet.LINES[i].text;
      if (opts.onlyLine != null && opts.onlyLine !== i) {
        lines.push({ index: i, text, found: false, skippedByRequest: true, letters: [] });
        continue;
      }
      const rule = fits[i];
      const zone = zones[i];
      let comps = lineComponents(cleaned, seg, rule, zone);
      comps = mergeSatellites(comps, zone);
      lines.push(assembleLine(i, text, comps, align(text, comps),
                              rule, zone, seg, xTops, log));
    }

    // Honest capture facts: how the photo registered, how tilted each
    // line sat, and how many camera pixels tall the child's letters
    // actually were — measured from the accepted x-class letters, or
    // estimated from the sheet's own measured vertical scale when a
    // coarse photo accepted none of them. Below COARSE_XH the traced
    // glyphs are honestly blocky, so the app tells the child kindly and
    // still keeps everything that read.
    const tilts = fits.map((f) => Math.atan(f.b) * 180 / Math.PI);
    const meanAscent = zones.reduce((a, z) => a + z.ascentPx, 0) / zones.length;
    const xhMeasured = median(xTops);
    const xHeightPx = xhMeasured || 0.4 * meanAscent;
    const coarse = xHeightPx < P.COARSE_XH;
    log('hw: capture — ' + (viaAnchors ? 'anchors 10 of 10' : 'no anchors (rule fallback)') +
        '; line tilt ' + tilts.map((t) => t.toFixed(1) + '°').join(' ') +
        '; x-height ~' + Math.round(xHeightPx) + 'px ' +
        (xhMeasured ? '(measured)' : '(estimated — no x-class letter accepted)') +
        (coarse ? ' — under the ' + P.COARSE_XH + 'px floor: glyphs honestly coarse' : ''));
    log('hw: sheet read in ' + Math.round(performance.now() - t0) + 'ms');
    return { ok: true, lines, zones, pageW: meanW,
             capture: { anchors: viaAnchors ? 10 : 0, viaAnchors, tilts,
                        xHeightPx, xHeightMeasured: !!xhMeasured, coarse, anis,
                        flipped: !!opts._flipped } };
  }

  /* A photograph offered to the ONE-CARD reader — the upload path for
   * the two-page card print. Strictly one card per photo (the product
   * owner's rule: "only 1 question at a time will be shown"): more than
   * one card surely in view answers { ok:false, reason:'many' } and the
   * app asks kindly for one card per picture. A photo that reads
   * nothing right way up is tried once upside down — phones do that —
   * through the very same gates. */
  function readCardPhoto(photo, seg, opts, log, t0) {
    const one = readLineFromSeg(seg, log, opts.deadline || 0);
    if (one.many) {
      log('hw: REFUSED — more than one card in this photograph (cards ' +
          one.cards.map((t) => t + 1).join(', ') + '); one card per picture');
      return { ok: false, reason: 'many' };
    }
    if (!one.ok) {
      if (!opts._flipped) {
        log('hw: no card met this way up — turning the photograph around and trying once more');
        const flipped = read(rotate180(photo), Object.assign({}, opts, { _flipped: true }));
        if (flipped.ok || flipped.reason === 'many') return flipped;
      }
      log('hw: REFUSED — no card\'s star pair and printed sentence were found together');
      return { ok: false, reason: 'lines' };
    }
    const lines = [];
    for (let i = 0; i < HWSheet.LINES.length; i++) {
      if (i === one.index) lines.push(one.line);
      else lines.push({ index: i, text: HWSheet.LINES[i].text,
                        found: false, letters: [] });
    }
    const cap = one.capture || {};
    log('hw: card photograph read in ' + Math.round(performance.now() - t0) + 'ms');
    return { ok: true, lines, zones: null, pageW: cap.pageW || 0,
             capture: { anchors: 2, viaAnchors: false, viaCard: true,
                        tilts: [cap.tilt || 0],
                        xHeightPx: cap.xHeightPx || 0,
                        xHeightMeasured: !!cap.xHeightMeasured,
                        coarse: !!cap.coarse, anis: 1,
                        flipped: !!opts._flipped } };
  }

  window.HWRead = { read, readFrame, PARAMS: P, LINE_PARAMS: PL, wt,
                    collectMarks, findLadder, findLinePairs };
})();
