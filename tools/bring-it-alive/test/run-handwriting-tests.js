/* MY HANDWRITING — verification suite (the letter grid).
 *
 * Drives the REAL page end to end: presses the real entry button, taps
 * the real tiles, feeds photographs through the real file input, edits
 * on the real check canvas with real pointer events, and asserts on
 * what the journey actually produced — the grid the child would see,
 * the refusals, and the font bytes themselves.
 *
 * The fixture is a DETERMINISTIC SYNTHETIC LETTER PHOTOGRAPH (test/
 * hw-fixture.js): white paper on a desk, one letter (or several, for
 * the refusal cases) in a jittered hand — all from a SEEDED generator
 * (mulberry32; Math.random appears nowhere), so every run reads the
 * same pictures. Identity is BY CONSTRUCTION: the tap names the letter,
 * so the mislabel assertion is that captured ink lands on the tapped
 * tile and no other.
 *
 * Scenarios:
 *   HW-N  two journeys, two blocks — the entry screen presents the
 *         drawing journey and the letters journey as equal, separate
 *         blocks; the shared camera machinery wears each journey's own
 *         words (per letter); backing out never leaks state.
 *   HW-R  the grid — 62 tiles in alphabet order, empty vs captured
 *         obvious at a glance (reference letterform vs the child's own
 *         ink), tap arms the capture for that ONE letter, the quiet
 *         count line, no jargon anywhere.
 *   HW-D  one letter, by declaration — the upload path: single letters
 *         (i and j with their dots) captured onto the tapped tile ONLY;
 *         two letters refuse kindly; specks never block; ruled paper
 *         behaves as disclosed; too small refuses kindly; the size
 *         floor measured.
 *   HW-X  check & fix — a pencil stroke joins the glyph (a drawn-in
 *         dot changes an i's own class box), an erased mark leaves it,
 *         the preview matches the tile, Keep persists, Show me again
 *         re-arms.
 *   HW-B  the whole alphabet and the font — a partial set builds (the
 *         missing letters absent from the cmap), all 62 letters feed
 *         through the real journey, HONEST PROPORTIONS measured in the
 *         built font via opentype metrics (x-height, cap, ascender,
 *         descender, dotted i), rebuild byte-identical, rendering
 *         differs from the fallback.
 *   HW-C  GREEN TAKES THE PICTURE — steady green auto-captures exactly
 *         once, from the very frame that read; the camera closes and
 *         never re-snaps; a letter carried across the frame is never
 *         snapped mid-motion; two letters in view show the gentle
 *         overlay and capture nothing; Take still works as the manual
 *         fallback.
 *   HW-L  the readiness light — re-aimed at the one-letter reader:
 *         green ⇔ this very view would capture (asserted across the
 *         fixture ladder with zero disagreements), red otherwise;
 *         absent from the drawing camera; rect-tracked ≤1px through a
 *         resize; debounced but never holding green past its evidence;
 *         shape as well as colour; plain switch under
 *         prefers-reduced-motion; wordless.
 *   HW-G  the page never blocks — the analysis lives in a worker with
 *         a time box: heartbeat < 120ms across a noisy no-paper room
 *         AND through a real auto-capture; skipping is silent.
 *
 * DISCLOSED: this verifies the journey against synthetic handwriting.
 * Real child handwriting — real-paper lighting, pencil pressure — is
 * exactly what the product owner will try in the tool.
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

const { COMPOSE } = require(path.join(__dirname, 'hw-fixture.js'));

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHABET = LOWER + UPPER + DIGITS;

// Words a child must never meet in this journey (instrumentation — the
// developer log and console — is exempt; these are scans of the screen).
const BLAME = /error|failed|invalid|wrong|incorrect|scan|detect|process|percent|%|font file|glyph|pixel/i;

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
  // The REAL journey: tap the tile (unless already armed for this
  // letter), feed the photograph through the real file input, wait for
  // the check screen or a kind refusal.
  async function feedLetter(ch, opts, viaTap) {
    if (viaTap !== false) {
      const stage = await page.evaluate(() => window.__hw.stage);
      if (stage !== 'grid') throw new Error('feedLetter from stage ' + stage);
      await page.click(`#hwGrid .hw-slot[data-ch="${ch}"]`);
      await page.waitForSelector('#stepCapture.here');
    }
    await page.evaluate(() =>
      { document.getElementById('hwLetterQuiet').style.display = 'none'; });
    const made = await compose(opts);
    await page.setInputFiles('#fileInput',
      { name: 'letter.png', mimeType: 'image/png', buffer: made.buffer });
    await page.waitForFunction(() =>
      window.__hw.stage === 'check' ||
      document.getElementById('hwLetterQuiet').style.display === 'block',
      null, { timeout: 120000 });
    return page.evaluate(() => ({
      stage: window.__hw.stage,
      quiet: document.getElementById('hwLetterQuiet').style.display === 'block'
        ? document.getElementById('hwLetterQuiet').textContent : null
    }));
  }
  async function keep() {
    await page.click('#hwKeepBtn');
    await page.waitForSelector('#stepHwGrid.here');
  }
  const madeSet = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#hwGrid .hw-slot.made'))
      .map((s) => s.dataset.ch).sort().join(''));
  const sampleKeys = () => page.evaluate(() =>
    Array.from(window.__hw.samples.keys()).sort().join(''));
  // Direct read (measurement checks): compose in page, run HWLetter.read.
  const READ_DIRECT = `(async (opts) => {
    const made = (${COMPOSE})(opts);
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const t0 = performance.now();
    const r = HWLetter.read({ width: c.width, height: c.height,
      imageData: x.getImageData(0, 0, c.width, c.height), filename: 'fx' },
      { log: () => {} });
    return { kind: r.kind, why: r.why || null, facts: r.facts,
             cost: Math.round(performance.now() - t0),
             glyph: r.glyph ? { w: r.glyph.w, h: r.glyph.h, parts: r.glyph.parts,
               cx: Math.round(r.glyph.cx), cy: Math.round(r.glyph.cy) } : null };
  })`;
  const readDirect = (opts) =>
    page.evaluate(`(${READ_DIRECT})(${JSON.stringify(opts)})`);

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
        hwText: hw.innerText,
        hwShown: !!hw.offsetParent
      };
    });
    check('N1 the entry screen presents TWO blocks — a drawing journey and a letters journey',
      entry.blocks === 2 && /drawing to life/i.test(entry.drawHead) &&
      /My Handwriting/i.test(entry.hwHead) && entry.hwShown,
      '"' + entry.drawHead + '" · "' + entry.hwHead + '"');
    check('N2 nothing about the letters journey starts inside the drawing block',
      !entry.hwEntryInDraw && entry.hwEntryInHw &&
      !/handwriting|letters/i.test(entry.drawText),
      'entry button lives in the handwriting block');
    check('N2b the journey copy is the new flow: tap a letter, write it anywhere, show me',
      /[Tt]ap a letter/.test(entry.hwText) && /anywhere/.test(entry.hwText) &&
      /show/i.test(entry.hwText) && !/card|print|sheet/i.test(entry.hwText),
      '"' + entry.hwText.slice(0, 70).replace(/\n/g, ' · ') + '…"');
    await page.screenshot({ path: path.join(SHOTS, '16-two-journey-blocks.png') });

    // Armed for one letter, the shared capture step speaks THAT LETTER
    // everywhere a child can see — one camera, per-letter framing.
    await page.click('#hwEntryBtn');
    await page.waitForSelector('#stepHwGrid.here');
    await page.click('#hwGrid .hw-slot[data-ch="R"]');
    await page.waitForSelector('#stepCapture.here');
    const armed = await page.evaluate(() => ({
      title: document.getElementById('captureTitle').textContent,
      drop: document.getElementById('dropWords').textContent,
      note: document.getElementById('cameraNote').textContent,
      banner: document.getElementById('hwArmedText').textContent,
      ref: document.getElementById('hwArmedRef').textContent,
      hwBlockHidden: !document.getElementById('hwJourney').offsetParent,
      extrasHidden: !document.getElementById('drawExtras').offsetParent,
      testHidden: !document.getElementById('testBtn').offsetParent
    }));
    check('N3 armed, the capture step asks for THIS letter by name, with its reference form',
      /show me your R/.test(armed.title) && /your R here/.test(armed.drop) &&
      /your R up/.test(armed.note) && /big R/.test(armed.banner) &&
      armed.ref === 'R' && armed.hwBlockHidden &&
      armed.extrasHidden && armed.testHidden,
      '"' + armed.title + '" · "' + armed.note + '"');
    check('N3b the armed words promise the light, never a control lesson — and carry no jargon',
      /green/.test(armed.note) && !BLAME.test(armed.title + armed.drop + armed.note + armed.banner),
      '"' + armed.note + '"');

    // Back out: the drawing framing returns byte for byte, and a drawing
    // fed now lands in the drawing CLAIM — never the letter reader.
    await page.click('#hwDisarmBtn');
    await page.waitForSelector('#stepHwGrid.here');
    await page.click('#hwGridBack');
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
      letter: window.__hw.letter, samples: window.__hw.samples.size
    }));
    check('N5 a drawing fed after backing out lands in the drawing claim — no state leaks',
      leak.stage === 'idle' && !leak.armed && leak.letter === null &&
      leak.samples === 0,
      'hw stage ' + leak.stage);
    await page.click('#claimNewPhoto');
    await page.waitForSelector('#stepCapture.here');
  }

  // ==== HW-R: the grid =======================================================
  console.log('\n== HW-R: THE GRID ==========================================');
  {
    await page.click('#hwEntryBtn');
    await page.waitForSelector('#stepHwGrid.here');
    const grid = await page.evaluate(() => {
      const slots = Array.from(document.querySelectorAll('#hwGrid .hw-slot'));
      return {
        order: slots.map((s) => s.dataset.ch).join(''),
        empty: slots.filter((s) => s.classList.contains('empty')).length,
        refs: slots.filter((s) => s.querySelector('.hw-slot-ref')).length,
        refSample: slots[0].querySelector('.hw-slot-ref').textContent,
        canvases: slots.filter((s) => s.querySelector('canvas')).length,
        note: document.getElementById('hwGridNote').textContent,
        buildDisabled: document.getElementById('hwBuildBtn').disabled,
        buildWords: document.getElementById('hwBuildBtn').textContent,
        screenText: document.getElementById('stepHwGrid').innerText
      };
    });
    check('R1 the grid holds all 62 tiles in alphabet order — a–z, A–Z, 0–9',
      grid.order === LOWER + UPPER + DIGITS, grid.order.length + ' tiles');
    check('R2 every empty tile shows its reference letterform; none holds captured ink yet',
      grid.empty === 62 && grid.refs === 62 && grid.canvases === 0 &&
      grid.refSample === 'a',
      grid.refs + ' reference forms');
    check('R3 the empty grid invites, never counts — and the build door is closed until a letter exists',
      /Tap any letter/.test(grid.note) && grid.buildDisabled &&
      /show me my letters/i.test(grid.buildWords),
      '"' + grid.note.slice(0, 60) + '…"');
    check('R4 nothing on the grid screen looks like scanning or blames — child words only',
      !BLAME.test(grid.screenText),
      '"' + grid.screenText.slice(0, 60).replace(/\n/g, ' · ') + '…"');
  }

  // ==== HW-D: one letter, by declaration =====================================
  console.log('\n== HW-D: ONE LETTER, BY DECLARATION ========================');
  {
    // The first letter, end to end: tap R, feed a photo of an R.
    const fed = await feedLetter('R', { ch: 'R', seed: 5, size: 430 });
    check('D1 a clear letter reaches the check screen through the real journey',
      fed.stage === 'check' && !fed.quiet, 'stage ' + fed.stage);
    const chk = await page.evaluate(() => ({
      ch: window.__hw.check.ch, w: window.__hw.check.w, h: window.__hw.check.h,
      words: document.getElementById('hwCheckWords').textContent,
      ref: document.getElementById('hwCheckRef').textContent
    }));
    check('D2 the check screen shows THIS letter large beside its small reference form',
      chk.ch === 'R' && chk.ref === 'R' && /your R/.test(chk.words) &&
      chk.w > 200 && chk.h > 200,
      chk.w + 'x' + chk.h + 'px working canvas');
    await keep();
    check('D3 Keep fills the tapped tile and NO other — identity by construction',
      await madeSet() === 'R' && await sampleKeys() === 'R',
      'made [' + await madeSet() + ']');

    // Refill replaces: the same tile taken again with a different photo.
    const before = await page.evaluate(() => {
      const s = window.__hw.samples.get('R');
      return { w: s.w, h: s.h, ink: s.mask.reduce((a, v) => a + v, 0) };
    });
    await feedLetter('R', { ch: 'R', seed: 77, size: 320 });
    await keep();
    const after = await page.evaluate(() => {
      const s = window.__hw.samples.get('R');
      return { w: s.w, h: s.h, ink: s.mask.reduce((a, v) => a + v, 0) };
    });
    check('D4 tapping a filled tile and showing the letter again REPLACES it — still one tile',
      await madeSet() === 'R' && (before.ink !== after.ink || before.w !== after.w),
      'ink ' + before.ink + ' → ' + after.ink);

    // i and j arrive in two parts — the dot must come along.
    for (const [ch, seed] of [['i', 6], ['j', 16]]) {
      await feedLetter(ch, { ch, seed, size: 500 });
      const parts = await page.evaluate(() =>
        HWLetter.partsOf(window.__hw.check.mask, window.__hw.check.w, window.__hw.check.h));
      await keep();
      const s = await page.evaluate((c) => {
        const smp = window.__hw.samples.get(c);
        return { top: smp.topAbove, below: smp.belowBase, parts: smp.parts };
      }, ch);
      check('D5 ' + ch + ' captures whole — body AND dot (' + parts + ' parts), placed in the dotted box',
        parts === 2 && s.parts === 2 && s.top === 415 &&
        s.below === (ch === 'j' ? 165 : 0),
        ch + ': top ' + s.top + ', below ' + s.below);
    }

    // TWO letters in view: refused kindly, nothing captured anywhere.
    const two = await feedLetter('a', { seed: 7, size: 300, letters: [
      { ch: 'a', cx: 420, cy: 480 }, { ch: 'b', cx: 880, cy: 480 }] });
    check('D6 two letters in view refuse kindly — one letter at a time, no blame',
      two.stage === 'armed' && /[Oo]ne letter at a time/.test(two.quiet) &&
      /your a/.test(two.quiet) && !BLAME.test(two.quiet),
      '"' + two.quiet + '"');
    check('D6b …and no tile changed', await madeSet() === 'Rij');

    // Identity is the TAP, even for a surprising photo: still armed for
    // 'a', a photo of a Q lands on the CHECK SCREEN FOR a — the reader
    // finds ink, never an identity, and the check screen is where a
    // child sees the mix-up and says "show me again".
    const qAsA = await feedLetter('a', { ch: 'Q', seed: 10, size: 400 }, false);
    check('D6c identity comes from the tap, never the picture: a Q shown for "a" checks as the child\'s a',
      qAsA.stage === 'check' &&
      await page.evaluate(() => window.__hw.check.ch) === 'a');
    await page.click('#hwCheckBack');
    await page.waitForSelector('#stepHwGrid.here');

    // Specks never block a clear letter.
    const q = await feedLetter('Q', { ch: 'Q', seed: 10, size: 400, specks: 30 });
    check('D7 thirty paper specks never block a clear letter',
      q.stage === 'check', 'stage ' + q.stage);
    const qGlyph = await page.evaluate(() => ({
      w: window.__hw.check.w, h: window.__hw.check.h }));
    await keep();
    check('D7b …and the kept ink stays the letter\'s own size, not the page of specks',
      qGlyph.w < 700 && qGlyph.h < 800,
      qGlyph.w + 'x' + qGlyph.h + 'px (working canvas incl. margin)');

    // Ruled notebook paper — as far as honestly measurable.
    const ruled = await feedLetter('e', { ch: 'e', seed: 9, size: 380, ruled: true });
    check('D8 a letter on ruled notebook paper reads — the rules stripped, the letter kept',
      ruled.stage === 'check', 'stage ' + ruled.stage);
    await keep();
    const rulesFacts = await readDirect({ ch: 'e', seed: 9, size: 380, ruled: true });
    const bare = await readDirect({ ch: 'e', seed: 9, size: 380 });
    check('D8b …measured: the ruled read strips rule runs and keeps essentially the bare letter\'s ink box',
      rulesFacts.kind === 'letter' && rulesFacts.facts.rulesStripped >= 4 &&
      bare.kind === 'letter' &&
      Math.abs(rulesFacts.glyph.w - bare.glyph.w) <= 0.35 * bare.glyph.w &&
      Math.abs(rulesFacts.glyph.h - bare.glyph.h) <= 0.2 * bare.glyph.h,
      rulesFacts.facts.rulesStripped + ' rule runs stripped; ink ' +
      rulesFacts.glyph.w + 'x' + rulesFacts.glyph.h + ' vs bare ' +
      bare.glyph.w + 'x' + bare.glyph.h);

    // Too small to capture well: refused kindly, and the floor measured.
    const small = await feedLetter('e', { ch: 'e', seed: 8, size: 110 });
    check('D9 a letter too small to make a good letter refuses kindly — write it bigger',
      small.stage === 'armed' && /bigger|closer/.test(small.quiet) &&
      !BLAME.test(small.quiet),
      '"' + small.quiet + '"');
    await page.click('#hwDisarmBtn');
    await page.waitForSelector('#stepHwGrid.here');
    {
      const floor = await page.evaluate(() => HWLetter.PARAMS.MIN_INK);
      const under = await readDirect({ ch: 'n', seed: 5, size: 120 });
      const over = await readDirect({ ch: 'n', seed: 5, size: 160 });
      check('D9b the size floor is real and measured: ink under ' + floor +
            'px refuses, over it reads',
        under.kind === 'nothing' && under.why === 'small' &&
        under.facts.domH < floor && over.kind === 'letter' &&
        Math.max(over.glyph.w, over.glyph.h) >= floor,
        'ink ' + under.facts.domH + 'px refused · ' + over.glyph.h + 'px read');
    }

    // Blank paper and a busy no-paper scene: nothing, kindly.
    const blank = await readDirect({ seed: 11, letters: [] });
    check('D10 clean paper with nothing written reads NOTHING — never an invented letter',
      blank.kind === 'nothing', blank.kind + '/' + blank.why);
    const desk = await readDirect({ seed: 3, letters: [], noPaper: true });
    check('D10b no paper in view reads NOTHING — the paper fence refuses the bare desk',
      desk.kind === 'nothing', desk.kind + '/' + desk.why);
  }

  // ==== HW-X: check & fix ====================================================
  console.log('\n== HW-X: CHECK & FIX =======================================');
  {
    // An i whose dot the child never drew: compose a dotless i (the
    // letter ı is not in the grid, so draw a bare stem with 'l' scaled
    // to x-height — honest stand-in for a real child's dotless i).
    await feedLetter('i', { ch: 'l', seed: 21, size: 300 });
    const before = await page.evaluate(() => ({
      parts: HWLetter.partsOf(window.__hw.check.mask, window.__hw.check.w, window.__hw.check.h),
      ink: window.__hw.check.mask.reduce((a, v) => a + v, 0)
    }));

    // THE PENCIL: draw the missing dot ABOVE the stem, with real
    // pointer strokes on the real canvas.
    const draw = await page.evaluate(() => {
      const c = document.getElementById('hwCheckCanvas');
      const r = c.getBoundingClientRect();
      const k = window.__hw.check;
      // the stem's ink bbox inside the working mask
      let x0 = k.w, x1 = -1, y0 = k.h, y1 = -1;
      for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) {
        if (k.mask[y * k.w + x]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const sx = r.width / c.width, sy = r.height / c.height;
      const cx = (x0 + x1) / 2;
      const dotY = Math.max(6, y0 - 0.22 * (y1 - y0));   // above the stem
      return { fromX: r.left + (cx - 3) * sx, toX: r.left + (cx + 3) * sx,
               y: r.top + dotY * sy, stem: { x0, x1, y0, y1 } };
    });
    await page.mouse.move(draw.fromX, draw.y);
    await page.mouse.down();
    await page.mouse.move(draw.toX, draw.y, { steps: 4 });
    await page.mouse.up();
    const afterDot = await page.evaluate(() => ({
      parts: HWLetter.partsOf(window.__hw.check.mask, window.__hw.check.w, window.__hw.check.h),
      ink: window.__hw.check.mask.reduce((a, v) => a + v, 0)
    }));
    check('X1 the pencil draws a missing stroke INTO the glyph: the drawn dot becomes a real part',
      before.parts === 1 && afterDot.parts === 2 && afterDot.ink > before.ink,
      before.parts + ' part → ' + afterDot.parts + ', ink +' +
      (afterDot.ink - before.ink) + 'px');
    await page.screenshot({ path: path.join(SHOTS, '26-hw-check-fix.png') });
    await keep();
    const iFixed = await page.evaluate(() => {
      const s = window.__hw.samples.get('i');
      return { top: s.topAbove, parts: s.parts };
    });
    check('X2 Keep persists the fixed letter — and the drawn-in dot lifts the i into the dotted class box',
      iFixed.parts === 2 && iFixed.top === 415,
      'top ' + iFixed.top + ' (dotless would be 300)');

    // THE ERASER: a stray mark drawn on, then erased off — the kept
    // ink returns to what it was.
    await feedLetter('o', { ch: 'o', seed: 22, size: 380 });
    const inkO = await page.evaluate(() =>
      window.__hw.check.mask.reduce((a, v) => a + v, 0));
    // pencil a stray blob in the top-left margin…
    const spot = await page.evaluate(() => {
      const c = document.getElementById('hwCheckCanvas');
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width * 0.06, y: r.top + r.height * 0.06 };
    });
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();
    await page.mouse.move(spot.x + 6, spot.y, { steps: 2 });
    await page.mouse.up();
    const withBlob = await page.evaluate(() =>
      window.__hw.check.mask.reduce((a, v) => a + v, 0));
    // …then the eraser takes it away
    await page.click('#hwFixEraser');
    for (let pass = 0; pass < 3; pass++) {
      await page.mouse.move(spot.x - 8, spot.y - 4 + pass * 4);
      await page.mouse.down();
      await page.mouse.move(spot.x + 14, spot.y - 4 + pass * 4, { steps: 4 });
      await page.mouse.up();
    }
    const erased = await page.evaluate(() =>
      window.__hw.check.mask.reduce((a, v) => a + v, 0));
    check('X3 the eraser removes a stray mark and leaves the letter — ink returns to the letter\'s own',
      withBlob > inkO && erased === inkO,
      inkO + ' → ' + withBlob + ' → ' + erased + ' ink px');

    // The preview IS the tile: same drawing, asserted byte-for-byte.
    const previewMatch = await page.evaluate(() => {
      const prev = document.getElementById('hwCheckPreview');
      const a = prev.getContext('2d').getImageData(0, 0, prev.width, prev.height).data;
      return { w: prev.width, h: prev.height, bytes: Array.from(a) };
    });
    await keep();
    const tileMatch = await page.evaluate(() => {
      const tile = document.querySelector('#hwGrid .hw-slot[data-ch="o"] canvas');
      const a = tile.getContext('2d').getImageData(0, 0, tile.width, tile.height).data;
      return { w: tile.width, h: tile.height, bytes: Array.from(a) };
    });
    check('X4 the check screen\'s preview matches the kept tile byte for byte',
      previewMatch.w === tileMatch.w && previewMatch.h === tileMatch.h &&
      previewMatch.bytes.length === tileMatch.bytes.length &&
      previewMatch.bytes.every((v, i) => v === tileMatch.bytes[i]),
      tileMatch.w + 'x' + tileMatch.h + ' identical');

    // Show me again re-arms for the same letter, keeping nothing.
    await feedLetter('u', { ch: 'u', seed: 23, size: 380 });
    await page.click('#hwRetryBtn');
    await page.waitForSelector('#stepCapture.here');
    const rearmed = await page.evaluate(() => ({
      armed: window.__hw.armed, letter: window.__hw.letter,
      made: Array.from(window.__hw.samples.keys()).includes('u')
    }));
    check('X5 Show me again returns to the capture step, armed for the same letter, keeping nothing',
      rearmed.armed && rearmed.letter === 'u' && !rearmed.made);
    await page.click('#hwDisarmBtn');
    await page.waitForSelector('#stepHwGrid.here');

    // Erasing EVERYTHING and pressing Keep is refused kindly.
    await feedLetter('c', { ch: 'c', seed: 24, size: 300 });
    await page.evaluate(() => { window.__hw.check.mask.fill(0); });
    await page.click('#hwKeepBtn');
    const empty = await page.evaluate(() => ({
      stage: window.__hw.stage,
      quiet: document.getElementById('hwCheckQuiet').textContent,
      shown: document.getElementById('hwCheckQuiet').style.display === 'block'
    }));
    check('X6 erasing everything and pressing Keep is a kind nudge, never a kept blank',
      empty.stage === 'check' && empty.shown &&
      /draw|show/.test(empty.quiet) && !BLAME.test(empty.quiet),
      '"' + empty.quiet + '"');
    await page.click('#hwCheckBack');
    await page.waitForSelector('#stepHwGrid.here');
    check('X6b …and Never mind keeps no c', !(await sampleKeys()).includes('c'));

    // The check screen speaks child words only.
    await feedLetter('m', { ch: 'm', seed: 25, size: 400 });
    const words = await page.evaluate(() =>
      document.getElementById('stepHwCheck').innerText);
    check('X7 the check screen carries no jargon and no blame anywhere',
      !BLAME.test(words), '"' + words.slice(0, 70).replace(/\n/g, ' · ') + '…"');
    await keep();
  }

  // ==== HW-B: the whole alphabet, and the font ===============================
  console.log('\n== HW-B: THE ALPHABET AND THE FONT =========================');
  {
    // The grid with SOME tiles filled — captured ink beside dashed
    // reference tiles, the deliverable's own picture.
    await page.locator('#hwGrid').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '12-handwriting-grid.png') });

    // A PARTIAL set builds first — missing letters absent from the cmap.
    const haveNow = await sampleKeys();
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const partial = await page.evaluate(() => Array.from(
      new Uint8Array(window.__hw.font.buffer)));
    const pFont = opentype.parse(Uint8Array.from(partial).buffer);
    let mappedP = '';
    for (const ch of ALPHABET) if (pFont.charToGlyphIndex(ch)) mappedP += ch;
    mappedP = [...mappedP].sort().join('');
    check('B1 a PARTIAL grid builds at any point — the letters that exist, and only those, in the cmap',
      mappedP === haveNow && pFont.charToGlyphIndex(' ') > 0,
      mappedP.length + ' letters mapped: ' + mappedP);
    await page.click('#hwBackToLetters');
    await page.waitForSelector('#stepHwGrid.here');

    // Feed the rest of the alphabet through the real journey.
    const t0 = Date.now();
    for (const ch of ALPHABET) {
      if (haveNow.includes(ch)) continue;
      const seed = 100 + ch.codePointAt(0);
      const fed = await feedLetter(ch, { ch, seed, size: 430 });
      if (fed.stage !== 'check') {
        check('B2 letter ' + ch + ' reached the check screen', false, 'stage ' + fed.stage);
        await page.click('#hwDisarmBtn');
        await page.waitForSelector('#stepHwGrid.here');
        continue;
      }
      await keep();
    }
    console.log('     (fed the remaining alphabet in ' +
      Math.round((Date.now() - t0) / 1000) + 's)');
    check('B2 every letter, every CAPITAL and every digit is on its own tile — zero wrong tiles, by construction',
      await sampleKeys() === [...ALPHABET].sort().join('') &&
      await madeSet() === [...ALPHABET].sort().join(''),
      (await sampleKeys()).length + '/62');
    const note = await page.evaluate(() =>
      document.getElementById('hwGridNote').textContent);
    check('B2b the full grid says so, quietly',
      /Every letter is here/.test(note), '"' + note + '"');
    await page.screenshot({ path: path.join(SHOTS, '12b-handwriting-grid-full.png') });

    // THE FONT.
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const bytes1 = Buffer.from(await page.evaluate(() =>
      Array.from(new Uint8Array(window.__hw.font.buffer))));
    const font = opentype.parse(bytes1.buffer.slice(bytes1.byteOffset, bytes1.byteOffset + bytes1.length));
    check('B3 the built font PARSES (opentype.js reads its own tables back)',
      font.glyphs.length >= 64 && !!font.tables.cmap && !!font.tables.os2,
      font.glyphs.length + ' glyphs');
    let unmapped = '';
    for (const ch of ALPHABET) if (!font.charToGlyphIndex(ch)) unmapped += ch;
    check('B4 the cmap maps all of a–z, A–Z, 0–9 and space',
      unmapped === '' && font.charToGlyphIndex(' ') > 0,
      unmapped ? 'unmapped: ' + unmapped : '63 mapped');

    // HONEST PROPORTIONS, measured in the font itself. The classes:
    // x-height 500 units; caps/digits 725; ascenders 750; descenders
    // −275; the dotted i to 692. (Canonical boxes × the 500/300 scale.)
    const box = (ch) => font.charToGlyph(ch).getBoundingBox();
    const near = (v, want, tol) => Math.abs(v - want) <= tol;
    check('B5 x-height letters sit on the baseline and reach x-height (n: 0 → 500)',
      near(box('n').y1, 0, 15) && near(box('n').y2, 500, 15),
      'n ' + Math.round(box('n').y1) + '…' + Math.round(box('n').y2));
    check('B5b capitals stand cap-height tall (H: 0 → 725)',
      near(box('H').y1, 0, 15) && near(box('H').y2, 725, 15),
      'H ' + Math.round(box('H').y1) + '…' + Math.round(box('H').y2));
    check('B5c digits stand at cap height too (4: 0 → 725)',
      near(box('4').y1, 0, 15) && near(box('4').y2, 725, 15),
      '4 ' + Math.round(box('4').y1) + '…' + Math.round(box('4').y2));
    check('B5d ascenders rise above the caps (b: 0 → 750)',
      near(box('b').y1, 0, 15) && near(box('b').y2, 750, 15),
      'b ' + Math.round(box('b').y1) + '…' + Math.round(box('b').y2));
    check('B5e descenders split below the baseline (g: −275 → 500)',
      near(box('g').y1, -275, 15) && near(box('g').y2, 500, 15),
      'g ' + Math.round(box('g').y1) + '…' + Math.round(box('g').y2));
    check('B5f the dotted i rises toward the ascender line (i: 0 → 692)',
      near(box('i').y1, 0, 15) && near(box('i').y2, 692, 15),
      'i ' + Math.round(box('i').y1) + '…' + Math.round(box('i').y2));
    check('B5g j hangs its tail and lifts its dot (j: −275 → 692)',
      near(box('j').y1, -275, 15) && near(box('j').y2, 692, 15),
      'j ' + Math.round(box('j').y1) + '…' + Math.round(box('j').y2));
    const rep = await page.evaluate(() => window.__hw.font.report);
    check('B6 the report agrees: cap-height measured from the capitals, x-height → 500/1000',
      rep.capMeasured && near(rep.capHeight, 725, 5) &&
      font.unitsPerEm === 1000 && near(rep.xHeightPx, 300, 2),
      'capHeight ' + rep.capHeight + ', xHeightPx ' + Math.round(rep.xHeightPx));
    const os2Cap = font.tables.os2.sCapHeight;
    check('B6b OS/2 sCapHeight agrees with the class box (±12%)',
      Math.abs(os2Cap - rep.capHeight) <= 0.12 * rep.capHeight,
      'sCapHeight ' + os2Cap);

    // The rendering is really the child's letters.
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
    check('B7 the sentence renders in the child\'s font and measurably differs from the fallback',
      probe.mineW > 0 && probe.diff > 2000 && Math.abs(probe.mineW - probe.fallW) > 1,
      probe.diff + ' px differ');

    // Byte-determinism: rebuild → identical bytes.
    await page.click('#hwBackToLetters');
    await page.waitForSelector('#stepHwGrid.here');
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test');
    const bytes2 = Buffer.from(await page.evaluate(() =>
      Array.from(new Uint8Array(window.__hw.font.buffer))));
    check('B8 rebuilding from the same letters is BYTE-DETERMINISTIC',
      bytes1.equals(bytes2), bytes1.length + ' bytes twice');
    await page.fill('#hwTryInput', 'my very own letters 123');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, '13-handwriting-type-test.png') });
    const testWords = await page.evaluate(() =>
      document.getElementById('stepHwTest').innerText);
    check('B9 the try screen speaks "my letters" language — no jargon a child can see',
      !BLAME.test(testWords) && /your own writing/i.test(testWords),
      '"' + testWords.slice(0, 60).replace(/\n/g, ' · ') + '…"');
  }

  // ==== HW-C: green takes the picture ========================================
  console.log('\n== HW-C: GREEN TAKES THE PICTURE ===========================');
  const hwFeeds = require(path.join(__dirname, 'make-hw-feeds.js'));
  if (!hwFeeds.allPresent()) {
    console.log('  (generating the fake-camera fixtures — one time)');
    await hwFeeds.generate(BASE);
  }
  const feedsMeta = hwFeeds.readMeta();
  const camArgs = (file) => [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=' + path.join(__dirname, file)
  ];
  async function camPage(file) {
    const b = await chromium.launch({ executablePath: CHROME, args: camArgs(file) });
    const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(BASE);
    await p.waitForFunction(() => window.__hw && window.__bia);
    return { browser: b, p, errors };
  }
  async function armAndOpenCamera(p, ch) {
    await p.click('#hwEntryBtn');
    await p.waitForSelector('#stepHwGrid.here');
    await p.click(`#hwGrid .hw-slot[data-ch="${ch}"]`);
    await p.waitForSelector('#stepCapture.here');
    await p.click('#cameraBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return document.getElementById('cameraPanel').style.display === 'block' &&
             v.videoWidth > 0;
    }, null, { timeout: 30000 });
  }

  // STEADY GREEN AUTO-TAKES — exactly once, from the frame that read.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-R.y4m');
    await armAndOpenCamera(p, 'R');
    const t0 = Date.now();
    await p.waitForFunction(() => window.__hw.stage === 'check',
      null, { timeout: 30000 });
    const ms = Date.now() - t0;
    const snap = await p.evaluate(() => ({
      ch: window.__hw.check.ch,
      steady: window.__hw.live.steady,
      verdicts: window.__hw.live.verdicts,
      running: window.__hw.live.running,
      panel: document.getElementById('cameraPanel').style.display,
      tracks: (() => { const v = document.getElementById('cameraLive');
        return v.srcObject ? v.srcObject.getTracks().map((t) => t.readyState).join(',') : 'none'; })(),
      lightOrder: HWLight.state.history.map((h) => h.to).join(','),
      glyph: { w: window.__hw.live.captured.w, h: window.__hw.live.captured.h,
               cx: window.__hw.live.captured.cx, cy: window.__hw.live.captured.cy }
    }));
    const gt = feedsMeta.fixtures['hw-letter-R'].geoms[0].letters[0];
    check('C1 steady green fires the capture by itself — no button, and the check screen opens',
      snap.ch === 'R' && snap.steady >= 2 && snap.verdicts >= 2,
      'after ' + ms + 'ms, ' + snap.verdicts + ' verdicts');
    check('C1b the steady beat is on the order of a second — two consecutive reading verdicts',
      ms >= 900 && ms <= 6000, ms + 'ms from camera open to check screen');
    check('C2 the picture IS the frame that read: the kept ink stands where the fixture wrote the letter',
      Math.abs(snap.glyph.cx - gt.cx) < 40 && Math.abs(snap.glyph.cy - gt.cy) < 40 &&
      snap.glyph.h > 250 && snap.glyph.h < 420,
      'glyph centre (' + Math.round(snap.glyph.cx) + ',' + Math.round(snap.glyph.cy) +
      ') vs letter (' + gt.cx + ',' + gt.cy + '), ink ' + snap.glyph.w + 'x' + snap.glyph.h);
    check('C3 after the auto-capture the camera is CLOSED and the loop stopped — no re-snapping at a held letter',
      snap.panel === 'none' && snap.tracks === 'ended' && !snap.running,
      'tracks ' + snap.tracks);
    check('C3b the light lived red → green and went out with the capture',
      /red,green/.test(snap.lightOrder) && /off$/.test(snap.lightOrder),
      snap.lightOrder);
    await p.waitForTimeout(2500);
    const later = await p.evaluate(() => ({
      stage: window.__hw.stage, running: window.__hw.live.running,
      captured: !!window.__hw.live.captured }));
    check('C4 …and it STAYS captured-once: no second capture while the child looks at the check screen',
      later.stage === 'check' && !later.running);
    // Keep it — the tile fills from the camera capture.
    await p.click('#hwKeepBtn');
    await p.waitForSelector('#stepHwGrid.here');
    const made = await p.evaluate(() =>
      Array.from(document.querySelectorAll('#hwGrid .hw-slot.made')).map((s) => s.dataset.ch).join(''));
    check('C5 Keep fills the tapped tile from the auto-captured picture', made === 'R');
    check('C5b zero page errors through the auto-capture', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await b.close();
  }

  // The dotted i auto-captures whole.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-i.y4m');
    await armAndOpenCamera(p, 'i');
    await p.waitForFunction(() => window.__hw.stage === 'check',
      null, { timeout: 30000 });
    const parts = await p.evaluate(() => window.__hw.live.captured.parts);
    check('C6 a dotted i auto-captures whole — body and dot together',
      parts === 2 && errors.length === 0, parts + ' parts');
    await b.close();
  }

  // A letter CARRIED ACROSS the frame is never snapped mid-motion.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-moving.y4m');
    await armAndOpenCamera(p, 'R');
    await p.waitForFunction(() => window.__hw.live.reads >= 8,
      null, { timeout: 90000 });
    const mov = await p.evaluate(() => ({
      stage: window.__hw.stage, reads: window.__hw.live.reads,
      unsteady: window.__hw.live.unsteady, captured: !!window.__hw.live.captured,
      running: window.__hw.live.running }));
    check('C7 a letter passing through the frame NEVER snaps mid-motion — the steady beat is the guard',
      mov.stage === 'armed' && !mov.captured && mov.running &&
      mov.unsteady >= Math.max(1, mov.reads - 3),
      mov.reads + ' reading verdicts, ' + mov.unsteady + ' broke the beat, 0 captures');
    check('C7b zero page errors across the moving sweep', errors.length === 0);
    await b.close();
  }

  // TWO letters in view: the gentle overlay, red light, nothing taken —
  // and Take, the manual fallback, still works mechanically.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-two.y4m');
    await armAndOpenCamera(p, 'a');
    await p.waitForFunction(() => window.__hw.live.verdicts >= 3,
      null, { timeout: 60000 });
    const two = await p.evaluate(() => ({
      many: window.__hw.live.many, manySeen: window.__hw.live.manySeen,
      captured: !!window.__hw.live.captured,
      overlay: document.getElementById('hwOneLetterNote').style.display,
      overlayText: document.getElementById('hwOneLetterNote').textContent,
      colour: HWLight.state.colour }));
    check('C8 two letters in view → the gentle one-letter overlay, a red light, and NOTHING captured',
      two.many && two.manySeen >= 1 && !two.captured &&
      two.overlay === 'block' && two.colour === 'red',
      two.manySeen + ' many-verdicts');
    check('C8b the overlay speaks child words — one letter at a time, no blame, no jargon',
      /[Oo]ne letter at a time/.test(two.overlayText) && !BLAME.test(two.overlayText),
      '"' + two.overlayText + '"');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '25-hw-ready-light-red.png') });
    // The manual fallback: Take still takes a picture (which then goes
    // through the same reader and refuses this view kindly).
    await p.click('#cameraTakeBtn');
    await p.waitForFunction(() =>
      document.getElementById('cameraShot').style.display === 'block',
      null, { timeout: 15000 });
    await p.click('#cameraUseBtn');
    await p.waitForFunction(() =>
      document.getElementById('hwLetterQuiet').style.display === 'block',
      null, { timeout: 120000 });
    const takeRefused = await p.evaluate(() => ({
      quiet: document.getElementById('hwLetterQuiet').textContent,
      stage: window.__hw.stage }));
    check('C9 Take remains the manual fallback — the taken picture goes through the same reader and refuses the same way',
      takeRefused.stage === 'armed' && /[Oo]ne letter at a time/.test(takeRefused.quiet),
      '"' + takeRefused.quiet.slice(0, 50) + '…"');
    check('C9b zero page errors through overlay + manual Take', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await b.close();
  }

  // Ruled paper and specks auto-capture too; small and blank never do.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-ruled.y4m');
    await armAndOpenCamera(p, 'a');
    await p.waitForFunction(() => window.__hw.stage === 'check',
      null, { timeout: 30000 });
    check('C10 a letter on ruled notebook paper auto-captures — the fix step is there for what a rule leaves behind',
      true, 'captured');
    check('C10b zero page errors', errors.length === 0);
    await b.close();
  }
  {
    const { browser: b, p, errors } = await camPage('hw-letter-small.y4m');
    await armAndOpenCamera(p, 'e');
    await p.waitForFunction(() => window.__hw.live.verdicts >= 3,
      null, { timeout: 60000 });
    const sm = await p.evaluate(() => ({
      captured: !!window.__hw.live.captured, colour: HWLight.state.colour }));
    check('C11 a letter too small to capture well is never auto-taken — red means not ready',
      !sm.captured && sm.colour === 'red' && errors.length === 0,
      'light ' + sm.colour);
    await b.close();
  }
  {
    const { browser: b, p, errors } = await camPage('hw-letter-blank.y4m');
    await armAndOpenCamera(p, 'b');
    await p.waitForFunction(() => window.__hw.live.verdicts >= 2,
      null, { timeout: 60000 });
    const bl = await p.evaluate(() => ({
      captured: !!window.__hw.live.captured, colour: HWLight.state.colour }));
    check('C12 clean paper with nothing written is never captured — no invented letters',
      !bl.captured && bl.colour === 'red' && errors.length === 0);
    await b.close();
  }

  // ==== HW-L: the readiness light ============================================
  // Green is the live worker's own per-frame verdict — the same
  // one-letter read a pressed Take (or the auto-capture itself) would
  // run — so every fixture here asserts the EQUIVALENCE: green ⇔ this
  // very view would capture.
  console.log('\n== HW-L: THE READINESS LIGHT ===============================');
  const GRAB_READ = `() => {
    const v = document.getElementById('cameraLive');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(v, 0, 0);
    const out = HWLetter.read(
      { width: c.width, height: c.height,
        imageData: x.getImageData(0, 0, c.width, c.height), filename: 'grab' },
      { log: function () {} });
    return { kind: out.kind, why: out.why || null };
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
             video: { top: vr.top, height: vr.height, width: vr.width } };
  }`;
  let lightDisagreements = 0;   // green ⇔ would-capture, across the ladder

  // The drawing camera gets NO light — it has no reader, so a light
  // there would be an invented claim. Armed on the same non-letter
  // view, the light exists and is RED.
  {
    const camFeed = require(path.join(__dirname, 'make-camera-feed.js'));
    if (!fs.existsSync(camFeed.OUT)) await camFeed.generate();
    const { browser: b, p, errors } = await camPage('camera-feed-001.y4m');
    await p.click('#cameraBtn');
    await p.waitForFunction(() => {
      const v = document.getElementById('cameraLive');
      return document.getElementById('cameraPanel').style.display === 'block' &&
             v.videoWidth > 0;
    }, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    const unarmed = await p.evaluate(() => ({
      light: !!document.getElementById('hwReadyLight'),
      samples: window.__hw.live.samples }));
    check('L1 the DRAWING camera never grows the light — and the letter loop never runs there',
      !unarmed.light && unarmed.samples === 0,
      unarmed.samples + ' frames sampled unarmed');
    check('L1b zero page errors', errors.length === 0);
    await b.close();
  }
  // Armed on a view with nothing written: the light exists and is RED.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-blank.y4m');
    await armAndOpenCamera(p, 'R');
    await p.waitForFunction(() =>
      window.__hw.live.verdicts >= 2 && HWLight.state.colour === 'red',
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if ((still.kind === 'letter') !== (f.colour === 'green')) lightDisagreements++;
    check('L2 nothing letter-like in view → RED, and this very view would not capture',
      f.present && f.colour === 'red' && !f.glowOn && f.ringOn &&
      still.kind !== 'letter',
      'light ' + f.colour + ', grab reads ' + still.kind + '/' + (still.why || ''));
    check('L2b the light is wordless — no text on or near it',
      f.text === '', f.text ? '"' + f.text + '"' : 'no words');
    check('L2c zero page errors', errors.length === 0);
    await b.close();
  }

  // GREEN on a readable letter: equivalence, placement, shape, resize
  // tracking, no flicker — all on the MOVING fixture, whose every frame
  // reads but which never completes the steady beat, so the light can
  // be observed at leisure without the capture closing the camera.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-moving.y4m');
    await armAndOpenCamera(p, 'R');
    await p.waitForFunction(() =>
      window.HWLight && HWLight.state.colour === 'green',
      null, { timeout: 60000 });
    const f = await p.evaluate(`(${lightFacts})()`);
    const still = await p.evaluate(`(${GRAB_READ})()`);
    if ((still.kind === 'letter') !== (f.colour === 'green')) lightDisagreements++;
    check('L3 one clear letter in view → GREEN, and this very view WOULD capture',
      f.colour === 'green' && still.kind === 'letter',
      'light ' + f.colour + ', grab reads ' + still.kind);
    check('L3b green and red differ by SHAPE as well as colour: filled round glow vs hollow ring',
      f.glowOn && !f.ringOn && f.glowShape === '50%',
      'glow on, ring off');
    check('L4 the light rides the picture: top-right corner, ≤1px off the video rect',
      f.dxRight <= 1 && f.dyTop <= 1 && f.size >= 18 && f.size <= 34,
      'off by ' + f.dxRight.toFixed(1) + 'px / ' + f.dyTop.toFixed(1) +
      'px, ' + Math.round(f.size) + 'px light');
    await p.setViewportSize({ width: 560, height: 700 });
    await p.waitForTimeout(250);
    const f2 = await p.evaluate(`(${lightFacts})()`);
    check('L5 a resized window moves the picture and the light follows (≤1px, size re-fitted)',
      f2.video.width < f.video.width && f2.dxRight <= 1 && f2.dyTop <= 1,
      'video ' + Math.round(f.video.width) + '→' + Math.round(f2.video.width) +
      'px, off by ' + f2.dxRight.toFixed(1) + 'px');
    await p.setViewportSize({ width: 1100, height: 900 });
    // Stability: every moving frame READS, so the light must hold green
    // across many verdicts even while the auto-capture correctly holds
    // its fire (the single-wobble debounce is L14's own unit check).
    const before = await p.evaluate(() => ({
      verdicts: HWLight.state.verdicts }));
    await p.waitForFunction((n) => HWLight.state.verdicts >= n + 3,
      before.verdicts, { timeout: 30000 });
    const after = await p.evaluate(() => ({
      colour: HWLight.state.colour,
      reds: HWLight.state.history.filter((h) => h.to === 'red').length,
      shown: HWLight.state.history.filter((h) => h.why === 'shown').length }));
    check('L6 a view that keeps reading keeps a steady green — no flicker across further verdicts',
      after.colour === 'green' && after.reds === after.shown,
      after.reds + ' red transition(s), all from first showing');
    await p.locator('#cameraPanel').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(SHOTS, '24-hw-ready-light-green.png') });
    // A TAKEN picture hides the light — it never claims anything about
    // a still — and retake brings it back, born red until it re-proves.
    await p.click('#cameraTakeBtn');
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
      first: HWLight.state.history.filter((h) => h.why === 'shown').length }));
    check('L9 retake brings the light back, and the fresh view starts red until it re-proves',
      resumed.first >= 2, resumed.first + ' fresh showings, each born red');
    check('L6b zero page errors', errors.length === 0);
    await b.close();
  }

  // THE VIEW STOPS READING: the moving letter, then the bare desk
  // (looping). Green must yield promptly — measured from the last
  // frame that read to the moment the light went red, against the REAL
  // loop rather than the unit seam.
  {
    const { browser: b, p, errors } = await camPage('hw-letter-then-gone.y4m');
    await armAndOpenCamera(p, 'R');
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
               captured: !!window.__hw.live.captured };
    });
    check('L13 green yields when the view stops reading — never instantly (debounce), never late',
      gone.handoffs.length >= 1 && !gone.captured && gone.handoffs.every((e) =>
        e.sinceRead > 500 && e.sinceRead < 2600),
      'green→red ' + gone.handoffs.map((e) =>
        e.sinceRead + 'ms (' + e.why + ')').join(', ') + ' after the last read frame');
    check('L13b zero page errors across the hand-off', errors.length === 0);
    await b.close();
  }

  // THE DEBOUNCE ITSELF, driven deterministically at the live loop's
  // own cadence (~600ms a verdict): one wobble frame between two read
  // frames never blinks the light; two consecutive refusals turn it
  // red; a loop that falls silent is caught by the hold.
  {
    const m = await page.evaluate(async () => {
      const L = window.HWLight;
      L.hide();
      L.state.history.length = 0;
      L.show(document.createElement('video'));
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      L.verdict(true);
      await pause(600);
      L.verdict(false);                           // ONE wobble frame
      await pause(600);
      L.verdict(true);
      const blinked = L.state.history.some((e) => e.to === 'red');
      await pause(100);
      const tRef = performance.now();
      L.verdict(false);
      await pause(600);
      L.verdict(false);
      const red1 = L.state.history.filter((e) => e.to === 'red').pop();
      const twoRefusals = { colour: L.state.colour,
        why: red1 && red1.why, ms: red1 ? Math.round(red1.at - tRef) : -1 };
      L.verdict(true);
      const tStall = performance.now();
      L.verdict(false);
      await pause(L.HOLD_MS + 600);
      const red2 = L.state.history.filter((e) => e.to === 'red').pop();
      const stalled = { colour: L.state.colour,
        why: red2 && red2.why, ms: red2 ? Math.round(red2.at - tStall) : -1 };
      L.hide();
      return { blinked, twoRefusals, stalled, HOLD: L.HOLD_MS };
    });
    check('L14 one refused frame between two read frames never blinks the light',
      m.blinked === false, 'no red transition across the wobble');
    check('L15 two consecutive refusals turn it red — inside one verdict cycle + margin',
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

  check('L18 GREEN ⇔ "this view would capture": zero disagreements across the fixture ladder',
    lightDisagreements === 0, lightDisagreements + ' disagreement(s)');

  // ==== HW-G: the page never blocks ==========================================
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
      HWLetterLive.start(v, {});
      await new Promise((r) => setTimeout(r, 3 * HWLetterLive.INTERVAL));
      const during = window.__hw.live.samples;
      HWLetterLive.stop();
      HWLetterLive.reset();
      return { before, during };
    });
    check('G1 no frame is sampled before the preview renders (videoWidth 0 → the loop idles)',
      g0.during === g0.before, g0.during - g0.before + ' frames sampled in 3 intervals');
  }
  {
    // The noisy room — the field freeze's own scene shape, no paper.
    const { browser: b, p, errors } = await camPage('hw-noisy.y4m');
    await armAndOpenCamera(p, 'R');
    const hb = await p.evaluate(`(${HEARTBEAT})(6000)`);
    check('G2 the main thread never blocks on a busy no-paper scene (max heartbeat gap < 120ms across 6s)',
      hb.max < 120 && hb.beats > 150,
      'max gap ' + Math.round(hb.max) + 'ms over ' + hb.beats + ' beats');
    const g = await p.evaluate(() => ({
      samples: window.__hw.live.samples,
      verdicts: window.__hw.live.verdicts,
      skipped: window.__hw.live.skipped,
      captured: !!window.__hw.live.captured,
      cost: Math.round(window.__hw.live.lastCost),
      colour: HWLight.state.colour,
      words: document.getElementById('cameraPanel').innerText
    }));
    check('G3 the busy room captures NOTHING and the light stays red',
      g.samples >= 5 && !g.captured && g.colour === 'red',
      g.samples + ' sampled, ' + g.skipped + ' skipped, last cost ' + g.cost + 'ms');
    check('G4 …and refusing is SILENT for the child: no busy/timeout/worker word on the camera',
      !/busy|timeout|worker|skip|frame|slow/i.test(g.words),
      '"' + g.words.slice(0, 60).replace(/\n/g, ' · ') + '…"');
    check('G5 zero page errors on the busy scene', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await b.close();
  }
  {
    // A REAL auto-capture with the heartbeat running through it.
    const { browser: b, p, errors } = await camPage('hw-letter-R.y4m');
    await armAndOpenCamera(p, 'R');
    const hbP = p.evaluate(`(${HEARTBEAT})(3000)`);      // concurrent
    await p.waitForFunction(() => window.__hw.stage === 'check',
      null, { timeout: 30000 });
    const cost = await p.evaluate(() => Math.round(window.__hw.live.lastCost));
    const hb = await hbP;
    check('G6 the main thread stays free THROUGH a real auto-capture (max gap < 120ms; the letter still lands)',
      hb.max < 120, 'max gap ' + Math.round(hb.max) + 'ms, worker cost ' + cost + 'ms');
    check('G7 zero page errors while capturing through the worker', errors.length === 0,
      errors.slice(0, 2).join(' | '));
    await b.close();
  }

  // ---- hygiene ---------------------------------------------------------------
  console.log('\n-- hygiene');
  const banner = await page.evaluate(() => document.querySelector('#devError').style.display);
  check('developer error banner never shown', banner !== 'block');
  check('zero page errors on the shared page', pageErrors.length === 0,
    pageErrors.slice(0, 3).join(' | '));
  check('the fixtures are seeded — no Math.random in the composer',
    !/Math\.random/.test(COMPOSE));

  console.log('\n==========================================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) { console.log('FAILURES:\n  ' + failures.join('\n  ')); }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
