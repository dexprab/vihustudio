/* HW LIVE — free-motion line collection from the running camera preview.
 *
 * The product owner's finding, verbatim: "why is it needed to get all
 * lines clicked at same time. why cant we do first line , 2nd in a free
 * motion". So: while the camera preview runs in the handwriting
 * journey, frames are sampled and offered to HWRead.readFrame — the
 * child sweeps the camera over the sheet and lines are collected ONE AT
 * A TIME, IN ANY ORDER. A frame where the full ladder registers reads
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
 * This module is the LOOP AND THE COLLECTION only — no UI, no camera
 * ownership. hwApp.js owns the words and the slots; camera.js owns the
 * stream and the light. The cadence follows the Magic Card camera's
 * precedent (live still-frame analysis with a busy guard): one analysis
 * at a time, never faster than INTERVAL, and after a slow frame the
 * next waits proportionally (2× the measured cost) so a modest machine
 * is never saturated. Sampling reads the video only while its tracks
 * are LIVE; a taken picture (tracks stopped while the child decides)
 * idles the loop, and it resumes by itself on retake. Stopping the loop
 * never touches the tracks — the camera light is camera.js's charge.
 *
 * Latest wins, silently: re-showing an already-collected line replaces
 * it. Refusals cost nothing: an ambiguous frame collects nothing and
 * the child keeps sweeping (hwRead refuses rather than guesses, so a
 * wrong line identity is never collected).
 */
(function () {
  'use strict';

  const INTERVAL = 500;   // ms floor between frame analyses

  const state = {
    running: false,
    samples: 0,           // frames actually analysed
    replaced: 0,          // silent latest-wins replacements
    lastCost: 0,          // ms of the last analysis
    want: null,           // a retake: complete as soon as THIS line lands
    collected: new Map()  // line index → { line, capture, at }
  };

  let opts = {};
  let video = null;
  let grab = null;
  let timer = null;

  function isLive() {
    if (!video || !video.srcObject || !video.videoWidth) return false;
    const tracks = video.srcObject.getTracks();
    return tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
  }

  function schedule(ms) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function tick() {
    timer = null;
    if (!state.running) return;
    if (!isLive()) { schedule(INTERVAL); return; }
    const t0 = performance.now();
    let out = null;
    try {
      const w = video.videoWidth, h = video.videoHeight;
      if (!grab) grab = document.createElement('canvas');
      grab.width = w; grab.height = h;
      const ctx = grab.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      state.samples++;
      out = HWRead.readFrame(
        { width: w, height: h, imageData: ctx.getImageData(0, 0, w, h),
          filename: 'live-frame' },
        { log: opts.log || function () {} });
    } catch (e) {
      (opts.log || function () {})('hw live: frame skipped (' +
        ((e && e.message) || e) + ')');
    }
    state.lastCost = performance.now() - t0;
    if (out) handle(out);
    if (!state.running) return;  // handle() may have completed the sweep
    schedule(Math.max(INTERVAL, 2 * state.lastCost));
  }

  function handle(out) {
    if (out.kind === 'line') {
      collect(out.index, out.line, out.capture);
    } else if (out.kind === 'sheet') {
      // The whole ladder registered: every read line lands together.
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
    video = v;
    opts = o || {};
    state.want = (o && o.want != null) ? o.want : null;
    state.running = true;
    schedule(INTERVAL);
  }

  function stop() {
    state.running = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function reset() {
    state.collected.clear();
    state.samples = 0;
    state.replaced = 0;
    state.want = null;
  }

  window.HWLive = { start, stop, reset, state, INTERVAL };
})();
