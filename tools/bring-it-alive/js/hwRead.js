/* HW READ — find the lines, cut the ink apart, and ALIGN, never recognise.
 *
 * The reader's whole contract: it is handed a photograph of the filled
 * writing sheet (hwSheet.js) and the KNOWN text of every line, and it
 * answers "which known letter is this blob of ink standing where" — by
 * sequence alignment with gap tolerance, never by OCR, never by guessing
 * what a child's letter looks like. The house rule is REFUSE RATHER THAN
 * GUESS: letters that touched each other, marks that fit nowhere, and
 * alignments that are not confident are SKIPPED, never mislabeled. A
 * skipped letter costs the child nothing but an empty slot in the
 * alphabet grid, and recovery is per-line ("write this line once more"),
 * never start-over.
 *
 * Five stages:
 *
 * 1. INK. BIASegment.segment() over the whole frame — the existing
 *    illumination-flattened ink detection, reused as-is. Nothing here
 *    re-invents "what is ink"; this module only decides what the ink
 *    MEANS on this particular sheet.
 *
 * 2. RULES. The ruled baselines (one per model line — HWSheet.LINES is
 *    the count) are found as long horizontal darker-than-paper runs,
 *    then the set that matches the sheet's known pattern (even pitch,
 *    equal length, aligned ends, pitch/length ratio from HWSheet.GEOM)
 *    is chosen by scoring every combination. The
 *    rules are the sheet's own registration marks: each line's zone is
 *    derived from its rule's measured length, so nothing about the
 *    photograph's scale or position is ever assumed.
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
    ACCEPT_RATIO_HI: 2.1
  };

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

  // ---- 2. RULES --------------------------------------------------------------
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

  // Choose the 4 bands that ARE the sheet: even pitch, equal lengths,
  // aligned ends, pitch/length ratio near the geometry's own.
  function chooseRules(bands, log) {
    const G = HWSheet.GEOM;
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
  function fitRule(seg, band) {
    const w = seg.width, h = seg.height;
    const yPad = Math.max(3, (band.y1 - band.y0 + 1) * 2);
    const xs = [], ys = [], ts = [];
    for (let x = band.x0; x <= band.x1; x += 4) {
      let y0 = -1, y1 = -1;
      for (let y = Math.max(0, band.y0 - yPad); y <= Math.min(h - 1, band.y1 + yPad); y++) {
        if (seg.paper[y * w + x] - seg.lum[y * w + x] > P.RULE_DARK) {
          if (y0 < 0) y0 = y;
          y1 = y;
        }
      }
      if (y0 < 0) continue;
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
  function ruleReadsAsInk(seg, rule) {
    const w = seg.width;
    let on = 0, total = 0;
    for (let x = rule.x0; x <= rule.x1; x += 3) {
      const y = Math.round(rule.yAt(x));
      if (y < 0 || y >= seg.height) continue;
      total++;
      if (seg.ink[y * w + x]) on++;
    }
    return total > 0 && on / total > 0.3;
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
  function samplePatch(pieces, seg, rule) {
    const w = seg.width;
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
    for (const c of pieces) {
      x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1);
      y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1);
    }
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    const mask = new Uint8Array(pw * ph);
    for (const src of pieces) {
      for (const p of src.px) {
        const px = p % w, py = (p / w) | 0;
        mask[(py - y0) * pw + (px - x0)] = 1;
      }
    }
    const cx = (x0 + x1) / 2;
    const ruleY = rule.yAt(cx);
    return { mask, w: pw, h: ph, x0, y0,
             baselineRow: ruleY - y0,        // where the rule crosses the patch
             topAbove: ruleY - y0,           // px of letter above the baseline
             belowBase: y1 - ruleY,          // px below (descender or contact foot)
             inkWidth: pw, cx };
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

    const runs = rowRuns(seg);
    let bands = candidateBands(runs, seg.width, seg.height, P.RUN_FRAC);
    let rules = chooseRules(bands, log);
    if (!rules) {
      bands = candidateBands(runs, seg.width, seg.height, P.RUN_FRAC_RETRY);
      rules = chooseRules(bands, log);
    }
    if (!rules) {
      log('hw: REFUSED — the sheet\'s ruled lines were not found (' +
          bands.length + ' candidate bands, none matching the sheet pattern)');
      return { ok: false, reason: 'lines' };
    }

    const cleaned = Uint8Array.from(seg.ink);
    const fits = [];
    for (const band of rules) {
      const fit = fitRule(seg, band);
      if (!fit) { log('hw: REFUSED — a rule band would not fit a line'); return { ok: false, reason: 'lines' }; }
      fits.push(fit);
    }
    const zone = HWSheet.lineZoneFor(fits.reduce((a, f) => a + f.len, 0) / fits.length);
    let backstopped = 0;
    for (const fit of fits) {
      if (ruleReadsAsInk(seg, fit)) {
        removeRule(cleaned, seg, fit, Math.round(0.012 * zone.pageW));
        backstopped++;
      }
    }
    log('hw: ' + fits.length + ' rules fit (page ~' + Math.round(zone.pageW) + 'px wide, rule ' +
        fits[0].thickness + 'px thick)' + (backstopped
          ? ' — ' + backstopped + ' read as ink and removed by run-length ' +
            '(dim capture; round letter bottoms may split there)'
          : ' — none read as ink, nothing removed'));

    const lines = [];
    for (let i = 0; i < HWSheet.LINES.length; i++) {
      const text = HWSheet.LINES[i].text;
      if (opts.onlyLine != null && opts.onlyLine !== i) {
        lines.push({ index: i, text, found: false, skippedByRequest: true, letters: [] });
        continue;
      }
      const rule = fits[i];
      let comps = lineComponents(cleaned, seg, rule, zone);
      comps = mergeSatellites(comps, zone);
      const al = align(text, comps);
      const blobs = comps.map((c) => ({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, n: c.px.length }));
      const letters = [];
      const gapsIntra = [], gapsWord = [];
      let prevMatch = null, prevSpace = false;
      for (let t = 0; t < al.tokens.length; t++) {
        const tok = al.tokens[t];
        if (tok.ch === ' ') { prevSpace = true; continue; }
        const ok = accept(tok, comps, al.unit);
        const entry = { ch: tok.ch, kind: tok.kind, accepted: ok,
                        refused: tok.refused || (ok ? null : tok.kind), cost: tok.cost,
                        blobIndex: tok.blob != null ? tok.blob : null };
        if (ok) {
          const pieces = (tok.kind === 'split' ? tok.blobs : [tok.blob]).map((b) => comps[b]);
          entry.sample = samplePatch(pieces, seg, rule);
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
      log('hw: line ' + (i + 1) + ' — ' + comps.length + ' blobs vs ' + expected +
          ' letters: ' + got + ' accepted, ' +
          letters.filter((l) => l.kind === 'touching').length + ' touching-refused, ' +
          letters.filter((l) => l.kind === 'missing').length + ' missing (unit ' +
          Math.round(al.unit) + 'px)');
      lines.push({ index: i, text, found: true, rule,
                   letters, expected, accepted: got, blobs,
                   unit: al.unit, gapsIntra, gapsWord });
    }

    log('hw: sheet read in ' + Math.round(performance.now() - t0) + 'ms');
    return { ok: true, lines, zone, pageW: zone.pageW };
  }

  window.HWRead = { read, PARAMS: P, wt };
})();
