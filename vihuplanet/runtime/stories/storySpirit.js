// storySpirit.js — a published story is not a card. It is a Story
// Spirit: a living presence in the Ether.
//
// A Spirit has four layers, and only the first is ever guaranteed to
// be visible:
//
//   Spirit Aura   light, seen from across the universe. The first
//                 thing a child notices, and for most Spirits at any
//                 moment the ONLY thing.
//   Story Cover   its identity, revealed by nearness, never by default
//   Soft Glow     its own pulse, its own colour
//   Flux          it belongs to the Ether and travels with the
//                 currents (physics.js + ether/currents.js)
//
// This file owns the first, the third, and the number the second
// depends on. It does not draw anything: it computes, for every story
// in the universe, where its Spirit is on screen and how near the
// Traveller it is, then writes a light source for the Ether Renderer.
// The DOM presenter (storyLayer.js) reads the same numbers.
//
// ---------------------------------------------------------------
// NEARNESS IS DISTANCE FROM THE CENTRE OF THE SCREEN
//
// The Traveller never moves — they are the centre, and the universe
// turns around them. So "the Traveller approaches a Spirit" and "the
// Spirit is near the middle of the screen" are the same sentence, and
// `prox` (0 far, 1 met) is that sentence as a number.
//
// Everything about discovery falls out of it:
//
//   prox ~ 0.0    a light in the dark. No cover, no name, no DOM node
//                 at all — a universe of six hundred Spirits creates
//                 no elements for the ones nobody is looking at.
//   prox ~ 0.5    the cover fades up, small, still unnamed
//   prox ~ 1.0    the cover is whole, and it has a name and a maker
//
// A child is never told any of this. They turn, and things resolve.
// ---------------------------------------------------------------

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Rng = VihuPlanet.Rng;
  var Stories = VihuPlanet.ns('Stories');
  var STATES = Stories.STATES;

  // Beyond this many the aura fields would merge into a wash and stop
  // reading as "each Spirit has its own light".
  var MAX_LIGHTS = 30;

  // Where the reveal happens, as fractions of the shorter viewport
  // edge. Generous, because turning the universe has to be able to
  // bring something in — and because a reveal that only happens dead
  // centre would make the child hunt for a sweet spot.
  // Tightened after looking at it: at 0.22/0.72 most of the screen
  // counted as "near", so every Spirit in view resolved into a cover at
  // once and the Ether read as a gallery — the exact failure the sprint
  // names. Narrower, only what the Traveller has actually turned toward
  // becomes a picture, and the rest stay souls.
  var NEAR = 0.11;
  var FAR = 0.52;

  // A YOUNG UNIVERSE REVEALS FURTHER OUT.
  //
  // "Soul first, identity on approach" is right, and it assumes there
  // is something else to approach. With one Story in the whole Ether,
  // 0.52 of the shorter edge means anything outside a circle about
  // four hundred pixels wide is a faint light and nothing else — so a
  // child who has just shared their first story opens VihuPlanet and
  // finds, correctly and uselessly, almost nothing.
  //
  // Below the same count at which the field is exactly the view
  // (ether.js → INTIMATE_BELOW), the reveal reaches nearly the whole
  // screen instead. The grading is unchanged — a Story is still
  // faintest at the edge, still resolves as it is turned toward, still
  // whole only at the centre — it simply starts sooner. Nothing is
  // shown as a card from across the universe; there is just no longer
  // an "across the universe" to be shown from.
  var FAR_SPARSE = 0.95;
  var SPARSE_BELOW = 5;

  // Each Spirit's own light colour, chosen from the Ether's palette
  // roles and seeded from its id. "Different stories may have slightly
  // different glow colours" — slightly is the whole instruction, so
  // these are three neighbouring warms and one cool, never a rainbow.
  var HUES = ['glow', 'glow', 'spark', 'mist'];

  Stories.createSpirits = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var manager = opts.manager;
    var camera = opts.camera;
    if (!ether || !manager) return null;

    var lights = ether.lights;
    for (var i = 0; i < MAX_LIGHTS; i++) {
      // `grown` and `arriving` are the Spirit's starlight, carried on
      // the light so the renderer can draw it without ever being told
      // what a story is — the same discipline as `hue` and `warm`.
      lights.push({ alive: false, x: 0, y: 0, scale: 1, intensity: 0, warm: 0, hue: 'glow',
                    grown: false, growth: 0, arriving: 0, seed: 0, radius: 44, radiusY: 59 });
    }

    // Candidates, sorted by nearness each frame to decide which get a
    // light. Reused — the frame loop allocates nothing.
    var ranked = [];

    // The nearest whole-field copy of a position to the centre of the
    // view. The Ether wraps, and a full turn of the camera is exactly
    // one field width, so without this a Spirit would vanish at the
    // seam instead of the universe closing on itself.
    function nearestCopy(v, span, centre) {
      if (!(span > 0)) return v;
      return v - Math.round((v - centre) / span) * span;
    }

    function update(dt, time) {
      var entities = manager.all();
      var cam = camera ? camera.offsetFor(ether.depth.stories) : null;
      var camX = cam ? cam.x : 0;
      var camY = cam ? cam.y : 0;
      var cx = ether.viewWidth * 0.5;
      var cy = ether.viewHeight * 0.5;
      var shortest = Math.min(ether.viewWidth, ether.viewHeight);
      var near = shortest * NEAR;
      var far = shortest * (entities.length < SPARSE_BELOW ? FAR_SPARSE : FAR);
      var i, e;

      ranked.length = 0;

      for (i = 0; i < entities.length; i++) {
        e = entities[i];
        if (e.state === STATES.DORMANT) { e.prox = 0; continue; }

        if (!e.hue) e.hue = HUES[Rng.hash(e.id) % HUES.length];

        e.screenX = nearestCopy(e.position.x + e.bobX + camX, ether.width, cx);
        e.screenY = nearestCopy(e.position.y + e.bobY + camY, ether.height, cy);

        var dx = e.screenX - cx;
        var dy = e.screenY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // 1 at the centre, 0 past `far`, smooth in between.
        var prox = Util.smooth(1 - Util.clamp((dist - near) / (far - near), 0, 1));

        // A Spirit being met is fully present regardless of where it
        // started — it is coming to the Traveller, so it cannot also
        // be "far away".
        if (e.focusT > 0) prox = Math.max(prox, Util.smooth(e.focusT));
        e.prox = prox;

        // "The Spirit subtly reacts to being noticed." Notice lags
        // behind nearness, so a Spirit swells a moment AFTER the child
        // turns toward it rather than tracking the mouse like a
        // cursor — being noticed is a thing that happens to it, not a
        // readout of where the pointer is.
        var noticed = e.noticed || 0;
        e.noticed = noticed + (prox - noticed) * (1 - Math.exp(-2.1 * dt));

        if (prox > 0.002 || e.state === STATES.BIRTHING) ranked.push(e);
      }

      // Nearest first: the Spirits a child is looking at are the ones
      // that get real light.
      ranked.sort(function (a, b) { return b.prox - a.prox; });

      var n = 0;
      for (i = 0; i < ranked.length && n < MAX_LIGHTS; i++) {
        e = ranked[i];
        var l = lights[n++];
        l.alive = true;
        l.x = e.screenX;
        l.y = e.screenY;
        l.scale = e.scale;
        l.hue = e.hue;

        // Its own pulse, on its own rhythm, seeded from its id — so no
        // two Spirits in the field ever breathe together.
        var breath = 0.5 + 0.5 * Math.sin(time * 0.19 + e.bob.phase * 1.7);

        var born = (e.state === STATES.BIRTHING) ? e.birthT : 1;
        var arriving = (e.state === STATES.BIRTHING) ? (1.9 - e.birthT * 0.9) : 1;

        // A far Spirit is still lit — that is the entire point, it is
        // a soul visible from across the universe. Nearness makes it
        // brighter, it does not make it exist.
        var reach = 0.46 + e.noticed * 0.72;

        l.intensity = e.opacity * (0.72 + breath * 0.28) * reach * born * arriving;
        if (e.focusT > 0) l.intensity *= (1 + Util.smooth(e.focusT) * 1.3);

        // A cheer. The surface sets `cheer` to 1 and the Spirit shines
        // for a couple of seconds, then settles — a moment of light
        // rather than a permanent decoration, and the only answer a
        // cheer can honestly have while there is nobody else in
        // VihuPlanet to send it to.
        if (e.cheer > 0) {
          e.cheer = Math.max(0, e.cheer - dt * 0.45);
          l.intensity *= 1 + e.cheer * 1.5;
        }
        l.warm = (e.state === STATES.BIRTHING) ? 1 : 0;

        // THE STARLIGHT.
        //
        // `arriving` is the cheer that is landing right now — the
        // renderer draws motes converging out of the dark and settling
        // on the Spirit while it runs down.
        //
        // `grown` is what a story keeps. Once enough starlight has
        // been given, the Spirit carries a few small companions of its
        // own, turning slowly around it. Deliberately NOT more
        // brightness: brightness already means nearness in this
        // universe, and a grown story that merely looked closer would
        // be saying the wrong thing. It is a story with a little
        // company, which is exactly what it earned.
        l.arriving = e.cheer;
        l.grown = !!e.grown;
        // How much company it keeps, 0 → 1. Continuous, so a story
        // with a great deal of starlight is visibly more alive than one
        // with a little, without there ever being a step between them
        // that could read as a level reached.
        l.growth = e.growth || 0;
        // Its own phase, so no two grown Spirits turn together.
        l.seed = e.bob.phase;
        // How big the story itself is ON SCREEN. The Spirit's card is
        // DOM and sits ON TOP of the canvas these motes are drawn on,
        // so anything orbiting closer than this is behind the card and
        // simply cannot be seen — which is exactly what happened, and
        // what a measurement of the canvas alone could not tell me.
        //
        // `e.radius` is NOT this, and using it was the bug: it is the
        // collision radius in FIELD pixels, deliberately larger than
        // the card so Spirits keep their distance from each other, and
        // it tracks depth rather than the scale the card is drawn at.
        // Measured at one viewport it was 67 against a card whose real
        // half-width was 37 — so the motes orbited at nearly two and a
        // half times the card and the warm field spread to three, far
        // enough that neither read as belonging to the story any more.
        //
        // storyLayer.js publishes the real thing, because the card's
        // size is a CSS fact and that is the only module that holds it.
        // Width and height separately: the cover is 3:4, so a circular
        // orbit that clears the sides passes behind the top and the
        // bottom.
        l.radius  = e.cardHalfW || (e.radius * 0.55);
        l.radiusY = e.cardHalfH || (e.radius * 0.73);
      }
      for (; n < lights.length; n++) lights[n].alive = false;
    }

    return {
      update: update,
      NEAR: NEAR,
      FAR: FAR,
      count: function () {
        var c = 0;
        for (var i = 0; i < lights.length; i++) if (lights[i].alive) c++;
        return c;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
