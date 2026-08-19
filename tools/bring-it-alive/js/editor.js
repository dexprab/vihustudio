/* EDITOR — Make It Yours: the editing canvas over a quiet working surface.
 *
 * This is presentation and gesture only. Every decision a gesture produces
 * is handed to the Creation as an OP (creation.js owns the layers, the
 * history and the pixels); the editor never touches a layer directly. The
 * split is the same one the rest of the tool already lives by: preview.js
 * shows and never touches, and this module gestures and never composes.
 *
 * The working surface is a plain warm paper-grey — not a checkerboard
 * (that reads as a developer surface), not a sky, not a place. The
 * artwork sits on it at full visual weight: no ghosting, no glow, no
 * halo — whatever the view's bytes say, scaled for display and nothing
 * else. Transparency stays real in the document; the surface just
 * doesn't announce it.
 *
 * Two views of the SAME creation: ORIGINAL (exactly what came from
 * paper — the untouched layer, shown plain) and MY VERSION (original +
 * the child's edits + transform). Not two files; a toggle. Gestures land
 * only on My Version — the Original view is for looking.
 *
 * Tools: Pencil (Fine/Medium/Thick point-path strokes) · Fill (tap
 * inside a shape to colour it under the lines; tap the line itself to
 * colour the line) · Erase (the child's own edits only) · Move. Line
 * weight (Thin/Original/Thick) applies to the last shape touched.
 *
 * One display scale (ds) maps document space to screen; the creation's
 * own TRANSFORM is drawn inside that mapping.
 */
(function () {
  'use strict';

  const S = {
    canvas: null, ctx: null, creation: null, onChange: null, onNote: null,
    tool: 'pencil', color: '#1f2430', size: 'fine', viewMode: 'mine',
    lastRegion: 0,
    ds: 1, cx: 0, cy: 0,
    stroke: null,          // in-progress pencil/erase stroke (doc coords)
    drag: null,            // in-progress move drag {sx, sy, dx, dy} display px
    tap: null,             // pointerdown spot for the fill tap {px, py}
    bound: false
  };

  function mount(canvas, creation, onChange, onNote) {
    S.canvas = canvas;
    S.ctx = canvas.getContext('2d');
    S.creation = creation;
    S.onChange = onChange || null;
    S.onNote = onNote || null;
    S.viewMode = 'mine';
    S.lastRegion = 0;
    S.cx = canvas.width / 2;
    S.cy = canvas.height / 2;
    // Fit the document into ~72% of the surface at transform scale 1, so
    // there is room to grow it and somewhere to move it.
    const w = creation.original.width, h = creation.original.height;
    S.ds = Math.min((canvas.width * 0.72) / w, (canvas.height * 0.72) / h, 1);
    if (!S.bound) { bind(); S.bound = true; }
    draw();
  }

  // ---- geometry --------------------------------------------------------------
  // Screen (canvas-local px) ⇄ document coordinates, through the creation's
  // transform. Translation is applied before rotation, so the inverse is
  // untranslate → unrotate → unscale.
  function docToScreen(x, y) {
    const t = S.creation.transform, r = t.rotation * Math.PI / 180;
    const w = S.creation.original.width, h = S.creation.original.height;
    const lx = (x - w / 2) * t.scale, ly = (y - h / 2) * t.scale;
    const rx = lx * Math.cos(r) - ly * Math.sin(r), ry = lx * Math.sin(r) + ly * Math.cos(r);
    return [S.cx + (t.x + rx) * S.ds, S.cy + (t.y + ry) * S.ds];
  }
  function screenToDoc(px, py) {
    const t = S.creation.transform, r = -t.rotation * Math.PI / 180;
    const w = S.creation.original.width, h = S.creation.original.height;
    const vx = (px - S.cx) / S.ds - t.x, vy = (py - S.cy) / S.ds - t.y;
    const rx = vx * Math.cos(r) - vy * Math.sin(r), ry = vx * Math.sin(r) + vy * Math.cos(r);
    return [rx / t.scale + w / 2, ry / t.scale + h / 2];
  }
  function eventPoint(e) {
    const r = S.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (S.canvas.width / r.width),
            (e.clientY - r.top) * (S.canvas.height / r.height)];
  }
  // Pencil radius in DOCUMENT pixels — a pencil mark belongs to the
  // drawing, so its width is the drawing's, not the screen's.
  function pencilDocRadius() { return S.creation.pencilRadius(S.size); }
  function eraseDocRadius() { return S.creation.pencilRadius(S.size) * 2.4 + 2; }

  // ---- drawing -----------------------------------------------------------------
  function surface(ctx, w, h) {
    // A quiet warm paper-grey. Deliberately NOT a checkerboard: that is a
    // developer's transparency indicator, and this canvas faces a child.
    ctx.fillStyle = '#eceae4';
    ctx.fillRect(0, 0, w, h);
  }

  function draw() {
    if (!S.creation) return;
    const ctx = S.ctx, cw = S.canvas.width, chh = S.canvas.height;
    surface(ctx, cw, chh);
    const w = S.creation.original.width, h = S.creation.original.height;

    if (S.viewMode === 'original') {
      // ORIGINAL: the untouched layer, plain and centred — no edits, no
      // transform, exactly what came from paper.
      ctx.save();
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(S.cx, S.cy);
      ctx.scale(S.ds, S.ds);
      ctx.drawImage(S.creation.originalCanvas(), -w / 2, -h / 2);
      ctx.restore();
      return;
    }

    const t = S.creation.transform;
    const liveDx = S.drag ? S.drag.dx : 0, liveDy = S.drag ? S.drag.dy : 0;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(S.cx + t.x * S.ds + liveDx, S.cy + t.y * S.ds + liveDy);
    ctx.rotate(t.rotation * Math.PI / 180);
    ctx.scale(t.scale * S.ds, t.scale * S.ds);
    ctx.drawImage(S.creation.viewCanvas(), -w / 2, -h / 2);
    ctx.restore();

    // Live stroke feedback in display space; the truth lands as an op on
    // pointerup and is then drawn from the recomposed view.
    if (S.stroke && S.stroke.points.length) {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle =
        S.stroke.t === 'erase' ? 'rgba(180,175,165,.65)' : S.stroke.color;
      ctx.lineWidth = Math.max(1.5, S.stroke.radius * 2 * S.ds * t.scale);
      ctx.lineCap = ctx.lineJoin = 'round';
      const pts = S.stroke.points.map((p) => docToScreen(p[0], p[1]));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- gestures ------------------------------------------------------------------
  function bind() {
    const c = S.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!S.creation || S.viewMode === 'original') return;
      c.setPointerCapture(e.pointerId);
      const [px, py] = eventPoint(e);
      if (S.tool === 'move') {
        S.drag = { sx: px, sy: py, dx: 0, dy: 0 };
      } else if (S.tool === 'fill') {
        S.tap = { px, py, moved: false };
      } else {
        S.stroke = {
          t: S.tool === 'erase' ? 'erase' : 'pencil',
          color: S.color,
          radius: S.tool === 'erase' ? eraseDocRadius() : pencilDocRadius(),
          points: [screenToDoc(px, py)]
        };
      }
      draw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!S.creation) return;
      const [px, py] = eventPoint(e);
      if (S.drag) { S.drag.dx = px - S.drag.sx; S.drag.dy = py - S.drag.sy; draw(); }
      else if (S.stroke) { S.stroke.points.push(screenToDoc(px, py)); draw(); }
      else if (S.tap && Math.hypot(px - S.tap.px, py - S.tap.py) > 6) S.tap.moved = true;
    });
    c.addEventListener('pointerup', (e) => {
      if (!S.creation) return;
      if (S.drag) {
        const dx = Math.round(S.drag.dx / S.ds), dy = Math.round(S.drag.dy / S.ds);
        S.drag = null;
        if (dx || dy) applyOp({ t: 'move', dx, dy });
        else draw();
      } else if (S.stroke) {
        const op = S.stroke; S.stroke = null;
        applyOp({ t: op.t, color: op.color, size: S.size, radius: op.radius, points: op.points });
      } else if (S.tap) {
        const tap = S.tap; S.tap = null;
        if (tap.moved) { draw(); return; }
        fillTap(eventPoint(e));
      }
    });
  }

  /* The Fill tap. Inside a shape → colour it in (under the lines). On the
   * line itself → colour the line, keeping its pencil texture. Anywhere
   * else — open space, an unenclosed scribble — nothing happens and the
   * developer log says why; the drawing is never guessed at. */
  function fillTap(pt) {
    const [dx, dy] = screenToDoc(pt[0], pt[1]);
    const hit = S.creation.hitAt(dx, dy);
    if (!hit) {
      const R = S.creation.regions();
      note(R.none ? R.note
        : 'fill: nothing enclosed there — tap inside a shape, or on its line');
      return;
    }
    S.lastRegion = hit.region;
    if (hit.kind === 'region') {
      applyOp({ t: 'fill', region: hit.region, color: S.color,
                x: Math.round(dx), y: Math.round(dy) });
      note('fill: area ' + hit.region + ' ← ' + S.color + ' (under the lines)');
    } else {
      applyOp({ t: 'lineColor', region: hit.region, color: S.color });
      note('line colour: area ' + hit.region + ' ← ' + S.color +
           ' (tinted — the pencil texture stays)');
    }
  }

  function applyOp(op) {
    S.creation.apply(op);
    draw();
    if (S.onChange) S.onChange();
  }
  function note(msg) { if (S.onNote) S.onNote(msg); }

  // ---- the small API app.js wires to buttons -----------------------------------
  function setTool(tool) { S.tool = tool; }
  function setColor(color) { S.color = color; }
  function setSize(size) { S.size = size; }
  function setView(mode) { S.viewMode = mode; draw(); }
  /* Thin / Original / Thick for the last shape the child touched. Returns
   * false when no shape has been touched yet — the caller says so. */
  function setLineWidth(width) {
    if (!S.lastRegion) return false;
    applyOp({ t: 'lineWidth', region: S.lastRegion, width });
    return true;
  }
  function undo() { if (S.creation.undo()) { draw(); if (S.onChange) S.onChange(); } }
  function redo() { if (S.creation.redo()) { draw(); if (S.onChange) S.onChange(); } }
  function reset() { if (S.creation.reset()) { draw(); if (S.onChange) S.onChange(); } }
  function scaleBy(f) { applyOp({ t: 'scale', f }); }
  function rotateBy(deg) { applyOp({ t: 'rotate', deg }); }
  function redraw() { draw(); }

  window.BIAEditor = {
    mount, setTool, setColor, setSize, setView, setLineWidth,
    undo, redo, reset, scaleBy, rotateBy, redraw,
    // Instrumentation for the suite and devtools — same standing as __bia.
    docToScreen, screenToDoc, state: S
  };
})();
