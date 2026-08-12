// physics.js — Ether Physics. The natural laws of VihuPlanet.
//
// Independent by design: it takes a list of Story Entities, a time
// step and a field, and it writes position, velocity and rotation. It
// touches no DOM, creates no elements, reads no images, and has never
// heard of a renderer. Swap the presentation layer entirely and this
// file does not change.
//
// The four laws, in the order they are applied:
//
//   1. Current   — the Ether moves, and a story is carried by it. Its
//                  velocity eases toward the local current plus its
//                  own small personal drift.
//
//                  This replaced a per-story random "wander", and the
//                  difference is the whole of Sprint U1's premise: in
//                  a wander, every object has an arbitrary heading and
//                  the eye reads noise. In a current, things near each
//                  other move TOGETHER, and the eye reads direction —
//                  a sense that this space is going somewhere, without
//                  a child ever consciously noticing why.
//
//                  The easing is also what keeps the field cool. A
//                  story pushed by avoidance is drawn back to the pace
//                  of its river within a few seconds, so no separate
//                  speed governor is needed.
//   2. Avoidance — a soft push away from anything crowding it. Not a
//                  collision: stories never bounce, they ease apart.
//                  It matters more now than it did: stories sharing a
//                  current no longer separate on their own.
//   3. Attraction— a gentle spring toward `entity.anchor`, if one
//                  exists. Nothing sets an anchor. This is the plug
//                  point Story World clustering will use, and the
//                  reason clustering will not require a physics
//                  rewrite.
//   4. Drift     — integrate, spin, bob, wrap.
//
// The bob (that tiny floating motion) is deliberately NOT integrated
// into position. It is written to `bobX` / `bobY` and added by the
// renderer at draw time, so a story bobbing near a neighbour does not
// make the two of them shove each other back and forth once a second.
// Presentation motion must never feed back into simulation.
//
// prefers-reduced-motion is honoured here, at the source: motionScale
// goes to 0 and the universe becomes a still, complete picture rather
// than a moving one. Nothing downstream has to check again.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Physics = VihuPlanet.ns('Physics');
  var STATES = VihuPlanet.Stories.STATES;

  var DEFAULTS = {
    // How hard a crowded story is pushed away, in px/s². Low: the
    // separation should be felt over a few seconds, never seen as a
    // reaction.
    avoidStrength: 58,
    // Personal space, as a multiple of the two radii involved.
    avoidPadding: 1.15,
    // How quickly a story gives itself up to the current it is in
    // (1/s). A time constant of about four seconds: fast enough that
    // a story pushed aside rejoins the flow while you watch, slow
    // enough that it never looks steered.
    surrender: 0.26,
    // Hard ceiling. A story should never outrun a slow walk across
    // the field, whatever forces stack up.
    maxSpeed: 26,
    // How far past the edge a story travels before it re-enters from
    // the opposite side. Big enough that the wrap happens off-screen.
    wrapMargin: 140
  };

  Physics.create = function (opts) {
    opts = opts || {};
    var cfg = {};
    for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) cfg[k] = DEFAULTS[k];
    if (opts.config) for (var j in opts.config) if (cfg.hasOwnProperty(j)) cfg[j] = opts.config[j];

    var grid = Physics.createGrid(opts.cellSize || 170);
    var currents = opts.currents || null;
    var motionScale = (typeof opts.motionScale === 'number') ? opts.motionScale : 1;

    // Scratch vector, reused every frame for every entity. Allocating
    // one {x,y} per story per frame is 60 × N objects a second for the
    // garbage collector to deal with, which is exactly the kind of
    // cost that turns a calm universe into a stuttering one.
    var push = { x: 0, y: 0 };

    function isSimulated(e) {
      // Focused and returning stories are held: their place in the
      // Ether is reserved, unchanged, for as long as a child is
      // looking at them. Birthing stories belong to the Birth system
      // until they join.
      return e.state === STATES.DRIFTING;
    }

    function avoid(e, dt) {
      push.x = 0;
      push.y = 0;
      var count = 0;

      grid.forEachNear(e, function (other) {
        if (other === e || other.state !== STATES.DRIFTING) return;
        var dx = e.position.x - other.position.x;
        var dy = e.position.y - other.position.y;
        var distSq = dx * dx + dy * dy;
        if (distSq <= 0.0001) {
          // Exactly coincident (two stories seeded onto the same
          // pixel). Nudge on a deterministic axis rather than a random
          // one so the same universe resolves the same way twice.
          dx = 0.5;
          dy = 0.0;
          distSq = 0.25;
        }
        var want = (e.radius + other.radius) * cfg.avoidPadding;
        if (distSq >= want * want) return;

        var dist = Math.sqrt(distSq);
        // Falls off to nothing exactly at the personal-space edge, so
        // stories drifting apart never feel a sudden release.
        var strength = (1 - dist / want);
        push.x += (dx / dist) * strength;
        push.y += (dy / dist) * strength;
        count += 1;
      });

      if (!count) return;
      e.velocity.x += push.x * cfg.avoidStrength * dt;
      e.velocity.y += push.y * cfg.avoidStrength * dt;
    }

    function attract(e, dt) {
      var a = e.anchor;
      if (!a) return;
      // A spring, not a magnet: the further a story is from where its
      // future World wants it, the more it is drawn — but always
      // gently, and always as a force on velocity so the story
      // arrives with its own momentum rather than snapping into place.
      var strength = (typeof a.strength === 'number') ? a.strength : 0.6;
      e.velocity.x += (a.x - e.position.x) * strength * dt;
      e.velocity.y += (a.y - e.position.y) * strength * dt;
    }

    // The Ether carries it. Exponential approach — frame-rate
    // independent, never overshoots, so a story eases into its river
    // instead of oscillating around it.
    function carry(e, dt, time) {
      if (!currents) return;
      var v = currents.sample(e.position.x, e.position.y, time);
      var wantX = v.x * e.flow + e.personal.x;
      var wantY = v.y * e.flow + e.personal.y;
      var k = 1 - Math.exp(-cfg.surrender * dt);
      e.velocity.x += (wantX - e.velocity.x) * k;
      e.velocity.y += (wantY - e.velocity.y) * k;
    }

    function capSpeed(e) {
      var vx = e.velocity.x, vy = e.velocity.y;
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed <= cfg.maxSpeed || speed < 0.0001) return;
      var k = cfg.maxSpeed / speed;
      e.velocity.x = vx * k;
      e.velocity.y = vy * k;
    }

    function wrap(e, field) {
      var m = cfg.wrapMargin;
      if (e.position.x < -m) e.position.x = field.width + m;
      else if (e.position.x > field.width + m) e.position.x = -m;
      if (e.position.y < -m) e.position.y = field.height + m;
      else if (e.position.y > field.height + m) e.position.y = -m;
    }

    function step(entities, dt, time, field) {
      var i, e;

      // The bob runs for every story in every state, including a
      // focused one — the universe does not hold its breath while a
      // child reads. It is presentation-only (see the header), so it
      // is safe to advance outside the simulation gate.
      for (i = 0; i < entities.length; i++) {
        e = entities[i];
        e.bob.phase += e.bob.speed * dt * motionScale;
        var amp = e.bob.amplitude * motionScale;
        e.bobY = Math.sin(e.bob.phase) * amp;
        // A third of the vertical amplitude, at a different rate:
        // enough that the motion reads as floating in space rather
        // than bouncing on a spring.
        e.bobX = Math.cos(e.bob.phase * 0.63) * amp * 0.34;
      }

      if (motionScale <= 0) return;   // reduced motion: a still universe

      grid.build(entities);

      for (i = 0; i < entities.length; i++) {
        e = entities[i];
        if (!isSimulated(e)) continue;

        carry(e, dt, time);
        avoid(e, dt);
        attract(e, dt);
        capSpeed(e);

        e.position.x += e.velocity.x * dt * motionScale;
        e.position.y += e.velocity.y * dt * motionScale;

        e.rotation += e.spin * dt * motionScale;
        if (e.rotation > 180) e.rotation -= 360;
        else if (e.rotation < -180) e.rotation += 360;

        wrap(e, field);
      }
    }

    return {
      step: step,
      config: cfg,
      grid: grid,
      setMotionScale: function (v) { motionScale = Util.clamp(v, 0, 1); },
      motionScale: function () { return motionScale; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
