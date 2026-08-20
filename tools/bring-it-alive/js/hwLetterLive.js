/* HW LETTER LIVE — the letter loop, and GREEN TAKES THE PICTURE.
 *
 * The product owner, verbatim: "take picture button should be there but
 * a kid should never have to use it. we have red and green. the green
 * should take picture on roll."
 *
 * While the letter journey is armed and the camera preview runs, frames
 * are sampled and offered to the one-letter reader (js/hwLetterWorker.js,
 * off the main thread — the freeze-fix discipline, unchanged). Every
 * verdict feeds the readiness light through the same seam the card
 * sweep used (onVerdict); and when the view READS — one clear letter,
 * big enough to capture well — for a STEADY BEAT, the capture fires by
 * itself, using the very glyph the reading frame produced (native-res,
 * cut in the worker from the analysed frame).
 *
 * THE STEADY BEAT, measured rather than guessed: verdicts land every
 * ~600ms (INTERVAL 500ms floor + ~60–120ms analysis; the FIRST frame
 * is sampled the moment the loop starts — the field fix for "such a
 * big letter still taking too long": waiting a full interval before
 * even looking was ~40% of the whole capture time, measured 1.30s →
 * 0.8s on the steady fixture). STEADY_READS=2 consecutive reading
 * verdicts, at least MIN_BEAT_MS apart first-to-last, auto-takes —
 * long enough that a letter PASSING THROUGH the frame cannot snap
 * mid-motion, short enough that a child holding a page up is never
 * kept waiting.
 *
 * TREMBLE IS NOT TRAVEL — the geometry guard, remeasured in the field.
 * The reads must agree about where the letter stands and how big it is
 * (sizes within SIZE_TOL), but a child's HAND is not a tripod: on the
 * seeded hand-tremor fixture (a pulled-back random walk, the honest
 * hold) 5 of 12 per-verdict displacements measure 52–111px at 1280
 * width — over the old per-step bar of MOVE_FRAC 0.04 × frameW = 51px
 * — and every break cost a full ~600ms verdict cycle of re-proving
 * (measured: 1.86s to capture at a kind loop phase, unboundedly worse
 * at an unkind one). So the guard now reads like a hand rather than a
 * ruler: a step within MOVE_FRAC is steady as it always was; a step up
 * to WOBBLE_FRAC (0.10 × frameW) is a WOBBLE — the beat carries on,
 * but a wobbly window must (a) run one read LONGER and (b) end no
 * further than WOBBLE_FRAC from where it began. Tremble wanders and
 * comes home, so it passes; TRAVEL accumulates — a letter carried at
 * even 60px/verdict is ≥120px from its start two verdicts later — so
 * the net bar refuses it and the window restarts where the letter now
 * is. A letter carried at any honest speed still moves whole
 * letter-widths (the carried fixture: ≥190px) between verdicts and
 * fails even the wobble bar outright, exactly as before.
 *
 * AND A FRAME MUST BE A NEW FRAME. Each verdict carries a signature of
 * the very pixels it read (the worker's sigOf); a verdict whose frame
 * is byte-identical to the previous read's is the SAME MOMENT read
 * twice — a stalled camera, a frozen virtual feed, or (measured, and
 * how this rule was found) Chromium's fake capture holding a frame
 * across a fixture file's loop seam, which made a CARRIED letter
 * geometrically stationary for >MIN_BEAT_MS and completed the beat.
 * A repeated frame is no new evidence: it neither advances nor breaks
 * the beat. A real sensor's noise makes every consecutive frame
 * differ, so an honest hold never pays for this rule.
 *
 * ONE capture per arming: the moment the beat completes, the loop stops
 * itself and hands the glyph over — the camera does not keep snapping
 * while the child still holds the letter up. Re-arming is the caller's
 * deliberate act (returning to the capture step). Take and the timer
 * stay as manual fallbacks, untouched, through camera.js's own path.
 *
 * This module is the LOOP only — no UI, no camera ownership, no DOM
 * beyond the video element it samples. hwApp.js owns the words and the
 * light; camera.js owns the stream.
 */
(function () {
  'use strict';

  const INTERVAL = 500;      // ms floor between frame analyses
  const WATCHDOG = 10000;    // ms without a verdict → terminate the worker
  const STEADY_READS = 2;    // consecutive reading verdicts to auto-take
  const MOVE_FRAC = 0.04;    // a step within this × frame width is STEADY
  const WOBBLE_FRAC = 0.10;  // …within this it is a WOBBLE: the beat holds,
                             //   but the window runs one read longer and its
                             //   NET drift must stay under this bar too
                             //   (tremor fixture steps measure ≤111px =
                             //   0.087; the carried letter ≥190px = 0.148)
  const SIZE_TOL = 0.35;     // …and max dimensions within ±this fraction
  const MIN_BEAT_MS = 500;   // the beat's first and last read must span at
                             //   least this — two reads of one and the same
                             //   held-up moment, never one moment twice.
                             //   Read spacing is ≥ INTERVAL + analysis cost,
                             //   so this floor never slows an honest hold;
                             //   it EXISTS so no future interval change can
                             //   quietly let a sub-half-second beat capture

  const state = {
    running: false,
    samples: 0,            // frames actually offered for analysis
    skipped: 0,            // frames the worker declined (busy / time)
    lastCost: 0,           // ms of the last analysis (worker-measured)
    verdicts: 0,           // verdicts seen this arming
    reads: 0,              // 'letter' verdicts seen this arming
    steady: 0,             // current consecutive qualifying reads
    unsteady: 0,           // reads that broke the beat (dev seam: motion)
    wobbles: 0,            // wobble steps ridden through (dev seam: tremor)
    repeats: 0,            // reads of a frame already read (stall / seam)
    beatSpan: 0,           // ms the capturing beat spanned, first→last read
    many: false,           // the CURRENT view holds more than one letter
    manySeen: 0,
    captured: null         // the glyph handed over, once the beat completes
  };

  let opts = {};
  let video = null;
  let grab = null;
  let timer = null;
  let worker = null;
  let inFlight = false;
  let gen = 0;             // arming generation — a stale verdict cannot land
  let dog = null;
  let lastRead = null;     // { cx, cy, dim } of the previous 'letter' verdict
  let beatStart = null;    // { cx, cy, at } — the current window's first read
  let beatWobbly = false;  // the window rode through a wobble step

  function noop() {}

  function isLive() {
    if (!video || !video.srcObject) return false;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return false;
    const tracks = video.srcObject.getTracks();
    return tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('js/hwLetterWorker.js');
    worker.onmessage = onVerdict;
    worker.onerror = (e) => {
      (opts.log || noop)('hw letter: frame skipped (' +
        ((e && e.message) || 'analysis error') + ')');
      frameOver();
      state.skipped++;
      if (state.running) schedule(INTERVAL);
    };
    return worker;
  }

  function frameOver() {
    inFlight = false;
    if (dog) { clearTimeout(dog); dog = null; }
  }

  function schedule(ms) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function tick() {
    timer = null;
    if (!state.running) return;
    if (inFlight) return;                    // one frame in flight — never queue
    if (!isLive()) { schedule(INTERVAL); return; }
    const w = video.videoWidth, h = video.videoHeight;
    if (!(w > 0 && h > 0)) { schedule(INTERVAL); return; }
    let img = null;
    try {
      if (!grab) grab = document.createElement('canvas');
      grab.width = w; grab.height = h;
      const ctx = grab.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      img = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      (opts.log || noop)('hw letter: frame skipped (' +
        ((e && e.message) || e) + ')');
      schedule(INTERVAL);
      return;
    }
    state.samples++;
    inFlight = true;
    ensureWorker().postMessage(
      { gen, width: w, height: h, buf: img.data.buffer },
      [img.data.buffer]);                    // transferred, not copied
    dog = setTimeout(() => {
      (opts.log || noop)('hw letter: a frame was abandoned — starting a fresh analyser');
      if (worker) { worker.terminate(); worker = null; }
      frameOver();
      state.skipped++;
      if (state.running) schedule(INTERVAL);
    }, WATCHDOG);
  }

  function onVerdict(e) {
    const m = e.data || {};
    frameOver();
    if (m.gen !== gen) {                     // a verdict from an abandoned arming
      if (state.running) schedule(INTERVAL);
      return;
    }
    const log = opts.log || noop;
    for (const line of m.logs || []) log(line);
    state.lastCost = m.cost || 0;
    if (m.skipped) state.skipped++;
    if (state.running && m.out) handle(m.out, m.sig);
    if (!state.running) return;              // handle() may have completed
    schedule(Math.max(INTERVAL, 2 * state.lastCost));
  }

  function setMany(on) {
    if (on) state.manySeen++;
    if (state.many === on) return;
    state.many = on;
    if (opts.onMany) opts.onMany(on);
  }

  function handle(out, sig) {
    state.verdicts++;
    // The per-frame verdict, surfaced as-is: the readiness light reads
    // what the worker just decided — same seam the card sweep had.
    if (opts.onVerdict) opts.onVerdict(out.kind);
    setMany(out.kind === 'many');
    if (out.kind !== 'letter') {
      state.steady = 0;
      lastRead = null;
      beatStart = null;
      beatWobbly = false;
      return;
    }
    state.reads++;
    const g = out.glyph;
    // The same frame again — a stalled feed, or a fixture's loop seam
    // holding one frame — is the same moment read twice. No new
    // evidence: it neither advances the beat nor breaks it. (The light
    // already got the verdict: the VIEW still reads.)
    if (sig !== undefined && lastRead && lastRead.sig === sig) {
      state.repeats++;
      return;
    }
    const now = performance.now();
    const dim = Math.max(g.w, g.h);
    const frameW = out.facts.frameW || 1;
    // TREMBLE IS NOT TRAVEL. A step within MOVE_FRAC is steady; up to
    // WOBBLE_FRAC it is a hand's wobble and the beat carries on — but
    // the window then runs one read longer, and must end within
    // WOBBLE_FRAC of where it began (a random walk comes home; a
    // carried letter accumulates and fails the net bar).
    let stepKind = 'start';                  // start | steady | wobble | broke
    if (lastRead) {
      const moved = Math.hypot(g.cx - lastRead.cx, g.cy - lastRead.cy);
      const grewBy = Math.abs(dim - lastRead.dim) / Math.max(dim, lastRead.dim);
      if (grewBy > SIZE_TOL || moved > WOBBLE_FRAC * frameW) stepKind = 'broke';
      else if (moved > MOVE_FRAC * frameW) stepKind = 'wobble';
      else stepKind = 'steady';
    }
    if (stepKind === 'broke') state.unsteady++;
    if (stepKind === 'wobble') state.wobbles++;
    if (stepKind === 'steady' || stepKind === 'wobble') {
      state.steady++;
      if (stepKind === 'wobble') beatWobbly = true;
      const net = Math.hypot(g.cx - beatStart.cx, g.cy - beatStart.cy);
      if (net > WOBBLE_FRAC * frameW) {      // travelled: not a hold at all
        state.unsteady++;
        state.steady = 1;
        beatStart = { cx: g.cx, cy: g.cy, at: now };
        beatWobbly = false;
      }
    } else {
      state.steady = 1;
      beatStart = { cx: g.cx, cy: g.cy, at: now };
      beatWobbly = false;
    }
    lastRead = { cx: g.cx, cy: g.cy, dim, sig };
    const needed = beatWobbly ? STEADY_READS + 1 : STEADY_READS;
    if (state.steady >= needed && now - beatStart.at >= MIN_BEAT_MS) {
      // The beat is complete: this very frame's glyph IS the picture.
      state.beatSpan = Math.round(now - beatStart.at);
      state.captured = g;
      stop();
      if (opts.onCapture) opts.onCapture(g);
    }
  }

  function start(v, o) {
    stop();
    gen++;                       // anything still in flight is now stale
    video = v;
    opts = o || {};
    state.running = true;
    state.many = false;
    state.steady = 0;
    state.captured = null;
    lastRead = null;
    beatStart = null;
    beatWobbly = false;
    // The first frame is looked at NOW — the camera is already live and
    // a child is already holding their letter up; waiting a full
    // interval before the first glance was ~40% of the capture time.
    // (tick() itself idles politely until the preview really renders.)
    schedule(0);
  }

  function stop() {
    state.running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    // An in-flight frame is left to finish: its verdict is generation-
    // checked on the next arming and simply dropped. The worker stays
    // warm — the next arming reuses it.
  }

  function reset() {
    state.samples = 0;
    state.skipped = 0;
    state.verdicts = 0;
    state.reads = 0;
    state.steady = 0;
    state.unsteady = 0;
    state.wobbles = 0;
    state.repeats = 0;
    state.beatSpan = 0;
    state.many = false;
    state.manySeen = 0;
    state.captured = null;
    lastRead = null;
    beatStart = null;
    beatWobbly = false;
  }

  // `verdict` is the suite's deterministic seam — the same entry a
  // worker verdict takes, driveable directly the way HWLight.verdict
  // already is, so tremble-vs-travel can be proved at exact geometries
  // and exact clock spacings (a y4m cannot promise either: the fake
  // capture holds a frame across the file's loop seam).
  window.HWLetterLive = { start, stop, reset, state, verdict: handle,
                          INTERVAL, STEADY_READS, MOVE_FRAC, WOBBLE_FRAC,
                          SIZE_TOL, MIN_BEAT_MS };
})();
