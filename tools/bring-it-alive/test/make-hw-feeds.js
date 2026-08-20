/* HW CAMERA FEED FIXTURES — the y4m files Chromium serves as the fake
 * camera (--use-file-for-fake-video-capture) so the FREE-MOTION line
 * collection can be verified end to end against the real live loop.
 *
 * All frames are cut from THE SAME deterministic synthetic filled sheet
 * the handwriting suite asserts against (test/hw-fixture.js, seed 7,
 * width 2000, rendered by the page's own HWSheet.draw — so the fixtures
 * and the suite cannot drift). A landscape 1280×960 sensor, matching
 * test/make-camera-feed.js's precedent:
 *
 *   hw-line-<1..5>.y4m   ONE line's band, fitted by width — the close-up
 *                        a child sweeping the camera actually produces.
 *                        Two identical frames (Chromium loops the file).
 *   hw-sheet.y4m         the whole sheet fitted by height — the full
 *                        ladder registers and every line lands at once.
 *   hw-line-blank.y4m    line 3's band from a sheet the child never
 *                        wrote on — anchors and model print, no ink:
 *                        must collect NOTHING.
 *   hw-sweep.y4m         lines 1→2→3, four frames each at F2:1 (2s per
 *                        frame) — a sweep across the sheet in one file.
 *                        Chromium accepts exactly one y4m per launch, so
 *                        the deterministic identity checks use one
 *                        launch per line fixture; the sweep file exists
 *                        to drive multi-line accumulation in a single
 *                        launch (order-independent and latest-wins, so
 *                        whichever frame each sample lands on, the
 *                        collection converges).
 *   hw-noisy.y4m         a NOISY ROOM SCENE, no sheet anywhere: seeded
 *                        gradients, furniture-edge rectangles, ruled
 *                        shadows, hundreds of dark compact specks and a
 *                        face-ish blob — the scene shape of the field
 *                        freeze ("as soon as camera opened the entire
 *                        page got stuck"). Measured, a frame of it cost
 *                        hwRead 12.4 SECONDS on the main thread. The
 *                        responsiveness checks sweep it and assert the
 *                        page never blocks and nothing is collected.
 *
 * hw-feeds.json carries each fixture's sheet→frame mapping and the
 * sheet's ground truth, so the suite's mislabel checks stay exact.
 *
 * ~30 MB all told — generated on demand, gitignored, never committed.
 * The suite requires this module and generates the set if it is
 * missing. Standalone (server already running):
 *   BIA_PORT=9171 NODE_PATH=/opt/node22/lib/node_modules node test/make-hw-feeds.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COMPOSE } = require(path.join(__dirname, 'hw-fixture.js'));

const W = 1280, H = 960;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const META = path.join(__dirname, 'hw-feeds.json');

const FILE = {
  line: (i) => path.join(__dirname, 'hw-line-' + (i + 1) + '.y4m'),
  sheet: path.join(__dirname, 'hw-sheet.y4m'),
  blank: path.join(__dirname, 'hw-line-blank.y4m'),
  sweep: path.join(__dirname, 'hw-sweep.y4m'),
  noisy: path.join(__dirname, 'hw-noisy.y4m')
};

function allPresent() {
  const files = [FILE.sheet, FILE.blank, FILE.sweep, FILE.noisy, META];
  for (let i = 0; i < 5; i++) files.push(FILE.line(i));
  return files.every((f) => fs.existsSync(f));
}

// RGB → YUV, BT.601 limited range, 4:2:0 — the same arithmetic as
// test/make-camera-feed.js, generalised to many frames and a chosen
// frame rate (the sweep file plays slowly on purpose).
function y4mOf(frames, fps) {
  const yPlane = () => Buffer.alloc(W * H);
  const cPlane = () => Buffer.alloc((W / 2) * (H / 2));
  const parts = [Buffer.from('YUV4MPEG2 W' + W + ' H' + H + ' F' + fps + ':1 Ip A1:1 C420\n', 'ascii')];
  const mark = Buffer.from('FRAME\n', 'ascii');
  for (const rgba of frames) {
    const Y = yPlane(), U = cPlane(), V = cPlane();
    const uf = new Float64Array(U.length), vf = new Float64Array(V.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
        Y[y * W + x] = Math.max(16, Math.min(235,
          Math.round(16 + (65.738 * r + 129.057 * g + 25.064 * b) / 256)));
        const ci = (y >> 1) * (W / 2) + (x >> 1);
        uf[ci] += (-37.945 * r - 74.494 * g + 112.439 * b) / 256;
        vf[ci] += (112.439 * r - 94.154 * g - 18.285 * b) / 256;
      }
    }
    for (let i = 0; i < U.length; i++) {
      U[i] = Math.max(16, Math.min(240, Math.round(128 + uf[i] / 4)));
      V[i] = Math.max(16, Math.min(240, Math.round(128 + vf[i] / 4)));
    }
    parts.push(mark, Y, U, V);
  }
  return Buffer.concat(parts);
}

/* Page-side: compose the sheet (or the blank variant) and render ONE
 * frame — a line band fitted by width, or the whole sheet fitted by
 * height — returning raw RGBA (base64) plus the sheet→frame mapping. */
const FRAME = `async (args) => {
  const made = (${COMPOSE})(args.blank
    ? { seed: 7, width: 2000, blankLines: [0, 1, 2, 3, 4] }
    : { seed: 7, width: 2000 });
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
  const G = HWSheet.GEOM;
  const SW = img.width, SH = img.height;
  const fw = ${W}, fh = ${H};
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#5f6673';              // the desk behind the sheet
  x.fillRect(0, 0, fw, fh);
  x.imageSmoothingQuality = 'high';
  let map;
  if (args.line != null) {
    const bandTop = (G.blockTop0 + args.line * G.blockStep - 0.02) * SH;
    const bandH = (G.blockStep + 0.04) * SH;
    const scale = fw / SW;
    const dh = bandH * scale;
    const oy = (fh - dh) / 2;
    x.drawImage(img, 0, bandTop, SW, bandH, 0, oy, fw, dh);
    map = { scale, ox: 0, oy, bandTop };
  } else {
    const scale = fh / SH;
    const dw = SW * scale;
    const ox = (fw - dw) / 2;
    x.drawImage(img, 0, 0, SW, SH, ox, 0, dw, fh);
    map = { scale, ox, oy: 0, bandTop: 0 };
  }
  const d = x.getImageData(0, 0, fw, fh).data;
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < d.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
  }
  return { b64: btoa(s), map, gt: made.gt, ruleYs: made.ruleYs, W: made.W, H: made.H };
}`;

/* Page-side: the noisy room scene — SEEDED (mulberry32-style, no
 * Math.random — the suite's hygiene check applies to fixtures), no
 * sheet anywhere. Its shape is what made the field frame expensive:
 * hundreds of dark compact candidate marks, long dark edges, gradients. */
const NOISY_FRAME = `() => {
  const W = ${W}, H = ${H};
  let s = 11;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#b9b2a6'); g.addColorStop(0.5, '#8f8a80'); g.addColorStop(1, '#5d5952');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {              // furniture blocks
    const v = 30 + rnd() * 90 | 0;
    x.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 10) + ')';
    x.fillRect(rnd() * W, rnd() * H, 60 + rnd() * 400, 40 + rnd() * 300);
  }
  x.strokeStyle = '#2b2620'; x.lineWidth = 3;  // shelf / frame edges
  for (let i = 0; i < 20; i++) {
    x.beginPath();
    const x0 = rnd() * W, y0 = rnd() * H;
    x.moveTo(x0, y0); x.lineTo(x0 + (rnd() - 0.5) * 700, y0 + (rnd() - 0.5) * 200);
    x.stroke();
  }
  for (let i = 0; i < 900; i++) {              // dark compact specks
    const v = rnd() * 40 | 0;
    x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    const r = 1.5 + rnd() * 6;
    x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, 7); x.fill();
  }
  x.fillStyle = '#c9a98c';                     // a face-ish blob
  x.beginPath(); x.arc(950, 300, 130, 0, 7); x.fill();
  x.fillStyle = '#241d18';
  x.beginPath(); x.arc(905, 270, 12, 0, 7); x.fill();
  x.beginPath(); x.arc(990, 270, 12, 0, 7); x.fill();
  x.fillRect(915, 340, 75, 10);
  const d = x.getImageData(0, 0, W, H).data;
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < d.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
  }
  return { b64: btoa(out) };
}`;

async function generate(base) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(base);
  await page.waitForFunction(() => window.__hw && window.__bia);

  const meta = { fixtures: {}, gt: null, ruleYs: null, sheetW: 0, sheetH: 0 };
  const lineFrames = [];
  for (let i = 0; i < 5; i++) {
    const r = await page.evaluate(`(${FRAME})({ line: ${i} })`);
    const rgba = Buffer.from(r.b64, 'base64');
    lineFrames.push(rgba);
    fs.writeFileSync(FILE.line(i), y4mOf([rgba, rgba], 30));
    meta.fixtures['line-' + (i + 1)] = { file: path.basename(FILE.line(i)), map: r.map };
    if (!meta.gt) {
      meta.gt = r.gt; meta.ruleYs = r.ruleYs;
      meta.sheetW = r.W; meta.sheetH = r.H;
    }
  }
  {
    const r = await page.evaluate(`(${FRAME})({})`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.sheet, y4mOf([rgba, rgba], 30));
    meta.fixtures.sheet = { file: path.basename(FILE.sheet), map: r.map };
  }
  {
    const r = await page.evaluate(`(${FRAME})({ line: 2, blank: true })`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.blank, y4mOf([rgba, rgba], 30));
    meta.fixtures.blank = { file: path.basename(FILE.blank), map: r.map };
  }
  {
    // the sweep: lines 1 → 2 → 3, four frames each, 2s per frame
    const frames = [];
    for (const i of [0, 1, 2]) {
      for (let k = 0; k < 4; k++) frames.push(lineFrames[i]);
    }
    fs.writeFileSync(FILE.sweep, y4mOf(frames, 2));
    meta.fixtures.sweep = { file: path.basename(FILE.sweep),
                            lines: [0, 1, 2],
                            map: meta.fixtures['line-1'].map };
  }
  {
    const r = await page.evaluate(`(${NOISY_FRAME})()`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.noisy, y4mOf([rgba, rgba], 30));
    meta.fixtures.noisy = { file: path.basename(FILE.noisy) };
  }
  fs.writeFileSync(META, JSON.stringify(meta));
  await browser.close();
  return meta;
}

function readMeta() { return JSON.parse(fs.readFileSync(META, 'utf8')); }

/** Map a sheet-space x (at the ground truth's own rule y) into frame x. */
function frameX(map, x) { return map.ox + x * map.scale; }

module.exports = { generate, allPresent, readMeta, frameX, FILE, META, W, H };

if (require.main === module) {
  const port = process.env.BIA_PORT || 8765;
  generate('http://127.0.0.1:' + port + '/tools/bring-it-alive/').then((m) => {
    console.log('wrote ' + Object.keys(m.fixtures).length + ' fixtures beside ' + META);
  }).catch((e) => { console.error(e); process.exit(1); });
}
