/* HW SHEET — the writing cards: what they say, and exactly where.
 *
 * MY HANDWRITING (the handwriting journey) starts on paper: the tool
 * prints the cards, the child copies each model line in their own
 * handwriting onto the ruled blank beneath it, and shows the result to
 * the camera. Known text turns reading into ALIGNMENT — the reader never
 * recognises a letter, it only decides which known letter each blob of
 * ink is standing where. That only works if the cards' geometry is
 * KNOWN, so this module is the single source of truth for it: the
 * renderer draws from GEOM and the reader (hwRead.js) measures against
 * the same GEOM. One geometry, two consumers — the Magic Card's own
 * lesson (Decision 17: the reader and the art share one geometry
 * function).
 *
 * THE PRINTABLE IS TWO PAGES, THREE CARDS AND TWO (the product owner,
 * verbatim: "you can put max 3 cards on the paper. provide spacing
 * between cutlines. also ensure that a person will have to hold it. so
 * while holding the text should not get hidden. current page does not
 * have any breathing space"). Five cards in all, numbered 1–5 across
 * the pages, each card one model line over one ruled blank with its two
 * anchor stars, held in its own light border. Three deliberate moves:
 *
 *   1. A REAL GUTTER BETWEEN CUT LINES. Every card carries its own pair
 *      of dashed cut lines, and between neighbouring cards the two
 *      lines stand 2·cutInset apart (≈9mm on A4) with open paper
 *      between them — scissors that wander land in the gutter, never
 *      in a card. The scissors mark stays, one per cut line.
 *
 *   2. GRIP MARGINS — a held card never hides its text. A cut card is
 *      the page's full width and is held at its short ends, thumbs on
 *      the face. A thumb pad is ~20–25mm wide (a child's ~15–18mm) and
 *      a flat "hold it up to the camera" grip can plant the whole
 *      distal pad on the card, so everything that matters — the anchor
 *      stars above all, because losing one loses the card's
 *      registration — starts ≥20mm in from either side edge
 *      (GRIP_X = 0.0952·W). Nothing readable, and nothing the reader
 *      needs, lives in the grip zones; only the card's own light
 *      furniture (border, cut dashes) crosses them, and that is below
 *      the ink margin by construction. Disclosed cost: the writing
 *      span narrows from 0.885·W to 0.717·W (186mm → 151mm on A4).
 *
 *   3. BREATHING ROOM, spent on the blank. With three cards on a page
 *      each card gets far more height: the ruled blank grows from the
 *      card era's 0.126·H (37.4mm on A4, ascent 25.6mm) to 0.156·H —
 *      46.3mm of writing room, ascent 32.1mm (+24% / +25%) — the model
 *      text grows 0.021 → 0.024·H, and the card keeps honest padding:
 *      model print ≥8mm below the top cut edge, the descent line
 *      ≥15mm above the bottom cut edge.
 *
 * THE READER READS ONE CARD AT A TIME — strictly (the product owner:
 * "only 1 question at a time will be shown, if camera sees more, it
 * can show a message overlay"). There is no whole-page ladder on this
 * print and no page identity to get wrong: every card carries its own
 * two anchor stars and its own printed sentence, and hwRead registers
 * and identifies each card from those alone. A view holding more than
 * one card is kindly refused, never read.
 *
 * THE BORDERS AND CUT LINES ARE INVISIBLE TO THE READER, BY THE SAME
 * TWO DISCIPLINES AS EVER. The card border and the cut dashes are
 * printed in the rule's own grey — below the ink detector's margin
 * (BIASegment flags ink at local-paper − luminance > 25; this grey sits
 * at ~22), so to the reader they are not ink at all: they can never
 * weld letters, never join a component, never enter the font. The
 * scissors mark and the card numbers are printed in a light grey far
 * below the reader's mark-darkness gate (paper − lum ≈ 52 vs ≈ 229 for
 * solid ink, against a 0.45-of-darkest gate), so neither can ever
 * impersonate an anchor star. And the dashes' gaps are wider than the
 * rule detector's bridge, so a cut line can never read as a ruled
 * baseline. The suite asserts all of it.
 *
 * The model lines are unchanged: three full lowercase pangrams, ONE
 * uppercase pangram, and a digits line — every letter a–z at least
 * three times, every digit twice, every capital at least once (single
 * capital sample disclosed, as before).
 *
 * The RULE under each line is the baseline the child writes on — printed
 * solid and visible but below the ink margin, exactly as before.
 *
 * END-MARKS: every rule carries a small SOLID-INK five-point star at
 * BOTH ends, beyond where the rule starts and ends and now also beyond
 * the grip zones. To a child they are two stars holding the line; to
 * the reader they are the card's whole registration.
 *
 * LEGACY — the one-page five-card sheet. Pages printed before this
 * redesign still exist on children's desks, so the old print's geometry
 * and renderer are kept FROZEN under HWSheet.LEGACY (numbers and
 * drawing code byte-faithful to the old page). hwRead's whole-sheet
 * ladder and rule-fallback paths read old printouts against
 * LEGACY.GEOM and nothing else; nothing about the new cards feeds
 * them. Disclosed: a legacy sheet reads as a whole-page photograph;
 * its card close-ups no longer match the new card geometry and refuse
 * kindly.
 */
(function () {
  'use strict';

  // The model lines — unchanged from the one-page era (see the header).
  const LINES = [
    { text: 'jackdaws love my big sphinx of quartz' },
    { text: 'how quickly daft jumping zebras vex' },
    { text: 'the five boxing wizards jump quickly' },
    { text: 'HOW QUICKLY DAFT JUMPING ZEBRAS VEX' },
    { text: '0 1 2 3 4 5 6 7 8 9 8 6 4 2 0 9 7 5 3 1' }
  ];

  // Which card lives on which page. Three cards, then two — the second
  // page's lower third is honest whitespace, not a missing card.
  const PAGES = [{ lines: [0, 1, 2] }, { lines: [3, 4] }];
  function pageOf(lineIndex) {
    for (let p = 0; p < PAGES.length; p++) {
      const s = PAGES[p].lines.indexOf(lineIndex);
      if (s >= 0) return { page: p, slot: s };
    }
    return null;
  }

  // The no-cursive callout — printed once, on page 1, above the first
  // card. Child words on purpose: no jargon, no blame.
  const CALLOUT = 'Write each letter on its own, with a little space — ' +
    'letters that hold hands are hard for me to see.';

  /* All geometry as FRACTIONS — x-values of the page width W, y-values
   * of the page height H (portrait, H = √2·W, A4 proportions). The
   * reader re-derives H per card from the measured rule length, so
   * these fractions are the whole registration contract.
   *
   * THREE SLOTS PER PAGE, ONE CARD PER SLOT (page 2 uses two of them —
   * one card geometry everywhere, so a close-up cannot tell and need
   * not know which page its card came from). Side margins carry the
   * grip zones: page edge · 20mm of empty grip (GRIP_X) · end-mark
   * star (ink from 20.6mm) · light card number · rule. On A4:
   * gutter between facing cut lines 8.9mm · cut card 210×80mm · blank
   * 46.3mm (ascent 32.1, descent 14.3) · model text 7.1mm. */
  const GEOM = {
    aspect: Math.SQRT2,       // H / W
    xLeft: 0.155,             // rule start (of W) — 32.6mm in
    xRight: 0.872,            // rule end (of W)
    anchorXLeft: 0.110,       // end-mark centres (of W) — inside the grip
    anchorXRight: 0.890,      //   margin: star ink begins at 20.6mm, so a
                              //   planted thumb pad (~20mm) cannot cover a
                              //   star, and the isolation ring the reader
                              //   draws around a mark has empty paper on
                              //   every side by construction
    anchorRadius: 0.012,      // end-mark star outer radius (of W) — the
                              //   card era's own measured size, unchanged
    numberX: 0.135,           // card number centre (of W) — 28.4mm in,
                              //   outside the grip zone, left of the rule
    gripX: 0.0952,            // the grip zone: 20mm of a 210mm page — no
                              //   ink and nothing readable inside it
    titleY: 0.026,            // title baseline (of H)
    titleSize: 0.020,
    instrY: 0.0405,           // instruction baseline (of H)
    calloutY: 0.055,          // the no-cursive callout baseline (page 1)
    blockTop0: 0.064,         // first slot top (of H)
    blockStep: 0.300,         // slot pitch (of H) — three slots per page
    cutInset: 0.015,          // cut line inset from the slot boundary (of
                              //   H): every card carries its OWN pair of
                              //   cut lines, so between neighbours two
                              //   dashed lines stand 2·cutInset (≈8.9mm)
                              //   apart with open gutter between them —
                              //   wandering scissors land in the gutter,
                              //   never in a card
    cardPad: 0.006,           // card border inset from the cut line (of H)
    cardXInset: 0.008,        // card border inset from the page sides (of W)
    cardRadius: 0.008,        // card border corner radius (of W)
    borderThickness: 0.0016,  // card border stroke (of H) — NOT ink
    cutDash: 0.007,           // cut-line dash length (of W)…
    cutGap: 0.009,            // …and gap — wider than the rule detector's
                              //   bridge (W/700) at every size drawn
    modelBaseline: 0.066,     // model text baseline, from slot top (of H) —
                              //   model print tops out ≥8mm below the top
                              //   cut edge, clear of a thumb over the edge
    modelSize: 0.024,         // model text size (of H) — grown with the card
    ruleOffset: 0.186,        // rule y, from slot top (of H)
    ascent: 0.108,            // writing zone above the rule (of H) — 32.1mm
    descent: 0.048,           // writing zone below the rule (of H) — the
                              //   descent line sits ≥15mm above the bottom
                              //   cut edge, and rule + 1.15·descent stays
                              //   well inside the card border
    ruleThickness: 0.0022     // printed rule thickness (of H)
  };
  // (The card-era GEOM carried borderGapHalf — side-border openings
  // beside each star, because the stars sat 0.006·W from the border and
  // blur could weld them. The grip margins moved the stars 0.102·W away
  // from the side borders, farther than any isolation ring reaches, so
  // the openings earn nothing and the border is continuous again.)

  // Rule grey. Deliberately printed BELOW the ink detector's margin
  // (BIASegment flags ink at local-paper − luminance > 25; this grey sits
  // at ~22), so a child's letters SITTING ON the rule never weld to it.
  const RULE_COLOR = '#e6e9ee';
  // The card border and the cut dashes wear the SAME sub-margin grey:
  // clear on paper, nothing to the ink detector.
  const BORDER_COLOR = RULE_COLOR;
  const CUT_COLOR = RULE_COLOR;
  const INK = '#141a26';
  // The card numbers and the scissors mark: deliberately LIGHT (paper −
  // lum ≈ 52, far below the reader's 0.45-of-darkest mark gate at any
  // exposure), so neither can ever fake an anchor.
  const NUMBER_COLOR = '#c6ccd9';

  // One slot's landmarks (of H, from the page top).
  function slotTopFrac(slot) { return GEOM.blockTop0 + slot * GEOM.blockStep; }
  function ruleYFrac(slot) { return slotTopFrac(slot) + GEOM.ruleOffset; }
  function cutYFracs(slot) {
    return [slotTopFrac(slot) + GEOM.cutInset,
            slotTopFrac(slot) + GEOM.blockStep - GEOM.cutInset];
  }

  // Ink area of one printed end-mark for a page measured at pageWpx wide:
  // a five-point star with inner radius 0.42R has area 1.2344·R². The
  // reader checks candidate marks against THIS number. One geometry,
  // two consumers.
  function anchorAreaPx(pageWpx, geom) {
    const R = (geom || GEOM).anchorRadius * pageWpx;
    return 1.2344 * R * R;
  }

  /* Per-card pixel geometry for a card whose rule was measured at
   * ruleLenPx long — the reader's entry point. Everything hangs off the
   * rule's own length. pitchPx (with a geom carrying blockStep) belongs
   * to the LEGACY whole-sheet path, where neighbouring rules give a
   * vertical measurement; a single card has no neighbour and stays
   * isotropic. `geom` defaults to the current card geometry; the legacy
   * reader passes HWSheet.LEGACY.GEOM. */
  function lineZoneFor(ruleLenPx, pitchPx, geom) {
    const G = geom || GEOM;
    const W = ruleLenPx / (G.xRight - G.xLeft);
    const isoH = W * G.aspect;
    const H = pitchPx != null ? pitchPx / G.blockStep : isoH;
    return {
      pageW: W, pageH: H,
      ascentPx: G.ascent * H,
      descentPx: G.descent * H,
      blockStepPx: G.blockStep * H,
      ruleThicknessPx: G.ruleThickness * H,
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

  function fitText(ctx, text, sizePx, spanPx, frac) {
    ctx.font = Math.round(sizePx) + 'px sans-serif';
    const w = ctx.measureText(text).width;
    if (w > spanPx * frac) {
      sizePx = sizePx * (spanPx * frac) / w;
      ctx.font = Math.round(sizePx) + 'px sans-serif';
    }
    return sizePx;
  }

  /* Draw ONE page of the printable at widthPx (page 0 by default).
   * Returns the pixel geometry it drew with — the suite renders its
   * synthetic filled pages through exactly this, so the test pages and
   * the printed pages cannot drift apart. */
  function draw(canvas, widthPx, page) {
    page = page || 0;
    const W = widthPx, H = Math.round(W * GEOM.aspect);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK;
    ctx.font = Math.round(GEOM.titleSize * H) + 'px sans-serif';
    ctx.fillText(page === 0 ? 'My Handwriting' : 'My Handwriting — more cards',
      GEOM.xLeft * W, GEOM.titleY * H);
    ctx.font = Math.round(GEOM.titleSize * H * 0.55) + 'px sans-serif';
    ctx.fillStyle = '#7a8496';
    ctx.fillText(page === 0
      ? 'Copy each line onto the empty line in its card — dark pencil ' +
        'or pen, letters sitting on the line.'
      : 'The last two cards — dark pencil or pen, letters sitting on the line.',
      GEOM.xLeft * W, GEOM.instrY * H);

    if (page === 0) {
      // The no-cursive callout — printed just above the first card,
      // once for the whole set. Shrunk to the rule span, never clipped.
      let calloutSize = GEOM.titleSize * H * 0.66;
      ctx.font = Math.round(calloutSize) + 'px sans-serif';
      const span = (GEOM.xRight - GEOM.xLeft) * W;
      const w = ctx.measureText(CALLOUT).width;
      if (w > span) {
        calloutSize = calloutSize * span / w;
        ctx.font = Math.round(calloutSize) + 'px sans-serif';
      }
      ctx.fillStyle = '#4a5468';
      ctx.fillText(CALLOUT, GEOM.xLeft * W, GEOM.calloutY * H);
    }

    const drawn = { W, H, page, lines: [], cards: [], cuts: [] };
    const slots = PAGES[page].lines;
    for (let s = 0; s < slots.length; s++) {
      const i = slots[s];                       // the card's global number
      const top = slotTopFrac(s) * H;
      const ruleY = ruleYFrac(s) * H;
      const x0 = GEOM.xLeft * W, x1 = GEOM.xRight * W;
      const [cutTop, cutBottom] = cutYFracs(s).map((f) => f * H);

      // The card's own cut lines — dashed, with open gutter beyond them
      // on both sides, drawn after the loop (so dashes never underlie
      // card content). Recorded now for the geometry consumers.
      drawn.cuts.push(cutTop, cutBottom);

      // The card border — a light rounded frame inside the cut lines.
      const cx0 = GEOM.cardXInset * W, cx1 = (1 - GEOM.cardXInset) * W;
      const cy0 = cutTop + GEOM.cardPad * H;
      const cy1 = cutBottom - GEOM.cardPad * H;
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Math.round(GEOM.borderThickness * H));
      roundRect(ctx, cx0, cy0, cx1, cy1, GEOM.cardRadius * W);
      ctx.stroke();
      drawn.cards.push({ index: i, slot: s, x0: cx0, y0: cy0, x1: cx1, y1: cy1,
                         cutTop, cutBottom });

      // Model text, shrunk to fit the rule span if it must.
      ctx.fillStyle = INK;
      fitText(ctx, LINES[i].text, GEOM.modelSize * H, x1 - x0, 0.98);
      ctx.fillText(LINES[i].text, x0, top + GEOM.modelBaseline * H);

      // The card number — its global number 1–5, printed LIGHT so it can
      // never be mistaken for an end-mark, outside the grip zone.
      ctx.fillStyle = NUMBER_COLOR;
      ctx.font = Math.round(GEOM.modelSize * H * 0.8) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), GEOM.numberX * W, ruleY);
      ctx.textAlign = 'left';

      // The rule — the baseline the child writes on.
      ctx.fillStyle = RULE_COLOR;
      const t = Math.max(1, Math.round(GEOM.ruleThickness * H));
      ctx.fillRect(x0, Math.round(ruleY - t / 2), x1 - x0, t);

      // The end-marks — solid ink, at both ends of the rule, beyond a
      // child's letters AND beyond a holding thumb.
      ctx.fillStyle = INK;
      drawStar(ctx, GEOM.anchorXLeft * W, ruleY, GEOM.anchorRadius * W);
      drawStar(ctx, GEOM.anchorXRight * W, ruleY, GEOM.anchorRadius * W);

      drawn.lines.push({ index: i, slot: s, text: LINES[i].text, ruleY, x0, x1,
                         zoneTop: ruleY - GEOM.ascent * H,
                         zoneBottom: ruleY + GEOM.descent * H });
    }

    // The cut lines — each card's own pair, dashed, a scissors mark on
    // each: the invitation to cut the cards apart, wordless. Dash gaps
    // wider than the rule detector's bridge, the grey never ink, the
    // scissors mark never dark enough to fake an anchor.
    ctx.strokeStyle = CUT_COLOR;
    ctx.lineWidth = Math.max(1, Math.round(0.0018 * H));
    ctx.setLineDash([GEOM.cutDash * W, GEOM.cutGap * W]);
    for (const y of drawn.cuts) {
      ctx.beginPath();
      ctx.moveTo(GEOM.cardXInset * W, y);
      ctx.lineTo((1 - GEOM.cardXInset) * W, y);
      ctx.stroke();
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

  /* ---- LEGACY: the one-page five-card sheet, FROZEN ---------------------
   * The print as it stood before the two-page redesign — geometry and
   * renderer byte-faithful to the old page, kept so already-printed
   * sheets on children's desks keep reading. hwRead's whole-sheet
   * ladder and rule-fallback paths measure against THIS geometry and
   * never against the new card GEOM. Do not tune these numbers: they
   * describe paper that already exists. */
  const LEGACY_GEOM = {
    aspect: Math.SQRT2,
    xLeft: 0.070, xRight: 0.955,
    anchorXLeft: 0.027, anchorXRight: 0.973,
    anchorRadius: 0.012,
    numberX: 0.048,
    titleY: 0.024, titleSize: 0.020,
    instrY: 0.0385, calloutY: 0.052,
    blockTop0: 0.058, blockStep: 0.184,
    cardPad: 0.004, cardXInset: 0.006, cardRadius: 0.008,
    borderThickness: 0.0016, borderGapHalf: 0.030,
    cutDash: 0.007, cutGap: 0.009,
    modelBaseline: 0.034, modelSize: 0.021,
    ruleOffset: 0.132, ascent: 0.086, descent: 0.040,
    ruleThickness: 0.0022
  };
  function legacyRuleYFrac(i) {
    return LEGACY_GEOM.blockTop0 + i * LEGACY_GEOM.blockStep + LEGACY_GEOM.ruleOffset;
  }
  function legacyDraw(canvas, widthPx) {
    const G = LEGACY_GEOM;
    const W = widthPx, H = Math.round(W * G.aspect);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = Math.round(G.titleSize * H) + 'px sans-serif';
    ctx.fillText('My Handwriting', G.xLeft * W, G.titleY * H);
    ctx.font = Math.round(G.titleSize * H * 0.55) + 'px sans-serif';
    ctx.fillStyle = '#7a8496';
    ctx.fillText('Copy each line onto the empty line in its card — dark pencil ' +
      'or pen, letters sitting on the line.', G.xLeft * W, G.instrY * H);
    ctx.fillStyle = '#4a5468';
    fitText(ctx, CALLOUT, G.titleSize * H * 0.66, (G.xRight - G.xLeft) * W, 1);
    ctx.fillText(CALLOUT, G.xLeft * W, G.calloutY * H);

    const drawn = { W, H, lines: [], cards: [], cuts: [] };
    for (let i = 0; i < LINES.length; i++) {
      const top = (G.blockTop0 + i * G.blockStep) * H;
      const ruleY = legacyRuleYFrac(i) * H;
      const x0 = G.xLeft * W, x1 = G.xRight * W;
      const cx0 = G.cardXInset * W, cx1 = (1 - G.cardXInset) * W;
      const cy0 = top + G.cardPad * H;
      const cy1 = top + (G.blockStep - G.cardPad) * H;
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Math.round(G.borderThickness * H));
      roundRect(ctx, cx0, cy0, cx1, cy1, G.cardRadius * W);
      ctx.stroke();
      // the frame opens beside the stars (the old page's own move)
      const gapHalf = G.borderGapHalf * H;
      const lw2 = Math.ceil(G.borderThickness * H) + 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx0 - lw2, ruleY - gapHalf, 2 * lw2, 2 * gapHalf);
      ctx.fillRect(cx1 - lw2, ruleY - gapHalf, 2 * lw2, 2 * gapHalf);
      drawn.cards.push({ index: i, x0: cx0, y0: cy0, x1: cx1, y1: cy1 });

      ctx.fillStyle = INK;
      fitText(ctx, LINES[i].text, G.modelSize * H, x1 - x0, 0.98);
      ctx.fillText(LINES[i].text, x0, top + G.modelBaseline * H);
      ctx.fillStyle = NUMBER_COLOR;
      ctx.font = Math.round(G.modelSize * H * 0.8) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), G.numberX * W, ruleY);
      ctx.textAlign = 'left';
      ctx.fillStyle = RULE_COLOR;
      const t = Math.max(1, Math.round(G.ruleThickness * H));
      ctx.fillRect(x0, Math.round(ruleY - t / 2), x1 - x0, t);
      ctx.fillStyle = INK;
      drawStar(ctx, G.anchorXLeft * W, ruleY, G.anchorRadius * W);
      drawStar(ctx, G.anchorXRight * W, ruleY, G.anchorRadius * W);
      drawn.lines.push({ index: i, text: LINES[i].text, ruleY, x0, x1,
                         zoneTop: ruleY - G.ascent * H,
                         zoneBottom: ruleY + G.descent * H });
    }
    ctx.strokeStyle = CUT_COLOR;
    ctx.lineWidth = Math.max(1, Math.round(0.0018 * H));
    ctx.setLineDash([G.cutDash * W, G.cutGap * W]);
    for (let k = 1; k < LINES.length; k++) {
      const y = (G.blockTop0 + k * G.blockStep) * H;
      ctx.beginPath();
      ctx.moveTo(G.cardXInset * W, y);
      ctx.lineTo((1 - G.cardXInset) * W, y);
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

  window.HWSheet = { LINES, PAGES, GEOM, RULE_COLOR, BORDER_COLOR, CUT_COLOR,
                     NUMBER_COLOR, CALLOUT,
                     pageOf, slotTopFrac, ruleYFrac, cutYFracs,
                     lineZoneFor, anchorAreaPx, draw,
                     LEGACY: { GEOM: LEGACY_GEOM, draw: legacyDraw,
                               ruleYFrac: legacyRuleYFrac } };
})();
