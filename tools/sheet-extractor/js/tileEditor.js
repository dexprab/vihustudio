/* Sheet Extractor -- per-tile editor.
 *
 * Extraction is a GLOBAL operation: one background sample, one threshold, one
 * set of tuning applied to the whole sheet at once. That is exactly the wrong
 * shape for "this one asset needs its outline thickened" or "fill the inside of
 * that leaf green" -- those are LOCAL edits to a single already-extracted
 * object, and re-running extraction to achieve them would be both slower and
 * unable to express them at all.
 *
 * So this module edits an item's own pixel buffer directly and hands the result
 * back. Every operation below is a PURE function of the form
 *
 *     op(buf, ...) -> newBuf          where buf = { data, width, height }
 *
 * and `data` is a Uint8ClampedArray of straight (NOT premultiplied) RGBA, which
 * is the exact shape `extractSheet` already produces as `item.pixelBuffer`.
 * Purity is deliberate: it is what makes each tool testable on its own without
 * a browser, a canvas, or the editor UI existing at all.
 *
 * WRITE PATH DISCIPLINE (the tool's founding rule):
 *   A <canvas> is fine for DISPLAY -- the editor draws previews on one.
 *   A <canvas> must never appear in the ENCODE path, because canvas backing
 *   stores are premultiplied and round-tripping through one corrupts partial
 *   alpha (see js/pngEncoder.js's header for the measured numbers). Every op
 *   here manipulates the raw array, and app.js re-encodes with
 *   PngEncoder.encode(), so the picture never passes through a canvas on its
 *   way to bytes.
 */
(function () {
    'use strict';

    // ---- shared helpers ---------------------------------------------------

    function cloneBuf(buf) {
        return {
            data: new Uint8ClampedArray(buf.data),
            width: buf.width,
            height: buf.height
        };
    }

    function emptyBuf(w, h) {
        return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    }

    // Standard src-over compositing of a solid colour at `alpha` coverage onto
    // straight-alpha RGBA. Written out rather than delegating to a canvas
    // precisely because a canvas would premultiply.
    function blendPixel(data, i, color, alpha) {
        if (alpha <= 0) return;
        if (alpha > 1) alpha = 1;
        var da = data[i + 3] / 255;
        var oa = alpha + da * (1 - alpha);
        if (oa <= 0) {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
            return;
        }
        var keep = da * (1 - alpha);
        data[i]     = (color[0] * alpha + data[i]     * keep) / oa;
        data[i + 1] = (color[1] * alpha + data[i + 1] * keep) / oa;
        data[i + 2] = (color[2] * alpha + data[i + 2] * keep) / oa;
        data[i + 3] = oa * 255;
    }

    // ---- 1. crop ----------------------------------------------------------

    // Trims to `rect` (in buffer pixels). Clamped rather than validated: an
    // out-of-bounds drag is a normal thing for a pointer to produce, and
    // clamping is a better answer than refusing.
    function crop(buf, rect) {
        var x0 = Math.max(0, Math.min(buf.width - 1, Math.round(rect.x)));
        var y0 = Math.max(0, Math.min(buf.height - 1, Math.round(rect.y)));
        var x1 = Math.max(x0 + 1, Math.min(buf.width, Math.round(rect.x + rect.w)));
        var y1 = Math.max(y0 + 1, Math.min(buf.height, Math.round(rect.y + rect.h)));
        var nw = x1 - x0;
        var nh = y1 - y0;
        var out = emptyBuf(nw, nh);
        for (var y = 0; y < nh; y++) {
            var s = ((y + y0) * buf.width + x0) * 4;
            out.data.set(buf.data.subarray(s, s + nw * 4), y * nw * 4);
        }
        return out;
    }

    // ---- 2. eraser --------------------------------------------------------

    // Round brush. Multiplies alpha down rather than zeroing it outright, with
    // a one-pixel soft rim, so a stroke does not leave a jagged staircase on
    // whatever it cuts through.
    function erase(buf, cx, cy, radius) {
        var out = cloneBuf(buf);
        radius = Math.max(0.5, radius);
        var x0 = Math.max(0, Math.floor(cx - radius - 1));
        var x1 = Math.min(buf.width - 1, Math.ceil(cx + radius + 1));
        var y0 = Math.max(0, Math.floor(cy - radius - 1));
        var y1 = Math.min(buf.height - 1, Math.ceil(cy + radius + 1));
        for (var y = y0; y <= y1; y++) {
            for (var x = x0; x <= x1; x++) {
                var dx = x + 0.5 - cx;
                var dy = y + 0.5 - cy;
                var d = Math.sqrt(dx * dx + dy * dy);
                var cov = radius + 0.5 - d;
                if (cov <= 0) continue;
                if (cov > 1) cov = 1;
                var i = (y * buf.width + x) * 4 + 3;
                out.data[i] = out.data[i] * (1 - cov);
            }
        }
        return out;
    }

    // ---- 3. colour outline ------------------------------------------------

    // Paints a band of `width` px around the outside of whatever is opaque.
    //
    // The buffer GROWS by `width` on every side. Clipping the outline to the
    // existing bounds was the alternative and is worse: a shape that touches
    // its own edge (common, since padding is a percentage and a thin tile gets
    // very little) would silently lose the outline exactly where it is most
    // visible.
    function outline(buf, width, color) {
        width = Math.max(1, Math.min(16, Math.round(width || 1)));
        var pad = width;
        var nw = buf.width + pad * 2;
        var nh = buf.height + pad * 2;
        var out = emptyBuf(nw, nh);
        for (var y = 0; y < buf.height; y++) {
            var s = y * buf.width * 4;
            out.data.set(buf.data.subarray(s, s + buf.width * 4), ((y + pad) * nw + pad) * 4);
        }

        var n = nw * nh;
        var solid = new Uint8Array(n);
        for (var i = 0; i < n; i++) solid[i] = out.data[i * 4 + 3] > 8 ? 1 : 0;

        // Circular kernel offsets. A square (separable box) dilation would be
        // cheaper but puts square corners on round shapes, which is precisely
        // what an outline is meant not to do.
        var offs = [];
        var r2 = width * width;
        for (var dy = -width; dy <= width; dy++) {
            for (var dx = -width; dx <= width; dx++) {
                if (dx * dx + dy * dy <= r2) offs.push([dx, dy]);
            }
        }

        // Stamp only from BOUNDARY pixels. An interior pixel's whole kernel is
        // already solid, so stamping from it can never add anything -- and on a
        // filled shape that is the overwhelming majority of the work.
        var ring = new Uint8Array(n);
        for (var y2 = 0; y2 < nh; y2++) {
            for (var x2 = 0; x2 < nw; x2++) {
                var idx = y2 * nw + x2;
                if (!solid[idx]) continue;
                var edge =
                    x2 === 0 || y2 === 0 || x2 === nw - 1 || y2 === nh - 1 ||
                    !solid[idx - 1] || !solid[idx + 1] ||
                    !solid[idx - nw] || !solid[idx + nw];
                if (!edge) continue;
                for (var k = 0; k < offs.length; k++) {
                    var nx = x2 + offs[k][0];
                    var ny = y2 + offs[k][1];
                    if (nx < 0 || ny < 0 || nx >= nw || ny >= nh) continue;
                    ring[ny * nw + nx] = 1;
                }
            }
        }

        var col = color || [0, 0, 0];
        for (var j = 0; j < n; j++) {
            if (!ring[j] || solid[j]) continue;
            var p = j * 4;
            out.data[p] = col[0];
            out.data[p + 1] = col[1];
            out.data[p + 2] = col[2];
            out.data[p + 3] = 255;
        }
        return out;
    }

    // ---- 4. shape draw ----------------------------------------------------

    // Coverage-based rasterising: every shape reduces to "how much of this
    // pixel is inside", which is then composited once. That keeps fill and
    // stroke, rect and ellipse and line, all on one code path -- and gives
    // anti-aliasing for free rather than as a per-shape special case.
    function drawShape(buf, shape, rect, opts) {
        opts = opts || {};
        var out = cloneBuf(buf);
        var fill = opts.fill || null;
        var stroke = opts.stroke || null;
        var sw = Math.max(1, opts.strokeWidth || 2);
        if (!fill && !stroke) return out;

        var x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
        var lo = { x: Math.min(x0, x1), y: Math.min(y0, y1) };
        var hi = { x: Math.max(x0, x1), y: Math.max(y0, y1) };

        var margin = sw + 2;
        var px0 = Math.max(0, Math.floor(lo.x - margin));
        var px1 = Math.min(out.width - 1, Math.ceil(hi.x + margin));
        var py0 = Math.max(0, Math.floor(lo.y - margin));
        var py1 = Math.min(out.height - 1, Math.ceil(hi.y + margin));

        // Signed distance to the shape's edge: negative inside, positive out.
        var sdf;
        if (shape === 'ellipse') {
            var cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2;
            var ra = Math.max(0.5, (hi.x - lo.x) / 2), rb = Math.max(0.5, (hi.y - lo.y) / 2);
            sdf = function (x, y) {
                var dx = (x - cx) / ra, dy = (y - cy) / rb;
                var f = dx * dx + dy * dy - 1;
                // First-order distance estimate: value over gradient length.
                var gx = 2 * (x - cx) / (ra * ra), gy = 2 * (y - cy) / (rb * rb);
                var g = Math.sqrt(gx * gx + gy * gy);
                return g > 1e-6 ? f / g : (f > 0 ? 1e6 : -1e6);
            };
        } else if (shape === 'line') {
            var ax = x0, ay = y0, bx = x1, by = y1;
            var vx = bx - ax, vy = by - ay;
            var vlen2 = vx * vx + vy * vy;
            sdf = function (x, y) {
                var t = vlen2 > 1e-9 ? ((x - ax) * vx + (y - ay) * vy) / vlen2 : 0;
                if (t < 0) t = 0; else if (t > 1) t = 1;
                var qx = x - (ax + t * vx), qy = y - (ay + t * vy);
                return Math.sqrt(qx * qx + qy * qy);
            };
        } else { // rect
            sdf = function (x, y) {
                var dx = Math.max(lo.x - x, x - hi.x);
                var dy = Math.max(lo.y - y, y - hi.y);
                if (dx <= 0 && dy <= 0) return Math.max(dx, dy);
                var ox = Math.max(dx, 0), oy = Math.max(dy, 0);
                return Math.sqrt(ox * ox + oy * oy);
            };
        }

        // A line has no interior to fill; drawing it is always a stroke.
        var doFill = fill && shape !== 'line';
        var half = sw / 2;

        for (var y = py0; y <= py1; y++) {
            for (var x = px0; x <= px1; x++) {
                var d = sdf(x + 0.5, y + 0.5);
                var i = (y * out.width + x) * 4;
                if (doFill) {
                    var fc = 0.5 - d;
                    if (fc > 0) blendPixel(out.data, i, fill, fc > 1 ? 1 : fc);
                }
                if (stroke) {
                    var sc = half + 0.5 - Math.abs(d);
                    if (sc > 0) blendPixel(out.data, i, stroke, sc > 1 ? 1 : sc);
                }
            }
        }
        return out;
    }

    // ---- 5. colour fill ---------------------------------------------------

    // Flood fill, iterative (never recursive -- the same discipline
    // labelComponents() already uses, for the same reason: a large flat region
    // would blow the stack).
    //
    // Two transparent pixels always match each other regardless of their RGB,
    // because a fully transparent pixel's colour channels are arbitrary (the
    // encoder leaves them zero) and comparing them would split one visually
    // uniform hole into several. That is what lets a click inside a line-art
    // outline fill the hole and stop at the ink.
    function bucketFill(buf, sx, sy, color, tolerance) {
        var out = cloneBuf(buf);
        var w = out.width, h = out.height;
        sx = Math.round(sx); sy = Math.round(sy);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) return out;

        var d = out.data;
        var tol = Math.max(0, tolerance == null ? 32 : tolerance);
        var si = (sy * w + sx) * 4;
        var tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
        var col = color || [0, 0, 0];

        // Refilling a region with what it already is would loop forever on the
        // "did this pixel change" test below, so bail early.
        if (ta === 255 && tr === col[0] && tg === col[1] && tb === col[2]) return out;

        function matches(i) {
            var a = d[i + 3];
            if (ta < 8) return a < 8;
            if (a < 8) return false;
            var dr = d[i] - tr, dg = d[i + 1] - tg, db = d[i + 2] - tb, da = a - ta;
            return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tol;
        }

        var seen = new Uint8Array(w * h);
        var stack = [sy * w + sx];
        seen[sy * w + sx] = 1;
        while (stack.length) {
            var p = stack.pop();
            var i4 = p * 4;
            if (!matches(i4)) continue;
            d[i4] = col[0]; d[i4 + 1] = col[1]; d[i4 + 2] = col[2]; d[i4 + 3] = 255;
            var px = p % w, py = (p - px) / w;
            if (px > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
            if (px < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
            if (py > 0 && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
            if (py < h - 1 && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
        }
        return out;
    }

    // ---- 6. rotate --------------------------------------------------------

    // Quarter turns only. An arbitrary angle needs resampling, which softens
    // every edge -- exactly the "blurred" complaint this whole tool exists to
    // avoid -- so it is deliberately out of scope rather than approximated.
    function rotate90(buf, turns) {
        turns = ((Math.round(turns || 0) % 4) + 4) % 4;
        if (turns === 0) return cloneBuf(buf);
        var w = buf.width, h = buf.height;
        var nw = turns === 2 ? w : h;
        var nh = turns === 2 ? h : w;
        var out = emptyBuf(nw, nh);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var nx, ny;
                if (turns === 1) { nx = h - 1 - y; ny = x; }
                else if (turns === 2) { nx = w - 1 - x; ny = h - 1 - y; }
                else { nx = y; ny = w - 1 - x; }
                var s = (y * w + x) * 4, dst = (ny * nw + nx) * 4;
                out.data[dst] = buf.data[s];
                out.data[dst + 1] = buf.data[s + 1];
                out.data[dst + 2] = buf.data[s + 2];
                out.data[dst + 3] = buf.data[s + 3];
            }
        }
        return out;
    }

    // ---- 7. flip ----------------------------------------------------------

    function flip(buf, axis) {
        var w = buf.width, h = buf.height;
        var out = emptyBuf(w, h);
        var horiz = axis !== 'v';
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var sx = horiz ? w - 1 - x : x;
                var sy = horiz ? y : h - 1 - y;
                var s = (sy * w + sx) * 4, dst = (y * w + x) * 4;
                out.data[dst] = buf.data[s];
                out.data[dst + 1] = buf.data[s + 1];
                out.data[dst + 2] = buf.data[s + 2];
                out.data[dst + 3] = buf.data[s + 3];
            }
        }
        return out;
    }

    // ======================================================================
    // Editor UI
    // ======================================================================

    var UNDO_LIMIT = 20;

    var ui = null;       // built lazily, then reused
    var session = null;  // { buf, undo:[], tool, onApply, item }

    function hexToRgb(hex) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    var TOOLS = [
        { id: 'crop',    label: '⛶ Crop' },
        { id: 'erase',   label: '🩹 Eraser' },
        { id: 'outline', label: '⭕ Outline' },
        { id: 'shape',   label: '▭ Shape' },
        { id: 'fill',    label: '🪣 Fill' },
        { id: 'rotate',  label: '↻ Rotate' },
        { id: 'flip',    label: '⇄ Flip' }
    ];

    var HINTS = {
        crop:    'Drag a box, then Apply Crop.',
        erase:   'Drag on the picture to rub bits out.',
        outline: 'Adds a coloured band around the outside. The picture grows to make room.',
        shape:   'Drag to place the shape.',
        fill:    'Click inside an area to flood it with the colour.',
        rotate:  'Quarter turns only, so nothing gets resampled or softened.',
        flip:    'Mirror the picture.'
    };

    function buildUI() {
        var root = el('div', 'se-te-overlay');
        root.hidden = true;

        var box = el('div', 'se-te-box');

        var head = el('div', 'se-te-head');
        var title = el('div', 'se-te-title', 'Edit asset');
        var close = el('button', 'se-btn se-btn-sm', '✕');
        close.type = 'button';
        head.appendChild(title);
        head.appendChild(close);
        box.appendChild(head);

        var body = el('div', 'se-te-body');

        var stage = el('div', 'se-te-stage');
        var canvas = document.createElement('canvas');
        canvas.className = 'se-te-canvas';
        stage.appendChild(canvas);
        var marquee = el('div', 'se-te-marquee');
        marquee.hidden = true;
        stage.appendChild(marquee);
        body.appendChild(stage);

        var side = el('div', 'se-te-side');

        var toolRow = el('div', 'se-te-tools');
        var toolBtns = {};
        TOOLS.forEach(function (t) {
            var b = el('button', 'se-te-tool', t.label);
            b.type = 'button';
            b.dataset.tool = t.id;
            toolBtns[t.id] = b;
            toolRow.appendChild(b);
        });
        side.appendChild(toolRow);

        var hint = el('p', 'se-te-hint', '');
        side.appendChild(hint);

        // ---- per-tool option groups ----
        function group(name) {
            var g = el('div', 'se-te-group');
            g.dataset.for = name;
            side.appendChild(g);
            return g;
        }
        function field(parent, label) {
            var f = el('label', 'se-te-field');
            f.appendChild(el('span', null, label));
            parent.appendChild(f);
            return f;
        }

        var gColor = group('outline shape fill');
        var colorField = field(gColor, 'Colour');
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#e6394d';
        colorField.appendChild(colorInput);

        var gSize = group('erase outline shape');
        var sizeField = field(gSize, 'Size');
        var sizeInput = document.createElement('input');
        sizeInput.type = 'range';
        sizeInput.min = '1'; sizeInput.max = '16'; sizeInput.value = '4';
        var sizeVal = el('b', null, '4');
        sizeField.appendChild(sizeInput);
        sizeField.appendChild(sizeVal);

        var gShape = group('shape');
        var shapeField = field(gShape, 'Shape');
        var shapeSel = document.createElement('select');
        [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['line', 'Line']].forEach(function (o) {
            var op = document.createElement('option');
            op.value = o[0]; op.textContent = o[1];
            shapeSel.appendChild(op);
        });
        shapeField.appendChild(shapeSel);
        var styleField = field(gShape, 'Style');
        var styleSel = document.createElement('select');
        [['fill', 'Filled'], ['stroke', 'Outline only'], ['both', 'Filled + outline']].forEach(function (o) {
            var op = document.createElement('option');
            op.value = o[0]; op.textContent = o[1];
            styleSel.appendChild(op);
        });
        styleField.appendChild(styleSel);

        var gTol = group('fill');
        var tolField = field(gTol, 'Tolerance');
        var tolInput = document.createElement('input');
        tolInput.type = 'range';
        tolInput.min = '0'; tolInput.max = '160'; tolInput.value = '48';
        var tolVal = el('b', null, '48');
        tolField.appendChild(tolInput);
        tolField.appendChild(tolVal);

        var gAct = group('crop outline rotate flip');
        var actRow = el('div', 'se-te-actrow');
        var cropApply = el('button', 'se-btn se-btn-sm', 'Apply Crop');
        cropApply.type = 'button'; cropApply.dataset.act = 'crop';
        var outlineApply = el('button', 'se-btn se-btn-sm', 'Add Outline');
        outlineApply.type = 'button'; outlineApply.dataset.act = 'outline';
        var rotCW = el('button', 'se-btn se-btn-sm', '↻ 90° right');
        rotCW.type = 'button'; rotCW.dataset.act = 'rot-cw';
        var rotCCW = el('button', 'se-btn se-btn-sm', '↺ 90° left');
        rotCCW.type = 'button'; rotCCW.dataset.act = 'rot-ccw';
        var flipH = el('button', 'se-btn se-btn-sm', '⇄ Flip across');
        flipH.type = 'button'; flipH.dataset.act = 'flip-h';
        var flipV = el('button', 'se-btn se-btn-sm', '⇅ Flip down');
        flipV.type = 'button'; flipV.dataset.act = 'flip-v';
        [cropApply, outlineApply, rotCW, rotCCW, flipH, flipV].forEach(function (b) {
            actRow.appendChild(b);
        });
        gAct.appendChild(actRow);

        var meta = el('p', 'se-te-meta', '');
        side.appendChild(meta);

        var foot = el('div', 'se-te-foot');
        var undo = el('button', 'se-btn se-btn-sm', '↩ Undo');
        undo.type = 'button';
        var reset = el('button', 'se-btn se-btn-sm', 'Reset');
        reset.type = 'button';
        var cancel = el('button', 'se-btn', 'Cancel');
        cancel.type = 'button';
        var apply = el('button', 'se-btn se-btn-primary', '✓ Save Changes');
        apply.type = 'button';
        foot.appendChild(undo);
        foot.appendChild(reset);
        foot.appendChild(el('span', 'se-te-spacer'));
        foot.appendChild(cancel);
        foot.appendChild(apply);
        side.appendChild(foot);

        body.appendChild(side);
        box.appendChild(body);
        root.appendChild(box);
        document.body.appendChild(root);

        ui = {
            root: root, box: box, title: title, canvas: canvas, ctx: canvas.getContext('2d'),
            stage: stage, marquee: marquee, toolBtns: toolBtns, hint: hint, meta: meta,
            colorInput: colorInput, sizeInput: sizeInput, sizeVal: sizeVal,
            shapeSel: shapeSel, styleSel: styleSel, tolInput: tolInput, tolVal: tolVal,
            undo: undo, reset: reset, cancel: cancel, apply: apply, close: close,
            groups: Array.prototype.slice.call(side.querySelectorAll('.se-te-group'))
        };

        wireUI();
        return ui;
    }

    function ensureUI() { return ui || buildUI(); }

    // Native size of the buffer, and the on-screen scale it is drawn at, so a
    // pointer position can be turned back into a buffer pixel.
    var view = { scale: 1, w: 0, h: 0 };

    function redraw() {
        if (!session) return;
        var buf = session.buf;
        var maxW = 520, maxH = 460;
        var scale = Math.min(maxW / buf.width, maxH / buf.height);
        if (scale > 4) scale = 4; // don't blow a tiny sprite up past legibility
        view.scale = scale;
        view.w = Math.max(1, Math.round(buf.width * scale));
        view.h = Math.max(1, Math.round(buf.height * scale));

        // Native-size offscreen, then scaled onto the visible canvas. This is
        // DISPLAY only -- nothing here ever feeds the encoder.
        var off = document.createElement('canvas');
        off.width = buf.width; off.height = buf.height;
        var octx = off.getContext('2d');
        var img = octx.createImageData(buf.width, buf.height);
        img.data.set(buf.data);
        octx.putImageData(img, 0, 0);

        ui.canvas.width = view.w;
        ui.canvas.height = view.h;
        ui.canvas.style.width = view.w + 'px';
        ui.canvas.style.height = view.h + 'px';
        ui.ctx.clearRect(0, 0, view.w, view.h);
        ui.ctx.imageSmoothingEnabled = scale < 1;
        ui.ctx.drawImage(off, 0, 0, view.w, view.h);

        ui.meta.textContent = buf.width + '×' + buf.height + 'px' +
            (session.undo.length ? ' · ' + session.undo.length + ' change' + (session.undo.length === 1 ? '' : 's') : '');
        ui.undo.disabled = session.undo.length === 0;
        ui.reset.disabled = session.undo.length === 0;
    }

    function pushUndo() {
        session.undo.push(cloneBuf(session.buf));
        if (session.undo.length > UNDO_LIMIT) session.undo.shift();
    }

    function commit(nextBuf) {
        pushUndo();
        session.buf = nextBuf;
        session.crop = null;
        ui.marquee.hidden = true;
        redraw();
    }

    function setTool(id) {
        session.tool = id;
        session.crop = null;
        ui.marquee.hidden = true;
        Object.keys(ui.toolBtns).forEach(function (k) {
            ui.toolBtns[k].classList.toggle('is-active', k === id);
        });
        ui.hint.textContent = HINTS[id] || '';
        ui.groups.forEach(function (g) {
            g.hidden = g.dataset.for.split(' ').indexOf(id) === -1;
        });
        // Within the shared action group, only the buttons that belong to the
        // active tool are shown -- otherwise "Add Outline" sits there inviting
        // a click while the crop tool is selected.
        var actMap = { crop: ['crop'], outline: ['outline'], rotate: ['rot-cw', 'rot-ccw'], flip: ['flip-h', 'flip-v'] };
        var allowed = actMap[id] || [];
        Array.prototype.forEach.call(ui.box.querySelectorAll('[data-act]'), function (b) {
            b.hidden = allowed.indexOf(b.dataset.act) === -1;
        });
    }

    function toBuf(ev) {
        var r = ui.canvas.getBoundingClientRect();
        return {
            x: (ev.clientX - r.left) / view.scale,
            y: (ev.clientY - r.top) / view.scale
        };
    }

    function showMarquee(a, b) {
        var x = Math.min(a.x, b.x) * view.scale;
        var y = Math.min(a.y, b.y) * view.scale;
        var w = Math.abs(b.x - a.x) * view.scale;
        var h = Math.abs(b.y - a.y) * view.scale;
        ui.marquee.style.left = ui.canvas.offsetLeft + x + 'px';
        ui.marquee.style.top = ui.canvas.offsetTop + y + 'px';
        ui.marquee.style.width = w + 'px';
        ui.marquee.style.height = h + 'px';
        ui.marquee.hidden = false;
    }

    function wireUI() {
        ui.sizeInput.addEventListener('input', function () { ui.sizeVal.textContent = ui.sizeInput.value; });
        ui.tolInput.addEventListener('input', function () { ui.tolVal.textContent = ui.tolInput.value; });

        Object.keys(ui.toolBtns).forEach(function (k) {
            ui.toolBtns[k].addEventListener('click', function () { setTool(k); });
        });

        var drag = null;

        ui.canvas.addEventListener('pointerdown', function (ev) {
            if (!session) return;
            ev.preventDefault();
            var p = toBuf(ev);
            var t = session.tool;
            if (t === 'fill') {
                commit(bucketFill(session.buf, p.x, p.y, hexToRgb(ui.colorInput.value), parseInt(ui.tolInput.value, 10)));
                return;
            }
            if (t === 'erase') {
                pushUndo();
                session.buf = erase(session.buf, p.x, p.y, parseInt(ui.sizeInput.value, 10));
                redraw();
                drag = { kind: 'erase' };
                try { ui.canvas.setPointerCapture(ev.pointerId); } catch (e) {}
                return;
            }
            if (t === 'crop' || t === 'shape') {
                drag = { kind: t, from: p, to: p };
                showMarquee(p, p);
                try { ui.canvas.setPointerCapture(ev.pointerId); } catch (e) {}
            }
        });

        ui.canvas.addEventListener('pointermove', function (ev) {
            if (!session || !drag) return;
            var p = toBuf(ev);
            if (drag.kind === 'erase') {
                // Painted straight onto the live buffer without a fresh undo
                // entry per pointer sample -- one drag is one undo step, which
                // is what a person means by "undo that stroke".
                session.buf = erase(session.buf, p.x, p.y, parseInt(ui.sizeInput.value, 10));
                redraw();
                return;
            }
            drag.to = p;
            showMarquee(drag.from, drag.to);
        });

        function endDrag(ev) {
            if (!session || !drag) return;
            var d = drag;
            drag = null;
            try { ui.canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
            if (d.kind === 'erase') return;
            if (d.kind === 'shape') {
                var style = ui.styleSel.value;
                var col = hexToRgb(ui.colorInput.value);
                commit(drawShape(session.buf, ui.shapeSel.value, {
                    x: d.from.x, y: d.from.y, w: d.to.x - d.from.x, h: d.to.y - d.from.y
                }, {
                    fill: (style === 'fill' || style === 'both') ? col : null,
                    stroke: (style === 'stroke' || style === 'both') ? col : null,
                    strokeWidth: parseInt(ui.sizeInput.value, 10)
                }));
                return;
            }
            // crop: keep the marquee up so "Apply Crop" has something to act on
            session.crop = {
                x: Math.min(d.from.x, d.to.x), y: Math.min(d.from.y, d.to.y),
                w: Math.abs(d.to.x - d.from.x), h: Math.abs(d.to.y - d.from.y)
            };
        }
        ui.canvas.addEventListener('pointerup', endDrag);
        ui.canvas.addEventListener('pointercancel', endDrag);

        ui.box.addEventListener('click', function (ev) {
            var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
            if (!b || !session) return;
            var a = b.dataset.act;
            if (a === 'crop') {
                if (!session.crop || session.crop.w < 1 || session.crop.h < 1) return;
                commit(crop(session.buf, session.crop));
            } else if (a === 'outline') {
                commit(outline(session.buf, parseInt(ui.sizeInput.value, 10), hexToRgb(ui.colorInput.value)));
            } else if (a === 'rot-cw') {
                commit(rotate90(session.buf, 1));
            } else if (a === 'rot-ccw') {
                commit(rotate90(session.buf, 3));
            } else if (a === 'flip-h') {
                commit(flip(session.buf, 'h'));
            } else if (a === 'flip-v') {
                commit(flip(session.buf, 'v'));
            }
        });

        ui.undo.addEventListener('click', function () {
            if (!session || !session.undo.length) return;
            session.buf = session.undo.pop();
            session.crop = null;
            ui.marquee.hidden = true;
            redraw();
        });

        ui.reset.addEventListener('click', function () {
            if (!session) return;
            session.buf = cloneBuf(session.original);
            session.undo = [];
            session.crop = null;
            ui.marquee.hidden = true;
            redraw();
        });

        ui.cancel.addEventListener('click', close);
        ui.close.addEventListener('click', close);
        ui.root.addEventListener('pointerdown', function (ev) {
            if (ev.target === ui.root) close();
        });

        ui.apply.addEventListener('click', function () {
            if (!session) return;
            var cb = session.onApply;
            var buf = session.buf;
            var changed = session.undo.length > 0;
            close();
            if (cb) cb(changed ? buf : null);
        });

        document.addEventListener('keydown', function (ev) {
            if (!session || ui.root.hidden) return;
            if (ev.key === 'Escape') { ev.preventDefault(); close(); }
        });
    }

    function close() {
        if (!ui) return;
        ui.root.hidden = true;
        session = null;
    }

    // Opens the editor on `item`. `onApply(buf)` is called with the edited
    // buffer, or null when nothing was changed, and is NOT called at all when
    // the editor is cancelled.
    function open(item, onApply) {
        ensureUI();
        if (!item || !item.pixelBuffer) return;
        session = {
            item: item,
            original: item.pixelBuffer,
            buf: cloneBuf(item.pixelBuffer),
            undo: [],
            crop: null,
            tool: 'crop',
            onApply: onApply || null
        };
        ui.title.textContent = 'Edit ' + (item.fileName || 'asset');
        ui.root.hidden = false;
        setTool('crop');
        redraw();
    }

    window.TileEditor = {
        open: open,
        close: close,
        // Pure ops, exported so each tool can be exercised on its own.
        crop: crop,
        erase: erase,
        outline: outline,
        drawShape: drawShape,
        bucketFill: bucketFill,
        rotate90: rotate90,
        flip: flip
    };
})();
