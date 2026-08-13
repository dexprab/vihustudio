// ambientSystem.js — the universe's own restlessness.
//
// The Ether must never stop living, and it must be alive BEFORE the
// first story arrives. If a child opened VihuPlanet with zero stories
// in it, this file is most of what would have to convince them they
// had entered somewhere rather than loaded something.
//
// It owns everything that happens in the space itself rather than to a
// story:
//
//   · BREATH        the whole universe brightening and dimming as one
//                   body, on a period of minutes
//   · DUST          four layers at four depths, every mote carried by
//                   the Ether Currents
//   · STREAKS       the only layer that makes the currents themselves
//                   visible — faint marks riding the rivers
//   · MIST + NEBULA slow phases and per-bloom pulses
//   · EVENTS        shooting stars, and the small star-blooms that
//                   make an old sky feel old
//
// It writes only into `ether.ambient`, draws nothing, and has never
// heard of a story. Splitting state from drawing is what lets ambience
// keep running while a story is focused, and what would let a second
// view of the same Ether show the same shooting star.
//
// Everything is pooled — the frame loop allocates nothing, so a
// universe left open for an hour never hands the garbage collector a
// reason to stutter it.
//
// The discipline every one of these is held to, from Art Direction
// v1.0: motion is peripheral. A shooting star a child turns to look at
// has failed; one they half-see and are not sure about has worked.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var Ambient = VihuPlanet.ns('Ambient');

  // The four dust layers. `flow` is how completely a layer surrenders
  // to the Ether Currents: distant dust is barely moved by them, near
  // dust is swept along. That difference is a depth cue in its own
  // right, on top of the parallax.
  var DUST_LAYERS = [
    { key: 'far',   depth: 'farDust',    density: 30, densityLow: 18, floor: 22,
      size: [1, 1],   alpha: [0.07, 0.19], flow: 0.34, soft: false, warm: 0.06 },
    { key: 'mid',   depth: 'midDust',    density: 24, densityLow: 14, floor: 18,
      size: [1, 2],   alpha: [0.12, 0.30], flow: 0.72, soft: false, warm: 0.16 },
    { key: 'near',  depth: 'nearDust',   density: 10, densityLow: 6,  floor: 8,
      size: [4, 9],   alpha: [0.07, 0.17], flow: 1.15, soft: true,  warm: 0.34 },
    { key: 'front', depth: 'foreground', density: 2.6, densityLow: 1.6, floor: 3,
      size: [22, 52], alpha: [0.020, 0.052], flow: 1.55, soft: true, warm: 0.22 }
  ];

  var DUST_MAX = 150;          // per layer

  // FLUX LINES — the currents, made visible as flowing light.
  //
  // Promoted from a faint background detail to a named layer of the
  // universe (Sprint U2). They are not connectors between Stories and
  // they never join two of anything: they are the Ether's own rivers,
  // and every Spirit drifts along them because physics.js samples the
  // same field these do. Seeing a Spirit travel the same line a flux
  // line traced a moment earlier is the entire point.
  var STREAK_DENSITY = 26;
  var STREAK_DENSITY_LOW = 15;
  var STREAK_MAX = 52;

  // Seconds between shooting stars. Long, and deliberately variable —
  // an event on a predictable timer stops being an event.
  var SHOOT_MIN = 26;
  var SHOOT_MAX = 74;
  var SHOOT_POOL = 3;

  // Star-blooms: a single star somewhere in the sky quietly swells and
  // fades over several seconds. Much more frequent than a shooting
  // star and far less visible — this is the layer that makes the sky
  // feel ancient rather than printed.
  var BLOOM_MIN = 3.5;
  var BLOOM_MAX = 11;
  var BLOOM_POOL = 6;

  // ---------- the character of a place ----------
  //
  // How far a region can pull each atmospheric quality away from 1.
  // Small on purpose. The brief's own test is that a child thinks "I
  // wonder what's over there", not "I have entered the warm zone" — so
  // the difference has to be felt after arriving rather than seen on
  // the way. Anything past about a fifth reads as a boundary.
  var REGION_SWING = 0.20;

  // Seconds of stillness before the universe has fully answered, and
  // how long it waits first. Four seconds is long enough that it never
  // triggers while a child is deciding where to look, and short enough
  // that stopping to look at something is answered while they are
  // still looking at it.
  var STILL_DELAY = 4.0;
  var STILL_RISE = 6.0;

  Ambient.create = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var currents = opts.currents;
    var camera = opts.camera || null;
    var traveller = opts.traveller || null;
    var signal = opts.signal;
    if (!ether) return null;

    var reduced = Env.reducedMotion();
    var lowPower = Env.lowPower();
    var rng = Rng.create(Rng.sessionSeed() ^ 0x5EED);

    var amb = ether.ambient;
    var nextShot = rng.between(SHOOT_MIN, SHOOT_MAX);
    var nextBloom = rng.between(BLOOM_MIN, BLOOM_MAX);

    // ---------- dust ----------
    function budget(layer) {
      var area = (ether.viewWidth * ether.viewHeight) / 1000000;
      var n = Math.round(area * (lowPower ? layer.densityLow : layer.density));
      return Util.clamp(n, layer.floor, DUST_MAX);
    }

    function spawnMote(p, layer, seeded) {
      p.alive = true;
      p.x = rng.next() * ether.viewWidth;
      // On the first fill, motes are scattered through the whole
      // space; afterwards they enter from an edge, so the universe
      // reads as being carried through rather than as a field being
      // repopulated.
      p.y = seeded ? rng.next() * ether.viewHeight
                   : ether.viewHeight + rng.between(4, 60);
      p.size = rng.between(layer.size[0], layer.size[1]);
      p.alpha = rng.between(layer.alpha[0], layer.alpha[1]);
      p.warm = rng.next() < layer.warm;
      // Each mote's own faint pulse, so even a still layer is never
      // perfectly still.
      p.phase = rng.between(0, Math.PI * 2);
      p.pulse = rng.between(0.10, 0.34);
      // A small personal rise on top of the current, so motes in the
      // same river are not perfectly locked to each other.
      //
      // Roughly doubled. A mote rising at 1.6px/s crosses a tenth of
      // the screen in a minute, which is motion only in the sense that
      // it is not zero — and the whole point of this pass is that the
      // Ether must read as moving within a few seconds of looking at
      // it. At 4-11px/s a child can follow one with their eye, which
      // is the test.
      p.rise = rng.between(4.0, 11.0);
      p.sway = rng.between(0.9, 2.8);
    }

    function buildDust() {
      for (var i = 0; i < DUST_LAYERS.length; i++) {
        var layer = DUST_LAYERS[i];
        var store = amb.dust[i];
        if (!store) {
          store = amb.dust[i] = {
            key: layer.key,
            parallax: ether.depth[layer.depth],
            soft: layer.soft,
            motes: []
          };
        }
        var want = budget(layer);
        while (store.motes.length < want) {
          var p = {};
          spawnMote(p, layer, true);
          store.motes.push(p);
        }
        // A shrunken viewport parks the surplus rather than discarding
        // it — the pool never shrinks, so rotating back never has to
        // allocate again.
        for (var m = 0; m < store.motes.length; m++) {
          store.motes[m].alive = (m < want);
        }
      }
    }

    function driftDust(dt, time) {
      var margin = 70;
      for (var i = 0; i < amb.dust.length; i++) {
        var store = amb.dust[i];
        var layer = DUST_LAYERS[i];
        for (var m = 0; m < store.motes.length; m++) {
          var p = store.motes[m];
          if (!p.alive) continue;

          // The Ether carries it. This is the whole point of the
          // layer: nothing chooses its own direction, everything
          // travels with the current it happens to be in — and dust
          // is light enough to show the current bending around a
          // story, which the stories themselves are far too slow to
          // reveal.
          var v = currents
            ? currents.sampleBent(p.x, p.y, time, ether.lights)
            : null;
          var vx = v ? v.x * layer.flow : 0;
          var vy = v ? v.y * layer.flow : 0;

          p.x += (vx + Math.sin(time * 0.11 + p.phase) * p.sway) * dt;
          p.y += (vy - p.rise) * dt;

          if (p.y < -margin) { spawnMote(p, layer, false); continue; }
          if (p.y > ether.viewHeight + margin) p.y = -margin;
          if (p.x < -margin) p.x = ether.viewWidth + margin;
          else if (p.x > ether.viewWidth + margin) p.x = -margin;
        }
      }
    }

    // ---------- streaks: the rivers, made faintly visible ----------
    // A streak is a short trail of remembered positions, not a line
    // drawn along an instantaneous heading. The difference is the
    // whole layer: a straight segment at a visible alpha reads as a
    // scratch on the lens, while a path that curves the way the river
    // curved reads as flow. It costs seven points of memory each.
    var STREAK_POINTS = 9;
    var STREAK_SAMPLE = 0.8;       // seconds between remembered points

    function spawnStreak(s, seeded) {
      s.alive = true;
      s.x = rng.next() * ether.viewWidth;
      s.y = rng.next() * ether.viewHeight;
      s.alpha = rng.between(0.07, 0.17);
      s.width = rng.between(0.8, 1.7);
      s.life = 0;
      s.duration = rng.between(16, 34);
      // A current is not one colour. Most are the Ether's own cream,
      // but a good number carry gold, lavender or peach — which is what
      // turns "faint white lines" into light with a temperature. The
      // roles are named rather than mixed here so a future Story World
      // re-tinting the Ether re-tints these too.
      s.warm = rng.next() < 0.28;
      s.hue = rng.next() < 0.34
        ? (rng.next() < 0.5 ? 'mist' : 'warm')
        : null;
      s.timer = 0;
      if (!s.pts) {
        s.pts = [];
        for (var i = 0; i < STREAK_POINTS; i++) s.pts.push({ x: 0, y: 0 });
      }
      // The trail starts collapsed onto the head, so a new streak
      // grows its tail rather than appearing with one.
      for (var j = 0; j < s.pts.length; j++) { s.pts[j].x = s.x; s.pts[j].y = s.y; }
      s.filled = 1;
    }

    function buildStreaks() {
      var area = (ether.viewWidth * ether.viewHeight) / 1000000;
      var want = Util.clamp(
        Math.round(area * (lowPower ? STREAK_DENSITY_LOW : STREAK_DENSITY)),
        7, STREAK_MAX);
      while (amb.streaks.length < want) {
        var s = {};
        spawnStreak(s, true);
        amb.streaks.push(s);
      }
      for (var i = 0; i < amb.streaks.length; i++) amb.streaks[i].alive = (i < want);
    }

    function driftStreaks(dt, time) {
      for (var i = 0; i < amb.streaks.length; i++) {
        var s = amb.streaks[i];
        if (!s.alive) continue;
        s.life += dt / s.duration;
        if (s.life >= 1) { spawnStreak(s, false); continue; }

        var v = currents ? currents.sample(s.x, s.y, time) : null;
        if (!v) continue;
        // Streaks ride the current faster than anything else, because
        // they are how it is read. Still slow in absolute terms — a
        // streak crosses the view in something like a minute.
        //
        // The region's own flux scales that pace, so a part of the
        // Ether where the currents run stronger genuinely moves faster
        // rather than merely looking brighter.
        var f = 2.6 * region.flux;
        s.x += v.x * f * dt;
        s.y += v.y * f * dt;

        // Remember where it has been. Points shuffle down the trail,
        // so pts[0] is always the head and the last one is the oldest.
        s.timer += dt;
        if (s.timer >= STREAK_SAMPLE) {
          s.timer = 0;
          for (var q = s.pts.length - 1; q > 0; q--) {
            s.pts[q].x = s.pts[q - 1].x;
            s.pts[q].y = s.pts[q - 1].y;
          }
          if (s.filled < s.pts.length) s.filled++;
        }
        s.pts[0].x = s.x;
        s.pts[0].y = s.y;

        if (s.x < -120 || s.x > ether.viewWidth + 120 ||
            s.y < -120 || s.y > ether.viewHeight + 120) spawnStreak(s, false);
      }
    }

    // ---------- events ----------
    for (var sh = 0; sh < SHOOT_POOL; sh++) {
      amb.shootingStars.push({ alive: false, x: 0, y: 0, dx: 0, dy: 0, tail: 0, life: 0, speed: 0, duration: 1 });
    }
    var blooms = amb.starBlooms = [];
    for (var bl = 0; bl < BLOOM_POOL; bl++) {
      blooms.push({ alive: false, x: 0, y: 0, life: 0, duration: 1, radius: 3, warm: false });
    }

    function launchShootingStar() {
      var shot = null;
      for (var i = 0; i < amb.shootingStars.length; i++) {
        if (!amb.shootingStars[i].alive) { shot = amb.shootingStars[i]; break; }
      }
      if (!shot) return;   // three at once is already more than "rare"

      // Always across the upper part of the sky and always
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

    function launchBloom() {
      for (var i = 0; i < blooms.length; i++) {
        var b = blooms[i];
        if (b.alive) continue;
        b.x = rng.next() * ether.viewWidth;
        b.y = rng.next() * ether.viewHeight;
        b.radius = rng.between(6, 17);
        b.duration = rng.between(3.2, 7.5);
        b.warm = rng.next() < 0.3;
        b.life = 0;
        b.alive = true;
        return;
      }
    }

    function updateEvents(dt) {
      var i;
      for (i = 0; i < amb.shootingStars.length; i++) {
        var shot = amb.shootingStars[i];
        if (!shot.alive) continue;
        shot.life += dt / shot.duration;
        if (shot.life >= 1) { shot.alive = false; continue; }
        shot.x += shot.dx * shot.speed * dt;
        shot.y += shot.dy * shot.speed * dt;
      }
      for (i = 0; i < blooms.length; i++) {
        var b = blooms[i];
        if (!b.alive) continue;
        b.life += dt / b.duration;
        if (b.life >= 1) b.alive = false;
      }
    }

    // ---------- where they are looking, and how it feels there ----------
    //
    // Four qualities, each a sum of two incommensurate sines of yaw and
    // pitch. Sines because the universe WRAPS: turning a full circle
    // has to arrive back at the same character exactly, and a function
    // built from sin(yaw) does that by construction rather than by
    // anybody remembering to make the ends meet. Two frequencies per
    // quality, chosen not to share a period, so the four never line up
    // into a grid a child could learn.
    //
    // Nothing here is a zone. There is no boundary anywhere in it, no
    // name, no label, and no moment of entering one — the whole field
    // is continuous, and the only way to notice it is to be somewhere
    // for a while and then be somewhere else.
    //
    // Eased rather than read directly, so even a fast turn arrives
    // somewhere new gradually. The camera can swing faster than the
    // atmosphere should change.
    var region = amb.region;
    function updateRegion(dt) {
      if (!camera) return;
      var y = camera.yaw();
      var p = camera.pitch();

      var warmth = 0.62 * Math.sin(y * 0.83 + 0.4) + 0.38 * Math.sin(p * 1.21 - 1.1);
      var mist   = 0.58 * Math.sin(y * 1.13 + 2.7) + 0.42 * Math.sin(p * 0.71 + 0.9);
      var flux   = 0.55 * Math.sin(y * 0.67 - 1.9) + 0.45 * Math.sin(p * 1.37 + 2.2);
      var spark  = 0.60 * Math.sin(y * 1.49 + 3.3) + 0.40 * Math.sin(p * 0.91 - 0.6);

      var k = 1 - Math.exp(-0.55 * dt);
      region.warmth += ((1 + warmth * REGION_SWING) - region.warmth) * k;
      region.mist   += ((1 + mist   * REGION_SWING) - region.mist)   * k;
      region.flux   += ((1 + flux   * REGION_SWING) - region.flux)   * k;
      region.sparkle += ((1 + spark * REGION_SWING) - region.sparkle) * k;
    }

    // ---------- the universe answering stillness ----------
    //
    // Not a trigger and not an event. One number that rises while
    // nobody is turning the universe and falls the instant they are —
    // the layers that read it simply become slightly more present, so
    // what a child experiences is the place continuing to live rather
    // than anything happening AT them.
    //
    // It falls faster than it rises. Arriving is a mood; leaving is a
    // response to the child, and a response that lagged would feel like
    // the universe was slow rather than calm.
    function updateStillness(dt) {
      if (!traveller || !traveller.stillSeconds) return;
      var held = traveller.stillSeconds();
      var want = Util.clamp((held - STILL_DELAY) / STILL_RISE, 0, 1);
      var rate = want > amb.stillness ? 0.5 : 2.4;
      amb.stillness += (want - amb.stillness) * (1 - Math.exp(-rate * dt));
    }

    // ---------- the frame ----------
    function update(dt, time) {
      // The universe breathing. Three incommensurate periods, so it
      // never repeats and never has a rhythm anyone could count. The
      // swing is deliberately tiny — ±6% — because the goal is that a
      // child never sees it change, only that the place was warmer a
      // while ago than it is now.
      amb.breath = 1
        + 0.036 * Math.sin(time * 0.047)
        + 0.018 * Math.sin(time * 0.113 + 1.7)
        + 0.009 * Math.sin(time * 0.263 + 4.1);

      amb.glow = 0.5 + 0.5 * Math.sin(time * 0.052);

      // Both are cheap arithmetic and both must keep running under
      // reduced motion — they are not motion. A region is where you
      // are, and stillness is a mood; a child who has asked for less
      // movement has not asked for a colder universe.
      updateRegion(dt);
      updateStillness(dt);

      // Per-bloom nebula pulses, each on its own slow rhythm, so the
      // deep background is never uniformly lit.
      for (var i = 0; i < amb.nebulaPulse.length; i++) {
        amb.nebulaPulse[i] = 1 + 0.22 * Math.sin(time * (0.021 + i * 0.007) + i * 2.3);
      }

      if (reduced) return;   // a still, complete universe — see physics.js

      // Three mist banks on three unrelated rates. Chosen so no two
      // ratios are simple: the banks never realign, so the field never
      // shows a period.
      amb.mistPhase[0] += dt * 0.031;
      amb.mistPhase[1] += dt * 0.019;
      amb.mistPhase[2] += dt * 0.043;

      driftDust(dt, time);
      driftStreaks(dt, time);

      nextShot -= dt;
      if (nextShot <= 0) {
        launchShootingStar();
        nextShot = rng.between(SHOOT_MIN, SHOOT_MAX);
      }
      nextBloom -= dt;
      if (nextBloom <= 0) {
        launchBloom();
        nextBloom = rng.between(BLOOM_MIN, BLOOM_MAX);
      }
      updateEvents(dt);
    }

    function resize() {
      buildDust();
      buildStreaks();
      for (var i = 0; i < amb.dust.length; i++) {
        amb.dust[i].parallax = ether.depth[DUST_LAYERS[i].depth];
      }
    }

    resize();

    return {
      update: update,
      resize: resize,
      // Exposed so a harness can demonstrate a shooting star on
      // demand. Nothing in the runtime calls it — the universe decides
      // when they happen.
      shootNow: launchShootingStar,
      stats: function () {
        var live = 0;
        for (var i = 0; i < amb.dust.length; i++) {
          for (var m = 0; m < amb.dust[i].motes.length; m++) {
            if (amb.dust[i].motes[m].alive) live++;
          }
        }
        var streaks = 0;
        for (var s = 0; s < amb.streaks.length; s++) if (amb.streaks[s].alive) streaks++;
        return { particles: live, streaks: streaks, nextShootingStar: Math.max(0, nextShot) };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
