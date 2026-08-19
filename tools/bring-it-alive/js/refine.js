/* REFINE — the child corrects the proposal; the child never re-claims.
 *
 * Two brushes, and the granularity problem they actually have to solve:
 * on a real drawing everything the child made is often ONE ink component
 * (a ground line touches the figure and the table, a connecting line
 * touches both characters). "Remove the component under the stroke" would
 * delete the whole drawing; "remove only brushed pixels" would leave
 * crumbs a child cannot see, let alone chase. So each brush works on two
 * tiers:
 *
 * KEEP:
 *   · every pixel under the stroke that answers the RELAXED ink question
 *     joins the mask (a Keep stroke is evidence — faint pencil the
 *     detector skipped gets a second look at half the margin);
 *   · ink reachable from the stroke within a short geodesic distance
 *     joins too, so a stroke down a line collects the line's own
 *     anti-aliased edges without the child scrubbing;
 *   · a SMALL ink component touched at all comes in whole — one dab
 *     claims a whole star or flower, including any part outside the
 *     claim loop. Large components never come in whole from a dab,
 *     because on a connected drawing "whole" means "everything".
 *
 * REMOVE:
 *   · mask pixels under the stroke leave;
 *   · a SMALL mask region mostly covered by the stroke leaves entirely
 *     (one dab deletes a speck);
 *   · when the stroke CUTS a large region, the fragments it severed are
 *     tidied: the largest fragment stays (that is the thing the child
 *     claimed), fragments the child explicitly kept earlier stay, and
 *     orphaned slivers — under a quarter of the largest — go with the
 *     stroke. Cutting a line off a figure therefore removes the line's
 *     crumbs too, not just the brushed part.
 *
 * Marks are applied in the order the child made them, so a Keep after a
 * Remove wins on the pixels it touches, and vice versa — the same rule a
 * physical eraser and pencil obey.
 */
(function () {
  'use strict';

  // Stamp the stroke (polyline + radius) into a list of pixel indices.
  // Discs at half-radius spacing; a reusable scratch plane dedupes.
  function brushPixels(seg, mark, scratch) {
    const w = seg.width, h = seg.height;
    const r = Math.max(2, Math.round(mark.radius));
    const pts = mark.points.length ? mark.points : [];
    const out = [];
    const stamp = (cx, cy) => {
      const x0 = Math.max(0, Math.round(cx - r)), x1 = Math.min(w - 1, Math.round(cx + r));
      const y0 = Math.max(0, Math.round(cy - r)), y1 = Math.min(h - 1, Math.round(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const i = y * w + x;
        if (!scratch[i]) { scratch[i] = 1; out.push(i); }
      }
    };
    for (let k = 0; k < pts.length; k++) {
      const [x, y] = pts[k];
      if (k === 0) { stamp(x, y); continue; }
      const [px, py] = pts[k - 1];
      const d = Math.hypot(x - px, y - py), steps = Math.max(1, Math.ceil(d / (r / 2)));
      for (let s = 1; s <= steps; s++) stamp(px + (x - px) * s / steps, py + (y - py) * s / steps);
    }
    return out;
  }

  function clearScratch(scratch, pixels) {
    for (let k = 0; k < pixels.length; k++) scratch[pixels[k]] = 0;
  }

  function ensureState(seg) {
    if (!seg._refine) {
      seg._refine = {
        scratch: new Uint8Array(seg.width * seg.height),
        keepMap: new Uint8Array(seg.width * seg.height),
        stack: new Int32Array(seg.width * seg.height)
      };
    }
    return seg._refine;
  }

  // The v0.2 halo tightening for Keep: a RELAXED pixel (half-margin — the
  // stroke's faint neighbourhood) may join the mask only within a short
  // distance of a strictly-detected ink pixel. Without this, a Keep stroke
  // over faint pencil also collected free-standing patches of paper shading
  // that then shipped opaque. Strict ink under the brush is untouched by
  // this gate — the child pointing at real ink always wins.
  const NEAR_INK = 3; // Chebyshev radius
  function nearStrictInk(seg, i) {
    const w = seg.width, h = seg.height;
    const x = i % w, y = (i / w) | 0;
    const y0 = Math.max(0, y - NEAR_INK), y1 = Math.min(h - 1, y + NEAR_INK);
    const x0 = Math.max(0, x - NEAR_INK), x1 = Math.min(w - 1, x + NEAR_INK);
    for (let yy = y0; yy <= y1; yy++) {
      const row = yy * w;
      for (let xx = x0; xx <= x1; xx++) if (seg.ink[row + xx]) return true;
    }
    return false;
  }

  function applyKeep(seg, mark) {
    const st = ensureState(seg);
    const w = seg.width, h = seg.height;
    const brushed = brushPixels(seg, mark, st.scratch);
    const geo = Math.max(6, Math.round(mark.radius / 2));

    const seeds = [];
    const smallTouched = new Set();
    for (let k = 0; k < brushed.length; k++) {
      const i = brushed[k];
      if (seg.ink[i] ||
          (window.BIASegment.relaxedInkAt(seg, i) && nearStrictInk(seg, i))) {
        if (!seg.mask[i]) { seg.mask[i] = 1; seg.maskCount++; }
        st.keepMap[i] = 1;
        seeds.push(i);
        const lb = seg.labels[i];
        if (lb && seg.compSize[lb] <= seg.smallComp) smallTouched.add(lb);
      }
    }
    clearScratch(st.scratch, brushed);

    // Geodesic reach: BFS through detected ink, bounded so a stroke down
    // a connecting line cannot creep far into the figure the line joins.
    if (seeds.length) {
      const dist = st.scratch; // reuse as visited/depth marker (1-based)
      const q = st.stack;
      let head = 0, tail = 0;
      const visited = [];
      for (const s of seeds) { q[tail++] = s; dist[s] = 1; visited.push(s); }
      while (head < tail) {
        const i = q[head++];
        const d = dist[i];
        if (d > geo) continue;
        const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (dist[j] || !seg.ink[j]) continue;
            dist[j] = d + 1; visited.push(j); q[tail++] = j;
            if (!seg.mask[j]) { seg.mask[j] = 1; seg.maskCount++; }
            st.keepMap[j] = 1;
          }
        }
      }
      clearScratch(dist, visited);
    }

    // Whole-component adoption for small pieces (one full scan, all at once).
    if (smallTouched.size) {
      for (let i = 0; i < seg.labels.length; i++) {
        if (smallTouched.has(seg.labels[i])) {
          if (!seg.mask[i]) { seg.mask[i] = 1; seg.maskCount++; }
          st.keepMap[i] = 1;
        }
      }
    }
  }

  function applyRemove(seg, mark) {
    const st = ensureState(seg);
    const w = seg.width, h = seg.height;
    const brushed = brushPixels(seg, mark, st.scratch);

    // The mask region(s) this stroke touches: flood the CURRENT mask from
    // every brushed mask pixel. This is the piece of the proposal the
    // child is pointing at.
    const region = [];
    const markMap = st.scratch;         // brushed pixels are already 1 here
    const q = st.stack;
    let head = 0, tail = 0;
    const regionFlag = new Uint8Array(w * h);
    let erased = 0;
    for (let k = 0; k < brushed.length; k++) {
      const i = brushed[k];
      if (seg.mask[i] && !regionFlag[i]) { regionFlag[i] = 1; q[tail++] = i; region.push(i); }
    }
    while (head < tail) {
      const i = q[head++];
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (seg.mask[j] && !regionFlag[j]) { regionFlag[j] = 1; q[tail++] = j; region.push(j); }
        }
      }
    }

    // Erase what the stroke covered.
    for (let k = 0; k < brushed.length; k++) {
      const i = brushed[k];
      if (seg.mask[i]) { seg.mask[i] = 0; st.keepMap[i] = 0; seg.maskCount--; erased++; }
    }
    clearScratch(markMap, brushed);
    if (!erased) return;

    // One dab on a small piece deletes the piece.
    if (region.length <= seg.smallComp && erased >= region.length * 0.5) {
      for (let k = 0; k < region.length; k++) {
        const i = region[k];
        if (seg.mask[i]) { seg.mask[i] = 0; st.keepMap[i] = 0; seg.maskCount--; }
      }
      return;
    }

    // The stroke cut a large region: find the fragments it left behind
    // and drop the orphaned slivers (see the header comment for why).
    const frags = [];
    const fragLabel = regionFlag; // reuse: 1 = unvisited region pixel
    for (let k = 0; k < region.length; k++) {
      const seed = region[k];
      if (!seg.mask[seed] || fragLabel[seed] !== 1) continue;
      const pix = [];
      let hasKeep = false;
      let h2 = 0, t2 = 0;
      q[t2++] = seed; fragLabel[seed] = 2;
      while (h2 < t2) {
        const i = q[h2++];
        pix.push(i);
        if (st.keepMap[i]) hasKeep = true;
        const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (seg.mask[j] && fragLabel[j] === 1) { fragLabel[j] = 2; q[t2++] = j; }
          }
        }
      }
      frags.push({ pix, hasKeep });
    }
    let largest = 0;
    for (const f of frags) if (f.pix.length > largest) largest = f.pix.length;
    for (const f of frags) {
      if (f.pix.length === largest || f.hasKeep || f.pix.length >= largest * 0.25) continue;
      for (const i of f.pix) {
        if (seg.mask[i]) { seg.mask[i] = 0; st.keepMap[i] = 0; seg.maskCount--; }
      }
    }
  }

  function applyMark(seg, mark) {
    if (mark.type === 'keep') applyKeep(seg, mark);
    else applyRemove(seg, mark);
  }

  /**
   * refine(mask, keepMarks, removeMarks) — the brief's signature.
   * Rebuilds from the segmentation's initial proposal and replays every
   * mark in the order the child made them (marks carry `t`). The app
   * applies marks incrementally with applyMark for responsiveness; this
   * entry point exists so the whole history is one deterministic replay.
   */
  function refine(seg, keepMarks, removeMarks) {
    // Reset to the initial claim verdicts.
    const w = seg.width, n = w * seg.height;
    const inside = seg.claim ? seg.claim.inside : null;
    seg.maskCount = 0;
    for (let i = 0; i < n; i++) {
      const lb = seg.labels[i];
      const whole = lb && seg.compInside[lb] &&
        seg.compSize[lb] >= seg.speck &&
        seg.compInside[lb] / seg.compSize[lb] >= seg.params.FRAC_WHOLE;
      const clip = lb && seg.compInside[lb] && !whole &&
        seg.compSize[lb] >= seg.speck && inside && inside[i];
      seg.mask[i] = (whole || clip) ? 1 : 0;
      if (seg.mask[i]) seg.maskCount++;
    }
    if (seg._refine) seg._refine.keepMap.fill(0);

    const all = [].concat(keepMarks || [], removeMarks || [])
      .sort((a, b) => (a.t || 0) - (b.t || 0));
    for (const m of all) applyMark(seg, m);
    return seg.mask;
  }

  window.BIARefine = { refine, applyMark };
})();
