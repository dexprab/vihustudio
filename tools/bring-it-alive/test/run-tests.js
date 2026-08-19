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
  await page.screenshot({ path: path.join(SHOTS, '3-after.png') });
  await page.click('#devStrip summary');
  await page.waitForTimeout(200);
  await page.locator('#devStrip').screenshot({ path: path.join(SHOTS, '4-preservation.png') });

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
