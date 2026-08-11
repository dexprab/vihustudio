// namespace.js — the VihuPlanet Runtime root.
//
// This is the foundation of VihuPlanet itself, not a feature of one
// screen. The Ether is the first tenant of this namespace; Story
// Worlds, the Telescope and the Companion are expected to arrive as
// siblings, not as special cases carved out of the Ether.
//
//   VihuPlanet
//   ├── Core       clock · signal · rng · namespace (this file)
//   ├── Universe   the engine that composes everything below
//   ├── Ether      the living space stories drift through
//   ├── Stories    Story Entities + the Story Manager
//   ├── Physics    the natural laws (drift, avoidance, attraction)
//   ├── Ambient    the universe's own restlessness
//   ├── Focus      touch a story, it comes forward, it returns
//   ├── Birth      a published story visibly joins the universe
//   └── Worlds     the Future World Engine (an inert plug point)
//
// Nothing in here knows about VihuStudio, publishing, reading or the
// Rite. Consumers plug into the runtime; the runtime never reaches
// back out.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet || {};

  VihuPlanet.version = '1.0.0-phase1';

  // ns('Ether.Layers') → creates/returns VihuPlanet.Ether.Layers.
  // Load order between runtime modules is therefore irrelevant: every
  // module claims its own branch, and none of them assume a previous
  // script already ran. (The Hero learned this the hard way with
  // Chapter 2's fixed script order in index.html.)
  VihuPlanet.ns = function (path) {
    var parts = String(path).split('.');
    var node = VihuPlanet;
    for (var i = 0; i < parts.length; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    return node;
  };

  // ---------- Environment ----------
  //
  // Read once, at load. Every system asks the same object rather than
  // each running its own matchMedia — the answers must agree, and a
  // universe that half-respects reduced motion is worse than one that
  // ignores it outright.
  var Env = VihuPlanet.ns('Env');

  Env.dpr = function () {
    // Capped at 2. Beyond that the pixel cost is real and the
    // difference on a starfield is not.
    return Math.min(global.devicePixelRatio || 1, 2);
  };

  Env.reducedMotion = function () {
    if (!global.matchMedia) return false;
    try {
      return global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  };

  // Coarse pointer or a small viewport means a phone in a child's
  // hands: fewer stars, fewer particles, larger touch targets. This is
  // a capability question, not a breakpoint — it decides budget, and
  // css/runtime.css handles the layout side separately.
  Env.lowPower = function () {
    var narrow = (global.innerWidth || 1024) < 760;
    var cores = global.navigator && global.navigator.hardwareConcurrency;
    return narrow || (typeof cores === 'number' && cores > 0 && cores <= 4);
  };

  // ---------- Small shared maths ----------
  var Util = VihuPlanet.ns('Util');

  Util.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  Util.lerp = function (a, b, t) { return a + (b - a) * t; };

  // Smoothstep. Every easing in the runtime routes through here or
  // easeOut below, so nothing in the universe ever starts or stops
  // abruptly — Art Direction v1.0 forbids mechanical motion, and an
  // un-eased lerp reads as exactly that.
  Util.smooth = function (t) {
    t = Util.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  Util.easeOut = function (t) {
    t = Util.clamp(t, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  };

  var _idSeq = 0;
  Util.uid = function (prefix) {
    _idSeq += 1;
    return (prefix || 'vp') + '-' + _idSeq.toString(36);
  };

  global.VihuPlanet = VihuPlanet;
  if (typeof module !== 'undefined' && module.exports) module.exports = VihuPlanet;
})(typeof window !== 'undefined' ? window : this);
