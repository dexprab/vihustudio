/* CAMERA FEED FIXTURE — builds test/camera-feed-001.y4m, the file Chromium
 * serves as the fake camera (--use-file-for-fake-video-capture), so the
 * camera path can be verified END TO END against the real Test Case 001
 * drawing (tools/imagebed/1000299474.jpg).
 *
 * Geometry — documented, not arbitrary: a child holds the notebook page up
 * to a webcam, so the WHOLE PAGE is fitted into a 1280×960 (4:3) frame by
 * height — the portrait page pillar-boxes at 721×960 with a dim neutral
 * room (#232028) either side. Scale is 960/4624 = 0.20761 of the source
 * photograph, which is exactly the honesty this fixture exists for: the
 * effectiveness question is what a webcam-resolution look at the page
 * preserves versus the full-resolution upload.
 *
 * The suite maps source coordinates through the same constants:
 *   frame = [OFFSET_X + x * SCALE, y * SCALE]     (exported below)
 *
 * y4m because Chromium asks for it: uncompressed YUV4MPEG2, BT.601 limited
 * range, 4:2:0 (header C420). Two identical frames (Chromium loops the
 * file). ~3.7 MB — generated on demand, gitignored, never committed. The
 * JPEG is decoded by Chromium itself (the same decoder the page uses), the
 * RGBA comes back raw, and the RGB→YUV arithmetic lives here in Node where
 * it is auditable.
 *
 * TWO files come out of one composition:
 *   camera-feed-001.y4m — two IDENTICAL frames. The still-life the
 *     byte-comparison checks depend on (a capture now and a capture
 *     later must match to the byte).
 *   camera-feed-002.y4m — the same scene through a REAL camera's eyes:
 *     three frames, each with its own seeded ±2 sensor noise on the Y
 *     plane, so no two frames are ever byte-identical. The letter
 *     loop's steady beat requires a new frame to be a NEW frame (a
 *     repeated identical frame is a stalled feed and never counts), so
 *     any scenario that needs the AUTO-CAPTURE to fire from this scene
 *     must serve this file, not 001.
 *
 * Standalone: NODE_PATH=/opt/node22/lib/node_modules node test/make-camera-feed.js
 * The suite requires this module and generates the file if it is missing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const W = 1280, H = 960;
const SRC = path.resolve(__dirname, '..', '..', 'imagebed', '1000299474.jpg');
const OUT = path.join(__dirname, 'camera-feed-001.y4m');

// Source photograph is 3472×4624; fitted by height into the 4:3 frame.
const OUT2 = path.join(__dirname, 'camera-feed-002.y4m');

const SCALE = H / 4624;                             // 0.207612…
const PAGE_W = Math.round(3472 * SCALE);            // 721
const OFFSET_X = Math.round((W - PAGE_W) / 2);      // 280

/** Map a source-photograph [x, y] into the camera frame. */
function toFrame(p) { return [OFFSET_X + p[0] * SCALE, p[1] * SCALE]; }

async function generate(outPath) {
  const out = outPath || OUT;
  const { chromium } = require('playwright');
  const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(SRC).toString('base64');

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const b64 = await page.evaluate(async ({ url, W, H, PAGE_W, OFFSET_X }) => {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#232028';                 // the dim room behind the page
    x.fillRect(0, 0, W, H);
    x.imageSmoothingQuality = 'high';
    x.drawImage(bmp, OFFSET_X, 0, PAGE_W, H);
    const d = x.getImageData(0, 0, W, H).data;
    // raw RGBA back to Node in one base64 string (~6.5 MB)
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < d.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
    }
    return btoa(s);
  }, { url: dataUrl, W, H, PAGE_W, OFFSET_X });
  await browser.close();

  const rgba = Buffer.from(b64, 'base64');

  // RGB → YUV, BT.601 limited range (what Chromium assumes for C420).
  const Y = Buffer.alloc(W * H);
  const U = Buffer.alloc((W / 2) * (H / 2));
  const V = Buffer.alloc((W / 2) * (H / 2));
  const uf = new Float64Array(U.length);       // 2×2 chroma averages
  const vf = new Float64Array(V.length);
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

  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420\n`, 'ascii');
  const frameMark = Buffer.from('FRAME\n', 'ascii');
  const frame = Buffer.concat([frameMark, Y, U, V]);
  fs.writeFileSync(out, Buffer.concat([header, frame, frame])); // 2 frames; Chromium loops

  // camera-feed-002: the same scene, live — three frames, each with its
  // own seeded ±2 sensor noise on the Y plane (mulberry32; Math.random
  // appears nowhere), so no frame ever repeats byte-for-byte.
  const noisy = [header];
  for (let f = 0; f < 3; f++) {
    let s = 4200 + f;
    const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const Yn = Buffer.from(Y);
    for (let i = 0; i < Yn.length; i++) {
      const n = ((rnd() * 5) | 0) - 2;
      Yn[i] = Math.max(16, Math.min(235, Yn[i] + n));
    }
    noisy.push(frameMark, Yn, U, V);
  }
  fs.writeFileSync(OUT2, Buffer.concat(noisy));
  return out;
}

module.exports = { generate, toFrame, W, H, SCALE, OFFSET_X, OUT, OUT2 };

if (require.main === module) {
  generate().then((f) => {
    console.log('wrote ' + f + ' (' + fs.statSync(f).size + ' bytes)');
  }).catch((e) => { console.error(e); process.exit(1); });
}
