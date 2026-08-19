/* BRING IT ALIVE — verification suite.
 *
 * Drives the REAL page end to end with synthetic pointer events: loads a
 * photograph, draws claim loops with the mouse, paints Keep/Remove
 * strokes, presses the real buttons, and then asserts on what the page
 * actually produced — including decoding the exported PNG blob and
 * walking every fully-opaque pixel against an INDEPENDENTLY decoded copy
 * of the source (zero tolerance).
 *
 * Two fixtures:
 *   · the SURROGATE (test/surrogate-001.png) — deterministic, with
 *     per-element ground-truth ink masks, so coverage assertions are
 *     exact percentages over known pixels;
 *   · the REAL Test Case 001 (tools/imagebed/1000299474.jpg) — a child's
 *     actual notebook drawing photographed on red fabric. Real pencil is
 *     faint and unevenly lit, so coverage assertions are tolerant
 *     ("substantial here, near-zero there"); the preservation assertion
 *     stays zero-tolerance, because that rule has no tolerant version.
 *
 * v0.2 adds the MAKE IT YOURS section: the layered creation document
 * (ORIGINAL / EDITS / TRANSFORM) driven through the real editing canvas —
 * paint, erase, move, resize, rotate, undo/redo, PNG render, and the JSON
 * round trip — every equality a pixel-buffer comparison. The v0.1 checks
 * above it are regression: none were invalidated by the sprint (nothing
 * ever asserted the night sky); only the two v0.1 demo screenshots were
 * replaced by the sprint's five-shot demo.
 *
 * Run:
 *   node test/serve.js 8765 &
 *   NODE_PATH=/opt/node22/lib/node_modules node test/run-tests.js
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.BIA_PORT || 8765;
const BASE = `http://127.0.0.1:${PORT}/tools/bring-it-alive/`;
const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'surrogate-001.meta.json'), 'utf8'));
const REAL = path.resolve(__dirname, '..', '..', 'imagebed', '1000299474.jpg');
const SHOTS = path.resolve(__dirname, '..', 'screenshots');

// ---- Real-photo geometry (original 3472×4624 pixel space) -----------------
// Measured off the photograph with a grid overlay. Claims are loose loops a
// child would plausibly draw; inner boxes sit safely INSIDE each element so
// "the other character's ink" can never straddle a contested edge.
const R = {
  leftClaim: [[1170, 3060], [1400, 3110], [1560, 3260], [1640, 3390], [1620, 3520],
              [1580, 3660], [1530, 3830], [1400, 3930], [1150, 3960], [900, 3900],
              [760, 3760], [690, 3560], [680, 3350], [800, 3180], [980, 3080]],
  rightClaim: [[2700, 3100], [2950, 3160], [3120, 3300], [3160, 3480], [3120, 3650],
               [2980, 3790], [2750, 3860], [2520, 3830], [2380, 3720], [2330, 3560],
               [2340, 3400], [2450, 3240]],
  tableClaim: [[1950, 2960], [2180, 3020], [2300, 3200], [2330, 3450], [2335, 3700],
               [2380, 3950], [2380, 4120], [2200, 4190], [1900, 4200], [1650, 4150],
               [1560, 3950], [1560, 3700], [1580, 3450], [1650, 3200], [1780, 3020]],
  leftInner: { x: 950, y: 3250, w: 610, h: 550 },
  rightInner: { x: 2450, y: 3230, w: 600, h: 490 },
  cakeInner: { x: 1700, y: 3060, w: 580, h: 570 },
  groundBox: { x: 840, y: 3845, w: 680, h: 80 },
  groundStroke: [[860, 3885], [1000, 3880], [1150, 3878], [1300, 3882], [1480, 3888]]
};

// ---- tiny harness ---------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok  ' + name + (detail ? '  (' + detail + ')' : '')); }
  else { failed++; failures.push(name + (detail ? '  (' + detail + ')' : ''));
         console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : '')); }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 840 } });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

  await page.goto(BASE);
  await page.waitForFunction(() => window.__bia);

  // ---- in-page analysis helpers -------------------------------------------
  await page.evaluate(() => {
    window.__test = {
      _gt: {},
      async gt(name) {
        if (this._gt[name]) return name;
        const bmp = await createImageBitmap(await (await fetch('test/gt-' + name + '.png')).blob());
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(bmp, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const core = new Uint8Array(c.width * c.height);
        for (let i = 0; i < core.length; i++) if (d[i * 4 + 3] >= 200) core[i] = 1;
        this._gt[name] = core;
        return name;
      },
      // Ground-truth element coverage against the CURRENT segmentation mask.
      cover(name, opts) {
        const g = this._gt[name], seg = window.__bia.seg;
        const inside = (opts && opts.insideClaim) ? seg.claim.inside : null;
        let total = 0, inMask = 0;
        for (let i = 0; i < g.length; i++) {
          if (!g[i]) continue;
          if (inside && !inside[i]) continue;
          total++;
          if (seg.mask[i]) inMask++;
        }
        return { total, inMask, frac: total ? inMask / total : 0 };
      },
      // Detected-ink vs mask inside a rectangle (real photo: no per-element
      // ground truth exists, so relative statements use the page's own ink).
      box(b) {
        const seg = window.__bia.seg, w = seg.width;
        let ink = 0, inMask = 0, maskPx = 0;
        for (let y = b.y; y < b.y + b.h; y++) {
          for (let x = b.x; x < b.x + b.w; x++) {
            const i = y * w + x;
            if (seg.ink[i]) { ink++; if (seg.mask[i]) inMask++; }
            if (seg.mask[i]) maskPx++;
          }
        }
        return { ink, inMask, maskPx, frac: ink ? inMask / ink : 0 };
      },
      maskBBox() {
        const seg = window.__bia.seg, w = seg.width;
        let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
        for (let i = 0; i < seg.mask.length; i++) {
          if (!seg.mask[i]) continue;
          const x = i % w, y = (i / w) | 0;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        return { minX, minY, maxX, maxY };
      },
      // ---- creation-layer helpers (v0.2, MAKE IT YOURS) ---------------------
      _snaps: {},
      snapView(name) {
        const c = window.__bia.creation;
        this._snaps[name] = { data: new Uint8ClampedArray(c.view().data),
                              t: JSON.stringify(c.transform) };
      },
      // Exact byte comparison of the CURRENT view against a snapshot.
      cmpView(name) {
        const s = this._snaps[name], b = window.__bia.creation.view().data;
        if (!s || s.data.length !== b.length) return { mismatches: -1, transformSame: false };
        let mm = 0;
        for (let i = 0; i < s.data.length; i++) if (s.data[i] !== b[i]) mm++;
        return { mismatches: mm,
                 transformSame: s.t === JSON.stringify(window.__bia.creation.transform) };
      },
      // Tolerant comparison for canvas-PNG round trips: fully-opaque pixels
      // must be EXACT; the 1px feather ring (partial alpha) may round ±2 —
      // the preservation rule's stated exemption since v0.1.
      cmpViewTol(name) {
        const s = this._snaps[name], b = window.__bia.creation.view().data;
        if (!s || s.data.length !== b.length) return { opaqueMismatch: -1, farMismatch: -1 };
        let opaqueMismatch = 0, farMismatch = 0;
        for (let p = 0; p < s.data.length; p += 4) {
          let d = 0;
          for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(s.data[p + k] - b[p + k]));
          if (!d) continue;
          if (s.data[p + 3] === 255 && b[p + 3] === 255) opaqueMismatch++;
          else if (d > 2) farMismatch++;
        }
        return { opaqueMismatch, farMismatch };
      },
      viewVsOriginal() {
        const c = window.__bia.creation, a = c.view().data, o = c.original.data;
        let mm = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== o[i]) mm++;
        return mm;
      },
      viewAt(x, y) {
        const c = window.__bia.creation, w = c.original.width;
        const p = (Math.round(y) * w + Math.round(x)) * 4, d = c.view().data;
        return [d[p], d[p + 1], d[p + 2], d[p + 3]];
      },
      // THE creation-level walk: every fully-opaque pixel of the ORIGINAL
      // layer byte-identical to an independently decoded source photograph.
      async originalWalk(sourceUrl) {
        const c = window.__bia.creation;
        if (!this._srcCache) this._srcCache = {};
        if (!this._srcCache[sourceUrl]) {
          const bmp = await createImageBitmap(await (await fetch(sourceUrl)).blob());
          const cv = document.createElement('canvas');
          cv.width = bmp.width; cv.height = bmp.height;
          const x = cv.getContext('2d', { willReadFrequently: true });
          x.drawImage(bmp, 0, 0);
          this._srcCache[sourceUrl] =
            { d: x.getImageData(0, 0, cv.width, cv.height).data, w: cv.width };
        }
        const src = this._srcCache[sourceUrl];
        const d = c.original.data, crop = c.crop;
        let opaque = 0, mismatches = 0;
        for (let y = 0; y < crop.h; y++) {
          for (let x = 0; x < crop.w; x++) {
            const ai = (y * crop.w + x) * 4;
            if (d[ai + 3] !== 255) continue;
            opaque++;
            const si = ((crop.y + y) * src.w + (crop.x + x)) * 4;
            if (d[ai] !== src.d[si] || d[ai + 1] !== src.d[si + 1] ||
                d[ai + 2] !== src.d[si + 2]) mismatches++;
          }
        }
        return { opaque, mismatches };
      },
      renderInfo() {
        const r = window.__bia.creation.render();
        return { w: r.canvas.width, h: r.canvas.height, bounds: r.bounds };
      },
      _renderBytes() {
        const r = window.__bia.creation.render();
        return { data: r.canvas.getContext('2d')
                        .getImageData(0, 0, r.canvas.width, r.canvas.height).data,
                 w: r.canvas.width, h: r.canvas.height };
      },
      snapRender(name) {
        const r = this._renderBytes();
        this._snaps['render:' + name] =
          { data: new Uint8ClampedArray(r.data), w: r.w, h: r.h };
      },
      cmpRender(name) {
        const s = this._snaps['render:' + name], r = this._renderBytes();
        if (!s || s.w !== r.w || s.h !== r.h)
          return { mismatches: -1, dims: r.w + 'x' + r.h + ' vs ' + (s ? s.w + 'x' + s.h : '?') };
        let mm = 0;
        for (let i = 0; i < s.data.length; i++) if (s.data[i] !== r.data[i]) mm++;
        return { mismatches: mm, dims: r.w + 'x' + r.h };
      },
      // Download PNG is a RENDER of the current view: encode it, decode it
      // back, and compare against the render — opaque exact, feather ±2.
      async pngRendersCurrentView() {
        const r = window.__bia.creation.render();
        const ref = r.canvas.getContext('2d')
          .getImageData(0, 0, r.canvas.width, r.canvas.height).data;
        const blob = await new Promise((res) => r.canvas.toBlob(res, 'image/png'));
        const bmp = await createImageBitmap(blob);
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        const x = cv.getContext('2d', { willReadFrequently: true });
        x.drawImage(bmp, 0, 0);
        const dec = x.getImageData(0, 0, cv.width, cv.height).data;
        if (bmp.width !== r.canvas.width || bmp.height !== r.canvas.height)
          return { dimsMatch: false, opaqueMismatch: -1, farMismatch: -1 };
        let opaqueMismatch = 0, farMismatch = 0;
        for (let p = 0; p < ref.length; p += 4) {
          let d = 0;
          for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(ref[p + k] - dec[p + k]));
          if (!d) continue;
          if (ref[p + 3] === 255 && dec[p + 3] === 255) opaqueMismatch++;
          else if (d > 2) farMismatch++;
        }
        return { dimsMatch: true, opaqueMismatch, farMismatch, pngBytes: blob.size };
      },
      // THE halo measurement, old vs new in the same run: re-extract the
      // CURRENT claim with v0.1's unconditional dilation, and count the
      // fraction of fully-opaque pixels that sit at paper brightness
      // (within 12 luminance of their own local paper estimate).
      halo() {
        const st = window.__bia, seg = st.seg;
        const oldAsset = BIAExtract.extract(st.photo, seg.mask); // v0.1 path: no support plane
        const measure = (asset) => {
          const d = asset.imageData.data, cw = asset.crop.w;
          let opaque = 0, paperish = 0;
          for (let y = 0; y < asset.crop.h; y++) {
            for (let x = 0; x < cw; x++) {
              const i4 = (y * cw + x) * 4;
              if (d[i4 + 3] !== 255) continue;
              opaque++;
              const gi = (asset.crop.y + y) * seg.width + (asset.crop.x + x);
              if (seg.paper[gi] - seg.lum[gi] < 12) paperish++;
            }
          }
          return { opaque, paperish, frac: opaque ? paperish / opaque : 0 };
        };
        return { old: measure(oldAsset), neu: measure(st.asset) };
      },
      // Document-space spots for gesture targets. 'ink': a fully-opaque dark
      // original pixel away from the edges. 'clear': a transparent pixel
      // with clear space around it, for painting on nothing.
      findSpot(kind, margin) {
        const c = window.__bia.creation, w = c.original.width, h = c.original.height;
        const d = c.original.data, m = margin || 24;
        const clearAround = (x, y, r) => {
          for (let yy = y - r; yy <= y + r; yy += 2) for (let xx = x - r; xx <= x + r; xx += 2) {
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
            if (d[(yy * w + xx) * 4 + 3] !== 0) return false;
          }
          return true;
        };
        for (let y = m; y < h - m; y += 3) {
          for (let x = m; x < w - m; x += 3) {
            const p = (y * w + x) * 4;
            if (kind === 'ink') {
              if (d[p + 3] === 255 &&
                  ((d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8) < 120) return [x, y];
            } else if (kind === 'clear') {
              if (clearAround(x, y, m)) return [x, y];
            }
          }
        }
        return null;
      },

      // THE zero-tolerance walk: decode the exported blob AND an independent
      // copy of the source, compare every fully-opaque pixel's RGBA.
      async preservation(sourceUrl) {
        const exp = window.__bia.lastExport;
        const crop = exp.sidecar.crop;
        const dec = async (blob) => {
          const bmp = await createImageBitmap(blob);
          const c = document.createElement('canvas');
          c.width = bmp.width; c.height = bmp.height;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(bmp, 0, 0);
          return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
        };
        const asset = await dec(exp.blob);
        const src = await dec(await (await fetch(sourceUrl)).blob());
        let opaque = 0, mismatches = 0, first = null;
        for (let y = 0; y < asset.h; y++) {
          for (let x = 0; x < asset.w; x++) {
            const ai = (y * asset.w + x) * 4;
            if (asset.d[ai + 3] !== 255) continue;
            opaque++;
            const si = ((crop.y + y) * src.w + (crop.x + x)) * 4;
            if (asset.d[ai] !== src.d[si] || asset.d[ai + 1] !== src.d[si + 1] ||
                asset.d[ai + 2] !== src.d[si + 2]) {
              mismatches++;
              if (!first) first = { x, y, got: [asset.d[ai], asset.d[ai + 1], asset.d[ai + 2]],
                                    want: [src.d[si], src.d[si + 1], src.d[si + 2]] };
            }
          }
        }
        return { opaque, mismatches, first, w: asset.w, h: asset.h, crop };
      }
    };
  });

  // ---- pointer-event drivers ----------------------------------------------
  async function canvasMap(id) {
    const box = await page.locator('#' + id).boundingBox();
    const scale = await page.evaluate(() => window.__bia.displayScale);
    return ([ix, iy]) => [box.x + ix * scale, box.y + iy * scale];
  }
  async function drawLoop(points) {
    const map = await canvasMap('claimCanvas');
    const [sx, sy] = map(points[0]);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (const p of points) { const [x, y] = map(p); await page.mouse.move(x, y); }
    const [ex, ey] = map(points[0]);
    await page.mouse.move(ex, ey);
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector('#stepRefine').classList.contains('here') ||
      document.querySelector('#nothingFound').style.display === 'block');
  }
  async function drawLoopForShot(points) {
    // Same as drawLoop but pauses before releasing, for the CLAIM screenshot.
    const map = await canvasMap('claimCanvas');
    const [sx, sy] = map(points[0]);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (const p of points) { const [x, y] = map(p); await page.mouse.move(x, y); }
    const [ex, ey] = map(points[0]);
    await page.mouse.move(ex, ey);
    await page.screenshot({ path: path.join(SHOTS, '2-claim.png') });
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector('#stepRefine').classList.contains('here') ||
      document.querySelector('#nothingFound').style.display === 'block');
  }
  async function strokeOn(mode, points) {
    await page.click(mode === 'keep' ? '#keepBtn' : '#removeBtn');
    const map = await canvasMap('refineCanvas');
    const marksBefore = await page.evaluate(() => window.__bia.marks.length);
    const [sx, sy] = map(points[0]);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (const p of points) { const [x, y] = map(p); await page.mouse.move(x, y); }
    await page.mouse.up();
    await page.waitForFunction((n) => window.__bia.marks.length > n, marksBefore);
  }
  async function bringAlive() {
    const before = await page.evaluate(() => window.__bia.exports.length);
    await page.click('#aliveBtn');
    await page.waitForFunction((n) => window.__bia.exports.length > n, before, { timeout: 60000 });
  }
  async function anotherClaim() {
    await page.click('#anotherBtn');
    await page.waitForFunction(() => document.querySelector('#stepClaim').classList.contains('here'));
  }
  async function newPhotoFromAlive() {
    await page.click('#aliveNewPhoto');
  }
  const seg = () => page.evaluate(() => ({
    comps: window.__bia.seg.compCount, mask: window.__bia.seg.maskCount
  }));

  // ---- MAKE IT YOURS gesture drivers ---------------------------------------
  // A paint/erase stroke on the REAL editing canvas: document-space points
  // are mapped through the editor's own transform to screen, then driven
  // with pointer events exactly as a child's hand would.
  async function editStroke(toolBtn, docPoints) {
    await page.click('#' + toolBtn);
    const eb = await page.locator('#editCanvas').boundingBox();
    const pts = await page.evaluate((dp) =>
      dp.map((p) => BIAEditor.docToScreen(p[0], p[1])), docPoints);
    const before = await page.evaluate(() => window.__bia.creation.cursor);
    await page.mouse.move(eb.x + pts[0][0], eb.y + pts[0][1]);
    await page.mouse.down();
    for (const p of pts) await page.mouse.move(eb.x + p[0], eb.y + p[1]);
    await page.mouse.up();
    await page.waitForFunction((n) => window.__bia.creation.cursor > n, before);
  }
  // A move drag from the middle of the editing canvas.
  async function editDrag(dx, dy) {
    await page.click('#toolMove');
    const eb = await page.locator('#editCanvas').boundingBox();
    const cx = eb.x + eb.width / 2, cy = eb.y + eb.height / 2;
    const before = await page.evaluate(() => window.__bia.creation.cursor);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction((n) => window.__bia.creation.cursor > n, before);
  }
  const creationState = () => page.evaluate(() => ({
    ops: window.__bia.creation.ops.length,
    cursor: window.__bia.creation.cursor,
    transform: Object.assign({}, window.__bia.creation.transform)
  }));

  // ==========================================================================
  console.log('\n== SURROGATE 001 =========================================');
  await page.click('#testBtn');
  await page.waitForFunction(() => document.querySelector('#stepClaim').classList.contains('here'),
    null, { timeout: 30000 });
  for (const n of ['left', 'right', 'line', 'writing']) await page.evaluate((n) => window.__test.gt(n), n);

  // ---- 001A: the left character -------------------------------------------
  console.log('\n-- 001A: claim the left character');
  await drawLoop(META.claims.left);
  check('001A reaches refine', await page.locator('#stepRefine.here').count() === 1);
  let cl = await page.evaluate(() => window.__test.cover('left'));
  let cr = await page.evaluate(() => window.__test.cover('right'));
  check('001A ≥95% of left character ink in mask', cl.frac >= 0.95,
    (cl.frac * 100).toFixed(1) + '% of ' + cl.total);
  check('001A <1% of right object ink in mask', cr.frac < 0.01,
    (cr.frac * 100).toFixed(2) + '%');
  await bringAlive();
  let pres = await page.evaluate(() => window.__test.preservation('test/surrogate-001.png'));
  check('001A preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked' + (pres.first ? ' first=' + JSON.stringify(pres.first) : ''));
  check('001A opaque pixels exist', pres.opaque > 1000, String(pres.opaque));
  let bb = await page.evaluate(() => window.__test.maskBBox());
  check('001A crop is source-resolution bbox (no scaling)',
    pres.crop.w >= (bb.maxX - bb.minX + 1) && pres.crop.w <= (bb.maxX - bb.minX + 7) &&
    pres.crop.h >= (bb.maxY - bb.minY + 1) && pres.crop.h <= (bb.maxY - bb.minY + 7) &&
    pres.w === pres.crop.w && pres.h === pres.crop.h,
    pres.w + 'x' + pres.h + ' vs mask bbox ' + (bb.maxX - bb.minX + 1) + 'x' + (bb.maxY - bb.minY + 1));

  // ---- 001B: the right object ---------------------------------------------
  console.log('\n-- 001B: claim the right object');
  await anotherClaim();
  await drawLoop(META.claims.right);
  cr = await page.evaluate(() => window.__test.cover('right'));
  cl = await page.evaluate(() => window.__test.cover('left'));
  check('001B ≥95% of right object ink in mask', cr.frac >= 0.95,
    (cr.frac * 100).toFixed(1) + '% of ' + cr.total);
  check('001B <1% of left character ink in mask', cl.frac < 0.01,
    (cl.frac * 100).toFixed(2) + '%');
  await bringAlive();
  pres = await page.evaluate(() => window.__test.preservation('test/surrogate-001.png'));
  check('001B preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked');

  // ---- 001C: two independent assets ---------------------------------------
  console.log('\n-- 001C: two claims → two independent assets');
  const two = await page.evaluate(() => {
    const e = window.__bia.exports;
    return { n: e.length,
             sizes: e.map((x) => x.blob.size),
             crops: e.map((x) => JSON.stringify(x.sidecar.crop)) };
  });
  check('001C two assets exported', two.n === 2, two.sizes.join(', ') + ' bytes');
  check('001C assets are independent (different crops)', two.crops[0] !== two.crops[1],
    two.crops.join(' vs '));

  // ---- 001D: the connecting line, Remove then Keep ------------------------
  console.log('\n-- 001D: the connecting line stub, Remove then Keep');
  await anotherClaim();
  await drawLoop(META.claims.left);
  let stub = await page.evaluate(() => window.__test.cover('line', { insideClaim: true }));
  check('001D stub of the connecting line is in the initial mask', stub.frac >= 0.6,
    (stub.frac * 100).toFixed(1) + '% of ' + stub.total + ' stub px');
  // Remove: stroke along the stub, from just past the hand to past the loop.
  const stubPath = META.linePath.filter((p) => p[0] >= 595 && p[0] <= 760);
  await strokeOn('remove', stubPath);
  let lineAfter = await page.evaluate(() => window.__test.cover('line'));
  check('001D remove stroke takes the line out of the mask', lineAfter.inMask <= 80,
    lineAfter.inMask + ' line px left in mask');
  cl = await page.evaluate(() => window.__test.cover('left'));
  check('001D the character survives the remove stroke', cl.frac >= 0.92,
    (cl.frac * 100).toFixed(1) + '%');
  // Keep: stroke along the WHOLE line, including far outside the claim —
  // stopping short of the house, because the brush is a disc: a stroke
  // ending at the wall would physically paint wall pixels, and the child
  // is keeping the LINE.
  const fullPath = META.linePath.filter((p) => p[0] <= 1050);
  await strokeOn('keep', fullPath);
  lineAfter = await page.evaluate(() => window.__test.cover('line'));
  check('001D keep stroke brings the line back, including outside the claim',
    lineAfter.frac >= 0.85, (lineAfter.frac * 100).toFixed(1) + '% of ' + lineAfter.total);
  cr = await page.evaluate(() => window.__test.cover('right'));
  check('001D keep does not drag the right object in', cr.frac < 0.05,
    (cr.frac * 100).toFixed(2) + '%');
  await bringAlive();
  pres = await page.evaluate(() => window.__test.preservation('test/surrogate-001.png'));
  check('001D preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked');

  // ---- failure honesty: blank page ----------------------------------------
  console.log('\n-- failure honesty: blank image, claim with no ink');
  const blankBuf = Buffer.from((await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 600);
    return c.toDataURL('image/png');
  })).split(',')[1], 'base64');
  await newPhotoFromAlive();
  const exportsBefore = await page.evaluate(() => window.__bia.exports.length);
  await page.setInputFiles('#fileInput', { name: 'blank.png', mimeType: 'image/png', buffer: blankBuf });
  await page.waitForFunction(() => window.__bia.photo && window.__bia.photo.filename === 'blank.png');
  await drawLoop([[200, 150], [600, 150], [600, 450], [200, 450]]);
  const nothing = await page.evaluate(() => ({
    shown: document.querySelector('#nothingFound').style.display === 'block',
    text: document.querySelector('#nothingFound').textContent,
    onClaim: document.querySelector('#stepClaim').classList.contains('here'),
    logHasIt: document.querySelector('#devLog').textContent.includes('NOTHING FOUND'),
    exportsNow: window.__bia.exports.length
  }));
  check('blank: the UI says it found nothing', nothing.shown && nothing.text.length > 10,
    JSON.stringify(nothing.text.slice(0, 60)));
  check('blank: developer log records NOTHING FOUND', nothing.logHasIt);
  check('blank: no asset was produced', nothing.exportsNow === exportsBefore &&
    nothing.onClaim);

  // ==========================================================================
  console.log('\n== REAL TEST CASE 001 (tools/imagebed/1000299474.jpg) =====');
  const realBuf = fs.readFileSync(REAL);
  await page.setInputFiles('#fileInput',
    { name: '1000299474.jpg', mimeType: 'image/jpeg', buffer: realBuf });
  await page.waitForFunction(() =>
    window.__bia.photo && window.__bia.photo.filename === '1000299474.jpg', null, { timeout: 60000 });
  await page.screenshot({ path: path.join(SHOTS, '1-before.png') });

  // ---- R-001A: left character (loose — catches the ground line stub) ------
  console.log('\n-- R-001A: claim the left character');
  await drawLoopForShot(R.leftClaim);
  check('R-001A reaches refine', await page.locator('#stepRefine.here').count() === 1);
  let s = await seg();
  console.log('     (real photo: ' + s.comps + ' ink components, mask ' + s.mask + ' px)');
  let li = await page.evaluate((b) => window.__test.box(b), R.leftInner);
  let ri = await page.evaluate((b) => window.__test.box(b), R.rightInner);
  let ci = await page.evaluate((b) => window.__test.box(b), R.cakeInner);
  check('R-001A substantial left-character ink in mask', li.frac >= 0.6 && li.inMask > 8000,
    (li.frac * 100).toFixed(1) + '% of ' + li.ink + ' detected ink px');
  check('R-001A near-zero right-character ink in mask', ri.frac < 0.01,
    (ri.frac * 100).toFixed(2) + '% of ' + ri.ink);
  check('R-001A near-zero cake/table ink in mask', ci.frac < 0.01,
    (ci.frac * 100).toFixed(2) + '% of ' + ci.ink);
  await bringAlive();
  pres = await page.evaluate(() =>
    window.__test.preservation('/tools/imagebed/1000299474.jpg'));
  check('R-001A preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked' + (pres.first ? ' first=' + JSON.stringify(pres.first) : ''));
  check('R-001A asset at source resolution', pres.w === pres.crop.w && pres.h === pres.crop.h,
    pres.w + 'x' + pres.h);
  // (The v0.1 demo shots 3-after/4-preservation are retired with the night
  //  sky; the sprint's five-shot demo is taken in the MAKE IT YOURS section.)

  // ---- R-001B: right character --------------------------------------------
  console.log('\n-- R-001B: claim the right character');
  await anotherClaim();
  await drawLoop(R.rightClaim);
  li = await page.evaluate((b) => window.__test.box(b), R.leftInner);
  ri = await page.evaluate((b) => window.__test.box(b), R.rightInner);
  ci = await page.evaluate((b) => window.__test.box(b), R.cakeInner);
  check('R-001B substantial right-character ink in mask', ri.frac >= 0.6 && ri.inMask > 5000,
    (ri.frac * 100).toFixed(1) + '% of ' + ri.ink);
  check('R-001B near-zero left-character ink in mask', li.frac < 0.01,
    (li.frac * 100).toFixed(2) + '%');
  check('R-001B near-zero cake/table ink in mask', ci.frac < 0.02,
    (ci.frac * 100).toFixed(2) + '% of ' + ci.ink);
  await bringAlive();
  pres = await page.evaluate(() =>
    window.__test.preservation('/tools/imagebed/1000299474.jpg'));
  check('R-001B preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked');

  // ---- R-001B2: the table with the burnt cake ------------------------------
  console.log('\n-- R-001B2: claim the table with the burnt cake');
  await anotherClaim();
  await drawLoop(R.tableClaim);
  li = await page.evaluate((b) => window.__test.box(b), R.leftInner);
  ri = await page.evaluate((b) => window.__test.box(b), R.rightInner);
  ci = await page.evaluate((b) => window.__test.box(b), R.cakeInner);
  check('R-001B2 substantial cake/table ink in mask', ci.frac >= 0.6 && ci.inMask > 10000,
    (ci.frac * 100).toFixed(1) + '% of ' + ci.ink);
  check('R-001B2 near-zero left-character ink', li.frac < 0.01, (li.frac * 100).toFixed(2) + '%');
  check('R-001B2 near-zero right-character ink', ri.frac < 0.01, (ri.frac * 100).toFixed(2) + '%');
  await bringAlive();
  pres = await page.evaluate(() =>
    window.__test.preservation('/tools/imagebed/1000299474.jpg'));
  check('R-001B2 preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked');

  // ---- R-001C: independence ------------------------------------------------
  const realExports = await page.evaluate(() => {
    const e = window.__bia.exports.slice(-3);
    return e.map((x) => JSON.stringify(x.sidecar.crop));
  });
  check('R-001C three independent real assets (distinct crops)',
    new Set(realExports).size === 3, realExports.join(' · '));

  // ---- R-001D: the ground line under the left character --------------------
  console.log('\n-- R-001D: the ground line, Remove then Keep');
  await anotherClaim();
  await drawLoop(R.leftClaim);
  const g0 = await page.evaluate((b) => window.__test.box(b), R.groundBox);
  console.log('     (ground box: ' + g0.ink + ' detected ink px, ' + g0.maskPx + ' in mask before strokes)');
  await strokeOn('remove', R.groundStroke);
  const g1 = await page.evaluate((b) => window.__test.box(b), R.groundBox);
  check('R-001D remove stroke clears the ground line from the mask', g1.maskPx <= Math.max(50, g0.maskPx * 0.05),
    g0.maskPx + ' → ' + g1.maskPx + ' mask px in ground box');
  li = await page.evaluate((b) => window.__test.box(b), R.leftInner);
  check('R-001D the character survives the remove stroke', li.frac >= 0.55,
    (li.frac * 100).toFixed(1) + '%');
  await strokeOn('keep', R.groundStroke);
  const g2 = await page.evaluate((b) => window.__test.box(b), R.groundBox);
  check('R-001D keep stroke brings the ground line back', g2.maskPx >= g1.maskPx + 200,
    g1.maskPx + ' → ' + g2.maskPx + ' mask px in ground box');
  await bringAlive();
  pres = await page.evaluate(() =>
    window.__test.preservation('/tools/imagebed/1000299474.jpg'));
  check('R-001D preservation: zero mismatched opaque pixels', pres.mismatches === 0,
    pres.opaque + ' opaque walked');

  // ==========================================================================
  // MAKE IT YOURS — the layered creation (v0.2). Everything below drives the
  // REAL editing canvas with pointer events on the REAL photograph, and every
  // equality is a pixel-buffer comparison, never a counter.
  console.log('\n== MAKE IT YOURS — the layered creation ===================');
  await anotherClaim();
  await drawLoop(R.leftClaim);
  await bringAlive();
  await page.locator('#yoursTools').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, '3-extracted.png') });

  // ---- Y0: MARK 1 deskew is measured, and its no-op is disclosed -----------
  const devlog = await page.evaluate(() => document.querySelector('#devLog').textContent);
  check('Y0 MARK 1: deskew measures the page and discloses its no-op',
    devlog.includes('deskew: page found') && devlog.includes('deskew: no-op'));

  // ---- Y1: the final step is an editing canvas, not a sky ------------------
  const y1 = await page.evaluate(() => ({
    creation: !!window.__bia.creation,
    sky: !!document.getElementById('skyCanvas'),
    edit: !!document.getElementById('editCanvas'),
    onStep: document.querySelector('#stepAlive').classList.contains('here'),
    opsLine: document.querySelector('#devOps').textContent
  }));
  check('Y1 the creation document exists on Make It Yours', y1.creation && y1.onStep && y1.edit);
  check('Y1 the night-sky preview is gone from the final step', !y1.sky);
  check('Y1 developer strip shows the layer stack and op history',
    y1.opsLine.includes('original') && y1.opsLine.includes('erase mask') &&
    /history 0\/0 ops/.test(y1.opsLine), JSON.stringify(y1.opsLine.slice(0, 80)));

  // ---- Y2: the ghost check ---------------------------------------------------
  // The initial view must BE the original extraction — full pencil darkness,
  // full alpha, nothing composited underneath. Byte equality is the whole
  // assertion: any ghosting, glow or background would be a differing byte.
  const y2 = await page.evaluate(() => {
    const d = window.__bia.creation.view().data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] === 255) opaque++;
    return { mm: window.__test.viewVsOriginal(), opaque };
  });
  check('Y2 no ghost: initial view is byte-identical to the ORIGINAL layer', y2.mm === 0);
  check('Y2 strokes are at full alpha (no semi-transparent rendering)', y2.opaque > 10000,
    y2.opaque + ' fully-opaque px');

  // ---- Y3: the paper halo, measured old vs new in the same run --------------
  const halo = await page.evaluate(() => window.__test.halo());
  const pc = (v) => (v * 100).toFixed(2) + '%';
  check('Y3 paper-rim fraction dropped materially vs the v0.1 extraction',
    halo.neu.frac <= halo.old.frac * 0.6,
    'v0.1 ' + pc(halo.old.frac) + ' of ' + halo.old.opaque + ' opaque px → v0.2 ' +
    pc(halo.neu.frac) + ' of ' + halo.neu.opaque);

  // ---- Y4: THE NON-NEGOTIABLE PRESERVATION TEST ------------------------------
  // Paint over it. Move it. Resize it. Undo. Is the original still exactly
  // there? — answered with byte comparisons against the source photograph.
  console.log('\n-- Y4: paint it, move it, resize it, undo — is the original still there?');
  await page.evaluate(() => { window.__test.snapView('v0'); window.__test.snapRender('r0'); });
  const dims = await page.evaluate(() => ({
    w: window.__bia.creation.original.width, h: window.__bia.creation.original.height }));
  await page.locator('button.swatch[data-color="#e5484d"]').click();
  await editStroke('toolPaint', [[dims.w * 0.25, dims.h * 0.5], [dims.w * 0.75, dims.h * 0.5]]);
  await page.screenshot({ path: path.join(SHOTS, '4-painted.png') });
  const y4a = await page.evaluate(async (d) => ({
    changed: window.__test.cmpView('v0').mismatches,
    at: window.__test.viewAt(d.w * 0.5, d.h * 0.5),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }), dims);
  check('Y4 a paint stroke changes the current view', y4a.changed > 1000,
    y4a.changed + ' bytes differ');
  check('Y4 paint lands at full alpha in the chosen colour',
    y4a.at[0] === 229 && y4a.at[1] === 72 && y4a.at[2] === 77 && y4a.at[3] === 255,
    'rgba(' + y4a.at.join(',') + ')');
  check('Y4 paint never touches the ORIGINAL layer (byte-identical to the photograph)',
    y4a.walk.mismatches === 0 && y4a.walk.opaque > 10000,
    y4a.walk.opaque + ' opaque px walked');

  const r0 = await page.evaluate(() => window.__test.renderInfo());
  await editDrag(48, 30);
  const r1 = await page.evaluate(() => window.__test.renderInfo());
  check('Y4 move changes the render geometry',
    r1.bounds.x !== r0.bounds.x && r1.bounds.y !== r0.bounds.y,
    'origin (' + r0.bounds.x + ',' + r0.bounds.y + ') → (' + r1.bounds.x + ',' + r1.bounds.y + ')');
  await page.click('#biggerBtn');
  await page.waitForFunction(() => window.__bia.creation.cursor === 3);
  const r2 = await page.evaluate(() => window.__test.renderInfo());
  check('Y4 resize changes the render geometry', r2.w > r1.w && r2.h > r1.h,
    r1.w + 'x' + r1.h + ' → ' + r2.w + 'x' + r2.h);
  await page.evaluate(() => window.__test.snapView('v3'));

  await page.evaluate(() => { BIAEditor.undo(); BIAEditor.undo(); BIAEditor.undo(); });
  const y4b = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('v0'),
    render: window.__test.cmpRender('r0'),
    vsOrig: window.__test.viewVsOriginal(),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg'),
    cursor: window.__bia.creation.cursor
  }));
  check('Y4 THE ANSWER — after undo the original is exactly there',
    y4b.cmp.mismatches === 0 && y4b.cmp.transformSame && y4b.vsOrig === 0 &&
    y4b.walk.mismatches === 0,
    y4b.walk.opaque + ' opaque px byte-identical to the source photograph');
  check('Y4 the render after undo equals the original render, byte for byte',
    y4b.render.mismatches === 0, y4b.render.dims);
  await page.screenshot({ path: path.join(SHOTS, '5-original-recovered.png') });

  await page.evaluate(() => { BIAEditor.redo(); BIAEditor.redo(); BIAEditor.redo(); });
  const y4c = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('v3'),
    png: await window.__test.pngRendersCurrentView()
  }));
  check('Y4 redo restores the edited state exactly',
    y4c.cmp.mismatches === 0 && y4c.cmp.transformSame);
  check('Y4 the exported PNG is a render of the CURRENT view',
    y4c.png.dimsMatch && y4c.png.opaqueMismatch === 0 && y4c.png.farMismatch === 0,
    'png ' + y4c.png.pngBytes + ' bytes, opaque exact, feather ±2');

  // ---- Y5: erase-over-original hides, never destroys -------------------------
  console.log('\n-- Y5: erase hides the original; undo brings it back exactly');
  await page.evaluate(() => { BIAEditor.undo(); BIAEditor.undo(); }); // back to paint-only, identity transform
  const spot = await page.evaluate(() => {
    const c = window.__bia.creation;
    const pd = c.paintCtx.getImageData(0, 0, c.original.width, c.original.height).data;
    const w = c.original.width;
    // an opaque dark original pixel with NO paint within 28px, so the erase
    // lands on bare drawing
    let s = null;
    for (let y = 40; y < c.original.height - 40 && !s; y += 3) {
      for (let x = 40; x < w - 40; x += 3) {
        const p = (y * w + x) * 4;
        if (c.original.data[p + 3] !== 255) continue;
        const L = (c.original.data[p] * 77 + c.original.data[p + 1] * 150 +
                   c.original.data[p + 2] * 29) >> 8;
        if (L >= 120) continue;
        let clean = true;
        for (const [dx, dy] of [[0, 0], [-28, 0], [28, 0], [0, -28], [0, 28]]) {
          if (pd[((y + dy) * w + (x + dx)) * 4 + 3] !== 0) { clean = false; break; }
        }
        if (clean) { s = [x, y]; break; }
      }
    }
    return s;
  });
  check('Y5 found a bare dark original pixel to erase over', !!spot, JSON.stringify(spot));
  await page.evaluate(() => window.__test.snapView('v5pre'));
  await editStroke('toolErase', [[spot[0] - 12, spot[1]], [spot[0] + 12, spot[1]]]);
  const y5 = await page.evaluate(async (s) => ({
    at: window.__test.viewAt(s[0], s[1]),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }), spot);
  check('Y5 erase hides the original pixel in the view (alpha 0)', y5.at[3] === 0,
    'rgba(' + y5.at.join(',') + ')');
  check('Y5 the hidden pixels are NOT destroyed — ORIGINAL still byte-identical',
    y5.walk.mismatches === 0);
  await page.evaluate(() => BIAEditor.undo());
  const y5b = await page.evaluate((s) => ({
    cmp: window.__test.cmpView('v5pre'), at: window.__test.viewAt(s[0], s[1])
  }), spot);
  check('Y5 undo brings the hidden pixels back exactly',
    y5b.cmp.mismatches === 0 && y5b.at[3] === 255);

  // ---- Y6: erasing PAINT removes paint, and only paint ------------------------
  console.log('\n-- Y6: erasing paint removes paint, not the drawing');
  const clear = await page.evaluate(() => {
    // Clear of the ORIGINAL and clear of any existing PAINT, so the only
    // thing this paint-then-erase pair can touch is itself.
    const c = window.__bia.creation, w = c.original.width, h = c.original.height;
    const pd = c.paintCtx.getImageData(0, 0, w, h).data;
    const od = c.original.data, m = 30;
    outer:
    for (let y = m; y < h - m; y += 3) {
      for (let x = m; x < w - m; x += 3) {
        let ok = true;
        for (let yy = y - m; yy <= y + m && ok; yy += 2) {
          for (let xx = x - m; xx <= x + m; xx += 2) {
            const a = (yy * w + xx) * 4 + 3;
            if (od[a] !== 0 || pd[a] !== 0) { ok = false; break; }
          }
        }
        if (ok) return [x, y];
      }
    }
    return null;
  });
  check('Y6 found clear space to paint on', !!clear, JSON.stringify(clear));
  await page.evaluate(() => window.__test.snapView('v6pre'));
  await page.locator('button.swatch[data-color="#3e63dd"]').click();
  await editStroke('toolPaint', [[clear[0] - 10, clear[1]], [clear[0] + 10, clear[1]]]);
  const y6a = await page.evaluate((s) => window.__test.viewAt(s[0], s[1]), clear);
  check('Y6 paint on clear space lands at full alpha',
    y6a[3] === 255 && y6a[2] > 150, 'rgba(' + y6a.join(',') + ')');
  // A bigger eraser than the brush, so the stroke's anti-aliased fringe goes too.
  await page.locator('button.brush[data-size="12"]').click();
  await editStroke('toolErase', [[clear[0] - 12, clear[1]], [clear[0] + 12, clear[1]]]);
  const y6b = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('v6pre'),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }));
  check('Y6 erase removes the paint and nothing else — view back to pre-paint bytes',
    y6b.cmp.mismatches === 0);
  check('Y6 ORIGINAL layer untouched throughout', y6b.walk.mismatches === 0);
  await page.locator('button.brush[data-size="7"]').click();

  // ---- Y7: undo/redo round trip over mixed ops, compared as pixel buffers ----
  console.log('\n-- Y7: N ops, undo all, redo all — identical each way');
  const y7state = await creationState();
  console.log('     (starting the round trip at ' + y7state.cursor + '/' + y7state.ops + ' ops)');
  await page.evaluate(() => window.__test.snapView('w' + window.__bia.creation.cursor));
  await page.click('#rotRBtn');
  await page.waitForFunction((n) => window.__bia.creation.cursor === n + 1, y7state.cursor);
  await page.evaluate(() => window.__test.snapView('w' + window.__bia.creation.cursor));
  await editDrag(-30, 22);
  await page.evaluate(() => window.__test.snapView('w' + window.__bia.creation.cursor));
  const top = (await creationState()).cursor;
  let trip = { ok: true, detail: '' };
  for (let k = top; k > 0; k--) {   // undo to zero, checking each landing
    const r = await page.evaluate(() => {
      BIAEditor.undo();
      const c = window.__bia.creation;
      const name = 'w' + c.cursor;
      return window.__test._snaps[name]
        ? Object.assign(window.__test.cmpView(name), { cursor: c.cursor })
        : { mismatches: 0, transformSame: true, cursor: c.cursor };
    });
    if (r.mismatches !== 0 || !r.transformSame) {
      trip = { ok: false, detail: 'undo landing at ' + r.cursor + ': ' + r.mismatches + ' bytes differ' };
      break;
    }
  }
  const atZero = await page.evaluate(() => ({
    cursor: window.__bia.creation.cursor,
    vsOrig: window.__test.viewVsOriginal()
  }));
  check('Y7 undo all the way down lands on the untouched original',
    trip.ok && atZero.cursor === 0 && atZero.vsOrig === 0, trip.detail || 'cursor 0, 0 bytes differ');
  let tripUp = { ok: true, detail: '' };
  for (let k = 0; k < top; k++) {
    const r = await page.evaluate(() => {
      BIAEditor.redo();
      const c = window.__bia.creation;
      const name = 'w' + c.cursor;
      return window.__test._snaps[name]
        ? Object.assign(window.__test.cmpView(name), { cursor: c.cursor })
        : { mismatches: 0, transformSame: true, cursor: c.cursor };
    });
    if (r.mismatches !== 0 || !r.transformSame) {
      tripUp = { ok: false, detail: 'redo landing at ' + r.cursor + ': ' + r.mismatches + ' bytes differ' };
      break;
    }
  }
  const atTop = await creationState();
  check('Y7 redo all the way back up reproduces every state, byte for byte',
    tripUp.ok && atTop.cursor === top, tripUp.detail || ('cursor ' + atTop.cursor));

  // ---- Y8: the creation round-trips as JSON -----------------------------------
  console.log('\n-- Y8: export the creation, reload it fresh, identical view');
  const y8 = await page.evaluate(async () => {
    const c = window.__bia.creation;
    const s = c.toJSONString();
    const doc = JSON.parse(s);
    const c2 = await BIACreation.fromJSON(s);
    const a = c.view().data, b = c2.view().data;
    let opaqueMismatch = 0, farMismatch = 0;
    for (let p = 0; p < a.length; p += 4) {
      let d = 0;
      for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[p + k] - b[p + k]));
      if (!d) continue;
      if (a[p + 3] === 255 && b[p + 3] === 255) opaqueMismatch++;
      else if (d > 2) farMismatch++;
    }
    return {
      format: doc.format, version: doc.version,
      hasMask: doc.original.mask && doc.original.mask.encoding === 'rle' &&
               doc.original.mask.runs.length > 1,
      hasPixels: typeof doc.original.pixels === 'string' &&
                 doc.original.pixels.startsWith('data:image/png'),
      srcName: doc.original.source && doc.original.source.filename,
      ops: doc.edits.ops.length, cursor: doc.edits.cursor,
      transformSame: JSON.stringify(c2.transform) === JSON.stringify(c.transform),
      opaqueMismatch, farMismatch, bytes: s.length
    };
  });
  check('Y8 the JSON is a versioned, complete layered document',
    y8.format === 'vihu-creation' && y8.version === 1 && y8.hasMask && y8.hasPixels &&
    y8.srcName === '1000299474.jpg' && y8.cursor > 0,
    y8.bytes + ' bytes, ' + y8.cursor + '/' + y8.ops + ' ops');
  check('Y8 a fresh reload composes the identical current view',
    y8.opaqueMismatch === 0 && y8.farMismatch === 0 && y8.transformSame,
    'opaque exact; feather within ±2 (the PNG round trip\'s stated exemption)');

  // Through the real UI: download-equivalent JSON, reopened via the file input.
  const jsonStr = await page.evaluate(() => {
    window.__test.snapView('preImport');
    window.__preCreation = window.__bia.creation;
    return window.__bia.creation.toJSONString();
  });
  await newPhotoFromAlive();
  await page.setInputFiles('#creationInput',
    { name: 'left-character.vihu-creation.json', mimeType: 'application/json',
      buffer: Buffer.from(jsonStr) });
  await page.waitForFunction(() =>
    window.__bia.creation && window.__bia.creation !== window.__preCreation);
  const y8b = await page.evaluate(() => ({
    tol: window.__test.cmpViewTol('preImport'),
    onStep: document.querySelector('#stepAlive').classList.contains('here'),
    reclaimHidden: document.getElementById('anotherBtn').style.display === 'none'
  }));
  check('Y8 reopening the JSON through the UI lands on Make It Yours, same view',
    y8b.onStep && y8b.tol.opaqueMismatch === 0 && y8b.tol.farMismatch === 0);
  check('Y8 a reopened creation offers no "Make another claim" (no photograph behind it)',
    y8b.reclaimHidden);

  // ---- hygiene -------------------------------------------------------------
  console.log('\n-- hygiene');
  const banner = await page.evaluate(() => document.querySelector('#devError').style.display);
  check('developer error banner never shown', banner !== 'block');
  check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  console.log('\n==========================================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) { console.log('FAILURES:\n  ' + failures.join('\n  ')); }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
