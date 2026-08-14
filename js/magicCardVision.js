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

    // THE CARD JOINS ITS STARS WITH A LINE.
    //
    // magicCardArt draws the constellation's own joining stroke through
    // every star, and a photograph of a real card shows it plainly. To
    // a connected-components pass that line is a bridge: all seven
    // stars become ONE blob, too big to be a star, and the reader sees
    // two marks where there are seven. Every earlier test drew the
    // stars WITHOUT the line, which is exactly why they passed while
    // the real card failed.
    //
    // One erosion pass separates them. A star is a solid mark whose
    // middle is surrounded on all sides; the joining stroke is thin, so
    // its pixels have neighbours along the line and empty space either
    // side. Keeping only pixels with a nearly full neighbourhood erases
    // the bridge and leaves the stars standing.
    var solid = new Uint8Array(w * h);
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        if (!bright[y * w + x]) continue;
        var around = 0;
        for (var ny = -1; ny <= 1; ny++) {
          for (var nx = -1; nx <= 1; nx++) {
            if (!nx && !ny) continue;
            if (bright[(y + ny) * w + (x + nx)]) around++;
          }
        }
        if (around >= 6) solid[y * w + x] = 1;
      }
    }
    // Erosion is tried, never imposed. A card small in the frame puts a
    // star into so few pixels that eroding it removes the star along
    // with the line — measured, a card at a third of the frame went
    // from seven marks to none. So both readings are taken and the one
    // that actually looks like a sky is kept, preferring the eroded
    // one, which is the only one that can separate joined stars.
    var plain = _marksIn(bright, w, h, lum);
    var eroded = _marksIn(solid, w, h, lum);
    if (eroded.length >= MIN_STARS && eroded.length <= MAX_STARS) return eroded;
    if (plain.length >= MIN_STARS && plain.length <= MAX_STARS) return plain;
    return eroded.length ? eroded : plain;
  }

  // Connected marks in a mask, filtered to things shaped like a star.
  function _marksIn(bright, w, h, lum) {

    var seen = new Uint8Array(w * h);
    var out = [];
    var stack = [];
    var x, y, i;
    for (i = 0; i < w * h; i++) {
      if (seen[i] || !bright[i]) continue;
      stack.length = 0;
      stack.push(i);
      seen[i] = 1;
      var n = 0, sx = 0, sy = 0, peak = 0;
      var minX = w, maxX = 0, minY = h, maxY = 0;
      while (stack.length) {
        var p = stack.pop();
        var px = p % w, py = (p / w) | 0;
        n++; sx += px; sy += py;
        if (lum && lum[p] > peak) peak = lum[p];
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
      out.push({ x: sx / n, y: sy / n, n: n, lit: peak });
    }
    out.sort(function (a2, b2) { return b2.n - a2.n; });

    // A CONSTELLATION IS THE BIGGEST GROUP OF MARKS THAT MATCH EACH
    // OTHER — not the biggest marks.
    //
    // The live readout from a real card settled this. It reported:
    //
    //     MARKS 4    sizes [205,143,105,72]
    //
    // on a card with SEVEN stars. Those four are not stars: at that
    // distance a star covers about ten pixels and they are all the same
    // size, while 205 against 72 is nothing of the sort. They were the
    // window, the wall and the bright clutter behind the hand.
    //
    // The previous rule — keep marks close in size to the LARGEST —
    // then did the damage. Anchored to a window, it kept the room and
    // discarded every real star for being too small. It only ever
    // looked right because in a rendered test the largest mark was
    // always a star.
    //
    // Stars come in a set of five to seven that match each other; a
    // room's bright patches are few and all different. So the group is
    // chosen by AGREEMENT rather than by size: whichever size has the
    // most marks near it wins, and ties go to the smaller, because a
    // card's stars are small and a room's windows are not.
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
    // NO SIZE FILTERING HERE ANY MORE.
    //
    // Choosing "the biggest group of marks that match each other" is
    // right for picking stars out of a room — and it deletes the
    // CORNER marks, which are deliberately a different size from the
    // stars. The two rules were undoing each other: raising the corner
    // marks so they could be told apart made this filter throw them
    // away, and the corner solve stopped running at all.
    //
    // So this reports everything it found and the choosing happens
    // downstream, where it is known whether stars or corners are
    // wanted. See _starLike().
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

  // Cells straight from the corners: they bound the grid, so the rest
  // is arithmetic. The marks that ARE the corners are dropped — they
  // are furniture, not stars.
  function _readByCorners(marks, corners) {
    var cells = _geometry().cells;
    var xs = corners.map(function (c) { return c.x; });
    var ys = corners.map(function (c) { return c.y; });
    var left = Math.min.apply(null, xs), right = Math.max.apply(null, xs);
    var top = Math.min.apply(null, ys), bottom = Math.max.apply(null, ys);
    var gw = right - left, gh = bottom - top;
    if (gw < 20 || gh < 20) return null;

    var stars = marks.filter(function (m) { return corners.indexOf(m) < 0; });
    if (stars.length < MIN_STARS || stars.length > MAX_STARS) return null;

    var cellW = gw / cells, cellH = gh / cells;
    var pattern = [], used = {};
    for (var i = 0; i < stars.length; i++) {
      var u = (stars[i].x - left) / cellW;
      var v = (stars[i].y - top) / cellH;
      var col = Math.round(u - 0.5), row = Math.round(v - 0.5);
      if (row < 0 || col < 0 || row >= cells || col >= cells) return null;
      if (Math.abs(u - (col + 0.5)) > SNAP_TOLERANCE) return null;
      if (Math.abs(v - (row + 0.5)) > SNAP_TOLERANCE) return null;
      var k = row + ',' + col;
      if (used[k]) return null;
      used[k] = 1;
      pattern.push([row, col]);
    }
    return pattern;
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
      // The corner solve wants everything; the lattice guesswork below
      // wants only the star-shaped set.
      var byFrame = _readByFrame(blobs, _frame(img.data, W, h));
      if (byFrame) return byFrame;
      blobs = _starLike(blobs);
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
    // A CARD IS NEVER HELD SQUARE.
    //
    // A photograph of a real one shows it a few degrees off, and a few
    // degrees is enough: over a span of seven cells, four degrees moves
    // the far star half a cell, past any sane tolerance. Every tilted
    // reading was refused while the marks themselves were found
    // perfectly — the reader could see the stars and could not place
    // them.
    //
    // The stars lie on a grid, so the directions between them cluster
    // around the grid's own axes. Folding every pair's angle into a
    // quarter turn makes both axes agree, and their middle is how far
    // the card is tilted. Undo that and the lattice is square again.
    var tilt = _tiltOf(blobs);
    var upright = tilt ? _spin(blobs, -tilt) : blobs;

    // AND A CARD IS NEVER FLAT-ON EITHER.
    //
    // A hand holding a card tips its top away from the camera, and that
    // is not a rotation: the rows lean while the columns stay put, so
    // undoing the turn leaves the lattice leaning. Two separate cell
    // sizes cannot describe it and a squarer fit does not exist.
    //
    // A small lean each way is tried, and the readings from all of them
    // are pooled. A wrong lean produces marks that sit on no lattice at
    // all and quietly contributes nothing, so this costs candidates
    // only when it is actually earning them.
    // Flat-on first, and ONLY if that finds nothing is a lean tried.
    //
    // Pooling every lean at once was worse than not trying: five sets
    // of readings crowded the true sky past the end of the list, and
    // CYGNUS and LYRA went from being found to being lost. A card held
    // reasonably flat is the ordinary case and should stay cheap; a
    // leaning one can afford the longer list, because the alternative
    // for it is nothing at all.
    var straight = _readOneWay(upright);
    if (straight && straight.length) return straight;

    var LEANS = [-0.06, 0.06, -0.12, 0.12];
    var pooled = [];
    for (var li = 0; li < LEANS.length; li++) {
      var got = _readOneWay(_lean(upright, LEANS[li]));
      if (got && got.length) pooled.push(got);
    }
    if (!pooled.length) return null;
    return _interleave(pooled, 120);
  }

  // A lean about the middle: every row slid sideways in proportion to
  // how far it is from centre. The inverse of a card tipped away.
  function _lean(blobs, k) {
    var cy = 0, i;
    for (i = 0; i < blobs.length; i++) cy += blobs[i].y;
    cy /= blobs.length;
    var out = [];
    for (i = 0; i < blobs.length; i++) {
      out.push({ x: blobs[i].x - k * (blobs[i].y - cy), y: blobs[i].y, n: blobs[i].n });
    }
    return out;
  }

  // Fair shares from several lists, best-first within each. A wrong
  // reading can produce far more placements than the right one, and
  // taking them in order let it fill the whole list before the true sky
  // was ever reached — CASSIOPEIA and CYGNUS both read as nobody for
  // exactly that reason.
  function _interleave(lists, limit) {
    var seen = {};
    var out = [];
    var depth = 0, added = true;
    while (added && out.length < limit) {
      added = false;
      for (var i = 0; i < lists.length; i++) {
        if (depth >= lists[i].length) continue;
        added = true;
        var cand = lists[i][depth];
        var k = _key(cand);
        if (seen[k]) continue;
        seen[k] = 1;
        out.push(cand);
        if (out.length >= limit) break;
      }
      depth++;
    }
    return out.length ? out : null;
  }

  function _readOneWay(blobs) {
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

    var perCell = [];
    for (var ci = 0; ci < cellList.length; ci++) {
      var cx = cellList[ci].cx, cy = cellList[ci].cy;
      var spanC = Math.round((maxX - minX) / cx);
      var spanR = Math.round((maxY - minY) / cy);
      if (spanC >= cells || spanR >= cells) continue;
      var mine = [];
      // Where the grid begins is still unknown — the stars cannot say
      // which cell they start in — so every placement that fits inside
      // a 10x10 grid is offered.
      for (var c0 = 0; c0 + spanC < cells; c0++) {
        for (var r0 = 0; r0 + spanR < cells; r0++) {
          var gx = minX - (c0 + 0.5) * cx;
          var gy = minY - (r0 + 0.5) * cy;
          var pattern = _readCells(blobs, { x: gx, y: gy, w: cx * cells, h: cy * cells });
          if (pattern) mine.push(pattern);
        }
      }
      if (mine.length) perCell.push(mine);
    }
    if (!perCell.length) return null;
    // Generous, because a candidate is cheap to check on the device
    // that holds the card and correctness matters more than the list's
    // length: CYGNUS and LYRA both sit deep in it, and a shorter list
    // simply lost them.
    return _interleave(perCell, 120);
  }

  // How far the card is turned, in radians. Pairs closer than a few
  // pixels are ignored — their direction is noise, not geometry.
  function _tiltOf(blobs) {
    var angles = [];
    for (var i = 0; i < blobs.length; i++) {
      for (var j = i + 1; j < blobs.length; j++) {
        var dx = blobs[j].x - blobs[i].x;
        var dy = blobs[j].y - blobs[i].y;
        if (Math.abs(dx) + Math.abs(dy) < 6) continue;
        var a = Math.atan2(dy, dx);
        // Into a quarter turn, so a horizontal pair and a vertical one
        // report the same tilt.
        var q = Math.PI / 2;
        a = a - Math.floor(a / q) * q;      // [0, 90°)
        if (a > q / 2) a -= q;              // (-45°, 45°]
        angles.push(a);
      }
    }
    if (angles.length < 3) return 0;
    angles.sort(function (p1, p2) { return p1 - p2; });
    var mid = angles[(angles.length / 2) | 0];
    // Only a HELD card, never a card lying at some arbitrary angle: a
    // large value here is far likelier to be marks that are not on a
    // grid at all, and correcting by it would invent a sky.
    if (Math.abs(mid) > 0.28) return 0;     // ~16 degrees
    return mid;
  }

  function _spin(blobs, rad) {
    var cx = 0, cy = 0, i;
    for (i = 0; i < blobs.length; i++) { cx += blobs[i].x; cy += blobs[i].y; }
    cx /= blobs.length; cy /= blobs.length;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var out = [];
    for (i = 0; i < blobs.length; i++) {
      var dx = blobs[i].x - cx, dy = blobs[i].y - cy;
      out.push({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos, n: blobs[i].n });
    }
    return out;
  }

  // EVERY LATTICE THE MARKS COULD BE SITTING ON.
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
  // Whenever every gap shares a factor, several lattices fit exactly.
  // Choosing the best-scoring one reads CASSIOPEIA wrong; choosing the
  // finest reads CYGNUS wrong. The information is not in the marks. So
  // each one that fits is offered and the recogniser settles it — a
  // lattice that is not the card's own belongs to nobody.
  //
  // THE TWO AXES ARE MEASURED SEPARATELY, which is what carries mild
  // perspective. A card held with its top tipped away is not square in
  // the picture: it is a little shorter down the page than across it,
  // and one shared cell size cannot describe both. Two can.
  function _cellsFrom(blobs) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < blobs.length; i++) {
      if (blobs[i].x < minX) minX = blobs[i].x;
      if (blobs[i].y < minY) minY = blobs[i].y;
      if (blobs[i].x > maxX) maxX = blobs[i].x;
      if (blobs[i].y > maxY) maxY = blobs[i].y;
    }
    var spanX = maxX - minX, spanY = maxY - minY;
    if (Math.max(spanX, spanY) < 6) return null;

    // How well a spacing explains one axis on its own.
    function axisErr(vals, min, c) {
      if (c < 2.5) return Infinity;
      var e = 0;
      for (var k = 0; k < vals.length; k++) {
        var u = (vals[k] - min) / c;
        var d = u - Math.round(u);
        e += d * d;
      }
      return e / vals.length;
    }
    var xs = [], ys = [];
    for (i = 0; i < blobs.length; i++) { xs.push(blobs[i].x); ys.push(blobs[i].y); }

    var okX = [], okY = [];
    for (var sx = 1; sx <= 9; sx++) {
      var cx = spanX / sx;
      // An axis the stars barely span says nothing about spacing, so
      // it is left to the other one.
      if (spanX < 6) { okX = [spanY / sx]; break; }
      if (axisErr(xs, minX, cx) < 0.02) okX.push(cx);
    }
    for (var sy = 1; sy <= 9; sy++) {
      var cy = spanY / sy;
      if (spanY < 6) { okY = [spanX / sy]; break; }
      if (axisErr(ys, minY, cy) < 0.02) okY.push(cy);
    }
    if (!okX.length || !okY.length) return null;

    // Pairs, nearest-square first: a card is square-ruled, so the
    // truest reading is usually the one whose two spacings agree.
    var pairs = [];
    for (i = 0; i < okX.length; i++) {
      for (var j = 0; j < okY.length; j++) {
        var r = okX[i] / okY[j];
        if (r < 0.62 || r > 1.6) continue;    // beyond any real tilt
        pairs.push({ cx: okX[i], cy: okY[j], skew: Math.abs(Math.log(r)) });
      }
    }
    if (!pairs.length) return null;
    pairs.sort(function (p1, p2) { return p1.skew - p2.skew; });
    return pairs;
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
    var res = { stars: bl.length, marks: bl, patterns: null };

    // THE FRAME'S READING BELONGS IN THE LIST.
    //
    // A real defect, and the one that kept a new machine from working
    // even when the card had been read correctly: the frame solve ran
    // inside readFrame and NOWHERE ELSE, so the list of readings handed
    // to the platform never contained it. Measured, the true sky was
    // absent from that list in all twenty cases — including the ones
    // where the reader had the right answer and simply never offered
    // it. It goes first, because when the frame is visible it is the
    // one reading that was solved rather than guessed.
    var solved = _readByFrame(bl, _frame(im.data, W, hh));
    var head = solved ? [solved] : [];

    // The stars, sorted out from the card's own furniture — the frame,
    // the numbering along it, the panels. Everything downstream wants
    // stars, not marks.
    var stars = _starLike(bl);
    if (stars.length < MIN_STARS || stars.length > MAX_STARS) {
      res.patterns = head.length ? head : null;
      return res;
    }
    var g = _goldGrid(im.data, W, hh, stars);
    var first = g ? _readCells(stars, g) : null;
    var list = _candidates(im.data, W, hh, stars) || [];
    if (first) {
      var fk = _key(first);
      list = list.filter(function (pp) { return _key(pp) !== fk; });
      list.unshift(first);
    }
    if (head.length) {
      var hk = _key(head[0]);
      list = list.filter(function (pp) { return _key(pp) !== hk; });
      list = head.concat(list);
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
        if (typeof opts.onFrame === 'function') { try { opts.onFrame(); } catch (e) {} }
        var look = _analyse(video);
        var pattern = (look && look.patterns) ? look.patterns[0] : null;
        // Said on every frame, so the camera is never a still picture:
        // 'nothing' / 'something' (bright marks, not a sky) / 'stars'
        // (a readable card). The caller turns these into words.
        // Every frame that has star-shaped marks in it is worth
        // offering to a shape match, which does not need a complete
        // reading — only the marks.
        if (look && look.marks && look.marks.length >= MIN_STARS &&
            typeof opts.onMarks === 'function') {
          try { opts.onMarks(look.marks); } catch (e) {}
        }
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

  // ---------------------------------------------------------------
  // WHOSE SKY IS THIS? — by SHAPE, not by grid coordinates.
  //
  // A better approach, and worth saying plainly why the earlier one was
  // not. Everything before this tried to rebuild the card's 10x10 grid
  // from a photograph and read the stars' absolute cells — and the
  // absolute cells are the hard part, because a pattern is placed at a
  // random offset, the printed grid is nearly invisible at analysis
  // size, and a lattice shifted by a whole cell fits exactly as well as
  // the true one. Every round of this sprint has been a different way
  // of guessing that offset, and each one worked in a rendering and
  // failed on a real card.
  //
  // But a Creator's sky does not need to be reconstructed. It needs to
  // be RECOGNISED, and the device usually already holds the answer: the
  // handful of cards claimed on it, each with its pattern. Deciding
  // which of a few known shapes a photograph looks like is a far easier
  // question than reading coordinates blind, and it is immune to
  // everything that has been breaking — where the grid starts, how big
  // a cell is, where the card sits in frame, how far away it is.
  //
  // Translation, scale and rotation are all normalised away. What is
  // left is the shape of the constellation itself.
  //
  // The grid-reading path above is KEPT, for the one case this cannot
  // serve: a brand-new machine, which holds no cards to compare
  // against and must ask the platform with an exact pattern.
  // THE FOUR CORNER MARKS, AND WHAT THEY SETTLE.
  //
  // The card now prints a solid white square just outside each corner
  // of the grid (js/magicCardArt.js). Four marks, and the whole
  // ambiguity this reader has been fighting disappears: they bound the
  // grid exactly, so a star's cell is arithmetic rather than a guess
  // among dozens of placements.
  //
  // They are told apart from stars by shape — a square is squarer than
  // a disc — and by position: they are the four outermost marks, one
  // toward each corner of the set.
  function _corners(marks) {
    if (marks.length < 8) return null;      // 4 corners + at least 4 stars
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < marks.length; i++) {
      if (marks[i].x < minX) minX = marks[i].x;
      if (marks[i].y < minY) minY = marks[i].y;
      if (marks[i].x > maxX) maxX = marks[i].x;
      if (marks[i].y > maxY) maxY = marks[i].y;
    }
    var picked = [];
    [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]].forEach(function (c) {
      var best = null, bestD = Infinity;
      for (var j = 0; j < marks.length; j++) {
        var dx = marks[j].x - c[0], dy = marks[j].y - c[1];
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = marks[j]; }
      }
      if (best && picked.indexOf(best) < 0) picked.push(best);
    });
    if (picked.length !== 4) return null;
    return picked;
  }

  // The marks that look like a constellation: whichever size has the
  // most marks near it. Stars come in fives and sevens that match each
  // other; a room's bright patches are few and all different, and a
  // card's corner marks are a set of exactly four that are bigger.
  function _starLike(marks) {
    if (marks.length < 2) return marks;

    // BRIGHTNESS BEFORE SIZE.
    //
    // The card's rows and columns are numbered now, and the numbers are
    // marks too — measured, a frame held to the camera reported
    // fourteen of them where there were seven stars, and the numbers
    // are numerous enough and alike enough that "the biggest group of
    // matching sizes" started choosing THEM.
    //
    // The stars are pure white and the numbering is gold at a little
    // over half opacity, so brightness separates them cleanly where
    // size cannot. Everything appreciably dimmer than the brightest
    // mark is furniture: numbers, the frame, the panels.
    var brightest = 0, i;
    for (i = 0; i < marks.length; i++) {
      if (marks[i].lit > brightest) brightest = marks[i].lit;
    }
    if (brightest > 0) {
      var lit = marks.filter(function (m) { return m.lit >= brightest * 0.82; });
      if (lit.length >= MIN_STARS) marks = lit;
    }
    var best = null;
    for (var i = 0; i < marks.length; i++) {
      var ref = marks[i].n;
      var group = marks.filter(function (b) { return b.n >= ref * 0.45 && b.n <= ref * 2.2; });
      if (!best || group.length > best.length ||
          (group.length === best.length && ref < best[0].n)) best = group;
    }
    return (best && best.length >= 2) ? best : marks;
  }

  // ---------------------------------------------------------------
  // FOUR CORNERS ARE A COMPLETE ANSWER.
  //
  // Everything before this inferred the lattice from the stars — where
  // the grid began, how big a cell was, how the card was turned and
  // tipped — and every one of those was a guess that a real photograph
  // could break. Four known points do not need inferring. They define
  // a projective transform outright, and a projective transform is
  // EXACTLY what a flat card photographed from an angle undergoes.
  //
  // So the corners are mapped to the unit square, the map is inverted,
  // and every star is put through it. Tilt, tip, distance and position
  // all come out in the wash because they are all the same
  // transformation, solved rather than searched for.
  //
  // The corner marks are the four largest marks on the card, which is
  // why the art draws them larger than the stars.
  // THE CHART'S FRAME IS THE REGISTRATION MARK.
  //
  // The card no longer carries four white squares — they did the job
  // and looked like hardware bolted to a keepsake. It carries a ruled
  // frame around the grid instead, the way a star chart is bordered,
  // and for the reader that is strictly better: four separate marks had
  // to be found among the card's other bright furniture and then
  // matched up, where a frame is ONE continuous shape that encloses
  // everything else. Its corners are the corners of the largest hollow
  // bright thing in the picture.
  //
  // Hollow is what tells it from a panel or a window: a frame's own
  // pixels are a small fraction of the area it encloses.
  function _frame(data, w, h) {
    var lum = new Float32Array(w * h);
    var i, x, y;
    for (i = 0; i < w * h; i++) {
      lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
    }
    // Locally bright, same reasoning as the stars: a card in a bright
    // room is dark, and its frame is bright only against the card.
    var integral = new Float64Array((w + 1) * (h + 1));
    for (y = 0; y < h; y++) {
      var row = 0;
      for (x = 0; x < w; x++) {
        row += lum[y * w + x];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + row;
      }
    }
    function mean(x0, y0, x1, y1) {
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
      var n = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (n <= 0) return 0;
      return (integral[(y1 + 1) * (w + 1) + (x1 + 1)]
            - integral[y0 * (w + 1) + (x1 + 1)]
            - integral[(y1 + 1) * (w + 1) + x0]
            + integral[y0 * (w + 1) + x0]) / n;
    }
    var rad = Math.max(6, Math.round(w / 14));
    var on = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var v = lum[y * w + x];
        var m = mean(x - rad, y - rad, x + rad, y + rad);
        if (v > m * 1.25 && v - m > 0.035) on[y * w + x] = 1;
      }
    }

    // The largest connected bright thing that is mostly empty inside.
    var seen = new Uint8Array(w * h);
    var stack = [];
    var best = null;
    for (i = 0; i < w * h; i++) {
      if (seen[i] || !on[i]) continue;
      stack.length = 0; stack.push(i); seen[i] = 1;
      var n = 0, minX = w, maxX = 0, minY = h, maxY = 0;
      // THE FRAME'S TRUE CORNERS, not its bounding box.
      //
      // A tilted card's frame has a bounding box whose corners are
      // nowhere near the frame's own — which is why every tilted card
      // read exactly right when flat and wrong the moment it turned.
      // The extremes of x+y and x-y find the real corners at any angle.
      var tl = Infinity, br = -Infinity, tr = -Infinity, bl = Infinity;
      var pTL = null, pBR = null, pTR = null, pBL = null;
      while (stack.length) {
        var p = stack.pop();
        var px = p % w, py = (p / w) | 0;
        var sum = px + py, dif = px - py;
        if (sum < tl) { tl = sum; pTL = { x: px, y: py }; }
        if (sum > br) { br = sum; pBR = { x: px, y: py }; }
        if (dif > tr) { tr = dif; pTR = { x: px, y: py }; }
        if (dif < bl) { bl = dif; pBL = { x: px, y: py }; }
        n++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var qx = px + dx, qy = py + dy;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            var q = qy * w + qx;
            if (seen[q] || !on[q]) continue;
            seen[q] = 1; stack.push(q);
          }
        }
      }
      var bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (bw < w * 0.16 || bh < h * 0.16) continue;      // too small to be the chart
      var area = bw * bh;
      if (n > area * 0.42) continue;                      // solid: a panel, not a frame
      var ratio = bw / bh;
      if (ratio < 0.55 || ratio > 1.85) continue;         // the grid is square
      if (!best || area > best.area) {
        best = { area: area, corners: [pTL, pTR, pBR, pBL] };
      }
    }
    if (!best || !best.corners[0]) return null;
    // In the order the transform expects: TL, TR, BR, BL.
    return best.corners;
  }

  // The homography taking the unit square to the four corners, solved
  // as a plain 8x8 system, then inverted so a point in the picture can
  // be asked where it sits on the card.
  function _homography(q) {
    var x0 = q[0].x, y0 = q[0].y, x1 = q[1].x, y1 = q[1].y;
    var x2 = q[2].x, y2 = q[2].y, x3 = q[3].x, y3 = q[3].y;
    var dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
    var dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dx2 * dy1;
    if (!den) return null;
    var g = (sx * dy2 - dx2 * sy) / den;
    var h = (dx1 * sy - sx * dy1) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
    var d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    // Inverse of [[a,b,c],[d,e,f],[g,h,1]], by adjugate.
    var A = e - f * h, B = c * h - b, C = b * f - c * e;
    var D = f * g - d, E = a - c * g, F = c * d - a * f;
    var G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
    return function (px, py) {
      var w = G * px + H * py + I;
      if (!w) return null;
      return { u: (A * px + B * py + C) / w, v: (D * px + E * py + F) / w };
    };
  }

  // A card's cells, read exactly, from the chart's own frame.
  function _readByFrame(marks, frame) {
    if (!frame) return null;
    var inv = _homography(frame);
    if (!inv) return null;
    var stars = _starLike(marks);
    if (stars.length < MIN_STARS || stars.length > MAX_STARS) return null;

    var cells = _geometry().cells;
    var pattern = [], used = {};
    for (var i = 0; i < stars.length; i++) {
      var p = inv(stars[i].x, stars[i].y);
      if (!p) return null;
      var u = p.u * cells, v = p.v * cells;
      var col = Math.round(u - 0.5), row = Math.round(v - 0.5);
      if (row < 0 || col < 0 || row >= cells || col >= cells) return null;
      if (Math.abs(u - (col + 0.5)) > SNAP_TOLERANCE) return null;
      if (Math.abs(v - (row + 0.5)) > SNAP_TOLERANCE) return null;
      var k = row + ',' + col;
      if (used[k]) return null;
      used[k] = 1;
      pattern.push([row, col]);
    }
    return pattern;
  }

  function identify(source, cards) {
    if (!cards || !cards.length) return null;
    var look = _analyse(source);
    if (!look || !look.marks || look.marks.length < MIN_STARS) return null;

    // THE CORNER MARKS ARE NOT STARS.
    //
    // The card prints four of them to bound the grid, and the detector
    // finds them exactly as it finds a star — so a five-star sky
    // arrives here as NINE marks and matches nothing. Tested against
    // the real card art, every tilted card reported 8 to 11 marks for
    // a 5 to 7 star sky the moment the corners were added. They are
    // taken out before the shape is compared.
    var marks = _starLike(look.marks);
    if (marks.length < MIN_STARS) return null;

    // The tilt estimate is a guess made from a handful of points, and a
    // constellation with three stars in a row can pull it several
    // degrees out — ORION did exactly that, found all seven of its
    // marks and still matched nothing. So a few angles around the
    // estimate are tried and the best is kept: cheap, and it removes
    // the estimate's accuracy from the answer.
    var est = _tiltOf(marks);
    var tries = [];
    for (var t = -3; t <= 3; t++) {
      tries.push(_normalise(_spin(marks, -(est + t * 0.035))));   // ±6°, in 2° steps
    }

    var best = null;
    for (var i = 0; i < cards.length; i++) {
      var pat = cards[i] && cards[i].pattern;
      if (!pat || pat.length !== marks.length) continue;   // a sky has as many stars as it has
      var pts = pat.map(function (p) { return { x: p[1], y: p[0], n: 1 }; });
      var want = _normalise(pts);
      if (!want) continue;
      for (var k = 0; k < tries.length; k++) {
        if (!tries[k]) continue;
        var cost = _shapeCost(tries[k], want);
        if (best === null || cost < best.cost) best = { card: cards[i], cost: cost };
      }
    }
    // Far enough apart that a different constellation cannot pass, and
    // loose enough that a hand-held card does. Star positions after
    // normalising are around a unit apart, so this is a fifth of the
    // distance between neighbouring stars.
    if (!best || best.cost > 0.2) return null;
    return best;
  }

  // Centre on the middle, scale so the spread is one. Removes where the
  // card is and how big it looks, leaving only its shape.
  function _normalise(pts) {
    if (!pts || pts.length < 2) return null;
    var cx = 0, cy = 0, i;
    for (i = 0; i < pts.length; i++) { cx += pts[i].x; cy += pts[i].y; }
    cx /= pts.length; cy /= pts.length;
    var rms = 0;
    for (i = 0; i < pts.length; i++) {
      var dx = pts[i].x - cx, dy = pts[i].y - cy;
      rms += dx * dx + dy * dy;
    }
    rms = Math.sqrt(rms / pts.length);
    if (rms < 1e-6) return null;
    var out = [];
    for (i = 0; i < pts.length; i++) {
      out.push({ x: (pts[i].x - cx) / rms, y: (pts[i].y - cy) / rms });
    }
    return out;
  }

  // How unlike two skies are: every star's distance to the nearest star
  // in the other, both ways round, averaged. Both directions matter —
  // one alone would let several stars pile onto one and call it a
  // match.
  function _shapeCost(a, b) {
    return (_oneWay(a, b) + _oneWay(b, a)) / 2;
  }

  function _oneWay(from, to) {
    var total = 0;
    for (var i = 0; i < from.length; i++) {
      var best = Infinity;
      for (var j = 0; j < to.length; j++) {
        var dx = from[i].x - to[j].x, dy = from[i].y - to[j].y;
        var d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      total += Math.sqrt(best);
    }
    return total / from.length;
  }

  // What the detector sees in a frame, in numbers. Used by the live
  // check below — see js/vihuplanetHome.js's ?cardcheck=1.
  function look(source) {
    try {
      var c = document.createElement('canvas');
      var sw = source.videoWidth || source.naturalWidth || source.width;
      var sh = source.videoHeight || source.naturalHeight || source.height;
      if (!sw || !sh) return null;
      var hh = Math.round(W * sh / sw);
      c.width = W; c.height = hh;
      var xx = c.getContext('2d', { willReadFrequently: true });
      xx.drawImage(source, 0, 0, W, hh);
      var d = xx.getImageData(0, 0, W, hh);
      var bl = _blobs(d.data, W, hh);
      // How bright the frame is overall, and how bright its brightest
      // parts are — the two numbers that decide whether a star clears
      // the local threshold at all.
      var sum = 0, max = 0;
      for (var i = 0; i < W * hh; i++) {
        var v = (d.data[i * 4] * 0.299 + d.data[i * 4 + 1] * 0.587 + d.data[i * 4 + 2] * 0.114) / 255;
        sum += v; if (v > max) max = v;
      }
      return {
        size: W + 'x' + hh,
        marks: bl.length,
        sizes: bl.slice(0, 10).map(function (b) { return b.n; }),
        frameMean: Math.round(sum / (W * hh) * 100) / 100,
        frameMax: Math.round(max * 100) / 100
      };
    } catch (e) { return { error: String(e) }; }
  }

  var api = {
    identify: identify,
    look: look,
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
    // Testing seam: what the corner solve made of a frame.
    quadOf: function (source) {
      try {
        var c = document.createElement('canvas');
        var sw = source.videoWidth || source.naturalWidth || source.width;
        var sh = source.videoHeight || source.naturalHeight || source.height;
        var hh = Math.round(W * sh / sw);
        c.width = W; c.height = hh;
        var xx = c.getContext('2d', { willReadFrequently: true });
        xx.drawImage(source, 0, 0, W, hh);
        var bl = _blobs(xx.getImageData(0, 0, W, hh).data, W, hh);
        var sorted = bl.slice().sort(function (a, b) { return b.n - a.n; });
        var q = _quad(bl);
        return {
          marks: bl.length,
          sizes: sorted.map(function (b) { return b.n; }),
          quad: q ? { stars: q.stars.length } : null,
          read: q ? (_readByQuad(bl) ? 'read' : 'quad ok, cells refused') : 'no quad'
        };
      } catch (e) { return { error: String(e) }; }
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
