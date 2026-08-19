/* SEGMENT — find the ink, honour the claim.
 *
 * The classical baseline the brief asked for, in pure typed-array JS.
 * (SAM 2 / learned segmentation was not testable in this offline
 * environment — no model downloads, no CDN — so this is the honest
 * simplest architecture, and the suite measures how far it gets.)
 *
 * Three stages, each with one idea:
 *
 * 1. PAPER ESTIMATE. A heavily downsampled, ink-suppressed, blurred copy
 *    of the luminance approximates "what the paper looks like here" —
 *    creases, corner shadows and brightness gradients ride along with it.
 *    A pixel is ink when it is clearly DARKER THAN ITS OWN LOCAL PAPER,
 *    not darker than some global number. This flattened copy exists for
 *    DECISIONS ONLY; nothing derived from it is ever exported — the
 *    preservation rule forbids it, and extract.js only ever reads the
 *    untouched source pixels.
 *
 * 2. COMPONENTS. Ink pixels are grouped by 8-connectivity across the
 *    WHOLE image, because connectivity is exactly what makes the hard
 *    cases hard: a line that touches two figures makes them one
 *    component, and no rectangle can separate them.
 *
 * 3. THE CLAIM DECIDES PER COMPONENT. A component essentially inside the
 *    loop comes in whole (a loose loop that clips a foot still gets the
 *    foot). A component that mostly lives OUTSIDE — the connecting line
 *    running off to the other figure, dragging that figure with it — is
 *    admitted only for the part inside the loop. That leaves an honest
 *    stub at the claim boundary, which is precisely the ambiguity
 *    Keep/Remove (refine.js) exists to settle: the tool must not guess
 *    what the child meant when the drawing itself is ambiguous.
 */
(function () {
  'use strict';

  const P = {
    CELL: 16,        // paper estimate cell size (≈1/16 scale)
    MARGIN: 25,      // ink = at least this much darker than local paper
    RELAX: 0.55,     // Keep-stroke margin factor — see relaxedInkAt below
    CHROMA: 34,      // or this chromatic (coloured pens on white paper)
    SPECK: 8,        // floor for the speck cut — see speckFor()
    FRAC_WHOLE: 0.85 // component at least this far inside → comes in whole
  };

  function luminanceOf(d, i) {
    // Rec. 601 integer approximation; exactness is irrelevant here, this
    // number never reaches the export path.
    return (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  /* The paper estimate. Downsample luminance to CELL-sized blocks, then
   * take a 3×3 neighbourhood MAX (strokes are sparse and dark, so the
   * local maximum is paper, not ink), then box-blur twice so shadow
   * edges become gradients instead of cliffs. Sampled back up bilinearly. */
  function paperEstimate(data, w, h) {
    const gw = Math.ceil(w / P.CELL), gh = Math.ceil(h / P.CELL);
    const sum = new Float32Array(gw * gh), cnt = new Float32Array(gw * gh);
    for (let y = 0; y < h; y++) {
      const gy = (y / P.CELL) | 0;
      for (let x = 0; x < w; x++) {
        const g = gy * gw + ((x / P.CELL) | 0);
        sum[g] += luminanceOf(data, (y * w + x) * 4);
        cnt[g]++;
      }
    }
    let grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = sum[i] / (cnt[i] || 1);

    const maxed = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) {
          const v = grid[yy * gw + xx]; if (v > m) m = v;
        }
      }
      maxed[y * gw + x] = m;
    }
    grid = maxed;

    for (let pass = 0; pass < 2; pass++) {
      const out = new Float32Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) { s += grid[yy * gw + xx]; n++; }
        }
        out[y * gw + x] = s / n;
      }
      grid = out;
    }
    return { grid, gw, gh };
  }

  function samplePaper(est, x, y) {
    const fx = Math.min(est.gw - 1.001, Math.max(0, x / P.CELL - 0.5));
    const fy = Math.min(est.gh - 1.001, Math.max(0, y / P.CELL - 0.5));
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
    const g = est.grid, r0 = y0 * est.gw + x0, r1 = r0 + est.gw;
    return (g[r0] * (1 - ax) + g[r0 + 1] * ax) * (1 - ay) +
           (g[r1] * (1 - ax) + g[r1 + 1] * ax) * ay;
  }

  function chromaOf(d, i) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    return Math.max(r, g, b) - Math.min(r, g, b);
  }

  // The speck cut scales with the photograph. A 16MP phone photo of real
  // paper produces tens of thousands of texture-and-shadow components of
  // 10–60 pixels each; at that resolution the shortest deliberate pencil
  // mark (a pupil, a dot on an i) is still hundreds of pixels. A fixed
  // small cut let the real Test Case 001 asset ship freckled with paper
  // grain — measured, 47,719 components, almost all noise.
  function speckFor(n) {
    return Math.max(P.SPECK, Math.round(n / 200000));
  }

  function segment(photo, claimObj) {
    const w = photo.width, h = photo.height, n = w * h;
    const data = photo.imageData.data;

    const est = paperEstimate(data, w, h);

    // Per-pixel paper level is kept (one byte each) because refine.js
    // re-asks the ink question at a lower threshold under Keep strokes.
    const paper = new Uint8Array(n);
    const lum = new Uint8Array(n);
    const ink = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, p4 = i * 4;
        const L = luminanceOf(data, p4);
        const pl = samplePaper(est, x, y);
        lum[i] = L;
        paper[i] = pl > 255 ? 255 : pl;
        // Darker than local paper, or clearly coloured ON paper. The
        // "on paper" guard (pl > 150) is what keeps a red tablecloth or
        // dark table from reading as one giant coloured stroke.
        if (pl - L > P.MARGIN ||
            (chromaOf(data, p4) > P.CHROMA && pl > 150 && L < pl - 12)) {
          ink[i] = 1;
        }
      }
    }

    // Connected components, 8-connectivity, iterative flood.
    const labels = new Int32Array(n); // 0 = not ink / unlabelled
    const stack = new Int32Array(n);
    const compSize = [0];   // 1-based; index 0 unused
    const compInside = [0];
    const inside = claimObj ? claimObj.inside : null;
    let compCount = 0;
    for (let seed = 0; seed < n; seed++) {
      if (!ink[seed] || labels[seed]) continue;
      const label = ++compCount;
      let size = 0, ins = 0, top = 0;
      stack[top++] = seed; labels[seed] = label;
      while (top > 0) {
        const i = stack[--top];
        size++;
        if (inside && inside[i]) ins++;
        const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (ink[j] && !labels[j]) { labels[j] = label; stack[top] = j; top++; }
          }
        }
      }
      compSize[label] = size;
      compInside[label] = ins;
    }

    // The claim's verdict per component (see the header comment).
    const speck = speckFor(n);
    const verdict = new Uint8Array(compCount + 1); // 0 out · 1 clip · 2 whole
    for (let c2 = 1; c2 <= compCount; c2++) {
      if (compSize[c2] < speck) continue;
      if (!compInside[c2]) continue;
      verdict[c2] = (compInside[c2] / compSize[c2] >= P.FRAC_WHOLE) ? 2 : 1;
    }

    const mask = new Uint8Array(n);
    let maskCount = 0;
    for (let i = 0; i < n; i++) {
      const v = verdict[labels[i]];
      if (v === 2 || (v === 1 && inside && inside[i])) { mask[i] = 1; maskCount++; }
    }

    return {
      width: w, height: h,
      photo: photo, claim: claimObj,
      ink, labels, compCount,
      compSize: Int32Array.from(compSize),
      compInside: Int32Array.from(compInside),
      lum, paper,
      mask, maskCount, speck,
      // "Small" is relative to the photograph: a whole accessory drawing
      // on a phone photo is thousands of pixels, on the surrogate hundreds.
      smallComp: Math.max(400, Math.round(n / 1500)),
      params: Object.assign({}, P)
    };
  }

  /* The relaxed ink question, asked only under a Keep stroke: the child
   * is asserting "there is drawing here", which is evidence the detector
   * did not have on its first pass — faint pencil earns a second look at
   * roughly half the margin. Never applied globally: globally it would
   * pull paper shading and crease shadows into every mask. */
  function relaxedInkAt(seg, i) {
    if (seg.ink[i]) return true;
    const d = seg.photo.imageData.data, p4 = i * 4;
    if (seg.paper[i] - seg.lum[i] > P.MARGIN * P.RELAX) return true;
    return chromaOf(d, p4) > P.CHROMA * 0.75 && seg.paper[i] > 150 &&
           seg.lum[i] < seg.paper[i] - 8;
  }

  /* The stroke-skirt plane, for extract.js's gated dilation (the v0.2 halo
   * fix). A pixel is "skirt" when it is at least FAINTLY darker than its
   * local paper (the anti-aliased edge of a stroke) or faintly coloured on
   * paper — the pixels dilation exists to collect. Flat paper is neither,
   * so a mask grown only through this plane cannot grow a paper rim. The
   * margin (8) is deliberately far below MARGIN (25): this plane never
   * ADDS pixels by itself, it only permits growth next to detected ink. */
  function skirt(seg) {
    const n = seg.width * seg.height;
    const out = new Uint8Array(n);
    const d = seg.photo.imageData.data;
    for (let i = 0; i < n; i++) {
      if (seg.ink[i] || seg.paper[i] - seg.lum[i] > 8) { out[i] = 1; continue; }
      if (chromaOf(d, i * 4) > P.CHROMA * 0.5 && seg.paper[i] > 150 &&
          seg.lum[i] < seg.paper[i] - 4) out[i] = 1;
    }
    return out;
  }

  window.BIASegment = { segment, relaxedInkAt, skirt, PARAMS: P };
})();
