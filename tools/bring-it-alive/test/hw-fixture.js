/* HW FIXTURE — the deterministic synthetic LETTER photographs, shared.
 *
 * One composer, two consumers: the handwriting suite
 * (test/run-handwriting-tests.js) and the fake-camera feed generator
 * (test/make-hw-feeds.js). It lives here so the photographs the suite
 * asserts against and the frames the camera fixtures are cut from can
 * never drift apart.
 *
 * COMPOSE is a STRING of page-side code (evaluated in the page, where
 * the canvas is): a sheet of paper on a desk-grey ground, with ONE
 * letter (or several, for the refusal fixtures) written in a jittered
 * hand — per-letter rotation and baseline wobble from a SEEDED
 * generator (mulberry32; Math.random appears nowhere), so every run
 * composes the same photograph. DejaVu Sans, the same face the card-era
 * fixtures used: no serifs to shed at the ink threshold, junctions
 * sturdy, close to a child's print.
 *
 * THE GOVERNING PRINCIPLE'S MATRIX (the product owner: "the kid might
 * write on any kind of paper of any color, with any color") made the
 * composer colour-aware and scene-aware. Every addition is opt-in and
 * consumes NO seeded randomness unless enabled, so every pre-existing
 * fixture composes byte-identically:
 *
 *   paperColor · deskColor · inkColor   any paper, any room, any pen
 *   dim (0..1) · vignette (0..1)        real evening room light — the
 *                                       whole frame scaled darker, the
 *                                       corners a little more (the
 *                                       field's grey-lavender frame)
 *   doorframe: true                     two dark uprights and a lintel
 *                                       on the background — the field's
 *                                       door behind the owner
 *   blob: {cx,cy,r,anchored}            a PROCEDURAL face-like mass —
 *                                       irregular boundary, hair spikes,
 *                                       two interior holes and a mouth
 *                                       bar. No face imagery of any
 *                                       kind: geometry only.
 *   fingers: {hx,tipY,cover}            fingers and a thumb gripping
 *                                       the page from the frame's
 *                                       bottom edge — always CROSSING
 *                                       the paper's edge, the way a
 *                                       held page really is. cover:true
 *                                       reaches one finger further in,
 *                                       over the letter's own stroke.
 *   curtain: true                       a textured drape filling the
 *                                       left of the frame (vertical
 *                                       wavy folds — never uniform).
 *   crayon: true                        the letter drawn SOLID, as a
 *                                       crayon fill: the same glyph
 *                                       stroked so thick its counters
 *                                       close — a filled letter, not an
 *                                       outline.
 *   paperX, paperY                      place the page off-centre (the
 *                                       field scene holds it to one
 *                                       side).
 *
 * opts: { seed, fw, fh (default 1280×960), ch OR letters:[{ch,cx,cy}],
 *         size (px), paperW, paperH (px), ruled (bool), ruleColor,
 *         ruleWidth, ruleGap, specks (count), noPaper (bare desk),
 *         ...the scene fields above }.
 * Returns { dataURL, letters:[{ch,cx,cy}], size, W, H,
 *           paper:{x,y,w,h}, scene:{doorframe, blob, fingers, curtain} }.
 */
'use strict';

const COMPOSE = `(o) => {
  const fw = o.fw || 1280, fh = o.fh || 960;
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const x = c.getContext('2d', { willReadFrequently: true });
  let s = (o.seed >>> 0) || 1;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const scene = {};
  x.fillStyle = o.deskColor || '#5f6673';        // the desk (or the wall)
  x.fillRect(0, 0, fw, fh);
  if (o.curtain) {                               // a textured drape, left
    const cw = Math.round(0.30 * fw);
    x.fillStyle = '#6b5b49';
    x.fillRect(0, 0, cw, fh);
    for (let i = 0; i < 15; i++) {               // wavy vertical folds
      const fx = (i + 0.5) * cw / 15;
      const shade = 42 + (i % 4) * 14;
      x.fillStyle = 'rgb(' + (shade + 30) + ',' + (shade + 16) + ',' + shade + ')';
      x.beginPath();
      for (let y = 0; y <= fh; y += 24) {
        const wob = Math.sin(y / 90 + i * 1.7) * 9;
        if (y === 0) x.moveTo(fx + wob, y); else x.lineTo(fx + wob, y);
      }
      x.lineWidth = 6 + (i % 3) * 4;
      x.strokeStyle = x.fillStyle;
      x.stroke();
    }
    scene.curtain = { x: 0, y: 0, w: cw, h: fh };
  }
  if (o.doorframe) {                             // uprights and a lintel
    const d = (o.doorframe === true) ? {} : o.doorframe;
    const bx = Math.round((d.x != null ? d.x : 0.74) * fw);
    const bw = Math.round((d.w != null ? d.w : 0.022) * fw);
    const gap = Math.round(0.15 * fw);
    x.fillStyle = d.color || '#42382c';
    x.fillRect(bx, 0, bw, fh);
    x.fillRect(bx + gap, 0, bw, fh);
    x.fillRect(bx, Math.round(0.10 * fh), gap + bw, bw);
    scene.doorframe = [{ x: bx, y: 0, w: bw, h: fh },
                       { x: bx + gap, y: 0, w: bw, h: fh },
                       { x: bx, y: Math.round(0.10 * fh), w: gap + bw, h: bw }];
  }
  const drawBlob = () => {                       // procedural face-like mass
    const b = (o.blob === true) ? {} : o.blob;
    const bcx = b.cx != null ? b.cx : Math.round(0.32 * fw);
    const bcy = b.cy != null ? b.cy : Math.round(0.38 * fh);
    const br = b.r != null ? b.r : 150;
    const skin = b.color || '#c9a98c';
    if (b.anchored !== false) {                  // a body under it, to the edge
      x.fillStyle = '#54463a';
      x.beginPath();
      x.moveTo(bcx - 0.9 * br, fh);
      x.lineTo(bcx - 0.55 * br, bcy + 0.85 * br);
      x.lineTo(bcx + 0.55 * br, bcy + 0.85 * br);
      x.lineTo(bcx + 0.9 * br, fh);
      x.closePath(); x.fill();
    }
    x.fillStyle = '#3a2e22';                     // an irregular hair mass
    x.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (1 + i / 40);
      const spike = 1.12 + 0.16 * Math.sin(i * 2.7) + 0.09 * Math.sin(i * 5.3);
      const hx = bcx + Math.cos(a) * br * spike;
      const hy = bcy + 0.2 * br + Math.sin(a) * br * 1.28 * spike;
      if (i === 0) x.moveTo(hx, hy); else x.lineTo(hx, hy);
    }
    x.closePath(); x.fill();
    x.fillStyle = skin;                          // the face: perturbed ellipse
    x.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = 2 * Math.PI * i / 48;
      const rr = br * (1 + 0.06 * Math.sin(5 * a) + 0.04 * Math.sin(9 * a + 1));
      const exx = bcx + Math.cos(a) * rr;
      const eyy = bcy + Math.sin(a) * rr * 1.16;
      if (i === 0) x.moveTo(exx, eyy); else x.lineTo(exx, eyy);
    }
    x.closePath(); x.fill();
    x.fillStyle = b.over ? (o.paperColor || '#ffffff')
                         : (o.deskColor || '#5f6673');
    x.beginPath();                               // interior holes (what is
    x.ellipse(bcx - 0.36 * br, bcy - 0.16 * br,  //  behind, showing through —
              0.15 * br, 0.11 * br, 0, 0, 7); x.fill(); // geometry, not imagery
    x.beginPath();
    x.ellipse(bcx + 0.36 * br, bcy - 0.16 * br,
              0.15 * br, 0.11 * br, 0, 0, 7); x.fill();
    x.fillRect(bcx - 0.3 * br, bcy + 0.42 * br, 0.6 * br, 0.1 * br);
    scene.blob = { cx: bcx, cy: bcy, r: br,
                   bbox: { x: bcx - 1.3 * br, y: bcy - 1.6 * br,
                           w: 2.6 * br, h: (b.anchored !== false ? fh : bcy + 1.3 * br) } };
  };
  if (o.blob && !(o.blob.over)) drawBlob();      // behind the paper (the room)
  const pw = o.paperW || Math.round(0.82 * fw);
  const ph = o.paperH || Math.round(0.86 * fh);
  const px = o.paperX != null ? o.paperX : Math.round((fw - pw) / 2);
  const py = o.paperY != null ? o.paperY : Math.round((fh - ph) / 2);
  if (!o.noPaper) {
    x.fillStyle = o.paperColor || '#ffffff';     // the paper
    x.fillRect(px, py, pw, ph);
  }
  if (o.ruled && !o.noPaper) {
    x.strokeStyle = o.ruleColor || '#8fa8c8';
    x.lineWidth = o.ruleWidth || 3;
    for (let y = py + 60; y < py + ph - 10; y += (o.ruleGap || 90)) {
      x.beginPath(); x.moveTo(px + 8, y); x.lineTo(px + pw - 8, y); x.stroke();
    }
  }
  const size = o.size || 430;
  const letters = o.letters ||
    (o.ch ? [{ ch: o.ch, cx: fw / 2, cy: fh / 2 }] : []);
  x.fillStyle = o.inkColor || '#1a1e28';
  x.font = size + 'px "DejaVu Sans"';
  for (const L of letters) {
    const m = x.measureText(L.ch);
    x.save();
    x.translate(L.cx, L.cy + (rnd() - 0.5) * size * 0.04);
    x.rotate(((rnd() - 0.5) * 4) * Math.PI / 180);
    if (o.crayon) {                              // a crayon-filled letter:
      x.strokeStyle = x.fillStyle;               //  stroked so thick the
      x.lineWidth = 0.30 * size;                 //  counters close — solid,
      x.lineJoin = 'round';                      //  smooth-edged fill
      x.strokeText(L.ch, -m.width / 2, size * 0.36);
    }
    x.fillText(L.ch, -m.width / 2, size * 0.36);
    x.restore();
  }
  if (o.blob && o.blob.over) drawBlob();         // over the paper (a sticker-
                                                 //  like mass INSIDE the page,
                                                 //  for the stroke gates)
  if (o.specks && !o.noPaper) {
    x.fillStyle = '#2a2e38';
    for (let i = 0; i < o.specks; i++) {
      x.fillRect(px + rnd() * (pw - 8), py + rnd() * (ph - 8),
                 2 + rnd() * 4, 2 + rnd() * 4);
    }
  }
  if (o.fingers && !o.noPaper) {                 // a hand gripping the page —
    const f = (o.fingers === true) ? {} : o.fingers;
    const hx = f.hx != null ? f.hx : px + Math.round(0.16 * pw);
    const tipY = f.tipY != null ? f.tipY
      : py + ph - Math.round(0.16 * ph);         //  over the paper's edge
    const fingerW = 46;
    x.fillStyle = '#c9a184';
    let minX = fw, maxX = 0, minY = fh;
    for (let i = 0; i < 4; i++) {                //  four fingers, frame edge up
      const fx = hx + (i - 1.5) * 58;
      const fy = tipY + (i === 1 || i === 2 ? 0 : 26);
      x.fillRect(fx - fingerW / 2, fy, fingerW, fh - fy + 40);
      x.beginPath(); x.arc(fx, fy, fingerW / 2, 0, 7); x.fill();
      minX = Math.min(minX, fx - fingerW / 2);
      maxX = Math.max(maxX, fx + fingerW / 2);
      minY = Math.min(minY, fy - fingerW / 2);
    }
    x.save();                                    //  the thumb, across
    x.translate(hx + 150, tipY + 130);
    x.rotate(-0.5);
    x.fillRect(-30, -26, 190, 52);
    x.beginPath(); x.arc(-30, 0, 26, 0, 7); x.fill();
    x.restore();
    if (f.cover && letters.length) {             //  reaching over the stroke
      const L = letters[0];
      x.save();
      x.translate(hx + 29, fh);
      const dx2 = L.cx - (hx + 29), dy2 = L.cy + 0.2 * size - fh;
      const ang = Math.atan2(dy2, dx2);
      x.rotate(ang);
      const len = Math.hypot(dx2, dy2);
      x.fillRect(0, -fingerW / 2, len, fingerW);
      x.beginPath(); x.arc(len, 0, fingerW / 2, 0, 7); x.fill();
      x.restore();
      minY = Math.min(minY, L.cy - fingerW);
      maxX = Math.max(maxX, L.cx + fingerW);
    }
    scene.fingers = { bbox: { x: minX, y: minY,
                              w: maxX - minX + 220, h: fh - minY } };
  }
  if (o.dim || o.vignette || o.noise) {          // real evening room light,
    const dim = o.dim || 1;                      //  and real sensor noise
    const vig = o.vignette || 0;
    const noise = o.noise || 0;
    const im = x.getImageData(0, 0, fw, fh);
    const d = im.data;
    const cx2 = fw / 2, cy2 = fh / 2;
    const rMax2 = cx2 * cx2 + cy2 * cy2;
    for (let yy = 0; yy < fh; yy++) {
      const dy2 = (yy - cy2) * (yy - cy2);
      for (let xx = 0; xx < fw; xx++) {
        const r2 = ((xx - cx2) * (xx - cx2) + dy2) / rMax2;
        const k = dim * (1 - vig * r2);
        const p = (yy * fw + xx) * 4;
        const n = noise ? (rnd() * 2 - 1) * noise : 0;
        d[p] = d[p] * k + n; d[p + 1] = d[p + 1] * k + n;
        d[p + 2] = d[p + 2] * k + n;
      }
    }
    x.putImageData(im, 0, 0);
  }
  return { dataURL: c.toDataURL('image/png'), letters, size,
           W: fw, H: fh, paper: { x: px, y: py, w: pw, h: ph }, scene };
}`;

module.exports = { COMPOSE };
