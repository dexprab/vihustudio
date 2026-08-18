// deviceGate.js — which devices can carry which part of the journey.
//
// VihuPlanet is for everybody, on anything. VihuStudio is not: making a
// story means a Card Designer, a Page Designer, an Object Strip, a
// Context Panel and a page canvas, all on screen at once. That needs
// room, and there is no phone layout of it that would be honest — what
// a phone would get is not a smaller Studio, it is a worse one.
//
// So the line is drawn here, and only here:
//
//   The Ether, Story Spirits, reading, cheering and RECOGNITION all
//   work on a phone, exactly as they do on a laptop. A child can visit
//   VihuPlanet, be known by their stars, and find their stories there.
//
//   Opening the Studio does not. That is the one thing a small screen
//   is turned back from.
//
// ---------------------------------------------------------------
// WHY THIS MEASURES WIDTH NOW, AND USED TO MEASURE THE DEVICE
//
// The first version asked whether the SCREEN's short edge was at least
// 768 — a device-fixed number, so it answered the same in either
// orientation. Measured against the real layout, that was wrong in both
// directions at once:
//
//   iPad Pro 11 held UPRIGHT (834 wide) was let in, and the Studio's
//   three columns became 260 | 254 | 320 — a page canvas NARROWER than
//   either sidebar, at 222x278, with the header controls overlapping
//   each other. Not a smaller Studio; a broken one.
//
//   iPad mini held SIDEWAYS (1133 wide) was turned away, because its
//   short edge is 744. It would have had a 553px middle column — more
//   room than the iPad 9.7 landscape the same rule happily admitted.
//
// The number that actually predicts whether the layout holds is the
// width available RIGHT NOW. Measured across the real grid:
//
//   1024 wide -> 260 | 444 | 320, canvas 412x515   works
//   1080      -> 260 | 500 | 320, canvas 456x570   works
//   1194      -> 260 | 614 | 320, canvas 475x594   works
//    834      -> 260 | 254 | 320, canvas 222x278   broken
//
// so MIN_WIDTH is 1024, and it is a measurement rather than a taste.
//
// ---------------------------------------------------------------
// A TABLET HELD UPRIGHT IS NOT A REFUSAL
//
// It is the same device that works perfectly one gesture later, so
// telling a child "stories are made on a bigger screen" would be a lie
// about their iPad. There are three answers here, not two: yes, turn it
// round, and not on this screen.
//
// ---------------------------------------------------------------
// HOW A SMALL SCREEN IS TOLD FROM A COMPUTER
//
// NOT by user agent. It is a string anybody can set, it lies by default
// on iPad, and it needs a new exception every time a device ships.
//
// NOT by width alone either: a laptop with a narrow window is still a
// laptop and must never be locked out of its own Studio. So the coarse
// pointer is still the first question and still decides who is even
// ASKED about width — a mouse means yes, whatever the window is doing.
// That pairing is the whole reason there are two tests rather than one.
const DeviceGate = (function () {
  'use strict';

  // The width below which the Studio's three-column layout stops being
  // a Studio. Measured, not chosen — see the table above. One number to
  // move if that layout ever changes.
  var MIN_WIDTH = 1024;

  // Verdicts. `ROTATE` is the one a tablet held upright gets: this very
  // device, turned, is fine.
  var YES = 'yes';
  var ROTATE = 'rotate';
  var NO = 'no';

  function _width() {
    try { return window.innerWidth || document.documentElement.clientWidth || 0; }
    catch (e) { return 0; }
  }

  // The SCREEN's longest side, which is what turning the device would
  // make available. The screen rather than the window, because resizing
  // a browser must never change what device somebody is holding.
  function _longEdge() {
    try {
      var s = window.screen || {};
      var w = s.width || window.innerWidth || 0;
      var h = s.height || window.innerHeight || 0;
      return Math.max(w, h);
    } catch (e) { return 0; }
  }

  function _portrait() {
    try {
      var s = window.screen || {};
      if (s.width && s.height) return s.height > s.width;
      return window.innerHeight > window.innerWidth;
    } catch (e) { return false; }
  }

  function _coarsePointer() {
    try {
      return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (e) { return false; }
  }

  /**
   * YES, ROTATE or NO. Never locks anybody out on a guess: if a signal
   * cannot be read the answer is YES, because a Creator wrongly turned
   * away from their own stories is a far worse failure than a small
   * screen getting a Studio it cannot use well.
   */
  function verdict() {
    if (!_coarsePointer()) return YES;      // a mouse is a computer, whatever the window
    var w = _width();
    if (!w) return YES;                     // unreadable
    if (w >= MIN_WIDTH) return YES;

    // Would turning it round be enough? Only worth saying to a device
    // that is actually upright — a tablet already sideways in a split
    // window has a window problem, not an orientation one, and telling
    // it to rotate would be wrong.
    if (_portrait() && _longEdge() >= MIN_WIDTH) return ROTATE;
    return NO;
  }

  // Kept as the single yes/no question every caller used to ask, so
  // nothing that only needs "may I open the Studio" has to learn about
  // the three-way answer.
  function canOpenStudio() { return verdict() === YES; }

  var api = {
    MIN_WIDTH: MIN_WIDTH,
    YES: YES, ROTATE: ROTATE, NO: NO,
    verdict: verdict,
    canOpenStudio: canOpenStudio,
    // Exposed for the diagnostics panel and for tests, never for a
    // decision — everything asks verdict() or canOpenStudio().
    describe: function () {
      return {
        coarse: _coarsePointer(), width: _width(), longEdge: _longEdge(),
        portrait: _portrait(), verdict: verdict()
      };
    }
  };
  try { window.DeviceGate = api; } catch (e) {}
  return api;
})();
