/* HW FIXTURE — the deterministic synthetic FILLED writing sheet, shared.
 *
 * One composer, three consumers: the handwriting suite
 * (test/run-handwriting-tests.js), the fake-camera feed generator
 * (test/make-hw-feeds.js) and any measurement harness. It lives here so
 * the sheet the suite asserts against and the sheet the camera fixtures
 * are cut from can never drift apart.
 *
 * COMPOSE is a STRING of page-side code (evaluated in the page, where
 * HWSheet and the canvas are): the page's own HWSheet.draw renders the
 * sheet, and the model text is then written onto the rules in a
 * jittered handwriting-ish style — per-letter baseline wobble, rotation,
 * size variation and spacing jitter, all from a SEEDED generator
 * (mulberry32; Math.random appears nowhere), so every run reads the
 * same sheet. Ground truth is the drawn letters' own positions, which
 * is what makes the mislabel assertions exact.
 *
 * opts: { seed, width, omit ('' or letters),
 *         corruptLines ([] or line indices — every word on those lines is
 *         welded into one touching blob, cursive-style),
 *         pairLine/pairCount (weld only the first `pairCount` word-
 *         internal letter pairs on `pairLine` — "merely messy"),
 *         blankLines ([] or line indices — the child never wrote them) }.
 * Returns { dataURL, gt:[{line,ch,x0,x1}], W, H, ruleYs }.
 */
'use strict';

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
  // Sans, not Serif: at this scale DejaVu Serif's serifs detach at the
  // ink threshold (an L foot joined a Y's split and inflated its width;
  // a u fragment impersonated an i) — a sans face has no serif to shed
  // and sturdier junctions, which is also closer to a child's print.
  const FAM = '"DejaVu Sans"';
  ctx.fillStyle = '#20242e';
  ctx.textBaseline = 'alphabetic';
  for (const ln of drawn.lines) {
    if ((opts.blankLines || []).includes(ln.index)) continue;
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
      if (!word) word = { x0: x, n: 0, size, letters: [] };
      word.x1 = x + wch; word.n++;
      word.letters.push({ x0: x, x1: x + wch });
      x += wch + size * 0.16 * (0.8 + 0.4 * rnd());
    }
    if (word) words.push(word);
    if ((opts.corruptLines || []).includes(ln.index)) {
      // weld each word into ONE touching blob: a stroke through the
      // letters at mid x-height, in the same ink
      for (const w of words) {
        if (w.n < 2) continue;
        const y = ln.ruleY - w.size * 0.24;
        ctx.fillRect(w.x0 + 1, y - 2, (w.x1 - w.x0) - 2, 4);
      }
    }
    if (opts.pairLine === ln.index && opts.pairCount > 0) {
      // weld only the FIRST letter pair of the first pairCount words —
      // a couple of letters that happened to touch, not a style
      let welded = 0;
      for (const w of words) {
        if (welded >= opts.pairCount || w.n < 2) continue;
        const a = w.letters[0], b = w.letters[1];
        const y = ln.ruleY - w.size * 0.24;
        ctx.fillRect(a.x1 - w.size * 0.1, y - 2,
                     (b.x0 - a.x1) + w.size * 0.2, 4);
        welded++;
      }
    }
  }
  return { dataURL: c.toDataURL('image/png'), gt, W: c.width, H: c.height,
           ruleYs: drawn.lines.map((l) => l.ruleY) };
}`;

module.exports = { COMPOSE };
