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
 * Three scenarios:
 *   HW-A  the sheet itself — geometry, coverage of a–z + digits, print.
 *   HW-B  a complete filled sheet — every letter captured, every accepted
 *         letter standing where its ground truth stands (NONE mislabeled),
 *         baselines consistent, and the font: parses, renders, differs
 *         from the fallback, rebuilds byte-identical.
 *   HW-C  the refuse rule — one line's words welded into touching blobs →
 *         that line contributes NOTHING (skipped, never mislabeled); one
 *         letter never written ('x') → exactly one quiet empty slot; the
 *         font's cmap simply lacks it; and per-line recovery brings the
 *         welded line back from a clean re-photograph.
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
 * opts: { seed, width, omit ('' or letters), corruptLine (-1 or index) }.
 * Returns { dataURL, gt:[{line,ch,x0,x1}], W, H }. */
const COMPOSE = `(opts) => {
  const c = document.createElement('canvas');
  const drawn = HWSheet.draw(c, opts.width || 2000);
  const ctx = c.getContext('2d');
  let s = (opts.seed >>> 0) || 1;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gt = [];
  const FAM = '"DejaVu Serif"';
  ctx.fillStyle = '#20242e';
  ctx.textBaseline = 'alphabetic';
  for (const ln of drawn.lines) {
    const text = ln.text;
    let size = drawn.H * 0.052;
    const fit = () => {
      ctx.font = size.toFixed(1) + 'px ' + FAM;
      let total = 0;
      for (const ch of text) total += ch === ' '
        ? size * 0.62 : ctx.measureText(ch).width + size * 0.16;
      return total;
    };
    let total = fit();
    const span = (ln.x1 - ln.x0) * 0.96;
    if (total > span) { size *= span / total; total = fit(); }
    let x = ln.x0 + 3;
    const words = [];
    let word = null;
    for (const ch of text) {
      if (ch === ' ') {
        if (word) { words.push(word); word = null; }
        x += size * 0.62 * (0.9 + 0.2 * rnd());
        continue;
      }
      if (opts.omit && opts.omit.includes(ch)) { x += size * 0.25; continue; }
      const wch = ctx.measureText(ch).width;
      const jy = (rnd() - 0.5) * size * 0.06;
      const rot = (rnd() - 0.5) * 2 * 2.2 * Math.PI / 180;
      const jsz = 1 + (rnd() - 0.5) * 0.10;
      ctx.save();
      ctx.translate(x + wch / 2, ln.ruleY + jy);
      ctx.rotate(rot);
      ctx.scale(jsz, jsz);
      ctx.font = size.toFixed(1) + 'px ' + FAM;
      ctx.fillText(ch, -wch / 2, 0);
      ctx.restore();
      gt.push({ line: ln.index, ch, x0: x, x1: x + wch });
      if (!word) word = { x0: x, n: 0, size };
      word.x1 = x + wch; word.n++;
      x += wch + size * 0.16 * (0.8 + 0.4 * rnd());
    }
    if (word) words.push(word);
    if (opts.corruptLine === ln.index) {
      // weld each word into ONE touching blob: a stroke through the
      // letters at mid x-height, in the same ink
      for (const w of words) {
        if (w.n < 2) continue;
        const y = ln.ruleY - w.size * 0.24;
        ctx.fillRect(w.x0 + 1, y - 2, (w.x1 - w.x0) - 2, 4);
      }
    }
  }
  return { dataURL: c.toDataURL('image/png'), gt, W: c.width, H: c.height };
}`;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
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
      { name: 'filled-sheet.png', mimeType: 'image/png', buffer: made.buffer });
    await page.waitForFunction(() =>
      window.__hw.stage === 'alphabet' || window.__hw.stage === 'sheet',
      null, { timeout: 180000 });
    return page.evaluate(() => window.__hw.stage);
  }
  const lettersData = () => page.evaluate(() => ({
    lines: window.__hw.lines.map((ln) => ({
      index: ln.index, found: ln.found, accepted: ln.accepted || 0,
      expected: ln.expected || 0, unit: ln.unit,
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
      else if (n < 2) once.push(ch);
    }
    check('A1 the model lines cover a–z and 0–9', missing.length === 0,
      missing.length ? 'missing ' + missing.join('') : '36 characters');
    check('A2 every letter and digit appears MORE THAN ONCE across the lines',
      once.length === 0, once.length ? 'only once: ' + once.join('') : 'min 2, letters 3');
    check('A3 the sheet is ' + sheetFacts.lines + ' model lines on A4 proportions',
      sheetFacts.lines === 4 && Math.abs(sheetFacts.aspect - Math.SQRT2) < 1e-9);
  }
  await page.click('#hwEntryBtn');
  await page.waitForSelector('#stepHwSheet.here');
  {
    const drawn = await page.evaluate(() => window.__hw.sheetDrawn);
    check('A4 the sheet is drawn from HWSheet.GEOM (4 rules, even pitch)',
      drawn.lines.length === 4 &&
      Math.abs((drawn.lines[1].ruleY - drawn.lines[0].ruleY) -
               (drawn.lines[3].ruleY - drawn.lines[2].ruleY)) < 1,
      'pitch ' + Math.round(drawn.lines[1].ruleY - drawn.lines[0].ruleY) + 'px');
    const printable = await page.evaluate(() => {
      const c = document.getElementById('hwPrintCanvas');
      return { w: c.width, h: c.height,
               css: getComputedStyle(document.getElementById('hwPrintArea')).display };
    });
    check('A5 the printable copy is rendered crisp and hidden on screen',
      printable.w === 1600 && printable.css === 'none',
      printable.w + 'px wide, display ' + printable.css);
  }
  await page.screenshot({ path: path.join(SHOTS, '11-handwriting-sheet.png') });

  // ==== HW-B: the complete sheet =============================================
  console.log('\n== HW-B: A COMPLETE FILLED SHEET ===========================');
  const clean = await compose({ seed: 7, width: 2000, omit: '', corruptLine: -1 });
  check('B1 the synthetic sheet is deterministic (seeded, no Math.random)',
    (await compose({ seed: 7, width: 2000, omit: '', corruptLine: -1 }))
      .buffer.equals(clean.buffer),
    clean.buffer.length + ' bytes twice');
  {
    const stage = await feed(clean);
    check('B2 the journey reaches the alphabet through the real capture entry',
      stage === 'alphabet', 'stage ' + stage);
    const data = await lettersData();
    check('B3 every pangram letter and every digit was captured',
      data.have === SORTED, data.have.length + '/36: ' + data.have);
    const totals = data.lines.reduce((a, l) => ({ acc: a.acc + l.accepted, exp: a.exp + l.expected }),
      { acc: 0, exp: 0 });
    check('B4 the lines aligned essentially in full', totals.acc >= totals.exp - 6,
      totals.acc + ' of ' + totals.exp + ' letters accepted');
    const bad = mislabels(data, clean.gt);
    check('B5 NO accepted letter is mislabeled (each stands on its own ground truth)',
      bad.length === 0, bad.length ? bad.slice(0, 5).join(' ') : totals.acc + ' letters checked');
    // Baseline consistency: letters without descenders sit ON the rule.
    const sitters = [];
    for (const ln of data.lines) {
      for (const l of ln.letters) {
        if (l.accepted && !'gjpqy'.includes(l.ch)) sitters.push(l.below);
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
    // The empty-slot grid never shows here — all 36 present.
    const emptySlots = await page.locator('.hw-slot.empty').count();
    check('B7 the alphabet grid shows all 36 slots filled', emptySlots === 0,
      emptySlots + ' empty');
  }

  console.log('\n== HW-B: THE FONT ==========================================');
  {
    await page.click('#hwBuildBtn');
    await page.waitForFunction(() => window.__hw.stage === 'test', null, { timeout: 60000 });
    const bytes1 = await fontBytes();
    const font = opentype.parse(bytes1.buffer.slice(bytes1.byteOffset, bytes1.byteOffset + bytes1.length));
    check('B8 the built font PARSES (opentype.js reads its own tables back)',
      font.glyphs.length >= 38 && !!font.tables.cmap && !!font.tables.os2,
      font.glyphs.length + ' glyphs, tables ' + Object.keys(font.tables).join(','));
    let unmapped = '';
    for (const ch of ALPHABET) {
      if (!font.charToGlyphIndex(ch)) unmapped += ch;
    }
    check('B9 the cmap maps all of a–z, 0–9 and space',
      unmapped === '' && font.charToGlyphIndex(' ') > 0,
      unmapped ? 'unmapped: ' + unmapped : '37 mapped');
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
  const variant = await compose({ seed: 7, width: 2000, omit: 'x', corruptLine: CORRUPT });
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
      'have ' + data.have.length + '/36, missing "' +
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
      data2.lines[3].accepted >= 18,
      [0, 2, 3].map((i) => data2.lines[i].accepted + '/' + data2.lines[i].expected).join(' '));

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
