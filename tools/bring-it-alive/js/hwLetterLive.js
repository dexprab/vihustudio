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
 * ~600ms (INTERVAL 500ms floor + ~60–120ms analysis), so STEADY_READS=2
 * consecutive reading verdicts is on the order of a second of held
 * green — long enough that a letter PASSING THROUGH the frame cannot
 * snap mid-motion, short enough that a child holding a page up is never
 * kept waiting. Passing-through is also guarded by GEOMETRY: the two
 * reads must agree about where the letter stands (centres within
 * MOVE_FRAC of the frame width) and how big it is (sizes within
 * SIZE_TOL of each other). A letter carried across the view at any
 * honest speed moves whole letter-widths between two verdicts and can
 * never satisfy the agreement; a held letter's hand-wobble measures a
 * few dozen pixels and always does.
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
  const MOVE_FRAC = 0.04;    // centres must agree within this × frame width
  const SIZE_TOL = 0.35;     // …and max dimensions within ±this fraction

  const state = {
    running: false,
    samples: 0,            // frames actually offered for analysis
    skipped: 0,            // frames the worker declined (busy / time)
    lastCost: 0,           // ms of the last analysis (worker-measured)
    verdicts: 0,           // verdicts seen this arming
    reads: 0,              // 'letter' verdicts seen this arming
    steady: 0,             // current consecutive qualifying reads
    unsteady: 0,           // reads that broke the beat (dev seam: motion)
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
  let lastRead = null;     // { cx, cy, dim, at } of the previous 'letter' verdict

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
    if (state.running && m.out) handle(m.out);
    if (!state.running) return;              // handle() may have completed
    schedule(Math.max(INTERVAL, 2 * state.lastCost));
  }

  function setMany(on) {
    if (on) state.manySeen++;
    if (state.many === on) return;
    state.many = on;
    if (opts.onMany) opts.onMany(on);
  }

  function handle(out) {
    state.verdicts++;
    // The per-frame verdict, surfaced as-is: the readiness light reads
    // what the worker just decided — same seam the card sweep had.
    if (opts.onVerdict) opts.onVerdict(out.kind);
    setMany(out.kind === 'many');
    if (out.kind !== 'letter') {
      state.steady = 0;
      lastRead = null;
      return;
    }
    state.reads++;
    const g = out.glyph;
    const dim = Math.max(g.w, g.h);
    const frameW = out.facts.frameW || 1;
    let steadyWithLast = false;
    if (lastRead) {
      const moved = Math.hypot(g.cx - lastRead.cx, g.cy - lastRead.cy);
      const grewBy = Math.abs(dim - lastRead.dim) / Math.max(dim, lastRead.dim);
      steadyWithLast = moved <= MOVE_FRAC * frameW && grewBy <= SIZE_TOL;
      if (!steadyWithLast) state.unsteady++;
    }
    state.steady = steadyWithLast ? state.steady + 1 : 1;
    lastRead = { cx: g.cx, cy: g.cy, dim };
    if (state.steady >= STEADY_READS) {
      // The beat is complete: this very frame's glyph IS the picture.
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
    schedule(INTERVAL);
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
    state.many = false;
    state.manySeen = 0;
    state.captured = null;
    lastRead = null;
  }

  window.HWLetterLive = { start, stop, reset, state,
                          INTERVAL, STEADY_READS, MOVE_FRAC, SIZE_TOL };
})();
