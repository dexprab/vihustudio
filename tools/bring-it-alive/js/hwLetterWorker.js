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

/* A cheap signature of the frame's own pixels (FNV-1a over ~4096
 * strided bytes). Two verdicts carrying the SAME signature are two
 * reads of one frame — a camera stall, a frozen virtual feed, a fake
 * capture holding a frame across its file's loop seam — and the live
 * loop refuses to count the second toward the steady beat: the same
 * moment read twice is no new evidence. A real sensor's noise makes
 * consecutive frames differ every time, so an honest hold is never
 * slowed by this. */
function sigOf(buf) {
  const b = new Uint8Array(buf);
  const step = Math.max(1, (b.length / 4096) | 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i += step) {
    h ^= b[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

self.onmessage = (e) => {
  const m = e.data;
  const t0 = performance.now();
  const sig = sigOf(m.buf);
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
    reply = { gen: m.gen, out, sig, skipped };
    if (out.kind === 'letter') transfer = [out.glyph.mask.buffer];
  } catch (err) {
    log('hw letter: frame skipped (' + ((err && err.message) || err) + ')');
    reply = { gen: m.gen, out: { kind: 'nothing', why: 'blank' }, sig,
              skipped: null };
  }
  reply.cost = performance.now() - t0;
  reply.logs = logs;
  self.postMessage(reply, transfer);
};
