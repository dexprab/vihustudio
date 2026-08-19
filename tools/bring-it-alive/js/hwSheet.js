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
 *
 * END-MARKS (the camera fix). A real webcam photo of a printed sheet
 * refused: the rule is printed deliberately FAINT (below the ink
 * detector's margin, so letters never weld to it), and at 720p + real
 * lighting + JPEG that faint line all but vanished — 1 of 5 rules found
 * — while ~20° of perspective broke the even-pitch pattern match anyway.
 * Decision 17 already solved this exact problem for the Magic Card:
 * printed anchors at known coordinates give the registration outright,
 * and everything after is arithmetic rather than search. So every rule
 * now carries a small SOLID-INK five-point star at BOTH ends — outside
 * the writing zone, beyond where the rule starts and ends, so a child's
 * letters can never touch them. To a child they are ten little stars
 * holding the lines; to the reader they are the ladder that registers
 * each line from ITS OWN pair, which is what absorbs perspective. The
 * line numbers were LIGHTENED at the same time: they live in the same
 * margin, and they must sit below the reader's mark-darkness gate so a
 * number can never impersonate an end-mark.
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
  //
  // Line 1 was "the quick brown fox jumps over a lazy dog" — at 43
  // characters ~20% longer than its neighbours, and the product owner
  // reported a real child's hand running out of room on it. Replaced by
  // a 37-character pangram (verified a–z programmatically by the suite,
  // never by eye) rather than by shrinking anything: the child's hand
  // needs the room, not the print. All three lowercase lines are still
  // full pangrams, so every letter still appears at least three times.
  const LINES = [
    { text: 'jackdaws love my big sphinx of quartz' },
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
  // The side margins were narrowed on a field report ("the first sentence
  // is little big to fit") — everything the end-marks and the line number
  // do not strictly need went to the ruled line. The stack on the left is
  // page edge · end-mark (0.011–0.031) · number (~0.041–0.055) · rule at
  // 0.070, each gap wide enough that the reader's isolation ring around a
  // mark (0.35 × its own diagonal) never touches a neighbour; the right
  // is just edge · end-mark · rule. Writing span 0.885 of W, up from 0.84.
  const GEOM = {
    aspect: Math.SQRT2,       // H / W
    xLeft: 0.070,             // rule start (of W)
    xRight: 0.955,            // rule end (of W)
    anchorXLeft: 0.021,       // end-mark centres (of W) — beyond the rule ends
    anchorXRight: 0.979,
    anchorRadius: 0.010,      // end-mark star outer radius (of W)
    numberX: 0.048,           // line number centre (of W) — outside the zone
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

  // Rule grey. Deliberately printed BELOW the ink detector's margin
  // (BIASegment flags ink at local-paper − luminance > 25; this grey sits
  // at ~22), so a child's letters SITTING ON the rule never weld to it:
  // to the detector the rule is not ink at all. Since the end-marks
  // arrived the rule is a visual guide for the child, not the
  // registration — the reader's gentler test (paper − lum > 12) still
  // finds it, but only as the FALLBACK for sheets printed before the
  // marks existed, square-on. A real camera at 720p loses this grey
  // almost entirely (measured in the field: 1 of 5 rules found), which
  // is exactly why registration moved to the marks. If a dim capture
  // pushes the rule over the ink margin anyway, hwRead's run-length
  // backstop removes it — with the disclosed cost that round letter
  // bottoms can split there.
  const RULE_COLOR = '#e6e9ee';
  const INK = '#141a26';
  // The line numbers: deliberately LIGHT. They share the margin with the
  // end-marks, and the reader admits a mark as a possible end-mark only
  // when it is nearly as dark as the darkest marks in the photo — a
  // number this light (paper − lum ≈ 66, vs ≈ 229 for solid ink) sits far
  // below that gate at any exposure, so it can never fake an anchor.
  const NUMBER_COLOR = '#b9c0cc';

  function ruleYFrac(i) { return GEOM.blockTop0 + i * GEOM.blockStep + GEOM.ruleOffset; }

  // Ink area of one printed end-mark for a page measured at pageWpx wide:
  // a five-point star with inner radius 0.42R has area 5·R·(0.42R)·sin36°
  // = 1.2344·R². The reader checks candidate marks against THIS number
  // (scaled by the measured vertical squash), which is what stops a
  // column of letters — several times an end-mark's size — from
  // impersonating the ladder. One geometry, two consumers.
  function anchorAreaPx(pageWpx) {
    const R = GEOM.anchorRadius * pageWpx;
    return 1.2344 * R * R;
  }

  /* Per-line pixel geometry for a sheet whose rule was measured at
   * ruleLenPx long — the reader's entry point. Everything hangs off the
   * rule's own length, so a photograph's scale never has to be guessed.
   * pitchPx (optional) is the MEASURED distance to the neighbouring
   * rules: a webcam looking down at a sheet foreshortens the page
   * vertically, so vertical quantities (ascent, descent, thickness) must
   * come from a vertical measurement, not from the width times the paper
   * aspect. Omitted (an old flat capture), the isotropic assumption
   * stands exactly as before. `anis` is the measured vertical scale
   * relative to the horizontal one (1 = square pixels). */
  function lineZoneFor(ruleLenPx, pitchPx) {
    const W = ruleLenPx / (GEOM.xRight - GEOM.xLeft);
    const isoH = W * GEOM.aspect;
    const H = pitchPx != null ? pitchPx / GEOM.blockStep : isoH;
    return {
      pageW: W, pageH: H,
      ascentPx: GEOM.ascent * H,
      descentPx: GEOM.descent * H,
      blockStepPx: GEOM.blockStep * H,
      ruleThicknessPx: GEOM.ruleThickness * H,
      anis: H / isoH
    };
  }

  // A small five-point star, point up — the same shape the Magic Card
  // draws its stars with, so nothing about the sheet announces a machine.
  function drawStar(ctx, cx, cy, R) {
    const r = R * 0.42;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + k * Math.PI / 5;
      const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
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
      // mistaken for the child's ink — and printed LIGHT so it can never
      // be mistaken for an end-mark (see NUMBER_COLOR).
      ctx.fillStyle = NUMBER_COLOR;
      ctx.font = Math.round(GEOM.modelSize * H * 0.8) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), GEOM.numberX * W, ruleY);
      ctx.textAlign = 'left';

      // The rule — the baseline the child writes on.
      ctx.fillStyle = RULE_COLOR;
      const t = Math.max(1, Math.round(GEOM.ruleThickness * H));
      ctx.fillRect(x0, Math.round(ruleY - t / 2), x1 - x0, t);

      // The end-marks — solid ink, at both ends of the rule, beyond where
      // a child's letters can reach. The reader registers on these.
      ctx.fillStyle = INK;
      drawStar(ctx, GEOM.anchorXLeft * W, ruleY, GEOM.anchorRadius * W);
      drawStar(ctx, GEOM.anchorXRight * W, ruleY, GEOM.anchorRadius * W);

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

  window.HWSheet = { LINES, GEOM, RULE_COLOR, NUMBER_COLOR, CALLOUT,
                     ruleYFrac, lineZoneFor, anchorAreaPx, draw };
})();
