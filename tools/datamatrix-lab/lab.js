// lab.js — Magic Card hidden-identity experiment.
//
// A LABORATORY, NOT A FEATURE. Nothing here is imported by VihuPlanet
// and nothing here reads or writes a real Creator. The star grid, the
// constellation shapes and the sky palette are re-stated locally on
// purpose: borrowing them from js/magicCard.js would couple an
// experiment to the identity system it is not allowed to touch, and
// the whole point is that this can be deleted without trace.
//
// The question being answered is narrow: can a Data Matrix be hidden
// under a constellation and still be read by an ordinary camera?
//
// ---------------------------------------------------------------
// WHAT IS AND IS NOT HAND-WRITTEN
//
// The Data Matrix itself is not touched by this file. Encoding is
// bwip-js (MIT, 4.5.1) and decoding is @zxing/library (MIT, 0.21.3),
// both vendored into vendor/ so the lab has no CDN dependency and runs
// offline. No OpenCV, no ML, no cloud vision, no hand-rolled decoder.
//
// What IS written here is the camouflage: where the matrix sits, how
// faint it is, what is drawn over it. That is the experiment.
const Lab = (function () {
  'use strict';

  var GRID = 10;

  // Simplified shapes, local to the lab. Deliberately a COPY — see the
  // header. If the real library changes, this does not, and neither
  // cares.
  var SHAPES = {
    LYRA:            [[2,5],[5,3],[5,7],[7,3],[7,7]],
    ORION:           [[1,2],[1,7],[4,4],[4,5],[4,6],[8,2],[8,7]],
    CASSIOPEIA:      [[2,1],[4,3],[2,5],[4,7],[2,9]],
    CYGNUS:          [[1,5],[4,5],[4,2],[7,5],[4,8]],
    CRUX:            [[0,3],[3,0],[6,2],[3,5]],
    TRIANGULUM:      [[0,2],[2,0],[2,3]],
    GEMINI:          [[0,0],[1,1],[2,1],[3,0],[3,4],[2,4],[1,3],[0,3]],
    LEO:             [[0,3],[0,4],[1,5],[2,5],[3,4],[3,1],[4,0]],
    DELPHINUS:       [[0,1],[1,0],[2,1],[1,2],[4,2]],
    CORONA_BOREALIS: [[3,0],[1,1],[0,2],[0,4],[1,5],[2,6]]
  };
  var FAMILIES = Object.keys(SHAPES);

  // Deterministic placement, so TEST-0007 is the same card every time
  // it is generated — a card that changed between runs could not be
  // printed and then tested.
  function seeded(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function place(id, family) {
    var rand = seeded(id);
    var base = SHAPES[family] || SHAPES.LYRA;
    var minR = Math.min.apply(null, base.map(function (p) { return p[0]; }));
    var minC = Math.min.apply(null, base.map(function (p) { return p[1]; }));
    var pts = base.map(function (p) { return [p[0] - minR, p[1] - minC]; });
    var turns = Math.floor(rand() * 4);
    for (var t = 0; t < turns; t++) {
      var maxR = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
      pts = pts.map(function (p) { return [p[1], maxR - p[0]]; });
    }
    if (rand() < 0.5) {
      var maxC = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
      pts = pts.map(function (p) { return [p[0], maxC - p[1]]; });
    }
    var mR = Math.min.apply(null, pts.map(function (p) { return p[0]; }));
    var mC = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    pts = pts.map(function (p) { return [p[0] - mR, p[1] - mC]; });
    var hR = Math.max.apply(null, pts.map(function (p) { return p[0]; })) + 1;
    var wC = Math.max.apply(null, pts.map(function (p) { return p[1]; })) + 1;
    var offR = Math.floor(rand() * (GRID - hR + 1));
    var offC = Math.floor(rand() * (GRID - wC + 1));
    return pts.map(function (p) { return [p[0] + offR, p[1] + offC]; });
  }

  function familyFor(id) {
    var rand = seeded(id + ':family');
    return FAMILIES[Math.floor(rand() * FAMILIES.length)];
  }

  // ---------------------------------------------------------------
  // THE DATA MATRIX, from bwip-js.
  //
  // Rendered once at its natural module size into an offscreen canvas,
  // then read back as a boolean grid. Working in MODULES rather than
  // pixels is what lets every camouflage strategy scale the matrix to
  // the card without ever resampling a barcode — a resampled matrix
  // with soft edges is a different experiment.
  function matrixModules(text) {
    var tmp = document.createElement('canvas');
    window.bwipjs.toCanvas(tmp, {
      bcid: 'datamatrix',
      text: text,
      scale: 1,
      padding: 0,
      backgroundcolor: 'FFFFFF'
    });
    var w = tmp.width, h = tmp.height;
    var d = tmp.getContext('2d').getImageData(0, 0, w, h).data;
    var g = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push(d[(y * w + x) * 4] < 128 ? 1 : 0);
      g.push(row);
    }
    return { grid: g, size: w, height: h };
  }

  // ---------------------------------------------------------------
  // THE CARD.
  //
  // opts:
  //   id, family, strategy, matrixOpacity, matrixContrast,
  //   starSize, starBright, skyBright, showMatrix, showStars, showSky,
  //   showLines, quiet (no framing text — the print-ready version)
  function draw(canvas, opts) {
    opts = opts || {};
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var id = opts.id || 'TEST-0001';
    var family = opts.family || familyFor(id);
    var stars = opts.stars || place(id, family);
    var strategy = opts.strategy || 'A';
    var sky = opts.skyBright == null ? 0.10 : opts.skyBright;

    ctx.clearRect(0, 0, W, H);

    // ---- the sky ----
    if (opts.showSky !== false) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      var top = Math.round(18 + sky * 90), bot = Math.round(6 + sky * 40);
      g.addColorStop(0, 'rgb(' + Math.round(top * 0.7) + ',' + Math.round(top * 0.8) + ',' + top + ')');
      g.addColorStop(1, 'rgb(' + Math.round(bot * 0.7) + ',' + Math.round(bot * 0.8) + ',' + bot + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }

    // The chart square: the matrix and the constellation share it, so
    // the matrix is never somewhere the stars are not.
    var pad = Math.round(W * 0.10);
    var box = W - pad * 2;
    var cell = box / GRID;

    // ---- the data matrix ----
    //
    // WHAT THE DECODER ACTUALLY NEEDS, measured rather than assumed.
    // The first version of this drew the modules edge-to-edge on the
    // sky and faded them with globalAlpha, and NOTHING decoded — 0% on
    // every strategy at every setting. Isolating it stage by stage gave
    // three separate constraints, and they shape every strategy below:
    //
    //   1. A QUIET ZONE IS NOT OPTIONAL. A Data Matrix needs a clear
    //      margin. With sky right up against the modules, zxing never
    //      finds the finder pattern. Two modules is enough; none is
    //      hopeless.
    //
    //   2. OPACITY IS THE WRONG KNOB. globalAlpha over a dark sky drags
    //      the LIGHT modules dark, which destroys the light/dark
    //      polarity the whole symbol is made of. A quiet zone plus 0.6
    //      opacity still read nothing.
    //
    //   3. CONTRAST COMPRESSION IS THE RIGHT KNOB. Dark #3a on light
    //      #c8 decodes cleanly. So camouflage should bring the two
    //      tones TOWARD each other — and toward the sky — while
    //      keeping the darker one darker. That is a real dimension with
    //      a real limit, which is what this experiment is for.
    //
    // So `presence` is how far apart the two tones are, and `sink` is
    // how far the pair sits toward the sky. Polarity is never inverted.
    var mod = null;
    if (opts.showMatrix !== false) {
      mod = matrixModules(id);
      var mSize = mod.size;
      var quietMods = 2;
      var mCell = box / (mSize + quietMods * 2);
      var mLeft = pad, mTop = pad;

      var presence = opts.matrixOpacity == null ? 0.5 : opts.matrixOpacity;
      var contrast = opts.matrixContrast == null ? 0.6 : opts.matrixContrast;

      // The sky's own luminance at the chart, so "sink" has something
      // to sink toward.
      var skyLum = Math.round(10 + sky * 60);

      // delta is the light/dark separation actually painted. The
      // experiment's headline number is the smallest delta that still
      // decodes.
      var delta = Math.round(30 + presence * 200);
      var sink  = (strategy === 'D' || strategy === 'E') ? 0.75 : (strategy === 'C' ? 0.35 : 0);
      var mid   = Math.round(skyLum * sink + (128 * (1 - sink)) * 1 + (1 - sink) * 20 * contrast);

      var loV = Math.max(0, Math.round(mid - delta / 2));
      var hiV = Math.min(255, Math.round(mid + delta / 2));

      function tone(v) {
        // Tinted toward the sky's blue so the block reads as a patch of
        // sky rather than a grey sticker.
        return 'rgb(' + Math.round(v * 0.74) + ',' + Math.round(v * 0.84) + ',' + v + ')';
      }

      ctx.save();
      // THE QUIET ZONE, painted in the light tone. It is a rectangle,
      // and it is the single most visible part of this whole idea —
      // which is itself a finding: a Data Matrix cannot be hidden
      // without hiding a light rectangle around it.
      ctx.fillStyle = tone(hiV);
      ctx.fillRect(mLeft, mTop, box, box);

      for (var y = 0; y < mod.grid.length; y++) {
        for (var x = 0; x < mod.grid[y].length; x++) {
          if (!mod.grid[y][x]) continue;          // light modules are the field
          ctx.fillStyle = tone(loV);
          ctx.fillRect(mLeft + (x + quietMods) * mCell, mTop + (y + quietMods) * mCell,
                       Math.ceil(mCell) + 0.5, Math.ceil(mCell) + 0.5);
        }
      }
      ctx.restore();
      mod.delta = delta;
      mod.lo = loV;
      mod.hi = hiV;
    }

    // ---- the constellation ----
    if (opts.showStars !== false) {
      var pts = stars.map(function (p) {
        return { x: pad + (p[1] + 0.5) * cell, y: pad + (p[0] + 0.5) * cell };
      });
      var r = (opts.starSize == null ? 0.30 : opts.starSize) * cell;
      var bright = opts.starBright == null ? 1 : opts.starBright;

      if (opts.showLines !== false && pts.length > 1) {
        ctx.strokeStyle = 'rgba(255,214,128,' + (0.35 * bright) + ')';
        ctx.lineWidth = Math.max(1, cell * 0.035);
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.stroke();
      }

      // STRATEGY B — STAR OVERLAY.
      //
      // Halos painted in the sky colour over the matrix, so the stars
      // sit in their own clearings. Deliberately destructive: it is
      // testing how much of a Data Matrix can be obliterated before
      // Reed-Solomon gives up, which is the most interesting number in
      // this whole experiment.
      if (strategy === 'B' || strategy === 'E') {
        ctx.save();
        pts.forEach(function (p) {
          var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
          halo.addColorStop(0, 'rgba(10,14,28,1)');
          halo.addColorStop(1, 'rgba(10,14,28,0)');
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.4, 0, 7); ctx.fill();
        });
        ctx.restore();
      }

      function star(cx, cy, outer) {
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
          var rr = (i % 2 === 0) ? outer : outer * 0.5;
          var a = -Math.PI / 2 + i * Math.PI / 5;
          var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      pts.forEach(function (p) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,214,128,' + (0.9 * bright) + ')';
        ctx.shadowBlur = r * 0.9;
        ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, bright) + ')';
        star(p.x, p.y, r);
        ctx.fill();
        ctx.restore();
      });
    }

    // ---- framing ----
    if (!opts.quiet) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,203,69,0.55)';
      ctx.lineWidth = Math.max(2, W * 0.006);
      ctx.strokeRect(W * 0.03, H * 0.03, W * 0.94, H * 0.94);
      ctx.fillStyle = 'rgba(255,246,221,0.85)';
      ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(W * 0.045) + 'px Georgia, serif';
      ctx.fillText('✦ ' + family.replace('_', ' ') + ' ✦', W / 2, H - pad * 0.45);
      ctx.restore();
    }

    return { id: id, family: family, stars: stars, modules: mod ? mod.size : 0,
             delta: mod ? mod.delta : 0, lo: mod ? mod.lo : 0, hi: mod ? mod.hi : 0 };
  }

  return {
    GRID: GRID,
    FAMILIES: FAMILIES,
    place: place,
    familyFor: familyFor,
    draw: draw,
    matrixModules: matrixModules,
    ids: function (n) {
      var out = [];
      for (var i = 1; i <= (n || 20); i++) {
        out.push('TEST-' + String(i).padStart(4, '0'));
      }
      return out;
    }
  };
})();
