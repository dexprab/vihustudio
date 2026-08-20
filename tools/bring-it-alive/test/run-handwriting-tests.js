/* MY HANDWRITING — verification suite.
 *
 * Drives the REAL page end to end: presses the real entry button, arms
 * the real capture step, feeds photographs through the real file input,
 * and asserts on what the journey actually produced — the alphabet the
 * child would see, the refusals, and the font bytes themselves.
 *
 * The fixture is a DETERMINISTIC SYNTHETIC FILLED PAGE SET: the page's
 * own HWSheet.draw renders each printable page (and HWSheet.LEGACY.draw
 * the frozen one-page sheet), and the model text is then written onto
 * the rules in a jittered handwriting-ish style — all from a SEEDED
 * generator (mulberry32; Math.random appears nowhere), so every run
 * reads the same pages. Ground truth is the drawn letters' own
 * positions, which is what makes the mislabel assertions exact.
 *
 * Scenarios:
 *   HW-N  two journeys, two blocks — the entry screen presents the
 *         drawing journey and the font journey as equal, separate
 *         blocks; the shared camera machinery wears each journey's own
 *         words; backing out never leaks state.
 *   HW-A  the cards themselves — coverage of a–z + A–Z + digits, TWO
 *         printable pages (three cards + two), the printed no-cursive
 *         callout, real print pagination (a page break between the two
 *         A4 pages).
 *   HW-J  the redesigned layout — max 3 cards per page; a real GUTTER
 *         between every two cards' cut lines (two dashed lines with
 *         open paper between); 20mm GRIP margins with zero ink and
 *         zero mark candidates inside them; the taller blank measured
 *         against the 37.4mm card-era blank; borders/cut lines never
 *         ink and never anchors; ATTACHED reads exactly like CUT per
 *         card; the wide frame's resolution win re-measured; the
 *         frozen legacy print still forms its 10-star ladder.
 *   HW-1  strictly ONE card at a time — an uploaded photo of a whole
 *         page (3 cards, and 2 cards) reads NOTHING and gets the kind
 *         one-card-per-photo message; two single-card uploads
 *         ACCUMULATE their two cards.
 *   HW-B  the complete set — five card photos, one card each, fill all
 *         62 letters with zero mislabels; the font parses, renders,
 *         differs from the fallback, rebuilds byte-identical.
 *   HW-C  the refuse rule — a welded card contributes NOTHING (its
 *         letters skipped, never mislabeled); a letter never written
 *         is one quiet empty slot absent from the cmap; per-card
 *         recovery brings the welded card back.
 *   HW-D  "this looks joined-up" — a welded card gets the
 *         holding-hands message; two touching pairs stay generic; most
 *         read cards welded → ONE gentle message.
 *   HW-E  a real camera — a hand-held CARD under a true projective
 *         warp reads with correct identity and zero mislabels; an
 *         upside-down card photo is turned around; a drawing refuses
 *         kindly; a far-away card keeps what it can; the LEGACY sheet
 *         still reads under the old field warp (anchor ladder), the
 *         markless-era fallback still reads square-on, and the
 *         phantom-ladder regression still REFUSES.
 *   HW-F  free motion — cut cards collect one at a time with correct
 *         identity 5/5 and zero mislabels; ATTACHED collects like cut;
 *         a many-card view raises the gentle one-card overlay and
 *         collects NOTHING until the view returns to one card; a
 *         LEGACY sheet fills all five at once; the sweep accumulates;
 *         a drawing and an unwritten card collect nothing.
 *   HW-G  the page never blocks — worker + budgets: heartbeat < 120ms
 *         across a noisy no-sheet room AND during a real collection.
 *   HW-L  the readiness light — a small soft light on the live camera
 *         picture, green exactly when the current frame reads at the
 *         full standard (green ⇔ pressing Take would read: asserted
 *         across the fixture ladder with zero disagreements), red
 *         otherwise; absent from the drawing camera; rect-tracked to
 *         the video ≤1px through a resize; debounced against a single
 *         wobble frame but never holding green past a view that
 *         stopped reading (latency measured); shape as well as colour;
 *         plain switch under prefers-reduced-motion; wordless.
 *
 * DISCLOSED: this verifies the journey against synthetic handwriting.
 * Real child handwriting — real-paper lighting, pencil pressure —
 * is exactly what the product owner will try in the tool.
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

/* The synthetic filled pages, composed IN PAGE through the real
 * HWSheet.draw / HWSheet.LEGACY.draw so the fixtures and the printable
 * pages cannot drift. Shared with the fake-camera feed generator — see
 * test/hw-fixture.js for the contract. */
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
  /* One CUT CARD's photograph from a composed page: its own cut
   * boundary's rows, full page width (the cuts are horizontal). The
   * ground truth travels with it — x untouched, ruleYs shifted into
   * the crop. */
  async function composeCard(opts, card) {
    const made = await page.evaluate(`(async () => {
      const made = (${COMPOSE})(${JSON.stringify(opts)});
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const k = made.cards.find((c) => c.index === ${card});
      const c = document.createElement('canvas');
      const top = Math.round(k.cutTop);
      c.width = img.width; c.height = Math.round(k.cutBottom) - top;
      c.getContext('2d').drawImage(img, 0, top, c.width, c.height,
                                   0, 0, c.width, c.height);
      const ruleYs = made.ruleYs.map((y) => y == null ? null : y - top);
      return { dataURL: c.toDataURL('image/png'),
               gt: made.gt.filter((g) => g.line === ${card}),
               W: c.width, H: c.height, ruleYs };
    })()`);
    made.buffer = Buffer.from(made.dataURL.split(',')[1], 'base64');
    made.name = 'card-' + (card + 1) + '.png';
    return made;
  }
  // Warp a composed image through the true projective camera; the
  // ground truth travels through the same homography.
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
      { name: made.name || 'filled-card.png',
        mimeType: made.mime || 'image/png', buffer: made.buffer });
    await page.waitForFunction(() =>
      window.__hw.stage === 'alphabet' || window.__hw.stage === 'sheet',
      null, { timeout: 180000 });
    return page.evaluate(() => window.__hw.stage);
  }
  // Feed all five cards of a composed page pair, one photo each — the
  // first fresh, the rest through each card's own row button.
  async function feedAllCards(pageOptsExtra) {
    for (let i = 0; i < 5; i++) {
      const opts = Object.assign({ seed: 7, width: 2000,
                                   page: i < 3 ? 0 : 1 }, pageOptsExtra || {});
      const card = await composeCard(opts, i);
      const stage = await feed(card, i === 0 ? null : i);
      if (stage !== 'alphabet') return { stage, at: i };
    }
    return { stage: 'alphabet' };
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
  // Back to a fresh page of cards from wherever the journey stands.
  async function freshSheet() {
    const stage = await page.evaluate(() => window.__hw.stage);
    if (stage === 'alphabet') await page.click('#hwNewSheetBtn');
    else if (stage === 'test') await page.click('#hwTestNewSheet');
    else if (stage !== 'sheet') await page.click('#hwEntryBtn');
    else {
      // already on the sheet (a refusal landed here) — reset by hand
      await page.evaluate(() => { window.__hw.lines = null;
        window.__hw.samples = null; window.__hw.capture = null; });
    }
    await page.waitForSelector('#stepHwSheet.here');
  }

  // The five clean cards' combined ground truth (both pages, global
  // line indices) — the standing reference for accumulated reads.
  const cleanCards = [];
  for (let i = 0; i < 5; i++) {
    cleanCards.push(await composeCard({ seed: 7, width: 2000,
                                        page: i < 3 ? 0 : 1 }, i));
  }
  const cleanGt = [].concat(...cleanCards.map((c) => c.gt));

  // ==== HW-N: two journeys, two blocks =======================================
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
    // child can see — one camera, two framings, ONE CARD AT A TIME.
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
    check('N3 armed, the capture step is visibly the FONT journey — and the words say ONE CARD',
      /My Handwriting/.test(armed.title) && /one written card/.test(armed.drop) &&
      /one card at a time/.test(armed.note) && armed.hwBlockHidden &&
      armed.extrasHidden && armed.testHidden,
      '"' + armed.title + '" · "' + armed.note + '"');

    // Back out: the drawing framing returns byte for byte, and a drawing
    // fed now lands in the drawing CLAIM — never the card reader.
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

  // ==== HW-A: the writing cards ==============================================
  console.log('\n== HW-A: THE WRITING CARDS =================================');
  const sheetFacts = await page.evaluate(() => {
    const counts = {};
    for (const ln of HWSheet.LINES) {
      for (const ch of ln.text) { if (ch !== ' ') counts[ch] = (counts[ch] || 0) + 1; }
    }
    return { counts, lines: HWSheet.LINES.length,
             pages: HWSheet.PAGES.map((p) => p.lines.join(',')),
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
    check('A3 five cards across TWO pages — three then two, A4 proportions',
      sheetFacts.lines === 5 && sheetFacts.pages.join('|') === '0,1,2|3,4' &&
      Math.abs(sheetFacts.aspect - Math.SQRT2) < 1e-9,
      'pages [' + sheetFacts.pages.join('] [') + ']');
  }
  await page.click('#hwEntryBtn');
  await page.waitForSelector('#stepHwSheet.here');
  {
    const drawn = await page.evaluate(() => window.__hw.sheetDrawn.map((d) => ({
      page: d.page, lines: d.lines.map((l) => l.index),
      pitch: d.lines.length > 1 ? d.lines[1].ruleY - d.lines[0].ruleY : 0
    })));
    check('A4 both pages are drawn from HWSheet.GEOM — cards 1–3 then 4–5, even pitch',
      drawn.length === 2 && drawn[0].lines.join(',') === '0,1,2' &&
      drawn[1].lines.join(',') === '3,4' &&
      Math.abs(drawn[0].pitch - drawn[1].pitch) < 1,
      'pitch ' + Math.round(drawn[0].pitch) + 'px');
    const printable = await page.evaluate(() => {
      const c1 = document.getElementById('hwPrintCanvas1');
      const c2 = document.getElementById('hwPrintCanvas2');
      return { w1: c1.width, w2: c2.width,
               css: getComputedStyle(document.getElementById('hwPrintArea')).display };
    });
    check('A5 the printable copies are rendered crisp (both pages) and hidden on screen',
      printable.w1 === 1600 && printable.w2 === 1600 && printable.css === 'none',
      printable.w1 + 'px + ' + printable.w2 + 'px, display ' + printable.css);
    // REAL PRINT PAGINATION: under print media the print area shows and
    // each page of cards ends with a page break — "Print the cards"
    // produces two A4 pages.
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => {
      const area = document.getElementById('hwPrintArea');
      const pages = area.querySelectorAll('.hw-print-page');
      const first = getComputedStyle(pages[0]);
      const last = getComputedStyle(pages[pages.length - 1]);
      return { shown: getComputedStyle(area).display,
               pages: pages.length,
               firstBreak: first.breakAfter || first.pageBreakAfter,
               lastBreak: last.breakAfter || last.pageBreakAfter,
               wrapHidden: getComputedStyle(document.querySelector('body > .wrap')).display };
    });
    await page.emulateMedia({ media: 'screen' });
    check('A5b printing paginates: two pages, a page break after the first, only the cards on paper',
      printed.shown === 'block' && printed.pages === 2 &&
      /page|always/.test(printed.firstBreak) &&
      !/page|always/.test(printed.lastBreak) && printed.wrapHidden === 'none',
      printed.pages + ' pages, break-after "' + printed.firstBreak + '"');
    // The no-cursive callout: asserted against the RENDER of page 1.
    const callout = await page.evaluate(() => {
      const drawnStrings = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
        drawnStrings.push(String(t));
        return orig.call(this, t, ...a);
      };
      try { HWSheet.draw(document.createElement('canvas'), 800, 0); }
      finally { CanvasRenderingContext2D.prototype.fillText = orig; }
      return { printed: drawnStrings.includes(HWSheet.CALLOUT),
               text: HWSheet.CALLOUT };
    });
    check('A6 the no-cursive callout is PRINTED on page 1\'s render',
      callout.printed, '"' + callout.text + '"');
    check('A7 the callout is child words — no jargon, no blame',
      /hold hands/.test(callout.text) &&
      !/cursive|wrong|failed|invalid|error|don.t|never/i.test(callout.text));
  }
  await page.screenshot({ path: path.join(SHOTS, '11-handwriting-sheet.png') });
  // The printable pages and a close-up, straight from the render.
  {
    const shots = await page.evaluate(() => {
      const c1 = document.getElementById('hwPrintCanvas1');
      const c2 = document.getElementById('hwPrintCanvas2');
      // close-up: card 1 whole, its gutter, and card 2's top cut line —
      // the grip margins and the open gutter in one picture
      const d = HWSheet.draw(document.createElement('canvas'), 1600, 0);
      const cc = document.createElement('canvas');
      const top = Math.max(0, Math.round(d.cards[0].cutTop) - 30);
      cc.width = 1600;
      cc.height = Math.round(d.cards[1].cutTop) + 60 - top;
      const src = document.createElement('canvas');
      HWSheet.draw(src, 1600, 0);
      cc.getContext('2d').drawImage(src, 0, top, 1600, cc.height, 0, 0, 1600, cc.height);
      return { p1: c1.toDataURL('image/png'), p2: c2.toDataURL('image/png'),
               close: cc.toDataURL('image/png') };
    });
    fs.writeFileSync(path.join(SHOTS, '20-hw-print-page1.png'),
      Buffer.from(shots.p1.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(SHOTS, '21-hw-print-page2.png'),
      Buffer.from(shots.p2.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(SHOTS, '22-hw-card-closeup.png'),
      Buffer.from(shots.close.split(',')[1], 'base64'));
  }

  // ==== HW-J: the redesigned layout ==========================================
  // The product owner, verbatim: "you can put max 3 cards on the paper.
  // provide spacing between cutlines. also ensure that a person will
  // have to hold it. so while holding the text should not get hidden.
  // current page does not have any breathing space."
  console.log('\n== HW-J: MAX 3 CARDS, GUTTERS, GRIP MARGINS ================');
  {
    const layout = await page.evaluate(() => {
      const G = HWSheet.GEOM;
      const out = [];
      for (const pg of [0, 1]) {
        const d = HWSheet.draw(document.createElement('canvas'), 2000, pg);
        const gutters = [];
        for (let i = 1; i < d.cards.length; i++) {
          gutters.push((d.cards[i].cutTop - d.cards[i - 1].cutBottom) / d.H * 297);
        }
        out.push({
          page: pg, cards: d.cards.length, cuts: d.cuts.length,
          perCardCuts: d.cards.every((k) =>
            d.cuts.includes(k.cutTop) && d.cuts.includes(k.cutBottom)),
          cardsHoldLines: d.cards.every((k, s) =>
            d.lines[s].zoneTop > k.y0 && d.lines[s].zoneBottom < k.y1),
          gutters
        });
      }
      return { pages: out, blank: G.ascent + G.descent, ascent: G.ascent,
               gutterMm: 2 * G.cutInset * 297 };
    });
    const [p1, p2] = layout.pages;
    check('J1 page 1 is THREE bordered cards, page 2 TWO — never more than 3 on a paper',
      p1.cards === 3 && p2.cards === 2 &&
      p1.cardsHoldLines && p2.cardsHoldLines,
      p1.cards + ' + ' + p2.cards + ' cards, each blank inside its card');
    check('J2 every card carries its OWN pair of cut lines (6 on page 1, 4 on page 2)',
      p1.cuts === 6 && p2.cuts === 4 && p1.perCardCuts && p2.perCardCuts,
      p1.cuts + ' + ' + p2.cuts + ' dashed lines');
    check('J3 a real GUTTER stands between neighbouring cut lines — spacing, not a shared line',
      p1.gutters.every((g) => g >= 8) && p2.gutters.every((g) => g >= 8) &&
      Math.abs(layout.gutterMm - p1.gutters[0]) < 0.1,
      'gutters ' + p1.gutters.concat(p2.gutters).map((g) => g.toFixed(1) + 'mm').join(' '));
    // The taller blank — the breathing space, spent on the writing room.
    const CARD_ERA = { blank: 0.126, ascent: 0.086 };  // 37.4mm / 25.6mm on A4
    check('J4 the ruled blank is TALLER: three cards a page bought real writing room',
      layout.blank > CARD_ERA.blank && layout.ascent > CARD_ERA.ascent,
      'blank ' + (layout.blank * 297).toFixed(1) + 'mm on A4 vs ' +
      (CARD_ERA.blank * 297).toFixed(1) + 'mm (+' +
      Math.round((layout.blank / CARD_ERA.blank - 1) * 100) + '%); ascent ' +
      (layout.ascent * 297).toFixed(1) + 'mm vs ' + (CARD_ERA.ascent * 297).toFixed(1) + 'mm');

    // GRIP MARGINS: a held card never hides what matters. 20mm from
    // either side edge (a thumb pad is ~20–25mm; a flat hold plants the
    // whole distal pad, and the anchor stars — the card's registration
    // — must survive it): ZERO ink pixels and ZERO candidate marks in
    // the grip zones, on both pages, measured on the real segmentation.
    const grip = await page.evaluate(() => {
      const out = [];
      for (const pg of [0, 1]) {
        const c = document.createElement('canvas');
        HWSheet.draw(c, 2000, pg);
        const W = c.width, H = c.height;
        const photo = { width: W, height: H,
          imageData: c.getContext('2d').getImageData(0, 0, W, H), filename: 'g' };
        const loop = [[1, 1], [W - 2, 1], [W - 2, H - 2], [1, H - 2]];
        const seg = BIASegment.segment(photo, BIAClaim.claim(loop, W, H));
        const gripW = Math.round(HWSheet.GEOM.gripX * W);
        let ink = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < gripW; x++) if (seg.ink[y * W + x]) ink++;
          for (let x = W - gripW; x < W; x++) if (seg.ink[y * W + x]) ink++;
        }
        const { marks } = HWRead.collectMarks(seg);
        const inGrip = marks.filter((m) => m.cx < gripW || m.cx > W - gripW).length;
        out.push({ page: pg, ink, inGrip,
                   gripMm: HWSheet.GEOM.gripX * 210,
                   inkStartMm: (HWSheet.GEOM.anchorXLeft - HWSheet.GEOM.anchorRadius) * 210 });
      }
      return out;
    });
    check('J5 the GRIP zones are empty: zero ink and zero mark candidates within 20mm of either side edge',
      grip.every((g) => g.ink === 0 && g.inGrip === 0) &&
      grip[0].gripMm >= 19.9 && grip[0].inkStartMm >= 20,
      'grip ' + grip[0].gripMm.toFixed(1) + 'mm; first ink (a star) at ' +
      grip[0].inkStartMm.toFixed(1) + 'mm; ' +
      grip.map((g) => 'page ' + (g.page + 1) + ': ' + g.ink + ' ink px').join(', '));

    // The frame-component guard, on the new layout: borders and cut
    // dashes never ink, card furniture never an anchor candidate —
    // asserted against the real segmentation of both real renders.
    const guard = await page.evaluate(() => {
      let borderInk = 0, borderN = 0, cutInk = 0, cutN = 0, furniture = 0;
      let pairsOk = true;
      for (const pg of [0, 1]) {
        const c = document.createElement('canvas');
        const drawn = HWSheet.draw(c, 2000, pg);
        const W = c.width, H = c.height;
        const photo = { width: W, height: H,
          imageData: c.getContext('2d').getImageData(0, 0, W, H), filename: 'b' };
        const loop = [[1, 1], [W - 2, 1], [W - 2, H - 2], [1, H - 2]];
        const seg = BIASegment.segment(photo, BIAClaim.claim(loop, W, H));
        for (const card of drawn.cards) {
          for (let x = Math.round(card.x0) + 30; x < card.x1 - 30; x += 5) {
            if (Math.abs(x - 0.5 * W) < 0.03 * W) continue; // the scissors column
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
        for (const y of drawn.cuts) {
          for (let x = 30; x < W - 30; x += 3) {
            if (Math.abs(x - 0.5 * W) < 0.03 * W) continue; // scissors mark, gated below
            cutN++;
            if (seg.ink[Math.round(y) * W + x]) cutInk++;
          }
        }
        const { marks } = HWRead.collectMarks(seg);
        const G = HWSheet.GEOM;
        const anchors = [];
        for (const ln of drawn.lines) {
          anchors.push([G.anchorXLeft * W, ln.ruleY]);
          anchors.push([G.anchorXRight * W, ln.ruleY]);
        }
        const nearAnchor = (m) => anchors.some(([ax, ay]) =>
          Math.hypot(m.cx - ax, m.cy - ay) < 0.01 * W);
        furniture += marks.filter((m) => !nearAnchor(m) && (
          drawn.cuts.some((y) => Math.abs(m.cy - y) < 0.008 * H) ||
          drawn.cards.some((card) =>
            Math.abs(m.cy - card.y0) < 0.004 * H || Math.abs(m.cy - card.y1) < 0.004 * H ||
            Math.abs(m.cx - card.x0) < 0.004 * W || Math.abs(m.cx - card.x1) < 0.004 * W))).length;
        // …and the pairs the reader would use are exactly the anchors
        const pairs = HWRead.findLinePairs(seg, 0);
        pairsOk = pairsOk && pairs.length > 0;
      }
      return { borderInk, borderN, cutInk, cutN, furniture, pairsOk };
    });
    check('J6 borders and cut lines are NOT ink to the reader — they can never weld a letter or enter the font',
      guard.borderInk === 0 && guard.cutInk === 0,
      guard.borderN + ' border px + ' + guard.cutN + ' cut-line px sampled, ' +
      (guard.borderInk + guard.cutInk) + ' read as ink');
    check('J7 no dash, border or scissors mark passes the end-mark gate — card furniture can never impersonate an anchor',
      guard.furniture === 0, guard.furniture + ' candidate mark(s) on card furniture');

    // The FROZEN legacy print still forms its ten-star ladder on
    // exactly the anchor stars — old printouts keep their whole-page
    // path untouched.
    const legacyLadder = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const drawn = HWSheet.LEGACY.draw(c, 2000);
      const W = c.width, H = c.height;
      const photo = { width: W, height: H,
        imageData: c.getContext('2d').getImageData(0, 0, W, H), filename: 'l' };
      const loop = [[1, 1], [W - 2, 1], [W - 2, H - 2], [1, H - 2]];
      const seg = BIASegment.segment(photo, BIAClaim.claim(loop, W, H));
      const G = HWSheet.LEGACY.GEOM;
      const anchors = [];
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        anchors.push([G.anchorXLeft * W, HWSheet.LEGACY.ruleYFrac(i) * H]);
        anchors.push([G.anchorXRight * W, HWSheet.LEGACY.ruleYFrac(i) * H]);
      }
      const nearAnchor = (m) => anchors.some(([ax, ay]) =>
        Math.hypot(m.cx - ax, m.cy - ay) < 0.01 * W);
      const ladder = HWRead.findLadder(seg, function () {});
      return { found: !!ladder,
               onAnchors: !!ladder && ladder.rungs.every((r) =>
                 nearAnchor(r.L) && nearAnchor(r.R)) };
    });
    check('J8 the frozen LEGACY print still registers its 10-star ladder on exactly the anchor stars',
      legacyLadder.found && legacyLadder.onAnchors);

    // ATTACHED reads exactly like CUT — per card, through the very same
    // readFrame the live loop runs. The attached frame carries the
    // gutters, the neighbour cut lines and border slivers; the cut
    // frame four raw paper edges against the desk. Same card named,
    // same letters accepted — cutting is never required.
    for (let i = 0; i < 5; i++) {
      const r = await page.evaluate(`(async () => {
        const i = ${i};
        const made = (${COMPOSE})({ seed: 7, width: 2000, page: i < 3 ? 0 : 1 });
        const img = new Image();
        await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
        const k = made.cards.find((c) => c.index === i);
        const SW = img.width, SH = img.height;
        const fw = 1280, fh = 960;
        const frameOf = (cut) => {
          const c = document.createElement('canvas');
          c.width = fw; c.height = fh;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.fillStyle = '#5f6673';
          x.fillRect(0, 0, fw, fh);
          if (cut) {
            const dw = Math.round(0.94 * fw);
            const scale = dw / SW;
            const dh = (k.cutBottom - k.cutTop) * scale;
            x.drawImage(img, 0, k.cutTop, SW, k.cutBottom - k.cutTop,
                        (fw - dw) / 2, (fh - dh) / 2, dw, dh);
          } else {
            const bandTop = k.cutTop - 0.025 * SH;
            const bandH = (k.cutBottom - k.cutTop) + 0.05 * SH;
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
      check('J9.' + (i + 1) + ' card ' + (i + 1) + ' STILL ATTACHED reads exactly like the cut card (same identity, same letters)',
        r.attached.kind === 'line' && r.cut.kind === 'line' &&
        r.attached.index === i && r.cut.index === i &&
        r.attached.accepted === r.cut.accepted &&
        r.cut.accepted.length >= r.cut.exp - 2,
        r.cut.accepted ? r.cut.accepted.length + '/' + r.cut.exp +
          ' letters, both frames' : JSON.stringify(r));
    }

    // The wide frame fits a hand-held card with real margin — from the
    // geometry itself: a cut card is the page's full width by its own
    // cut height.
    const fit = await page.evaluate(() => {
      const G = HWSheet.GEOM;
      const cardAspect = (G.blockStep - 2 * G.cutInset) * G.aspect;
      const fw = 1280, fh = 960;
      const dh = 0.94 * fw * cardAspect;
      return { cardAspect, usedH: dh / fh, marginFrac: (fh - dh) / 2 / fh };
    });
    check('J10 a hand-held card fits the WIDE frame with margin',
      fit.cardAspect < 0.45 && fit.usedH < 0.55 && fit.marginFrac > 0.2,
      'card h:w ' + fit.cardAspect.toFixed(2) + '; at 94% width it uses ' +
      Math.round(fit.usedH * 100) + '% of the frame height, ' +
      Math.round(fit.marginFrac * 100) + '% aiming margin above and below');

    // The resolution win, re-measured on the new card: the SAME cut
    // card read at the wide hold vs the tall-era hold.
    const win = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000, page: 0 });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const k = made.cards.find((c) => c.index === 0);
      const SW = img.width;
      const fw = 1280, fh = 960;
      const readAt = (span) => {
        const c = document.createElement('canvas');
        c.width = fw; c.height = fh;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.fillStyle = '#5f6673'; x.fillRect(0, 0, fw, fh);
        const scale = span / SW, dh = (k.cutBottom - k.cutTop) * scale;
        x.drawImage(img, 0, k.cutTop, SW, k.cutBottom - k.cutTop,
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
    check('J11 the WIDE frame buys the pixels: the card\'s measured x-height clears the coarse floor, ≥1.4× the tall-era hold',
      win.wide.measured && win.wide.xh >= win.floor + 3 &&
      win.tall.xh > 0 && win.wide.xh >= 1.4 * win.tall.xh,
      'wide hold ~' + win.wide.xh.toFixed(1) + 'px vs tall-era hold ~' +
      win.tall.xh.toFixed(1) + 'px (coarse floor ' + win.floor + 'px) — ' +
      (win.wide.xh / win.tall.xh).toFixed(2) + '× the camera pixels per letter');
  }

  // ==== HW-1: strictly ONE card at a time (upload) ===========================
  // The product owner, verbatim: "only 1 question at a time will be
  // shown, if camera sees more, it can show a message overlay 1
  // question at a time" — and uploads follow the same rule.
  console.log('\n== HW-1: STRICTLY ONE CARD AT A TIME =======================');
  {
    // A whole page-1 photo (three cards): reads NOTHING, kind message.
    const p1 = await compose({ seed: 7, width: 2000, page: 0 });
    p1.name = 'page1.png';
    const stage1 = await feed(p1);
    const quiet1 = await page.evaluate(() => ({
      shown: document.getElementById('hwQuietSheet').style.display === 'block',
      text: document.getElementById('hwQuietSheet').textContent,
      lines: window.__hw.lines
    }));
    check('O1 a photo of a whole page (3 cards) reads NOTHING — one card per photo',
      stage1 === 'sheet' && quiet1.shown && quiet1.lines === null,
      'stage ' + stage1);
    check('O2 …with the kind one-card message, no blame and no jargon',
      /One card at a time/i.test(quiet1.text) && /one card/.test(quiet1.text) &&
      !/failed|invalid|error|wrong|multiple|detected/i.test(quiet1.text),
      '"' + quiet1.text.slice(0, 70) + '…"');
    // A whole page-2 photo (two cards): the same refusal.
    const p2 = await compose({ seed: 7, width: 2000, page: 1 });
    p2.name = 'page2.png';
    const stage2 = await feed(p2);
    const quiet2 = await page.evaluate(() => ({
      shown: document.getElementById('hwQuietSheet').style.display === 'block',
      text: document.getElementById('hwQuietSheet').textContent
    }));
    check('O3 two cards in one photo is still too many — page 2 refuses the same way',
      stage2 === 'sheet' && quiet2.shown && /One card at a time/i.test(quiet2.text));

    // Two single-card uploads ACCUMULATE their two cards.
    const stageA = await feed(cleanCards[0]);
    check('O4 one card in the photo reads that card',
      stageA === 'alphabet', 'stage ' + stageA);
    const dataA = await lettersData();
    check('O5 …exactly that card — the others stay quiet, unread rows',
      dataA.lines[0].found && dataA.lines[0].accepted >= 29 &&
      dataA.lines.filter((l) => l.found).length === 1,
      dataA.lines.map((l) => l.found ? l.accepted + '/' + l.expected : '—').join(' '));
    const stageB = await feed(cleanCards[3], 3);
    const dataB = await lettersData();
    check('O6 a second single-card photo ACCUMULATES — both cards held, nothing lost',
      stageB === 'alphabet' && dataB.lines[0].found && dataB.lines[3].found &&
      dataB.lines.filter((l) => l.found).length === 2,
      dataB.lines.map((l) => l.found ? l.accepted + '/' + l.expected : '—').join(' '));
    check('O7 zero mislabels across the accumulated cards',
      mislabels(dataB, cleanGt).length === 0);
    await freshSheet();
  }

  // ==== HW-B: the complete set ===============================================
  console.log('\n== HW-B: FIVE CARDS, ONE PHOTO EACH ========================');
  {
    const again = await composeCard({ seed: 7, width: 2000, page: 0 }, 0);
    check('B1 the synthetic cards are deterministic (seeded, no Math.random)',
      again.buffer.equals(cleanCards[0].buffer),
      again.buffer.length + ' bytes twice');
    const fed = await feedAllCards();
    check('B2 all five cards reach the alphabet through the real capture entry',
      fed.stage === 'alphabet', 'stage ' + fed.stage +
      (fed.at != null ? ' at card ' + (fed.at + 1) : ''));
    const capB = await page.evaluate(() => window.__hw.capture);
    check('B2b a card registers by its OWN star pair (2 anchors, the card path)',
      capB && capB.viaCard && capB.anchors === 2,
      capB ? 'anchors ' + capB.anchors + ', viaCard ' + capB.viaCard : 'no capture facts');
    // The UPLOAD path never goes near the live loop.
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
    check('B4 the cards aligned essentially in full', totals.acc >= totals.exp - 10,
      totals.acc + ' of ' + totals.exp + ' letters accepted');
    const bad = mislabels(data, cleanGt);
    check('B5 NO accepted letter is mislabeled (each stands on its own ground truth)',
      bad.length === 0, bad.length ? bad.slice(0, 5).join(' ') : totals.acc + ' letters checked');
    // Baseline consistency: letters without descenders sit ON the rule.
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
    const path0 = font.charToGlyph('n').getBoundingBox();
    check('B11 the rule became y=0: “n” sits on the font baseline',
      Math.abs(path0.y1) <= 90, 'n yMin ' + Math.round(path0.y1));
    const desc = font.charToGlyph('g').getBoundingBox();
    check('B12 descenders descend: “g” reaches below the baseline', desc.y1 < -60,
      'g yMin ' + Math.round(desc.y1));
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

    await page.click('#hwBackToLetters');
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test');
    const bytes2 = await fontBytes();
    check('B15 rebuilding from the same cards is BYTE-DETERMINISTIC',
      bytes1.equals(bytes2), bytes1.length + ' bytes twice');
    await page.fill('#hwTryInput', 'my very own letters 123');
    await page.screenshot({ path: path.join(SHOTS, '13-handwriting-type-test.png') });
  }

  // ==== HW-C: the refuse rule ================================================
  console.log('\n== HW-C: REFUSE RATHER THAN GUESS ==========================');
  const CORRUPT = 1; // card 2 — every word ≥ 3 letters, so nothing 1:1 survives
  {
    await freshSheet();
    const fed = await feedAllCards({ omit: 'x', corruptLines: [CORRUPT] });
    check('C1 the five variant cards (x never written, card 2 welded) still reach the alphabet',
      fed.stage === 'alphabet', 'stage ' + fed.stage +
      (fed.at != null ? ' at card ' + (fed.at + 1) : ''));
    const data = await lettersData();
    const l2 = data.lines[CORRUPT];
    check('C2 the welded card contributes NOTHING: every letter skipped, none accepted',
      l2.found && l2.accepted === 0 && l2.expected === 30,
      l2.accepted + ' accepted of ' + l2.expected);
    const kinds = {};
    for (const l of l2.letters) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
    check('C3 the skips are honest refusals: touching blobs and missing letters',
      (kinds.touching || 0) >= 15 && !l2.letters.some((l) => l.accepted),
      JSON.stringify(kinds));
    const variantGt = [];
    for (let i = 0; i < 5; i++) {
      const c = await composeCard({ seed: 7, width: 2000, page: i < 3 ? 0 : 1,
                                    omit: 'x', corruptLines: [CORRUPT] }, i);
      variantGt.push(...c.gt);
    }
    const bad = mislabels(data, variantGt);
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

    // The variant font FIRST (before recovery brings x back with the
    // clean card): absent letters are ABSENT FROM THE CMAP.
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const vb = await fontBytes();
    const vfont = opentype.parse(vb.buffer.slice(vb.byteOffset, vb.byteOffset + vb.length));
    check('C8 a letter never captured is simply ABSENT from the cmap (falls back, never blank)',
      vfont.charToGlyphIndex('x') === 0 && vfont.charToGlyphIndex('a') > 0,
      'x → glyph 0 (.notdef unmapped), a → glyph ' + vfont.charToGlyphIndex('a'));

    // Per-card recovery: “show me this card once more”, never start-over.
    await page.click('#hwBackToLetters');
    const stage2 = await feed(cleanCards[CORRUPT], CORRUPT);
    check('C9 re-photographing ONE card brings it back', stage2 === 'alphabet');
    const data2 = await lettersData();
    check('C10 the welded card now reads in full from the retake',
      data2.lines[CORRUPT].accepted >= 28,
      data2.lines[CORRUPT].accepted + ' of ' + data2.lines[CORRUPT].expected);
    check('C11 the other cards kept their letters (the retake replaced ONE card)',
      data2.lines[0].accepted >= 25 && data2.lines[2].accepted >= 24 &&
      data2.lines[3].accepted >= 22 && data2.lines[4].accepted >= 18,
      [0, 2, 3, 4].map((i) => data2.lines[i].accepted + '/' + data2.lines[i].expected).join(' '));
  }

  // ==== HW-D: “this looks joined-up” =========================================
  console.log('\n== HW-D: THIS LOOKS JOINED-UP ==============================');
  {
    // ONE welded card → the holding-hands message on that row, no
    // sheet-level banner.
    await freshSheet();
    const welded = await composeCard({ seed: 7, width: 2000, page: 0,
                                       corruptLines: [CORRUPT] }, CORRUPT);
    const stage = await feed(welded);
    check('D1 the welded card reaches the alphabet', stage === 'alphabet');
    const data = await lettersData();
    check('D2 the welded card is CLASSIFIED joined-up (touching dominates)',
      data.lines[CORRUPT].found && data.lines[CORRUPT].joined &&
      data.lines[CORRUPT].touching >= 0.5 * data.lines[CORRUPT].expected,
      data.lines[CORRUPT].touching + '/' + data.lines[CORRUPT].expected + ' touching');
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D3 that row says the letters are holding hands, and asks for little spaces',
      /holding hands/.test(rows[CORRUPT]) && /little space/.test(rows[CORRUPT]) &&
      /once more/.test(rows[CORRUPT]),
      '"' + rows[CORRUPT].slice(0, 90) + '…"');
    check('D4 every other row stays a quiet unread row',
      rows.every((t, i) => i === CORRUPT ||
        (/not read yet/.test(t) && !/holding hands/.test(t))));
    let banner = await page.evaluate(() =>
      document.getElementById('hwJoinedNote').style.display);
    check('D5 one joined card does NOT raise the sheet-level message',
      banner !== 'block', 'display ' + banner);
    check('D6 the refuse rule holds on the welded card: 0 accepted, 0 mislabels',
      data.lines[CORRUPT].accepted === 0 && mislabels(data, welded.gt).length === 0,
      data.lines[CORRUPT].accepted + ' accepted');
    await page.locator('#hwLineList').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '14-handwriting-joined-line.png') });

    // TWO touching pairs → merely messy: generic retake, not joined-up.
    const pairs = await composeCard({ seed: 7, width: 2000, page: 0,
                                      pairLine: 0, pairCount: 2 }, 0);
    await freshSheet();
    const stage2 = await feed(pairs);
    check('D7 the two-pairs card reaches the alphabet', stage2 === 'alphabet');
    const dp = await lettersData();
    check('D8 two touching pairs stay BELOW the joined-up gates (thresholds behave)',
      !dp.lines[0].joined && dp.lines[0].touching >= 2 &&
      dp.lines[0].touching < 0.35 * dp.lines[0].expected,
      dp.lines[0].touching + '/' + dp.lines[0].expected + ' touching, ' +
      dp.lines[0].accepted + ' accepted');
    const rows2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D9 that card keeps the GENERIC count message',
      /of \d+ letters/.test(rows2[0]) && rows2.every((t) => !/holding hands/.test(t)),
      '"' + rows2[0] + '"');
    check('D10 the touched letters were refused, never mislabeled — the rest read',
      mislabels(dp, pairs.gt).length === 0 &&
      dp.lines[0].accepted >= dp.lines[0].expected - 8,
      dp.lines[0].accepted + '/' + dp.lines[0].expected + ' accepted');

    // MOST read cards welded → the child writes joined-up throughout:
    // ONE gentle sheet-level message, with the rows kept generic.
    await freshSheet();
    let stage3 = 'alphabet';
    for (let i = 0; i < 3; i++) {
      const c = await composeCard({ seed: 7, width: 2000, page: 0,
                                    corruptLines: [0, 1, 2] }, i);
      stage3 = await feed(c, i === 0 ? null : i);
      if (stage3 !== 'alphabet') break;
    }
    check('D11 the three welded cards reach the alphabet', stage3 === 'alphabet');
    const dm = await lettersData();
    banner = await page.evaluate(() =>
      document.getElementById('hwJoinedNote').style.display);
    check('D12 most read cards joined → the sheet-level message appears',
      banner === 'block' && dm.lines.filter((l) => l.joined).length >= 3,
      dm.lines.filter((l) => l.joined).length + ' joined cards, display ' + banner);
    const surface = await page.evaluate(() => ({
      count: (document.querySelector('.wrap').innerText.match(/hold hands/g) || []).length,
      note: document.getElementById('hwJoinedNote').textContent
    }));
    check('D13 …exactly ONCE — not three copies of the line-level one',
      surface.count === 1 && /little space/.test(surface.note),
      surface.count + ' occurrence(s): "' + surface.note.slice(0, 70) + '…"');
    const rows3 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.hw-linerow span')).map((s) => s.textContent));
    check('D14 the card rows stay generic under the sheet-level message',
      rows3.every((t) => !/holding hands/.test(t)));
    check('D15 welded cards still contribute NOTHING: 0 accepted where welds ran',
      dm.lines[0].accepted <= 1 && dm.lines[1].accepted === 0 &&
      dm.lines[2].accepted === 0,
      [0, 1, 2].map((i) => dm.lines[i].accepted + '/' + dm.lines[i].expected).join(' '));
    check('D16 no blame word in either joined-up message',
      !/failed|invalid|error|wrong|cursive/i.test(rows.join(' ') + ' ' + surface.note));
  }

  // ==== HW-E: a real camera ==================================================
  console.log('\n== HW-E: A REAL CAMERA =====================================');
  {
    // A hand-held CARD under a true projective warp at 720p: slight
    // turn and keystone, blur, JPEG — the hold a child photographing
    // one cut card actually produces.
    const CARD_QUAD = [[52, 128], [1230, 158], [1196, 590], [78, 548]]; // tl tr br bl
    const cardE = await composeCard({ seed: 7, width: 2000, page: 0 }, 1);
    const camCard = await warp(cardE, CARD_QUAD, 1280, 720);
    await freshSheet();
    const stage = await feed(camCard);
    check('E1 a hand-held card photo (true projective warp, blur, JPEG) reads',
      stage === 'alphabet', 'stage ' + stage);
    const capE = await page.evaluate(() => window.__hw.capture);
    const dE = await lettersData();
    check('E2 …with the CORRECT identity, essentially in full',
      dE.lines[1].found && dE.lines[1].accepted >= dE.lines[1].expected - 3 &&
      dE.lines.filter((l) => l.found).length === 1,
      'card 2: ' + dE.lines[1].accepted + '/' + dE.lines[1].expected +
      ', x-height ~' + Math.round(capE.xHeightPx) + 'px');
    check('E3 ZERO mislabels under the warp — refuse-rather-than-guess holds',
      mislabels(dE, camCard.gt).length === 0);

    // An upside-down card photo is turned around and read.
    const flippedCard = await page.evaluate(async (durl) => {
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = durl; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.translate(c.width, c.height); x.rotate(Math.PI);
      x.drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.92);
    }, camCard.dataURL);
    await freshSheet();
    const stageF = await feed({ buffer: Buffer.from(flippedCard.split(',')[1], 'base64'),
                                name: 'card-upside-down.jpg', mime: 'image/jpeg' });
    const capF = await page.evaluate(() => window.__hw.capture);
    const dF = await lettersData();
    check('E4 an upside-down card photo is TURNED AROUND and read (never refused, never misread)',
      stageF === 'alphabet' && capF && capF.flipped &&
      dF.lines[1].found && dF.lines[1].accepted >= dF.lines[1].expected - 3,
      'stage ' + stageF + ', flipped ' + (capF && capF.flipped) +
      ', ' + dF.lines[1].accepted + '/' + dF.lines[1].expected);

    // A photo of something else entirely still refuses with kind words.
    await freshSheet();
    const garbage = fs.readFileSync(path.join(__dirname, 'surrogate-001.png'));
    const stageG = await feed({ buffer: garbage, name: 'drawing.png' });
    const quietG = await page.evaluate(() => ({
      shown: document.getElementById('hwQuietSheet').style.display === 'block',
      text: document.getElementById('hwQuietSheet').textContent
    }));
    check('E5 a photo of something else REFUSES (no card can be invented from a drawing)',
      stageG === 'sheet' && quietG.shown, 'stage ' + stageG);
    check('E6 …with the kind retake words, never blame',
      /one whole\s+card in the picture/.test(quietG.text.replace(/\s+/g, ' ')) &&
      !/failed|invalid|error|wrong/i.test(quietG.text));

    // Far away: the same card warp at 640×360. Everything that can
    // read still reads, nothing is mislabeled.
    const low = await warp(cardE, CARD_QUAD.map(([x, y]) => [x / 2, y / 2]), 640, 360,
                           { blur: 0.4 });
    const stageL = await feed(low);
    const capL = stageL === 'alphabet'
      ? await page.evaluate(() => window.__hw.capture) : null;
    if (stageL === 'alphabet') {
      const dL = await lettersData();
      check('E7 a 640×360 card photo still reads what it can, honestly',
        dL.lines[1].found && dL.lines[1].accepted >= 10,
        dL.lines[1].accepted + '/' + dL.lines[1].expected +
        ', x-height ~' + (capL ? Math.round(capL.xHeightPx) : 0) + 'px' +
        (capL && capL.coarse ? ' (coarse — the kind note shows)' : ''));
      check('E8 zero mislabels even at 640×360 — refusals rise, guesses never',
        mislabels(dL, low.gt).length === 0);
    } else {
      check('E7 a 640×360 card photo refuses honestly rather than guessing',
        stageL === 'sheet', 'stage ' + stageL + ' (refused, no guess)');
      check('E8 zero mislabels even at 640×360 — nothing was read, nothing mislabeled', true);
    }

    // ---- the LEGACY sheet: old printouts keep their whole-page path ----
    const QUAD = [[160, 10], [1224, 14], [1124, 712], [418, 706]]; // the field photo's numbers
    const legacy = await compose({ seed: 7, width: 2000, legacy: true });
    legacy.name = 'legacy-sheet.png';
    const camL = await warp(legacy, QUAD, 1280, 720);
    await freshSheet();
    const stageOld = await feed(camL);
    const capOld = await page.evaluate(() => window.__hw.capture);
    const dOld = await lettersData();
    check('E9 a LEGACY sheet under the field warp still reads whole-page (anchors 10 of 10)',
      stageOld === 'alphabet' && capOld && capOld.anchors === 10 &&
      dOld.lines.every((l) => l.found && l.accepted >= l.expected - 2),
      'anchors ' + (capOld && capOld.anchors) + ', ' +
      dOld.lines.map((l) => l.accepted + '/' + l.expected).join(' '));
    check('E10 …zero mislabels on the frozen path, vertical squash measured',
      mislabels(dOld, camL.gt).length === 0 &&
      capOld.anis > 0.4 && capOld.anis < 0.75,
      'vertical scale ' + capOld.anis.toFixed(2) + '× the horizontal');
    check('E11 the coarse note appears when the letters land small, with no blame word',
      capOld.coarse === (capOld.xHeightPx < 14) &&
      await page.evaluate(() => {
        const el = document.getElementById('hwCoarseNote');
        return (el.style.display === 'block') === window.__hw.capture.coarse &&
               !/failed|invalid|error|wrong/i.test(el.textContent);
      }),
      'x-height ~' + Math.round(capOld.xHeightPx) + 'px');
    await page.locator('#hwGrid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '15-handwriting-camera-alphabet.png') });

    // A markless legacy sheet (printed before the end-marks existed)
    // still reads square-on through the RULE fallback.
    const markless = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000, legacy: true });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const G = HWSheet.LEGACY.GEOM, W = c.width;
      const R = G.anchorRadius * W * 1.8;
      x.fillStyle = '#ffffff';
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        const y = HWSheet.LEGACY.ruleYFrac(i) * c.height;
        x.fillRect(G.anchorXLeft * W - R, y - R, 2 * R, 2 * R);
        x.fillRect(G.anchorXRight * W - R, y - R, 2 * R, 2 * R);
      }
      return c.toDataURL('image/png');
    })()`);
    await freshSheet();
    const stageM = await feed({ buffer: Buffer.from(markless.split(',')[1], 'base64'),
                                name: 'markless.png' });
    const capM = await page.evaluate(() => window.__hw.capture);
    const dM = await lettersData();
    check('E12 an old markless sheet still reads square-on through the RULE fallback',
      stageM === 'alphabet' && capM && capM.anchors === 0 &&
      dM.lines.every((l) => l.found && l.accepted >= l.expected - 3),
      'anchors ' + (capM && capM.anchors) + ', ' +
      dM.lines.map((l) => l.accepted + '/' + l.expected).join(' '));
    check('E13 …and zero mislabels on the fallback path too',
      mislabels(dM, legacy.gt).length === 0);

    // THE PHANTOM-LADDER REGRESSION (J9 of the card era). Left stars
    // hidden on a legacy sheet at 640×360: a look-alike ladder can
    // form, and it must be REFUSED, never read wrong.
    const noLeftURL = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000, legacy: true });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const G = HWSheet.LEGACY.GEOM, W = c.width;
      const R = G.anchorRadius * W * 1.6;
      x.fillStyle = '#ffffff';
      for (let i = 0; i < HWSheet.LINES.length; i++) {
        const y = HWSheet.LEGACY.ruleYFrac(i) * c.height;
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
      return { ok: out.ok, reason: out.reason,
               refusedBy: logs.filter((l) => /REFUSED/.test(l)).join(' | ') };
    })(${JSON.stringify(noLeftLow)})`);
    check('E14 half the stars hidden → a look-alike ladder can form, and it is REFUSED, never read wrong',
      phantom.ok === false && /REFUSED/.test(phantom.refusedBy),
      phantom.refusedBy.slice(0, 110) || 'read ok (should have refused)');
  }

  // ==== HW-F: free motion — cards, strictly one at a time ====================
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
          many: window.__hw.live.many,
          log: document.getElementById('devLog').textContent
        }));
        check('F2 re-showing an already-collected card replaces it silently (latest wins)',
          rep.replaced >= 1 && rep.size === 1,
          rep.replaced + ' replacement(s), still 1 card held');
        check('F2b ONE card in view never raises the one-card overlay',
          !rep.many && await p.evaluate(() =>
            document.getElementById('hwOneCardNote').style.display !== 'block'));
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
          /one card met — card 2, \d+ of \d+ letters, x-height ~\d+px \(measured\)/.test(rep.log));
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
      ' — the close-up the bigger cards were designed for');
    check('F11 the cards deliver the pixels: every measured x-height is ABOVE the coarse floor',
      xhs.every((x) => x >= HW_COARSE_FLOOR), xhs.map((x) => Math.round(x)).join(' '));
  }

  // A card shown STILL ATTACHED — the uncut page held close on one
  // card — collects through the very same loop, with the same identity.
  {
    const { browser, p, errors } = await camPage('hw-card-attached.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live && window.__hw.live.collected.size >= 1,
      null, { timeout: 60000 });
    const got = await p.evaluate(() => Array.from(window.__hw.live.collected.keys()));
    check('F12 an ATTACHED card collects exactly like a cut one — cutting is never required',
      got.length === 1 && got[0] === 1,
      'collected [' + got.map((x) => x + 1).join(' ') + ']');
    await p.click('#hwLiveDoneBtn');
    await p.waitForFunction(() => window.__hw.stage === 'alphabet');
    const data = await lettersData(p);
    const bad = mislabelsFramed(data.lines, feedsMeta.fixtures.attached.map);
    check('F13 …reads essentially in full with zero mislabels',
      data.lines[1].accepted >= 28 && bad.length === 0 && errors.length === 0,
      data.lines[1].accepted + '/' + data.lines[1].expected + ', ' + bad.length + ' mislabels');
    await browser.close();
  }

  // MORE THAN ONE CARD IN VIEW: the whole page 1 in frame (three
  // cards). The gentle overlay shows, its words carry no blame and no
  // jargon, and NOTHING is collected however long the view stays.
  {
    const { browser, p, errors } = await camPage('hw-many.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 4, null, { timeout: 60000 });
    const many = await p.evaluate(() => ({
      many: window.__hw.live.many,
      manySeen: window.__hw.live.manySeen,
      collected: window.__hw.live.collected.size,
      count: document.getElementById('hwLiveCount').textContent,
      overlay: document.getElementById('hwOneCardNote').style.display,
      text: document.getElementById('hwOneCardNote').textContent
    }));
    check('F14 three cards in view → the one-card overlay shows and NOTHING is collected',
      many.many && many.manySeen >= 1 && many.collected === 0 &&
      /^0 of 5$/.test(many.count) && many.overlay === 'block',
      many.manySeen + ' many-verdicts, ' + many.collected + ' collected');
    check('F14b the overlay speaks child words — one card at a time, no blame, no jargon',
      /[Oo]ne card at a time/.test(many.text) &&
      !/error|failed|invalid|wrong|detected|multiple|scan/i.test(many.text),
      '"' + many.text + '"');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '23-hw-one-card-overlay.png') });
    check('F14c zero page errors while the overlay is up', errors.length === 0);
    await browser.close();
  }

  // …and the overlay CLEARS by itself when the view returns to one
  // card: page 1 whole (2s a frame ×4), then cut card 1. The card
  // collects, and at the moment it collects the overlay is down
  // (a 'line' verdict clears `many` before the collect callback runs).
  {
    const { browser, p, errors } = await camPage('hw-many-then-one.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live && window.__hw.live.collected.size >= 1,
      null, { timeout: 90000 });
    const after = await p.evaluate(() => ({
      manySeen: window.__hw.live.manySeen,
      overlayLog: window.__hw.overlayLog.join(','),
      got: Array.from(window.__hw.live.collected.keys())
    }));
    // The overlay's own history (recorded at each transition): it came
    // up for the many-card view and went down again — a 'line' verdict
    // clears it before the collect lands, so the down-transition is in
    // the log by the time the card is held.
    check('F15 the overlay shows for the many-card view, then CLEARS when one card returns — and the card collects',
      after.manySeen >= 1 && /true,false/.test(after.overlayLog) &&
      after.got.length === 1 && after.got[0] === 0,
      after.manySeen + ' many-verdicts, overlay [' + after.overlayLog +
      '], then card ' + (after.got[0] + 1) + ' collected');
    check('F15b zero page errors across the transition', errors.length === 0);
    await browser.close();
  }

  // A LEGACY sheet in frame: the frozen ladder registers and all five
  // lines land at once — old printouts keep their one-shot path.
  {
    const { browser, p, errors } = await camPage('hw-legacy.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.stage === 'alphabet', null, { timeout: 90000 });
    const data = await lettersData(p);
    const lgt = feedsMeta.fixtures.legacy.gt.map((g) => ({ line: g.line, ch: g.ch,
      x0: hwFeeds.frameX(feedsMeta.fixtures.legacy.map, g.x0),
      x1: hwFeeds.frameX(feedsMeta.fixtures.legacy.map, g.x1) }));
    check('F16 a LEGACY whole sheet fills all five slots at once and proceeds',
      data.lines.every((l) => l.found && l.accepted >= l.expected - 2) &&
      data.have.length === 62,
      data.lines.map((l) => l.accepted + '/' + l.expected).join(' ') + ', ' +
      data.have.length + '/62 letters');
    check('F17 …with zero mislabels through the frozen whole-sheet reader',
      mislabels({ lines: data.lines }, lgt).length === 0);
    check('F17b zero page errors on the legacy launch', errors.length === 0);
    await browser.close();
  }

  // The sweep: one launch, the file shows cut cards 1→2→3 one after
  // another, and the collection accumulates in free motion.
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
    check('F18 showing the cards one after another collects them one at a time, in free motion',
      snap.collected === '0,1,2' && /^3 of 5$/.test(snap.count),
      'cards [' + snap.collected + '], "' + snap.count + '"');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '17-hw-live-collecting.png') });
    await p.click('#hwLiveDoneBtn');
    await p.waitForFunction(() => window.__hw.stage === 'alphabet');
    const data = await lettersData(p);
    check('F19 Done-early after the sweep keeps all three collected cards',
      data.lines[0].found && data.lines[1].found && data.lines[2].found &&
      !data.lines[3].found && !data.lines[4].found,
      data.lines.map((l) => l.found ? l.accepted + '/' + l.expected : '—').join(' '));
    check('F20 zero page errors on the sweep launch', errors.length === 0);
    await browser.close();
  }

  // Nothing to collect: a drawing (the base suite's own camera fixture)
  // and an UNWRITTEN card both collect nothing, kindly — and the
  // drawing journey itself never runs the loop at all.
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
    check('F21 the drawing journey never runs the card loop (no sampling, no row)',
      drawSide.samples === 0 && drawSide.row !== 'block',
      drawSide.samples + ' samples');
    await p.click('#cameraCloseBtn');
    // THEN: armed, the same drawing yields NOTHING — no card invented.
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 3, null, { timeout: 60000 });
    const g = await p.evaluate(() => ({
      size: window.__hw.live.collected.size,
      many: window.__hw.live.manySeen,
      count: document.getElementById('hwLiveCount').textContent
    }));
    check('F22 a photo of something else collects NOTHING — ambiguity keeps sweeping, never guesses',
      g.size === 0 && g.many === 0 && /^0 of 5$/.test(g.count),
      g.size + ' collected after 3+ samples');
    check('F23 zero page errors while refusing', errors.length === 0);
    await browser.close();
  }
  {
    const { browser, p, errors } = await camPage('hw-card-blank.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 2, null, { timeout: 60000 });
    const b = await p.evaluate(() => window.__hw.live.collected.size);
    check('F24 an UNWRITTEN card (anchors + model print, no ink) collects nothing',
      b === 0 && errors.length === 0, b + ' collected');
    await browser.close();
  }

  // ==== HW-G: the page never blocks — the analysis lives in a worker =========
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
    // (videoWidth 0) is never sampled.
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
    // A REAL collection with the heartbeat running.
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
    check('G6 the main thread stays free DURING a real collection (max gap < 120ms; the card still lands)',
      hb.max < 120 && got.keys.length === 1 && got.keys[0] === 0,
      'max gap ' + Math.round(hb.max) + 'ms, worker cost ' + got.cost +
      'ms, collected [' + got.keys.map((x) => x + 1).join(' ') + ']');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '19-hw-worker-line-ticked.png') });
    check('G7 zero page errors while collecting through the worker', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await browser.close();
  }

  // ==== HW-P: the phantom second card ========================================
  // The field failure: a child held up ONE cut card and the reader
  // refused it claiming TWO cards stood in view. Junk pairs — two dark
  // specks of room clutter, star-sized, isolated, horizontally apart —
  // implied a card that was never there; their model band caught the
  // REAL card's print at a wrong offset and scale; and the clipped
  // slice aligned "surely". The survey then counted a second cluster.
  // The fix: A NAMING MUST MEET THE READING STANDARD — the print a
  // pair claims must FIT the card that pair implies (unit agreement +
  // print coverage, MODEL_UNIT_LO/HI + MODEL_COVER). These checks
  // drive the still path directly on a seeded synthetic room whose
  // numbers match the field log: frame 1280 wide, ~490 raw components
  // (field: 498), a junk pair of span ~1140 (field: 1142) and the real
  // pair of span ~453 (field: 454).
  console.log('\n== HW-P: THE PHANTOM SECOND CARD ===========================');
  // The room: desk gradient, two strips of tiny dark specks (seeded),
  // two dark desk objects (the junk pair's endpoints), a hand shadow,
  // and ONE real filled card. blur + JPEG as a camera produces.
  const PHANTOM_ROOM = `(async (opts) => {
    const made = (${COMPOSE})({ seed: 7, width: 2000, page: 0 });
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
    const k = made.cards.find((c) => c.index === (opts.card || 0));
    const fw = 1280, fh = opts.fh || 720;
    const c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const x = c.getContext('2d', { willReadFrequently: true });
    let s = (opts.seed >>> 0) || 17;
    const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const grad = x.createLinearGradient(0, 0, 0, fh);
    grad.addColorStop(0, '#8a8f99');
    grad.addColorStop(1, '#646b79');
    x.fillStyle = grad;
    x.fillRect(0, 0, fw, fh);
    x.fillStyle = '#2a2e38';
    for (const reg of (opts.specks ||
        [{ x0: 30, y0: 30, x1: 1250, y1: 200, n: 230, wLo: 1.5, wHi: 3, hLo: 1.5, hHi: 3 },
         { x0: 30, y0: 540, x1: 1250, y1: 700, n: 230, wLo: 1.5, wHi: 3, hLo: 1.5, hHi: 3 }])) {
      for (let i = 0; i < reg.n; i++) {
        const px = reg.x0 + rnd() * (reg.x1 - reg.x0);
        const py = reg.y0 + rnd() * (reg.y1 - reg.y0);
        x.fillRect(px, py, reg.wLo + rnd() * (reg.wHi - reg.wLo),
                   reg.hLo + rnd() * (reg.hHi - reg.hLo));
      }
    }
    const sw = img.width, sh = k.cutBottom - k.cutTop;
    const scale = opts.cardW / sw;
    const cardX = opts.cardX != null ? opts.cardX : 640 - opts.cardW / 2;
    const cardY = opts.cardY != null ? opts.cardY : 370 - sh * scale / 2;
    x.fillStyle = '#ffffff';
    x.drawImage(img, 0, k.cutTop, sw, sh, cardX, cardY, opts.cardW, sh * scale);
    x.fillStyle = '#14181f';
    for (const b of (opts.blobs || [])) x.fillRect(b[0], b[1], b[2], b[3]);
    if (opts.hand !== false) {
      x.fillStyle = '#4d4238';
      x.fillRect(560, 500, 180, 220);
    }
    const b2 = document.createElement('canvas');
    b2.width = fw; b2.height = fh;
    const bx = b2.getContext('2d');
    bx.filter = 'blur(0.5px)';
    bx.drawImage(c, 0, 0);
    const durl = b2.toDataURL('image/jpeg', 0.85);
    const img2 = new Image();
    await new Promise((r) => { img2.onload = r; img2.src = durl; });
    const c2 = document.createElement('canvas');
    c2.width = fw; c2.height = fh;
    const x2 = c2.getContext('2d', { willReadFrequently: true });
    x2.drawImage(img2, 0, 0);
    const photo = { width: fw, height: fh,
      imageData: x2.getImageData(0, 0, fw, fh), filename: 'room' };
    // The naming standard under test is parameterised; opts.loosen
    // disables it to prove the fixture reproduces the FIELD failure on
    // the old counting standard (the params are restored either way).
    const PL = HWRead.LINE_PARAMS;
    const saved = { lo: PL.MODEL_UNIT_LO, hi: PL.MODEL_UNIT_HI, cov: PL.MODEL_COVER };
    if (opts.loosen) { PL.MODEL_UNIT_LO = 0; PL.MODEL_UNIT_HI = 1e9; PL.MODEL_COVER = 0; }
    let out, live, logs = [];
    try {
      out = HWRead.read(photo, { log: (l) => logs.push(l) });
      live = HWRead.readFrame(photo, { log: function () {} });
    } finally {
      PL.MODEL_UNIT_LO = saved.lo; PL.MODEL_UNIT_HI = saved.hi; PL.MODEL_COVER = saved.cov;
    }
    return { ok: out.ok, reason: out.reason || null, logs,
             comps: +(logs[0].match(/(\\d+) raw components/) || [])[1],
             live: live.kind, liveCards: live.cards || null,
             lines: out.ok ? out.lines.map((ln) => ({
               index: ln.index, found: ln.found, accepted: ln.accepted || 0,
               expected: ln.expected || 0,
               letters: (ln.letters || []).map((l) => ({
                 ch: l.ch, kind: l.kind, accepted: l.accepted,
                 x0: l.blobX0, x1: l.blobX1 }))
             })) : null,
             gt: made.gt.filter((g) => g.line === (opts.card || 0))
               .map((g) => ({ line: g.line, ch: g.ch,
                 x0: g.x0 * scale + cardX, x1: g.x1 * scale + cardX })) };
  })`;
  const phantomRoom = (opts) =>
    page.evaluate(`(${PHANTOM_ROOM})(${JSON.stringify(opts)})`);
  // The canonical field-numbers scene: card 1 (span ~453) plus the two
  // desk objects whose pair (span ~1140) puts a model band on the
  // card's own printed sentence at the wrong offset and scale.
  const FIELD_SCENE = { card: 0, cardW: 580, cardX: 350, cardY: 260,
                        blobs: [[62, 542, 15, 15], [1202, 544, 15, 15]] };
  {
    // P1 — the reproduction: the OLD counting standard refuses ONE card
    // as many. This is the field log reborn: same frame width, ~490
    // raw components, junk span ~1140, real span ~453.
    const before = await phantomRoom(Object.assign({ loosen: true }, FIELD_SCENE));
    check('P1 REPRODUCED: on the old counting standard, ONE card in a cluttered room is refused as MANY cards',
      before.ok === false && before.reason === 'many' && before.live === 'many' &&
      before.logs.some((l) => /more than one card in this photograph/.test(l)),
      'reason ' + before.reason + ', ' + before.comps + ' raw components (field: 498)');
    check('P1b …the phantom\'s own evidence: a junk pair of span ~1140 surely-named the real card\'s print',
      before.logs.some((l) => /span 11\d\dpx.*names card 1 surely/.test(l)) &&
      before.logs.some((l) => /span 45\dpx.*names card 1 surely/.test(l)),
      before.logs.filter((l) => /names card \d surely/.test(l)).map((l) =>
        l.match(/span \d+px/)[0]).join(' + ') + ' both named "card 1"');

    // P2 — the fix: the same photograph now READS the one card that is
    // really there, in full, correct identity, zero mislabels.
    const after = await phantomRoom(FIELD_SCENE);
    const lineP = after.ok ? after.lines.find((ln) => ln.found) : null;
    check('P2 FIXED: the same photograph reads the ONE card that is really there',
      after.ok === true && lineP && lineP.index === 0 &&
      lineP.accepted >= lineP.expected - 2 &&
      after.lines.filter((ln) => ln.found).length === 1 &&
      after.live === 'line',
      lineP ? 'card 1, ' + lineP.accepted + '/' + lineP.expected + ' letters'
            : 'reason ' + after.reason);
    check('P2b …with zero mislabels against the fixture\'s own ground truth',
      after.ok && mislabels({ lines: after.lines }, after.gt).length === 0);
    // P3 — the junk pair is refused BY MEASUREMENT, and the log says
    // both what was refused and what was surely named (the field log
    // showed only unsure pairs — the survey's own beliefs were
    // invisible; now they are recorded).
    check('P3 the junk pair is refused by the reading standard, with its measurements in the log',
      after.logs.some((l) =>
        /span 11\d\dpx.*does not FIT this pair's card \(unit \d+px where the pair implies \d+px; print covers \d+% of the rule\)/.test(l)),
      (after.logs.find((l) => /does not FIT/.test(l)) || '').slice(4, 120));
    check('P3b the SURE naming that stands is in the log too, with its own evidence',
      after.logs.some((l) =>
        /span 45\dpx.*names card 1 surely \(mixed u=[\d.]+, unit \d+px of \d+px implied, print covers \d+%/.test(l)),
      (after.logs.find((l) => /names card 1 surely/.test(l)) || '').slice(4, 130));
  }
  {
    // P4 — the distance ladder: the SAME room, the card swept from far
    // (model unit ~1.4px) to close (~20px). At NO distance may a
    // single card produce the many-cards refusal — far is a quiet
    // generic refusal (the live sweep keeps sweeping), near is a read
    // of the right card.
    const rungs = [88, 150, 250, 350, 450, 500, 580, 800, 1250];
    let manyAt = [], wrongAt = [], readAt = [], refusedAt = [];
    for (const w of rungs) {
      const r = await phantomRoom(Object.assign({}, FIELD_SCENE,
        { cardW: w, cardX: null, cardY: null }));
      if (r.reason === 'many' || r.live === 'many') manyAt.push(w);
      else if (r.ok) {
        const ln = r.lines.find((l) => l.found);
        readAt.push(w);
        if (!ln || ln.index !== 0) wrongAt.push(w);
      } else refusedAt.push(w);
    }
    check('P4 a single card is NEVER refused as many cards, at any distance (unit ~1.4px → ~20px)',
      manyAt.length === 0,
      manyAt.length ? 'many at cardW ' + manyAt.join(',')
        : 'read at [' + readAt.join(' ') + '], quiet refusal at [' + refusedAt.join(' ') + ']');
    check('P4b every rung that reads, reads the RIGHT card; every far rung refuses quietly',
      wrongAt.length === 0 && readAt.length >= 3 && refusedAt.length >= 3,
      readAt.length + ' read, ' + refusedAt.length + ' refused, 0 wrong');
  }
  {
    // P5 — the sibling failure of the same root cause, pinned: with the
    // naming standard off, a junk pair over the room's specks named the
    // caps card and the DP then "accepted" letters from a card that is
    // not even in view — junk in the child's font. The standard
    // refuses the frame instead.
    const JUNK_SCENE = { card: 1, cardW: 420, cardX: 430, cardY: 280, seed: 4,
      specks: [{ x0: 40, y0: 40, x1: 1240, y1: 230, n: 70, wLo: 2, wHi: 9, hLo: 2, hHi: 7 },
               { x0: 40, y0: 500, x1: 1240, y1: 690, n: 70, wLo: 2, wHi: 9, hLo: 2, hHi: 7 }],
      hand: false };
    const junkBefore = await phantomRoom(Object.assign({ loosen: true }, JUNK_SCENE));
    const junkLine = junkBefore.ok ? junkBefore.lines.find((ln) => ln.found) : null;
    check('P5 REPRODUCED: the old standard READ a card that is not in view — junk letters accepted',
      junkBefore.ok === true && junkLine && junkLine.index !== 1 &&
      junkLine.accepted >= 10,
      junkLine ? 'card ' + (junkLine.index + 1) + ' "read" with ' + junkLine.accepted +
        ' junk letters (card 2 was in view)' : 'did not reproduce');
    const junkAfter = await phantomRoom(JUNK_SCENE);
    check('P5b FIXED: the same frame refuses quietly — no junk letter can reach the font',
      junkAfter.ok === false && junkAfter.reason !== 'many' &&
      junkAfter.live === 'nothing',
      'reason ' + junkAfter.reason + ', live ' + junkAfter.live);
  }
  {
    // P6 — the strict rule is UNTOUCHED: two genuine cut cards on one
    // desk still refuse with the one-card message, on both paths. (The
    // uncut 3-card and 2-card pages are asserted in HW-1.)
    const two = await page.evaluate(`(async () => {
      const made = (${COMPOSE})({ seed: 7, width: 2000, page: 0 });
      const img = new Image();
      await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
      const fw = 1280, fh = 960;
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#6a7180';
      x.fillRect(0, 0, fw, fh);
      const w = 1100;
      for (const [idx, top] of [[0, 60], [2, 520]]) {
        const k = made.cards.find((cc) => cc.index === idx);
        const sh = k.cutBottom - k.cutTop;
        x.drawImage(img, 0, k.cutTop, img.width, sh,
                    (fw - w) / 2, top, w, sh * (w / img.width));
      }
      const b = document.createElement('canvas');
      b.width = fw; b.height = fh;
      const bx = b.getContext('2d');
      bx.filter = 'blur(0.5px)';
      bx.drawImage(c, 0, 0);
      const durl = b.toDataURL('image/jpeg', 0.85);
      const img2 = new Image();
      await new Promise((r) => { img2.onload = r; img2.src = durl; });
      const c2 = document.createElement('canvas');
      c2.width = fw; c2.height = fh;
      const x2 = c2.getContext('2d', { willReadFrequently: true });
      x2.drawImage(img2, 0, 0);
      const photo = { width: fw, height: fh,
        imageData: x2.getImageData(0, 0, fw, fh), filename: 'two' };
      const logs = [];
      const out = HWRead.read(photo, { log: (l) => logs.push(l) });
      const live = HWRead.readFrame(photo, { log: function () {} });
      return { ok: out.ok, reason: out.reason || null,
               live: live.kind, liveCards: live.cards || null,
               refusal: logs.find((l) => /more than one card/.test(l)) || '' };
    })()`);
    check('P6 two GENUINE cut cards on one desk still refuse — the strict rule is untouched',
      two.ok === false && two.reason === 'many' && two.live === 'many' &&
      (two.liveCards || []).join(',') === '0,2' &&
      /more than one card in this photograph \(cards 1, 3\)/.test(two.refusal),
      '"' + two.refusal.slice(4, 90) + '"');
  }

  // ==== HW-L: the readiness light ============================================
  // The product owner, verbatim: "can we get red and green marker on
  // camera itself to understand when is it reading the data correctly
  // and should be clicked ?" Green is the live worker's own per-frame
  // verdict — the same hwRead a pressed Take would run — so every
  // fixture here asserts the EQUIVALENCE: while the light is green,
  // HWRead.read on the grabbed live frame reads; while red, it refuses.
  console.log('\n== HW-L: THE READINESS LIGHT ===============================');
  // Grab the current live frame at native resolution and run the STILL
  // reader on it — the exact photograph a pressed Take would hand over.
  const GRAB_READ = `() => {
    const v = document.getElementById('cameraLive');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(v, 0, 0);
    const out = HWRead.read(
      { width: c.width, height: c.height,
        imageData: x.getImageData(0, 0, c.width, c.height), filename: 'grab' },
      { log: function () {} });
    return { ok: out.ok, reason: out.reason || null };
  }`;
  const lightFacts = `() => {
    const w = document.getElementById('hwReadyLight');
    if (!w) return { present: false };
    const glow = w.children[0], ring = w.children[1];
    const v = document.getElementById('cameraLive');
    const vr = v.getBoundingClientRect();
    const wr = w.getBoundingClientRect();
    return { present: true,
             display: w.style.display,
             colour: HWLight.state.colour,
             text: w.textContent.trim(),
             glowOn: glow.style.opacity === '1',
             ringOn: ring.style.opacity === '1',
             glowShape: glow.style.borderRadius,
             ringHollow: ring.style.background === 'transparent' &&
                         /solid/.test(ring.style.border || ring.style.borderTop || ''),
             size: wr.width,
             dxRight: Math.abs((vr.right - HWLight.INSET) - wr.right),
             dyTop: Math.abs((vr.top + HWLight.INSET) - wr.top),
             video: { top: vr.top, height: vr.height, width: vr.width },
             wrapBottom: wr.bottom };
  }`;
  let lightDisagreements = 0;   // green⇔read across the whole ladder

  // The drawing camera gets NO light — it has no reader, so a light
  // there would be an invented claim. Same launch then arms the
  // journey on the same non-card view: light present and RED.
  {
    const camFeed = require(path.join(__dirname, 'make-camera-feed.js'));
    if (!fs.existsSync(camFeed.OUT)) await camFeed.generate();
    const { browser, p, errors } = await camPage('camera-feed-001.y4m');
    await p.click('#cameraBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return document.getElementById('cameraPanel').style.display === 'block' &&
             v.videoWidth > 0;
    }, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    const unarmed = await p.evaluate(() =>
      !!document.getElementById('hwReadyLight'));
    check('L1 the DRAWING camera never grows the light — no reader, no claim',
      !unarmed, unarmed ? 'light element exists unarmed' : 'no light element');
    await p.click('#cameraCloseBtn');
    // Armed, the same drawing in view: the light exists and is RED —
    // nothing card-like reads here.
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live.samples >= 2 && HWLight.state.colour === 'red',
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if (still.ok !== (f.colour === 'green')) lightDisagreements++;
    check('L2 nothing readable in view → the light is RED, and Take would refuse the same frame',
      f.present && f.colour === 'red' && !f.glowOn && f.ringOn && still.ok === false,
      'light ' + f.colour + ', still reader ok=' + still.ok);
    check('L2b the light is wordless — no text on or near it',
      f.text === '', f.text ? '"' + f.text + '"' : 'no words');
    check('L2c zero page errors', errors.length === 0);
    await browser.close();
  }

  // ONE READABLE CARD: green, equivalent to a Take that reads, placed
  // on the picture's clear top-right corner, tracking the video ≤1px
  // through a resize, stable across further verdicts, and gone while a
  // taken picture is being decided about.
  {
    const { browser, p, errors } = await camPage('hw-card-1.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.HWLight && HWLight.state.colour === 'green',
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if (still.ok !== (f.colour === 'green')) lightDisagreements++;
    check('L3 a readable card → the light is GREEN, and Take WOULD read this very view',
      f.colour === 'green' && still.ok === true,
      'light ' + f.colour + ', still reader ok=' + still.ok);
    check('L3b green and red differ by SHAPE as well as colour: filled round glow vs hollow ring',
      f.glowOn && !f.ringOn && f.glowShape === '50%' && f.ringHollow,
      'glow on, ring off; ring is a hollow circle');
    check('L4 the light rides the picture: top-right corner, ≤1px off the video rect',
      f.dxRight <= 1 && f.dyTop <= 1 && f.size >= 18 && f.size <= 34,
      'off by ' + f.dxRight.toFixed(1) + 'px / ' + f.dyTop.toFixed(1) +
      'px, ' + Math.round(f.size) + 'px light');
    // The corner is clear of the card BY MEASUREMENT: the fixture map
    // says where the card's top edge lands in the frame.
    const cardTopFrac = feedsMeta.fixtures['card-1'].map.oy / hwFeeds.H;
    const cardTopCss = f.video.top + f.video.height * cardTopFrac;
    check('L4b …and that corner never covers the card (card top measured well below the light)',
      f.wrapBottom < cardTopCss - 40,
      'light ends ' + Math.round(cardTopCss - f.wrapBottom) + 'px above the card');
    // Resize: the video box changes, the light follows within 1px.
    await p.setViewportSize({ width: 560, height: 700 });
    await p.waitForTimeout(250);
    const f2 = await p.evaluate(`(${lightFacts})()`);
    check('L5 a resized window moves the picture and the light follows (≤1px, size re-fitted)',
      f2.video.width < f.video.width && f2.dxRight <= 1 && f2.dyTop <= 1,
      'video ' + Math.round(f.video.width) + '→' + Math.round(f2.video.width) +
      'px, off by ' + f2.dxRight.toFixed(1) + 'px');
    await p.setViewportSize({ width: 1100, height: 900 });
    // Stability: a steady readable view never flickers — more verdicts
    // arrive and the light does not leave green once.
    const before = await p.evaluate(() => ({
      verdicts: HWLight.state.verdicts,
      transitions: HWLight.state.history.length }));
    await p.waitForFunction((n) => HWLight.state.verdicts >= n + 3,
      before.verdicts, { timeout: 30000 });
    const after = await p.evaluate(() => ({
      colour: HWLight.state.colour,
      redsSinceGreen: HWLight.state.history.filter((h) => h.to === 'red').length,
      shown: HWLight.state.history.filter((h) => h.why === 'shown').length
    }));
    check('L6 no flicker on a steady readable view: green stays green across further verdicts',
      after.colour === 'green' && after.redsSinceGreen === after.shown,
      after.redsSinceGreen + ' red transition(s), all from first showing');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '24-hw-ready-light-green.png') });
    // The little clock: during a countdown the light keeps updating; a
    // TAKEN picture hides it — a light over a still would be a claim
    // about nothing — and retake brings it back to re-prove the view.
    await p.click('.bia-camera-timer-choice[data-seconds="10"]');
    const vBefore = await p.evaluate(() => HWLight.state.verdicts);
    await p.click('#cameraTakeBtn');                 // the count begins
    await p.waitForFunction((n) => HWLight.state.verdicts >= n + 2,
      vBefore, { timeout: 15000 });
    const during = await p.evaluate(() => ({
      counting: !!document.querySelector('.bia-camera-count'),
      shown: document.getElementById('hwReadyLight').style.display !== 'none',
      colour: HWLight.state.colour
    }));
    check('L7 during a timer countdown the light stays up and keeps updating — a child can re-aim before the shutter',
      during.counting && during.shown && during.colour === 'green',
      'counting, light ' + during.colour + ', 2+ fresh verdicts');
    await p.click('#cameraTakeBtn');                 // Stop — no picture
    await p.click('.bia-camera-timer-choice[data-seconds="0"]');
    await p.click('#cameraTakeBtn');                 // taken right away
    await p.waitForFunction(() =>
      document.getElementById('cameraShot').style.display !== 'none',
      null, { timeout: 15000 });
    await p.waitForTimeout(200);
    const stillShot = await p.evaluate(() =>
      document.getElementById('hwReadyLight').style.display !== 'none');
    check('L8 a TAKEN picture hides the light — it never claims anything about a still',
      !stillShot);
    await p.click('#cameraRetakeBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return v.videoWidth > 0 && v.style.display !== 'none' &&
             document.getElementById('hwReadyLight').style.display !== 'none';
    }, null, { timeout: 30000 });
    const resumed = await p.evaluate(() => ({
      first: HWLight.state.history.filter((h) => h.why === 'shown').length
    }));
    check('L9 retake brings the light back, and the fresh view starts red until it re-proves',
      resumed.first >= 2, resumed.first + ' fresh showings, each born red');
    check('L10 zero page errors across the green run', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await browser.close();
  }

  // MANY CARDS: red — and the existing one-card overlay still appears
  // exactly as it does today; the light replaces nothing.
  {
    const { browser, p, errors } = await camPage('hw-many.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() =>
      window.__hw.live.manySeen >= 1 && HWLight.state.colour === 'red',
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if (still.ok !== (f.colour === 'green')) lightDisagreements++;
    const note = await p.evaluate(() => ({
      shown: document.getElementById('hwOneCardNote').style.display === 'block',
      text: document.getElementById('hwOneCardNote').textContent
    }));
    check('L11 more than one card → RED, and Take would refuse the same frame the same way',
      f.colour === 'red' && f.ringOn && !f.glowOn &&
      still.ok === false && still.reason === 'many',
      'light ' + f.colour + ', still reader reason=' + still.reason);
    check('L11b the kind one-card overlay still appears exactly as before — the light replaces nothing',
      note.shown && /[Oo]ne card at a time/.test(note.text));
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '25-hw-ready-light-red.png') });
    check('L11c zero page errors', errors.length === 0);
    await browser.close();
  }

  // A CARD TOO FAR AWAY: it refuses (the reading floor), so the light
  // must be red — "in view" is not "readable".
  {
    const { browser, p, errors } = await camPage('hw-card-far.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => window.__hw.live.samples >= 3,
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if (still.ok !== (f.colour === 'green')) lightDisagreements++;
    const got = await p.evaluate(() => window.__hw.live.collected.size);
    check('L12 a card too far to read → RED and nothing collected: the light is the reading standard, not "I can see paper"',
      f.colour === 'red' && got === 0 && still.ok === false,
      'light ' + f.colour + ', ' + got + ' collected, still reader ok=' + still.ok);
    check('L12b zero page errors', errors.length === 0);
    await browser.close();
  }

  // THE VIEW STOPS READING: card, then bare desk (looping). Green must
  // yield promptly — measured from the last frame that read to the
  // moment the light went red.
  {
    const { browser, p, errors } = await camPage('hw-then-gone.y4m');
    await armAndOpenCamera(p);
    await p.waitForFunction(() => {
      const h = HWLight.state.history;
      const g = h.findIndex((e) => e.to === 'green');
      return g >= 0 && h.slice(g + 1).some((e) => e.to === 'red');
    }, null, { timeout: 90000 });
    const gone = await p.evaluate(() => {
      const h = HWLight.state.history;
      const handoffs = [];
      for (let i = 1; i < h.length; i++) {
        if (h[i].to === 'red' && h[i - 1].to === 'green') handoffs.push(h[i]);
      }
      return { handoffs: handoffs.map((e) => ({ why: e.why, sinceRead: e.sinceRead })),
               order: h.map((e) => e.to).join('>') };
    });
    check('L13 green yields when the view stops reading — never instantly (debounce), never late',
      gone.handoffs.length >= 1 && gone.handoffs.every((e) =>
        e.sinceRead > 500 && e.sinceRead < 2600),
      'green→red ' + gone.handoffs.map((e) =>
        e.sinceRead + 'ms (' + e.why + ')').join(', ') + ' after the last read frame');
    check('L13b zero page errors across the hand-off', errors.length === 0);
    await browser.close();
  }

  // THE DEBOUNCE ITSELF, driven deterministically at the live loop's
  // own cadence (~600ms a verdict, measured): one wobble frame between
  // two read frames never blinks the light; two consecutive refusals
  // turn it red; and a loop that falls SILENT after a refusal is
  // caught by the hold — green never outlives its evidence.
  {
    const m = await page.evaluate(async () => {
      const L = window.HWLight;
      L.hide();
      L.state.history.length = 0;
      L.show(document.createElement('video'));   // machine live, nothing drawn
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      L.verdict(true);                            // the view reads
      await pause(600);
      L.verdict(false);                           // ONE wobble frame
      await pause(600);
      L.verdict(true);                            // …and it reads again
      const blinked = L.state.history.some((e) => e.to === 'red');
      await pause(100);
      const tRef = performance.now();
      L.verdict(false);                           // the view has really left
      await pause(600);
      L.verdict(false);
      const red1 = L.state.history.filter((e) => e.to === 'red').pop();
      const twoRefusals = { colour: L.state.colour,
        why: red1 && red1.why, ms: red1 ? Math.round(red1.at - tRef) : -1 };
      L.verdict(true);                            // green again…
      const tStall = performance.now();
      L.verdict(false);                           // …one refusal, then SILENCE
      await pause(L.HOLD_MS + 600);
      const red2 = L.state.history.filter((e) => e.to === 'red').pop();
      const stalled = { colour: L.state.colour,
        why: red2 && red2.why, ms: red2 ? Math.round(red2.at - tStall) : -1 };
      L.hide();
      return { blinked, twoRefusals, stalled, HOLD: L.HOLD_MS };
    });
    check('L14 one refused frame between two read frames never blinks the light',
      m.blinked === false, 'no red transition across the wobble');
    check('L15 two consecutive refusals turn it red — measured latency inside one verdict cycle + margin',
      m.twoRefusals.colour === 'red' && m.twoRefusals.why === 'refused' &&
      m.twoRefusals.ms >= 500 && m.twoRefusals.ms <= 1100,
      m.twoRefusals.ms + 'ms after the first refusal');
    check('L16 a loop that falls silent is caught by the hold (' + m.HOLD + 'ms) — green never outlives its evidence',
      m.stalled.colour === 'red' && m.stalled.why === 'held' &&
      m.stalled.ms >= m.HOLD - 100 && m.stalled.ms <= m.HOLD + 700,
      m.stalled.ms + 'ms, via the hold timer');
  }

  // REDUCED MOTION: the states simply switch — no cross-fade.
  {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const rm = await page.evaluate(() => {
      HWLight.show(document.createElement('video'));
      const w = document.getElementById('hwReadyLight');
      const t = [w.children[0].style.transition, w.children[1].style.transition];
      HWLight.hide();
      return t;
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const fade = await page.evaluate(() => {
      HWLight.show(document.createElement('video'));
      const w = document.getElementById('hwReadyLight');
      const t = [w.children[0].style.transition, w.children[1].style.transition];
      HWLight.hide();
      return t;
    });
    check('L17 under prefers-reduced-motion the light plainly switches; otherwise it cross-fades gently',
      rm.every((t) => t === 'none') && fade.every((t) => /opacity/.test(t)),
      'reduce: "' + rm[0] + '" · default: "' + fade[0] + '"');
  }

  check('L18 GREEN ⇔ "Take would read": zero disagreements across the whole fixture ladder',
    lightDisagreements === 0, lightDisagreements + ' disagreement(s)');

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
