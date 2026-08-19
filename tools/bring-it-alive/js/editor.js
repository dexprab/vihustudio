/* EDITOR — Make It Yours: the editing canvas over a neutral working surface.
 *
 * This is presentation and gesture only. Every decision a gesture produces
 * is handed to the Creation as an OP (creation.js owns the layers, the
 * history and the pixels); the editor never touches a layer directly. The
 * split is the same one the rest of the tool already lives by: preview.js
 * shows and never touches, and this module gestures and never composes.
 *
 * The working surface is a LIGHT checkerboard — transparency shown
 * honestly, per the sprint's correction. It is not a sky, not dark, not a
 * place. The extraction sits on it at full visual weight: no ghosting, no
 * glow, no halo — whatever the view's bytes say, scaled for display and
 * nothing else.
 *
 * One display scale (ds) maps document space to screen; the creation's own
 * TRANSFORM is drawn inside that mapping, so what the child moves/resizes/
 * rotates is the document's state, never the viewport.
 */
(function () {
  'use strict';

  const S = {
    canvas: null, ctx: null, creation: null, onChange: null,
    tool: 'paint', color: '#1f2430', brushDisp: 7,
    ds: 1, cx: 0, cy: 0,
    stroke: null,          // in-progress paint/erase stroke (doc coords)
    drag: null,            // in-progress move drag {sx, sy, dx, dy} display px
    bound: false
  };

  function mount(canvas, creation, onChange) {
    S.canvas = canvas;
    S.ctx = canvas.getContext('2d');
    S.creation = creation;
    S.onChange = onChange || null;
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
  // Brush radius in document pixels: constant on SCREEN, whatever the
  // document's scale — a finger is a finger.
  function brushDocRadius() {
    return Math.max(1, S.brushDisp / (S.ds * S.creation.transform.scale));
  }

  // ---- drawing -----------------------------------------------------------------
  function surface(ctx, w, h) {
    // Light checkerboard: transparency, honestly, and NOT a night sky.
    const T = 14;
    for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) {
      ctx.fillStyle = ((x / T + y / T) % 2) ? '#ece7dd' : '#f7f4ee';
      ctx.fillRect(x, y, T, T);
    }
  }

  function draw() {
    if (!S.creation) return;
    const ctx = S.ctx, cw = S.canvas.width, chh = S.canvas.height;
    surface(ctx, cw, chh);
    const t = S.creation.transform;
    const w = S.creation.original.width, h = S.creation.original.height;
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
      ctx.lineWidth = S.brushDisp * 2;
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
      if (!S.creation) return;
      c.setPointerCapture(e.pointerId);
      const [px, py] = eventPoint(e);
      if (S.tool === 'move') {
        S.drag = { sx: px, sy: py, dx: 0, dy: 0 };
      } else {
        S.stroke = { t: S.tool, color: S.color, radius: brushDocRadius(),
                     points: [screenToDoc(px, py)] };
      }
      draw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!S.creation) return;
      const [px, py] = eventPoint(e);
      if (S.drag) { S.drag.dx = px - S.drag.sx; S.drag.dy = py - S.drag.sy; draw(); }
      else if (S.stroke) { S.stroke.points.push(screenToDoc(px, py)); draw(); }
    });
    c.addEventListener('pointerup', () => {
      if (!S.creation) return;
      if (S.drag) {
        const dx = Math.round(S.drag.dx / S.ds), dy = Math.round(S.drag.dy / S.ds);
        S.drag = null;
        if (dx || dy) applyOp({ t: 'move', dx, dy });
        else draw();
      } else if (S.stroke) {
        const op = S.stroke; S.stroke = null;
        applyOp({ t: op.t, color: op.color, radius: op.radius, points: op.points });
      }
    });
  }

  function applyOp(op) {
    S.creation.apply(op);
    draw();
    if (S.onChange) S.onChange();
  }

  // ---- the small API app.js wires to buttons -----------------------------------
  function setTool(tool) { S.tool = tool; }
  function setColor(color) { S.color = color; }
  function setBrush(px) { S.brushDisp = px; }
  function undo() { if (S.creation.undo()) { draw(); if (S.onChange) S.onChange(); } }
  function redo() { if (S.creation.redo()) { draw(); if (S.onChange) S.onChange(); } }
  function scaleBy(f) { applyOp({ t: 'scale', f }); }
  function rotateBy(deg) { applyOp({ t: 'rotate', deg }); }
  function redraw() { draw(); }

  window.BIAEditor = {
    mount, setTool, setColor, setBrush, undo, redo, scaleBy, rotateBy, redraw,
    // Instrumentation for the suite and devtools — same standing as __bia.
    docToScreen, screenToDoc, state: S
  };
})();
