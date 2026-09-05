// tools/ether-mystery-lab/labPreviewHost.js — the Lab's side of
// ▶ PLAY IN ETHER.
//
// SPRINT — Ether Mystery Lab: Visual Experience Preview (Decision 58).
//
// A TAB OF ITS OWN, opened when the reviewer presses PLAY and closed
// when they leave. That is the whole of the isolation: the preview is
// a separate top-level document with its own globals, its own
// universe, its own copy of the providers and its own sessionStorage,
// so "disposable" is a property of how it is mounted rather than a
// promise to clean up after itself. The Lab page never mounts an Ether
// of its own, before or after — loading the Lab still does nothing but
// draw it.
//
// WHY A TAB RATHER THAN A FRAME. The reviewer is judging what a sky
// would feel like to a child, and a child meets it full-screen with
// nothing else on the glass. A frame inside the Lab is the right size
// and the wrong context — the batch, the buttons and the browser's own
// idea of the page are all still there around it. A tab is the sky and
// nothing else, it can be resized and moved to the screen the reviewer
// wants, and the Lab stays where it was so the review does not lose
// its place. It is also stricter isolation for free: sessionStorage is
// per TOP-LEVEL browsing context, so the preview's one deliberate
// runtime key cannot reach the Lab at all.
//
// ONE TAB, REUSED. The window is opened under a fixed name, so a
// second PLAY navigates the tab that is already there rather than
// piling previews up behind the Lab.
//
// The candidate travels by postMessage as structured data, exactly as
// it did through the frame. Nothing is stored on either side, nothing
// is written back into the session, and the report that comes home is
// page memory the reviewer can read once and forget.
//
// A BLOCKED POPUP IS SAID OUT LOUD. A browser that refuses the tab is
// answered with a plain sentence on the card (labUi.js) and never with
// a preview that silently did not happen.

(function (global) {
  'use strict';

  var TARGET = 'vihu-ether-preview';   // one preview tab, reused
  var win = null;
  var onDone = null;
  var pending = null;
  var listening = false;
  var watch = null;
  // ONE PREVIEW PER PRESS, NAMED. A reused tab means the OUTGOING
  // document's own pagehide report arrives AFTER the next preview has
  // been armed — measured, and it would have closed the tab that had
  // just opened. Every play carries an epoch and only the epoch now
  // running may end it.
  var epoch = 0;

  function onMessage(ev) {
    var d = ev && ev.data;
    if (!d || typeof d.type !== 'string' || d.type.indexOf('lab-preview:') !== 0) return;
    // Only our own preview tab is listened to.
    if (win && ev.source && ev.source !== win) return;
    if (d.type === 'lab-preview:ready') {
      if (pending && win && !win.closed) {
        try {
          win.postMessage(
            { type: 'lab-preview:play', candidate: pending.candidate,
              seed: pending.seed, mode: pending.mode, epoch: epoch },
            '*');
        } catch (e) { /* held */ }
      }
      return;
    }
    if (d.type === 'lab-preview:exit') {
      if (d.epoch !== epoch) return;          // a preview that is already over
      finish(d.report || null);
    }
  }

  // The one way this ends, however it ended: the reviewer pressed Exit,
  // or closed the tab themselves. `onDone` is cleared first, so the
  // watcher below can never deliver a second report for one preview.
  function finish(report) {
    var f = onDone;
    onDone = null;
    close();
    if (f) f(report);
  }

  // A tab can be closed by the browser's own ✕, which posts nothing.
  // The watcher is the only thing that notices, and it exists only
  // while a preview is open.
  function startWatch() {
    stopWatch();
    watch = global.setInterval(function () {
      if (!win || win.closed) finish(null);
    }, 400);
  }
  function stopWatch() {
    if (watch) { global.clearInterval(watch); watch = null; }
  }

  // mode: 'play' (a valid candidate) or 'try' (a research run over an
  // invalid one — see labPreview.js and labResearch.js).
  //
  // Returns {ok:true} or {ok:false, reason} — a blocked popup is a
  // state the caller has to be able to say out loud, not a silence.
  // window.open MUST be reached synchronously from the reviewer's own
  // click or every browser refuses it, so nothing may be awaited above
  // this line.
  function open(candidate, seed, done, mode) {
    if (!listening) { global.addEventListener('message', onMessage); listening = true; }
    epoch++;
    onDone = done || null;
    pending = { candidate: candidate, seed: seed, mode: (mode === 'try') ? 'try' : 'play' };
    var w = null;
    try { w = global.open('preview.html', TARGET); } catch (e) { w = null; }
    if (!w) {
      onDone = null; pending = null; win = null;
      stopWatch();
      return { ok: false, reason: 'popup-blocked' };
    }
    win = w;
    try { w.focus(); } catch (e) { /* held */ }
    startWatch();
    return { ok: true, window: w };
  }

  function close() {
    stopWatch();
    if (win && !win.closed) { try { win.close(); } catch (e) { /* held */ } }
    win = null; pending = null;
  }

  global.LabPreviewHost = {
    open: open,
    close: close,
    isOpen: function () { return !!win && !win.closed; }
  };
})(typeof window !== 'undefined' ? window : this);
