/* HW LIVE — free-motion line collection from the running camera preview.
 *
 * The product owner's finding, verbatim: "why is it needed to get all
 * lines clicked at same time. why cant we do first line , 2nd in a free
 * motion". So: while the camera preview runs in the handwriting
 * journey, frames are sampled and offered to the reader — the child
 * sweeps the camera over the sheet and lines are collected ONE AT A
 * TIME, IN ANY ORDER. A frame where the full ladder registers reads
 * the whole sheet at once and fills every slot together, which is also
 * exactly what the take-a-picture path does — the two modes cannot
 * disagree about what a read line is because they share hwRead whole.
 *
 * CLOSE-UP IS THE POINT: a single line filling the frame gives far more
 * pixels per letter than the whole page in the same frame (measured on
 * the fixtures: x-height ~24px close up vs ~13px for the whole sheet in
 * the identical 1280×960 frame — and the field's real whole-page hold
 * measured ~10px). Each collected line logs its own measured x-height.
 *
 * THE ANALYSIS RUNS OFF THE MAIN THREAD (the field freeze fix). The
 * first build ran hwRead's whole mark/pair/DP machinery right here, in
 * the page — measured ~80–130ms a frame on the clean fixtures, and
 * 12.4 SECONDS on a real room scene (furniture, shadows, hundreds of
 * dark specks: the mark list hits its cap and the anchor pair search
 * over it is combinatorial). The product owner's laptop froze the
 * moment the camera opened. So the page now only GRABS the frame —
 * drawImage + getImageData, ~15–30ms — and posts the pixels
 * (transferable, so nothing is copied) to js/hwLiveWorker.js, which
 * owns the reading and the per-frame budgets. AT MOST ONE frame is in
 * flight: the next is scheduled only after the verdict lands, so
 * analysis can never queue behind analysis, however slow a frame is.
 *
 * This module is the LOOP AND THE COLLECTION only — no UI, no camera
 * ownership. hwApp.js owns the words and the slots; camera.js owns the
 * stream and the light. The cadence follows the Magic Card camera's
 * precedent (live still-frame analysis with a busy guard): one analysis
 * at a time, never faster than INTERVAL, and after a slow frame the
 * next waits proportionally (2× the measured cost) so a modest machine
 * is never saturated. Sampling reads the video only while its tracks
 * are LIVE and the preview is actually rendering (readyState, and
 * videoWidth > 0 — a frame is never grabbed before the metadata says
 * there is one); a taken picture (tracks stopped while the child
 * decides) idles the loop, and it resumes by itself on retake.
 * Stopping the loop never touches the tracks — the camera light is
 * camera.js's charge.
 *
 * Latest wins, silently: re-showing an already-collected line replaces
 * it. Refusals cost nothing: an ambiguous frame collects nothing and
 * the child keeps sweeping (hwRead refuses rather than guesses, so a
 * wrong line identity is never collected). A frame the worker skipped
 * — a scene too busy to be a sheet, or one that ran past its time
 * budget — costs the same nothing and says nothing to the child: the
 * slot simply doesn't tick yet. state.skipped counts them for the
 * developer seam.
 */
(function () {
  'use strict';

  const INTERVAL = 500;    // ms floor between frame analyses
  const WATCHDOG = 10000;  // ms without a verdict → the worker is wedged:
                           // terminate it, skip the frame, start fresh.
                           // Belt-and-braces over the worker's own budget
                           // (~1s a frame) — this should never fire.

  const state = {
    running: false,
    samples: 0,           // frames actually offered for analysis
    replaced: 0,          // silent latest-wins replacements
    skipped: 0,           // frames the worker declined (busy scene / time)
    lastCost: 0,          // ms of the last analysis (worker-measured)
    want: null,           // a retake: complete as soon as THIS line lands
    many: false,          // the CURRENT view holds more than one card
    manySeen: 0,          // how many 'many' verdicts this sweep (dev seam)
    collected: new Map()  // line index → { line, capture, at }
  };

  let opts = {};
  let video = null;
  let grab = null;
  let timer = null;
  let worker = null;
  let inFlight = false;
  let gen = 0;            // sweep generation — a stale verdict cannot land
  let dog = null;
  let skipLogged = 0;

  function noop() {}

  function isLive() {
    if (!video || !video.srcObject) return false;
    // First-frame hygiene: no sampling before the preview is actually
    // rendering — metadata loaded (videoWidth > 0) AND a current frame
    // to read (readyState ≥ HAVE_CURRENT_DATA).
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return false;
    const tracks = video.srcObject.getTracks();
    return tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('js/hwLiveWorker.js');
    worker.onmessage = onVerdict;
    worker.onerror = (e) => {
      // An analysis that threw is a skipped frame, never a stuck loop.
      (opts.log || noop)('hw live: frame skipped (' +
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
    if (inFlight) return;             // one frame in flight — never queue
    if (!isLive()) { schedule(INTERVAL); return; }
    const w = video.videoWidth, h = video.videoHeight;
    if (!(w > 0 && h > 0)) { schedule(INTERVAL); return; } // zero-dimension guard
    let img = null;
    try {
      if (!grab) grab = document.createElement('canvas');
      grab.width = w; grab.height = h;
      const ctx = grab.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      img = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      (opts.log || noop)('hw live: frame skipped (' +
        ((e && e.message) || e) + ')');
      schedule(INTERVAL);
      return;
    }
    state.samples++;
    inFlight = true;
    ensureWorker().postMessage(
      { gen, width: w, height: h, buf: img.data.buffer },
      [img.data.buffer]);            // transferred, not copied
    dog = setTimeout(() => {
      // The worker never answered — a frame this wedged is abandoned
      // with its worker; the next frame gets a fresh one.
      (opts.log || noop)('hw live: a frame was abandoned — starting a fresh analyser');
      if (worker) { worker.terminate(); worker = null; }
      frameOver();
      state.skipped++;
      if (state.running) schedule(INTERVAL);
    }, WATCHDOG);
  }

  function onVerdict(e) {
    const m = e.data || {};
    frameOver();
    if (m.gen !== gen) {              // a verdict from an abandoned sweep
      if (state.running) schedule(INTERVAL);
      return;
    }
    const log = opts.log || noop;
    for (const line of m.logs || []) log(line);
    state.lastCost = m.cost || 0;
    if (m.skipped) {
      state.skipped++;
      // Developer seam only — the child sees nothing (the slot simply
      // doesn't tick). Logged sparsely so a long sweep of a busy room
      // doesn't flood the dev log.
      if (skipLogged === 0 || state.skipped % 10 === 0) {
        log('hw live: ' + state.skipped + ' frame(s) skipped — nothing sheet-like in view');
      }
      skipLogged++;
    }
    if (state.running && m.out) handle(m.out);
    if (!state.running) return;       // handle() may have completed the sweep
    schedule(Math.max(INTERVAL, 2 * state.lastCost));
  }

  // The one-card overlay (the product owner's rule: strictly one card
  // at a time). A 'many' verdict raises it; ANY other verdict — a card
  // read, a legacy sheet, or plain nothing (zero cards) — clears it,
  // so the moment the view returns to one card (or none) the message
  // goes away by itself. While it is up, nothing is collected and no
  // slot ticks, because a 'many' frame reads nothing by construction.
  function setMany(on) {
    if (on) state.manySeen++;
    if (state.many === on) return;
    state.many = on;
    if (opts.onMany) opts.onMany(on);
  }

  function handle(out) {
    // The per-frame verdict, surfaced as-is: the readiness light (and
    // any other host UI) reads what the worker just decided — the
    // worker already knows, the page only needs to show it.
    if (opts.onVerdict) opts.onVerdict(out.kind);
    if (out.kind === 'many') { setMany(true); return; }
    setMany(false);
    if (out.kind === 'line') {
      collect(out.index, out.line, out.capture);
    } else if (out.kind === 'sheet') {
      // A legacy sheet's whole ladder registered: every read line lands
      // together (old printouts only — the card print has no ladder).
      for (const ln of out.result.lines) {
        if (ln.found) collect(ln.index, ln, out.result.capture);
      }
    } else {
      return;
    }
    const done = state.want != null
      ? state.collected.has(state.want)
      : state.collected.size >= HWSheet.LINES.length;
    if (done) {
      stop();
      if (opts.onComplete) opts.onComplete();
    }
  }

  function collect(i, line, capture) {
    const had = state.collected.has(i);
    if (had) state.replaced++;   // latest wins, silently
    state.collected.set(i, { line, capture, at: Date.now() });
    if (opts.onCollect) opts.onCollect(i, !had);
  }

  function start(v, o) {
    stop();
    gen++;                      // anything still in flight is now stale
    video = v;
    opts = o || {};
    state.want = (o && o.want != null) ? o.want : null;
    state.running = true;
    state.many = false;
    skipLogged = 0;
    schedule(INTERVAL);
  }

  function stop() {
    state.running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    // An in-flight frame is left to finish: its verdict is generation-
    // checked and simply dropped. The worker itself stays warm — the
    // next sweep reuses it.
  }

  function reset() {
    state.collected.clear();
    state.samples = 0;
    state.replaced = 0;
    state.skipped = 0;
    state.want = null;
    state.many = false;
    state.manySeen = 0;
  }

  window.HWLive = { start, stop, reset, state, INTERVAL };
})();
