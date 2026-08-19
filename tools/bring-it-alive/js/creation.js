/* CREATION — the layered Vihu Creation document. Not a flattened PNG.
 *
 * The layers, v0.2 "From Paper Drawing → Editable Vihu Creation":
 *
 *   Vihu Creation
 *   ├── ORIGINAL   — source photograph ref, segmentation mask, extracted
 *   │                pixels. NEVER written after construction. Byte-preserved.
 *   ├── STRUCTURE  — the region map (js/regions.js), DERIVED from the raw
 *   │                mask, deterministic, never serialised: closed areas,
 *   │                their boundary ink, the stroke depth field. The hybrid
 *   │                seam: structure is vector-like, the pixels stay real.
 *   ├── EDITS      — rebuilt by replaying an op history:
 *   │                  · fills (colour under the pencil lines, per region)
 *   │                  · line colour (a TINT of the region's own boundary
 *   │                    ink — texture preserved, never a flat repaint)
 *   │                  · line weight (Thin / Original / Thick — hidden or
 *   │                    replicated boundary pixels at compose time, the
 *   │                    original bytes untouched)
 *   │                  · pencil strokes (point paths, rendered on demand)
 *   │                  · erase — WHATEVER IS UNDER IT, non-destructively.
 *   │                    Per pixel: paint/pencil and fill are cleared where
 *   │                    they exist; where only the original drawing is,
 *   │                    the eraser HIDES it (a bit in a replayed plane,
 *   │                    never a write to the layer). Restored by the
 *   │                    product owner ("allow me to erase whatsoever i
 *   │                    want") over the brief's edits-only erase. Undo,
 *   │                    Reset and the Original view all still show every
 *   │                    hidden pixel, because nothing was destroyed.
 *   └── TRANSFORM  — position, scale, rotation (ops too — one undo stack)
 *
 * CURRENT VIEW = fills, UNDER the original (its lines stay on top), with
 * line tint/weight applied at compose time, plus pencil/paint on top.
 * Composited in typed arrays so the untouched view stays BYTE-IDENTICAL
 * to ORIGINAL — "no ghost" is an equality, not a judgement.
 *
 * RESET is history movement, not destruction: cursor to zero, ops kept,
 * so even a reset can be walked back with Redo.
 *
 * This module knows NOTHING about segmentation. Its input is the shape
 * {imageData, crop, maskPixels}; any segmenter producing it could feed it.
 */
(function () {
  'use strict';

  const FORMAT = 'vihu-creation';
  const VERSION = 2;                    // v2: fills, line ops, pencil, edits-only erase
  const SCALE_MIN = 0.2, SCALE_MAX = 5;

  function hexRGB(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)];
  }
  // Deterministic small PRNG for the pencil's edge texture — seeded from
  // the op's own geometry, so every replay of an op is byte-identical.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function opSeed(op) {
    const p0 = op.points[0];
    return (op.points.length * 2654435761 ^ Math.round(p0[0] * 73856093) ^
            Math.round(p0[1] * 19349663)) | 0;
  }

  /* The line tint: the target colour scaled by the pixel's own darkness,
   * so a red line is red where the pencil pressed light and deep red where
   * it pressed hard — the stroke's texture survives, and luminance ORDER
   * is preserved (the map is monotone in the source luminance). Alpha is
   * never touched. */
  const TINT_REF = 230;
  function tint(r, g, b, t) {
    const v = (r * 77 + g * 150 + b * 29) >> 8;
    const f = Math.min(1, v / TINT_REF);
    return [Math.round(t[0] * f), Math.round(t[1] * f), Math.round(t[2] * f)];
  }

  // ---- stroke stamping (erase) ----------------------------------------------
  // Discs along the polyline at half-radius spacing, deduped by a scratch
  // plane — the same honest rasteriser refine.js uses, local to the doc.
  function stampStroke(points, radius, w, h, cb) {
    const r = Math.max(1, Math.round(radius));
    const seen = stampStroke._scratch && stampStroke._scratch.length === w * h
      ? stampStroke._scratch : (stampStroke._scratch = new Uint8Array(w * h));
    const touched = [];
    const stamp = (cx, cy) => {
      const x0 = Math.max(0, Math.round(cx - r)), x1 = Math.min(w - 1, Math.round(cx + r));
      const y0 = Math.max(0, Math.round(cy - r)), y1 = Math.min(h - 1, Math.round(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const i = y * w + x;
        if (!seen[i]) { seen[i] = 1; touched.push(i); cb(i); }
      }
    };
    for (let k = 0; k < points.length; k++) {
      const [x, y] = points[k];
      if (k === 0) { stamp(x, y); continue; }
      const [px, py] = points[k - 1];
      const d = Math.hypot(x - px, y - py), steps = Math.max(1, Math.ceil(d / (r / 2)));
      for (let s = 1; s <= steps; s++) stamp(px + (x - px) * s / steps, py + (y - py) * s / steps);
    }
    for (let k = 0; k < touched.length; k++) seen[touched[k]] = 0;
  }

  /* The pencil: an opaque core the exact chosen colour, and a narrow edge
   * band whose alpha jitters deterministically — a mark that reads as
   * pencil, not as a digital paintbrush. Stamped straight into the paint
   * layer's pixels; the op stores only the point path, the radius and the
   * colour, and is re-rendered on every replay. */
  function stampPencil(pd, w, h, op) {
    const rng = mulberry32(opSeed(op));
    const [tr, tg, tb] = hexRGB(op.color);
    const r = Math.max(1, op.radius);
    const core = r - 0.7, edge = r + 0.7;
    const d = pd.data;
    const stamp = (cx, cy) => {
      const x0 = Math.max(0, Math.floor(cx - edge)), x1 = Math.min(w - 1, Math.ceil(cx + edge));
      const y0 = Math.max(0, Math.floor(cy - edge)), y1 = Math.min(h - 1, Math.ceil(cy + edge));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > edge) continue;
        let a;
        if (dist <= core) a = 255;
        else a = Math.round(((edge - dist) / (edge - core)) * (140 + rng() * 115));
        if (a <= 0) continue;
        const p = (y * w + x) * 4;
        const da = d[p + 3];
        if (a >= da) {           // strongest stamp wins; one stroke, one colour
          if (a === 255 || da === 0) {
            d[p] = tr; d[p + 1] = tg; d[p + 2] = tb; d[p + 3] = Math.max(a, da);
          } else {
            const ai = a / 255, oa = da / 255, ra = ai + oa * (1 - ai);
            d[p]     = Math.round((tr * ai + d[p]     * oa * (1 - ai)) / ra);
            d[p + 1] = Math.round((tg * ai + d[p + 1] * oa * (1 - ai)) / ra);
            d[p + 2] = Math.round((tb * ai + d[p + 2] * oa * (1 - ai)) / ra);
            d[p + 3] = Math.round(ra * 255);
          }
        }
      }
    };
    const step = Math.max(0.6, r * 0.4);
    let carried = 0;
    stamp(op.points[0][0], op.points[0][1]);
    for (let k = 1; k < op.points.length; k++) {
      const [x, y] = op.points[k], [px, py] = op.points[k - 1];
      const seg = Math.hypot(x - px, y - py);
      let t = step - carried;
      while (t <= seg) {
        stamp(px + (x - px) * t / seg, py + (y - py) * t / seg);
        t += step;
      }
      carried = seg - (t - step);
    }
  }

  // ---- the document ---------------------------------------------------------
  function Creation(originalImageData, crop, maskLocal, source) {
    const w = originalImageData.width, h = originalImageData.height;

    // ORIGINAL — construction is the last write this layer ever sees.
    this.original = originalImageData;
    this.crop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    this.mask = maskLocal;                 // raw crop-local segmentation mask
    this.source = source || null;          // {filename,width,height} — a ref, never bytes

    // STRUCTURE — derived lazily from the mask, cached forever (the mask
    // never changes). regions() is the accessor.
    this._regions = null;

    // EDITS — rebuilt from ops on every recompose.
    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = w; this.paintCanvas.height = h;
    this.paintCtx = this.paintCanvas.getContext('2d', { willReadFrequently: true });
    this.fillPlane = new Uint8ClampedArray(w * h * 4);
    this.erasePlane = new Uint8Array(w * h); // 1 = original hidden by the eraser
    this._lines = {};                      // regionId -> {color, width}
    this._lineMods = null;                 // cache keyed by _lines state

    // TRANSFORM — also rebuilt from ops.
    this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };

    this.ops = [];
    this.cursor = 0;   // ops[0..cursor) are alive; the rest are redoable

    this._view = null;
    this._viewCanvas = null;
    this._originalCanvas = null;
    this.recompose();
  }

  Creation.prototype.regions = function () {
    if (!this._regions) {
      this._regions = BIARegions.detect(this.mask, this.original.width, this.original.height);
    }
    return this._regions;
  };

  /* What did a tap at document (x, y) touch? {kind:'region'|'ink', region}
   * or null. Snap distance scales with the drawing's own stroke width. */
  Creation.prototype.hitAt = function (x, y) {
    const R = this.regions();
    if (R.none) return null;
    return R.hit(x, y, Math.max(3, R.halfWidth));
  };
  Creation.prototype.lineStateOf = function (region) {
    return this._lines[region] || { color: null, width: 'original' };
  };

  /* Pencil radii in DOCUMENT pixels, sized to the drawing itself: Fine is
   * in the neighbourhood of the child's own pencil line at this photo's
   * resolution — a mark, not a paintbrush. */
  Creation.prototype.pencilRadius = function (size) {
    const fine = Math.max(1.5, Math.min(this.original.width, this.original.height) / 280);
    return size === 'thick' ? fine * 4 : size === 'medium' ? fine * 2.2 : fine;
  };

  Creation.prototype._replayOp = function (op) {
    const w = this.original.width, h = this.original.height;
    if (op.t === 'paint') {
      // v1 op type — kept replayable so version-1 files still open.
      const ctx = this.paintCtx;
      ctx.strokeStyle = ctx.fillStyle = op.color;
      ctx.lineWidth = op.radius * 2;
      ctx.lineCap = ctx.lineJoin = 'round';
      if (op.points.length === 1) {
        ctx.beginPath();
        ctx.arc(op.points[0][0], op.points[0][1], op.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(op.points[0][0], op.points[0][1]);
        for (const p of op.points) ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
    } else if (op.t === 'pencil') {
      const pd = this.paintCtx.getImageData(0, 0, w, h);
      stampPencil(pd, w, h, op);
      this.paintCtx.putImageData(pd, 0, 0);
    } else if (op.t === 'fill') {
      const R = this.regions();
      if (R.none) return;
      const [r, g, b] = hexRGB(op.color), L = R.labels, fp = this.fillPlane;
      for (let i = 0; i < L.length; i++) {
        if (L[i] !== op.region) continue;
        const p = i * 4;
        fp[p] = r; fp[p + 1] = g; fp[p + 2] = b; fp[p + 3] = 255;
      }
    } else if (op.t === 'lineColor') {
      const st = this._lines[op.region] || (this._lines[op.region] = { color: null, width: 'original' });
      st.color = op.color;
    } else if (op.t === 'lineWidth') {
      const st = this._lines[op.region] || (this._lines[op.region] = { color: null, width: 'original' });
      st.width = op.width;
    } else if (op.t === 'erase') {
      // WHATEVER IS UNDER IT, per pixel: paint/pencil and fill are cleared
      // where they exist; where only the original drawing is, a bit is set
      // in the erase plane and compose hides that pixel. The ORIGINAL layer
      // is READ here and never written — hiding is the whole mechanism,
      // which is why undo, Reset and the Original view all bring every
      // hidden pixel back exactly.
      const pd = this.paintCtx.getImageData(0, 0, w, h);
      const d = pd.data, fp = this.fillPlane, od = this.original.data;
      const ep = this.erasePlane;
      stampStroke(op.points, op.radius, w, h, (i) => {
        const p = i * 4;
        const hadEdit = d[p + 3] > 0 || fp[p + 3] > 0;
        if (d[p + 3] > 0) { d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 0; }
        if (fp[p + 3] > 0) { fp[p] = 0; fp[p + 1] = 0; fp[p + 2] = 0; fp[p + 3] = 0; }
        if (!hadEdit && od[p + 3] > 0) ep[i] = 1;
      });
      this.paintCtx.putImageData(pd, 0, 0);
    } else if (op.t === 'move') {
      this.transform.x += op.dx; this.transform.y += op.dy;
    } else if (op.t === 'scale') {
      const s = this.transform.scale * op.f;
      this.transform.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));
    } else if (op.t === 'rotate') {
      this.transform.rotation = (this.transform.rotation + op.deg) % 360;
    }
  };

  /* Line mods — hide plane (Thin), tint plane (line colour), extra pixels
   * (Thick) — computed from the line state and the region structure, and
   * cached on the state's JSON key: undo/redo across line ops recomputes
   * only when the state actually differs. All derived, nothing stored. */
  Creation.prototype._computeLineMods = function () {
    const key = JSON.stringify(this._lines);
    if (this._lineMods && this._lineMods.key === key) return this._lineMods;
    const w = this.original.width, h = this.original.height, n = w * h;
    const mods = { key, hide: null, tintMap: null, extras: null };
    const ids = Object.keys(this._lines);
    if (!ids.length) { this._lineMods = mods; return mods; }
    const R = this.regions();
    if (R.none) { this._lineMods = mods; return mods; }
    const od = this.original.data, mask = this.mask, dt = R.dt;
    const extras = [];
    const bset = new Uint8Array(n);     // scratch: 1 = boundary, 2 = boundary+hidden

    for (const idStr of ids) {
      const id = Number(idStr), st = this._lines[idStr];
      const B = R.boundaryOf(id);
      if (!B.length) continue;
      const target = st.color ? hexRGB(st.color) : null;
      const thin = st.width === 'thin', thick = st.width === 'thick';
      const cutThin = Math.max(1, Math.floor(R.halfWidth * 0.45));
      const tR = Math.max(2, Math.round(R.halfWidth * 0.7));

      for (const i of B) bset[i] = 1;
      if (thin) {
        if (!mods.hide) mods.hide = new Uint8Array(n);
        for (const i of B) if (dt[i] <= cutThin) { mods.hide[i] = 1; bset[i] = 2; }
      }
      // The visible skirt: extraction's support-gated dilation adds a thin
      // anti-aliased rim beyond the raw mask. It belongs to the line, so it
      // is tinted with it — and when Thin hides a line's outer pixels, skirt
      // pixels that no surviving line pixel touches go with them.
      const skirt = [];
      for (const i of B) {
        const x = i % w, y = (i / w) | 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const j = yy * w + xx;
            if (!mask[j] && od[j * 4 + 3] > 0 && !bset[j]) { bset[j] = 3; skirt.push(j); }
          }
        }
      }
      if (thin) {
        for (const j of skirt) {
          const x = j % w, y = (j / w) | 0;
          let alive = false;
          for (let dy = -2; dy <= 2 && !alive; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              if (bset[yy * w + xx] === 1) { alive = true; break; }
            }
          }
          if (!alive) mods.hide[j] = 1;
        }
      }
      if (target) {
        if (!mods.tintMap) mods.tintMap = new Int32Array(n);
        const paintTint = (i) => {
          const p = i * 4;
          if (!od[p + 3]) return;
          const [r, g, b] = tint(od[p], od[p + 1], od[p + 2], target);
          mods.tintMap[i] = ((r << 16) | (g << 8) | b) + 1;
        };
        for (const i of B) paintTint(i);
        for (const j of skirt) paintTint(j);
      }
      if (thick) {
        // Thick replicates the line's own nearest pixels outward — texture
        // copied from the child's stroke, never a synthetic flat line.
        // Only FULLY-OPAQUE source pixels are replicated: their bytes are
        // preservation-exact across the JSON/PNG round trip, so a thick
        // line composes identically in every session. (A feather-ring
        // source could differ by ±1 after a reload — measured, not
        // guessed — so it is never used as donor material.)
        const nearest = new Map();
        for (const i of B) {
          if (od[i * 4 + 3] !== 255) continue;
          const x = i % w, y = (i / w) | 0;
          for (let dy = -tR; dy <= tR; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -tR; dx <= tR; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              const j = yy * w + xx;
              if (mask[j]) continue;
              const d2 = Math.max(Math.abs(dx), Math.abs(dy));
              const cur = nearest.get(j);
              if (!cur || d2 < cur.d) nearest.set(j, { d: d2, src: i });
            }
          }
        }
        for (const [j, v] of nearest) {
          const sp = v.src * 4;
          const a = od[sp + 3];
          if (!a) continue;
          let r = od[sp], g = od[sp + 1], b = od[sp + 2];
          if (target) { const t2 = tint(r, g, b, target); r = t2[0]; g = t2[1]; b = t2[2]; }
          extras.push([j, r, g, b, a]);
        }
      }
      for (const i of B) bset[i] = 0;
      for (const j of skirt) bset[j] = 0;
    }
    if (extras.length) {
      extras.sort((a, b) => a[0] - b[0]);   // deterministic compose order
      mods.extras = extras;
    }
    this._lineMods = mods;
    return mods;
  };

  /* Rebuild EDITS and TRANSFORM from scratch and replay ops[0..cursor).
   * O(ops) per undo is the simple op-stack the sprint asked for; a child's
   * session is tens of ops on a sub-megapixel document, and determinism —
   * the same ops always produce the same bytes — is what the suite's
   * buffer-equality round trips stand on. */
  Creation.prototype.recompose = function () {
    const w = this.original.width, h = this.original.height, n = w * h;
    this.paintCtx.clearRect(0, 0, w, h);
    this.fillPlane.fill(0);
    this.erasePlane.fill(0);
    this._lines = {};
    this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
    for (let k = 0; k < this.cursor; k++) this._replayOp(this.ops[k]);

    // CURRENT VIEW = fills UNDER the original (lines stay on top, tinted /
    // thinned / thickened at compose time), plus pencil & paint on top.
    const out = new ImageData(new Uint8ClampedArray(this.original.data), w, h);
    const d = out.data, od = this.original.data, fp = this.fillPlane;
    const mods = this._computeLineMods();
    const hide = mods.hide, tintMap = mods.tintMap, ep = this.erasePlane;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const fa = fp[p + 3];
      const hid = (hide && hide[i]) || ep[i];
      const tv = tintMap ? tintMap[i] : 0;
      if (!fa && !hid && !tv) continue;    // untouched pixel: original bytes stand
      let oa = hid ? 0 : od[p + 3];
      let orr = od[p], org = od[p + 1], orb = od[p + 2];
      if (!hid && tv) { const v = tv - 1; orr = (v >> 16) & 255; org = (v >> 8) & 255; orb = v & 255; }
      if (fa) {
        if (oa === 255) { d[p] = orr; d[p + 1] = org; d[p + 2] = orb; d[p + 3] = 255; }
        else if (oa === 0) { d[p] = fp[p]; d[p + 1] = fp[p + 1]; d[p + 2] = fp[p + 2]; d[p + 3] = 255; }
        else {
          const a = oa / 255;
          d[p]     = Math.round(orr * a + fp[p]     * (1 - a));
          d[p + 1] = Math.round(org * a + fp[p + 1] * (1 - a));
          d[p + 2] = Math.round(orb * a + fp[p + 2] * (1 - a));
          d[p + 3] = 255;
        }
      } else if (oa === 0) {
        d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 0;
      } else {
        d[p] = orr; d[p + 1] = org; d[p + 2] = orb; d[p + 3] = oa;
      }
    }
    if (mods.extras) {
      for (const [i, r, g, b, a] of mods.extras) {
        const p = i * 4;
        if (a === 255 || d[p + 3] === 0) {
          d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = Math.max(a, d[p + 3]);
        } else {
          const ai = a / 255, oa2 = d[p + 3] / 255, ra = ai + oa2 * (1 - ai);
          d[p]     = Math.round((r * ai + d[p]     * oa2 * (1 - ai)) / ra);
          d[p + 1] = Math.round((g * ai + d[p + 1] * oa2 * (1 - ai)) / ra);
          d[p + 2] = Math.round((b * ai + d[p + 2] * oa2 * (1 - ai)) / ra);
          d[p + 3] = Math.round(ra * 255);
        }
      }
    }
    const pd = this.paintCtx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < n; i++) {
      const p = i * 4, pa = pd[p + 3];
      if (!pa) continue;
      if (pa === 255) { d[p] = pd[p]; d[p + 1] = pd[p + 1]; d[p + 2] = pd[p + 2]; d[p + 3] = 255; continue; }
      const ai = pa / 255, oa = d[p + 3] / 255, ra = ai + oa * (1 - ai);
      d[p]     = Math.round((pd[p]     * ai + d[p]     * oa * (1 - ai)) / ra);
      d[p + 1] = Math.round((pd[p + 1] * ai + d[p + 1] * oa * (1 - ai)) / ra);
      d[p + 2] = Math.round((pd[p + 2] * ai + d[p + 2] * oa * (1 - ai)) / ra);
      d[p + 3] = Math.round(ra * 255);
    }
    this._view = out;
    if (!this._viewCanvas) {
      this._viewCanvas = document.createElement('canvas');
      this._viewCanvas.width = w; this._viewCanvas.height = h;
    }
    this._viewCanvas.getContext('2d').putImageData(out, 0, 0);
    return out;
  };

  Creation.prototype.view = function () { return this._view; };
  Creation.prototype.viewCanvas = function () { return this._viewCanvas; };
  /* The ORIGINAL layer as a canvas — the "Original" side of the toggle and
   * the "Original PNG" download. Built once; the layer never changes. */
  Creation.prototype.originalCanvas = function () {
    if (!this._originalCanvas) {
      const c = document.createElement('canvas');
      c.width = this.original.width; c.height = this.original.height;
      c.getContext('2d').putImageData(this.original, 0, 0);
      this._originalCanvas = c;
    }
    return this._originalCanvas;
  };

  Creation.prototype.apply = function (op) {
    this.ops.length = this.cursor;   // a new op forfeits the redo tail
    this.ops.push(op);
    this.cursor++;
    // Transform ops don't change the composite; skip the pixel work.
    if (op.t === 'move' || op.t === 'scale' || op.t === 'rotate') this._replayOp(op);
    else this.recompose();
  };
  Creation.prototype.canUndo = function () { return this.cursor > 0; };
  Creation.prototype.canRedo = function () { return this.cursor < this.ops.length; };
  Creation.prototype.undo = function () {
    if (!this.canUndo()) return false;
    this.cursor--; this.recompose(); return true;
  };
  Creation.prototype.redo = function () {
    if (!this.canRedo()) return false;
    this.cursor++; this.recompose(); return true;
  };
  /* Reset My Changes: back to the exact original extracted artwork. History
   * movement, never destruction — the ops survive, so Redo can walk even a
   * reset back. */
  Creation.prototype.reset = function () {
    if (this.cursor === 0) return false;
    this.cursor = 0; this.recompose(); return true;
  };

  /* RENDER — the current view with TRANSFORM applied, over transparency.
   * This is what "Current PNG" downloads: a render of the document, never
   * the document. */
  Creation.prototype.render = function () {
    const w = this.original.width, h = this.original.height, t = this.transform;
    const r = t.rotation * Math.PI / 180;
    const cw = Math.max(1, Math.ceil((w * Math.abs(Math.cos(r)) + h * Math.abs(Math.sin(r))) * t.scale));
    const ch = Math.max(1, Math.ceil((w * Math.abs(Math.sin(r)) + h * Math.abs(Math.cos(r))) * t.scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(r);
    ctx.scale(t.scale, t.scale);
    ctx.drawImage(this._viewCanvas, -w / 2, -h / 2);
    return { canvas, bounds: { x: t.x - cw / 2, y: t.y - ch / 2, w: cw, h: ch } };
  };

  // ---- serialisation ---------------------------------------------------------
  // Run-length encoding for the binary mask: alternating run lengths,
  // starting with zeros. Compact, dependency-free, trivially decodable by
  // anything that later consumes the format.
  function rleEncode(bits) {
    const runs = [];
    let cur = 0, len = 0;
    for (let i = 0; i < bits.length; i++) {
      const v = bits[i] ? 1 : 0;
      if (v === cur) { len++; continue; }
      runs.push(len); cur = v; len = 1;
    }
    runs.push(len);
    return runs;
  }
  function rleDecode(runs, n) {
    const bits = new Uint8Array(n);
    let i = 0, v = 0;
    for (const len of runs) {
      if (v) bits.fill(1, i, i + len);
      i += len; v = 1 - v;
    }
    return bits;
  }

  /* The creation as JSON — the canonical, still-editable artifact.
   * ORIGINAL travels as a PNG data URL whose alpha channel carries the
   * final (dilated + feathered) mask; the raw segmentation mask travels
   * as RLE beside it — and the RAW MASK is what the region structure is
   * derived from, so a reopened creation resolves every fill and line op
   * onto exactly the same regions. Disclosed limit: the PNG round trip is
   * byte-exact for every fully-opaque pixel and may round RGB by ±1 on
   * the 1px feathered ring — the preservation rule's stated exemption
   * since v0.1. */
  Creation.prototype.toJSON = function () {
    return {
      format: FORMAT,
      version: VERSION,
      tool: 'bring-it-alive v0.2',
      createdAt: new Date().toISOString(),
      original: {
        source: this.source,                       // photograph ref, not bytes
        crop: this.crop,                           // where in the photograph
        mask: { encoding: 'rle', width: this.crop.w, height: this.crop.h,
                runs: rleEncode(this.mask) },
        pixels: this.originalCanvas().toDataURL('image/png')
      },
      edits: { ops: this.ops.slice(), cursor: this.cursor },
      transform: Object.assign({}, this.transform)
    };
  };
  Creation.prototype.toJSONString = function () { return JSON.stringify(this.toJSON()); };

  /* Version 1 files still open: same layer shape, older op vocabulary
   * ('paint' strokes replay exactly as they did). A v1 'erase' op means
   * what it meant when it was made: clear edits where edits are, hide
   * the original where they are not — the semantics the product owner
   * restored ("allow me to erase whatsoever i want"). */
  async function fromJSON(json) {
    const doc = typeof json === 'string' ? JSON.parse(json) : json;
    if (doc.format !== FORMAT) throw new Error('creation: not a ' + FORMAT + ' document');
    if (doc.version !== 1 && doc.version !== VERSION) {
      throw new Error('creation: unsupported version ' + doc.version);
    }
    const bmp = await createImageBitmap(await (await fetch(doc.original.pixels)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    bmp.close && bmp.close();
    const img = ctx.getImageData(0, 0, c.width, c.height);
    if (img.width !== doc.original.crop.w || img.height !== doc.original.crop.h) {
      throw new Error('creation: pixel data ' + img.width + 'x' + img.height +
        ' does not match crop ' + doc.original.crop.w + 'x' + doc.original.crop.h);
    }
    const mask = rleDecode(doc.original.mask.runs, img.width * img.height);
    const created = new Creation(img, doc.original.crop, mask, doc.original.source);
    created.ops = doc.edits.ops.slice();
    created.cursor = doc.edits.cursor;
    created.recompose();
    return created;
  }

  /**
   * create({imageData, crop, maskPixels}, meta) -> Creation
   * The only shape this module understands: extracted pixels, their crop in
   * the photograph, and the raw crop-local segmentation mask. `meta.source`
   * is a {filename,width,height} reference to the photograph.
   */
  function create(input, meta) {
    return new Creation(input.imageData, input.crop, input.maskPixels,
      meta && meta.source ? meta.source : null);
  }

  window.BIACreation = { create, fromJSON, FORMAT, VERSION };
})();
