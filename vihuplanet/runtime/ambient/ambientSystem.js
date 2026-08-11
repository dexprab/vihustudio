// ambientSystem.js — the universe's own restlessness.
//
// The Ether must never stop living, including in the long stretches
// when nobody touches anything. This system owns everything that
// happens in the space itself rather than to a story: the slow swell
// of warmth, the drift of the mist banks, the dust the universe
// carries, and the rare shooting star.
//
// It writes only into `ether.ambient`. It draws nothing — the Ether
// Renderer reads that state and paints it. Splitting the two is what
// lets ambience keep running while a story is focused, and what lets a
// future second view of the same Ether show the same shooting star.
//
// The discipline every ambient event here is held to, from Art
// Direction v1.0: motion is peripheral. Nothing may pull attention
// away from the stories. A shooting star that a child turns to look at
// has failed; one they half-see and are not sure about has worked.
//
// Both the particles and the shooting stars are pooled. Objects are
// created once, marked dead, and revived — the frame loop allocates
// nothing, so a universe left open for an hour never hands the
// garbage collector a reason to stutter it.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var Ambient = VihuPlanet.ns('Ambient');

  var PARTICLE_DENSITY = 46;       // per million square px of field
  var PARTICLE_DENSITY_LOW = 30;
  var PARTICLE_MAX = 140;
  // Same reasoning as the star floor in etherRenderer.js: density
  // alone leaves a phone-sized field with a handful of motes, which
  // reads as a dead universe rather than a small one.
  var PARTICLE_FLOOR = 24;

  // Seconds between shooting stars. Long, and deliberately variable —
  // an event on a predictable timer stops being an event.
  var SHOOT_MIN = 26;
  var SHOOT_MAX = 74;
  var SHOOT_POOL = 3;

  Ambient.create = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var signal = opts.signal;
    if (!ether) return null;

    var reduced = Env.reducedMotion();
    var lowPower = Env.lowPower();
    var rng = Rng.create(Rng.sessionSeed() ^ 0x5EED);

    var amb = ether.ambient;
    var nextShot = rng.between(SHOOT_MIN, SHOOT_MAX);

    // ---------- particles ----------
    function particleBudget() {
      var area = (ether.viewWidth * ether.viewHeight) / 1000000;
      var n = Math.round(area * (lowPower ? PARTICLE_DENSITY_LOW : PARTICLE_DENSITY));
      return Util.clamp(n, PARTICLE_FLOOR, PARTICLE_MAX);
    }

    function spawnParticle(p, seeded) {
      p.alive = true;
      p.x = rng.next() * ether.viewWidth;
      // On the first fill, motes are scattered through the whole
      // field; afterwards they enter from below, so the universe
      // reads as drifting upward rather than as a field being
      // repopulated.
      p.y = seeded ? rng.next() * ether.viewHeight : ether.viewHeight + rng.between(4, 60);
      p.size = rng.next() < 0.8 ? 1 : 2;
      p.rise = rng.between(2.4, 9.5);          // px/s upward
      p.swayAmp = rng.between(2, 11);
      p.swayRate = rng.between(0.08, 0.26);
      p.phase = rng.between(0, Math.PI * 2);
      p.baseX = p.x;
      p.alpha = rng.between(0.10, 0.42);
      p.warm = rng.next() < 0.22;              // a few carry the candle
    }

    function buildParticles() {
      var want = particleBudget();
      while (amb.particles.length < want) {
        var p = {};
        spawnParticle(p, true);
        amb.particles.push(p);
      }
      // Shrinking the field parks the surplus rather than discarding
      // it — the pool never shrinks, so a rotation back never has to
      // allocate again.
      for (var i = 0; i < amb.particles.length; i++) {
        amb.particles[i].alive = (i < want);
      }
    }

    function updateParticles(dt, time) {
      for (var i = 0; i < amb.particles.length; i++) {
        var p = amb.particles[i];
        if (!p.alive) continue;
        p.y -= p.rise * dt;
        p.x = p.baseX + Math.sin(time * p.swayRate + p.phase) * p.swayAmp;
        if (p.y < -20) {
          spawnParticle(p, false);
          p.baseX = p.x;
        }
      }
    }

    // ---------- shooting stars ----------
    for (var s = 0; s < SHOOT_POOL; s++) {
      amb.shootingStars.push({ alive: false, x: 0, y: 0, dx: 0, dy: 0, tail: 0, life: 0, speed: 0, duration: 1 });
    }

    function launchShootingStar() {
      var shot = null;
      for (var i = 0; i < amb.shootingStars.length; i++) {
        if (!amb.shootingStars[i].alive) { shot = amb.shootingStars[i]; break; }
      }
      if (!shot) return;   // three at once is already more than "rare"

      // Always across the upper part of the field and always
      // shallow-downward, which is what a distant meteor looks like.
      // Steep or upward streaks read as a rocket, and VihuPlanet
      // removed its rocket on purpose.
      var fromLeft = rng.next() < 0.5;
      var angle = rng.between(0.16, 0.42) * (fromLeft ? 1 : -1);
      shot.x = fromLeft ? -40 : ether.viewWidth + 40;
      shot.y = rng.between(0.05, 0.45) * ether.viewHeight;
      shot.dx = (fromLeft ? 1 : -1) * Math.cos(angle);
      shot.dy = Math.sin(Math.abs(angle));
      shot.speed = rng.between(420, 700);
      shot.tail = rng.between(56, 130);
      shot.duration = rng.between(0.9, 1.6);
      shot.life = 0;
      shot.alive = true;

      if (signal) signal.emit('ambient:shootingStar', { x: shot.x, y: shot.y });
    }

    function updateShootingStars(dt) {
      for (var i = 0; i < amb.shootingStars.length; i++) {
        var shot = amb.shootingStars[i];
        if (!shot.alive) continue;
        shot.life += dt / shot.duration;
        if (shot.life >= 1) { shot.alive = false; continue; }
        shot.x += shot.dx * shot.speed * dt;
        shot.y += shot.dy * shot.speed * dt;
      }
    }

    // ---------- the frame ----------
    function update(dt, time) {
      // The glow swells over roughly two minutes. A child will never
      // catch it moving; they will only notice that the universe was
      // warmer a while ago than it is now.
      amb.glow = 0.5 + 0.5 * Math.sin(time * 0.052);

      if (reduced) return;   // a still, complete universe — see physics.js

      // Three mist banks on three unrelated rates. Chosen so no two
      // ratios are simple: the banks never realign, so the field never
      // shows a period.
      amb.mistPhase[0] += dt * 0.031;
      amb.mistPhase[1] += dt * 0.019;
      amb.mistPhase[2] += dt * 0.043;

      updateParticles(dt, time);

      nextShot -= dt;
      if (nextShot <= 0) {
        launchShootingStar();
        nextShot = rng.between(SHOOT_MIN, SHOOT_MAX);
      }
      updateShootingStars(dt);
    }

    buildParticles();

    return {
      update: update,
      resize: buildParticles,
      // Exposed so the sandbox can demonstrate a shooting star on
      // demand. Nothing in the runtime calls it — the universe decides
      // when they happen.
      shootNow: launchShootingStar,
      stats: function () {
        var live = 0;
        for (var i = 0; i < amb.particles.length; i++) if (amb.particles[i].alive) live++;
        return { particles: live, nextShootingStar: Math.max(0, nextShot) };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
