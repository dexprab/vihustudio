/* HW LIVE WORKER — the free-motion loop's reading thread.
 *
 * The page (js/hwLive.js) grabs a preview frame and posts its pixels
 * here; this worker runs hwRead's whole mark/pair/DP machinery and
 * posts the verdict back. The page's main thread therefore never runs
 * an analysis at all — the field freeze ("as soon as camera opened the
 * entire page got stuck") was hwRead grinding a real room scene for
 * MEASURED 12.4 seconds a frame on the main thread (a noisy scene
 * keeps the candidate-mark list at its 400 cap, and the anchor pair
 * search over it is combinatorial: findLadder alone measured 3.6s).
 *
 * THE SEAM: hwSheet.js, segment.js and hwRead.js are DOM-free —
 * geometry constants, typed-array pixel work, and alignment — so they
 * are loaded here verbatim with importScripts (window := the worker
 * global). The ONE DOM dependency hwRead had was BIAClaim.claim, used
 * for exactly one thing: rasterising the full-frame rectangle every
 * frame analysis claims. claim.js's canvas rasteriser exists for the
 * self-crossing loops a child actually draws; a full-frame rectangle
 * needs no rasteriser, so this worker provides the arithmetic
 * stand-in, VERIFIED pixel-identical to the canvas fill it replaces
 * (probed at 1280×960, 640×360 and 37×29: zero differing pixels, same
 * area, same bbox). claim.js itself stays on the page, untouched, for
 * the drawing journey.
 *
 * BUDGETS — refuse-not-grind. Skipping a live frame is invisible (the
 * slot just doesn't tick yet; the next frame is 500ms away), so every
 * bound refuses rather than grinds. All numbers measured:
 *
 *   1. PREPASS on a ~430px-wide downscale (area-average): segment +
 *      candidate marks cost ~25ms there. A scene with more than
 *      PRE.MARK_CAP candidate marks is not a sheet in view — the
 *      noisy room measures 307–331 marks at this scale, the whole
 *      sheet 182, a close-up line ≤ 53 — and is skipped for ~25ms
 *      instead of 12 seconds. No sheet-shaped pair at all → 'nothing'
 *      for the same ~25ms.
 *   2. Only when the prepass sees the sheet does full resolution run:
 *      the downscaled ladder (whole sheet in frame, measured 36ms)
 *      opens the full-frame read; candidate pairs open a read of THE
 *      REGION THEY IMPLY — the rows their own geometry says the model
 *      text, the writing zone and the descenders occupy (full width:
 *      x is the identity evidence and the mislabel contract, so it is
 *      never touched). A band that would cover most of the frame
 *      anyway reads the whole frame.
 *   3. TIME-BOX: the whole per-frame analysis, prepass included, gets
 *      PRE.BUDGET_MS. hwRead checks the deadline at its loop
 *      boundaries (and caps the two combinatorial searches — see
 *      LIVE_SEED_PAIRS / LIVE_PAIR_COMBOS in hwRead.js); overrun
 *      answers 'nothing' and the frame is skipped. The heaviest
 *      honest frame (the whole sheet registering) measures ~350ms, so
 *      1000ms is ~3× headroom, while the pathological room frame is
 *      cut ~12× earlier than it used to finish.
 *
 * Collection semantics are unchanged: the same hwRead, the same
 * witnesses, the same gates, the same refuse-rather-than-guess. Only
 * WHERE the work runs (here) and HOW BOUNDED it is (above) changed.
 *
 * The verdict posted back is plain data: the rule fits lose their
 * yAt() closure (nothing downstream calls it — hwApp and hwFont read
 * only the letters, samples and gap lists) and, when the read ran on
 * a cropped band, every absolute y is shifted back into frame
 * coordinates so the verdict cannot tell it was cropped.
 */
'use strict';

self.window = self;   // the modules attach their exports to `window`
importScripts('hwSheet.js', 'segment.js', 'hwRead.js');

const PRE = {
  TARGET_W: 480,    // prepass width — ÷3 at 1280 (426px), ~1/9 the pixels
  MARK_CAP: 250,    // candidate marks at prepass scale; over → not a sheet
                    //   (measured: noisy room 307–331 · whole sheet 182 ·
                    //    close-up lines ≤ 53 · unwritten line 21)
  BUDGET_MS: 1000,  // per-frame time box, prepass + full pass together
  BAND_ABOVE: 0.20, // full-res band above a candidate rule (× its own
                    //   implied page height) — the model line tops out at
                    //   0.124×H above the rule, the writing ascent at 0.082
  BAND_BELOW: 0.10, // …and below: descent is 0.034×H
  BAND_WHOLE: 0.85  // a band covering ≥ this of the frame reads the frame
};

/* The full-frame rectangle claim, arithmetically — the DOM-free
 * stand-in for the one BIAClaim.claim call hwRead makes. Coverage>0.5
 * of the even-odd fill of [1,1]-[w-2,h-2] is exactly x ∈ [1, w-3],
 * y ∈ [1, h-3]; verified pixel-identical to the canvas fill. */
self.BIAClaim = {
  claim(region, width, height) {
    const inside = new Uint8Array(width * height);
    for (let y = 1; y <= height - 3; y++) inside.fill(1, y * width + 1, y * width + width - 2);
    return {
      points: region.map((p) => [Math.round(p[0]), Math.round(p[1])]),
      inside,
      area: (width - 3) * (height - 3),
      bbox: { x: 1, y: 1, w: width - 3, h: height - 3 }
    };
  }
};

// Area-average downscale by an integer factor — honest darkness (a
// dark speck dims its cell instead of vanishing), no canvas involved.
function downscale(photo, targetW) {
  const W = photo.width, H = photo.height;
  const k = Math.max(1, Math.round(W / targetW));
  if (k === 1) return { photo, k };
  const w = Math.floor(W / k), h = Math.floor(H / k);
  const src = photo.imageData.data;
  const out = new ImageData(w, h);
  const d = out.data;
  const n = k * k;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < k; dy++) {
        let row = ((y * k + dy) * W + x * k) * 4;
        for (let dx = 0; dx < k; dx++, row += 4) {
          r += src[row]; g += src[row + 1]; b += src[row + 2];
        }
      }
      const p = (y * w + x) * 4;
      d[p] = r / n; d[p + 1] = g / n; d[p + 2] = b / n; d[p + 3] = 255;
    }
  }
  return { photo: { width: w, height: h, imageData: out,
                    filename: photo.filename }, k };
}

function segmentOf(photo) {
  const loop = [[1, 1], [photo.width - 2, 1],
                [photo.width - 2, photo.height - 2], [1, photo.height - 2]];
  return BIASegment.segment(photo, BIAClaim.claim(loop, photo.width, photo.height));
}

// Copy a row band out of the frame (full width — x coordinates are the
// identity evidence and are never touched).
function cropRows(photo, top, bot) {
  const W = photo.width;
  const h = bot - top + 1;
  const out = new ImageData(
    new Uint8ClampedArray(
      photo.imageData.data.buffer.slice(top * W * 4, (bot + 1) * W * 4)),
    W, h);
  return { width: W, height: h, imageData: out, filename: photo.filename };
}

// ---- verdicts become plain data ---------------------------------------------
function plainRule(rule, dy) {
  return { a: rule.a + dy, b: rule.b, x0: rule.x0, x1: rule.x1,
           len: rule.len, thickness: rule.thickness };
}
function shiftLine(ln, dy) {
  if (ln.rule) ln.rule = plainRule(ln.rule, dy);
  for (const b of ln.blobs || []) { b.y0 += dy; b.y1 += dy; }
  for (const l of ln.letters || []) {
    if (l.sample) l.sample.y0 += dy;
  }
  return ln;
}
function sanitize(out, dy) {
  if (!out) return { kind: 'nothing' };
  if (out.kind === 'line') shiftLine(out.line, dy);
  else if (out.kind === 'sheet') {
    for (const ln of out.result.lines) shiftLine(ln, dy);
  }
  return out;
}

// ---- one frame ----------------------------------------------------------------
function analyse(photo, log) {
  const deadline = performance.now() + PRE.BUDGET_MS;

  // 1. PREPASS — the cheap look at a small copy.
  const small = downscale(photo, PRE.TARGET_W);
  const segS = segmentOf(small.photo);
  const marks = HWRead.collectMarks(segS).marks.length;
  if (marks > PRE.MARK_CAP) {
    return { out: { kind: 'nothing' }, skipped: 'busy' };
  }
  if (HWRead.findLadder(segS, function () {}, deadline)) {
    // The whole sheet is plausibly in frame — read the whole frame.
    return { out: sanitize(HWRead.readFrame(photo,
      { log, deadline }), 0) };
  }
  const pairsS = HWRead.findLinePairs(segS, deadline);
  if (!pairsS.length) {
    return { out: { kind: 'nothing' } };
  }

  // 2. FULL RESOLUTION, on the region the candidates imply.
  const G = HWSheet.GEOM;
  const aSpan = G.anchorXRight - G.anchorXLeft;
  let yTop = Infinity, yBot = -Infinity;
  for (const pr of pairsS) {
    const Hpage = (pr.dx / aSpan) * G.aspect;  // the pair's own page height
    const yMid = (pr.y0 + pr.y1) / 2;
    yTop = Math.min(yTop, yMid - PRE.BAND_ABOVE * Hpage);
    yBot = Math.max(yBot, yMid + PRE.BAND_BELOW * Hpage);
  }
  const top = Math.max(0, Math.floor(yTop * small.k));
  const bot = Math.min(photo.height - 1, Math.ceil(yBot * small.k));
  if (bot - top + 1 >= PRE.BAND_WHOLE * photo.height || top >= bot) {
    return { out: sanitize(HWRead.readFrame(photo, { log, deadline }), 0) };
  }
  const band = cropRows(photo, top, bot);
  const out = HWRead.readFrame(band, { log, deadline });
  return { out: sanitize(out, top) };
}

self.onmessage = (e) => {
  const m = e.data;
  const t0 = performance.now();
  const logs = [];
  const log = (line) => { logs.push(line); };
  let reply;
  try {
    const photo = {
      width: m.width, height: m.height,
      imageData: new ImageData(new Uint8ClampedArray(m.buf), m.width, m.height),
      filename: 'live-frame'
    };
    const r = analyse(photo, log);
    let skipped = r.skipped || null;
    // A 'nothing' that ran out its time box was cut short, not read to
    // the end — recorded as a skip (still silent for the child).
    if (!skipped && r.out.kind === 'nothing' &&
        performance.now() - t0 > PRE.BUDGET_MS) skipped = 'budget';
    reply = { gen: m.gen, out: r.out, skipped };
  } catch (err) {
    log('hw live: frame skipped (' + ((err && err.message) || err) + ')');
    reply = { gen: m.gen, out: { kind: 'nothing' }, skipped: null };
  }
  reply.cost = performance.now() - t0;
  reply.logs = logs;
  self.postMessage(reply);
};
