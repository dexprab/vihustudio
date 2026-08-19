/* REGIONS — the editable structure of the drawing, read from its topology.
 *
 * Mark 3.5's answer to "vector or raster": HYBRID, weighted all the way
 * toward the child's real pixels. Nothing here is a path, a Bézier or a
 * redrawn line. The original raster stays the line art; what this module
 * adds is a MAP of it — which pixels are ink, which enclosed area each
 * non-ink pixel belongs to, and which ink pixels form the boundary of
 * each area — so Fill and border edits can address parts of the drawing
 * without ever replacing a pixel of it. Pure vectorization was rejected
 * on the product test: a traced pencil line is not the child's pencil
 * line. Faithful + editable beats technically pure vector.
 *
 * The topology is computed from the RAW crop-local segmentation mask —
 * never from the rendered alpha — for one load-bearing reason: the mask
 * travels losslessly (RLE) inside the creation JSON, so a reopened
 * creation derives EXACTLY the same regions and every fill/border op
 * replays byte-identically on another day, in another session. Alpha
 * goes through a PNG round trip whose feather ring may round; the mask
 * does not.
 *
 * Gap tolerance: children's drawings do not close their shapes. A region
 * is therefore found against a morphologically CLOSED ink barrier — ink
 * dilated by a gap radius g — and then grown back out to the true ink
 * edge, so the fill reaches the pencil line rather than stopping short
 * of it. If no region of honest size exists at g, g is widened twice
 * before the module concludes the drawing simply has no closed areas —
 * which is a real answer, reported, never faked.
 *
 * Labels: -1 = ink (raw mask) · 0 = outside / unenclosed · 1..count = a
 * closed region. Every derived structure (boundaries, distance field) is
 * deterministic given the mask, so it is cached, never serialised.
 */
(function () {
  'use strict';

  // Multi-source BFS over an 8-neighbourhood: seeds at distance 0, grows
  // depth by depth (Chebyshev metric). visit(i, depth) once per pixel.
  function bfs(w, h, seedTest, passable, maxDepth, visit) {
    const seen = new Uint8Array(w * h);
    let frontier = [];
    for (let i = 0; i < seen.length; i++) {
      if (seedTest(i)) { seen[i] = 1; frontier.push(i); visit(i, 0); }
    }
    let depth = 0;
    while (frontier.length && depth < maxDepth) {
      depth++;
      const next = [];
      for (const i of frontier) {
        const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (seen[j] || !passable(j)) continue;
            seen[j] = 1; next.push(j); visit(j, depth);
          }
        }
      }
      frontier = next;
    }
    return seen;
  }

  function detectAt(mask, w, h, g, minArea) {
    const n = w * h;

    // 1. The closed barrier: ink dilated by g (gaps up to ~2g close).
    const closed = new Uint8Array(n);
    bfs(w, h, (i) => !!mask[i], () => true, g, (i) => { closed[i] = 1; });

    // 2. Labels. Start unassigned (-2); ink is -1.
    const labels = new Int32Array(n).fill(-2);
    for (let i = 0; i < n; i++) if (mask[i]) labels[i] = -1;

    // 3. Outside: flood from the crop border through the open (un-closed)
    // plane. Whatever open space the border reaches is not enclosed.
    const isBorder = (i) => {
      const x = i % w, y = (i / w) | 0;
      return (x === 0 || y === 0 || x === w - 1 || y === h - 1) && !closed[i];
    };
    bfs(w, h, isBorder, (j) => !closed[j] && !mask[j], Infinity,
      (i) => { labels[i] = 0; });

    // 4. Enclosed open components → candidate regions (4-connectivity, so
    // a fill can never leak through a diagonal pinhole).
    let count = 0;
    const areas = [0];
    for (let s = 0; s < n; s++) {
      if (closed[s] || mask[s] || labels[s] !== -2) continue;
      const id = ++count;
      let area = 0;
      const stack = [s];
      labels[s] = id;
      while (stack.length) {
        const i = stack.pop();
        area++;
        const x = i % w, y = (i / w) | 0;
        if (x > 0     && labels[i - 1] === -2 && !closed[i - 1]) { labels[i - 1] = id; stack.push(i - 1); }
        if (x < w - 1 && labels[i + 1] === -2 && !closed[i + 1]) { labels[i + 1] = id; stack.push(i + 1); }
        if (y > 0     && labels[i - w] === -2 && !closed[i - w]) { labels[i - w] = id; stack.push(i - w); }
        if (y < h - 1 && labels[i + w] === -2 && !closed[i + w]) { labels[i + w] = id; stack.push(i + w); }
      }
      areas.push(area);
    }

    // Pockets smaller than minArea are texture, not areas a child means —
    // fold them into "outside" so a tap there does nothing rather than
    // producing confetti fills inside a scribble.
    const keep = new Int32Array(count + 1);
    let kept = 0;
    for (let id = 1; id <= count; id++) keep[id] = areas[id] >= minArea ? ++kept : 0;
    if (kept === 0) return null;
    const keptAreas = [0];
    for (let id = 1; id <= count; id++) if (keep[id]) keptAreas.push(areas[id]);
    for (let i = 0; i < n; i++) if (labels[i] > 0) labels[i] = keep[labels[i]];

    // 5. Grow every label (outside included) back through the closing band
    // — the !mask pixels the dilation swallowed — so a region reaches the
    // true edge of the pencil line and a fill meets the ink. First label
    // to arrive wins; ties resolve by BFS order, which is deterministic.
    bfs(w, h,
      (i) => labels[i] >= 0 && closedNeighbourUnassigned(i),
      (j) => !mask[j] && labels[j] === -2,
      Infinity,
      function grow(i) {
        if (labels[i] !== -2) return;             // seed pixels keep their label
        const x = i % w, y = (i / w) | 0;
        // adopt the label of any already-labelled neighbour (first found)
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const l = labels[yy * w + xx];
            if (l >= 0) { labels[i] = l; return; }
          }
        }
        labels[i] = 0;
      });
    function closedNeighbourUnassigned(i) {
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          if (labels[yy * w + xx] === -2 && !mask[yy * w + xx]) return true;
        }
      }
      return false;
    }
    for (let i = 0; i < n; i++) if (labels[i] === -2) labels[i] = 0; // ink-locked leftovers

    return { labels, count: kept, areas: keptAreas };
  }

  /**
   * detect(mask, w, h) → region map | a loud "none" result.
   * Widens the gap radius twice before giving up, because a child's
   * almost-closed shape deserves two more tries and a fake region
   * deserves none.
   */
  function detect(mask, w, h) {
    const minDim = Math.min(w, h);
    const minArea = Math.max(300, Math.round(w * h * 0.0008));
    const g0 = Math.max(3, Math.round(minDim / 60));
    let found = null, g = g0;
    for (const factor of [1, 1.6, 2.4]) {
      g = Math.max(3, Math.round(g0 * factor));
      found = detectAt(mask, w, h, g, minArea);
      if (found) break;
    }
    if (!found) {
      return { none: true, count: 0, g,
        note: 'regions: no closed area found (gap radius tried up to ' + g +
              'px) — this drawing has open lines only; Fill has nothing to fill' };
    }

    // Distance-to-paper inside the ink (Chebyshev): dt of an ink pixel is
    // how deep in the stroke it sits. The stroke's typical half-width is
    // read off the field's high quantile — used to bound boundary reach
    // and to size Thin/Thick honestly for THIS drawing's own pencil.
    const n = w * h;
    const dt = new Uint16Array(n);
    bfs(w, h, (i) => !mask[i], (j) => !!mask[j], 512, (i, d) => { dt[i] = d; });
    const inkDepths = [];
    for (let i = 0; i < n; i++) if (mask[i] && (i & 7) === 0) inkDepths.push(dt[i]);
    inkDepths.sort((a, b) => a - b);
    const halfWidth = inkDepths.length
      ? Math.max(2, inkDepths[Math.floor(inkDepths.length * 0.9)]) : 2;

    const R = {
      labels: found.labels, count: found.count, areas: found.areas,
      g, dt, halfWidth, minArea,
      note: 'regions: ' + found.count + ' closed area(s), gap radius ' + g +
            'px, stroke half-width ~' + halfWidth + 'px',
      _boundaries: {},

      /* The boundary of a region: ink pixels reachable from the region's
       * edge, crossing at most the stroke's own thickness — so the whole
       * pencil line around an area belongs to it, but the BFS cannot run
       * off down a connecting line to somewhere else. Returned as indices,
       * cached (deterministic per mask). */
      boundaryOf(id) {
        if (this._boundaries[id]) return this._boundaries[id];
        const reach = 2 * halfWidth + 3;
        const out = [];
        const seedTest = (i) => {
          if (!mask[i]) return false;
          const x = i % w, y = (i / w) | 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              if (this.labels[yy * w + xx] === id) return true;
            }
          }
          return false;
        };
        bfs(w, h, seedTest, (j) => !!mask[j], reach, (i) => out.push(i));
        const arr = Uint32Array.from(out.sort((a, b) => a - b));
        this._boundaries[id] = arr;
        return arr;
      },

      /* What did the child touch? Ink within snap px → the line (border)
       * of the region that ink bounds; open space with a label → that
       * region's inside; anything else → nothing. */
      hit(x, y, snap) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        const s = snap == null ? 3 : snap;
        let inkI = -1;
        outer:
        for (let r = 0; r <= s; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              if (mask[yy * w + xx]) { inkI = yy * w + xx; break outer; }
            }
          }
        }
        if (inkI >= 0) {
          // the line: find which region this ink bounds (nearest labelled
          // pixel through the ink, bounded by the stroke's own reach)
          let region = 0, best = Infinity;
          const reach = 2 * halfWidth + 3;
          bfs(w, h, (i) => i === inkI, (j) => !!mask[j], reach, (i, d) => {
            const px = i % w, py = (i / w) | 0;
            for (let dy = -1; dy <= 1; dy++) {
              const yy = py + dy; if (yy < 0 || yy >= h) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const xx = px + dx; if (xx < 0 || xx >= w) continue;
                const l = this.labels[yy * w + xx];
                if (l > 0 && d < best) { best = d; region = l; }
              }
            }
          });
          return region > 0 ? { kind: 'ink', region } : null;
        }
        const l = this.labels[y * w + x];
        return l > 0 ? { kind: 'region', region: l } : null;
      }
    };
    return R;
  }

  window.BIARegions = { detect };
})();
