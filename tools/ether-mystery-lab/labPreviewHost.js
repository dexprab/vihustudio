// tools/ether-mystery-lab/labPreviewHost.js — the Lab's side of
// ▶ PLAY IN ETHER.
//
// SPRINT — Ether Mystery Lab: Visual Experience Preview (Decision 58).
//
// A frame, opened when the reviewer presses PLAY and removed when they
// leave. That is the whole of the isolation: the preview is a separate
// document with its own globals, its own universe and its own copy of
// the providers, so "disposable" is a property of how it is mounted
// rather than a promise to clean up after itself. The Lab page never
// mounts an Ether of its own, before or after — loading the Lab still
// does nothing but draw it.
//
// The candidate travels by postMessage as structured data. Nothing is
// stored on either side, nothing is written back into the session, and
// the report that comes home is page memory the reviewer can read once
// and forget.

(function (global) {
  'use strict';

  var doc = global.document;
  var overlay = null;
  var frame = null;
  var onDone = null;
  var pending = null;
  var listening = false;

  function ensureStyle() {
    if (doc.getElementById('lab-preview-style')) return;
    var s = doc.createElement('style');
    s.id = 'lab-preview-style';
    s.textContent =
      '.lab-preview-overlay{position:fixed;inset:0;z-index:9000;background:#12182B;}' +
      '.lab-preview-overlay iframe{position:absolute;inset:0;width:100%;height:100%;' +
      'border:0;display:block;}';
    doc.head.appendChild(s);
  }

  function onMessage(ev) {
    var d = ev && ev.data;
    if (!d || typeof d.type !== 'string' || d.type.indexOf('lab-preview:') !== 0) return;
    if (d.type === 'lab-preview:ready') {
      if (pending && frame && frame.contentWindow) {
        frame.contentWindow.postMessage(
          { type: 'lab-preview:play', candidate: pending.candidate, seed: pending.seed },
          '*');
      }
      return;
    }
    if (d.type === 'lab-preview:exit') {
      var report = d.report || null;
      close();
      if (onDone) { var f = onDone; onDone = null; f(report); }
    }
  }

  function open(candidate, seed, done) {
    close();
    ensureStyle();
    if (!listening) { global.addEventListener('message', onMessage); listening = true; }
    onDone = done || null;
    pending = { candidate: candidate, seed: seed };
    overlay = doc.createElement('div');
    overlay.className = 'lab-preview-overlay';
    overlay.setAttribute('data-lab-preview', '1');
    frame = doc.createElement('iframe');
    frame.setAttribute('title', 'Ether preview');
    frame.src = 'preview.html';
    overlay.appendChild(frame);
    doc.body.appendChild(overlay);
    return overlay;
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; frame = null; pending = null;
  }

  global.LabPreviewHost = {
    open: open,
    close: close,
    isOpen: function () { return !!overlay; }
  };
})(typeof window !== 'undefined' ? window : this);
