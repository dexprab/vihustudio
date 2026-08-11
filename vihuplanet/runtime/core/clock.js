// clock.js — the universe's single heartbeat.
//
// One requestAnimationFrame loop drives everything. Not one per
// system, not one per story: a hundred drifting stories on a hundred
// timers is the shape that makes a page hot, and the runtime is meant
// to be light enough to leave running behind a child's whole session.
//
// What the clock guarantees to every system:
//
//   · dt is in SECONDS, not milliseconds. Physics reads far better
//     in seconds, and every drift speed in the runtime is expressed
//     as "units per second" so it stays frame-rate independent.
//   · dt is clamped. A backgrounded tab, a long GC pause or a
//     breakpoint would otherwise hand physics a 4-second step and
//     teleport every story across the field.
//   · The loop stops entirely when the tab is hidden and resumes
//     without a jump. A universe nobody is looking at costs nothing.
//
// The clock knows nothing about what it drives — it holds a list of
// update functions and calls them in order.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Clock = VihuPlanet.ns('Clock');

  // 1/15s. Anything slower than 15fps is a stall, not a frame, and
  // should be treated as a pause rather than simulated through.
  var MAX_STEP = 0.0667;

  Clock.create = function () {
    var updaters = [];
    var running = false;
    var rafId = 0;
    var last = 0;
    var elapsed = 0;
    var frame = 0;

    function tick(now) {
      if (!running) return;
      rafId = global.requestAnimationFrame(tick);

      var dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) return;          // first frame, or a clock oddity
      if (dt > MAX_STEP) dt = MAX_STEP;

      elapsed += dt;
      frame += 1;

      for (var i = 0; i < updaters.length; i++) {
        updaters[i](dt, elapsed, frame);
      }
    }

    function start() {
      if (running) return;
      running = true;
      last = (global.performance && performance.now) ? performance.now() : Date.now();
      rafId = global.requestAnimationFrame(tick);
    }

    function stop() {
      if (!running) return;
      running = false;
      if (rafId) global.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    // The tab going away is not the same as the universe being told to
    // stop: `wasRunning` is what lets a return to the tab resume
    // exactly what was happening, with `last` reset so no giant dt is
    // ever delivered.
    var wasRunning = false;
    function onVisibility() {
      if (global.document.hidden) {
        wasRunning = running;
        stop();
      } else if (wasRunning) {
        start();
      }
    }
    global.document.addEventListener('visibilitychange', onVisibility);

    return {
      // Update functions run in registration order. The Universe
      // registers them in dependency order (state → physics →
      // presentation), which is the only ordering the runtime needs.
      add: function (fn) {
        if (typeof fn === 'function') updaters.push(fn);
        return fn;
      },
      remove: function (fn) {
        var i = updaters.indexOf(fn);
        if (i >= 0) updaters.splice(i, 1);
      },
      start: start,
      stop: stop,
      isRunning: function () { return running; },
      elapsed: function () { return elapsed; },
      destroy: function () {
        stop();
        updaters.length = 0;
        global.document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
