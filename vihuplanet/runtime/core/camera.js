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

  var Util = VihuPlanet.Util;
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

    var drift = { x: 0, y: 0 };     // the involuntary part
    var offset = { x: 0, y: 0 };    // drift + look, what layers read
    var scratch = { x: 0, y: 0 };

    // ---------- looking around ----------
    //
    // The Traveller never moves. The universe rotates around them —
    // standing beneath a living night sky, not walking across a map.
    //
    // `yaw` is an angle, and a full turn scrolls exactly one field
    // width. That is what makes the universe close on itself: turn all
    // the way around and you are looking at where you started, because
    // the Ether wraps at the field's edge anyway (physics.js). No
    // seams, no ends, no wall to walk into.
    //
    // `pitch` does not wrap. You can look up and you can look down, and
    // then you have looked as far as there is — clamped to the field,
    // because a sky you can scroll past forever is a scrollbar.
    var yaw = 0;
    var pitch = 0;
    var yawTarget = 0;
    var pitchTarget = 0;

    // How quickly the view catches up to where the Traveller is
    // looking (1/s). Low enough that the universe always feels heavy —
    // it is a universe, it does not snap.
    var ease = opts.ease || 2.4;

    // How far up and down the Traveller can look, in view pixels.
    //
    // This used to be derived purely from the field — (fieldH - viewH)
    // / 2 — and in a nearly empty Ether the field is only 1.18x the
    // view, so the whole vertical range was about 70px and the up/down
    // arrows did visibly nothing. Yaw did not have the problem because
    // it maps to a full field WIDTH and wraps.
    //
    // Looking up is a thing you can always do under a sky, whatever is
    // in it, so there is a floor: a third of the viewport either way.
    // It stays under what the renderer's bleed can cover at the
    // deepest parallax that uses one (0.30 x 0.35 x viewH < SOFT_BLEED).
    function pitchLimit() {
      return Math.max((ether.height - ether.viewHeight) * 0.5,
                      ether.viewHeight * 0.35);
    }

    // Radians in, and a full turn is one field width across.
    function look(dYaw, dPitch) {
      yawTarget += dYaw;
      pitchTarget = Util.clamp(pitchTarget + dPitch, -1, 1);
    }

    function lookTo(y, p) {
      yawTarget = y;
      pitchTarget = Util.clamp(p, -1, 1);
    }

    function update(dt, time) {
      // The involuntary drift — the thing that makes a still universe
      // feel alive even when nobody touches anything.
      if (amplitude > 0) {
        var reach = Math.min(ether.viewWidth, ether.viewHeight) * amplitude;
        drift.x = reach * (Math.sin(time * rate.x1 + phase.x1) * 0.72 +
                           Math.sin(time * rate.x2 + phase.x2) * 0.28);
        drift.y = reach * (Math.cos(time * rate.y1 + phase.y1) * 0.72 +
                           Math.cos(time * rate.y2 + phase.y2) * 0.28);
      } else {
        drift.x = 0; drift.y = 0;
      }

      // The voluntary part eases toward wherever the Traveller has
      // turned. Frame-rate independent, never overshoots.
      var k = 1 - Math.exp(-ease * dt);
      yaw += (yawTarget - yaw) * k;
      pitch += (pitchTarget - pitch) * k;

      offset.x = drift.x + (yaw / (Math.PI * 2)) * ether.width;
      offset.y = drift.y + pitch * pitchLimit();
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
      amplitude: function () { return amplitude; },

      look: look,
      lookTo: lookTo,
      yaw: function () { return yaw; },
      pitch: function () { return pitch; },
      // The whole viewpoint, small enough to keep and hand back. This
      // is what lets the Traveller step into a story and return to the
      // exact same place in the Ether — see the Ether page's portal.
      state: function () { return { yaw: yawTarget, pitch: pitchTarget }; },
      restore: function (s) {
        if (!s) return;
        yawTarget = s.yaw || 0;
        pitchTarget = Util.clamp(s.pitch || 0, -1, 1);
        yaw = yawTarget;
        pitch = pitchTarget;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
