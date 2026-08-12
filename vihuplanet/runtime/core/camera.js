// camera.js — the Universe Camera.
//
// A living universe should never feel like a static webpage. Think of
// watching the night sky while lying on grass: you are never
// completely still, and neither is the sky.
//
// So the camera drifts. The whole design constraint is in one
// sentence: it must be too slow to notice while you are looking at it,
// and unmistakable if you look away and come back. A child should
// never catch the universe moving — they should simply realise, half a
// minute in, that this place is not standing still.
//
// That puts the numbers in a narrow band, and they are the entire
// design of this file:
//
//   · Amplitude ~2.5% of the shorter viewport edge. On a laptop that
//     is about twenty pixels. Enough to shift what is behind what;
//     not enough to be read as movement.
//   · Period 50–80 seconds per axis, on two incommensurate rates, so
//     the path never repeats and never crosses the same point twice
//     in the same direction.
//   · A third, much slower harmonic on top, so even the *shape* of
//     the drift changes over several minutes.
//
// The camera is what makes depth real. Every layer in the Ether reads
// its offset multiplied by that layer's parallax factor, so distant
// stars barely move, mist slides, and foreground dust swims. Nothing
// in the runtime has to animate for the universe to have volume — it
// has volume because the camera moves and the layers disagree about
// how much.
//
// It owns no state anyone else writes, and moving it never moves
// anything in the world: this is a change of viewpoint, not of
// position. A story's place in the Ether is untouched by the camera,
// which is why focus still returns a story to the exact place it
// occupied.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var Camera = VihuPlanet.ns('Camera');

  Camera.create = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    if (!ether) return null;

    var rng = Rng.create((opts.seed != null ? opts.seed : Rng.sessionSeed()) ^ 0xCA9E7A);

    // Reduced motion stops the camera dead. A drifting viewport is
    // exactly the kind of unrequested motion the setting exists to
    // silence, and unlike focus or birth it is not a response to
    // anything the child did.
    var amplitude = Env.reducedMotion() ? 0 : (opts.amplitude || 0.025);

    // Two long periods per axis, deliberately not simple multiples of
    // each other.
    var rate = {
      x1: 2 * Math.PI / rng.between(58, 74),
      y1: 2 * Math.PI / rng.between(49, 67),
      x2: 2 * Math.PI / rng.between(150, 210),
      y2: 2 * Math.PI / rng.between(170, 240)
    };
    var phase = {
      x1: rng.between(0, Math.PI * 2), y1: rng.between(0, Math.PI * 2),
      x2: rng.between(0, Math.PI * 2), y2: rng.between(0, Math.PI * 2)
    };

    var offset = { x: 0, y: 0 };
    var scratch = { x: 0, y: 0 };

    function update(dt, time) {
      if (amplitude <= 0) { offset.x = 0; offset.y = 0; return; }
      var reach = Math.min(ether.viewWidth, ether.viewHeight) * amplitude;
      offset.x = reach * (Math.sin(time * rate.x1 + phase.x1) * 0.72 +
                          Math.sin(time * rate.x2 + phase.x2) * 0.28);
      offset.y = reach * (Math.cos(time * rate.y1 + phase.y1) * 0.72 +
                          Math.cos(time * rate.y2 + phase.y2) * 0.28);
    }

    // The camera's offset as a given layer should see it. Parallax 0
    // is infinitely far away and never moves; 1 is the plane the
    // stories live on; above 1 is in front of them, and swims.
    //
    // Negated, because moving the camera right moves the world left —
    // the sign belongs here rather than in five different renderers,
    // each of which would eventually get it wrong once.
    function offsetFor(parallax) {
      scratch.x = -offset.x * parallax;
      scratch.y = -offset.y * parallax;
      return scratch;
    }

    return {
      update: update,
      offsetFor: offsetFor,
      offset: function () { return offset; },
      amplitude: function () { return amplitude; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
