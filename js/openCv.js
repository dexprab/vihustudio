// openCv.js — OpenCV.js, fetched when it is actually needed.
//
// The hand-written computer vision is finished (see
// docs/MAGIC_CARD_VISION_PLAN.md). Finding a Magic Card in a
// photograph, locating its corners and correcting its perspective are
// solved problems with a decade of hardening behind them, and this is
// how that work gets used instead of reimplemented.
//
// ---------------------------------------------------------------
// WHY A CDN, AND WHAT IT COSTS
//
// The product owner's call: VihuPlanet is a hosted experience and is
// not intended to work offline, so a ten megabyte file does not belong
// in the repository's history forever. That is a real trade and it is
// worth naming both halves:
//
//   the gain   nothing is committed, nothing is served by us, and a
//              child who never opens the camera never downloads it.
//   the cost   recognition by camera now depends on a third party
//              being reachable. Draw Your Stars does not, which is
//              exactly why it stays the fallback and why this module
//              is written to fail quietly rather than to insist.
//
// ---------------------------------------------------------------
// IT NEVER STRANDS ANYBODY
//
// Every way this can go wrong — offline, blocked, slow, a CDN outage,
// a corporate proxy, a script that loads but never initialises —
// resolves to the same thing: `ready()` rejects, the caller falls back
// to what already works, and no child is left looking at a camera that
// will never answer. A timeout is essential to that: a request that
// hangs is worse than one that fails, because nothing downstream can
// tell the difference between "slow" and "never".
const OpenCv = (function () {
  'use strict';

  // Pinned deliberately. `4.x` moves, and a computer-vision pipeline
  // tuned against one build should not silently be handed another.
  var SRC = 'https://docs.opencv.org/4.10.0/opencv.js';

  // Long enough for a real download of ten megabytes on a slow
  // connection, short enough that a child is not left waiting on
  // something that is never coming.
  var TIMEOUT_MS = 25000;

  var promise = null;

  function load() {
    if (promise) return promise;

    promise = new Promise(function (resolve, reject) {
      if (typeof window === 'undefined' || !window.document) {
        reject(new Error('no-document'));
        return;
      }
      // Already here — another surface may have asked first.
      if (window.cv && window.cv.Mat) { resolve(window.cv); return; }

      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('timeout'));
      }, TIMEOUT_MS);

      function done(err, value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (err) reject(err); else resolve(value);
      }

      var el = document.createElement('script');
      el.src = SRC;
      el.async = true;
      // No credentials travel with this, and nothing about a child goes
      // out with the request — it is a static file fetch.
      el.crossOrigin = 'anonymous';

      el.onerror = function () { done(new Error('unreachable')); };
      el.onload = function () {
        // LOADED IS NOT READY. OpenCV.js compiles a WebAssembly module
        // after its script runs, and using it before that finishes
        // throws in a way that looks like a bug in whatever called it.
        var cv = window.cv;
        if (!cv) { done(new Error('absent')); return; }
        if (cv.Mat) { done(null, cv); return; }
        if (typeof cv.then === 'function') {          // some builds are a promise
          cv.then(function (real) { done(null, real || window.cv); })
            .catch(function () { done(new Error('init-failed')); });
          return;
        }
        cv.onRuntimeInitialized = function () { done(null, window.cv); };
      };

      document.head.appendChild(el);
    }).catch(function (e) {
      // A failed attempt is not remembered. A child who tries again
      // after their connection comes back should get a real second
      // chance, not a cached refusal.
      promise = null;
      throw e;
    });

    return promise;
  }

  // Whether it is here RIGHT NOW, without asking for it. For callers
  // that want the better path only if it costs nothing.
  function ready() {
    return !!(typeof window !== 'undefined' && window.cv && window.cv.Mat);
  }

  var api = { load: load, ready: ready, SRC: SRC };
  try { window.OpenCv = api; } catch (e) {}
  return api;
})();
