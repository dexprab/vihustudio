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
 * pencil, erase, move, resize, rotate, undo/redo, PNG render, and the JSON
 * round trip — every equality a pixel-buffer comparison. The v0.1 checks
 * above it are regression: none were invalidated by the sprint (nothing
 * ever asserted the night sky); only the two v0.1 demo screenshots were
 * replaced by the sprint's five-shot demo.
 *
 * v0.2 "editable creation" adds the MARK 3.5 section: the region structure
 * (fills under the lines, line colour as a tint of the child's own ink,
 * Thin/Original/Thick line weight, the fine pencil, erase-anything,
 * Original|My Version, Reset) — the product owner's A–L acceptance list,
 * on the real photograph, ending in the ORIGINAL | MY VERSION side-by-side.
 * Erase semantics settled by the product owner ("allow me to erase
 * whatsoever i want"): erase clears edits where edits are and HIDES the
 * original where they are not — a replayed plane, never a write, so undo,
 * Reset and the Original view recover every hidden pixel exactly (Y5).
 *
 * The MARK section (K1–K7): mark a portion with a loose loop, push a
 * colour, the marked ink takes the replacement tint; the mark stays live
 * for another colour; later ops win where marks overlap; a loop around
 * everything is the whole-drawing case and travels as loop:null; JSON
 * round trip; erase in both orders. Asserted against an independently
 * pinned copy of the tint contract, pixel by pixel.
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
    y1.opsLine.includes('original') && y1.opsLine.includes('fills') &&
    /history 0\/0 ops/.test(y1.opsLine), JSON.stringify(y1.opsLine.slice(0, 80)));
  // The working surface: a soft light checkerboard — restored by the
  // product owner over the v0.2 brief's flat paper-grey ("make the
  // background transparent again. that was actually better."). Sampled at
  // cell size 14: neighbouring cells differ, cells two apart match, and
  // both tones are light and warm — never a dark sky, never a place.
  const surf = await page.evaluate(() => {
    const c = document.getElementById('editCanvas');
    const x = c.getContext('2d');
    const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data);
    return { a: px(3, 3), b: px(3 + 14, 3), c: px(3 + 28, 3) };
  });
  check('Y1 the surface is a checkerboard — neighbouring cells differ, alternating cells match',
    surf.a.join() !== surf.b.join() && surf.a.join() === surf.c.join(),
    surf.a.join() + ' / ' + surf.b.join() + ' / ' + surf.c.join());
  check('Y1 both surface tones are light and warm, not dark, not a sky',
    [surf.a, surf.b].every(p => p[0] >= 215 && p[0] >= p[2] && p[3] === 255),
    'rgb(' + surf.a.slice(0, 3).join(',') + ') / rgb(' + surf.b.slice(0, 3).join(',') + ')');

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
  await editStroke('toolPencil', [[dims.w * 0.25, dims.h * 0.5], [dims.w * 0.75, dims.h * 0.5]]);
  const y4a = await page.evaluate(async (d) => ({
    changed: window.__test.cmpView('v0').mismatches,
    at: window.__test.viewAt(d.w * 0.5, d.h * 0.5),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }), dims);
  check('Y4 a pencil stroke changes the current view', y4a.changed > 1000,
    y4a.changed + ' bytes differ');
  check('Y4 the pencil core lands at full alpha in the exact chosen colour',
    y4a.at[0] === 229 && y4a.at[1] === 72 && y4a.at[2] === 77 && y4a.at[3] === 255,
    'rgba(' + y4a.at.join(',') + ')');
  check('Y4 the pencil never touches the ORIGINAL layer (byte-identical to the photograph)',
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

  // ---- Y5: the eraser reaches everything, and destroys nothing ---------------
  // RESTORED by the product owner ("allow me to erase whatsoever i want"),
  // superseding the brief's edits-only erase: erase over the bare drawing
  // HIDES those pixels (alpha 0 in the view) while the ORIGINAL layer stays
  // byte-identical — hiding is a replayed plane, never a write — so undo
  // brings every pixel back exactly, asserted as byte equality.
  console.log('\n-- Y5: the eraser hides the original, recoverably — never destroys it');
  await page.evaluate(() => { BIAEditor.undo(); BIAEditor.undo(); }); // back to pencil-only, identity transform
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
    cmp: window.__test.cmpView('v5pre'),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }), spot);
  check('Y5 erase over the bare original HIDES it — the view pixel is transparent now',
    y5.at[3] === 0 && y5.cmp.mismatches > 0,
    'rgba(' + y5.at.join(',') + '), ' + y5.cmp.mismatches + ' bytes differ');
  check('Y5 ORIGINAL layer byte-identical after the erase — hidden, never written',
    y5.walk.mismatches === 0);
  const y5u = await page.evaluate(() => {
    BIAEditor.undo();
    return window.__test.cmpView('v5pre');
  });
  check('Y5 undo restores every hidden pixel byte-exactly — nothing was destroyed',
    y5u.mismatches === 0 && y5u.transformSame, y5u.mismatches + ' bytes differ');

  // ---- Y6: erasing PAINT removes paint, and only paint ------------------------
  console.log('\n-- Y6: erasing paint removes paint, not the drawing');
  const clear = await page.evaluate(() => {
    // Clear of the ORIGINAL and clear of any existing PAINT, so the only
    // thing this mark-then-erase pair can touch is itself. The margin must
    // exceed the THICK eraser's full reach (radius ~27 + stroke ±12).
    const c = window.__bia.creation, w = c.original.width, h = c.original.height;
    const pd = c.paintCtx.getImageData(0, 0, w, h).data;
    const od = c.original.data, m = 44;
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
  await editStroke('toolPencil', [[clear[0] - 10, clear[1]], [clear[0] + 10, clear[1]]]);
  const y6a = await page.evaluate((s) => window.__test.viewAt(s[0], s[1]), clear);
  check('Y6 a pencil mark on clear space lands at full alpha',
    y6a[3] === 255 && y6a[2] > 150, 'rgba(' + y6a.join(',') + ')');
  // A bigger eraser than the pencil, so the stroke's textured fringe goes too.
  await page.locator('button.brush[data-size="thick"]').click();
  await editStroke('toolErase', [[clear[0] - 12, clear[1]], [clear[0] + 12, clear[1]]]);
  const y6b = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('v6pre'),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }));
  check('Y6 erase removes the pencil mark and nothing else — view back to pre-mark bytes',
    y6b.cmp.mismatches === 0);
  check('Y6 ORIGINAL layer untouched throughout', y6b.walk.mismatches === 0);
  await page.locator('button.brush[data-size="fine"]').click();

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
  check('Y8 the JSON is a versioned, complete layered document (v2)',
    y8.format === 'vihu-creation' && y8.version === 2 && y8.hasMask && y8.hasPixels &&
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

  // ==========================================================================
  // MARK 3.5 — the editable structure: fills under the lines, line colour
  // and weight, the fine pencil, edits-only erase, Original|My Version,
  // Reset — the product owner's acceptance list on the REAL photograph,
  // driven through the real buttons and real taps, asserted pixel by pixel.
  console.log('\n== MARK 3.5 — fills, lines, pencil (the editable structure) ==');
  await newPhotoFromAlive();
  await page.evaluate(() => { window.__prevPhoto = window.__bia.photo; });
  await page.setInputFiles('#fileInput',
    { name: '1000299474.jpg', mimeType: 'image/jpeg', buffer: realBuf });
  await page.waitForFunction(() =>
    window.__bia.photo && window.__bia.photo !== window.__prevPhoto, null, { timeout: 60000 });
  await drawLoop(R.leftClaim);
  await bringAlive();
  await page.locator('#yoursTools').scrollIntoViewIfNeeded();

  // A tap on the editing canvas at a document coordinate — down and up,
  // no movement, exactly the child's Fill gesture.
  async function editTap(docX, docY) {
    const eb = await page.locator('#editCanvas').boundingBox();
    const [px, py] = await page.evaluate(([x, y]) => BIAEditor.docToScreen(x, y), [docX, docY]);
    const before = await page.evaluate(() => window.__bia.creation.cursor);
    await page.mouse.move(eb.x + px, eb.y + py);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction((n) => window.__bia.creation.cursor > n, before);
  }

  // ---- M1: the structure is derived, and the real character has it ---------
  const m1 = await page.evaluate(() => {
    const c = window.__bia.creation;
    const R2 = c.regions();
    if (R2.none) return { none: true, note: R2.note };
    const w = c.original.width, h = c.original.height, od = c.original.data;
    // the largest closed area
    let best = 0, bestA = 0;
    for (let id = 1; id < R2.areas.length; id++) {
      if (R2.areas[id] > bestA) { bestA = R2.areas[id]; best = id; }
    }
    // an interior point: transparent in ORIGINAL, labelled, and clear of ink
    // beyond the Fill tap's own snap radius (max(3, halfWidth)), so the tap
    // reads as "inside", never as "on the line"
    const clearance = Math.max(3, R2.halfWidth) + 3;
    let interior = null;
    for (let y = clearance; y < h - clearance && !interior; y += 2) {
      for (let x = clearance; x < w - clearance; x += 2) {
        const i = y * w + x;
        if (R2.labels[i] !== best || od[i * 4 + 3] !== 0) continue;
        let ok = true;
        for (let dy = -clearance; dy <= clearance && ok; dy += 2) {
          for (let dx = -clearance; dx <= clearance; dx += 2) {
            const j = (y + dy) * w + (x + dx);
            if (R2.labels[j] !== best || od[j * 4 + 3] !== 0 || c.mask[j]) { ok = false; break; }
          }
        }
        if (ok) { interior = [x, y]; break; }
      }
    }
    // an ink point on that area's line: raw-mask 3×3 solid, fully opaque
    const B = R2.boundaryOf(best);
    let inkPt = null;
    for (const i of B) {
      const x = i % w, y = (i / w) | 0;
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
      if (od[i * 4 + 3] !== 255) continue;
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!c.mask[(y + dy) * w + (x + dx)]) { solid = false; break; }
      }
      if (solid) { inkPt = [x, y]; break; }
    }
    return { none: false, count: R2.count, g: R2.g, halfWidth: R2.halfWidth,
             best, bestA, interior, inkPt, boundaryN: B.length };
  });
  check('M1 closed areas are found on the real character (structure, not paths)',
    !m1.none && m1.count >= 2 && m1.bestA > 5000,
    m1.none ? m1.note : m1.count + ' areas, largest ' + m1.bestA + ' px, gap radius ' + m1.g);
  check('M1 the largest area offers an interior point and a line point',
    !!m1.interior && !!m1.inkPt,
    JSON.stringify({ interior: m1.interior, ink: m1.inkPt }));

  // Boundary-visibility measure for Thin/Original/Thick: visibly inked
  // pixels in the boundary band (fills are excluded by exact colour,
  // transparency by alpha). The gate is L < 235, not "dark": since line
  // colour became a REPLACEMENT, a tinted line is bright — a red line is
  // red, not dark red — and a darkness gate would count the line's own
  // colour against it.
  await page.evaluate(() => {
    window.__test.lineVisibility = function (regionId, fillHex) {
      const c = window.__bia.creation, R2 = c.regions(), w = c.original.width;
      const d = c.view().data, n = R2.labels.length;
      const B = R2.boundaryOf(regionId);
      const fill = fillHex ? [parseInt(fillHex.slice(1, 3), 16), parseInt(fillHex.slice(3, 5), 16),
                              parseInt(fillHex.slice(5, 7), 16)] : null;
      const seen = new Uint8Array(n);
      let vis = 0;
      for (const i of B) {
        const x = i % w, y = (i / w) | 0;
        for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
          const j = (y + dy) * w + (x + dx);
          if (j < 0 || j >= n || seen[j]) continue;
          seen[j] = 1;
          const p = j * 4;
          if (d[p + 3] === 0) continue;
          if (fill && d[p] === fill[0] && d[p + 1] === fill[1] && d[p + 2] === fill[2]) continue;
          const L = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
          if (L < 235) vis++;
        }
      }
      return vis;
    };
  });

  // ---- M2 (E): tap-to-fill — colour INSIDE, under the lines -----------------
  console.log('\n-- M2 (E): tap inside → the area fills UNDER the pencil lines');
  const visOriginal = await page.evaluate((id) => window.__test.lineVisibility(id, '#3e63dd'), m1.best);
  await page.click('#toolFill');
  await page.locator('button.swatch[data-color="#3e63dd"]').click();
  const m2tool = await page.evaluate(() => BIAEditor.state.tool);
  check('M2 choosing a colour does not steal the Fill tool', m2tool === 'fill', m2tool);
  await editTap(m1.interior[0], m1.interior[1]);
  const m2 = await page.evaluate(async (M) => {
    const c = window.__bia.creation, R2 = c.regions(), w = c.original.width;
    const od = c.original.data, d = c.view().data;
    const last = c.ops[c.cursor - 1];
    // EVERY interior pixel that was transparent is now exactly the fill
    // colour; EVERY fully-opaque original pixel is byte-unchanged.
    let interiorTotal = 0, interiorFilled = 0, opaqueChanged = 0, opaqueTotal = 0;
    for (let i = 0; i < R2.labels.length; i++) {
      const p = i * 4;
      if (R2.labels[i] === M.best && od[p + 3] === 0) {
        interiorTotal++;
        if (d[p] === 62 && d[p + 1] === 99 && d[p + 2] === 221 && d[p + 3] === 255) interiorFilled++;
      }
      if (od[p + 3] === 255) {
        opaqueTotal++;
        if (d[p] !== od[p] || d[p + 1] !== od[p + 1] || d[p + 2] !== od[p + 2] ||
            d[p + 3] !== od[p + 3]) opaqueChanged++;
      }
    }
    return { op: last && last.t, region: last && last.region,
             interiorTotal, interiorFilled, opaqueChanged, opaqueTotal,
             walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg') };
  }, m1);
  check('M2 the tap landed as a fill op on the tapped area',
    m2.op === 'fill' && m2.region === m1.best, m2.op + ' region ' + m2.region);
  check('M2 every transparent interior pixel is EXACTLY the fill colour',
    m2.interiorTotal > 3000 && m2.interiorFilled === m2.interiorTotal,
    m2.interiorFilled + '/' + m2.interiorTotal + ' px');
  check('M2 every fully-opaque original pixel is byte-unchanged — lines stay on top',
    m2.opaqueChanged === 0, m2.opaqueTotal + ' opaque px checked');
  check('M2 ORIGINAL layer byte-identical to the photograph after the fill',
    m2.walk.mismatches === 0);

  // ---- M3 (F): tap the line → line colour, texture preserved ----------------
  console.log('\n-- M3 (F): tap the line itself → the line takes the colour, texture intact');
  await page.locator('button.swatch[data-color="#e5484d"]').click();
  await editTap(m1.inkPt[0], m1.inkPt[1]);
  const m3 = await page.evaluate((M) => {
    const c = window.__bia.creation, R2 = c.regions();
    const od = c.original.data, d = c.view().data;
    const last = c.ops[c.cursor - 1];
    const B = R2.boundaryOf(M.best);
    // alpha NEVER changes under a tint; darkness ORDER survives; red leads
    let alphaChanged = 0, redLeads = 0, opaqueN = 0;
    const lums = [];
    for (const i of B) {
      const p = i * 4;
      if (d[p + 3] !== od[p + 3]) alphaChanged++;
      if (od[p + 3] !== 255) continue;
      opaqueN++;
      if (d[p] >= d[p + 1] && d[p] >= d[p + 2]) redLeads++;
      if (opaqueN % 7 === 0) {
        lums.push([(od[p] * 77 + od[p + 1] * 150 + od[p + 2] * 29) >> 8,
                   (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8]);
      }
    }
    lums.sort((a, b) => a[0] - b[0]);
    let orderBreaks = 0;
    for (let k = 1; k < lums.length; k++) if (lums[k][1] < lums[k - 1][1] - 2) orderBreaks++;
    // the fill is still there — fill and line colour COEXIST
    let stillBlue = true;
    { const w = c.original.width, i = M.interior[1] * w + M.interior[0], p = i * 4;
      stillBlue = d[p] === 62 && d[p + 1] === 99 && d[p + 2] === 221; }
    return { op: last && last.t, region: last && last.region, alphaChanged,
             redLeads, opaqueN, orderBreaks, pairs: lums.length, stillBlue };
  }, m1);
  check('M3 the tap on ink landed as a line-colour op on the same area',
    m3.op === 'lineColor' && m3.region === m1.best, m3.op + ' region ' + m3.region);
  check('M3 the tint preserves per-pixel alpha exactly', m3.alphaChanged === 0,
    m3.alphaChanged + ' of the line\'s px changed alpha');
  check('M3 the line is red now, and its darkness ORDER survives (texture, not flat paint)',
    m3.redLeads / m3.opaqueN > 0.98 && m3.orderBreaks === 0,
    (m3.redLeads / m3.opaqueN * 100).toFixed(1) + '% red-led, ' + m3.orderBreaks +
    ' order breaks in ' + m3.pairs + ' sampled pairs');
  check('M3 fill blue + line red coexist', m3.stillBlue);

  // ---- M4 (G): Thin | Original | Thick, measured -----------------------------
  console.log('\n-- M4 (G): line weight — Thin < Original < Thick, measured on the ink');
  await page.click('#lineThinBtn');
  await page.waitForFunction(() => {
    const c = window.__bia.creation;
    return c.ops[c.cursor - 1] && c.ops[c.cursor - 1].t === 'lineWidth';
  });
  const visThin = await page.evaluate((id) => window.__test.lineVisibility(id, '#3e63dd'), m1.best);
  const thinWalk = await page.evaluate(() =>
    window.__test.originalWalk('/tools/imagebed/1000299474.jpg'));
  await page.click('#lineThickBtn');
  await page.waitForFunction(() => {
    const c = window.__bia.creation;
    return c.ops[c.cursor - 1] && c.ops[c.cursor - 1].width === 'thick';
  });
  const visThick = await page.evaluate((id) => window.__test.lineVisibility(id, '#3e63dd'), m1.best);
  check('M4 Thin shows measurably less line than Original', visThin < visOriginal * 0.8,
    'thin ' + visThin + ' < original ' + visOriginal + ' dark px');
  check('M4 Thin still shows a line (thinner, never gone)', visThin > visOriginal * 0.1,
    visThin + ' px');
  check('M4 Thick shows measurably more line than Original', visThick > visOriginal * 1.15,
    'thick ' + visThick + ' > original ' + visOriginal + ' dark px');
  check('M4 ORIGINAL layer byte-identical under Thin (weight is compose-time, not destruction)',
    thinWalk.mismatches === 0);

  // ---- M5 (H): the fine pencil ------------------------------------------------
  console.log('\n-- M5 (H): a fine pencil detail — a mark, not a paintbrush');
  const m5spot = await page.evaluate(() => {
    // clear of original, paint AND regions, with room for the eraser after
    const c = window.__bia.creation, R2 = c.regions(), w = c.original.width, h = c.original.height;
    const od = c.original.data, m = 40;
    for (let y = m; y < h - m; y += 3) {
      for (let x = m; x < w - m; x += 3) {
        let ok = true;
        for (let yy = -m; yy <= m && ok; yy += 4) for (let xx = -m; xx <= m; xx += 4) {
          const j = (y + yy) * w + (x + xx);
          if (od[j * 4 + 3] !== 0 || R2.labels[j] !== 0) { ok = false; break; }
        }
        if (ok) return [x, y];
      }
    }
    return null;
  });
  check('M5 found clear space for the detail', !!m5spot, JSON.stringify(m5spot));
  await page.evaluate(() => window.__test.snapView('m5pre'));
  await page.click('#toolPencil');
  await page.locator('button.swatch[data-color="#30a46c"]').click();
  await editStroke('toolPencil', [[m5spot[0] - 14, m5spot[1]], [m5spot[0] + 14, m5spot[1]]]);
  const m5 = await page.evaluate((s) => {
    const c = window.__bia.creation, w = c.original.width;
    const last = c.ops[c.cursor - 1];
    const at = window.__test.viewAt(s[0], s[1]);
    // measure the mark's height at its middle column — fine means FINE
    const d = c.view().data;
    let minY = 1e9, maxY = -1;
    for (let y = s[1] - 12; y <= s[1] + 12; y++) {
      if (d[(y * w + s[0]) * 4 + 3] > 0) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    return { op: last.t, size: last.size, radius: last.radius,
             points: last.points.length, at, markHeight: maxY - minY + 1 };
  }, m5spot);
  check('M5 the pencil op is a point path with a pinned radius (rendered on demand)',
    m5.op === 'pencil' && m5.size === 'fine' && m5.points >= 2 && m5.radius > 0,
    m5.points + ' points, radius ' + m5.radius.toFixed(2));
  check('M5 the core of the mark is the exact colour at full alpha',
    m5.at[0] === 48 && m5.at[1] === 164 && m5.at[2] === 108 && m5.at[3] === 255,
    'rgba(' + m5.at.join(',') + ')');
  check('M5 fine IS fine — the mark is a few pixels tall, not a paintbrush band',
    m5.markHeight >= 2 && m5.markHeight <= 9, m5.markHeight + ' px tall');

  // ---- M6 (I): erase the detail ------------------------------------------------
  // The detail sits in space clear of the original, so this erase touches
  // only the pencil mark — the hide-original path is Y5's subject.
  console.log('\n-- M6 (I): erase the detail — back to before it, byte for byte');
  await page.locator('button.brush[data-size="medium"]').click();
  await editStroke('toolErase', [[m5spot[0] - 16, m5spot[1]], [m5spot[0] + 16, m5spot[1]]]);
  await page.locator('button.brush[data-size="fine"]').click();
  const m6 = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('m5pre'),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }));
  check('M6 erasing the detail restores the pre-detail view exactly',
    m6.cmp.mismatches === 0, m6.cmp.mismatches + ' bytes differ');
  check('M6 ORIGINAL layer byte-identical after the erase', m6.walk.mismatches === 0);
  // One pencil detail that STAYS — a small zigzag next to the drawing — so
  // the demo's My Version carries all three kinds of edit at once.
  await page.click('#toolPencil');
  await editStroke('toolPencil', [
    [m5spot[0] - 16, m5spot[1] + 6], [m5spot[0] - 8, m5spot[1] - 8],
    [m5spot[0], m5spot[1] + 6], [m5spot[0] + 8, m5spot[1] - 8],
    [m5spot[0] + 16, m5spot[1] + 6]]);
  await page.screenshot({ path: path.join(SHOTS, '4-made-mine.png') });

  // ---- M7 (J): undo/redo across the new op vocabulary -------------------------
  console.log('\n-- M7 (J): undo everything, redo everything — pixel-exact each way');
  const m7top = await page.evaluate(() => window.__bia.creation.cursor);
  await page.evaluate(() => window.__test.snapView('m7top'));
  await page.evaluate(() => { while (BIAEditor.state.creation.undo()) {} });
  const m7zero = await page.evaluate(() => ({
    cursor: window.__bia.creation.cursor,
    vsOrig: window.__test.viewVsOriginal()
  }));
  check('M7 undo through fills, line ops, pencil and erase lands on the untouched original',
    m7zero.cursor === 0 && m7zero.vsOrig === 0, 'cursor 0, ' + m7zero.vsOrig + ' bytes differ');
  await page.evaluate(() => { while (BIAEditor.state.creation.redo()) {} });
  const m7back = await page.evaluate(() => Object.assign(
    { cursor: window.__bia.creation.cursor }, window.__test.cmpView('m7top')));
  check('M7 redo reproduces the edited state byte for byte',
    m7back.cursor === m7top && m7back.mismatches === 0 && m7back.transformSame,
    'cursor ' + m7back.cursor + ', ' + m7back.mismatches + ' bytes differ');

  // ---- M8 (K): Reset My Changes ------------------------------------------------
  console.log('\n-- M8 (K): Reset → the exact original extracted artwork');
  await page.click('#resetBtn');
  await page.waitForFunction(() => window.__bia.creation.cursor === 0);
  const m8 = await page.evaluate(async () => ({
    vsOrig: window.__test.viewVsOriginal(),
    t: window.__bia.creation.transform,
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }));
  check('M8 after Reset the view is byte-identical to the ORIGINAL layer',
    m8.vsOrig === 0 && m8.walk.mismatches === 0);
  check('M8 Reset also clears the transform',
    m8.t.x === 0 && m8.t.y === 0 && m8.t.scale === 1 && m8.t.rotation === 0);
  await page.screenshot({ path: path.join(SHOTS, '5-original-recovered.png') });
  // Reset is history movement, not destruction: Redo can walk it back.
  await page.evaluate(() => { while (BIAEditor.state.creation.redo()) {} });
  const m8b = await page.evaluate(() => window.__test.cmpView('m7top'));
  check('M8 even a Reset can be redone — nothing was destroyed',
    m8b.mismatches === 0 && m8b.transformSame);

  // ---- M9: Original | My Version — one creation, two honest views -------------
  console.log('\n-- M9: Original | My Version toggle');
  await page.click('#viewOriginalBtn');
  const m9a = await page.evaluate((M) => {
    const [px, py] = BIAEditor.docToScreen(M.interior[0], M.interior[1]);
    const d = document.getElementById('editCanvas').getContext('2d')
      .getImageData(Math.round(px), Math.round(py), 1, 1).data;
    return Array.from(d);
  }, m1);
  await page.click('#viewMineBtn');
  const m9b = await page.evaluate((M) => {
    const [px, py] = BIAEditor.docToScreen(M.interior[0], M.interior[1]);
    const d = document.getElementById('editCanvas').getContext('2d')
      .getImageData(Math.round(px), Math.round(py), 1, 1).data;
    return Array.from(d);
  }, m1);
  check('M9 Original shows the untouched drawing — the filled spot is bare surface there',
    ((Math.abs(m9a[0] - 247) <= 4 && Math.abs(m9a[1] - 244) <= 4 && Math.abs(m9a[2] - 238) <= 4) ||
     (Math.abs(m9a[0] - 236) <= 4 && Math.abs(m9a[1] - 231) <= 4 && Math.abs(m9a[2] - 221) <= 4)),
    'rgb(' + m9a.slice(0, 3).join(',') + ')');
  check('M9 My Version shows the fill at the same spot — one creation, two views',
    m9b[2] > 150 && m9b[2] > m9b[0] && m9b[3] === 255,
    'rgb(' + m9b.slice(0, 3).join(',') + ')');

  // ---- M10: the two PNGs and the editable JSON ---------------------------------
  console.log('\n-- M10: Original PNG · Current PNG · the creation JSON (v2, v1 still opens)');
  const m10 = await page.evaluate(async () => {
    const c = window.__bia.creation;
    // Original PNG: encode the untouched layer, decode it back, walk it.
    const blob = await new Promise((res) => c.originalCanvas().toBlob(res, 'image/png'));
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, 0, 0);
    const dec = x.getImageData(0, 0, cv.width, cv.height).data;
    const od = c.original.data;
    let opaqueMismatch = 0, farMismatch = 0;
    for (let p = 0; p < od.length; p += 4) {
      let dd = 0;
      for (let k = 0; k < 4; k++) dd = Math.max(dd, Math.abs(od[p + k] - dec[p + k]));
      if (!dd) continue;
      if (od[p + 3] === 255) opaqueMismatch++;
      else if (dd > 2) farMismatch++;
    }
    const png = await window.__test.pngRendersCurrentView();
    // JSON round trip WITH fills, line ops and a pencil mark in history:
    // fully-opaque and fully-transparent original pixels compose EXACTLY;
    // the feather ring (partial alpha) may drift ±4 after a tint of ±1-off
    // RGB — the stated exemption, one ring wide, nothing else.
    const s = c.toJSONString();
    const c2 = await BIACreation.fromJSON(s);
    const a = c.view().data, b = c2.view().data;
    let hardMismatch = 0, featherDrift = 0, featherFar = 0;
    for (let p = 0; p < a.length; p += 4) {
      let dd = 0;
      for (let k = 0; k < 4; k++) dd = Math.max(dd, Math.abs(a[p + k] - b[p + k]));
      if (!dd) continue;
      const oa = od[p + 3];
      if (oa === 0 || oa === 255) hardMismatch++;
      else { featherDrift++; if (dd > 4) featherFar++; }
    }
    // v1 files still open (empty history — the cheap, honest compat check)
    const doc = c.toJSON();
    doc.version = 1; doc.edits = { ops: [], cursor: 0 };
    let v1ok = false, v1ghost = -1;
    try {
      const c1 = await BIACreation.fromJSON(JSON.stringify(doc));
      v1ghost = 0;
      const v = c1.view().data, o1 = c1.original.data;
      for (let i = 0; i < v.length; i++) if (v[i] !== o1[i]) v1ghost++;
      v1ok = true;
    } catch (e) { v1ok = false; }
    return { dims: bmp.width === cv.width, opaqueMismatch, farMismatch,
             pngBytes: blob.size, png,
             json: { hardMismatch, featherDrift, featherFar, ops: c2.ops.length },
             v1ok, v1ghost };
  });
  check('M10 Original PNG is the untouched extracted artwork (opaque exact, feather ±2)',
    m10.opaqueMismatch === 0 && m10.farMismatch === 0, m10.pngBytes + ' bytes');
  check('M10 Current PNG is a render of the current edited view',
    m10.png.dimsMatch && m10.png.opaqueMismatch === 0 && m10.png.farMismatch === 0);
  check('M10 the v2 JSON replays fills, line ops and pencil to the same bytes',
    m10.json.hardMismatch === 0 && m10.json.featherFar === 0 && m10.json.ops > 0,
    m10.json.featherDrift + ' feather px within ±4, 0 elsewhere');
  check('M10 a version-1 file still opens, ghost-free', m10.v1ok && m10.v1ghost === 0);

  // ---- THE ACCEPTANCE VISUAL: ORIGINAL | MY VERSION, side by side --------------
  await page.evaluate(() => {
    const c = window.__bia.creation;
    const w = c.original.width, h = c.original.height;
    const board = document.createElement('canvas');
    board.width = w * 2 + 90; board.height = h + 96;
    const x = board.getContext('2d');
    x.fillStyle = '#eceae4'; x.fillRect(0, 0, board.width, board.height);
    x.drawImage(c.originalCanvas(), 30, 66);
    x.drawImage(c.viewCanvas(), w + 60, 66);
    x.fillStyle = '#4a463e';
    x.font = '600 30px Georgia, serif';
    x.fillText('ORIGINAL', 30, 44);
    x.fillText('MY VERSION', w + 60, 44);
    board.id = 'sideBySide';
    board.style.width = '1040px';
    document.querySelector('.wrap').appendChild(board);
  });
  await page.locator('#sideBySide').scrollIntoViewIfNeeded();
  await page.locator('#sideBySide').screenshot({
    path: path.join(SHOTS, '6-original-vs-my-version.png') });
  await page.evaluate(() => document.getElementById('sideBySide').remove());

  // ==========================================================================
  // MARK — mark a portion, colour its lines (and colour ALL the lines).
  // Product owner: "can i select a portion of image by marking it and push
  // a button to change its outline?" The child loops a part of the drawing
  // (the Claim's own gesture), pushes a colour, and the marked ink takes the
  // SAME replacement tint line colour uses. A loop around everything IS the
  // whole-drawing case — the op travels as loop:null. Driven with real
  // pointer loops on the REAL photograph; every equality a pixel-buffer
  // comparison against an independently pinned copy of the tint contract.
  console.log('\n== MARK — mark a portion, colour its lines =================');
  await anotherClaim();
  await drawLoop(R.leftClaim);
  await bringAlive();
  await page.locator('#yoursTools').scrollIntoViewIfNeeded();

  // A Mark loop on the real editing canvas: document-space points driven
  // as one pointer stroke; the editor closes it into a live mark on
  // release. Marking is NOT an op — only pushing a colour is.
  async function markLoopOn(docPoints) {
    await page.click('#toolMark');
    await page.evaluate(() => { BIAEditor.state.mark = null; });
    const eb = await page.locator('#editCanvas').boundingBox();
    const pts = await page.evaluate((dp) =>
      dp.map((p) => BIAEditor.docToScreen(p[0], p[1])), docPoints);
    await page.mouse.move(eb.x + pts[0][0], eb.y + pts[0][1]);
    await page.mouse.down();
    for (const p of pts) await page.mouse.move(eb.x + p[0], eb.y + p[1]);
    await page.mouse.up();
    await page.waitForFunction(() => !!BIAEditor.state.mark);
  }
  async function pushColour(hex) {
    const before = await page.evaluate(() => window.__bia.creation.cursor);
    await page.locator('button.swatch[data-color="' + hex + '"]').click();
    await page.waitForFunction((n) => window.__bia.creation.cursor > n, before);
  }
  const rectLoop = (r) => [
    [r.x0, r.y0], [(r.x0 + r.x1) / 2, r.y0], [r.x1, r.y0], [r.x1, (r.y0 + r.y1) / 2],
    [r.x1, r.y1], [(r.x0 + r.x1) / 2, r.y1], [r.x0, r.y1], [r.x0, (r.y0 + r.y1) / 2]];

  // The tint contract, pinned INDEPENDENTLY in the test (dark ink → the
  // colour itself, light pencil → paler toward white, alpha untouched),
  // and a rectangle audit with a guard band so rasterisation edges are
  // never contested.
  await page.evaluate(() => {
    window.__test.tintRef = (r, g, b, t) => {
      const v = (r * 77 + g * 150 + b * 29) >> 8;
      const f = Math.min(1, v / 230) * 0.75;
      return [Math.round(t[0] + (255 - t[0]) * f),
              Math.round(t[1] + (255 - t[1]) * f),
              Math.round(t[2] + (255 - t[2]) * f)];
    };
    window.__test.hex = (hx) => [parseInt(hx.slice(1, 3), 16),
      parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
    window.__test.markAudit = (rect, hx, guard) => {
      const c = window.__bia.creation, w = c.original.width, h = c.original.height;
      const od = c.original.data, d = c.view().data, t = window.__test.hex(hx);
      let insideInk = 0, insideWrong = 0, alphaWrong = 0, outsideInk = 0, outsideChanged = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (!od[p + 3]) continue;
        const inIn = x >= rect.x0 + guard && x <= rect.x1 - guard &&
                     y >= rect.y0 + guard && y <= rect.y1 - guard;
        const outOut = x < rect.x0 - guard || x > rect.x1 + guard ||
                       y < rect.y0 - guard || y > rect.y1 + guard;
        if (inIn) {
          insideInk++;
          const e = window.__test.tintRef(od[p], od[p + 1], od[p + 2], t);
          if (d[p] !== e[0] || d[p + 1] !== e[1] || d[p + 2] !== e[2]) insideWrong++;
          if (d[p + 3] !== od[p + 3]) alphaWrong++;
        } else if (outOut) {
          outsideInk++;
          if (d[p] !== od[p] || d[p + 1] !== od[p + 1] ||
              d[p + 2] !== od[p + 2] || d[p + 3] !== od[p + 3]) outsideChanged++;
        }
      }
      return { insideInk, insideWrong, alphaWrong, outsideInk, outsideChanged };
    };
  });

  const mkDims = await page.evaluate(() => {
    const c = window.__bia.creation, w = c.original.width, h = c.original.height;
    const od = c.original.data;
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!od[(y * w + x) * 4 + 3]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { w, h, minX, minY, maxX, maxY };
  });
  const IW = mkDims.maxX - mkDims.minX, IH = mkDims.maxY - mkDims.minY;
  // "one arm": a portion on the character's left side, mid-height.
  const rectA = { x0: Math.round(mkDims.minX), y0: Math.round(mkDims.minY + IH * 0.28),
                  x1: Math.round(mkDims.minX + IW * 0.40), y1: Math.round(mkDims.minY + IH * 0.78) };

  // ---- K1: mark a portion, push green — ONLY the marked ink changes ---------
  console.log('\n-- K1: mark a loop around a portion → push green');
  await page.evaluate(() => window.__test.snapView('mk0'));
  await markLoopOn(rectLoop(rectA));
  const k1sel = await page.evaluate(() => ({
    live: !!BIAEditor.state.mark,
    all: !!(BIAEditor.state.mark && BIAEditor.state.mark.all),
    cursor: window.__bia.creation.cursor
  }));
  check('K1 the loop closes into a live mark, and marking alone is not an op',
    k1sel.live && !k1sel.all && k1sel.cursor === 0, JSON.stringify(k1sel));
  await pushColour('#30a46c');
  const k1 = await page.evaluate(async (rect) => {
    const c = window.__bia.creation, last = c.ops[c.cursor - 1];
    return {
      op: last.t, color: last.color,
      loopIsPolygon: Array.isArray(last.loop) && last.loop.length >= 3 &&
        last.loop.every((p) => Array.isArray(p) && p.length === 2 &&
          Number.isInteger(p[0]) && Number.isInteger(p[1])),
      audit: window.__test.markAudit(rect, '#30a46c', 3),
      walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
    };
  }, rectA);
  check('K1 the colour push lands as ONE inkTint op carrying the loop polygon',
    k1.op === 'inkTint' && k1.color === '#30a46c' && k1.loopIsPolygon,
    k1.op + ' ' + k1.color);
  check('K1 every marked ink pixel shows the replacement tint, alpha preserved',
    k1.audit.insideInk > 500 && k1.audit.insideWrong === 0 && k1.audit.alphaWrong === 0,
    k1.audit.insideInk + ' ink px inside the loop, ' + k1.audit.insideWrong + ' wrong');
  check('K1 ink outside the loop is byte-unchanged',
    k1.audit.outsideInk > 1000 && k1.audit.outsideChanged === 0,
    k1.audit.outsideInk + ' ink px outside, ' + k1.audit.outsideChanged + ' changed');
  check('K1 ORIGINAL layer byte-identical to the photograph after the mark tint',
    k1.walk.mismatches === 0, k1.walk.opaque + ' opaque px walked');
  await page.screenshot({ path: path.join(SHOTS, '7-mark-a-portion.png') });

  // ---- K2: a second colour with the mark still live — replaces, no mixing ---
  console.log('\n-- K2: push a second colour with the mark still live');
  const k2live = await page.evaluate(() => !!BIAEditor.state.mark);
  check('K2 the mark stays live after a colour (so another can be tried)', k2live);
  await pushColour('#e5484d');
  const k2 = await page.evaluate((rect) => ({
    audit: window.__test.markAudit(rect, '#e5484d', 3),
    cursor: window.__bia.creation.cursor
  }), rectA);
  check('K2 the second colour REPLACES the first everywhere in the mark — no mixing',
    k2.audit.insideWrong === 0 && k2.audit.alphaWrong === 0 && k2.cursor === 2,
    k2.audit.insideInk + ' ink px all red-tinted, ' + k2.cursor + ' ops');
  check('K2 ink outside the mark still byte-unchanged', k2.audit.outsideChanged === 0);

  // ---- K3: overlapping marks — the LATER op wins where they overlap ---------
  console.log('\n-- K3: a second overlapping mark — later op wins in the overlap');
  const rectB = { x0: Math.round((rectA.x0 + rectA.x1) / 2), y0: rectA.y0,
                  x1: Math.round(rectA.x1 + IW * 0.25), y1: rectA.y1 };
  await markLoopOn(rectLoop(rectB));
  await pushColour('#3e63dd');
  const k3 = await page.evaluate(([ra, rb]) => {
    const c = window.__bia.creation, w = c.original.width;
    const od = c.original.data, d = c.view().data;
    const red = window.__test.hex('#e5484d'), blue = window.__test.hex('#3e63dd');
    const g = 3;
    let aOnly = 0, aWrong = 0, both = 0, bothWrong = 0;
    for (let y = ra.y0 + g; y <= ra.y1 - g; y++) for (let x = ra.x0 + g; x <= ra.x1 - g; x++) {
      const p = (y * w + x) * 4;
      if (!od[p + 3]) continue;
      const inB = x >= rb.x0 + g && x <= rb.x1 - g;
      const outB = x < rb.x0 - g || x > rb.x1 + g;
      const eR = window.__test.tintRef(od[p], od[p + 1], od[p + 2], red);
      const eB = window.__test.tintRef(od[p], od[p + 1], od[p + 2], blue);
      if (inB) { both++; if (d[p] !== eB[0] || d[p + 1] !== eB[1] || d[p + 2] !== eB[2]) bothWrong++; }
      else if (outB) { aOnly++; if (d[p] !== eR[0] || d[p + 1] !== eR[1] || d[p + 2] !== eR[2]) aWrong++; }
    }
    return { aOnly, aWrong, both, bothWrong };
  }, [rectA, rectB]);
  check('K3 the overlap took the LATER colour (blue over red)',
    k3.both > 100 && k3.bothWrong === 0, k3.both + ' overlap ink px');
  check('K3 the non-overlapped part of the first mark kept its red',
    k3.aOnly > 100 && k3.aWrong === 0, k3.aOnly + ' ink px');

  // ---- K4: undo to before any mark, redo back — byte-exact both ways --------
  console.log('\n-- K4: undo through all three mark tints, redo back');
  await page.evaluate(() => window.__test.snapView('mkTop'));
  await page.evaluate(() => { BIAEditor.undo(); BIAEditor.undo(); BIAEditor.undo(); });
  const k4a = await page.evaluate(async () => ({
    cmp: window.__test.cmpView('mk0'),
    vsOrig: window.__test.viewVsOriginal(),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }));
  check('K4 undo lands on the pre-mark view exactly — untouched original',
    k4a.cmp.mismatches === 0 && k4a.vsOrig === 0 && k4a.walk.mismatches === 0,
    k4a.cmp.mismatches + ' bytes differ');
  await page.evaluate(() => { BIAEditor.redo(); BIAEditor.redo(); BIAEditor.redo(); });
  const k4b = await page.evaluate(() => window.__test.cmpView('mkTop'));
  check('K4 redo reproduces the marked state byte for byte',
    k4b.mismatches === 0 && k4b.transformSame, k4b.mismatches + ' bytes differ');

  // ---- K5: a fill, then a loop around EVERYTHING → all the lines, one op ----
  console.log('\n-- K5: fill a shape, then loop around everything → all lines take one colour');
  const k5interior = await page.evaluate(() => {
    const c = window.__bia.creation, R2 = c.regions();
    if (R2.none) return null;
    const w = c.original.width, h = c.original.height, od = c.original.data;
    let best = 0, bestA = 0;
    for (let id = 1; id < R2.areas.length; id++) {
      if (R2.areas[id] > bestA) { bestA = R2.areas[id]; best = id; }
    }
    const cl = Math.max(3, R2.halfWidth) + 3;
    for (let y = cl; y < h - cl; y += 2) for (let x = cl; x < w - cl; x += 2) {
      const i = y * w + x;
      if (R2.labels[i] !== best || od[i * 4 + 3] !== 0) continue;
      let ok = true;
      for (let dy = -cl; dy <= cl && ok; dy += 2) for (let dx = -cl; dx <= cl; dx++) {
        const j = (y + dy) * w + (x + dx);
        if (R2.labels[j] !== best || od[j * 4 + 3] !== 0 || c.mask[j]) { ok = false; break; }
      }
      if (ok) return [x, y];
    }
    return null;
  });
  check('K5 found an interior spot to fill first', !!k5interior, JSON.stringify(k5interior));
  await page.click('#toolFill');
  await page.locator('button.swatch[data-color="#f5a524"]').click();
  await editTap(k5interior[0], k5interior[1]);
  const k5fill = await page.evaluate((s) => window.__test.viewAt(s[0], s[1]), k5interior);
  check('K5 the fill landed — the interior is exactly the fill colour',
    k5fill[0] === 245 && k5fill[1] === 165 && k5fill[2] === 36 && k5fill[3] === 255,
    'rgba(' + k5fill.join(',') + ')');
  const whole = { x0: -8, y0: -8, x1: mkDims.w + 8, y1: mkDims.h + 8 };
  await markLoopOn(rectLoop(whole));
  const k5sel = await page.evaluate(() => ({
    live: !!BIAEditor.state.mark,
    all: !!(BIAEditor.state.mark && BIAEditor.state.mark.all),
    loop: BIAEditor.state.mark ? BIAEditor.state.mark.loop : 'none'
  }));
  check('K5 a loop around everything IS "all the lines" — normalised to loop:null',
    k5sel.live && k5sel.all && k5sel.loop === null, JSON.stringify(k5sel.all));
  await pushColour('#8e4ec6');
  const k5 = await page.evaluate(async (fillSpot) => {
    const c = window.__bia.creation, w = c.original.width, h = c.original.height;
    const od = c.original.data, d = c.view().data, fp = c.fillPlane;
    const purple = window.__test.hex('#8e4ec6');
    const last = c.ops[c.cursor - 1];
    let opaqueInk = 0, wrong = 0, alphaWrongNoFill = 0, checkedAlpha = 0;
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      if (!od[p + 3]) continue;
      if (od[p + 3] === 255) {
        opaqueInk++;
        const e = window.__test.tintRef(od[p], od[p + 1], od[p + 2], purple);
        if (d[p] !== e[0] || d[p + 1] !== e[1] || d[p + 2] !== e[2] || d[p + 3] !== 255) wrong++;
      }
      if (!fp[p + 3]) {   // off the fill, the view's alpha must be the original's
        checkedAlpha++;
        if (d[p + 3] !== od[p + 3]) alphaWrongNoFill++;
      }
    }
    const fs = (fillSpot[1] * w + fillSpot[0]) * 4;
    return { op: last.t, opLoop: last.loop === null ? null : 'polygon',
             opaqueInk, wrong, alphaWrongNoFill, checkedAlpha,
             fillStill: d[fs] === 245 && d[fs + 1] === 165 && d[fs + 2] === 36 && d[fs + 3] === 255,
             walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg') };
  }, k5interior);
  check('K5 the whole-drawing case is the SAME op, travelling as loop:null',
    k5.op === 'inkTint' && k5.opLoop === null);
  check('K5 every fully-opaque ink pixel shows the tint — the whole drawing recoloured',
    k5.opaqueInk > 10000 && k5.wrong === 0, k5.opaqueInk + ' opaque ink px, ' + k5.wrong + ' wrong');
  check('K5 ink alpha untouched everywhere (measured off the fill)',
    k5.alphaWrongNoFill === 0, k5.checkedAlpha + ' ink px checked');
  check('K5 the fill stays under the recoloured lines', k5.fillStill);
  check('K5 ORIGINAL layer byte-identical after colouring all the lines',
    k5.walk.mismatches === 0);

  // ---- K6: the creation with inkTint ops round-trips as JSON ----------------
  console.log('\n-- K6: JSON round trip with polygon loops AND loop:null in the history');
  const k6 = await page.evaluate(async () => {
    const c = window.__bia.creation, od = c.original.data;
    const s = c.toJSONString();
    const doc = JSON.parse(s);
    const c2 = await BIACreation.fromJSON(s);
    const a = c.view().data, b = c2.view().data;
    let hardMismatch = 0, featherFar = 0;
    for (let p = 0; p < a.length; p += 4) {
      let dd = 0;
      for (let k = 0; k < 4; k++) dd = Math.max(dd, Math.abs(a[p + k] - b[p + k]));
      if (!dd) continue;
      const oa = od[p + 3];
      if (oa === 0 || oa === 255) hardMismatch++;
      else if (dd > 4) featherFar++;
    }
    const tints = doc.edits.ops.filter((o) => o.t === 'inkTint');
    return { version: doc.version, hardMismatch, featherFar, tints: tints.length,
             hasPolygonLoop: tints.some((o) => Array.isArray(o.loop)),
             hasNullLoop: tints.some((o) => o.loop === null), bytes: s.length };
  });
  check('K6 the JSON stays v2 and carries inkTint ops — polygon loops and loop:null',
    k6.version === 2 && k6.tints === 4 && k6.hasPolygonLoop && k6.hasNullLoop,
    k6.tints + ' inkTint ops, ' + k6.bytes + ' bytes');
  check('K6 a fresh reload replays the marks to identical bytes',
    k6.hardMismatch === 0 && k6.featherFar === 0,
    'opaque & transparent exact; feather within ±4 (the stated exemption)');

  // ---- K7: erase and mark, in both orders — erased stays hidden -------------
  console.log('\n-- K7: erase and mark, both orders');
  const k7spot = await page.evaluate(() => window.__test.findSpot('ink'));
  check('K7 found a fully-opaque ink spot', !!k7spot, JSON.stringify(k7spot));
  await page.evaluate(() => window.__test.snapView('k7pre'));
  await editStroke('toolErase', [[k7spot[0] - 10, k7spot[1]], [k7spot[0] + 10, k7spot[1]]]);
  const k7a = await page.evaluate(async (s) => ({
    at: window.__test.viewAt(s[0], s[1]),
    walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg')
  }), k7spot);
  check('K7 mark-then-erase: the erased pixel is hidden even though it was tinted',
    k7a.at[3] === 0 && k7a.walk.mismatches === 0, 'rgba(' + k7a.at.join(',') + ')');
  const k7undo = await page.evaluate((s) => {
    BIAEditor.undo();
    return { cmp: window.__test.cmpView('k7pre'), at: window.__test.viewAt(s[0], s[1]) };
  }, k7spot);
  check('K7 undoing the erase brings the tinted pixel back byte-exactly',
    k7undo.cmp.mismatches === 0 && k7undo.at[3] === 255,
    k7undo.cmp.mismatches + ' bytes differ, rgba(' + k7undo.at.join(',') + ')');
  await editStroke('toolErase', [[k7spot[0] - 10, k7spot[1]], [k7spot[0] + 10, k7spot[1]]]);
  const k7rect = { x0: k7spot[0] - 80, y0: k7spot[1] - 80,
                   x1: k7spot[0] + 80, y1: k7spot[1] + 80 };
  await markLoopOn(rectLoop(k7rect));
  await pushColour('#30a46c');
  const k7b = await page.evaluate(async ([s, rect]) => {
    const c = window.__bia.creation, w = c.original.width;
    const od = c.original.data, d = c.view().data;
    const green = window.__test.hex('#30a46c');
    // a neighbour: opaque ink inside the loop, well clear of the erase disc
    let neighbour = null;
    for (let y = rect.y0 + 4; y <= rect.y1 - 4 && !neighbour; y++) {
      for (let x = rect.x0 + 4; x <= rect.x1 - 4; x++) {
        if (Math.abs(y - s[1]) < 34 && Math.abs(x - s[0]) < 46) continue;
        const p = (y * w + x) * 4;
        if (od[p + 3] === 255) { neighbour = [x, y]; break; }
      }
    }
    let nOk = false;
    if (neighbour) {
      const p = (neighbour[1] * w + neighbour[0]) * 4;
      const e = window.__test.tintRef(od[p], od[p + 1], od[p + 2], green);
      nOk = d[p] === e[0] && d[p + 1] === e[1] && d[p + 2] === e[2] && d[p + 3] === 255;
    }
    return { at: window.__test.viewAt(s[0], s[1]), neighbour, nOk,
             walk: await window.__test.originalWalk('/tools/imagebed/1000299474.jpg') };
  }, [k7spot, k7rect]);
  check('K7 erase-then-mark: the erased pixel STAYS hidden through the new colour',
    k7b.at[3] === 0, 'rgba(' + k7b.at.join(',') + ')');
  check('K7 …while unerased ink inside the same loop takes the colour',
    !!k7b.neighbour && k7b.nOk, JSON.stringify(k7b.neighbour));
  check('K7 ORIGINAL layer byte-identical through every erase/mark order',
    k7b.walk.mismatches === 0);

  // ---- L: MY LIBRARY ---------------------------------------------------------
  // The character, kept: the Save row on MAKE IT YOURS lands the record
  // in the local library store (js/creatorLibrary.js — this tool's first
  // outside link) with NO platform configured, and the record
  // round-trips: the creation JSON reopens, the placement PNG decodes.
  // The store's sync is gated on an active Magic Card, so this whole
  // section must also stay network-silent — asserted, not assumed.
  console.log('\n-- L: My Library — keep the character, no platform needed');
  const crossOriginRequests = [];
  page.on('request', (req) => {
    try {
      const u = new URL(req.url());
      if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') crossOriginRequests.push(req.url());
    } catch (e) {}
  });
  const lRow = await page.evaluate(() => ({
    loaded: !!window.CreatorLibrary,
    visible: document.getElementById('libraryRow').style.display !== 'none',
    name: document.getElementById('libraryName').value,
    btn: !!document.getElementById('libraryBtn')
  }));
  check('L1 the store module loaded and the Save row is on MAKE IT YOURS',
    lRow.loaded && lRow.visible && lRow.btn);
  check('L1 the name is pre-filled from the photo\'s own filename stem',
    lRow.name === '1000299474', JSON.stringify(lRow.name));
  await page.fill('#libraryName', 'Test Character');
  await page.click('#libraryBtn');
  await page.waitForFunction(() =>
    document.getElementById('libraryStatus').textContent.indexOf('Saved to My Library') === 0);
  const l2 = await page.evaluate(() => {
    const items = window.CreatorLibrary.list();
    const r = items[0] || null;
    return {
      count: items.length,
      name: r && r.name,
      hasId: !!(r && /^lib_/.test(r.id)),
      hasCreatedAt: !!(r && r.createdAt),
      unowned: !!r && !r.cardId,          // no Magic Card in this profile
      pngIsDataURL: !!(r && typeof r.png === 'string' && r.png.indexOf('data:image/png') === 0),
      thumbIsDataURL: !!(r && typeof r.thumbnail === 'string' && r.thumbnail.indexOf('data:image/') === 0),
      creationFormat: r && r.creation && r.creation.format,
      creationVersion: r && r.creation && r.creation.version
    };
  });
  check('L2 saving with no platform configured lands ONE record in the local store',
    l2.count === 1 && l2.hasId && l2.hasCreatedAt, JSON.stringify({ count: l2.count }));
  check('L2 the record carries the child\'s own name for it', l2.name === 'Test Character');
  check('L2 with no Magic Card the record is unowned (a Traveller\'s save, claimable later)',
    l2.unowned);
  check('L2 the record is self-contained — placement PNG + thumbnail + creation JSON aboard',
    l2.pngIsDataURL && l2.thumbIsDataURL &&
    l2.creationFormat === 'vihu-creation' && l2.creationVersion === 2);
  // Round trip: the stored creation reopens as a real editable document
  // whose ORIGINAL layer matches the live one byte for byte on every
  // fully-opaque pixel (the same preservation standard as K6), and the
  // stored PNG decodes at the render's own dimensions.
  const l3 = await page.evaluate(async () => {
    const r = window.CreatorLibrary.list()[0];
    const live = window.__bia.creation;
    const reopened = await BIACreation.fromJSON(JSON.stringify(r.creation));
    const a = live.original.data, b = reopened.original.data;
    let opaqueMismatch = 0, opaque = 0;
    for (let p = 0; p < a.length; p += 4) {
      if (a[p + 3] !== 255) continue;
      opaque++;
      if (a[p] !== b[p] || a[p + 1] !== b[p + 1] || a[p + 2] !== b[p + 2]) opaqueMismatch++;
    }
    const bmp = await createImageBitmap(await (await fetch(r.png)).blob());
    const tbmp = await createImageBitmap(await (await fetch(r.thumbnail)).blob());
    const render = live.render();
    return {
      ops: reopened.ops.length === live.ops.length && reopened.cursor === live.cursor,
      opaque, opaqueMismatch,
      pngW: bmp.width, pngH: bmp.height,
      renderW: render.canvas.width, renderH: render.canvas.height,
      thumbMax: Math.max(tbmp.width, tbmp.height)
    };
  });
  check('L3 the stored creation reopens — same history, ORIGINAL byte-identical (opaque px)',
    l3.ops && l3.opaque > 10000 && l3.opaqueMismatch === 0,
    l3.opaque + ' opaque px, ' + l3.opaqueMismatch + ' mismatch');
  check('L3 the stored PNG decodes at the render\'s own size (or its 1600px downscale)',
    l3.pngW > 0 && (l3.pngW === l3.renderW || Math.max(l3.pngW, l3.pngH) === 1600),
    l3.pngW + 'x' + l3.pngH + ' vs render ' + l3.renderW + 'x' + l3.renderH);
  check('L3 the thumbnail is genuinely small (≤256px long edge)', l3.thumbMax <= 256,
    l3.thumbMax + 'px');
  // Durability: read the record back from IndexedDB itself, through a
  // completely fresh connection — never the store's own in-memory map.
  const l4 = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('vihu-creator-library');
    req.onerror = () => resolve({ error: 'open failed' });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['items']);
      const all = tx.objectStore('items').getAll();
      all.onsuccess = () => resolve({
        count: all.result.length,
        name: all.result[0] && all.result[0].name
      });
      all.onerror = () => resolve({ error: 'read failed' });
    };
  }));
  check('L4 the record is durable — read back from IndexedDB through a fresh connection',
    l4.count === 1 && l4.name === 'Test Character', JSON.stringify(l4));
  // Give the store's own 2s post-save sync debounce time to have fired,
  // then assert the whole section moved zero cross-origin bytes: with
  // no Magic Card there is nobody to attribute a cloud row to, so the
  // gate must hold BEFORE any network is touched.
  await page.waitForTimeout(2600);
  check('L5 network-silent: the save + sync window touched no outside host',
    crossOriginRequests.length === 0, crossOriginRequests.slice(0, 3).join(' | '));

  // ==========================================================================
  // CAMERA — the second way in (v0.3). Three environments, all real:
  //   · the MAIN browser: the API exists (127.0.0.1 is a secure context)
  //     but Playwright refuses the permission — the refused path, exactly
  //     as a child would meet it, must end in gentle words and a working
  //     picker;
  //   · a context with NO mediaDevices at all (the plain-http reality) —
  //     the step must be exactly as it was before the camera existed;
  //   · a SECOND browser launched with Chromium's fake camera serving
  //     test/camera-feed-001.y4m — the real Test Case 001 drawing at
  //     webcam resolution (whole page fitted into 1280×960; see
  //     make-camera-feed.js for the documented geometry) — driving the
  //     FULL pipeline from a live camera frame, ending in an extraction.
  // The section closes with the effectiveness measurement the camera was
  // built to answer: the same claim on the full-resolution upload and on
  // the camera frame, as numbers.
  console.log('\n== CAMERA — the second way in =============================');
  const feed = require('./make-camera-feed.js');
  const Y4M = feed.OUT;

  // Shared measurement: what did the pipeline keep of this claim?
  const MEASURE = () => {
    const st = window.__bia, seg = st.seg, a = st.asset;
    const d = a.imageData.data, cw = a.crop.w;
    let opaque = 0, paperish = 0;
    for (let y = 0; y < a.crop.h; y++) for (let x = 0; x < cw; x++) {
      const i4 = (y * cw + x) * 4;
      if (d[i4 + 3] !== 255) continue;
      opaque++;
      const gi = (a.crop.y + y) * seg.width + (a.crop.x + x);
      if (seg.paper[gi] - seg.lum[gi] < 12) paperish++;
    }
    return { mask: seg.maskCount, comps: seg.compCount, crop: a.crop,
             opaque, paperish, haloFrac: opaque ? paperish / opaque : 0,
             verified: st.lastExport ? st.lastExport.verified : null,
             png: st.lastExport ? st.lastExport.blob.size : null };
  };
  // Detected ink inside a box — the light-pencil probe (the ground line).
  const INKBOX = (b) => {
    const seg = window.__bia.seg, w = seg.width;
    let ink = 0, inMask = 0;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * w + x;
      if (seg.ink[i]) { ink++; if (seg.mask[i]) inMask++; }
    }
    return { ink, inMask };
  };
  // The main page still holds the left-character claim from MAKE IT YOURS —
  // the full-resolution upload's numbers, gathered before anything moves.
  const upNumbers = await page.evaluate(MEASURE);
  const upGround = await page.evaluate(INKBOX, R.groundBox);

  // ---- C1: both options stand side by side ---------------------------------
  console.log('\n-- C1: both options, side by side');
  await newPhotoFromAlive();
  await page.locator('#drop').scrollIntoViewIfNeeded();
  const c1 = await page.evaluate(() => ({
    onCapture: document.querySelector('#stepCapture').classList.contains('here'),
    cam: document.getElementById('cameraBtn').style.display !== 'none',
    pick: !!document.getElementById('pickBtn'),
    panelHidden: document.getElementById('cameraPanel').style.display === 'none',
    label: document.getElementById('cameraBtn').textContent
  }));
  check('C1 the camera option appears beside the picker, both first-class',
    c1.onCapture && c1.cam && c1.pick && c1.panelHidden, JSON.stringify(c1.label));
  await page.screenshot({ path: path.join(SHOTS, '8-capture-both-ways.png') });

  // ---- C2: permission refused → gentle words, the picker right there -------
  console.log('\n-- C2: the camera is refused (no permission granted)');
  await page.click('#cameraBtn');
  await page.waitForFunction(() =>
    document.getElementById('cameraQuiet').style.display === 'block');
  const c2 = await page.evaluate(() => ({
    text: document.getElementById('cameraQuiet').textContent,
    panel: document.getElementById('cameraPanel').style.display,
    log: document.querySelector('#devLog').textContent,
    pickVisible: !!document.getElementById('pickBtn').offsetParent
  }));
  check('C2 refused camera: one gentle line, never a technical word',
    c2.text.length > 10 &&
    !/fail|denied|error|device|permission|invalid|allowed|unsupported|secure/i.test(c2.text),
    JSON.stringify(c2.text));
  check('C2 the panel is closed and the picker is right there',
    c2.panel === 'none' && c2.pickVisible);
  check('C2 the honest reason went to the developer log',
    /camera: not available \(/.test(c2.log));
  // …and uploading still works after the refusal:
  await page.click('#testBtn');
  await page.waitForFunction(() =>
    document.querySelector('#stepClaim').classList.contains('here'), null, { timeout: 30000 });
  check('C2 uploading works untouched after the refusal', true);

  // ---- C3: no camera API at all → the step is exactly as today -------------
  console.log('\n-- C3: no camera API (the plain-http reality)');
  const noCamPage = await browser.newPage();
  const noCamErrors = [];
  noCamPage.on('pageerror', (e) => noCamErrors.push(String(e)));
  noCamPage.on('console', (m) => { if (m.type() === 'error') noCamErrors.push(m.text()); });
  await noCamPage.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'mediaDevices',
      { get: () => undefined, configurable: true });
  });
  await noCamPage.goto(BASE);
  await noCamPage.waitForFunction(() => window.__bia);
  const c3 = await noCamPage.evaluate(() => ({
    cam: document.getElementById('cameraBtn').style.display,
    quiet: document.getElementById('cameraQuiet').style.display
  }));
  await noCamPage.click('#testBtn');
  await noCamPage.waitForFunction(() =>
    document.querySelector('#stepClaim').classList.contains('here'), null, { timeout: 30000 });
  check('C3 no camera API: the option never appears and nothing is said',
    c3.cam === 'none' && c3.quiet !== 'block');
  check('C3 uploading works exactly as before, zero page errors',
    noCamErrors.length === 0, noCamErrors.slice(0, 2).join(' | '));
  await noCamPage.close();

  // ---- C4–C8: the real drawing through a real camera frame -----------------
  console.log('\n-- C4: the fake camera serves the real drawing');
  if (!fs.existsSync(Y4M)) {
    console.log('     (generating ' + path.basename(Y4M) + ' — first run)');
    await feed.generate(Y4M);
  }
  const camBrowser = await chromium.launch({ executablePath: CHROME, args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=' + Y4M
  ]});
  const cam = await camBrowser.newPage({ viewport: { width: 1100, height: 840 } });
  const camErrors = [];
  cam.on('pageerror', (e) => camErrors.push(String(e)));
  cam.on('console', (m) => { if (m.type() === 'error') camErrors.push(m.text()); });
  await cam.goto(BASE);
  await cam.waitForFunction(() => window.__bia);

  await cam.click('#cameraBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return document.getElementById('cameraPanel').style.display === 'block' &&
           v.videoWidth > 0;
  }, null, { timeout: 30000 });
  const c4 = await cam.evaluate(() => {
    const v = document.getElementById('cameraLive');
    return { w: v.videoWidth, h: v.videoHeight,
             logged: document.querySelector('#devLog').textContent
               .includes('camera: looking through the camera at ' +
                         v.videoWidth + 'x' + v.videoHeight) };
  });
  check('C4 the live preview runs at the camera’s native resolution',
    c4.w === feed.W && c4.h === feed.H && c4.logged, c4.w + 'x' + c4.h);
  await cam.waitForTimeout(400); // let a frame paint before the picture
  await cam.screenshot({ path: path.join(SHOTS, '9-camera-live.png') });

  console.log('\n-- C5: take the picture — light off while the child decides');
  await cam.click('#cameraTakeBtn');
  await cam.waitForFunction(() =>
    document.getElementById('cameraShot').style.display === 'block');
  const c5 = await cam.evaluate(() => {
    const v = document.getElementById('cameraLive');
    const c = document.getElementById('cameraShot');
    const tracks = v.srcObject ? v.srcObject.getTracks() : [];
    return { cw: c.width, ch: c.height,
             tracks: tracks.map((t) => t.readyState),
             use: !!document.getElementById('cameraUseBtn').offsetParent,
             retake: !!document.getElementById('cameraRetakeBtn').offsetParent };
  });
  check('C5 the shot is the native frame, never the CSS size',
    c5.cw === feed.W && c5.ch === feed.H, c5.cw + 'x' + c5.ch);
  check('C5 every track is ended the moment the picture is taken',
    c5.tracks.length > 0 && c5.tracks.every((s) => s === 'ended'),
    c5.tracks.join(','));
  check('C5 the choice is Use this one / Take it again', c5.use && c5.retake);

  // Take it again resumes a live camera, then take the real picture.
  await cam.click('#cameraRetakeBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.style.display === 'block' && v.videoWidth > 0 &&
           v.srcObject.getTracks().every((t) => t.readyState === 'live');
  }, null, { timeout: 30000 });
  check('C5 Take it again brings the live camera back', true);
  await cam.waitForTimeout(300);
  await cam.click('#cameraTakeBtn');
  await cam.waitForFunction(() =>
    document.getElementById('cameraShot').style.display === 'block');

  console.log('\n-- C6: Use this one → the same pipeline as an upload');
  await cam.click('#cameraUseBtn');
  await cam.waitForFunction(() =>
    window.__bia.photo && /^camera-\d+\.png$/.test(window.__bia.photo.filename),
    null, { timeout: 30000 });
  const c6 = await cam.evaluate(() => ({
    f: window.__bia.photo.filename,
    w: window.__bia.photo.width, h: window.__bia.photo.height,
    notes: (window.__bia.photo.notes || []).join(' | '),
    onClaim: document.querySelector('#stepClaim').classList.contains('here'),
    panel: document.getElementById('cameraPanel').style.display,
    log: document.querySelector('#devLog').textContent
  }));
  check('C6 the camera frame lands in the exact upload state shape',
    c6.w === feed.W && c6.h === feed.H && c6.onClaim && c6.panel === 'none',
    c6.f + ' ' + c6.w + 'x' + c6.h);
  check('C6 honest capture facts logged: native resolution and the page measurement',
    /camera: picture taken at native \d+x\d+/.test(c6.log) &&
    /deskew: page found \(\d+% of frame\)/.test(c6.notes),
    JSON.stringify(c6.notes.slice(0, 90)));

  console.log('\n-- C7: the full pipeline from a camera frame');
  const camMap = (p) => [Math.round(feed.OFFSET_X + p[0] * feed.SCALE),
                         Math.round(p[1] * feed.SCALE)];
  async function drawLoopOnCam(points) {
    const box = await cam.locator('#claimCanvas').boundingBox();
    const scale = await cam.evaluate(() => window.__bia.displayScale);
    const map = ([ix, iy]) => [box.x + ix * scale, box.y + iy * scale];
    const [sx, sy] = map(points[0]);
    await cam.mouse.move(sx, sy);
    await cam.mouse.down();
    for (const p of points) { const [x, y] = map(p); await cam.mouse.move(x, y); }
    const [ex, ey] = map(points[0]);
    await cam.mouse.move(ex, ey);
    await cam.mouse.up();
    await cam.waitForFunction(() =>
      document.querySelector('#stepRefine').classList.contains('here') ||
      document.querySelector('#nothingFound').style.display === 'block');
  }
  await drawLoopOnCam(R.leftClaim.map(camMap));
  check('C7 the claim on the camera frame reaches refine',
    await cam.locator('#stepRefine.here').count() === 1);
  await cam.click('#aliveBtn');
  await cam.waitForFunction(() => window.__bia.exports.length > 0, null, { timeout: 60000 });
  const camNumbers = await cam.evaluate(MEASURE);
  const camGround = await cam.evaluate(INKBOX, {
    x: Math.round(feed.OFFSET_X + R.groundBox.x * feed.SCALE),
    y: Math.round(R.groundBox.y * feed.SCALE),
    w: Math.round(R.groundBox.w * feed.SCALE),
    h: Math.round(R.groundBox.h * feed.SCALE) });
  check('C7 a real extraction came out of the camera frame',
    camNumbers.opaque > 1500 && camNumbers.verified > 1500 &&
    camNumbers.crop.w > 100 && camNumbers.crop.h > 80,
    camNumbers.opaque + ' opaque px, crop ' + camNumbers.crop.w + 'x' + camNumbers.crop.h);
  check('C7 the extraction is verified byte-identical to the camera frame',
    camNumbers.verified === camNumbers.opaque,
    camNumbers.verified + ' of ' + camNumbers.opaque + ' verified');
  await cam.locator('#yoursTools').scrollIntoViewIfNeeded();
  await cam.screenshot({ path: path.join(SHOTS, '10-camera-extracted.png') });

  // ---- C8: EFFECTIVENESS — the product owner's actual question -------------
  console.log('\n-- C8: effectiveness, camera vs upload — the same claim, as numbers');
  const f2 = (v) => (v * 100).toFixed(2) + '%';
  console.log('     upload  ' + '3472x4624: mask ' + upNumbers.mask + ' px, crop ' +
    upNumbers.crop.w + 'x' + upNumbers.crop.h + ', ' + upNumbers.opaque +
    ' opaque px, paper-halo ' + f2(upNumbers.haloFrac) +
    ', ground-line ink ' + upGround.ink + ' px detected');
  console.log('     camera  ' + feed.W + 'x' + feed.H + ':  mask ' + camNumbers.mask +
    ' px, crop ' + camNumbers.crop.w + 'x' + camNumbers.crop.h + ', ' + camNumbers.opaque +
    ' opaque px, paper-halo ' + f2(camNumbers.haloFrac) +
    ', ground-line ink ' + camGround.ink + ' px detected');
  console.log('     ratio   camera keeps ' +
    f2(camNumbers.opaque / upNumbers.opaque) + ' of the upload’s opaque pixels; ' +
    'ground line ' + (upGround.ink ? f2(camGround.ink / upGround.ink) : 'n/a') +
    ' of its detected ink');
  check('C8 the comparison ran on both paths (numbers above are the deliverable)',
    upNumbers.opaque > 10000 && camNumbers.opaque > 1500,
    'upload ' + upNumbers.opaque + ' vs camera ' + camNumbers.opaque + ' opaque px');
  check('C8 camera zero page errors', camErrors.length === 0,
    camErrors.slice(0, 3).join(' | '));

  // ---- C9: the frame has two shapes — Tall page ⇄ Wide page -----------------
  // The fixture is a LANDSCAPE 1280×960 feed, i.e. hardware that cannot
  // turn (a laptop webcam), so tall must be the centred crop at the tall
  // aspect — preview and capture alike, capture at NATIVE stream
  // resolution. The tall aspect is 4:5 (BIACamera.tallAspect()), WIDER
  // than the sheet's own 1:√2 by the product owner's field finding, so
  // the crop must CONTAIN the fixture's page with aiming margin either
  // side rather than land exactly on it. Wide must stay byte-identical
  // to what the camera always did.
  console.log('\n-- C9: Tall page ⇄ Wide page — the shape button');
  await cam.click('#aliveNewPhoto');
  await cam.click('#cameraBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return document.getElementById('cameraPanel').style.display === 'block' &&
           v.videoWidth > 0;
  }, null, { timeout: 30000 });
  const c9a = await cam.evaluate(() => {
    const btn = document.querySelector('#cameraPanel .bia-camera-shape');
    const v = document.getElementById('cameraLive');
    return { btn: !!btn && !!btn.offsetParent,
             label: btn ? btn.textContent : '(missing)',
             panelText: document.getElementById('cameraPanel').textContent,
             wide: v.clientWidth > v.clientHeight };
  });
  check('C9 the shape button is on the live preview, and the frame opens wide',
    c9a.btn && c9a.wide, JSON.stringify(c9a.label));
  check('C9 the panel speaks no jargon — child-facing words only',
    !/portrait|landscape|orientation|constraint|error|failed/i.test(c9a.panelText),
    JSON.stringify(c9a.label));
  await cam.waitForTimeout(400);
  await cam.locator('#cameraPanel').scrollIntoViewIfNeeded();
  await cam.screenshot({ path: path.join(SHOTS, '11-camera-wide-toggle.png') });
  // The wide baseline: a full-frame native capture, kept for byte
  // comparison after the round trip through tall and back.
  await cam.waitForTimeout(300);
  await cam.click('#cameraTakeBtn');
  await cam.waitForFunction(() =>
    document.getElementById('cameraShot').style.display === 'block');
  const c9w = await cam.evaluate(() => {
    const c = document.getElementById('cameraShot');
    window.__c9wide = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const btn = document.querySelector('#cameraPanel .bia-camera-shape');
    return { w: c.width, h: c.height, btnHidden: !btn.offsetParent };
  });
  check('C9 the wide baseline is the full native frame (and the shape button ' +
        'rests while the child decides)',
    c9w.w === feed.W && c9w.h === feed.H && c9w.btnHidden, c9w.w + 'x' + c9w.h);
  // Switch to tall: every old track ends (the light-off discipline), a new
  // stream arrives, and the preview goes tall.
  await cam.click('#cameraRetakeBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.style.display === 'block' && v.videoWidth > 0 &&
           v.srcObject.getTracks().every((t) => t.readyState === 'live');
  }, null, { timeout: 30000 });
  await cam.evaluate(() => {
    window.__c9tracks = document.getElementById('cameraLive').srcObject.getTracks();
  });
  await cam.click('#cameraPanel .bia-camera-shape');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.videoWidth > 0 && v.srcObject &&
           v.srcObject.getTracks().length > 0 &&
           v.srcObject.getTracks().every((t) => t.readyState === 'live') &&
           window.__c9tracks.every((t) => t.readyState === 'ended') &&
           v.clientHeight > v.clientWidth;
  }, null, { timeout: 30000 });
  const c9s = await cam.evaluate(() => {
    const v = document.getElementById('cameraLive');
    const btn = document.querySelector('#cameraPanel .bia-camera-shape');
    return { ended: window.__c9tracks.map((t) => t.readyState).join(','),
             label: btn.textContent,
             tall: v.clientHeight > v.clientWidth,
             fit: getComputedStyle(v).objectFit };
  });
  check('C9 switching stops every old track and the preview goes tall',
    c9s.ended === 'ended' && c9s.tall && c9s.fit === 'cover',
    c9s.ended + ' · ' + JSON.stringify(c9s.label));
  await cam.waitForTimeout(400);
  await cam.locator('#cameraPanel').scrollIntoViewIfNeeded();
  await cam.screenshot({ path: path.join(SHOTS, '12-camera-tall.png') });
  // The tall picture: the centred crop of the native frame, at native
  // resolution, every pixel byte-identical to the wide baseline at the
  // centred offset — which proves region, centring and resolution at once.
  await cam.click('#cameraTakeBtn');
  await cam.waitForFunction(() =>
    document.getElementById('cameraShot').style.display === 'block');
  const c9t = await cam.evaluate(() => {
    const c = document.getElementById('cameraShot');
    const wide = window.__c9wide;
    const a = BIACamera.tallAspect();                    // 4:5 — the real number
    const expW = Math.round(wide.height * a);            // landscape feed → full height
    const expX = Math.round((wide.width - expW) / 2);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const wd = wide.data;
    let mismatch = -1;
    if (c.width === expW && c.height === wide.height) {
      mismatch = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const p = (y * c.width + x) * 4, q = (y * wide.width + (x + expX)) * 4;
          if (d[p] !== wd[q] || d[p + 1] !== wd[q + 1] || d[p + 2] !== wd[q + 2]) mismatch++;
        }
      }
    }
    // The centre of the crop is the middle of the page — bright paper,
    // nothing like the dim room (#232028).
    const mid = ((c.height >> 1) * c.width + (c.width >> 1)) * 4;
    return { w: c.width, h: c.height, expW, expX, mismatch, aspect: a,
             midSum: d[mid] + d[mid + 1] + d[mid + 2],
             log: document.querySelector('#devLog').textContent };
  });
  check('C9 the tall picture is the 4:5 tall-page crop at NATIVE resolution',
    c9t.w === c9t.expW && c9t.h === feed.H, c9t.w + 'x' + c9t.h +
    ' (expected ' + c9t.expW + 'x' + feed.H + ')');
  check('C9 the tall frame is WIDER than the sheet — real aiming margin ' +
        '(field finding: "the tall page needs to be a bit wider")',
    Math.abs(c9t.aspect - 0.8) < 1e-9 && c9t.aspect > 1 / Math.SQRT2,
    'w:h ' + c9t.aspect.toFixed(3) + ' vs sheet ' + (1 / Math.SQRT2).toFixed(3));
  check('C9 the crop is centred — byte-identical to the wide frame at the ' +
        'centred offset',
    c9t.mismatch === 0, 'mismatch ' + c9t.mismatch + ' at offset x=' + c9t.expX);
  // Against the fixture's own documented geometry: the page pillar-boxes
  // at [OFFSET_X, OFFSET_X + round(3472·SCALE)). At the sheet's exact
  // aspect the crop landed wholly inside the page — zero margin, the
  // field complaint. At 4:5 the crop must CONTAIN the whole page with
  // aiming room on BOTH sides, and bright paper at its centre.
  const pageR = feed.OFFSET_X + Math.round(3472 * feed.SCALE);
  check('C9 the crop contains the whole page WITH aiming margin either side',
    c9t.expX < feed.OFFSET_X && c9t.expX + c9t.w > pageR && c9t.midSum > 350,
    'crop x ' + c9t.expX + '..' + (c9t.expX + c9t.w) + ' around page ' +
    feed.OFFSET_X + '..' + pageR + ' (margin ' + (feed.OFFSET_X - c9t.expX) +
    '/' + (c9t.expX + c9t.w - pageR) + 'px), centre rgb sum ' + c9t.midSum);
  check('C9 the honest crop facts went to the developer log',
    /camera: picture taken at native \d+x\d+ \(the middle of \d+x\d+\)/.test(c9t.log));
  // And back to wide: the capture is byte-comparable to the pre-toggle
  // behaviour — the exact full frame, nothing remembered from tall.
  await cam.click('#cameraRetakeBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.style.display === 'block' && v.videoWidth > 0;
  }, null, { timeout: 30000 });
  await cam.click('#cameraPanel .bia-camera-shape');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.videoWidth > 0 && v.clientWidth > v.clientHeight &&
           v.srcObject.getTracks().every((t) => t.readyState === 'live');
  }, null, { timeout: 30000 });
  await cam.waitForTimeout(300);
  await cam.click('#cameraTakeBtn');
  await cam.waitForFunction(() =>
    document.getElementById('cameraShot').style.display === 'block');
  const c9b = await cam.evaluate(() => {
    const c = document.getElementById('cameraShot');
    const wide = window.__c9wide;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let mismatch = -1;
    if (c.width === wide.width && c.height === wide.height) {
      mismatch = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] !== wide.data[i] || d[i + 1] !== wide.data[i + 1] ||
            d[i + 2] !== wide.data[i + 2]) mismatch++;
      }
    }
    return { w: c.width, h: c.height, mismatch };
  });
  check('C9 back to wide: full-frame capture byte-comparable to the ' +
        'pre-toggle behaviour',
    c9b.w === feed.W && c9b.h === feed.H && c9b.mismatch === 0,
    c9b.w + 'x' + c9b.h + ', mismatch ' + c9b.mismatch);
  // The child chose wide with their own press — a journey's stated
  // preference must not override that for the rest of the session.
  await cam.click('#cameraCloseBtn');
  await cam.evaluate(() => BIACamera.setPreferredShape('tall'));
  await cam.click('#cameraBtn');
  await cam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return document.getElementById('cameraPanel').style.display === 'block' &&
           v.videoWidth > 0;
  }, null, { timeout: 30000 });
  const c9p = await cam.evaluate(() => {
    const v = document.getElementById('cameraLive');
    return { wide: v.clientWidth > v.clientHeight };
  });
  check('C9 the child\'s own choice wins — a journey preference never ' +
        'overrides it', c9p.wide);
  await cam.click('#cameraCloseBtn');

  // ---- C10: My Handwriting opens the camera tall, untouched -----------------
  // A fresh page (nobody has pressed the shape button): arming the
  // handwriting journey makes the camera open TALL by default, and the
  // button still stands to go wide. The drawing journey's wide default is
  // C4/C5's own assertion, unchanged above.
  console.log('\n-- C10: My Handwriting opens the camera tall by default');
  const hwCam = await camBrowser.newPage({ viewport: { width: 1100, height: 840 } });
  const hwCamErrors = [];
  hwCam.on('pageerror', (e) => hwCamErrors.push(String(e)));
  hwCam.on('console', (m) => { if (m.type() === 'error') hwCamErrors.push(m.text()); });
  await hwCam.goto(BASE);
  await hwCam.waitForFunction(() => window.__bia && window.__hw);
  await hwCam.click('#hwEntryBtn');
  await hwCam.click('#hwWroteBtn');           // arms the journey
  await hwCam.click('#cameraBtn');
  await hwCam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return document.getElementById('cameraPanel').style.display === 'block' &&
           v.videoWidth > 0;
  }, null, { timeout: 30000 });
  const c10 = await hwCam.evaluate(() => {
    const v = document.getElementById('cameraLive');
    const btn = document.querySelector('#cameraPanel .bia-camera-shape');
    return { tall: v.clientHeight > v.clientWidth,
             label: btn ? btn.textContent : '(missing)',
             armed: window.__hw.armed === true };
  });
  check('C10 armed for handwriting, the camera opens TALL with nothing pressed',
    c10.armed && c10.tall && /Wide page/.test(c10.label), JSON.stringify(c10.label));
  await hwCam.click('#cameraPanel .bia-camera-shape');
  await hwCam.waitForFunction(() => {
    const v = document.getElementById('cameraLive');
    return v.videoWidth > 0 && v.clientWidth > v.clientHeight;
  }, null, { timeout: 30000 });
  check('C10 the button still stands in the handwriting journey — one press ' +
        'goes wide', true);
  check('C10 zero page errors through the handwriting arm + tall camera',
    hwCamErrors.length === 0, hwCamErrors.slice(0, 2).join(' | '));
  await hwCam.close();
  await camBrowser.close();

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
