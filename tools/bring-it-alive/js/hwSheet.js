/* HW SHEET — the writing page: what it says, and exactly where.
 *
 * MY HANDWRITING (the handwriting journey) starts on paper: the tool
 * prints a page, the child copies each model line in their own
 * handwriting onto the ruled blank beneath it, and shows the result to
 * the camera. Known text turns reading into ALIGNMENT — the reader never
 * recognises a letter, it only decides which known letter each blob of
 * ink is standing where. That only works if the page's geometry is
 * KNOWN, so this module is the single source of truth for it: the
 * renderer draws from GEOM and the reader (hwRead.js) measures against
 * the same GEOM. One geometry, two consumers — the Magic Card's own
 * lesson (Decision 17: the reader and the art share one geometry
 * function), including its correction: the numbers here were MEASURED
 * against the rendered page by the suite, not asserted.
 *
 * THE PAGE IS FIVE READING CARDS (the product owner, verbatim: "instead
 * of reading one full page, try designing the page as 5 reding cards,
 * and than kid can show each card 1 by 1. this will make life easier on
 * both ends"). Each card is one model line printed above one ruled
 * blank with its anchor stars, held in its own light border, and dashed
 * CUT LINES with a little scissors mark run between the cards — cutting
 * them apart is part of the fun, and a cut card in a child's hand is
 * the close-up the camera wants. CUTTING IS NEVER REQUIRED: the uncut
 * page held close on one card reads exactly like a cut card, and a
 * photo of the whole page still reads everything at once, because the
 * reader registers on the anchor stars and the stars did not move.
 *
 * THE BORDERS AND CUT LINES ARE INVISIBLE TO THE READER, BY THE SAME
 * TWO DISCIPLINES THE PAGE ALREADY USES. The card border and the cut
 * dashes are printed in the rule's own grey — below the ink detector's
 * margin (BIASegment flags ink at local-paper − luminance > 25; this
 * grey sits at ~22), so to the reader they are not ink at all: they can
 * never weld letters, never join a component, never enter the font.
 * The scissors mark is printed in the line numbers' light grey, which
 * sits far below the reader's mark-darkness gate (paper − lum ≈ 64 vs
 * ≈ 229 for solid ink, against a 0.45-of-darkest gate), so it can never
 * impersonate an anchor star — the exact guard that already keeps the
 * numbers honest. And the dashes' gaps are wider than the rule
 * detector's bridge, so a cut line can never read as a ruled baseline
 * even on the fallback path. The suite asserts all three.
 *
 * The model lines are three full lowercase pangrams, ONE uppercase
 * pangram, and a digits line: every letter a–z appears at least three
 * times, every digit twice — the builder picks the cleanest sample of
 * each — and every capital A–Z at least ONCE. One capitals line, not
 * two, because the page is a child's effort budget: a fifth line of
 * writing already costs real patience, and a sixth would buy "pick the
 * cleanest capital" at the price of many children never finishing.
 * Disclosed cost: most capitals get a single sample, so a capital the
 * child fumbled is the capital their font gets (or, if it is refused, a
 * quiet empty slot and a per-card retake — same as ever).
 *
 * The RULE under each line is the baseline the child writes on, and it
 * is the key font metric. It is printed solid and visible (a child needs
 * a real line to sit letters on), and the reader removes it from the ink
 * by vertical run-length before letters are cut apart (hwRead.js).
 *
 * END-MARKS (the camera fix, kept from the sheet era). Every rule
 * carries a small SOLID-INK five-point star at BOTH ends — outside the
 * writing zone, beyond where the rule starts and ends, so a child's
 * letters can never touch them. To a child they are ten little stars
 * holding the lines (and, on a cut card, two stars holding its one
 * line); to the reader they are the registration: the whole-page ladder
 * registers from all five pairs, and a single card registers from ITS
 * OWN pair. The line numbers stay LIGHT for the same reason the
 * scissors mark is light: they live near the marks and must sit below
 * the mark-darkness gate.
 */
(function () {
  'use strict';

  // The model lines. Lines 1–3 are complete lowercase pangrams (every
  // letter of a–z in each); line 4 is the SAME sentence as line 2 in
  // capitals — a pangram the child has already met, so the capitals card
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

  // The no-cursive callout, printed once at the top of the page where
  // the child writes — once, not on every card: the cards' room went to
  // the writing blanks, and one gentle sentence read before the first
  // card serves all five. Child words on purpose: no jargon, no blame —
  // joined-up writing is a real skill, it is just one the reader cannot
  // meet letter by letter.
  const CALLOUT = 'Write each letter on its own, with a little space — ' +
    'letters that hold hands are hard for me to see.';

  /* All geometry as FRACTIONS — x-values of the page width W, y-values
   * of the page height H (portrait, H = √2·W, A4 proportions). The
   * reader re-derives H per line from the measured rule length, so these
   * fractions are the whole registration contract.
   *
   * FIVE CARDS, ONE PER LINE. The card era spends the old page header on
   * the blanks: the header shrank from 0.103·H to 0.058·H (title,
   * instruction and callout on three compact lines) and the old footer
   * line went away (its content lives in the instruction), so the card
   * pitch grew 0.170 → 0.184 and the ruled blank grew with it —
   * ascent 0.082 → 0.086, descent 0.034 → 0.040, a 0.116 → 0.126 blank
   * (+8.6%; on A4, 34.5mm → 37.4mm of writing room, ascent 24.4 → 25.6mm).
   * MEASURED honestly: the border and cut-line overheads cap the gain —
   * each card pays 0.004 top pad, the model line's own band, and a
   * bottom clearance that keeps a degraded border fragment's CENTRE
   * outside the reader's writing band (rule + 1.15·descent < border y).
   *
   * The reader learns the count and pitch from these same constants
   * (HWSheet.LINES.length and GEOM drive its ladder scoring and its
   * single-pair card registration), so the two cannot drift; a photo
   * whose marks do not match THIS pattern is still refused.
   *
   * The side margins carry the end-marks and the card number: page edge ·
   * end-mark (0.015–0.039) · number (~0.042–0.054) · rule at 0.070. The
   * end-marks stand clear of the paper edge by more than the reader's
   * isolation ring around them (see anchorXLeft), the number is printed
   * light enough that it can never count against that clear margin (see
   * NUMBER_COLOR), and the right margin is just edge · end-mark · rule.
   * Writing span 0.885 of W. The card border's vertical edges live
   * OUTSIDE the end-marks (cardXInset 0.006 vs marks at 0.015+), are not
   * ink at all, and the frame OPENS beside each star (borderGapHalf). */
  const GEOM = {
    aspect: Math.SQRT2,       // H / W
    xLeft: 0.070,             // rule start (of W)
    xRight: 0.955,            // rule end (of W)
    anchorXLeft: 0.027,       // end-mark centres (of W) — beyond the rule ends.
    anchorXRight: 0.973,      //   Moved inward from 0.021/0.979 with the
                              //   cards: the reader's isolation ring around a
                              //   mark (0.35 × its own diagonal) used to end
                              //   ~1px inside the paper's own edge — working
                              //   by luck — and the bigger star below pushed
                              //   it OVER the edge, where the paper-vs-desk
                              //   boundary reads as dark ink and every edge
                              //   star lost its clear margin. The stars now
                              //   stand 0.015·W clear of the paper edge, so
                              //   the ring box never leaves the paper.
    anchorRadius: 0.012,      // end-mark star outer radius (of W). Raised
                              //   from 0.010 with the cards: MEASURED at
                              //   640×360 under the field warp, the last
                              //   line's star squashed to 2px of ink —
                              //   under the reader's flatness floor — and
                              //   with one anchor gone the true ladder was
                              //   impossible. 20% more star is the print
                              //   carrying its own legibility.
    numberX: 0.048,           // line number centre (of W) — outside the zone
    titleY: 0.024,            // title baseline (of H)
    titleSize: 0.020,
    instrY: 0.0385,           // instruction baseline (of H)
    calloutY: 0.052,          // the no-cursive callout baseline (of H)
    blockTop0: 0.058,         // first card block top (of H)
    blockStep: 0.184,         // card pitch (of H) — one card per fifth of the page
    cardPad: 0.004,           // card border inset from the block boundary (of H)
    cardXInset: 0.006,        // card border inset from the page sides (of W)
    cardRadius: 0.008,        // card border corner radius (of W)
    borderThickness: 0.0016,  // card border stroke (of H) — NOT ink, see BORDER_COLOR
    borderGapHalf: 0.030,     // the border's side openings, ± of H around each
                              //   rule: the Magic Card's own move (Decision 17
                              //   — "the chart's ruled frame opens at the
                              //   corners, so each guide star is its own
                              //   shape"). The stars sit level with the side
                              //   borders, and under blur + JPEG a solid side
                              //   border could smear into a star and swallow
                              //   it whole, so the frame opens where the
                              //   stars are and each star stays its own shape.
    cutDash: 0.007,           // cut-line dash length (of W)…
    cutGap: 0.009,            // …and gap — wider than the rule detector's
                              //   bridge (W/700) at every size drawn, so a
                              //   cut line can never form a rule-length run
    modelBaseline: 0.034,     // model text baseline, from block top (of H)
    modelSize: 0.021,         // model text size (of H)
    ruleOffset: 0.132,        // rule y, from block top (of H)
    ascent: 0.086,            // writing zone above the rule (of H)
    descent: 0.040,           // writing zone below the rule (of H)
    ruleThickness: 0.0022     // printed rule thickness (of H)
  };

  // Rule grey. Deliberately printed BELOW the ink detector's margin
  // (BIASegment flags ink at local-paper − luminance > 25; this grey sits
  // at ~22), so a child's letters SITTING ON the rule never weld to it:
  // to the detector the rule is not ink at all. Since the end-marks
  // arrived the rule is a visual guide for the child, not the
  // registration — the reader's gentler test (paper − lum > 12) still
  // finds it, but only as the FALLBACK for pages printed before the
  // marks existed, square-on. If a dim capture pushes the rule over the
  // ink margin anyway, hwRead's run-length backstop removes it — with
  // the disclosed cost that round letter bottoms can split there.
  const RULE_COLOR = '#e6e9ee';
  // The card border and the cut dashes wear the SAME sub-margin grey:
  // clear on paper, nothing to the ink detector. A border that were ink
  // would be a frame-wide component in every close-up — the exact class
  // the tilted-page-edge lesson closed — so it is kept out of the ink
  // plane by construction, and the suite asserts it stays out.
  const BORDER_COLOR = RULE_COLOR;
  const CUT_COLOR = RULE_COLOR;
  const INK = '#141a26';
  // The line numbers and the scissors mark: deliberately LIGHT. They
  // share the page with the end-marks, and the reader admits a mark as a
  // possible end-mark only when it is nearly as dark as the darkest
  // marks in the photo — this grey (paper − lum ≈ 66, vs ≈ 229 for solid
  // ink) sits far below that gate at any exposure, so neither can ever
  // fake an anchor.
  // Lightened with the cards (#b9c0cc → paper − lum ≈ 66, this ≈ 52):
  // the bigger stars' isolation rings now reach the number's column, and
  // a dim capture can drag the relative darkness gate low enough that a
  // 66-dark number would break a real star's clear margin. At ≈ 52 the
  // gate would have to fall to a capture too washed to read at all.
  const NUMBER_COLOR = '#c6ccd9';

  function ruleYFrac(i) { return GEOM.blockTop0 + i * GEOM.blockStep + GEOM.ruleOffset; }
  // The cut lines sit exactly on the block boundaries BETWEEN cards —
  // four of them for five cards, none above the first or below the last.
  function cutYFrac(k) { return GEOM.blockTop0 + k * GEOM.blockStep; }

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

  /* Per-line pixel geometry for a page whose rule was measured at
   * ruleLenPx long — the reader's entry point. Everything hangs off the
   * rule's own length, so a photograph's scale never has to be guessed.
   * pitchPx (optional) is the MEASURED distance to the neighbouring
   * rules: a webcam looking down at a page foreshortens it vertically,
   * so vertical quantities (ascent, descent, thickness) must come from a
   * vertical measurement, not from the width times the paper aspect.
   * Omitted (a flat capture, or a single card with no neighbour to
   * measure against), the isotropic assumption stands exactly as before.
   * `anis` is the measured vertical scale relative to the horizontal one
   * (1 = square pixels). */
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
  // draws its stars with, so nothing about the page announces a machine.
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

  function roundRect(ctx, x0, y0, x1, y1, r) {
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0); ctx.arcTo(x1, y0, x1, y0 + r, r);
    ctx.lineTo(x1, y1 - r); ctx.arcTo(x1, y1, x1 - r, y1, r);
    ctx.lineTo(x0 + r, y1); ctx.arcTo(x0, y1, x0, y1 - r, r);
    ctx.lineTo(x0, y0 + r); ctx.arcTo(x0, y0, x0 + r, y0, r);
    ctx.closePath();
  }

  /* Draw the page at widthPx. Returns the pixel geometry it drew with
   * (the suite renders its synthetic filled page through exactly this,
   * so the test page and the printed page cannot drift apart). */
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
    ctx.font = Math.round(GEOM.titleSize * H * 0.55) + 'px sans-serif';
    ctx.fillStyle = '#7a8496';
    ctx.fillText('Copy each line onto the empty line in its card — dark pencil ' +
      'or pen, letters sitting on the line.',
      GEOM.xLeft * W, GEOM.instrY * H);

    // The no-cursive callout — printed just above the first card, a
    // touch larger and darker than the instruction, because it is the
    // one thing that decides whether the reader can meet the letters.
    // Shrunk to the rule span like the model lines, never clipped.
    let calloutSize = GEOM.titleSize * H * 0.66;
    ctx.font = Math.round(calloutSize) + 'px sans-serif';
    const calloutSpan = (GEOM.xRight - GEOM.xLeft) * W;
    const calloutW = ctx.measureText(CALLOUT).width;
    if (calloutW > calloutSpan) {
      calloutSize = calloutSize * calloutSpan / calloutW;
      ctx.font = Math.round(calloutSize) + 'px sans-serif';
    }
    ctx.fillStyle = '#4a5468';
    ctx.fillText(CALLOUT, GEOM.xLeft * W, GEOM.calloutY * H);

    const drawn = { W, H, lines: [], cards: [], cuts: [] };
    for (let i = 0; i < LINES.length; i++) {
      const top = (GEOM.blockTop0 + i * GEOM.blockStep) * H;
      const ruleY = ruleYFrac(i) * H;
      const x0 = GEOM.xLeft * W, x1 = GEOM.xRight * W;

      // The card border — a light rounded frame holding this line and
      // its blank. Printed in the rule's own sub-margin grey (see
      // BORDER_COLOR): a child sees a card; the reader sees nothing.
      const cx0 = GEOM.cardXInset * W, cx1 = (1 - GEOM.cardXInset) * W;
      const cy0 = top + GEOM.cardPad * H;
      const cy1 = top + (GEOM.blockStep - GEOM.cardPad) * H;
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Math.round(GEOM.borderThickness * H));
      roundRect(ctx, cx0, cy0, cx1, cy1, GEOM.cardRadius * W);
      ctx.stroke();
      // The frame opens beside the stars (GEOM.borderGapHalf): the side
      // borders step aside where the anchor stars sit, so a star can
      // never share a component with the frame however soft the camera.
      const gapHalf = GEOM.borderGapHalf * H;
      const lw2 = Math.ceil(GEOM.borderThickness * H) + 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx0 - lw2, ruleY - gapHalf, 2 * lw2, 2 * gapHalf);
      ctx.fillRect(cx1 - lw2, ruleY - gapHalf, 2 * lw2, 2 * gapHalf);
      drawn.cards.push({ index: i, x0: cx0, y0: cy0, x1: cx1, y1: cy1 });

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

      // The card number, left of the writing zone so it can never be
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

    // The cut lines — dashed, BETWEEN the cards, with a little scissors
    // mark: the invitation to cut the cards apart, wordless. Dash gaps
    // are wider than the rule detector's bridge (so a cut line never
    // reads as a rule), the grey is the rule's own sub-margin grey (so
    // it is never ink), and the scissors mark wears the number grey (so
    // it can never pass the mark-darkness gate and fake an anchor).
    ctx.strokeStyle = CUT_COLOR;
    ctx.lineWidth = Math.max(1, Math.round(0.0018 * H));
    ctx.setLineDash([GEOM.cutDash * W, GEOM.cutGap * W]);
    for (let k = 1; k < LINES.length; k++) {
      const y = cutYFrac(k) * H;
      ctx.beginPath();
      ctx.moveTo(GEOM.cardXInset * W, y);
      ctx.lineTo((1 - GEOM.cardXInset) * W, y);
      ctx.stroke();
      drawn.cuts.push(y);
    }
    ctx.setLineDash([]);
    ctx.fillStyle = NUMBER_COLOR;
    ctx.font = Math.round(0.012 * H) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const y of drawn.cuts) ctx.fillText('✂', 0.5 * W, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return drawn;
  }

  window.HWSheet = { LINES, GEOM, RULE_COLOR, BORDER_COLOR, CUT_COLOR,
                     NUMBER_COLOR, CALLOUT,
                     ruleYFrac, cutYFrac, lineZoneFor, anchorAreaPx, draw };
})();
