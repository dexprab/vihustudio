/* CREATION — the layered Vihu Creation document. Not a flattened PNG.
 *
 * The sprint's correction, made structural:
 *
 *   Vihu Creation
 *   ├── ORIGINAL   — source photograph ref, segmentation mask, extracted
 *   │                pixels. NEVER written after construction. Byte-preserved.
 *   ├── EDITS      — a paint layer plus an erase mask, both rebuilt by
 *   │                replaying an op history (undo/redo is history movement)
 *   └── TRANSFORM  — position, scale, rotation
 *
 * CURRENT VIEW = ORIGINAL + EDITS, composited at recompose time; TRANSFORM
 * is applied only when the view is rendered somewhere. The composite is done
 * in typed arrays, not through canvas drawImage, for one reason: it makes
 * the initial view BYTE-IDENTICAL to the ORIGINAL layer (a canvas round
 * trip would premultiply the feather ring's RGB), which is what lets the
 * suite assert "no ghost, no halo, no background — the view IS the drawing"
 * as an equality instead of a judgement.
 *
 * ERASE is deliberately subtle, per the sprint: an erase stamp lands on the
 * PAINT layer where there is paint under it, and on the ERASE MASK where
 * there is not. Paint is removed; original pixels are only ever HIDDEN —
 * the erase mask sits over ORIGINAL at composite time and ORIGINAL itself
 * is never touched. Undo rebuilds both from the surviving ops, so a hidden
 * pixel comes back exactly, because it never went anywhere.
 *
 * This module knows NOTHING about segmentation. Its input is the shape
 * {imageData, crop, maskPixels} — extracted pixels, where they came from in
 * the photograph, and the raw crop-local segmentation mask — and any
 * segmenter that produces that shape could feed it.
 */
(function () {
  'use strict';

  const FORMAT = 'vihu-creation';
  const VERSION = 1;
  const SCALE_MIN = 0.2, SCALE_MAX = 5;

  // ---- stroke stamping -----------------------------------------------------
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

  // ---- the document ---------------------------------------------------------
  function Creation(originalImageData, crop, maskLocal, source) {
    const w = originalImageData.width, h = originalImageData.height;

    // ORIGINAL — construction is the last write this layer ever sees.
    this.original = originalImageData;
    this.crop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    this.mask = maskLocal;                 // raw crop-local segmentation mask
    this.source = source || null;          // {filename,width,height} — a ref, never bytes

    // EDITS — rebuilt from ops on every recompose.
    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = w; this.paintCanvas.height = h;
    this.paintCtx = this.paintCanvas.getContext('2d', { willReadFrequently: true });
    this.eraseMask = new Uint8Array(w * h);

    // TRANSFORM — also rebuilt from ops (move/scale/rotate are ops too, so
    // one undo stack serves everything the child can do).
    this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };

    this.ops = [];
    this.cursor = 0;   // ops[0..cursor) are alive; the rest are redoable

    this._view = null;
    this._viewCanvas = null;
    this.recompose();
  }

  Creation.prototype._replayOp = function (op) {
    const w = this.original.width, h = this.original.height;
    if (op.t === 'paint') {
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
    } else if (op.t === 'erase') {
      // Top-most first: paint under the stamp goes; bare pixels hide the
      // original instead. Hard-edged on purpose — deterministic replay is
      // worth more here than a soft eraser.
      const pd = this.paintCtx.getImageData(0, 0, w, h);
      const d = pd.data, em = this.eraseMask;
      stampStroke(op.points, op.radius, w, h, (i) => {
        const a = i * 4 + 3;
        if (d[a] > 0) { d[a] = 0; d[a - 1] = 0; d[a - 2] = 0; d[a - 3] = 0; }
        else em[i] = 1;
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

  /* Rebuild EDITS and TRANSFORM from scratch and replay ops[0..cursor).
   * O(ops) per undo is the simple op-stack the sprint asked for; a child's
   * session is tens of ops on a sub-megapixel document, and determinism —
   * the same ops always produce the same bytes — is what the suite's
   * buffer-equality round trips stand on. */
  Creation.prototype.recompose = function () {
    const w = this.original.width, h = this.original.height;
    this.paintCtx.clearRect(0, 0, w, h);
    this.eraseMask.fill(0);
    this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
    for (let k = 0; k < this.cursor; k++) this._replayOp(this.ops[k]);

    // CURRENT VIEW = ORIGINAL, minus what the erase mask hides, plus paint.
    const out = new ImageData(new Uint8ClampedArray(this.original.data), w, h);
    const d = out.data, em = this.eraseMask;
    for (let i = 0; i < em.length; i++) {
      if (em[i]) { const p = i * 4; d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; }
    }
    const pd = this.paintCtx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < em.length; i++) {
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

  /* RENDER — the current view with TRANSFORM applied, over transparency.
   * This is what "Download PNG" downloads: a render of the document, never
   * the document. bounds are in document coordinates (the creation's centre
   * sits at transform.x/y), so a move is visible as geometry even though a
   * lone cutout on infinite transparency has nothing else to move against. */
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
   * as RLE beside it. Disclosed limit: the PNG round trip is byte-exact
   * for every fully-opaque pixel (the same property the export walk
   * verifies) and may round RGB by ±1 on the 1px feathered ring, which
   * has been the preservation rule's stated exemption since v0.1. */
  Creation.prototype.toJSON = function () {
    const w = this.original.width, h = this.original.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(this.original, 0, 0);
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
        pixels: c.toDataURL('image/png')           // the extracted pixels
      },
      edits: { ops: this.ops.slice(), cursor: this.cursor },
      transform: Object.assign({}, this.transform)
    };
  };
  Creation.prototype.toJSONString = function () { return JSON.stringify(this.toJSON()); };

  async function fromJSON(json) {
    const doc = typeof json === 'string' ? JSON.parse(json) : json;
    if (doc.format !== FORMAT) throw new Error('creation: not a ' + FORMAT + ' document');
    if (doc.version !== VERSION) throw new Error('creation: unsupported version ' + doc.version);
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
