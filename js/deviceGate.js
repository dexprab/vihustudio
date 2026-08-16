// deviceGate.js — which devices can carry which part of the journey.
//
// VihuPlanet is for everybody, on anything. VihuStudio is not: making a
// story means a Card Designer, a Page Designer, an Object Strip, a
// Context Panel and a page canvas, all on screen at once. That needs a
// laptop, and there is no phone layout of it that would be honest —
// what a phone would get is not a smaller Studio, it is a worse one.
//
// So the line is drawn here, and only here:
//
//   The Ether, Story Spirits, reading, cheering and RECOGNITION all
//   work on a phone, exactly as they do on a laptop. A child can visit
//   VihuPlanet, be known by their stars, and find their stories there.
//
//   Opening the Studio does not. That is the one thing a phone is
//   turned back from.
//
// ---------------------------------------------------------------
// HOW A PHONE IS TOLD FROM A COMPUTER
//
// NOT by user agent. It is a string anybody can set, it lies by
// default on iPad, and it needs a new exception every time a device
// ships.
//
// NOT by window width alone either, which is the tempting one and is
// wrong twice over: a laptop with a narrow window is still a laptop and
// must not be locked out of its own Studio, and a phone held sideways
// is still a phone.
//
// Two facts the browser can actually be trusted about, and BOTH have to
// point the same way before anybody is turned back:
//
//   1. The primary pointer is coarse — a finger rather than a mouse.
//      A touchscreen laptop reports `pointer: fine` for its PRIMARY
//      pointer even though it also has a touchscreen, so it passes,
//      which is right.
//   2. The SCREEN's short edge is small. The screen, not the window:
//      resizing a browser must never change who a person is.
//
// A 1280x720 laptop has a 720px short edge and would fail the size test
// on its own — it has a mouse, so it never reaches it. That pairing is
// the whole reason there are two tests instead of one.
const DeviceGate = (function () {
  'use strict';

  // The short edge below which a touch device is treated as a phone.
  // 768 lets tablets through: an iPad's short edge is 820, and a tablet
  // can genuinely hold the Studio's layout. One number to move if that
  // judgement ever changes.
  var MIN_SHORT_EDGE = 768;

  function _shortEdge() {
    try {
      var s = window.screen || {};
      var w = s.width || window.innerWidth || 0;
      var h = s.height || window.innerHeight || 0;
      if (!w || !h) return 0;
      return Math.min(w, h);
    } catch (e) { return 0; }
  }

  function _coarsePointer() {
    try {
      return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (e) { return false; }
  }

  // Never lock anybody out on a guess. If either signal cannot be read,
  // the answer is yes — a Creator wrongly turned away from their own
  // stories is a far worse failure than a phone that gets a Studio it
  // cannot use well.
  function canOpenStudio() {
    if (!_coarsePointer()) return true;
    var edge = _shortEdge();
    if (!edge) return true;
    return edge >= MIN_SHORT_EDGE;
  }

  var api = {
    MIN_SHORT_EDGE: MIN_SHORT_EDGE,
    canOpenStudio: canOpenStudio,
    // Exposed for the diagnostics panel and for tests, never for a
    // decision — everything asks canOpenStudio().
    describe: function () {
      return { coarse: _coarsePointer(), shortEdge: _shortEdge(), allowed: canOpenStudio() };
    }
  };
  try { window.DeviceGate = api; } catch (e) {}
  return api;
})();
