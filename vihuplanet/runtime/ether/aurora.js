// aurora.js — the Northern Lights of VihuPlanet.
//
// The Ether was correct and it was too still. A child could read it as
// a background rather than as a place, and a background is not
// something you think of exploring. This layer is the answer, and it
// is one layer rather than a set of effects because of what the sprint
// asks it to MEAN:
//
//     THE AURORA IS THE ETHER CURRENT, MADE VISIBLE.
//
// Not a decoration laid over the currents, and not a second flowing
// thing competing with them. Every ribbon is carried by the same
// curl-noise field that carries the dust, the streaks and every Story
// Spirit (ether/currents.js) — so light flows exactly where a Story
// would drift, and a child watching the sky move is watching the thing
// that moves the stories. That is why there is no separate "energy
// line" layer: there is nothing left for one to say.
//
// ---------------------------------------------------------------
// WHAT A RIBBON IS
//
// A ribbon is a curve, not a shape. It has:
//
//   · a course      — where it lies, sampled across the view
//   · an undulation — three sines of different periods, so the curve
//                     never repeats and never reads as a wave
//   · a drift       — it TRAVELS, rather than pulsing in place, and it
//                     is carried by the current field while it does
//   · an envelope   — it fades in and out along its own length, so it
//                     is light passing through rather than a band with
//                     two ends
//   · a life        — it fades up, HOLDS, and fades away over a minute
//                     or two, so the sky is never twice the same sky
//
// Drawn (in etherRenderer.js) as three strokes of decreasing width and
// increasing alpha — a wide faint halo, a middle, and a thin bright
// heart. That stack is what gives a flat stroke the soft translucent
// edge an aurora has, and it costs three lines instead of a blur
// filter, which on a full-screen layer is the most expensive thing a
// browser can be asked for.
//
// ---------------------------------------------------------------
// WHY IT IS CHEAP
//
// Thirty strokes a frame — ten ribbons, three passes — each one a
// single path of fifty-two points. That is far less than any of the
// full-screen composites it sits between, and it is the whole cost.
//
// It was tried first at a quarter of the resolution, inside the buffer
// the Story lights already use, on the reasoning that the four-times
// upscale would be a free blur. It was measurably drawn and could not
// be seen: a seven-pixel heart smeared over twenty-eight pixels has no
// edge left, and an aurora with no edge is indistinguishable from the
// mist beneath it. Softness is not the same as having no shape.
//
// ---------------------------------------------------------------
// WHAT IT MUST NOT BECOME
//
// Not neon, not a beam, not a full-screen curtain, not fast. The
// brief's own list. A ribbon is low to medium opacity, wider than it
// is bright, and slow enough that a child never sees it "animate" —
// only that the sky is flowing. Ten wide, faint ribbons across a whole
// sky is weather; the same ten at high opacity would be a light show,
// and it is the opacity that must stay low rather than the count.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var EtherNS = VihuPlanet.ns('Ether');

  // Few, and wide. See the note above — this number is the difference
  // between weather and a light show.
  // Raised, twice, and both times because the sky measurably thinned
  // between generations: every ribbon drifts the same way, so with only
  // a handful there are stretches where most of them are off to the
  // right at once and the Ether goes quiet. Ten is still weather rather
  // than a light show — they are wide and faint, and the count is what
  // keeps the sky populated rather than what makes it busy.
  var RIBBONS = 5;
  var RIBBONS_LOW = 4;

  // How many points a ribbon's curve is sampled at. Raised once the
  // ribbons were drawn at full resolution and turned up bright enough
  // to judge: at twenty-six the curve was visibly faceted, a run of
  // straight chords rather than a flowing line. It costs points on one
  // path, not strokes.
  var POINTS = 52;

  // How far past the view a ribbon may lie before it is recycled.
  // Generous, because a ribbon is wide and its halo reaches further
  // than its course does.
  var MARGIN = 260;

  EtherNS.createAurora = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var currents = opts.currents || null;
    if (!ether) return null;

    var reduced = Env.reducedMotion();
    var lowPower = Env.lowPower();
    var rng = Rng.create((opts.seed != null ? opts.seed : Rng.sessionSeed()) ^ 0xA02047);

    var ribbons = [];

    // Turquoise and lavender carry it; peach and gold arrive
    // occasionally and are what stop an aurora reading as cold light.
    // Roles, never hexes — a Story World that re-tints the Ether
    // re-tints the aurora with it and this file never learns.
    var HUES = ['aurora1', 'aurora1', 'aurora2', 'aurora2', 'aurora3', 'aurora4'];

    function spawn(r, seeded) {
      r.hue = HUES[rng.int(HUES.length)];

      // Its own length, so no two ribbons begin and end together.
      r.len = ether.viewWidth * rng.between(0.85, 1.75);

      // ANYWHERE ACROSS THE SKY, including the middle of it, and the
      // same on a respawn as on the first fill.
      //
      // A recycled ribbon used to start off the left edge and drift in.
      // That is the right instinct for dust and completely wrong here,
      // and the arithmetic says why: at ten pixels a second a ribbon
      // starting two thousand pixels out needs three minutes to reach
      // the middle of the screen, and it only lives for one. Every
      // ribbon therefore died of old age somewhere off to the left, and
      // the sky emptied a minute after it was first looked at — which
      // is exactly what a screenshot taken later than the first showed,
      // and exactly what a child would have found.
      //
      // Nothing is seen to pop into existence, because a ribbon's life
      // begins at zero brightness and swells; the fade IS the arrival.
      // Biased to the left of the view, because every ribbon drifts
      // rightward for the whole of its life: born across the right-hand
      // side it would spend most of that life leaving. Born here, it
      // crosses.
      r.x = rng.between(-r.len * 0.9, ether.viewWidth * 0.40);
      r.y = rng.between(-MARGIN * 0.5, ether.viewHeight + MARGIN * 0.5);

      // Three undulations. The periods are deliberately not multiples
      // of one another: a curve built from harmonics reads as a wave,
      // and a wave reads as an animation.
      // The undulation has to be LARGE against the thickness. Drawn
      // with a wiggle smaller than its own width, a ribbon flattens
      // into a soft bar and the eye reads haze rather than a curve —
      // measured by looking, after the first attempt came out as a
      // wash nobody could point at. A curve wider than the band is
      // what makes it a ribbon.
      r.a1 = rng.between(48, 120);
      r.a2 = rng.between(22, 58);
      r.a3 = rng.between(8, 22);
      r.k1 = rng.between(0.9, 1.6);
      r.k2 = rng.between(2.1, 3.4);
      r.k3 = rng.between(4.3, 6.7);
      r.p1 = rng.between(0, Math.PI * 2);
      r.p2 = rng.between(0, Math.PI * 2);
      r.p3 = rng.between(0, Math.PI * 2);

      // How fast the undulation itself travels along the ribbon. This
      // is the flowing, and it is the one number that decides whether
      // the sky reads as alive or as still.
      r.flow = rng.between(0.10, 0.26);

      // How fast the whole ribbon crosses the sky. Different per
      // ribbon, so they separate over time rather than sliding as one
      // sheet.
      // Slower than it was. A ribbon that crosses the view inside its
      // own lifetime spends most of that life leaving; at this pace it
      // drifts perceptibly and still stays where a child can see it.
      r.drift = rng.between(2.5, 7.5);

      r.thickness = rng.between(26, 58);
      // Halved, and then halved again. At 0.17-0.34 with a bright core
      // the sky was a light show that dominated the frame — the exact
      // thing the brief rules out, and obvious the moment it was seen on
      // a real display rather than in a headless screenshot. An aurora
      // should be something the eye finds, not something it cannot
      // avoid.
      r.alpha = rng.between(0.040, 0.090);

      // Ribbons fade in and out over minutes, so the sky is never the
      // same sky and none of them is ever seen to appear.
      r.life = seeded ? rng.next() : 0;
      r.duration = rng.between(48, 96);
    }

    function build() {
      var want = lowPower ? RIBBONS_LOW : RIBBONS;
      while (ribbons.length < want) {
        var r = {};
        spawn(r, true);
        ribbons.push(r);
      }
      for (var i = 0; i < ribbons.length; i++) ribbons[i].alive = (i < want);
    }

    function update(dt, time) {
      for (var i = 0; i < ribbons.length; i++) {
        var r = ribbons[i];
        if (!r.alive) continue;

        r.life += dt / r.duration;
        if (r.life >= 1) { spawn(r, false); continue; }

        // Carried by the Ether, not by a heading of its own. Sampled
        // once at the ribbon's own midpoint rather than per point —
        // a ribbon is one thing travelling, and sampling the field
        // twenty-six times to move it would buy nothing an eye could
        // find.
        var v = currents ? currents.sample(r.x + r.len * 0.5, r.y, time) : null;
        r.x += (r.drift + (v ? v.x * 0.9 : 0)) * dt;
        r.y += (v ? v.y * 0.9 : 0) * dt;

        // x is NOT wrapped, and that is deliberate. Wrapping it teleports
        // a ribbon a full length off the left edge, where it then spends
        // minutes drifting back — the same emptying this file already
        // had once, reintroduced by the fix for it, and visible only on
        // a small viewport where ribbons reach the right edge quickly.
        // Its LIFE is the single thing that ends a ribbon; a ribbon that
        // wanders off to the right simply lives out its days there and
        // is replaced across the sky like any other.
        if (r.y < -MARGIN) r.y = ether.viewHeight + MARGIN;
        else if (r.y > ether.viewHeight + MARGIN) r.y = -MARGIN;
      }
    }

    // How present a ribbon is, across its own life.
    //
    // A TRAPEZOID, not a sine. Under sin(life·π) a ribbon is at full
    // strength for one instant in the middle of its life and dim for
    // most of it, which with a handful of ribbons leaves windows where
    // every one of them is faint at once — measured, and the sky was
    // genuinely empty thirty seconds in. It fades in, then holds, then
    // fades out; the holding is the point.
    var FADE = 0.18;
    function presence(r) {
      var life = Util.clamp(r.life, 0, 1);
      var t = life < FADE ? life / FADE
            : (life > 1 - FADE ? (1 - life) / FADE : 1);
      return Util.smooth(Util.clamp(t, 0, 1));
    }

    // Sampled by the renderer, which owns every pixel. This returns
    // the ribbon's own y at a fraction along its length, so the
    // drawing code never has to know what a ribbon is made of.
    function heightAt(r, u, time) {
      var t = time * r.flow;
      return r.y
        + r.a1 * Math.sin(u * Math.PI * 2 * r.k1 + r.p1 + t)
        + r.a2 * Math.sin(u * Math.PI * 2 * r.k2 + r.p2 - t * 1.4)
        + r.a3 * Math.sin(u * Math.PI * 2 * r.k3 + r.p3 + t * 2.1);
    }

      build();

    return {
      ribbons: ribbons,
      update: reduced ? function () {} : update,
      heightAt: heightAt,
      presence: presence,
      points: POINTS,
      resize: build,
      count: function () {
        var n = 0;
        for (var i = 0; i < ribbons.length; i++) if (ribbons[i].alive) n++;
        return n;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
