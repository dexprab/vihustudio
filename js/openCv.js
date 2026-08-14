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

  // MORE THAN ONE PLACE TO GET IT.
  //
  // The first attempt named a single URL — docs.opencv.org/4.10.0/ —
  // and the browser reported `unreachable`, which is what a 404 looks
  // like from a script tag. That path was my invention: the OpenCV
  // documentation site publishes /4.x/, and I pinned a version
  // directory without being able to check that it exists.
  //
  // Guessing a second URL would repeat the mistake. These are tried in
  // order until one loads, so a wrong path, a 404, a host that is down
  // or a network that blocks one domain all cost a moment rather than
  // the feature.
  //
  // The jsDelivr entries are pinned to an exact package version and are
  // the ones to prefer: docs.opencv.org is documentation hosting with
  // no uptime promise, and its unversioned /4.x/ can change build under
  // us — which is why it is last rather than absent.
  var SOURCES = [
    'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
    'https://unpkg.com/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
    'https://docs.opencv.org/4.x/opencv.js'
  ];
  var SRC = SOURCES[0];

  // Long enough for a real download of ten megabytes on a slow
  // connection, short enough that a child is not left waiting on
  // something that is never coming.
  var TIMEOUT_MS = 25000;

  var promise = null;
  // Why the last attempt failed, kept so a surface can SAY it. A
  // dependency that silently is not there is the hardest kind to
  // diagnose from a screenshot — "not here" could be a slow network, a
  // blocked host, or a bug in this file, and those need different
  // answers from different people.
  var lastError = null;
  var started = 0;

  function _host(url) {
    try { return url.split('/')[2]; } catch (e) { return url; }
  }

  function load() {
    if (promise) return promise;

    lastError = null;
    started = Date.now();
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

      var at = 0;
      var tried = [];

      function attempt() {
        if (at >= SOURCES.length) {
          done(new Error('unreachable (' + tried.join(', ') + ')'));
          return;
        }
        var url = SOURCES[at++];
        var el = document.createElement('script');
        el.src = url;
        el.async = true;
        // NO crossOrigin, deliberately.
        //
        // Setting it to 'anonymous' looked like good hygiene and was in
        // fact what broke the first attempt: it opts a plain <script>
        // INTO a CORS check, and docs.opencv.org sends no
        // Access-Control-Allow-Origin header, so the browser refused
        // the file outright —
        //
        //   Access to script at 'https://docs.opencv.org/…/opencv.js'
        //   from origin 'https://vihuplanet.com' has been blocked by
        //   CORS policy … net::ERR_FAILED
        //
        // A classic script tag needs no such header, and the only thing
        // crossOrigin buys is readable errors from the other origin,
        // which is worth nothing next to the file loading at all.

        el.onerror = function () {
          tried.push(_host(url));
          el.parentNode && el.parentNode.removeChild(el);
          attempt();                       // the next place
        };
        el.onload = function () {
          // LOADED IS NOT READY. OpenCV compiles a WebAssembly module
          // after its script runs, and using it before that finishes
          // throws in a way that looks like a bug in whatever called it.
          var cv = window.cv;
          if (!cv) { tried.push(_host(url) + ' (empty)'); attempt(); return; }
          if (cv.Mat) { done(null, cv); return; }
          if (typeof cv.then === 'function') {        // some builds are a promise
            cv.then(function (real) { done(null, real || window.cv); })
              .catch(function () { done(new Error('init-failed')); });
            return;
          }
          cv.onRuntimeInitialized = function () { done(null, window.cv); };
        };
        document.head.appendChild(el);
      }

      attempt();
    }).catch(function (e) {
      lastError = (e && e.message) || 'failed';
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

  // What happened, in words: 'ready', 'never asked', 'still trying (Ns)'
  // or the reason it gave up.
  function state() {
    if (ready()) return 'ready';
    if (!started) return 'never asked';
    if (lastError) return lastError;
    var secs = Math.round((Date.now() - started) / 1000);
    return 'still trying (' + secs + 's)';
  }

  var api = { load: load, ready: ready, state: state, SRC: SRC };
  try { window.OpenCv = api; } catch (e) {}
  return api;
})();
