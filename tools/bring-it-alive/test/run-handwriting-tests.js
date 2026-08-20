/* MY HANDWRITING — verification suite.
 *
 * Drives the REAL page end to end: presses the real entry button, arms
 * the real capture step, feeds a photograph through the real file input,
 * and asserts on what the journey actually produced — the alphabet the
 * child would see, the refusals, and the font bytes themselves.
 *
 * The fixture is a DETERMINISTIC SYNTHETIC FILLED SHEET: the page's own
 * HWSheet.draw renders the sheet, and the model text is then written
 * onto the rules in a jittered handwriting-ish style — per-letter
 * baseline wobble, rotation, size variation and spacing jitter, all from
 * a SEEDED generator (mulberry32; Math.random appears nowhere), so every
 * run reads the same sheet. Ground truth is the drawn letters' own
 * positions, which is what makes the mislabel assertions exact.
 *
 * Eight scenarios:
 *   HW-N  two journeys, two blocks — the entry screen presents the
 *         drawing journey and the font journey as equal, separate
 *         blocks; the shared camera machinery wears each journey's own
 *         words; backing out of one never leaks state into the other.
 *   HW-J  five reading cards — the printable is five bordered cards
 *         with dashed cut lines between them (the product owner: "try
 *         designing the page as 5 reding cards, and than kid can show
 *         each card 1 by 1"); the blank is TALLER than the sheet era's;
 *         the border, dashes and scissors mark are invisible to the
 *         reader (never ink, never an anchor — the tilted-page-edge
 *         guard extended to the card border, asserted); a card shown
 *         STILL ATTACHED reads exactly like the cut card; and the WIDE
 *         frame buys the close-up pixels, measured against the tall-era
 *         hold.
 *   HW-F  free motion — the camera collects the cards ONE AT A TIME, in
 *         any order (fake-camera y4m cut-card close-ups in the WIDE
 *         frame, one Chromium launch each): correct identity 5/5, zero
 *         mislabels, latest-wins replace, the quiet five-slot row,
 *         Done-early, an ATTACHED card collecting exactly like a cut
 *         one, the whole-ladder frame filling all five at once, a sweep
 *         accumulating three cards in one launch, and nothing collected
 *         from a drawing or an unwritten card. The upload path never
 *         touches the loop.
 *   HW-G  the page never blocks — the analysis lives in a Web Worker
 *         (js/hwLiveWorker.js) behind a downscaled prepass and hard
 *         per-frame budgets: a main-thread heartbeat stays under 120ms
 *         across a noisy no-sheet room (the field freeze's own scene
 *         shape — measured 12.4s a frame on the main thread before) AND
 *         during a real collection; over-cap frames skip silently with
 *         no child-facing word; nothing is sampled before the preview
 *         renders (videoWidth 0).
 *   HW-A  the sheet itself — geometry, coverage of a–z + A–Z + digits,
 *         the printed no-cursive callout, print.
 *   HW-B  a complete filled sheet — every letter captured, every accepted
 *         letter standing where its ground truth stands (NONE mislabeled),
 *         baselines consistent, and the font: parses, renders, differs
 *         from the fallback, cap-height measured from the child's own
 *         capitals, rebuilds byte-identical.
 *   HW-C  the refuse rule — one line's words welded into touching blobs →
 *         that line contributes NOTHING (skipped, never mislabeled); one
 *         letter never written ('x') → exactly one quiet empty slot; the
 *         font's cmap simply lacks it; and per-line recovery brings the
 *         welded line back from a clean re-photograph.
 *   HW-D  "this looks joined-up" — a welded line gets the holding-hands
 *         message (not the generic retake); a line with only two touching
 *         pairs keeps the generic one; most lines welded → ONE gentle
 *         sheet-level message, and still zero letters accepted anywhere
 *         a weld ran.
 *   HW-E  a real camera — the fixture warped by a TRUE projective
 *         transform carrying the field failure's own numbers (page ~68%
 *         of a 720p frame, edges ~20°/8° off square) plus blur and JPEG:
 *         the end-mark ladder registers it, every line reads, zero
 *         mislabels; an upside-down photo is turned around and read; a
 *         drawing and a half page refuse kindly; a 640×360 photo keeps
 *         what it can and says, kindly, that the photo is far away; and
 *         an old sheet with no marks still reads square-on through the
 *         rule fallback.
 *
 * DISCLOSED: this verifies the journey against synthetic handwriting.
 * Real child handwriting — real-paper lighting, pencil pressure, letters
 * that touch — is exactly what the product owner will try in the tool.
 *
 * Run:
 *   node test/serve.js 8765 &
 *   NODE_PATH=/opt/node22/lib/node_modules node test/run-handwriting-tests.js
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const opentype = require(path.join(__dirname, '..', 'vendor', 'opentype.min.js'));

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.BIA_PORT || 8765;
const BASE = `http://127.0.0.1:${PORT}/tools/bring-it-alive/`;
const SHOTS = path.resolve(__dirname, '..', 'screenshots');

// ---- tiny harness (same shape as run-tests.js) -----------------------------
let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok  ' + name + (detail ? '  (' + detail + ')' : '')); }
  else { failed++; failures.push(name + (detail ? '  (' + detail + ')' : ''));
         console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : '')); }
}

/* The synthetic filled sheet, composed IN PAGE through the real
 * HWSheet.draw so the fixture and the printable sheet cannot drift.
 * Shared with the fake-camera feed generator — see test/hw-fixture.js
 * for the contract. */
const { COMPOSE } = require(path.join(__dirname, 'hw-fixture.js'));


/* A REAL CAMERA, synthesised honestly: the flat fixture warped by a TRUE
 * projective transform (unit square → quad, inverse-mapped with bilinear
 * sampling over a desk-grey background), softened a touch and re-encoded
 * as JPEG — the same degradations the field photo carried. Returns a
 * dataURL. */
const WARP = `(args) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const W = img.width, H = img.height;
    const sc = document.createElement('canvas');
    sc.width = W; sc.height = H;
    const sx = sc.getContext('2d', { willReadFrequently: true });
    sx.drawImage(img, 0, 0);
    const S = sx.getImageData(0, 0, W, H).data;
    const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = args.quad; // tl tr br bl
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const sxx = x0 - x1 + x2 - x3, syy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dy1 * dx2;
    const g = (sxx * dy2 - syy * dx2) / den;
    const h = (dx1 * syy - dy1 * sxx) / den;
    const M = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
               y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    const [a,b,c,d,e,f,g2,h2,i2] = M;
    const A = e*i2 - f*h2, B = c*h2 - b*i2, C = b*f - c*e;
    const D2 = f*g2 - d*i2, E = a*i2 - c*g2, F = c*d - a*f;
    const G = d*h2 - e*g2, H2 = b*g2 - a*h2, I3 = a*e - b*d;
    const det = a*A + b*D2 + c*G;
    const I = [A/det, B/det, C/det, D2/det, E/det, F/det, G/det, H2/det, I3/det];
    const fw = args.frameW, fh = args.frameH;
    const dc = document.createElement('canvas');
    dc.width = fw; dc.height = fh;
    const dctx = dc.getContext('2d', { willReadFrequently: true });
    dctx.fillStyle = args.bg || '#6a7180';
    dctx.fillRect(0, 0, fw, fh);
    const out = dctx.getImageData(0, 0, fw, fh);
    const D = out.data;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const w3 = I[6]*x + I[7]*y + I[8];
        const u = (I[0]*x + I[1]*y + I[2]) / w3;
        const v = (I[3]*x + I[4]*y + I[5]) / w3;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        const fx = Math.min(W - 1.001, Math.max(0, u * W - 0.5));
        const fy = Math.min(H - 1.001, Math.max(0, v * H - 0.5));
        const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
        const p00 = (iy * W + ix) * 4, p10 = p00 + 4;
        const p01 = p00 + W * 4, p11 = p01 + 4;
        const dd = (y * fw + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          D[dd+ch] = (S[p00+ch]*(1-ax)+S[p10+ch]*ax)*(1-ay) +
                     (S[p01+ch]*(1-ax)+S[p11+ch]*ax)*ay;
        }
        D[dd+3] = 255;
      }
    }
    dctx.putImageData(out, 0, 0);
    const bc = document.createElement('canvas');
    bc.width = fw; bc.height = fh;
    const bctx = bc.getContext('2d');
    bctx.filter = 'blur(' + (args.blur == null ? 0.5 : args.blur) + 'px)';
    bctx.drawImage(dc, 0, 0);
    resolve(bc.toDataURL('image/jpeg', args.quality == null ? 0.85 : args.quality));
  };
  img.src = args.dataURL;
})`;

// The same forward homography in Node, for carrying the ground truth
// through the warp (mislabel checks compare x-extents per line).
function homographyTo(quad, W, H) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dy1 * dx2;
  const g = (sx * dy2 - sy * dx2) / den;
  const h = (dx1 * sy - dy1 * sx) / den;
  const M = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
             y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  return (x, y) => {
    const u = x / W, v = y / H;
    const w3 = M[6] * u + M[7] * v + M[8];
    return [(M[0] * u + M[1] * v + M[2]) / w3,
            (M[3] * u + M[4] * v + M[5]) / w3];
  };
}
function warpGt(made, quad) {
  const f = homographyTo(quad, made.W, made.H);
  return made.gt.map((g) => {
    const y = made.ruleYs[g.line];
    const a = f(g.x0, y)[0], b = f(g.x1, y)[0];
    return { line: g.line, ch: g.ch, x0: Math.min(a, b), x1: Math.max(a, b) };
  });
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHABET = LOWER + UPPER + DIGITS;
const SORTED = [...ALPHABET].sort().join(''); // window.__hw.samples keys come back sorted

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__hw && window.__bia);

  // ---- helpers --------------------------------------------------------------
  async function compose(opts) {
    const made = await page.evaluate(`(${COMPOSE})(${JSON.stringify(opts)})`);
    made.buffer = Buffer.from(made.dataURL.split(',')[1], 'base64');
    return made;
  }
  // Warp a composed sheet through the true projective camera; the ground
  // truth travels through the same homography.
  async function warp(made, quad, frameW, frameH, extra) {
    const args = Object.assign({ dataURL: made.dataURL, quad, frameW, frameH }, extra);
    const dataURL = await page.evaluate(`(${WARP})(${JSON.stringify(args)})`);
    return { buffer: Buffer.from(dataURL.split(',')[1], 'base64'),
             dataURL, name: 'camera.jpg', mime: 'image/jpeg',
             gt: warpGt(made, quad) };
  }
  // The REAL journey: the entry button, the armed capture step, the real
  // file input app.js owns.
  async function feed(made, viaRetakeLine) {
    if (viaRetakeLine == null) {
      if (await page.evaluate(() => window.__hw.stage) !== 'sheet') {
        await page.click('#hwEntryBtn');
      }
      await page.click('#hwWroteBtn');
    } else {
      await page.click(`#hwLineList button[data-line="${viaRetakeLine}"]`);
    }
    await page.setInputFiles('#fileInput',
      { name: made.name || 'filled-sheet.png',
        mimeType: made.mime || 'image/png', buffer: made.buffer });
    await page.waitForFunction(() =>
      window.__hw.stage === 'alphabet' || window.__hw.stage === 'sheet',
      null, { timeout: 180000 });
    return page.evaluate(() => window.__hw.stage);
  }
  const lettersData = (pg) => (pg || page).evaluate(() => ({
    lines: window.__hw.lines.map((ln) => ({
      index: ln.index, found: ln.found, accepted: ln.accepted || 0,
      expected: ln.expected || 0, unit: ln.unit,
      touching: ln.touching || 0, joined: !!ln.joined,
      letters: (ln.letters || []).map((l) => ({
        ch: l.ch, kind: l.kind, accepted: l.accepted, refused: l.refused,
        x0: l.blobX0, x1: l.blobX1,
        below: l.sample ? l.sample.belowBase : null,
        top: l.sample ? l.sample.topAbove : null
      }))
    })),
    have: Array.from(window.__hw.samples.keys()).sort().join('')
  }));
  function mislabels(data, gt) {
    const bad = [];
    for (const ln of data.lines) {
      if (!ln.found) continue;
      for (const l of ln.letters) {
        if (!l.accepted) continue;
        const ok = gt.some((g) => g.line === ln.index && g.ch === l.ch &&
          Math.min(g.x1, l.x1) - Math.max(g.x0, l.x0) >
            0.4 * Math.min(g.x1 - g.x0, l.x1 - l.x0));
        if (!ok) bad.push(ln.index + 1 + ':' + l.ch + '@' + l.x0);
      }
    }
    return bad;
  }
  const fontBytes = async () => Buffer.from(await page.evaluate(() =>
    Array.from(new Uint8Array(window.__hw.font.buffer))));

  // ==== HW-N: two journeys, two blocks =======================================
  // Field finding: "give me another block for generating fonts. currently
  // am getting confused wether am generating font or art." The entry
  // screen presents TWO blocks of equal standing; the shared camera
  // machinery wears each journey's own words; and backing out of one
  // journey never leaks state into the other.
  console.log('\n== HW-N: TWO JOURNEYS, TWO BLOCKS ==========================');
  {
    const entry = await page.evaluate(() => {
      const draw = document.getElementById('drawJourney');
      const hw = document.getElementById('hwJourney');
      return {
        blocks: document.querySelectorAll('#stepCapture .journey').length,
        drawHead: draw.querySelector('h2').textContent,
        hwHead: hw.querySelector('h2').textContent,
        hwEntryInDraw: !!draw.querySelector('#hwEntryBtn'),
        hwEntryInHw: !!hw.querySelector('#hwEntryBtn'),
        drawText: draw.innerText,
        hwShown: !!hw.offsetParent
      };
    });
    check('N1 the entry screen presents TWO blocks — a drawing journey and a font journey',
      entry.blocks === 2 && /drawing to life/i.test(entry.drawHead) &&
      /My Handwriting/i.test(entry.hwHead) && entry.hwShown,
      '"' + entry.drawHead + '" · "' + entry.hwHead + '"');
    check('N2 nothing about the font journey starts inside the drawing block',
      !entry.hwEntryInDraw && entry.hwEntryInHw &&
      !/handwriting|font|letters/i.test(entry.drawText),
      'entry button lives in the handwriting block');
    await page.screenshot({ path: path.join(SHOTS, '16-two-journey-blocks.png') });

    // Armed, the shared capture step speaks HANDWRITING everywhere a
    // child can see — one camera, two framings.
    await page.click('#hwEntryBtn');
    await page.waitForSelector('#stepHwSheet.here');
    await page.click('#hwWroteBtn');
    await page.waitForSelector('#stepCapture.here');
    const armed = await page.evaluate(() => ({
      title: document.getElementById('captureTitle').textContent,
      drop: document.getElementById('dropWords').textContent,
      note: document.getElementById('cameraNote').textContent,
      hwBlockHidden: !document.getElementById('hwJourney').offsetParent,
      extrasHidden: !document.getElementById('drawExtras').offsetParent,
      testHidden: !document.getElementById('testBtn').offsetParent
    }));
    check('N3 armed, the capture step is visibly the FONT journey (title, drop, camera line — and the words say CARDS)',
      /My Handwriting/.test(armed.title) && /written page/.test(armed.drop) &&
      /one card at a time/.test(armed.note) && armed.hwBlockHidden &&
      armed.extrasHidden && armed.testHidden,
      '"' + armed.title + '" · "' + armed.note + '"');

    // Back out: the drawing framing returns byte for byte, and a drawing
    // fed now lands in the drawing CLAIM — never the line reader.
    await page.click('#hwDisarmBtn');
    await page.waitForSelector('#stepHwSheet.here');
    await page.click('#hwSheetBack');
    await page.waitForSelector('#stepCapture.here');
    const disarmed = await page.evaluate(() => ({
      title: document.getElementById('captureTitle').textContent,
      drop: document.getElementById('dropWords').textContent,
      note: document.getElementById('cameraNote').textContent,
      hwShown: !!document.getElementById('hwJourney').offsetParent
    }));
    check('N4 backing out restores the drawing framing byte for byte',
      disarmed.title === 'Bring a drawing to life' &&
      disarmed.drop === 'Drop a photograph of your drawing here' &&
      /your drawing up/.test(disarmed.note) && disarmed.hwShown,
      '"' + disarmed.title + '"');
    const surrogatePng = fs.readFileSync(path.join(__dirname, 'surrogate-001.png'));
    await page.setInputFiles('#fileInput',
      { name: 'drawing.png', mimeType: 'image/png', buffer: surrogatePng });
    await page.waitForSelector('#stepClaim.here');
    const leak = await page.evaluate(() => ({
      stage: window.__hw.stage, armed: window.__hw.armed,
      lines: window.__hw.lines
    }));
    check('N5 a drawing fed after backing out lands in the drawing claim — no state leaks',
      leak.stage === 'idle' && !leak.armed && leak.lines === null,
      'hw stage ' + leak.stage);
    await page.click('#claimNewPhoto');
    await page.waitForSelector('#stepCapture.here');
  }

  // ==== HW-A: the writing sheet ==============================================
  console.log('\n== HW-A: THE WRITING SHEET =================================');
  const sheetFacts = await page.evaluate(() => {
    const counts = {};
    for (const ln of HWSheet.LINES) {
      for (const ch of ln.text) { if (ch !== ' ') counts[ch] = (counts[ch] || 0) + 1; }
    }
    return { counts, lines: HWSheet.LINES.length,
             aspect: HWSheet.GEOM.aspect };
  });
  {
    const missing = [], once = [];
    for (const ch of ALPHABET) {
      const n = sheetFacts.counts[ch] || 0;
      if (n === 0) missing.push(ch);
      else if (n < 2 && !UPPER.includes(ch)) once.push(ch);
    }
    check('A1 the model lines cover a–z, A–Z and 0–9', missing.length === 0,
      missing.length ? 'missing ' + missing.join('') : '62 characters');
    check('A2 every lowercase letter and digit appears MORE THAN ONCE',
      once.length === 0, once.length ? 'only once: ' + once.join('') : 'min 2, letters 3');
    const capOnce = [...UPPER].filter((ch) => (sheetFacts.counts[ch] || 0) >= 1);
    check('A2b every capital appears at least ONCE (one line — single sample, disclosed)',
      capOnce.length === 26, capOnce.length + '/26');
    check('A3 the sheet is ' + sheetFacts.lines + ' model lines on A4 proportions',
      sheetFacts.lines === 5 && Math.abs(sheetFacts.aspect - Math.SQRT2) < 1e-9);
  }
  await page.click('#hwEntryBtn');
  await page.waitForSelector('#stepHwSheet.here');
  {
    const drawn = await page.evaluate(() => window.__hw.sheetDrawn);
    check('A4 the sheet is drawn from HWSheet.GEOM (5 rules, even pitch)',
      drawn.lines.length === 5 &&
      Math.abs((drawn.lines[1].ruleY - drawn.lines[0].ruleY) -
               (drawn.lines[4].ruleY - drawn.lines[3].ruleY)) < 1,
      'pitch ' + Math.round(drawn.lines[1].ruleY - drawn.lines[0].ruleY) + 'px');
    const printable = await page.evaluate(() => {
      const c = document.getElementById('hwPrintCanvas');
      return { w: c.width, h: c.height,
               css: getComputedStyle(document.getElementById('hwPrintArea')).display };
    });
    check('A5 the printable copy is rendered crisp and hidden on screen',
      printable.w === 1600 && printable.css === 'none',
      printable.w + 'px wide, display ' + printable.css);
    // The no-cursive callout: asserted against the RENDER, not the
    // constant — fillText is observed during a real HWSheet.draw.
    const callout = await page.evaluate(() => {
      const drawnStrings = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
        drawnStrings.push(String(t));
        return orig.call(this, t, ...a);
      };
      try { HWSheet.draw(document.createElement('canvas'), 800); }
      finally { CanvasRenderingContext2D.prototype.fillText = orig; }
      return { printed: drawnStrings.includes(HWSheet.CALLOUT),
               text: HWSheet.CALLOUT };
    });
    check('A6 the no-cursive callout is PRINTED on the sheet render',
      callout.printed, '"' + callout.text + '"');
    check('A7 the callout is child words — no jargon, no blame',
      /hold hands/.test(callout.text) &&
      !/cursive|wrong|failed|invalid|error|don.t|never/i.test(callout.text));
  }
  await page.screenshot({ path: path.join(SHOTS, '11-handwriting-sheet.png') });

  // ==== HW-J: five reading cards =============================================
  // The product owner, verbatim: "i would say instead of reading one full
  // page, try designing the page as 5 reding cards, and than kid can show
  // each card 1 by 1. this will make life easier on both ends." The page
  // is five bordered cards with dashed cut lines between them. Everything
  // a card adds to the print — the border, the dashes, the scissors mark
  // — must be INVISIBLE to the reader (the tilted-page-edge lesson,
  // extended to the card border and asserted); a card shown STILL
  // ATTACHED must read exactly like the cut card (cutting is never
  // required); and the WIDE camera frame must actually buy the close-up
  // pixels the design promises.
  console.log('\n== HW-J: FIVE READING CARDS ================================');
  {
    const layout = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const drawn = HWSheet.draw(c, 2000);
      const G = HWSheet.GEOM;
      return {
        cards: drawn.cards.length,
        cuts: drawn.cuts.length,
        cutsBetween: drawn.cuts.every((y, k) =>
          y > drawn.cards[k].y1 && y < drawn.cards[k + 1].y0),
        cardsHoldLines: drawn.cards.every((card, i) =>
          drawn.lines[i].zoneTop > card.y0 && drawn.lines[i].zoneBottom < card.y1),
        blank: G.ascent + G.descent, ascent: G.ascent
      };
    });
    check('J1 the page is FIVE bordered cards with FOUR dashed cut lines between them',
      layout.cards === 5 && layout.cuts === 4 && layout.cutsBetween &&
      layout.cardsHoldLines,
      layout.cards + ' cards, ' + layout.cuts + ' cut lines, each blank inside its card');
    // The blank grew because the sheet era's page header (0.103·H) went
    // to the cards: blank 0.116·H → measured here, ascent 0.082·H → here.
    // The border/cut overheads cap the gain — reported honestly, in mm.
    const SHEET_ERA = { blank: 0.116, ascent: 0.082 };
    check('J2 the ruled blank is TALLER than the sheet era\'s — the old header went to the blanks',
      layout.blank > SHEET_ERA.blank && layout.ascent > SHEET_ERA.ascent,
      'blank ' + (layout.blank * 297).toFixed(1) + 'mm on A4 vs ' +
      (SHEET_ERA.blank * 297).toFixed(1) + 'mm (+' +
      Math.round((layout.blank / SHEET_ERA.blank - 1) * 100) + '%); ascent ' +
      (layout.ascent * 297).toFixed(1) + 'mm vs ' + (SHEET_ERA.ascent * 297).toFixed(1) + 'mm');

    // The frame-component guard, extended to the card furniture: the
    // border and the cut dashes wear the rule's own sub-ink-margin grey
    // (never ink → they can never weld a letter or enter the font), the
    // scissors mark wears the number grey (far below the end-mark
    // darkness gate → it can never impersonate an anchor). Asserted
    // against the real segmentation of the real render, not the colours.
    const guard = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const drawn = HWSheet.draw(c, 2000);
      const W = c.width, H = c.height;
      const photo = { width: W, height: H,
        imageData: c.getContext('2d').getImageData(0, 0, W, H), filename: 'blank' };
      const loop = [[1, 1], [W - 2, 1], [W - 2, H - 2], [1, H - 2]];
      const seg = BIASegment.segment(photo, BIAClaim.claim(loop, W, H));
      let borderInk = 0, borderN = 0;
      for (const card of drawn.cards) {
        for (let x = Math.round(card.x0) + 30; x < card.x1 - 30; x += 5) {
          // the scissors mark straddles the cut area, deliberately dark
          // enough to see — its own gate is J4; skip its column here
          if (Math.abs(x - 0.5 * W) < 0.03 * W) continue;
          for (const y of [Math.round(card.y0), Math.round(card.y1)]) {
            borderN++;
            if (seg.ink[y * W + x]) borderInk++;
          }
        }
        for (let y = Math.round(card.y0) + 30; y < card.y1 - 30; y += 5) {
          for (const x of [Math.round(card.x0), Math.round(card.x1)]) {
            borderN++;
            if (seg.ink[y * W + x]) borderInk++;
          }
        }
      }
      let cutInk = 0, cutN = 0;
      for (const y of drawn.cuts) {
        for (let x = 30; x < W - 30; x += 3) {
          if (Math.abs(x - 0.5 * W) < 0.03 * W) continue; // the scissors mark — dark on purpose, gated below
          cutN++;
          if (seg.ink[Math.round(y) * W + x]) cutInk++;
        }
      }
      const { marks } = HWRead.collectMarks(seg);
      const G = HWSheet.GEOM;
      const anchors = [];
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        anchors.push([G.anchorXLeft * W, HWSheet.ruleYFrac(i) * H]);
        anchors.push([G.anchorXRight * W, HWSheet.ruleYFrac(i) * H]);
      }
      const nearAnchor = (m) => anchors.some(([ax, ay]) =>
        Math.hypot(m.cx - ax, m.cy - ay) < 0.01 * W);
      const furnitureMarks = marks.filter((m) => !nearAnchor(m) && (
        drawn.cuts.some((y) => Math.abs(m.cy - y) < 0.008 * H) ||
        drawn.cards.some((card) =>
          Math.abs(m.cy - card.y0) < 0.004 * H || Math.abs(m.cy - card.y1) < 0.004 * H ||
          Math.abs(m.cx - card.x0) < 0.004 * W || Math.abs(m.cx - card.x1) < 0.004 * W)));
      const ladder = HWRead.findLadder(seg, function () {});
      const rungsOnAnchors = !!ladder && ladder.rungs.every((r) =>
        nearAnchor(r.L) && nearAnchor(r.R));
      return { borderInk, borderN, cutInk, cutN,
               furnitureMarks: furnitureMarks.length, rungsOnAnchors };
    });
    check('J3 the card borders and cut lines are NOT ink to the reader — they can never weld a letter or enter the font',
      guard.borderInk === 0 && guard.cutInk === 0,
      guard.borderN + ' border px + ' + guard.cutN + ' cut-line px sampled, ' +
      (guard.borderInk + guard.cutInk) + ' read as ink');
    check('J4 no dash, border or scissors mark passes the end-mark gate — card furniture can never impersonate an anchor',
      guard.furnitureMarks === 0,
      guard.furnitureMarks + ' candidate mark(s) on card furniture');
    check('J5 the ladder still registers on exactly the ten anchor stars',
      guard.rungsOnAnchors);

    // ATTACHED reads exactly like CUT — per card, through the very same
    // readFrame the live loop runs. The two frames differ only in what
    // stands OUTSIDE the card (neighbour slivers and cut lines vs desk),
    // so the verdicts must be identical: same card named, the same
    // letters accepted. This is "cutting is never required" as an
    // assertion, and it is also the border guard at work in close-up —
    // the attached frame has two cut lines and two neighbour borders in
    // view, the cut frame has four raw paper edges against the desk.
    for (let i = 0; i < 5; i++) {
      const r = await page.evaluate(`(async () => {
        const i = ${i};
        const made = (${COMPOSE})({ seed: 7, width: 2000 });
        const img = new Image();
        await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
        const G = HWSheet.GEOM;
        const SW = img.width, SH = img.height;
        const fw = 1280, fh = 960;
        const frameOf = (cut) => {
          const c = document.createElement('canvas');
          c.width = fw; c.height = fh;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.fillStyle = '#5f6673';
          x.fillRect(0, 0, fw, fh);
          const blockTop = (G.blockTop0 + i * G.blockStep) * SH;
          if (cut) {
            const dw = Math.round(0.94 * fw);
            const scale = dw / SW;
            const dh = G.blockStep * SH * scale;
            x.drawImage(img, 0, blockTop, SW, G.blockStep * SH,
                        (fw - dw) / 2, (fh - dh) / 2, dw, dh);
          } else {
            const bandTop = blockTop - 0.02 * SH;
            const bandH = (G.blockStep + 0.04) * SH;
            const scale = fw / SW;
            const dh = bandH * scale;
            x.drawImage(img, 0, bandTop, SW, bandH, 0, (fh - dh) / 2, fw, dh);
          }
          return { width: fw, height: fh,
                   imageData: x.getImageData(0, 0, fw, fh), filename: 'f' };
        };
        const read = (photo) => {
          const out = HWRead.readFrame(photo, { log: function () {} });
          return { kind: out.kind, index: out.index,
            accepted: out.kind === 'line'
              ? out.line.letters.filter((l) => l.accepted).map((l) => l.ch).join('') : null,
            exp: out.kind === 'line' ? out.line.expected : null,
            xh: out.capture ? Math.round(out.capture.xHeightPx) : null };
        };
        return { attached: read(frameOf(false)), cut: read(frameOf(true)) };
      })()`);
      check('J6.' + (i + 1) + ' card ' + (i + 1) + ' STILL ATTACHED reads exactly like the cut card (same identity, same letters)',
        r.attached.kind === 'line' && r.cut.kind === 'line' &&
        r.attached.index === i && r.cut.index === i &&
        r.attached.accepted === r.cut.accepted &&
        r.cut.accepted.length >= r.cut.exp - 2,
        r.cut.accepted ? r.cut.accepted.length + '/' + r.cut.exp +
          ' letters, both frames' : JSON.stringify(r));
    }

    // The wide frame fits a hand-held card with real margin — from the
    // geometry itself: a cut card is the page's full width by one block.
    const fit = await page.evaluate(() => {
      const G = HWSheet.GEOM;
      const cardAspect = G.blockStep * G.aspect;   // card height / card width
      const fw = 1280, fh = 960;
      const dh = 0.94 * fw * cardAspect;
      return { cardAspect, usedH: dh / fh, marginFrac: (fh - dh) / 2 / fh };
    });
    check('J7 a hand-held card fits the WIDE frame with margin (the card is ~4× wider than tall)',
      fit.cardAspect < 0.3 && fit.usedH < 0.5 && fit.marginFrac > 0.2,
      'card h:w ' + fit.cardAspect.toFixed(2) + '; at 94% width it uses ' +
      Math.round(fit.usedH * 100) + '% of the frame height, ' +
      Math.round(fit.marginFrac * 100) + '% aiming margin above and below');

    // The resolution win, in numbers: the SAME cut card read at the wide
    // hold (94% of the wide frame's columns) and at the tall-era hold
    // (the child aimed inside the old 4:5 tall crop, so a card could
    // span at most 94% of its 768 columns). The wide frame is what buys
    // the pixels — measured, not asserted from hope.
    const win = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000 });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const G = HWSheet.GEOM;
      const SW = img.width, SH = img.height;
      const fw = 1280, fh = 960;
      const readAt = (span) => {
        const c = document.createElement('canvas');
        c.width = fw; c.height = fh;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.fillStyle = '#5f6673'; x.fillRect(0, 0, fw, fh);
        const cardTop = G.blockTop0 * SH, cardH = G.blockStep * SH;
        const scale = span / SW, dh = cardH * scale;
        x.drawImage(img, 0, cardTop, SW, cardH,
                    (fw - span) / 2, (fh - dh) / 2, span, dh);
        const out = HWRead.readFrame(
          { width: fw, height: fh,
            imageData: x.getImageData(0, 0, fw, fh), filename: 'f' },
          { log: function () {} });
        return out.kind === 'line'
          ? { xh: out.capture.xHeightPx, measured: out.capture.xHeightMeasured }
          : { xh: 0, measured: false };
      };
      const tallCols = Math.round((4 / 5) * fh);   // the old tall crop's width
      return { wide: readAt(Math.round(0.94 * fw)),
               tall: readAt(Math.round(0.94 * tallCols)),
               floor: HWRead.PARAMS.COARSE_XH };
    })()`);
    check('J8 the WIDE frame buys the pixels: the card\'s measured x-height clears the coarse floor with room, ≥1.4× the tall-era hold',
      win.wide.measured && win.wide.xh >= win.floor + 5 &&
      win.tall.xh > 0 && win.wide.xh >= 1.4 * win.tall.xh,
      'wide hold ~' + win.wide.xh.toFixed(1) + 'px vs tall-era hold ~' +
      win.tall.xh.toFixed(1) + 'px (coarse floor ' + win.floor + 'px) — ' +
      (win.wide.xh / win.tall.xh).toFixed(2) + '× the camera pixels per letter');

    // The look-alike-ladder regression. With the LEFT stars hidden, a
    // 640×360 field-warp frame once grew a phantom ladder — the true
    // right-anchor column paired with a collinear diagonal of letter
    // blobs — that passed every pattern gate and registered the page
    // half a pitch high, and the DP then "confidently" accepted wrong
    // letters. The model-print witness (MODEL_BAND_MIN) now refuses it:
    // solid print must stand above ALL FIVE implied rules. Refusal, not
    // misreading, is the assertion — refuse-rather-than-guess absolute.
    const noLeftURL = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000 });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const G = HWSheet.GEOM, W = c.width;
      const R = G.anchorRadius * W * 1.6;
      x.fillStyle = '#ffffff';
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        const y = HWSheet.ruleYFrac(i) * c.height;
        x.fillRect(G.anchorXLeft * W - R, y - R, 2 * R, 2 * R);
      }
      return c.toDataURL('image/png');
    })()`);
    const QUAD_LOW = [[80, 5], [612, 7], [562, 356], [209, 353]];
    const noLeftLow = await page.evaluate(`(${WARP})(${JSON.stringify(
      { dataURL: noLeftURL, quad: QUAD_LOW, frameW: 640, frameH: 360, blur: 0.4 })})`);
    const phantom = await page.evaluate(`(async (durl) => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = durl; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const logs = [];
      const out = HWRead.read(
        { width: c.width, height: c.height,
          imageData: x.getImageData(0, 0, c.width, c.height), filename: 'p' },
        { log: (l) => logs.push(l) });
      return { ok: out.ok, refusedBy: logs.filter((l) => /REFUSED/.test(l)).join(' | ') };
    })(${JSON.stringify(noLeftLow)})`);
    check('J9 half the stars hidden → a look-alike ladder can form, and it is REFUSED, never read wrong',
      phantom.ok === false && /REFUSED/.test(phantom.refusedBy),
      phantom.refusedBy.slice(0, 110) || 'read ok (should have refused)');
  }

  // ==== HW-B: the complete sheet =============================================
  console.log('\n== HW-B: A COMPLETE FILLED SHEET ===========================');
  const clean = await compose({ seed: 7, width: 2000, omit: '' });
  check('B1 the synthetic sheet is deterministic (seeded, no Math.random)',
    (await compose({ seed: 7, width: 2000, omit: '' }))
      .buffer.equals(clean.buffer),
    clean.buffer.length + ' bytes twice');
  {
    const stage = await feed(clean);
    check('B2 the journey reaches the alphabet through the real capture entry',
      stage === 'alphabet', 'stage ' + stage);
    const capB = await page.evaluate(() => window.__hw.capture);
    check('B2b the sheet registered by its END-MARKS (anchors 10 of 10, not the rule fallback)',
      capB && capB.anchors === 10 && Math.abs(capB.anis - 1) < 0.05,
      capB ? 'anchors ' + capB.anchors + ', vertical scale ' + capB.anis.toFixed(2) : 'no capture facts');
    // The UPLOAD path never goes near the live loop: no frame was ever
    // sampled — the whole-sheet read above is byte-for-byte the path
    // that existed before free motion did.
    const liveB = await page.evaluate(() => ({
      samples: window.__hw.live.samples, running: window.__hw.live.running,
      row: document.getElementById('hwLiveRow').style.display
    }));
    check('B2c the upload path never touches the live loop (zero frames sampled)',
      liveB.samples === 0 && !liveB.running && liveB.row !== 'block',
      liveB.samples + ' samples');
    const data = await lettersData();
    check('B3 every letter, every CAPITAL and every digit was captured',
      data.have === SORTED, data.have.length + '/62: ' + data.have);
    const totals = data.lines.reduce((a, l) => ({ acc: a.acc + l.accepted, exp: a.exp + l.expected }),
      { acc: 0, exp: 0 });
    check('B4 the lines aligned essentially in full', totals.acc >= totals.exp - 10,
      totals.acc + ' of ' + totals.exp + ' letters accepted');
    const bad = mislabels(data, clean.gt);
    check('B5 NO accepted letter is mislabeled (each stands on its own ground truth)',
      bad.length === 0, bad.length ? bad.slice(0, 5).join(' ') : totals.acc + ' letters checked');
    // Baseline consistency: letters without descenders sit ON the rule.
    // Q and J are excluded like gjpqy: in the fixture's serif face the
    // Q tail (and J hook) genuinely dip below the baseline.
    const sitters = [];
    for (const ln of data.lines) {
      for (const l of ln.letters) {
        if (l.accepted && !'gjpqyQJ'.includes(l.ch)) sitters.push(l.below);
      }
    }
    const xh = await page.evaluate(() => {
      const s = window.__hw.samples.get('x') || window.__hw.samples.get('n');
      return s.topAbove;
    });
    const worst = Math.max(...sitters.map(Math.abs));
    check('B6 baselines are consistent: every non-descender rests on the rule',
      sitters.length > 60 && worst <= 0.35 * xh,
      sitters.length + ' letters, worst ' + worst.toFixed(1) + 'px of x-height ' + Math.round(xh) + 'px');
    // The empty-slot grid never shows here — all 62 present.
    const emptySlots = await page.locator('.hw-slot.empty').count();
    check('B7 the alphabet grid shows all 62 slots filled', emptySlots === 0,
      emptySlots + ' empty');
    const capSlots = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-slot'))
        .map((s) => s.dataset.ch).join(''));
    check('B7b the grid carries the capitals row A–Z (lowercase · capitals · digits)',
      capSlots === 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      capSlots.length + ' slots');
  }

  console.log('\n== HW-B: THE FONT ==========================================');
  {
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const bytes1 = await fontBytes();
    const font = opentype.parse(bytes1.buffer.slice(bytes1.byteOffset, bytes1.byteOffset + bytes1.length));
    check('B8 the built font PARSES (opentype.js reads its own tables back)',
      font.glyphs.length >= 64 && !!font.tables.cmap && !!font.tables.os2,
      font.glyphs.length + ' glyphs, tables ' + Object.keys(font.tables).join(','));
    let unmapped = '';
    for (const ch of ALPHABET) {
      if (!font.charToGlyphIndex(ch)) unmapped += ch;
    }
    check('B9 the cmap maps all of a–z, A–Z, 0–9 and space',
      unmapped === '' && font.charToGlyphIndex(' ') > 0,
      unmapped ? 'unmapped: ' + unmapped : '63 mapped');
    check('B10 metrics are the measured ones: 1000/em, x-height → 500 units',
      font.unitsPerEm === 1000 &&
      (await page.evaluate(() => window.__hw.font.report.xHeightPx)) > 8,
      'upem ' + font.unitsPerEm + ', x-height ' +
      (await page.evaluate(() => Math.round(window.__hw.font.report.xHeightPx))) + 'px');
    // Non-descender glyphs rest at baseline 0 in FONT units too.
    const path0 = font.charToGlyph('n').getBoundingBox();
    check('B11 the rule became y=0: “n” sits on the font baseline',
      Math.abs(path0.y1) <= 90, 'n yMin ' + Math.round(path0.y1));
    const desc = font.charToGlyph('g').getBoundingBox();
    check('B12 descenders descend: “g” reaches below the baseline', desc.y1 < -60,
      'g yMin ' + Math.round(desc.y1));
    // Cap-height: MEASURED from the child's own capitals, no longer the
    // ascender fallback. Two witnesses that must agree: our own report
    // (median capital ink top × scale) and the font's OS/2 sCapHeight,
    // which the assembler takes from a real capital glyph's outline.
    const capFacts = await page.evaluate(() => ({
      capHeight: window.__hw.font.report.capHeight,
      capMeasured: window.__hw.font.report.capMeasured,
      ascender: window.__hw.font.report.ascender
    }));
    check('B12b cap-height is MEASURED from the capitals (not the ascender fallback)',
      capFacts.capMeasured && capFacts.capHeight < capFacts.ascender &&
      capFacts.capHeight > 500,
      'capHeight ' + capFacts.capHeight + ' vs ascender-fallback ' + capFacts.ascender);
    const os2Cap = font.tables.os2.sCapHeight;
    check('B12c OS/2 sCapHeight agrees with the measured capitals (±12%)',
      Math.abs(os2Cap - capFacts.capHeight) <= 0.12 * capFacts.capHeight,
      'sCapHeight ' + os2Cap + ' vs measured ' + capFacts.capHeight);
    const capBox = font.charToGlyph('H').getBoundingBox();
    check('B12d “H” stands cap-height tall on the baseline',
      Math.abs(capBox.y1) <= 90 && capBox.y2 > 550,
      'H yMin ' + Math.round(capBox.y1) + ', yMax ' + Math.round(capBox.y2));

    // The preview: rendered with the REAL FontFace, measured against the
    // fallback rendering of the same sentence.
    const probe = await page.evaluate(async () => {
      const sentence = 'my very own letters 123';
      const c = document.createElement('canvas');
      c.width = 900; c.height = 120;
      const x = c.getContext('2d', { willReadFrequently: true });
      const draw = (fam) => {
        x.clearRect(0, 0, c.width, c.height);
        x.fillStyle = '#000';
        x.font = '48px ' + fam;
        x.fillText(sentence, 10, 80);
        return { w: x.measureText(sentence).width,
                 px: Array.from(x.getImageData(0, 0, c.width, c.height).data) };
      };
      await document.fonts.load('48px "My Handwriting Preview"');
      const mine = draw('"My Handwriting Preview", Georgia, serif');
      const fall = draw('Georgia, serif');
      let diff = 0;
      for (let i = 3; i < mine.px.length; i += 4) {
        if ((mine.px[i] > 127) !== (fall.px[i] > 127)) diff++;
      }
      return { mineW: mine.w, fallW: fall.w, diff };
    });
    check('B13 the sentence renders in the child’s font: width > 0',
      probe.mineW > 0, Math.round(probe.mineW) + 'px');
    check('B14 …and the rendering measurably differs from the fallback font',
      probe.diff > 2000 && Math.abs(probe.mineW - probe.fallW) > 1,
      probe.diff + ' px differ, width ' + Math.round(probe.mineW) + ' vs ' + Math.round(probe.fallW));

    // Byte-determinism: rebuild from the same sheet, compare every byte.
    await page.click('#hwBackToLetters');
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test');
    const bytes2 = await fontBytes();
    check('B15 rebuilding from the same sheet is BYTE-DETERMINISTIC',
      bytes1.equals(bytes2), bytes1.length + ' bytes twice');
    await page.fill('#hwTryInput', 'my very own letters 123');
    await page.screenshot({ path: path.join(SHOTS, '13-handwriting-type-test.png') });
  }

  // ==== HW-C: the refuse rule ================================================
  console.log('\n== HW-C: REFUSE RATHER THAN GUESS ==========================');
  const CORRUPT = 1; // line 2 — every word ≥ 3 letters, so nothing 1:1 survives
  const variant = await compose({ seed: 7, width: 2000, omit: 'x', corruptLines: [CORRUPT] });
  {
    await page.click('#hwTestNewSheet');
    await page.waitForSelector('#stepHwSheet.here');
    const stage = await feed(variant);
    check('C1 the corrupted sheet still reaches the alphabet', stage === 'alphabet');
    const data = await lettersData();
    const l2 = data.lines[CORRUPT];
    check('C2 the welded line contributes NOTHING: every letter skipped, none accepted',
      l2.accepted === 0 && l2.expected === 30,
      l2.accepted + ' accepted of ' + l2.expected);
    const kinds = {};
    for (const l of l2.letters) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
    check('C3 the skips are honest refusals: touching blobs and missing letters',
      (kinds.touching || 0) >= 15 && !l2.letters.some((l) => l.accepted),
      JSON.stringify(kinds));
    const bad = mislabels(data, variant.gt);
    check('C4 NOTHING anywhere is mislabeled — the refuse rule as an assertion',
      bad.length === 0, bad.length ? bad.slice(0, 5).join(' ') : 'all accepted letters on their own ground truth');
    check('C5 the never-written letter is honestly absent (x and only x)',
      data.have === SORTED.replace('x', ''),
      'have ' + data.have.length + '/62, missing "' +
      [...ALPHABET].filter((c) => !data.have.includes(c)).join('') + '"');
    const emptySlots = await page.locator('.hw-slot.empty').count();
    const emptyCh = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-slot.empty')).map((s) => s.dataset.ch).join(''));
    check('C6 the grid shows exactly one QUIET EMPTY SLOT, at x', emptySlots === 1 && emptyCh === 'x');
    await page.locator('#hwGrid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '12-handwriting-alphabet.png') });

    // Child-safe language on the whole journey's surface.
    const words = await page.evaluate(() => document.querySelector('.wrap').innerText);
    check('C7 no blaming word on the surface (failed/invalid/error/wrong)',
      !/failed|invalid|error|wrong/i.test(words.replace(/Developer.*$/s, '')));

    // Per-line recovery: “write this line once more”, never start-over.
    const stage2 = await feed(clean, CORRUPT);
    check('C8 re-photographing ONE line brings it back', stage2 === 'alphabet');
    const data2 = await lettersData();
    check('C9 the welded line now reads in full from the retake',
      data2.lines[CORRUPT].accepted >= 28,
      data2.lines[CORRUPT].accepted + ' of ' + data2.lines[CORRUPT].expected);
    check('C10 the other lines kept their letters (the retake replaced ONE line)',
      data2.lines[0].accepted >= 25 && data2.lines[2].accepted >= 24 &&
      data2.lines[3].accepted >= 22 && data2.lines[4].accepted >= 18,
      [0, 2, 3, 4].map((i) => data2.lines[i].accepted + '/' + data2.lines[i].expected).join(' '));

    // The variant font: absent letters are ABSENT FROM THE CMAP.
    // (x was written nowhere — including the retake, which came from the
    // clean sheet… which HAS x. So rebuild the miss first.)
    const data3 = await lettersData();
    if (data3.have.includes('x')) {
      // the retake photograph carried an x; drop back to the pure variant
      await page.click('#hwNewSheetBtn');
      await feed(variant);
    }
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const vb = await fontBytes();
    const vfont = opentype.parse(vb.buffer.slice(vb.byteOffset, vb.byteOffset + vb.length));
    check('C11 a letter never captured is simply ABSENT from the cmap (falls back, never blank)',
      vfont.charToGlyphIndex('x') === 0 && vfont.charToGlyphIndex('a') > 0,
      'x → glyph 0 (.notdef unmapped), a → glyph ' + vfont.charToGlyphIndex('a'));
  }

  // ==== HW-D: “this looks joined-up” =========================================
  console.log('\n== HW-D: THIS LOOKS JOINED-UP ==============================');
  {
    // ONE welded line → the holding-hands message on that row, generic
    // everywhere else, no sheet-level banner.
    await page.click('#hwTestNewSheet');
    await page.waitForSelector('#stepHwSheet.here');
    const welded = await compose({ seed: 7, width: 2000, omit: '', corruptLines: [CORRUPT] });
    const stage = await feed(welded);
    check('D1 the welded sheet reaches the alphabet', stage === 'alphabet');
    const data = await lettersData();
    check('D2 the welded line is CLASSIFIED joined-up (touching dominates)',
      data.lines[CORRUPT].joined && data.lines[CORRUPT].touching >=
        0.5 * data.lines[CORRUPT].expected,
      data.lines[CORRUPT].touching + '/' + data.lines[CORRUPT].expected + ' touching');
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D3 that row says the letters are holding hands, and asks for little spaces',
      /holding hands/.test(rows[CORRUPT]) && /little space/.test(rows[CORRUPT]) &&
      /once more/.test(rows[CORRUPT]),
      '"' + rows[CORRUPT].slice(0, 90) + '…"');
    check('D4 every other row keeps the generic count text',
      rows.every((t, i) => i === CORRUPT ||
        (/of \d+ letters/.test(t) && !/holding hands/.test(t))));
    let banner = await page.evaluate(() =>
      document.getElementById('hwJoinedNote').style.display);
    check('D5 one joined line does NOT raise the sheet-level message',
      banner !== 'block', 'display ' + banner);
    check('D6 the refuse rule holds on the welded line: 0 accepted, 0 mislabels',
      data.lines[CORRUPT].accepted === 0 && mislabels(data, welded.gt).length === 0,
      data.lines[CORRUPT].accepted + ' accepted');
    await page.locator('#hwLineList').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '14-handwriting-joined-line.png') });

    // TWO touching pairs → merely messy: generic retake, not joined-up.
    const pairs = await compose({ seed: 7, width: 2000, omit: '', pairLine: 0, pairCount: 2 });
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const stage2 = await feed(pairs);
    check('D7 the two-pairs sheet reaches the alphabet', stage2 === 'alphabet');
    const dp = await lettersData();
    check('D8 two touching pairs stay BELOW the joined-up gates (thresholds behave)',
      !dp.lines[0].joined && dp.lines[0].touching >= 2 &&
      dp.lines[0].touching < 0.35 * dp.lines[0].expected,
      dp.lines[0].touching + '/' + dp.lines[0].expected + ' touching, ' +
      dp.lines[0].accepted + ' accepted');
    const rows2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D9 that line keeps the GENERIC retake message',
      /of \d+ letters/.test(rows2[0]) && rows2.every((t) => !/holding hands/.test(t)),
      '"' + rows2[0] + '"');
    check('D10 the touched letters were refused, never mislabeled — the rest read',
      mislabels(dp, pairs.gt).length === 0 &&
      dp.lines[0].accepted >= dp.lines[0].expected - 8,
      dp.lines[0].accepted + '/' + dp.lines[0].expected + ' accepted');

    // MOST lines welded → the child writes joined-up throughout: ONE
    // gentle sheet-level message, said once, with the rows kept generic.
    const cursive = await compose({ seed: 7, width: 2000, omit: '', corruptLines: [0, 1, 2] });
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const stage3 = await feed(cursive);
    check('D11 the mostly-welded sheet reaches the alphabet', stage3 === 'alphabet');
    const dm = await lettersData();
    banner = await page.evaluate(() =>
      document.getElementById('hwJoinedNote').style.display);
    check('D12 most lines joined → the sheet-level message appears',
      banner === 'block' && dm.lines.filter((l) => l.joined).length >= 3,
      dm.lines.filter((l) => l.joined).length + ' joined lines, display ' + banner);
    const surface = await page.evaluate(() => ({
      count: (document.querySelector('.wrap').innerText.match(/hold hands/g) || []).length,
      note: document.getElementById('hwJoinedNote').textContent
    }));
    check('D13 …exactly ONCE — not four copies of the line-level one',
      surface.count === 1 && /little space/.test(surface.note),
      surface.count + ' occurrence(s): "' + surface.note.slice(0, 70) + '…"');
    const rows3 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D14 the line rows stay generic under the sheet-level message',
      rows3.every((t) => !/holding hands/.test(t)));
    // Every word on lines 1–3 is ≥2 letters (line 1's old one-letter “a”
    // left with the old pangram), so a welded line contributes nothing.
    check('D15 welded lines still contribute NOTHING: 0 accepted where welds ran, 0 mislabels',
      dm.lines[0].accepted <= 1 && dm.lines[1].accepted === 0 &&
      dm.lines[2].accepted === 0 && mislabels(dm, cursive.gt).length === 0,
      [0, 1, 2].map((i) => dm.lines[i].accepted + '/' + dm.lines[i].expected).join(' '));
    check('D16 no blame word in either joined-up message',
      !/failed|invalid|error|wrong|cursive/i.test(rows.join(' ') + ' ' + surface.note));
  }

  // ==== HW-E: a real camera — end-marks under perspective ====================
  console.log('\n== HW-E: A REAL CAMERA — END-MARKS UNDER PERSPECTIVE =======');
  {
    // The field failure's own numbers: page ~68% of a 1280×720 frame,
    // left edge ~20.2° off vertical, right ~8.1° — a webcam looking down
    // at a sheet on the desk (which is also why the page lands vertically
    // foreshortened). E1 documents that the fixture really carries them.
    const QUAD = [[160, 10], [1224, 14], [1124, 712], [418, 706]]; // tl tr br bl
    const deg = (dx, dy) => Math.atan2(dx, dy) * 180 / Math.PI;
    const leftTilt = deg(QUAD[3][0] - QUAD[0][0], QUAD[3][1] - QUAD[0][1]);
    const rightTilt = deg(QUAD[1][0] - QUAD[2][0], QUAD[2][1] - QUAD[1][1]);
    let area2 = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = QUAD[i], [bx, by] = QUAD[(i + 1) % 4];
      area2 += ax * by - bx * ay;
    }
    const coverage = Math.abs(area2 / 2) / (1280 * 720);
    check('E1 the camera fixture matches the field photo (tilts ~20.2°/~8.1°, page ~68% of 720p frame)',
      Math.abs(leftTilt - 20.2) < 1 && Math.abs(rightTilt - 8.1) < 1 &&
      coverage > 0.62 && coverage < 0.72,
      'left ' + leftTilt.toFixed(1) + '° right ' + rightTilt.toFixed(1) +
      '° coverage ' + Math.round(coverage * 100) + '%');

    const eClean = await compose({ seed: 7, width: 2000, omit: '' });
    const cam = await warp(eClean, QUAD, 1280, 720);
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const stage = await feed(cam);
    check('E2 the warped 720p photo reaches the alphabet', stage === 'alphabet');
    const cap = await page.evaluate(() => window.__hw.capture);
    check('E3 the anchor ladder was found under the warp (10 of 10 end-marks)',
      cap && cap.anchors === 10, cap ? 'anchors ' + cap.anchors : 'no capture facts');
    check('E3b the measured vertical squash matches the camera (per-line registration, not a flat guess)',
      cap && cap.anis > 0.4 && cap.anis < 0.75,
      'vertical scale ' + (cap ? cap.anis.toFixed(2) : '—') + '× the horizontal');
    const dE = await lettersData();
    check('E4 EVERY line reads under the warp (each within 2 letters of full)',
      dE.lines.every((l) => l.found && l.accepted >= l.expected - 2),
      dE.lines.map((l) => l.accepted + '/' + l.expected).join(' '));
    const badE = mislabels(dE, cam.gt);
    check('E5 ZERO mislabels under the warp — refuse-rather-than-guess holds at 720p',
      badE.length === 0, badE.length ? badE.slice(0, 5).join(' ')
        : dE.lines.reduce((a, l) => a + l.accepted, 0) + ' letters checked');
    // At this distance the letters land ~10 camera pixels tall: the read
    // is complete but the traced glyphs are honestly blocky, so the kind
    // coarse note is CORRECT here — and absent on the flat sheet (B).
    const coarseE = await page.evaluate(() => ({
      coarse: window.__hw.capture.coarse,
      xh: window.__hw.capture.xHeightPx,
      shown: document.getElementById('hwCoarseNote').style.display === 'block',
      text: document.getElementById('hwCoarseNote').textContent
    }));
    check('E6 the capture facts are honest: x-height measured in camera pixels, under the floor',
      coarseE.xh > 5 && coarseE.xh < 14, 'x-height ~' + Math.round(coarseE.xh) + 'px');
    check('E7 the kind coarse note shows — closer or a phone photo — with no blame word',
      coarseE.coarse && coarseE.shown && /closer/.test(coarseE.text) &&
      /phone/.test(coarseE.text) && !/failed|invalid|error|wrong|small for/i.test(coarseE.text),
      '"' + coarseE.text.slice(0, 60) + '…"');
    const logE = await page.evaluate(() => document.getElementById('devLog').textContent);
    check('E8 the dev log carries the capture facts (anchors n of 10, per-line tilt, x-height)',
      /anchors 10 of 10/.test(logE) && /line tilt/.test(logE) && /x-height/.test(logE));
    await page.locator('#hwGrid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '15-handwriting-camera-alphabet.png') });

    // Upside down: the ladder is top-bottom symmetric, so the reader asks
    // the sheet (the title block) — a clearly inverted photo is turned
    // around and read, never refused and never misread.
    const flipped = await page.evaluate(async (durl) => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = durl; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.translate(c.width, c.height); x.rotate(Math.PI);
      x.drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.92);
    }, cam.dataURL);
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const stageF = await feed({ buffer: Buffer.from(flipped.split(',')[1], 'base64'),
                                name: 'camera-upside-down.jpg', mime: 'image/jpeg' });
    const capF = await page.evaluate(() => window.__hw.capture);
    const dF = await lettersData();
    check('E9 an upside-down photo is TURNED AROUND and read (never refused, never misread)',
      stageF === 'alphabet' && capF && capF.flipped && capF.anchors === 10,
      'stage ' + stageF + ', flipped ' + (capF && capF.flipped));
    check('E10 …and reads like the right way up: every line, zero mislabels',
      dF.lines.every((l) => l.found && l.accepted >= l.expected - 3) &&
      mislabels(dF, cam.gt).length === 0,
      dF.lines.map((l) => l.accepted + '/' + l.expected).join(' '));

    // A photo of something else entirely still refuses with kind words.
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const garbage = fs.readFileSync(path.join(__dirname, 'surrogate-001.png'));
    const stageG = await feed({ buffer: garbage, name: 'drawing.png' });
    const quietG = await page.evaluate(() => ({
      shown: document.getElementById('hwQuietSheet').style.display === 'block',
      text: document.getElementById('hwQuietSheet').textContent
    }));
    check('E11 a photo of something else REFUSES (no ladder can be invented from a drawing)',
      stageG === 'sheet' && quietG.shown, 'stage ' + stageG);
    check('E12 …with the kind retake words, never blame',
      /lay the sheet flat/.test(quietG.text) &&
      !/failed|invalid|error|wrong/i.test(quietG.text));

    // Half a page: three rungs are not a ladder, and the faint rules
    // cannot rescue a perspective photo — refused, never guessed.
    const half = await page.evaluate(async (durl) => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = durl; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = Math.round(img.height * 0.55);
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.92);
    }, cam.dataURL);
    const stageH = await feed({ buffer: Buffer.from(half.split(',')[1], 'base64'),
                                name: 'half.jpg', mime: 'image/jpeg' });
    check('E13 half a page REFUSES (the ladder is matched whole or not at all)',
      stageH === 'sheet');

    // Low resolution: the same camera twice as far away. Everything that
    // can read still reads, nothing is mislabeled, and the child is told
    // kindly that the photo is a little far away.
    const low = await warp(eClean, QUAD.map(([x, y]) => [x / 2, y / 2]), 640, 360,
                           { blur: 0.4 });
    const stageL = await feed(low);
    check('E14 a 640×360 photo still reads what it can', stageL === 'alphabet');
    const capL = await page.evaluate(() => window.__hw.capture);
    const dL = await lettersData();
    const gotL = dL.lines.reduce((a, l) => a + l.accepted, 0);
    check('E15 the coarse note appears at low resolution (and letters were still kept)',
      capL && capL.coarse && gotL >= 40 &&
      await page.evaluate(() => document.getElementById('hwCoarseNote').style.display === 'block'),
      gotL + ' letters kept, x-height ~' + Math.round(capL.xHeightPx) + 'px');
    check('E16 zero mislabels even at 640×360 — refusals rise, guesses never',
      mislabels(dL, low.gt).length === 0, gotL + ' accepted letters checked');

    // A sheet printed BEFORE the end-marks existed: the rule-pattern
    // fallback still reads it square-on (the marks are painted out of the
    // fixture, simulating an old printout).
    const markless = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000, omit: '' });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const G = HWSheet.GEOM, W = c.width;
      const R = G.anchorRadius * W * 1.8;
      x.fillStyle = '#ffffff';
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        const y = HWSheet.ruleYFrac(i) * c.height;
        x.fillRect(G.anchorXLeft * W - R, y - R, 2 * R, 2 * R);
        x.fillRect(G.anchorXRight * W - R, y - R, 2 * R, 2 * R);
      }
      return c.toDataURL('image/png');
    })()`);
    await page.click('#hwNewSheetBtn');
    await page.waitForSelector('#stepHwSheet.here');
    const stageM = await feed({ buffer: Buffer.from(markless.split(',')[1], 'base64') });
    const capM = await page.evaluate(() => window.__hw.capture);
    const dM = await lettersData();
    check('E17 an old markless sheet still reads square-on through the RULE fallback',
      stageM === 'alphabet' && capM && capM.anchors === 0 &&
      dM.lines.every((l) => l.found && l.accepted >= l.expected - 3),
      'anchors ' + (capM && capM.anchors) + ', ' +
      dM.lines.map((l) => l.accepted + '/' + l.expected).join(' '));
    check('E18 …and zero mislabels on the fallback path too',
      mislabels(dM, eClean.gt).length === 0);
  }

  // ==== HW-F: free motion — the camera collects cards one at a time ==========
  // Two product-owner findings, verbatim: "why is it needed to get all
  // lines clicked at same time. why cant we do first line , 2nd in a
  // free motion" — and then "try designing the page as 5 reding cards,
  // and than kid can show each card 1 by 1". The close-up fixtures are
  // CUT CARDS filling the WIDE frame, desk on every side — the hold the
  // card design is for. Chromium accepts exactly ONE y4m per launch, so
  // the deterministic identity checks run one launch per card fixture;
  // the multi-frame sweep file (cards 1→2→3 at 2s a frame) drives the
  // real accumulation in a single launch — collection is any-order and
  // latest-wins, so whichever frame each sample lands on, it converges.
  console.log('\n== HW-F: FREE MOTION — CARDS, ONE AT A TIME ================');
  const hwFeeds = require(path.join(__dirname, 'make-hw-feeds.js'));
  if (!hwFeeds.allPresent()) {
    console.log('  (generating the fake-camera fixtures — one time)');
    await hwFeeds.generate(BASE);
  }
  const feedsMeta = hwFeeds.readMeta();
  const HW_COARSE_FLOOR = await page.evaluate(() => HWRead.PARAMS.COARSE_XH);
  const camArgs = (file) => [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=' + path.join(__dirname, file)
  ];
  async function camPage(file) {
    const browser = await chromium.launch({ executablePath: CHROME, args: camArgs(file) });
    const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(BASE);
    await p.waitForFunction(() => window.__hw && window.__bia);
    return { browser, p, errors };
  }
  async function armAndOpenCamera(p) {
    await p.click('#hwEntryBtn');
    await p.waitForSelector('#stepHwSheet.here');
    await p.click('#hwWroteBtn');
    await p.click('#cameraBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return document.getElementById('cameraPanel').style.display === 'block' &&
             v.videoWidth > 0;
    }, null, { timeout: 30000 });
  }
  function mislabelsFramed(lines, map) {
    const framed = feedsMeta.gt.map((g) => ({ line: g.line, ch: g.ch,
      x0: hwFeeds.frameX(map, g.x0), x1: hwFeeds.frameX(map, g.x1) }));
    return mislabels({ lines }, framed);
  }

  // Every CUT-CARD close-up fixture: collected with the CORRECT identity,
  // read essentially in full, zero letter mislabels — and the measured
  // x-height per card, which is the resolution win in numbers.
  {
    let identityOK = 0, mislabelTotal = 0, camErrs = 0;
    const xhs = [];
    for (let i = 0; i < 5; i++) {
      const { browser, p, errors } = await camPage('hw-card-' + (i + 1) + '.y4m');
      await armAndOpenCamera(p);
      await p.waitForFunction(() =>
        window.__hw.live && window.__hw.live.collected.size >= 1,
        null, { timeout: 60000 });
      const got = await p.evaluate(() => Array.from(window.__hw.live.collected.keys()));
      const okId = got.length === 1 && got[0] === i;
      if (okId) identityOK++;
      check('F1.' + (i + 1) + ' a cut card ' + (i + 1) + ' filling the wide frame collects card ' +
            (i + 1) + ' and nothing else',
        okId, 'collected [' + got.map((x) => x + 1).join(' ') + ']');

      if (i === 1) {
        // The deep checks ride on one card: latest-wins, the quiet UI,
        // the lock screenshot, Done-early, and the camera light.
        await p.waitForFunction(() => window.__hw.live.replaced >= 1,
          null, { timeout: 30000 });
        const rep = await p.evaluate(() => ({
          replaced: window.__hw.live.replaced,
          size: window.__hw.live.collected.size,
          log: document.getElementById('devLog').textContent
        }));
        check('F2 re-showing an already-collected card replaces it silently (latest wins)',
          rep.replaced >= 1 && rep.size === 1,
          rep.replaced + ' replacement(s), still 1 card held');
        const ui = await p.evaluate(() => ({
          count: document.getElementById('hwLiveCount').textContent,
          met: Array.from(document.querySelectorAll('.hw-live-slot'))
            .map((s) => s.classList.contains('met') ? '*' : '.').join(''),
          words: document.getElementById('hwLiveRow').innerText,
          doneShown: !!document.getElementById('hwLiveDoneBtn').offsetParent
        }));
        check('F3 the quiet progress row: five slots, this one lit, "1 of 5", a done button',
          /^1 of 5$/.test(ui.count) && ui.met === '.*...' && ui.doneShown,
          '"' + ui.count + '" slots ' + ui.met);
        check('F4 the collection row never looks like scanning — no jargon, no blame',
          !/percent|%|scanning|detected|processing|error|failed/i.test(ui.words),
          '"' + ui.words.slice(0, 60).replace(/\n/g, ' · ') + '…"');
        check('F5 the measured x-height per collected card goes to the developer log',
          /one line met — line 2, \d+ of \d+ letters, x-height ~\d+px \(measured\)/.test(rep.log));
        await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
        await p.screenshot({ path: path.join(SHOTS, '18-hw-card-locked.png') });
        await p.click('#hwLiveDoneBtn');
        await p.waitForFunction(() => window.__hw.stage === 'alphabet');
        const data = await lettersData(p);
        check('F6 Done-early keeps what was met: the card reads in full, the rest stay quiet empty slots',
          data.lines[1].found && data.lines[1].accepted >= 28 &&
          data.lines.filter((l) => !l.found).length === 4,
          data.lines.map((l) => l.found ? l.accepted + '/' + l.expected : '—').join(' '));
        const light = await p.evaluate(() => {
          const v = document.getElementById('cameraLive');
          return { panel: document.getElementById('cameraPanel').style.display,
                   tracks: v.srcObject ? v.srcObject.getTracks().map((t) => t.readyState).join(',') : 'none',
                   running: window.__hw.live.running };
        });
        check('F7 finishing the sweep closes the camera — light off, loop stopped',
          light.panel === 'none' && light.tracks === 'ended' && !light.running,
          'tracks ' + light.tracks);
        const badDeep = mislabelsFramed(data.lines, feedsMeta.fixtures['card-2'].map);
        mislabelTotal += badDeep.length;
        const xhL = await p.evaluate(() => window.__hw.capture.xHeightPx);
        xhs.push(xhL);
      } else {
        await p.click('#hwLiveDoneBtn');
        await p.waitForFunction(() => window.__hw.stage === 'alphabet');
        const data = await lettersData(p);
        const bad = mislabelsFramed(data.lines, feedsMeta.fixtures['card-' + (i + 1)].map);
        mislabelTotal += bad.length;
        xhs.push(await p.evaluate(() => window.__hw.capture.xHeightPx));
      }
      camErrs += errors.length;
      await browser.close();
    }
    check('F8 all five cut cards collect with the CORRECT identity (5/5) — never a wrong card',
      identityOK === 5, identityOK + '/5');
    check('F9 zero letter mislabels across every collected card',
      mislabelTotal === 0, mislabelTotal + ' mislabels');
    check('F10 zero page errors across the five cut-card launches', camErrs === 0);
    console.log('     resolution win: cut-card x-heights ' +
      xhs.map((x) => Math.round(x) + 'px').join(' ') +
      ' vs the whole page in the same frame (next check) — more camera pixels per letter');
    check('F11 the cards deliver the pixels: every card\'s x-height is ABOVE the coarse floor',
      xhs.every((x) => x >= HW_COARSE_FLOOR), xhs.map((x) => Math.round(x)).join(' '));
  }

  // A card shown STILL ATTACHED — the uncut page held close, neighbour
  // slivers and cut lines in frame — collects through the very same
  // loop, with the same identity. Cutting is part of the fun, never a
  // requirement (HW-J proves the verdicts identical frame for frame;
  // this proves the end-to-end collection).
  {
    const { browser, p, errors } = await camPage('hw-card-attached.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live && window.__hw.live.collected.size >= 1,
      null, { timeout: 60000 });
    const got = await p.evaluate(() => Array.from(window.__hw.live.collected.keys()));
    check('F11b an ATTACHED card collects exactly like a cut one — cutting is never required',
      got.length === 1 && got[0] === 1,
      'collected [' + got.map((x) => x + 1).join(' ') + ']');
    await p.click('#hwLiveDoneBtn');
    await p.waitForFunction(() => window.__hw.stage === 'alphabet');
    const data = await lettersData(p);
    const bad = mislabelsFramed(data.lines, feedsMeta.fixtures.attached.map);
    check('F11c …reads essentially in full with zero mislabels',
      data.lines[1].accepted >= 28 && bad.length === 0 && errors.length === 0,
      data.lines[1].accepted + '/' + data.lines[1].expected + ', ' + bad.length + ' mislabels');
    await browser.close();
  }

  // The whole sheet in one frame: the full ladder registers, every line
  // lands together, and the journey proceeds by itself.
  {
    const { browser, p, errors } = await camPage('hw-sheet.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.stage === 'alphabet', null, { timeout: 90000 });
    const data = await lettersData(p);
    const bad = mislabelsFramed(data.lines, feedsMeta.fixtures.sheet.map);
    const xhSheet = await p.evaluate(() => window.__hw.capture.xHeightPx);
    check('F12 a frame holding the WHOLE ladder fills all five slots at once and proceeds',
      data.lines.every((l) => l.found && l.accepted >= l.expected - 2) &&
      data.have.length === 62,
      data.lines.map((l) => l.accepted + '/' + l.expected).join(' ') + ', ' +
      data.have.length + '/62 letters');
    check('F13 …with zero mislabels through the very same whole-sheet reader', bad.length === 0);
    console.log('     whole sheet in the same 1280×960 frame: x-height ~' +
      Math.round(xhSheet) + 'px (close-up measured ~2–4× that)');
    check('F14 zero page errors on the whole-sheet launch', errors.length === 0);
    await browser.close();
  }

  // The sweep: one launch, the file shows cards 1→2→3 one after another,
  // and the collection accumulates in free motion — "kid can show each
  // card 1 by 1", verbatim, answered end to end.
  {
    const { browser, p, errors } = await camPage('hw-sweep.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live && window.__hw.live.collected.size >= 3,
      null, { timeout: 90000 });
    const snap = await p.evaluate(() => ({
      collected: Array.from(window.__hw.live.collected.keys()).sort().join(','),
      count: document.getElementById('hwLiveCount').textContent
    }));
    check('F15 showing the cards one after another collects them one at a time, in free motion',
      snap.collected === '0,1,2' && /^3 of 5$/.test(snap.count),
      'cards [' + snap.collected + '], "' + snap.count + '"');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '17-hw-live-collecting.png') });
    await p.click('#hwLiveDoneBtn');
    await p.waitForFunction(() => window.__hw.stage === 'alphabet');
    const data = await lettersData(p);
    check('F16 Done-early after the sweep keeps all three collected cards',
      data.lines[0].found && data.lines[1].found && data.lines[2].found &&
      !data.lines[3].found && !data.lines[4].found,
      data.lines.map((l) => l.found ? l.accepted + '/' + l.expected : '—').join(' '));
    check('F17 zero page errors on the sweep launch', errors.length === 0);
    await browser.close();
  }

  // Nothing to collect: a drawing (the base suite's own camera fixture)
  // and an UNWRITTEN card (anchors and model print, no child ink) both
  // collect nothing, kindly — and the drawing journey itself never runs
  // the loop at all.
  {
    const camFeed = require(path.join(__dirname, 'make-camera-feed.js'));
    if (!fs.existsSync(camFeed.OUT)) await camFeed.generate();
    const { browser, p, errors } = await camPage('camera-feed-001.y4m');
    // FIRST: the drawing journey (not armed) — the loop must not run.
    await p.click('#cameraBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return document.getElementById('cameraPanel').style.display === 'block' &&
             v.videoWidth > 0;
    }, null, { timeout: 30000 });
    await p.waitForTimeout(1800);
    const drawSide = await p.evaluate(() => ({
      samples: window.__hw.live.samples,
      row: document.getElementById('hwLiveRow').style.display
    }));
    check('F18 the drawing journey never runs the card loop (no sampling, no row)',
      drawSide.samples === 0 && drawSide.row !== 'block',
      drawSide.samples + ' samples');
    await p.click('#cameraCloseBtn');
    // THEN: armed, the same drawing yields NOTHING — no line invented.
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 3, null, { timeout: 60000 });
    const g = await p.evaluate(() => ({
      size: window.__hw.live.collected.size,
      count: document.getElementById('hwLiveCount').textContent
    }));
    check('F19 a photo of something else collects NOTHING — ambiguity keeps sweeping, never guesses',
      g.size === 0 && /^0 of 5$/.test(g.count),
      g.size + ' collected after 3+ samples');
    check('F20 zero page errors while refusing', errors.length === 0);
    await browser.close();
  }
  {
    const { browser, p, errors } = await camPage('hw-card-blank.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 2, null, { timeout: 60000 });
    const b = await p.evaluate(() => window.__hw.live.collected.size);
    check('F21 an UNWRITTEN card (anchors + model print, no ink) collects nothing',
      b === 0 && errors.length === 0, b + ' collected');
    await browser.close();
  }

  // ==== HW-G: the page never blocks — the analysis lives in a worker =========
  // The field failure, verbatim: "as soon as camera opened the entire
  // page got stuck." Measured cause: hwRead ground a real room scene for
  // 12.4 SECONDS a frame ON THE MAIN THREAD (a noisy scene keeps the
  // candidate-mark list at its cap and the anchor pair search over it is
  // combinatorial — findLadder alone measured 3.6s). The analysis now
  // runs in js/hwLiveWorker.js behind a cheap downscaled prepass and
  // hard per-frame budgets, so these checks hold a HEARTBEAT against the
  // main thread: a 25ms interval's largest gap stays under 120ms — four
  // times the measured worst main-thread cost of grabbing a frame
  // (drawImage + getImageData ≈ 15–30ms at 1280×960) and two orders of
  // magnitude under the freeze — while the loop sweeps.
  console.log('\n== HW-G: THE PAGE NEVER BLOCKS =============================');
  const HEARTBEAT = `(ms) => new Promise((resolve) => {
    const gaps = []; let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now(); gaps.push(now - last); last = now;
    }, 25);
    setTimeout(() => { clearInterval(iv);
      resolve({ max: Math.max.apply(null, gaps), beats: gaps.length }); }, ms);
  })`;
  {
    // First-frame hygiene, on the shared page: a video with no metadata
    // (videoWidth 0) is never sampled — the loop idles until the preview
    // actually renders.
    const g0 = await page.evaluate(async () => {
      const v = document.createElement('video');   // no stream, no metadata
      const before = window.__hw.live.samples;
      HWLive.start(v, {});
      await new Promise((r) => setTimeout(r, 3 * HWLive.INTERVAL));
      const during = window.__hw.live.samples;
      HWLive.stop();
      HWLive.reset();
      return { before, during };
    });
    check('G1 no frame is sampled before the preview renders (videoWidth 0 → the loop idles)',
      g0.during === g0.before, g0.during - g0.before + ' frames sampled in 3 intervals');
  }
  {
    // The noisy room — the field freeze's own scene shape, no sheet.
    const { browser, p, errors } = await camPage('hw-noisy.y4m');
    await armAndOpenCamera(p);
    const hb = await p.evaluate(`(${HEARTBEAT})(6000)`);
    check('G2 the main thread never blocks while sweeping a busy no-sheet scene ' +
          '(max heartbeat gap < 120ms across 6s)',
      hb.max < 120 && hb.beats > 150,
      'max gap ' + Math.round(hb.max) + 'ms over ' + hb.beats + ' beats');
    const g = await p.evaluate(() => ({
      samples: window.__hw.live.samples,
      skipped: window.__hw.live.skipped,
      collected: window.__hw.live.collected.size,
      count: document.getElementById('hwLiveCount').textContent,
      words: document.getElementById('hwLiveRow').innerText
    }));
    check('G3 the busy scene is over the mark cap and every frame is SKIPPED — nothing collected',
      g.samples >= 5 && g.skipped >= 5 && g.collected === 0 && /^0 of 5$/.test(g.count),
      g.samples + ' sampled, ' + g.skipped + ' skipped');
    check('G4 …and skipping is SILENT for the child: no busy/timeout/worker word, the slots just wait',
      !/busy|timeout|worker|skip|frame|slow|wait/i.test(g.words),
      '"' + g.words.slice(0, 60).replace(/\n/g, ' · ') + '…"');
    check('G5 zero page errors on the busy scene', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await browser.close();
  }
  {
    // A REAL collection with the heartbeat running: the work moved to
    // the worker, so collecting a line must also leave the page free.
    const { browser, p, errors } = await camPage('hw-card-1.y4m');
    await armAndOpenCamera(p);
    const hbP = p.evaluate(`(${HEARTBEAT})(5000)`);      // concurrent
    await p.waitForFunction(() =>
      window.__hw.live && window.__hw.live.collected.size >= 1,
      null, { timeout: 60000 });
    const got = await p.evaluate(() => ({
      keys: Array.from(window.__hw.live.collected.keys()),
      cost: Math.round(window.__hw.live.lastCost)
    }));
    const hb = await hbP;
    check('G6 the main thread stays free DURING a real collection (max gap < 120ms; the line still lands)',
      hb.max < 120 && got.keys.length === 1 && got.keys[0] === 0,
      'max gap ' + Math.round(hb.max) + 'ms, worker cost ' + got.cost +
      'ms, collected [' + got.keys.map((x) => x + 1).join(' ') + ']');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '19-hw-worker-line-ticked.png') });
    check('G7 zero page errors while collecting through the worker', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await browser.close();
  }

  // ---- hygiene ---------------------------------------------------------------
  console.log('\n-- hygiene');
  const banner = await page.evaluate(() => document.querySelector('#devError').style.display);
  check('developer error banner never shown', banner !== 'block');
  check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('the suite itself used no Math.random for the fixture',
    !/Math\.random/.test(COMPOSE));

  console.log('\n==========================================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) { console.log('FAILURES:\n  ' + failures.join('\n  ')); }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
