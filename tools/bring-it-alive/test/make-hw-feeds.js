/* HW CAMERA FEED FIXTURES — the y4m files Chromium serves as the fake
 * camera (--use-file-for-fake-video-capture) so the letter journey's
 * live loop — the readiness light and GREEN TAKES THE PICTURE — can be
 * verified end to end against the real page.
 *
 * All frames are composed by THE SAME deterministic letter composer the
 * handwriting suite asserts against (test/hw-fixture.js — seeded, no
 * Math.random), so the fixtures and the suite cannot drift. A landscape
 * 1280×960 sensor, matching test/make-camera-feed.js's precedent:
 *
 *   hw-letter-R.y4m       ONE steady big R on plain paper — the honest
 *                         hold. Steady green must auto-take the picture.
 *   hw-letter-i.y4m       a steady dotted i — the two-part letter must
 *                         capture whole, dot and all.
 *   hw-letter-two.y4m     'a' and 'b' far apart on one page — the light
 *                         stays red, the gentle one-letter overlay
 *                         shows, and nothing is ever captured.
 *   hw-letter-small.y4m   one letter written far too small to capture
 *                         well — red, with nothing captured: too small
 *                         to make a good letter is not ready.
 *   hw-letter-ruled.y4m   a letter on ruled notebook paper — reads and
 *                         captures, the rules stripped as disclosed.
 *   hw-letter-specks.y4m  a letter among scattered paper specks —
 *                         clutter must not block a clear letter.
 *   hw-letter-blank.y4m   clean paper, nothing written — red, nothing
 *                         captured.
 *   hw-letter-moving.y4m  the same R carried across the frame, a new
 *                         place every half second (adjacent positions
 *                         ≥190px apart, far over the steadiness bar of
 *                         4% of the frame = 51px) — every frame READS,
 *                         so the light may show green, but the steady
 *                         beat must never complete: a letter passing
 *                         through is never snapped mid-motion.
 *   hw-letter-then-gone.y4m  the moving R (never steady, so never
 *                         captured), then the bare desk — the view
 *                         reads, then stops reading, looping: drives
 *                         the light's real green→red hand-off so its
 *                         latency can be measured against the live loop.
 *   hw-noisy.y4m          a NOISY ROOM SCENE, no paper anywhere — the
 *                         scene shape of the field freeze. The
 *                         responsiveness checks sweep it and assert the
 *                         page never blocks and nothing is captured.
 *
 * hw-feeds.json carries each fixture's letter geometry (the ground
 * truth the auto-capture checks compare the kept glyph against) and a
 * VERSION stamp: the fixtures are regenerated whenever this generator
 * (or the composer it renders through) changes shape — allPresent()
 * refuses a stale set.
 *
 * Generated on demand, gitignored, never committed. Standalone (server
 * already running):
 *   BIA_PORT=9171 NODE_PATH=/opt/node22/lib/node_modules node test/make-hw-feeds.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COMPOSE } = require(path.join(__dirname, 'hw-fixture.js'));

const W = 1280, H = 960;
// 5 = the letter-grid redesign: single-letter fixtures replace the
// card fixtures wholesale. 6 = hw-letter-then-gone (the hand-off).
// 7 = hw-letter-tremor (a held letter with honest hand tremor).
// 8 = SENSOR NOISE on every frame, and no frame repeated: a real
// camera's consecutive frames always differ by sensor noise, and the
// live loop now refuses to count a byte-identical repeated frame
// toward the steady beat (a stalled feed is the same moment read
// twice — the rule the moving fixture's loop-seam capture forced).
// Static fixtures are three noisy takes of the same scene; every
// frame everywhere gets its own seeded noise.
// (A slow-carry y4m was tried for the net-displacement guard and
// dropped: Chromium's fake capture holds a frame across the file's
// loop seam — the held frame is now refused as a repeat, but a seam
// hold is still a pause, not a carry, so the slow carry is driven
// deterministically through HWLetterLive.verdict in the suite.)
const VERSION = 8;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const META = path.join(__dirname, 'hw-feeds.json');

const NAMES = ['hw-letter-R', 'hw-letter-i', 'hw-letter-two',
               'hw-letter-small', 'hw-letter-ruled', 'hw-letter-specks',
               'hw-letter-blank', 'hw-letter-moving',
               'hw-letter-then-gone', 'hw-letter-tremor', 'hw-noisy'];
const FILE = {};
for (const n of NAMES) FILE[n] = path.join(__dirname, n + '.y4m');

function allPresent() {
  const files = NAMES.map((n) => FILE[n]).concat([META]);
  if (!files.every((f) => fs.existsSync(f))) return false;
  try { return JSON.parse(fs.readFileSync(META, 'utf8')).version === VERSION; }
  catch (e) { return false; }
}

// RGB → YUV, BT.601 limited range, 4:2:0 — the same arithmetic as
// test/make-camera-feed.js, generalised to many frames and a chosen
// frame rate (the moving fixture plays at 2fps on purpose).
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

// Page-side: compose one letter frame and hand back raw RGBA (base64).
// noiseSeed adds this frame's own SENSOR NOISE (seeded, ±2 per pixel,
// applied equally to R/G/B so it survives the RGB→Y conversion): a
// real camera never sends the same bytes twice, and the live loop's
// repeated-frame rule depends on exactly that.
const FRAME = `(o, noiseSeed) => {
  const made = (${COMPOSE})(o);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = ${W}; c.height = ${H};
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const im = x.getImageData(0, 0, ${W}, ${H});
      const d = im.data;
      if (noiseSeed != null) {
        let s = noiseSeed | 0;
        const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        for (let i = 0; i < d.length; i += 4) {
          const n = ((rnd() * 5) | 0) - 2;
          d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
      }
      let s2 = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < d.length; i += CHUNK) {
        s2 += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
      }
      resolve({ b64: btoa(s2), letters: made.letters, size: made.size,
                paper: made.paper });
    };
    img.src = made.dataURL;
  });
}`;

/* Page-side: the noisy room scene — SEEDED (mulberry32-style, no
 * Math.random — the suite's hygiene check applies to fixtures), no
 * paper anywhere. Its shape is what made the field frame expensive:
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

// The moving letter's positions: adjacent steps (including the wrap
// from last back to first, since the file loops) are ≥190px apart —
// far over the steadiness bar (MOVE_FRAC 0.04 × 1280 = 51px).
const MOVING_CX = [300, 640, 980, 450, 820, 300, 980, 500];

/* THE HAND-TREMOR FIXTURE — a child HOLDING a big clear letter up, with
 * an honest hand: the letter TREMBLES around one place instead of
 * travelling anywhere. Seeded (mulberry32 — Math.random appears
 * nowhere): the offset is a pulled-back random walk (each frame keeps
 * ¾ of the last offset and adds a fresh ~N(0,42px) kick), so it
 * wanders tens of pixels and always comes home — tremble, not travel —
 * plus slight scale breathing (±4%) for the arm moving nearer and
 * farther. At 2fps a frame is ~one live-loop verdict apart, so the
 * per-frame steps ARE the per-verdict displacements the loop sees:
 * measured at generation and recorded in the meta (typically 15–110px
 * at 1280 width — regularly over the old 51px per-step bar, which is
 * exactly the field failure this fixture reproduces, and essentially
 * never over a whole letter width, which is what an honest carry
 * does). */
function tremorFrames() {
  let s = 97;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
  const frames = [];
  let ox = 0, oy = 0;
  for (let i = 0; i < 12; i++) {
    ox = Math.max(-95, Math.min(95, 0.75 * ox + gauss() * 42));
    oy = Math.max(-95, Math.min(95, 0.75 * oy + gauss() * 42));
    const breath = 1 + (rnd() - 0.5) * 0.08;
    frames.push({ seed: 50 + i, size: Math.round(430 * breath),
                  letters: [{ ch: 'R', cx: 640 + Math.round(ox),
                              cy: 480 + Math.round(oy) }] });
  }
  return frames;
}

// The fixtures, declaratively: composer opts + frame rate.
const FIXTURES = {
  'hw-letter-R':      { fps: 30, frames: [{ ch: 'R', seed: 5, size: 430 }] },
  'hw-letter-i':      { fps: 30, frames: [{ ch: 'i', seed: 6, size: 520 }] },
  'hw-letter-two':    { fps: 30, frames: [{ seed: 7, size: 300, letters: [
                          { ch: 'a', cx: 420, cy: 480 },
                          { ch: 'b', cx: 880, cy: 480 }] }] },
  'hw-letter-small':  { fps: 30, frames: [{ ch: 'e', seed: 8, size: 110 }] },
  'hw-letter-ruled':  { fps: 30, frames: [{ ch: 'a', seed: 9, size: 380, ruled: true }] },
  'hw-letter-specks': { fps: 30, frames: [{ ch: 'Q', seed: 10, size: 400, specks: 30 }] },
  'hw-letter-blank':  { fps: 30, frames: [{ seed: 11, letters: [] }] },
  'hw-letter-moving': { fps: 2, frames: MOVING_CX.map((cx, i) =>
                          ({ seed: 20 + i, size: 430,
                             letters: [{ ch: 'R', cx, cy: 480 }] })) },
  'hw-letter-then-gone': { fps: 2, frames:
      MOVING_CX.slice(0, 4).map((cx, i) =>
        ({ seed: 30 + i, size: 430, letters: [{ ch: 'R', cx, cy: 480 }] }))
      .concat([0, 1, 2, 3].map((i) =>
        ({ seed: 40 + i, letters: [], noPaper: true }))) },
  'hw-letter-tremor': { fps: 2, frames: tremorFrames() }
};

async function generate(base) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(base);
  await page.waitForFunction(() => window.__hw && window.__bia);

  const meta = { version: VERSION, W, H, fixtures: {} };
  let noiseAt = 9000;                      // every frame's own noise seed
  for (const [name, fix] of Object.entries(FIXTURES)) {
    const frames = [];
    const geoms = [];
    // A one-scene fixture is FIVE noisy takes of that scene — the same
    // held-up letter through a real sensor, never the same bytes
    // twice (five, so the 167ms cycle at 30fps shares no multiple
    // with any read spacing the measured 17–96ms analysis costs can
    // produce); a multi-frame fixture gets fresh noise per frame.
    const takes = fix.frames.length === 1
      ? Array.from({ length: 5 }, () => fix.frames[0])
      : fix.frames;
    for (const opts of takes) {
      const r = await page.evaluate(
        `(${FRAME})(${JSON.stringify(opts)}, ${noiseAt++})`);
      frames.push(Buffer.from(r.b64, 'base64'));
      geoms.push({ letters: r.letters, size: r.size });
    }
    fs.writeFileSync(FILE[name], y4mOf(frames, fix.fps));
    meta.fixtures[name] = { file: name + '.y4m', fps: fix.fps, geoms };
  }
  {
    const r = await page.evaluate(`(${NOISY_FRAME})()`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE['hw-noisy'], y4mOf([rgba, rgba], 30));
    meta.fixtures['hw-noisy'] = { file: 'hw-noisy.y4m', fps: 30 };
  }
  fs.writeFileSync(META, JSON.stringify(meta));
  await browser.close();
  return meta;
}

function readMeta() { return JSON.parse(fs.readFileSync(META, 'utf8')); }

module.exports = { generate, allPresent, readMeta, FILE, META, W, H,
                   VERSION, MOVING_CX };

if (require.main === module) {
  const port = process.env.BIA_PORT || 8765;
  generate('http://127.0.0.1:' + port + '/tools/bring-it-alive/').then((m) => {
    console.log('wrote ' + Object.keys(m.fixtures).length + ' fixtures beside ' + META);
  }).catch((e) => { console.error(e); process.exit(1); });
}
