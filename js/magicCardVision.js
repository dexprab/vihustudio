// magicCardVision.js — "Show me your Magic Card."
//
// A child tapped ⭐ Show Me Your Stars and held their Magic Card up to
// the camera. Nobody taught them that. This module is the product
// agreeing with them.
//
// ---------------------------------------------------------------
// WHAT IT IS NOT
//
// Not authentication. Not scanning. Not verification. There is no QR
// code, no account id, no password and nothing for a child to
// understand. VihuPlanet looks at the stars on the card the child is
// holding, and either knows that sky or does not.
//
// It also invents NO identity system. The pattern this reads is handed
// to CreatorRecognition.recognise() — the same function the drawing
// board calls, matching a constellation as a SET, device first and
// then the platform. That is what makes a brand-new machine work: the
// card is the bridge, not the browser.
//
// ---------------------------------------------------------------
// HOW A PRINTED CARD IS READ
//
// The back of a Magic Card is a 10x10 grid on dark navy with a cream
// star at each cell of the constellation (js/magicCardArt.js's
// drawBack). So the camera's job is: find the bright marks, work out
// which cells they sit in, and hand those cells over.
//
//   1. a frame is drawn small (analysis runs at ~220px wide, not at
//      camera resolution — this runs many times a second on a tablet)
//   2. bright pixels are found relative to the frame's OWN brightness,
//      so a dim room and a bright one both work
//   3. those pixels are grouped into blobs, and blobs the wrong size
//      for a star are dropped
//   4. the blobs are fitted to a 10x10 lattice inside the guide frame,
//      searching a little around it for scale and offset — a child
//      holds a card roughly where the outline is, never exactly
//   5. the fit is only accepted when every star lands near a cell
//      centre and the count matches a real constellation
//
// Step 5 is what keeps a Traveller out of somebody else's world: a
// hand, a book or a face produces blobs that do not sit on a lattice,
// and the honest answer is "I couldn't see your stars yet."
//
// ---------------------------------------------------------------
// DISCLOSED LIMITS
//
// This is ordinary image processing, not a trained model. It reads a
// card held roughly square to the camera, roughly filling the guide,
// in light where the stars are brighter than the card. It tolerates
// distance, small rotation, hand movement and moderate tilt. It does
// not do heavy perspective correction: a card held at a steep angle is
// a "try again", not a recognition. That is the right way round — a
// failure costs a retry, and a false match would put a child in
// somebody else's sky.
const MagicCardVision = (function () {
  'use strict';

  // Analysis size. Small on purpose: this runs continuously, and a
  // star on a card is several pixels across even here.
  var W = 320;

  // How many consecutive frames must agree before a pattern is
  // believed. A single frame can be lucky; three in a row of the same
  // sky is a card being held up.
  var AGREE_FRAMES = 3;

  // How far from a cell centre a star may land, as a fraction of the
  // cell. Beyond this the fit is not a grid and is refused.
  var SNAP_TOLERANCE = 0.34;

  var MIN_STARS = 4;
  var MAX_STARS = 9;

  function _geometry() {
    try {
      if (typeof MagicCardArt !== 'undefined' && MagicCardArt.backGridGeometry) {
        return MagicCardArt.backGridGeometry();
      }
    } catch (e) {}
    // The same numbers the art produces, if the art module is absent.
    return { cardW: 700, cardH: 980, gridSize: 540, gridLeft: 80, gridTop: 190, cell: 54, cells: 10 };
  }

  // ---------------------------------------------------------------
  // Finding the bright marks in one frame.
  //
  // Threshold is relative to the frame itself rather than a fixed
  // number, because "bright" in a lamplit room and "bright" by a
  // window are different values and a child should not have to care.
  // ---------------------------------------------------------------
  function _blobs(data, w, h) {
    // LOCALLY BRIGHT, NOT BRIGHTEST IN THE ROOM.
    //
    // The first version compared every pixel against the whole frame's
    // brightness, and a photograph of it holding a real card shows why
    // that cannot work: the card is a small DARK rectangle held up in a
    // bright room, so a white wall behind it sets what "bright" means
    // and the card's own stars — dim, because the camera exposed for
    // the wall — never came close. It reported seeing nothing at all,
    // never even "hold it steadier".
    //
    // A star is not the brightest thing in the room. It is the
    // brightest thing on the CARD, by a wide margin. So each pixel is
    // compared against its own neighbourhood instead, through an
    // integral image so the whole frame still costs one pass. A dark
    // card under a bright window and a pale card under a lamp both
    // work, because neither is being asked to out-shine its
    // surroundings.
    var lum = new Float32Array(w * h);
    var i;
    for (i = 0; i < w * h; i++) {
      lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
    }

    // Integral image: sum(x,y) = every pixel above and left of here.
    var integral = new Float64Array((w + 1) * (h + 1));
    var x, y;
    for (y = 0; y < h; y++) {
      var rowSum = 0;
      for (x = 0; x < w; x++) {
        rowSum += lum[y * w + x];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }
    function areaMean(x0, y0, x1, y1) {
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
      var n = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (n <= 0) return 0;
      var s = integral[(y1 + 1) * (w + 1) + (x1 + 1)]
            - integral[y0 * (w + 1) + (x1 + 1)]
            - integral[(y1 + 1) * (w + 1) + x0]
            + integral[y0 * (w + 1) + x0];
      return s / n;
    }

    // Wide enough to take in the card around a star, narrow enough that
    // the wall behind the card is not what a star is measured against.
    var rad = Math.max(5, Math.round(w / 16));

    var bright = new Uint8Array(w * h);
    var any = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var v = lum[y * w + x];
        var local = areaMean(x - rad, y - rad, x + rad, y + rad);
        // Both a proportional and an absolute margin: the first finds a
        // star on a dim card, the second stops flat noise in an evenly
        // lit area from registering as thousands of tiny stars.
        if (v > local * 1.45 && v - local > 0.055) { bright[y * w + x] = 1; any++; }
      }
    }
    if (!any) return [];

    var seen = new Uint8Array(w * h);
    var out = [];
    var stack = [];
    for (i = 0; i < w * h; i++) {
      if (seen[i] || !bright[i]) continue;
      stack.length = 0;
      stack.push(i);
      seen[i] = 1;
      var n = 0, sx = 0, sy = 0;
      var minX = w, maxX = 0, minY = h, maxY = 0;
      while (stack.length) {
        var p = stack.pop();
        var px = p % w, py = (p / w) | 0;
        n++; sx += px; sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var qx = px + dx, qy = py + dy;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            var q = qy * w + qx;
            if (seen[q] || !bright[q]) continue;
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      var bw = maxX - minX + 1, bh = maxY - minY + 1;
      // A star is a small, roughly round mark. A window, a lamp or a
      // sheet of paper is not.
      //
      // Both bounds are a FRACTION of the frame rather than a pixel
      // count. A fixed cap of 400 was fine while analysis ran at 220px
      // wide and silently rejected every star the moment it ran at 320,
      // where the same mark covers twice the pixels — the reader went
      // from reading every test card to reading none, with nothing to
      // show for it but "I couldn't see your stars yet."
      if (n < 2 || n > w * h * 0.01) continue;
      if (bw > w * 0.22 || bh > h * 0.22) continue;
      var ratio = bw / Math.max(1, bh);
      if (ratio < 0.35 || ratio > 2.8) continue;
      out.push({ x: sx / n, y: sy / n, n: n });
    }
    out.sort(function (a2, b2) { return b2.n - a2.n; });

    // EVERY STAR ON A CARD IS DRAWN THE SAME SIZE.
    //
    // That is the fact that separates them from everything else the
    // local threshold picks up. Measured on a rendered card, the seven
    // real stars came out at 77 to 104 pixels and the seven impostors
    // at exactly 2 — the corners where grid lines cross, which are
    // locally brighter than the cells around them and are not stars by
    // any other test.
    //
    // Relative to the largest rather than a fixed floor, so a card held
    // at arm's length still works: there the stars are small, but they
    // are still all the same small.
    if (out.length) {
      var biggest = out[0].n;
      var floor = Math.max(3, biggest * 0.28);
      out = out.filter(function (bb) { return bb.n >= floor; });
    }
    return out.slice(0, 14);
  }

  // ---------------------------------------------------------------
  // WHERE THE GRID IS, from the grid itself.
  //
  // The first version of this searched for a lattice that the stars
  // happened to fit inside the guide frame, and it was wrong in a way
  // worth recording: a 10x10 lattice shifted by a whole cell fits a
  // set of stars EXACTLY as well as the true one. It read every test
  // card with the right columns and the rows off by one or two, and
  // no amount of tightening the search would have fixed it, because
  // both answers are equally good fits. The ambiguity was in the
  // question, not the search.
  //
  // The card answers it directly: the grid is drawn in gold on navy
  // (js/magicCardArt.js), so the gold IS the registration mark. Find
  // it and the mapping is absolute — no search, no ambiguity.
  //
  // The constellation's name is printed in the same gold BELOW the
  // grid, so the bounding box is taken as square from its top edge:
  // the grid is exactly as tall as it is wide, and the name is
  // narrower than it, so the width is the grid's and the text cannot
  // stretch it.
  function _goldGrid(data, w, h, blobs) {
    // Warmth, measured rather than assumed. A grid line over the card's
    // navy reads (56,53,59) against (41,42,59) beside it — the blue is
    // IDENTICAL and only red and green lift. A test for "looks gold"
    // (r > b) rejects both, which is what the first attempt did.
    //
    // The second attempt thresholded that difference per pixel and also
    // failed, for a reason worth keeping: analysis runs at 220px wide,
    // where the card's 1px line covers a third of a pixel and blends
    // with the navy around it. Fifteen levels becomes four. No
    // per-pixel threshold can hold onto that.
    //
    // Summing does. A grid line runs the whole side of the grid, so a
    // column sum accumulates that third of a pixel hundreds of times:
    // measured, the border column stands ~1100 above its neighbours at
    // analysis size. This looks for ridges in that sum, never for
    // bright pixels.
    var warm = new Float32Array(w * h);
    var i, x, y;
    for (i = 0; i < w * h; i++) {
      warm[i] = (data[i * 4] + data[i * 4 + 1]) / 2 - data[i * 4 + 2];
    }

    // The stars are taken out first. A star carries a gold glow and is
    // far warmer than a line, so leaving them in sets the scale of
    // "warm" so high that the border — the one thing being looked for —
    // never registers. The card's registration marks are the faint
    // things, not the obvious ones.
    var base = 0;
    for (i = 0; i < w * h; i += 11) base += warm[i];
    base /= Math.ceil(w * h / 11);
    for (i = 0; i < blobs.length; i++) {
      var rad = Math.max(6, Math.sqrt(blobs[i].n) * 2.0);
      var bx0 = Math.max(0, (blobs[i].x - rad) | 0), bx1 = Math.min(w - 1, (blobs[i].x + rad) | 0);
      var by0 = Math.max(0, (blobs[i].y - rad) | 0), by1 = Math.min(h - 1, (blobs[i].y + rad) | 0);
      for (y = by0; y <= by1; y++) {
        for (x = bx0; x <= bx1; x++) warm[y * w + x] = base;
      }
    }

    // Columns: the grid's left and right borders.
    var colSum = new Float32Array(w);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) colSum[x] += warm[y * w + x];
    }
    var cols = _ridges(colSum);
    if (!cols || cols.length < 2) return null;
    var left = cols[0], right = cols[cols.length - 1];
    var gw = right - left;
    if (gw < w * 0.15) return null;

    // Rows, over those columns only. The card carries gold text above
    // the grid and the constellation's name below it, and both are real
    // ridges — so the pair is chosen by the one thing that tells the
    // grid apart from writing: THE GRID IS SQUARE. The row ridges whose
    // separation best matches the width are its top and bottom.
    var rowSum = new Float32Array(h);
    for (y = 0; y < h; y++) {
      for (x = left; x <= right; x++) rowSum[y] += warm[y * w + x];
    }
    var rows = _ridges(rowSum);
    if (!rows || rows.length < 2) return null;

    // THE TOP EDGE, BY FITTING ALL ELEVEN LINES AT ONCE.
    //
    // Pairing two ridges and taking the pair a grid-width apart was not
    // enough, and the measurements say why: the left edge and the width
    // came out exactly right (25 and 169, against a true 25 and 170)
    // while the top landed three cells low. Any two ridges a width
    // apart look equally good, and gold text above and below the grid
    // supplies extra ridges to choose from.
    //
    // Eleven do not. The grid's spacing is already known — it is the
    // width over ten — so the only unknown left is where the comb
    // starts, and the true phase is the one that lines up with many
    // ridges rather than two. A wrong phase can match a pair; it cannot
    // match a whole grid.
    var cell = gw / 10;
    var bestTop = -1, bestScore = 0;
    for (var t = 0; t < h; t++) {
      if (t + gw >= h + cell) break;
      var score = 0;
      for (var k = 0; k <= 10; k++) {
        var want = t + k * cell;
        for (var ri = 0; ri < rows.length; ri++) {
          if (Math.abs(rows[ri] - want) <= Math.max(1.2, cell * 0.16)) { score++; break; }
        }
      }
      if (score > bestScore) { bestScore = score; bestTop = t; }
    }
    // At least half the grid's lines have to be there. Fewer than that
    // is not a grid being seen, it is a phase being invented.
    if (bestTop < 0 || bestScore < 6) return null;
    var bestBottom = bestTop + gw;

    return { x: left, y: bestTop, w: gw, h: bestBottom - bestTop };
  }

  // Local maxima in a projection that stand clearly above it. Returns
  // their positions in order.
  function _ridges(sig) {
    var n = sig.length, i;
    if (n < 12) return null;
    var sorted = Array.prototype.slice.call(sig).sort(function (a, b) { return a - b; });
    var med = sorted[(n / 2) | 0];
    var top = sorted[n - 1];
    if (top - med < 1e-3) return null;
    var cut = med + (top - med) * 0.30;
    var out = [];
    for (i = 1; i < n - 1; i++) {
      if (sig[i] < cut) continue;
      if (sig[i] < sig[i - 1] || sig[i] < sig[i + 1]) continue;
      // One ridge per line: a peak two pixels from the last one is the
      // same line, blurred.
      if (out.length && i - out[out.length - 1] < 3) {
        if (sig[i] > sig[out[out.length - 1]]) out[out.length - 1] = i;
        continue;
      }
      out.push(i);
    }
    return out.length ? out : null;
  }

  // Stars straight into cells, once the grid's own box is known.
  function _readCells(blobs, grid) {
    var cells = _geometry().cells;
    var cellW = grid.w / cells, cellH = grid.h / cells;
    var pattern = [];
    var used = {};
    for (var i = 0; i < blobs.length; i++) {
      var u = (blobs[i].x - grid.x) / cellW;
      var v = (blobs[i].y - grid.y) / cellH;
      var col = Math.round(u - 0.5), row = Math.round(v - 0.5);
      if (row < 0 || col < 0 || row >= cells || col >= cells) return null;
      if (Math.abs(u - (col + 0.5)) > SNAP_TOLERANCE) return null;
      if (Math.abs(v - (row + 0.5)) > SNAP_TOLERANCE) return null;
      var key = row + ',' + col;
      if (used[key]) return null;
      used[key] = 1;
      pattern.push([row, col]);
    }
    return pattern;
  }

  // ---------------------------------------------------------------
  // Fitting blobs to the card's 10x10 lattice.
  //
  // The guide frame is the prior: the child put the card roughly
  // there. The search is over how the grid sits inside it, because
  // "roughly" is the most anyone should have to manage while holding a
  // card in one hand.
  // ---------------------------------------------------------------
  function _fit(blobs, rect) {
    if (blobs.length < MIN_STARS || blobs.length > MAX_STARS) return null;
    var geo = _geometry();
    var cells = geo.cells;

    // Where the grid sits inside the whole card, as fractions — so the
    // search is over the CARD's placement, not over pixels.
    var fx = geo.gridLeft / geo.cardW;
    var fy = geo.gridTop / geo.cardH;
    var fw = geo.gridSize / geo.cardW;
    var fh = geo.gridSize / geo.cardH;

    var best = null;
    // Scale and offset of the card relative to the guide. A card held
    // a little further away, or not quite centred, still lands.
    for (var s = 0.80; s <= 1.201; s += 0.04) {
      for (var ox = -0.14; ox <= 0.141; ox += 0.035) {
        for (var oy = -0.14; oy <= 0.141; oy += 0.035) {
          var cw = rect.w * s, ch = rect.h * s;
          var cx = rect.x + (rect.w - cw) / 2 + rect.w * ox;
          var cy = rect.y + (rect.h - ch) / 2 + rect.h * oy;
          var gx = cx + cw * fx, gy = cy + ch * fy;
          var gw = cw * fw, gh = ch * fh;
          if (gw <= 0 || gh <= 0) continue;
          var cellW = gw / cells, cellH = gh / cells;

          var err = 0, ok = true;
          var pattern = [];
          var used = {};
          for (var i = 0; i < blobs.length; i++) {
            var u = (blobs[i].x - gx) / cellW;
            var v = (blobs[i].y - gy) / cellH;
            var col = Math.round(u - 0.5), row = Math.round(v - 0.5);
            if (row < 0 || col < 0 || row >= cells || col >= cells) { ok = false; break; }
            var du = Math.abs(u - (col + 0.5));
            var dv = Math.abs(v - (row + 0.5));
            if (du > SNAP_TOLERANCE || dv > SNAP_TOLERANCE) { ok = false; break; }
            var key = row + ',' + col;
            // Two stars cannot share a cell; that is a smudge or a
            // reflection, not a constellation.
            if (used[key]) { ok = false; break; }
            used[key] = 1;
            err += du * du + dv * dv;
            pattern.push([row, col]);
          }
          if (!ok) continue;
          if (!best || err < best.err) best = { err: err, pattern: pattern };
        }
      }
    }
    return best ? best.pattern : null;
  }

  function _key(pattern) {
    return pattern.map(function (p) { return p[0] + ',' + p[1]; }).sort().join(';');
  }

  // ---------------------------------------------------------------
  // The public read: one frame in, a pattern or null out.
  //
  // Exposed separately from the camera so it can be tested with a
  // still image and no hardware at all.
  // ---------------------------------------------------------------
  function readFrame(source, rect) {
    try {
      var c = document.createElement('canvas');
      var sw = source.videoWidth || source.naturalWidth || source.width;
      var sh = source.videoHeight || source.naturalHeight || source.height;
      if (!sw || !sh) return null;
      var h = Math.round(W * sh / sw);
      c.width = W; c.height = h;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(source, 0, 0, W, h);
      var img = x.getImageData(0, 0, W, h);
      var blobs = _blobs(img.data, W, h);
      if (blobs.length < MIN_STARS || blobs.length > MAX_STARS) return null;

      // The card's own grid first — a MEASUREMENT, and the only thing
      // that makes the answer unambiguous.
      //
      // This matters more than it looks. A card's pattern is placed at
      // a RANDOM offset on the grid (js/magicCard.js's
      // _placeConstellation), so the offset is part of the identity and
      // cannot be normalised away: a shape read without knowing where
      // the grid starts is a different child's sky. Hence a projection
      // over the region the stars occupy, expanded outward to take in
      // the grid's own border.
      var grid = _goldGrid(img.data, W, h, blobs);
      if (grid) {
        var byGrid = _readCells(blobs, grid);
        if (byGrid) return byGrid;
      }
      var cand = _candidates(img.data, W, h, blobs);
      if (cand && cand.length) return cand[0];
      // The guide-frame fit stays only as a last resort. It is a guess
      // where the above is a measurement, so it is deliberately second.
      var r = rect || _defaultRect(W, h);
      return _fit(blobs, r);
    } catch (e) { return null; }
  }

  // EVERY SKY THE FRAME COULD BE SHOWING.
  //
  // The measurements are honest about what this can and cannot pin
  // down. The grid's left edge and its width come out right — 25 and
  // 169 against a true 25 and 170 — because a vertical border is a
  // ridge running the full height of the grid. The horizontal phase
  // does not: gold text sits above and below the grid, the card's own
  // heading included, and a comb of eleven lines can lock onto the
  // wrong one of them.
  //
  // So this stops pretending to know, and returns every reading the
  // frame is consistent with — one per vertical phase where all the
  // stars land in cells. It is a handful, never a guess dressed up as
  // an answer.
  //
  // What resolves it is the recogniser, which is the right thing to do
  // it: only a REAL card's exact pattern belongs to a Creator, so a
  // wrong phase matches nobody and falls through. That also keeps
  // Traveller safety intact — a candidate list cannot invent a Creator
  // it does not already match exactly.
  function _candidates(data, w, h, blobs) {
    // THE STARS THEMSELVES SAY HOW BIG A CELL IS.
    //
    // Finding the printed grid worked on a clean rendering and fell
    // apart in a real room: photographed holding an actual card, the
    // stars were found every time and the grid never was, because a
    // projection across the whole frame is dominated by the window, the
    // desk and everything else in it. Requiring the grid meant the
    // reader could see a child's stars perfectly and still say it had
    // seen nothing.
    //
    // It does not need the grid. Every star sits at the centre of a
    // cell, so the gaps between stars are whole numbers of cells — and
    // a constellation spans at most nine of them. Trying each possible
    // span gives the cell size directly from the marks on the card,
    // with nothing in the room able to interfere.
    var cellList = _cellsFrom(blobs);
    if (!cellList) return null;

    var cells = _geometry().cells;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < blobs.length; i++) {
      if (blobs[i].x < minX) minX = blobs[i].x;
      if (blobs[i].y < minY) minY = blobs[i].y;
      if (blobs[i].x > maxX) maxX = blobs[i].x;
      if (blobs[i].y > maxY) maxY = blobs[i].y;
    }

    // Each lattice's own readings, kept apart so they can be
    // interleaved below.
    var perCell = [];
    for (var ci = 0; ci < cellList.length; ci++) {
      var cell = cellList[ci];
      var spanC = Math.round((maxX - minX) / cell);
      var spanR = Math.round((maxY - minY) / cell);
      if (spanC >= cells || spanR >= cells) continue;
      var mine = [];
      // Where the grid begins is still unknown — the stars cannot say
      // which cell they start in — so every placement that fits inside
      // a 10x10 grid is offered.
      for (var c0 = 0; c0 + spanC < cells; c0++) {
        for (var r0 = 0; r0 + spanR < cells; r0++) {
          var gx = minX - (c0 + 0.5) * cell;
          var gy = minY - (r0 + 0.5) * cell;
          var pattern = _readCells(blobs, { x: gx, y: gy, w: cell * cells, h: cell * cells });
          if (pattern) mine.push(pattern);
        }
      }
      if (mine.length) perCell.push(mine);
    }
    if (!perCell.length) return null;

    // ROUND-ROBIN, not one lattice then the next.
    //
    // A wrong lattice can produce far more placements than the right
    // one, and taking them in order let it fill the whole list before
    // the true sky was ever reached — CASSIOPEIA and CYGNUS both read
    // as nobody for exactly that reason. Giving each lattice its turn
    // means the true reading is always near the front, whichever
    // lattice it belongs to.
    var seen = {};
    var out = [];
    var depth = 0, added = true;
    while (added && out.length < 60) {
      added = false;
      for (var pi = 0; pi < perCell.length; pi++) {
        if (depth >= perCell[pi].length) continue;
        added = true;
        var cand = perCell[pi][depth];
        var k = _key(cand);
        if (seen[k]) continue;
        seen[k] = 1;
        out.push(cand);
        // Bounded: every candidate is a question the platform may be
        // asked, and a child is waiting while it is.
        if (out.length >= 60) break;
      }
      depth++;
    }
    return out.length ? out : null;
  }

  // EVERY CELL SIZE THE MARKS COULD BE SITTING ON.
  //
  // The stars cannot always settle this alone, and it is worth being
  // precise about why rather than picking one and hoping.
  //
  //   CASSIOPEIA sits at columns 1, 3, 5, 7, 9 — every gap TWO cells —
  //   so a cell twice the true size fits perfectly, with no error to
  //   tell it apart.
  //   CYGNUS's gaps are all THREE cells, so a cell three times too big
  //   fits, and so does one three quarters the true size.
  //
  // Whenever every gap shares a factor, several lattices fit the marks
  // exactly. Choosing the best-scoring one reads CASSIOPEIA wrong;
  // choosing the finest reads CYGNUS wrong. There is no rule over the
  // marks alone that gets both, because the information is not there.
  //
  // So each one that fits is offered, and the recogniser settles it —
  // the same way the unknown starting cell is settled. A lattice that
  // is not the card's own produces a sky belonging to nobody.
  function _cellsFrom(blobs) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < blobs.length; i++) {
      if (blobs[i].x < minX) minX = blobs[i].x;
      if (blobs[i].y < minY) minY = blobs[i].y;
      if (blobs[i].x > maxX) maxX = blobs[i].x;
      if (blobs[i].y > maxY) maxY = blobs[i].y;
    }
    var span = Math.max(maxX - minX, maxY - minY);
    if (span < 6) return null;

    var fits = [];
    var bestErr = Infinity;
    for (var sp = 1; sp <= 9; sp++) {
      var c = span / sp;
      if (c < 2.5) continue;
      var err = 0, n = 0;
      for (i = 0; i < blobs.length; i++) {
        var u = (blobs[i].x - minX) / c, v = (blobs[i].y - minY) / c;
        var du = u - Math.round(u), dv = v - Math.round(v);
        err += du * du + dv * dv;
        n += 2;
      }
      err = err / n;
      if (err < bestErr) bestErr = err;
      if (err < 0.018) fits.push({ cell: c, err: err, span: sp });
    }
    // Marks that are not on a grid at all — a hand, a face, a shelf of
    // things — line up with nothing, and are refused here rather than
    // turned into somebody's sky.
    if (!fits.length) return null;
    // Best-fitting first, so the likeliest reading is asked about
    // first and a child usually waits for one answer, not twenty.
    fits.sort(function (a, b) { return a.err - b.err; });
    return fits.map(function (f) { return f.cell; });
  }

  function _topFor(blobs, cell, whole, frac) {
    var minY = Infinity;
    for (var i = 0; i < blobs.length; i++) if (blobs[i].y < minY) minY = blobs[i].y;
    // Put the topmost star in row `whole`, then nudge.
    var top = minY - (whole + 0.5) * cell - frac * cell;
    if (!isFinite(top)) return null;
    return top;
  }

  // The grid's left edge and width, which the projection DOES resolve.
  function _columns(data, w, h, blobs) {
    var warm = new Float32Array(w * h);
    var i, x, y;
    for (i = 0; i < w * h; i++) {
      warm[i] = (data[i * 4] + data[i * 4 + 1]) / 2 - data[i * 4 + 2];
    }
    var base = 0;
    for (i = 0; i < w * h; i += 11) base += warm[i];
    base /= Math.ceil(w * h / 11);
    for (i = 0; i < blobs.length; i++) {
      var rad = Math.max(6, Math.sqrt(blobs[i].n) * 2.0);
      var bx0 = Math.max(0, (blobs[i].x - rad) | 0), bx1 = Math.min(w - 1, (blobs[i].x + rad) | 0);
      var by0 = Math.max(0, (blobs[i].y - rad) | 0), by1 = Math.min(h - 1, (blobs[i].y + rad) | 0);
      for (y = by0; y <= by1; y++) for (x = bx0; x <= bx1; x++) warm[y * w + x] = base;
    }
    var colSum = new Float32Array(w);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) colSum[x] += warm[y * w + x];
    var cols = _ridges(colSum);
    if (!cols || cols.length < 2) return null;
    var left = cols[0], right = cols[cols.length - 1];
    if (right - left < w * 0.15) return null;
    return { left: left, width: right - left };
  }

  function _bounds(blobs) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < blobs.length; i++) {
      if (blobs[i].x < minX) minX = blobs[i].x;
      if (blobs[i].x > maxX) maxX = blobs[i].x;
      if (blobs[i].y < minY) minY = blobs[i].y;
      if (blobs[i].y > maxY) maxY = blobs[i].y;
    }
    return {
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
      w: Math.max(8, maxX - minX), h: Math.max(8, maxY - minY)
    };
  }

  function _defaultRect(w, h) {
    var geo = _geometry();
    var aspect = geo.cardW / geo.cardH;
    var ch = h * 0.82;
    var cw = ch * aspect;
    if (cw > w * 0.9) { cw = w * 0.9; ch = cw / aspect; }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }

  // ---------------------------------------------------------------
  // The camera itself.
  //
  // scan() owns nothing visual — the caller builds the experience and
  // hands in a <video>. This module's whole job is "is there a Magic
  // Card in front of this camera, and whose is it".
  // ---------------------------------------------------------------
  // What the reader can see RIGHT NOW, in one pass.
  //
  // Split out because the camera has to be able to say something on
  // every frame. Reporting only a finished reading meant that holding a
  // card up and holding up nothing at all looked exactly the same — a
  // still picture and no sign of life — which is the one thing a child
  // waiting for magic should never get.
  function _analyse(source) {
    var c = document.createElement('canvas');
    var sw = source.videoWidth || source.naturalWidth || source.width;
    var sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return null;
    var hh = Math.round(W * sh / sw);
    c.width = W; c.height = hh;
    var xx = c.getContext('2d', { willReadFrequently: true });
    xx.drawImage(source, 0, 0, W, hh);
    var im = xx.getImageData(0, 0, W, hh);
    var bl = _blobs(im.data, W, hh);
    var res = { stars: bl.length, patterns: null };
    if (bl.length < MIN_STARS || bl.length > MAX_STARS) return res;
    var g = _goldGrid(im.data, W, hh, bl);
    var first = g ? _readCells(bl, g) : null;
    var list = _candidates(im.data, W, hh, bl) || [];
    if (first) {
      var fk = _key(first);
      list = list.filter(function (pp) { return _key(pp) !== fk; });
      list.unshift(first);
    }
    res.patterns = list.length ? list : null;
    return res;
  }

  function scan(video, opts) {
    opts = opts || {};
    var stopped = false;
    var lastKey = null;
    var agreed = 0;
    var busy = false;

    function tick() {
      if (stopped) return;
      if (!busy && video.readyState >= 2) {
        var look = _analyse(video);
        var pattern = (look && look.patterns) ? look.patterns[0] : null;
        // Said on every frame, so the camera is never a still picture:
        // 'nothing' / 'something' (bright marks, not a sky) / 'stars'
        // (a readable card). The caller turns these into words.
        if (typeof opts.onState === 'function') {
          try {
            opts.onState(!look ? 'nothing'
              : look.patterns ? 'stars'
              : look.stars > 0 ? 'something'
              : 'nothing', look ? look.stars : 0);
          } catch (e) {}
        }
        if (pattern) {
          var k = _key(pattern);
          if (k === lastKey) agreed++;
          else { lastKey = k; agreed = 1; }
          if (typeof opts.onSighting === 'function') {
            try { opts.onSighting(agreed / AGREE_FRAMES); } catch (e) {}
          }
          if (agreed >= AGREE_FRAMES) {
            // PAUSED, NOT STOPPED.
            //
            // A reading that turns out to belong to nobody is an
            // ordinary thing — a card at an angle, a light across it, a
            // hand half over it — and a child should not have to press
            // anything to be allowed another go. The caller looks at
            // this sky, and calls resume() to carry on looking.
            busy = true;
            if (typeof opts.onPattern === 'function') {
              try { opts.onPattern(pattern); } catch (e) {}
            }
            window.requestAnimationFrame(tick);
            return;
          }
        } else {
          lastKey = null;
          agreed = 0;
          if (typeof opts.onSighting === 'function') {
            try { opts.onSighting(0); } catch (e) {}
          }
        }
      }
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);

    return {
      stop: function () { stopped = true; },
      // Carry on looking, and forget what was just seen so the same
      // frame is not read as a fresh sighting a moment later.
      resume: function () {
        busy = false;
        lastKey = null;
        agreed = 0;
      }
    };
  }

  // Ask for the camera. Rear camera where there is one — a child holds
  // the card away from themselves, not beside their own face.
  function openCamera(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('no-camera'));
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false
    }).then(function (stream) {
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      video.muted = true;
      return video.play().catch(function () {}).then(function () { return stream; });
    });
  }

  function closeCamera(stream) {
    try {
      (stream ? stream.getTracks() : []).forEach(function (t) { t.stop(); });
    } catch (e) {}
  }

  var api = {
    // A testing seam, not part of the experience: it reports what the
    // reader SAW in a frame — the star blobs it found and the grid it
    // registered on — so a failure can be diagnosed as "no stars",
    // "no grid" or "wrong cells" instead of guessed at.
    inspect: function (source, rect) {
      try {
        var c = document.createElement('canvas');
        var sw = source.videoWidth || source.naturalWidth || source.width;
        var sh = source.videoHeight || source.naturalHeight || source.height;
        var hh = Math.round(W * sh / sw);
        c.width = W; c.height = hh;
        var xx = c.getContext('2d', { willReadFrequently: true });
        xx.drawImage(source, 0, 0, W, hh);
        var im = xx.getImageData(0, 0, W, hh);
        var bl = _blobs(im.data, W, hh);
        var gr = (bl.length >= MIN_STARS && bl.length <= MAX_STARS)
          ? _goldGrid(im.data, W, hh, bl) : null;
        return {
          size: [W, hh],
          blobs: bl.length,
          grid: gr,
          cells: gr ? _readCells(bl, gr) : null
        };
      } catch (e) { return { error: String(e) }; }
    },
    // Testing seam: the marks themselves, so a bad reading can be
    // diagnosed instead of guessed at.
    inspectBlobs: function (source) {
      try {
        var c = document.createElement('canvas');
        var sw = source.videoWidth || source.naturalWidth || source.width;
        var sh = source.videoHeight || source.naturalHeight || source.height;
        var hh = Math.round(W * sh / sw);
        c.width = W; c.height = hh;
        var xx = c.getContext('2d', { willReadFrequently: true });
        xx.drawImage(source, 0, 0, W, hh);
        var bl = _blobs(xx.getImageData(0, 0, W, hh).data, W, hh);
        return bl.map(function (b) {
          return { x: Math.round(b.x), y: Math.round(b.y), n: b.n };
        });
      } catch (e) { return String(e); }
    },
    readFrame: readFrame,
    // Every sky the frame is consistent with, best first. The caller
    // hands these to CreatorRecognition in turn — see _candidates.
    readCandidates: function (source, rect) {
      try {
        var look = _analyse(source);
        return (look && look.patterns) ? look.patterns : null;
      } catch (e) { return null; }
    },
    scan: scan,
    openCamera: openCamera,
    closeCamera: closeCamera,
    AGREE_FRAMES: AGREE_FRAMES
  };
  try { window.MagicCardVision = api; } catch (e) {}
  return api;
})();
