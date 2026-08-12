// currents.js — Ether Currents. The invisible rivers of VihuPlanet.
//
// Stories do not drift randomly. The ETHER moves, and stories travel
// with it. That is the whole difference between a screensaver and a
// place: in a screensaver every object has its own arbitrary heading,
// and the eye reads noise. In a current, things that are near each
// other move together, and the eye reads *direction* — a sense that
// this space is going somewhere, even though nothing about it is ever
// consciously noticed.
//
// ---------------------------------------------------------------
// WHY CURL NOISE, AND NOT "A FEW SINE WAVES"
//
// The obvious way to build a flow field is to sample some noise for
// the x speed and some other noise for the y speed. It looks wrong
// within about a minute, and the reason is worth writing down: such a
// field has sources and sinks. There are places where flow converges,
// and everything drifting in the Ether slowly collects there and
// stays. A universe that silently sweeps every story into three
// corners is worse than one that drifts at random.
//
// So the field here is the CURL of a scalar potential:
//
//     v = ( ∂ψ/∂y , -∂ψ/∂x )
//
// The curl of anything is divergence-free by construction — it has no
// sources and no sinks anywhere, ever. Nothing collects. Stories
// circulate forever, and the proof is calculus rather than tuning.
//
// ψ is a sum of three octaves of products of sines, so the
// derivatives are exact and analytic: six sin/cos calls per sample, no
// gradient tables, no noise textures, nothing to precompute or store.
// ---------------------------------------------------------------
//
// The field also drifts in time, slowly, so the rivers themselves
// wander over the course of minutes. A current a child sees on
// Tuesday is not the current they see on Wednesday.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Rng = VihuPlanet.Rng;
  var EtherNS = VihuPlanet.ns('Ether');

  // The three octaves, as multiples of the view's width. Wavelengths
  // are tied to the VIEW rather than the field so the visual scale of
  // the currents stays the same as the universe grows — a river should
  // look like a river on screen whether VihuPlanet holds twenty
  // stories or six hundred.
  // These are wide on purpose, and the width was measured. A river
  // narrower than the screen is not a river — it is turbulence, and
  // the eye reads it as the same noise the currents exist to replace.
  // With a smallest octave at 0.38 view-widths, stories within 400px
  // of each other aligned at only 0.20 (where 1.0 is moving in
  // identical directions). Widening the field to these values is what
  // makes neighbours visibly travel together.
  var OCTAVES = [
    { wavelength: 3.20, amplitude: 1.00, drift: 0.011 },
    { wavelength: 1.55, amplitude: 0.34, drift: 0.018 },
    { wavelength: 0.78, amplitude: 0.11, drift: 0.029 }
  ];

  EtherNS.createCurrents = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    if (!ether) return null;

    var rng = Rng.create((opts.seed != null ? opts.seed : Rng.sessionSeed()) ^ 0xC0FFEE);

    // Each octave gets its own phase offsets so the three of them
    // never line up into a visible grid.
    var oct = OCTAVES.map(function (o) {
      return {
        amp: o.amplitude,
        drift: o.drift,
        phaseX: rng.between(0, Math.PI * 2),
        phaseY: rng.between(0, Math.PI * 2),
        wavelength: o.wavelength
      };
    });

    // Overall strength, in field pixels per second. This is the pace
    // of the universe itself, and everything that floats in it
    // inherits it.
    var strength = opts.strength || 7.0;

    // Deflection around light sources — "the Ether bends around the
    // story". Applied on top of the base field, and deliberately weak:
    // it should be felt as dust curving past a story, never seen as an
    // orbit.
    var bendRadius = opts.bendRadius || 190;
    var bendStrength = opts.bendStrength || 0.55;

    // Reused so sampling allocates nothing. Callers that keep a result
    // must copy it — every consumer in the runtime reads it
    // immediately, which is why one shared vector is safe.
    var out = { x: 0, y: 0 };

    function sample(x, y, time) {
      var vx = 0, vy = 0;
      var base = 2 * Math.PI / Math.max(1, ether.viewWidth);

      for (var i = 0; i < oct.length; i++) {
        var o = oct[i];
        var k = base / o.wavelength;          // spatial frequency
        var t = time * o.drift;

        var sx = Math.sin(k * x + o.phaseX + t);
        var cx = Math.cos(k * x + o.phaseX + t);
        var sy = Math.sin(k * y + o.phaseY - t);
        var cy = Math.cos(k * y + o.phaseY - t);

        //  ψ_i = amp * sin(kx + φx + t) * sin(ky + φy - t)
        //  ∂ψ/∂y =  amp * k * sin(kx…) * cos(ky…)
        // -∂ψ/∂x = -amp * k * cos(kx…) * sin(ky…)
        //
        // The 1/k on the amplitude cancels the k the derivative
        // introduces, so every octave contributes at the strength it
        // was given rather than at the strength its frequency implies.
        vx += o.amp * sx * cy;
        vy -= o.amp * cx * sy;
      }

      out.x = vx * strength;
      out.y = vy * strength;
      return out;
    }

    // Same field, plus a soft sideways push around anything luminous.
    // Used by the dust, which is what makes the bending visible — the
    // stories themselves are far too slow to show it.
    function sampleBent(x, y, time, lights) {
      sample(x, y, time);
      if (!lights || !lights.length) return out;

      for (var i = 0; i < lights.length; i++) {
        var l = lights[i];
        if (!l.alive) continue;
        var dx = x - l.x;
        var dy = y - l.y;
        var d2 = dx * dx + dy * dy;
        var r = bendRadius * (l.scale || 1);
        if (d2 >= r * r || d2 < 1) continue;

        var d = Math.sqrt(d2);
        // Falls off to nothing at the edge of the radius, so dust
        // entering a story's neighbourhood is never seen to "enter"
        // anything.
        var fall = (1 - d / r);
        fall *= fall;
        // Perpendicular to the story, not away from it: dust sweeps
        // AROUND rather than being repelled, which is what reads as
        // the space curving instead of the story pushing.
        out.x += (-dy / d) * fall * bendStrength * strength;
        out.y += (dx / d) * fall * bendStrength * strength;
      }
      return out;
    }

    return {
      sample: sample,
      sampleBent: sampleBent,
      strength: function () { return strength; },
      setStrength: function (v) { strength = v; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
