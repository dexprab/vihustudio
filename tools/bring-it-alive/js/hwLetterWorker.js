/* HW LETTER WORKER — the letter loop's reading thread.
 *
 * The page (js/hwLetterLive.js) grabs a preview frame and posts its
 * pixels here; this worker runs the one-letter read (js/hwLetter.js)
 * and posts the verdict back. The main thread therefore never runs an
 * analysis at all — the discipline the field freeze taught (a page that
 * analyses camera frames on the main thread will, one day, meet a scene
 * that grinds it to a halt), kept even though a single-letter read is
 * far cheaper than the card reader it replaced: the freeze-fix
 * responsiveness budgets are asserted by the suite either way.
 *
 * segment.js and hwLetter.js are DOM-free, so they load here verbatim
 * (window := the worker global). The whole read is time-boxed by
 * hwLetter's own BUDGET_MS; an overrun answers 'nothing' and the frame
 * is skipped — refusing a live frame is invisible (the light just stays
 * red; the next frame is half a second away).
 *
 * A 'letter' verdict carries the glyph's mask (transferred, not copied)
 * cut from THE ANALYSED FRAME at native resolution — so when steady
 * green auto-takes the picture, the picture IS the frame that read.
 */
'use strict';

self.window = self;   // the modules attach their exports to `window`
importScripts('segment.js', 'hwLetter.js');

self.onmessage = (e) => {
  const m = e.data;
  const t0 = performance.now();
  const logs = [];
  const log = (line) => { logs.push(line); };
  let reply, transfer = [];
  try {
    const photo = {
      width: m.width, height: m.height,
      imageData: new ImageData(new Uint8ClampedArray(m.buf), m.width, m.height),
      filename: 'live-frame'
    };
    const out = HWLetter.read(photo, {
      log, deadline: t0 + HWLetter.PARAMS.BUDGET_MS
    });
    let skipped = null;
    if (out.kind === 'nothing' && (out.why === 'busy' || out.why === 'time')) {
      skipped = out.why;
    }
    reply = { gen: m.gen, out, skipped };
    if (out.kind === 'letter') transfer = [out.glyph.mask.buffer];
  } catch (err) {
    log('hw letter: frame skipped (' + ((err && err.message) || err) + ')');
    reply = { gen: m.gen, out: { kind: 'nothing', why: 'blank' }, skipped: null };
  }
  reply.cost = performance.now() - t0;
  reply.logs = logs;
  self.postMessage(reply, transfer);
};
