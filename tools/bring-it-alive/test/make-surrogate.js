/* MAKE THE SURROGATE — Test Case 001, procedurally.
 *
 * The sprint's reference photograph did not arrive with the brief, so the
 * suite needed a stand-in that contains every element the brief lists: an
 * off-white page on a darker table, mild skew, a lighting gradient and a
 * corner shadow, three rows of handwriting, a left-hand pencil character,
 * a smaller right-hand pencil object, and one thin line CONNECTING the two
 * — the connectivity ambiguity that Test 001D exists to exercise.
 *
 * The real photographs arrived later (tools/imagebed/), and the surrogate
 * stays anyway: it is deterministic, ground-truthed to the pixel, and fast,
 * which makes it the unit fixture; the real photo is the integration
 * fixture. Everything here is seeded, so the committed PNGs never drift.
 *
 * Ground truth is produced by re-rendering each pencil element ALONE with
 * the exact same transform and stroke calls, then thresholding alpha. That
 * gives the suite per-element ink sets ("the left character's ink") that no
 * amount of eyeballing bounding boxes could — the assertions in run-tests.js
 * are counts over these masks, not over rectangles.
 *
 * Run:  NODE_PATH=/opt/node22/lib/node_modules node test/make-surrogate.js
 * Writes: surrogate-001.png, gt-left.png, gt-right.png, gt-line.png,
 *         gt-writing.png, surrogate-001.meta.json  (all beside this file).
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = __dirname;

/* Everything below runs inside the browser page. It draws the scene once
 * per requested layer set; the main image is all layers, each ground-truth
 * pass is one pencil layer on a transparent canvas. */
const DRAW = `(layers) => {
  const W = 1600, H = 1200, SEED = 20260819;

  // mulberry32 — tiny seeded PRNG; the whole point of the surrogate is that
  // two runs produce byte-identical scenes. Each ELEMENT gets its own
  // stream (seed xor a name hash), because the ground-truth passes render
  // one element alone: with a single shared stream the jitter would depend
  // on which layers ran before, and the GT ink would not align with the
  // main image's ink — the one property the suite depends on.
  let s = SEED;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const stream = (name) => { let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    s = (SEED ^ h) | 0; };

  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');

  const on = (name) => layers.includes(name);
  const gt = !on('table'); // ground-truth passes have no background at all

  // The page sits slightly skewed on the table — the brief's "mild
  // perspective". Canvas 2D has no projective transform, so this is an
  // affine approximation (small rotation + shear); disclosed in the report.
  const skew = () => { x.translate(W / 2, H / 2); x.rotate(0.018);
    x.transform(1, 0.008, 0.012, 1, 0, 0); x.translate(-W / 2, -H / 2); };

  if (on('table')) {
    x.fillStyle = '#2e2a33'; x.fillRect(0, 0, W, H);
    const v = x.createRadialGradient(W/2, H/2, 300, W/2, H/2, 1000);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.25)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  }

  x.save(); skew();

  if (on('paper')) {
    x.fillStyle = '#f3f0e6'; x.fillRect(120, 90, 1360, 1020);
    // mild brightness gradient across the page
    const g = x.createLinearGradient(120, 90, 1480, 1110);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(30,30,40,0.09)');
    x.fillStyle = g; x.fillRect(120, 90, 1360, 1020);
    // soft corner shadow, bottom-left
    const sh = x.createRadialGradient(180, 1060, 20, 180, 1060, 420);
    sh.addColorStop(0, 'rgba(20,20,28,0.16)'); sh.addColorStop(1, 'rgba(20,20,28,0)');
    x.fillStyle = sh; x.fillRect(120, 90, 1360, 1020);
  }

  // A pencil stroke: a polyline drawn as many short jittered segments in a
  // greyish graphite colour, plus a fainter offset pass for grain.
  const pencil = (pts, w) => {
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass === 0
        ? 'rgba(' + (66 + (rnd()*10|0)) + ',' + (66 + (rnd()*10|0)) + ',' + (76 + (rnd()*10|0)) + ',0.9)'
        : 'rgba(90,90,102,0.35)';
      x.lineWidth = pass === 0 ? w : Math.max(1, w - 1);
      x.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const jx = pts[i][0] + (rnd() - 0.5) * 1.2 + (pass ? 0.7 : 0);
        const jy = pts[i][1] + (rnd() - 0.5) * 1.2 + (pass ? 0.5 : 0);
        if (i === 0) x.moveTo(jx, jy); else x.lineTo(jx, jy);
      }
      x.stroke();
    }
  };
  const arc = (cx, cy, r, a0, a1, n) => { const p = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };

  // Handwriting: three rows of cursive-ish squiggle "words". These exist so
  // segmentation has plausible ink OUTSIDE any claim to correctly ignore.
  if (on('writing')) {
    stream('writing');
    for (let row = 0; row < 3; row++) {
      const y0 = 180 + row * 52; let cx = 260 + rnd() * 30;
      while (cx < 1280) {
        const len = 60 + rnd() * 110; const p = [];
        for (let t = 0; t <= len; t += 4) {
          p.push([cx + t, y0 + Math.sin(t * (0.25 + rnd() * 0.1)) * (7 + rnd() * 4)
                          + (rnd() - 0.5) * 2]);
        }
        pencil(p, 2); cx += len + 22 + rnd() * 18;
      }
    }
  }

  // Left character: round head, curved body, asymmetric stick arms and legs.
  if (on('left')) {
    stream('left');
    pencil(arc(470, 470, 50, 0, Math.PI * 2.02, 40), 3);          // head
    pencil([[452, 462], [456, 466]], 3);                          // eyes
    pencil([[488, 460], [492, 465]], 3);
    pencil(arc(470, 488, 14, 0.3, Math.PI - 0.4, 10), 2);         // mouth
    pencil([[470, 520], [462, 600], [452, 700], [450, 780]], 3);  // body (curved)
    pencil([[462, 580], [410, 552], [362, 528]], 3);              // arm up-left
    pencil([[458, 596], [522, 618], [583, 634]], 3);              // arm to right
    pencil([[450, 780], [418, 845], [392, 900]], 3);              // legs, uneven
    pencil([[450, 780], [488, 842], [518, 892]], 3);
  }

  // Right object: a small house — a different KIND of shape from the
  // character, so a claim mix-up is visually undeniable in screenshots.
  if (on('right')) {
    stream('right');
    pencil([[1090, 700], [1090, 800], [1230, 802], [1228, 698], [1090, 700]], 3);
    pencil([[1082, 702], [1160, 636], [1236, 700]], 3);           // roof
    pencil([[1130, 800], [1130, 748], [1168, 748], [1168, 800]], 2); // door
    pencil([[1190, 726], [1214, 726], [1214, 748], [1190, 748], [1190, 726]], 2);
  }

  // The connecting line — the whole reason 001D exists. It touches the left
  // character's right hand AND the house's left wall, making all three one
  // ink component; a loose claim around either figure catches its stub.
  if (on('line')) {
    stream('line');
    const p = [];
    for (let t = 0; t <= 1; t += 0.02) {
      p.push([583 + t * (1090 - 583), 634 + t * (700 - 634) + Math.sin(t * 9) * 3]);
    }
    pencil(p, 2);
  }

  // The suite drives the REAL page in final image coordinates, and the ink
  // above was drawn under the skew transform — so the geometry handed to the
  // meta file must go through the exact same matrix, not the drawing-space
  // numbers. Returning the matrix from here keeps one source of truth.
  const m = x.getTransform();
  x.restore();
  return { url: c.toDataURL('image/png'),
           matrix: [m.a, m.b, m.c, m.d, m.e, m.f] };
}`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  // Straightforward: evaluate the drawing function with each layer set.
  const shot = async (layers) =>
    page.evaluate(new Function('return ' + DRAW)(), layers);

  const main = await shot(['table', 'paper', 'writing', 'left', 'right', 'line']);
  const gtL = await shot(['left']);
  const gtR = await shot(['right']);
  const gtC = await shot(['line']);
  const gtW = await shot(['writing']);

  const save = (name, r) =>
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.url.split(',')[1], 'base64'));
  save('surrogate-001.png', main);
  save('gt-left.png', gtL);
  save('gt-right.png', gtR);
  save('gt-line.png', gtC);
  save('gt-writing.png', gtW);

  // The meta file records what the suite needs to DRIVE the page — where to
  // draw claims and along which path the connecting line runs — in FINAL
  // image coordinates: every point below goes through the same skew matrix
  // the ink was drawn under, so the suite never hard-codes geometry that
  // only the generator knows.
  const [a, b, cc, d, e, f] = main.matrix;
  const tf = ([px, py]) =>
    [Math.round(a * px + cc * py + e), Math.round(b * px + d * py + f)];
  const ellipse = (cx, cy, rx, ry, n) => { const p = [];
    for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2;
      p.push(tf([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])); } return p; };

  const meta = {
    id: 'surrogate-001', width: 1600, height: 1200, seed: 20260819,
    note: 'Procedural surrogate for Test Case 001; the real photographs live in tools/imagebed/.',
    linePath: (() => { const p = [];
      for (let t = 0; t <= 1.0001; t += 0.05) {
        p.push(tf([583 + t * (1090 - 583), 634 + t * (700 - 634)]));
      } return p; })(),
    claims: {
      left: ellipse(470, 650, 230, 310, 36),
      right: ellipse(1160, 715, 165, 145, 36)
    }
  };
  fs.writeFileSync(path.join(OUT, 'surrogate-001.meta.json'),
    JSON.stringify(meta, null, 2) + '\n');

  console.log('surrogate written:', path.join(OUT, 'surrogate-001.png'));
  await browser.close();
})();
