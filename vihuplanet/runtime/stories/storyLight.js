// storyLight.js — the universe acknowledges every story.
//
// One story alone in the Ether should never look abandoned. The space
// around it responds: a soft glow field, and dust that curves as it
// passes, almost like gravity. That is the difference between a story
// sitting ON the universe and a story being IN it.
//
// This is a presenter, in exactly the same sense the Story Layer is
// one. It reads the Story Entity contract and writes light sources —
// nothing else. The Ether Renderer draws `ether.lights` without ever
// learning that a light is a story, and the Ether Currents bend around
// those same lights without learning it either. When a Story World
// eventually wants to light the space around it, it writes into the
// same array and every downstream system already handles it.
//
// The lights are pooled and only ever collected for stories near the
// view, so a universe of six hundred stories produces the same handful
// of lights as a universe of twenty.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Rng = VihuPlanet.Rng;
  var Stories = VihuPlanet.ns('Stories');
  var STATES = Stories.STATES;

  // Beyond this the glow fields would start to merge into a wash and
  // stop reading as "each story has its own light".
  var MAX_LIGHTS = 28;

  Stories.createLightField = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var manager = opts.manager;
    if (!ether || !manager) return null;

    var margin = opts.margin || 220;
    var lights = ether.lights;

    for (var i = 0; i < MAX_LIGHTS; i++) {
      lights.push({ alive: false, x: 0, y: 0, scale: 1, intensity: 0, warm: 0 });
    }

    // Lights are written in view space WITHOUT the camera applied, for
    // the same reason the dust is: the camera is a draw-time transform
    // and nothing else. Keeping every piece of atmosphere in one
    // untransformed space is what lets the Ether Currents bend around
    // these lights and move that dust using the same coordinates.
    function update(dt, time) {
      var i, n = 0;
      var entities = manager.all();

      for (i = 0; i < entities.length && n < MAX_LIGHTS; i++) {
        var e = entities[i];
        if (e.state === STATES.DORMANT) continue;

        var x = e.position.x + e.bobX;
        var y = e.position.y + e.bobY;
        if (x < -margin || x > ether.viewWidth + margin) continue;
        if (y < -margin || y > ether.viewHeight + margin) continue;

        var l = lights[n++];
        l.alive = true;
        l.x = x;
        l.y = y;
        l.scale = e.scale;

        // Each story's light breathes on its own rhythm, seeded from
        // its id like everything else procedural about it — so no two
        // stories in the field ever pulse together, which is the thing
        // that would make this read as an animation rather than as
        // light.
        var breath = 0.5 + 0.5 * Math.sin(time * 0.19 + e.bob.phase * 1.7);

        // Depth: a distant story's light is dimmer, the same way its
        // card is fainter. A birthing story's light is at its
        // brightest as it arrives and settles as it joins.
        var born = (e.state === STATES.BIRTHING) ? e.birthT : 1;
        var arriving = (e.state === STATES.BIRTHING) ? (1.9 - e.birthT * 0.9) : 1;

        l.intensity = e.opacity * (0.72 + breath * 0.28) * born * arriving;
        // A focused story's light swells with it, so the universe
        // brightens around what the child is looking at rather than
        // only dimming everywhere else.
        if (e.focusT > 0) l.intensity *= (1 + Util.smooth(e.focusT) * 1.4);
        l.warm = (e.state === STATES.BIRTHING) ? 1 : 0;
      }

      for (; n < lights.length; n++) lights[n].alive = false;
    }

    return {
      update: update,
      count: function () {
        var c = 0;
        for (var i = 0; i < lights.length; i++) if (lights[i].alive) c++;
        return c;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
