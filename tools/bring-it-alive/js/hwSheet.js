/* HW SHEET — the writing sheet: what it says, and exactly where.
 *
 * MY HANDWRITING (the handwriting journey) starts on paper: the tool
 * prints a sheet of model lines, the child copies each line in their own
 * handwriting onto the ruled blank beneath it, and photographs the
 * result. Known text turns reading into ALIGNMENT — the reader never
 * recognises a letter, it only decides which known letter each blob of
 * ink is standing where. That only works if the sheet's geometry is
 * KNOWN, so this module is the single source of truth for it: the
 * renderer draws from GEOM and the reader (hwRead.js) measures against
 * the same GEOM. One geometry, two consumers — the Magic Card's own
 * lesson (Decision 17: the reader and the art share one geometry
 * function), including its correction: the numbers here were MEASURED
 * against the rendered sheet by the suite, not asserted.
 *
 * The model lines are three full lowercase pangrams, ONE uppercase
 * pangram, and a digits line: every letter a–z appears at least three
 * times, every digit twice — the builder picks the cleanest sample of
 * each — and every capital A–Z at least ONCE. One capitals line, not
 * two, because the sheet is a child's effort budget: a fifth line of
 * writing already costs real patience, and a sixth would buy "pick the
 * cleanest capital" at the price of many children never finishing the
 * sheet. Disclosed cost: most capitals get a single sample, so a
 * capital the child fumbled is the capital their font gets (or, if it
 * is refused, a quiet empty slot and a per-line retake — same as ever).
 *
 * The RULE under each line is the baseline the child writes on, and it
 * is the key font metric. It is printed solid and visible (a child needs
 * a real line to sit letters on), and the reader removes it from the ink
 * by vertical run-length before letters are cut apart (hwRead.js).
 */
(function () {
  'use strict';

  // The model lines. Lines 1–3 are complete lowercase pangrams (every
  // letter of a–z in each); line 4 is the SAME sentence as line 2 in
  // capitals — a pangram the child has already met, so the capitals line
  // reads as "now in big letters" rather than a new sentence to decode,
  // and it is the shortest of the three (capitals are wide); line 5
  // carries every digit twice in a shuffled order so neighbouring pairs
  // vary. Child-facing, so the words are friendly.
  const LINES = [
    { text: 'the quick brown fox jumps over a lazy dog' },
    { text: 'how quickly daft jumping zebras vex' },
    { text: 'the five boxing wizards jump quickly' },
    { text: 'HOW QUICKLY DAFT JUMPING ZEBRAS VEX' },
    { text: '0 1 2 3 4 5 6 7 8 9 8 6 4 2 0 9 7 5 3 1' }
  ];

  // The no-cursive callout, printed on the sheet where the child writes.
  // Child words on purpose: no jargon, no blame — joined-up writing is a
  // real skill, it is just one the reader cannot meet letter by letter.
  const CALLOUT = 'Write each letter on its own, with a little space — ' +
    'letters that hold hands are hard for me to see.';

  /* All geometry as FRACTIONS — x-values of the sheet width W, y-values
   * of the sheet height H (portrait, H = √2·W, A4 proportions). The
   * reader re-derives H per line from the measured rule length, so these
   * fractions are the whole registration contract. */
  // Five blocks now instead of four, so every vertical number shrank to
  // make room: the block pitch and the writing zone are smaller, but the
  // zone is still ~24mm above the rule on A4 — a child's hand fits. The
  // reader learns the new count and pitch from these same constants
  // (HWSheet.LINES.length and GEOM drive its rule-pattern scoring), so
  // the two cannot drift; a photo whose rules do not match THIS pattern
  // is still refused.
  const GEOM = {
    aspect: Math.SQRT2,       // H / W
    xLeft: 0.10,              // rule start (of W)
    xRight: 0.94,             // rule end (of W)
    numberX: 0.055,           // line number centre (of W) — outside the zone
    titleY: 0.045,            // title baseline (of H)
    titleSize: 0.028,
    calloutY: 0.089,          // the no-cursive callout baseline (of H)
    blockTop0: 0.103,         // first line block top (of H)
    blockStep: 0.170,         // block pitch (of H)
    modelBaseline: 0.034,     // model text baseline, from block top (of H)
    modelSize: 0.023,         // model text size (of H); shrunk to fit the span
    ruleOffset: 0.128,        // rule y, from block top (of H)
    ascent: 0.082,            // writing zone above the rule (of H)
    descent: 0.034,           // writing zone below the rule (of H)
    ruleThickness: 0.0022,    // printed rule thickness (of H)
    footY: 0.975
  };

  // Rule grey — DRAWN TO BE READ (Decision 17's lesson applied to paper).
  // Deliberately printed BELOW the ink detector's margin (BIASegment
  // flags ink at local-paper − luminance > 25; this grey sits at ~22), so
  // a child's letters SITTING ON the rule never weld to it: to the
  // detector the rule is not ink at all, while the reader's own gentler
  // test (paper − lum > 12) still finds it as the registration line it
  // is. If a dim capture pushes it over the margin anyway, hwRead's
  // run-length backstop removes it — with the disclosed cost that round
  // letter bottoms can split there.
  const RULE_COLOR = '#e6e9ee';
  const INK = '#141a26';

  function ruleYFrac(i) { return GEOM.blockTop0 + i * GEOM.blockStep + GEOM.ruleOffset; }

  /* Per-line pixel geometry for a sheet whose rules were measured at
   * (x0, x1) — the reader's entry point. Everything hangs off the rule's
   * own length, so a photograph's scale never has to be guessed. */
  function lineZoneFor(ruleLenPx) {
    const W = ruleLenPx / (GEOM.xRight - GEOM.xLeft);
    const H = W * GEOM.aspect;
    return {
      pageW: W, pageH: H,
      ascentPx: GEOM.ascent * H,
      descentPx: GEOM.descent * H,
      blockStepPx: GEOM.blockStep * H,
      ruleThicknessPx: GEOM.ruleThickness * H
    };
  }

  /* Draw the sheet at widthPx. Returns the pixel geometry it drew with
   * (the suite renders its synthetic filled sheet through exactly this,
   * so the test sheet and the printed sheet cannot drift apart). */
  function draw(canvas, widthPx) {
    const W = widthPx, H = Math.round(W * GEOM.aspect);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = Math.round(GEOM.titleSize * H) + 'px sans-serif';
    ctx.fillText('My Handwriting', GEOM.xLeft * W, GEOM.titleY * H);
    ctx.font = Math.round(GEOM.titleSize * H * 0.5) + 'px sans-serif';
    ctx.fillStyle = '#7a8496';
    ctx.fillText('Copy each line in your own handwriting on the empty line under it.',
      GEOM.xLeft * W, (GEOM.titleY + 0.022) * H);

    // The no-cursive callout — printed just above the first writing line,
    // a touch larger and darker than the instruction, because it is the
    // one thing that decides whether the reader can meet the letters.
    // Shrunk to the rule span like the model lines, never clipped.
    let calloutSize = GEOM.titleSize * H * 0.56;
    ctx.font = Math.round(calloutSize) + 'px sans-serif';
    const calloutSpan = (GEOM.xRight - GEOM.xLeft) * W;
    const calloutW = ctx.measureText(CALLOUT).width;
    if (calloutW > calloutSpan) {
      calloutSize = calloutSize * calloutSpan / calloutW;
      ctx.font = Math.round(calloutSize) + 'px sans-serif';
    }
    ctx.fillStyle = '#4a5468';
    ctx.fillText(CALLOUT, GEOM.xLeft * W, GEOM.calloutY * H);

    const drawn = { W, H, lines: [] };
    for (let i = 0; i < LINES.length; i++) {
      const top = (GEOM.blockTop0 + i * GEOM.blockStep) * H;
      const ruleY = ruleYFrac(i) * H;
      const x0 = GEOM.xLeft * W, x1 = GEOM.xRight * W;

      // Model text, shrunk to fit the rule span if it must.
      let size = GEOM.modelSize * H;
      ctx.fillStyle = INK;
      ctx.font = Math.round(size) + 'px sans-serif';
      const span = x1 - x0;
      const w = ctx.measureText(LINES[i].text).width;
      if (w > span * 0.98) {
        size = size * (span * 0.98) / w;
        ctx.font = Math.round(size) + 'px sans-serif';
      }
      ctx.fillText(LINES[i].text, x0, top + GEOM.modelBaseline * H);

      // The line number, left of the writing zone so it can never be
      // mistaken for the child's ink.
      ctx.fillStyle = '#7a8496';
      ctx.font = Math.round(GEOM.modelSize * H * 0.8) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), GEOM.numberX * W, ruleY);
      ctx.textAlign = 'left';

      // The rule — the baseline the child writes on.
      ctx.fillStyle = RULE_COLOR;
      const t = Math.max(1, Math.round(GEOM.ruleThickness * H));
      ctx.fillRect(x0, Math.round(ruleY - t / 2), x1 - x0, t);

      drawn.lines.push({ index: i, text: LINES[i].text, ruleY, x0, x1,
                         zoneTop: ruleY - GEOM.ascent * H,
                         zoneBottom: ruleY + GEOM.descent * H });
    }

    ctx.fillStyle = '#9aa2b0';
    ctx.font = Math.round(GEOM.modelSize * H * 0.62) + 'px sans-serif';
    ctx.fillText('Write with a dark pencil or pen · keep letters apart, sitting on the line',
      GEOM.xLeft * W, GEOM.footY * H);
    return drawn;
  }

  window.HWSheet = { LINES, GEOM, RULE_COLOR, CALLOUT, ruleYFrac, lineZoneFor, draw };
})();
