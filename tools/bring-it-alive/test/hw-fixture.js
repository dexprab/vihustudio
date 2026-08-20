/* HW FIXTURE — the deterministic synthetic LETTER photographs, shared.
 *
 * One composer, two consumers: the handwriting suite
 * (test/run-handwriting-tests.js) and the fake-camera feed generator
 * (test/make-hw-feeds.js). It lives here so the photographs the suite
 * asserts against and the frames the camera fixtures are cut from can
 * never drift apart.
 *
 * COMPOSE is a STRING of page-side code (evaluated in the page, where
 * the canvas is): a sheet of white-ish paper on a desk-grey ground,
 * with ONE letter (or several, for the refusal fixtures) written in a
 * jittered hand — per-letter rotation and baseline wobble from a SEEDED
 * generator (mulberry32; Math.random appears nowhere), so every run
 * composes the same photograph. DejaVu Sans, the same face the card-era
 * fixtures used: no serifs to shed at the ink threshold, junctions
 * sturdy, close to a child's print.
 *
 * opts: { seed, fw, fh (default 1280×960), ch OR letters:[{ch,cx,cy}],
 *         size (px), paperW, paperH (px), ruled (bool), ruleColor,
 *         ruleWidth, ruleGap, specks (count), noPaper (bare desk) }.
 * Returns { dataURL, letters:[{ch,cx,cy}], size, W, H,
 *           paper:{x,y,w,h} }.
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
  x.fillStyle = '#5f6673';                       // the desk
  x.fillRect(0, 0, fw, fh);
  const pw = o.paperW || Math.round(0.82 * fw);
  const ph = o.paperH || Math.round(0.86 * fh);
  const px = Math.round((fw - pw) / 2), py = Math.round((fh - ph) / 2);
  if (!o.noPaper) {
    x.fillStyle = '#ffffff';                     // the paper
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
  x.fillStyle = '#1a1e28';
  x.font = size + 'px "DejaVu Sans"';
  for (const L of letters) {
    const m = x.measureText(L.ch);
    x.save();
    x.translate(L.cx, L.cy + (rnd() - 0.5) * size * 0.04);
    x.rotate(((rnd() - 0.5) * 4) * Math.PI / 180);
    x.fillText(L.ch, -m.width / 2, size * 0.36);
    x.restore();
  }
  if (o.specks && !o.noPaper) {
    x.fillStyle = '#2a2e38';
    for (let i = 0; i < o.specks; i++) {
      x.fillRect(px + rnd() * (pw - 8), py + rnd() * (ph - 8),
                 2 + rnd() * 4, 2 + rnd() * 4);
    }
  }
  return { dataURL: c.toDataURL('image/png'), letters, size,
           W: fw, H: fh, paper: { x: px, y: py, w: pw, h: ph } };
}`;

module.exports = { COMPOSE };
