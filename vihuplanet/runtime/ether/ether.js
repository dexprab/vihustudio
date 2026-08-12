// ether.js — the Ether itself.
//
// Until VihuPlanet has enough Story Worlds and Storytellers, a
// published story does not belong to a world. It belongs to the Ether:
// the living space of VihuPlanet, where stories drift and wait to be
// discovered. Worlds are not a feature anyone builds — they are an
// emergent property of a universe that already has stories in it.
//
// This file is the SPACE, not the picture of it. It owns:
//
//   · the field — how big the universe currently is, in CSS pixels
//   · the view — the part of it a child can see right now
//   · the palette — inherited from Art Direction v1.0, never invented
//   · the ambient state — what the universe is doing right now
//     (glow phase, mist drift, whatever shooting stars are alive)
//   · the veil — how far the universe has receded behind a focused
//     story, 0 (fully present) to 1 (fully softened)
//
// ---------------------------------------------------------------
// THE FIELD IS BIGGER THAN THE SCREEN, AND IT GROWS.
//
// This is the single most important decision in the runtime, and it
// was made by looking at the thing running rather than by reasoning
// about it. With the field equal to the screen, two hundred stories is
// a wall of cards — every story visible at once, overlapping, nothing
// discoverable, nothing calm. No amount of avoidance can fix that: two
// hundred cards will not fit in one screen because they do not fit.
//
// So the Ether is a field LARGER than the view, and it grows with the
// number of stories in it — a fixed area per story, so density stays
// constant no matter how large VihuPlanet becomes. Sixteen or so
// stories are in view at any moment whether the universe holds twenty
// or six hundred. The rest are elsewhere in the Ether, drifting, and
// they arrive in their own time.
//
// That is also what "stories drift through it, waiting to be
// discovered" actually requires. A story you can already see is not
// waiting to be discovered.
//
// The view sits at the field's origin and never moves, so the field
// can grow — extending away to the right and below — without anything
// on screen shifting by a pixel. Growth is silent by construction.
// ---------------------------------------------------------------
//
// The Ether Renderer READS all of this and draws it. The Ambient
// System WRITES the ambient parts. Neither one owns the state, which
// is what allows a second renderer — a Telescope's narrow view of the
// same Ether, say — to exist later without duplicating any of it.
//
// The palette below is the Ether at night. Every colour in it is an
// Art Direction v1.0 colour: the same ink, dusk, cerulean, candle and
// paper the daylight Hero is painted with, weighted for deep space
// instead of magic hour. The Ether is a different hour of the same
// world, not a different world.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var EtherNS = VihuPlanet.ns('Ether');

  function artPalette() {
    var art = global.ArtDirection;
    return (art && art.palette) ? art.palette : {
      paper: '#F1EAD0', ink: '#1E2842', dusk: '#8E7CB0',
      skyCerulean: '#7EB1CE', candle: '#E8B871', ember: '#E4A455',
      shadow: '#4C6E76', horizonApricot: '#EBB47A'
    };
  }

  // Blend two Art Direction colours. The Ether needs tones BETWEEN the
  // named roles — a twilight violet is ink on its way to dusk — and
  // mixing two palette colours is not inventing a third one.
  function mix(hexA, hexB, t) {
    function rgb(hex) {
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var a = rgb(hexA), b = rgb(hexB), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(a[i] + (b[i] - a[i]) * t);
      o += (v < 16 ? '0' : '') + v.toString(16);
    }
    return o;
  }

  // How much room one story gets to itself, in square CSS pixels.
  // Chosen so that a typical screen holds a calm handful — around
  // sixteen on a laptop, five or six on a phone — leaving roughly two
  // thirds of the frame as air, which is where Art Direction v1.0 puts
  // a well-composed frame (whitespace 0.50–0.65).
  var AREA_PER_STORY = 48000;

  // Even a nearly empty universe is bigger than the screen, so there
  // is always somewhere for a story to drift in FROM.
  //
  // 1.18, not 1.6, and the difference is a real first-run bug rather
  // than a taste call. At 1.6 the field is 2.56× the area of the view,
  // so only ~39% of a small universe is on screen at any moment — a
  // creator with four published Stories would see one or two of them
  // and conclude the Ether had lost the rest. 1.18 puts ~72% in view,
  // which is also almost exactly where the density rule below takes
  // over (around thirty Stories), so the two rules meet without a step.
  var MIN_SPREAD = 1.18;

  EtherNS.create = function (opts) {
    opts = opts || {};
    var signal = opts.signal;
    var p = artPalette();

    var viewWidth = opts.width || 1024;
    var viewHeight = opts.height || 640;

    var ether = {
      // ---------- the field ----------
      // The whole universe. Grows with the number of stories in it.
      width: viewWidth * MIN_SPREAD,
      height: viewHeight * MIN_SPREAD,

      // ---------- the view ----------
      // What is on screen. Anchored at the field's origin, always.
      viewWidth: viewWidth,
      viewHeight: viewHeight,

      // ---------- the palette ----------
      // Deliberately expressed as named roles rather than raw hexes,
      // so a future Story World can re-tint the Ether by handing over
      // a different set of roles without any renderer knowing.
      // The Ether stayed too cold for too long, and the cause was in
      // this object rather than anywhere that draws: ink, shadow-teal
      // and paper-cream are a beautiful set and every one of them is
      // BLUE-GREY. A field built from three cool roles reads as
      // outer space however carefully it is lit, and outer space is
      // not what a six-year-old should feel they have walked into.
      //
      // So the roles below add the warm half of the same Art Direction
      // palette — twilight violet, lavender, muted gold, peach — and
      // nothing here is a new colour: violet is ink on its way to dusk,
      // and the peach is horizonApricot, which the daylight Hero has
      // always used. The Ether is a different hour of the same world.
      //
      // The rule the whole pass is held to: THE ETHER IS CALM, THE
      // THINGS INSIDE IT ARE ALIVE. Warmth is not brightness. The field
      // stays dark enough for a star to register — measured, not
      // judged — and the warmth arrives as hue, not as light.
      palette: {
        deep:    p.ink,             // the far dark of the field
        near:    p.shadow,          // the nearer, cooler water of it
        // Twilight violet: the deep tone the sky passes through, so the
        // darkest part of the Ether is a COLOUR rather than an absence.
        // Never near-black — a black field is the horror-of-space
        // feeling this pass exists to remove.
        //
        // Two steps, and the second one is the important half. Ink is
        // very slightly green of blue, so pulling dusk toward ink gives
        // a blue-grey rather than a violet; the hue has to come from
        // dusk and the DEPTH from darkening, not from the two mixed at
        // one ratio. Measured: this lands within a few points of the
        // luminance of the near-black it replaces, with red above green
        // instead of below it.
        //
        // Which is the whole discipline of this pass. Warming the Ether
        // by lightening it is the one failure mode already on record
        // here — the previous sprint measured the sky going milky at a
        // median of 70 and had to take it back to 56. Warmth is hue.
        twilight: mix(mix(p.ink, p.dusk, 0.55), '#0A0712', 0.70),
        // Lavender twice, turquoise once, peach once.
        //
        // It used to be lavender, turquoise and shadow-TEAL, which is
        // two cool roles against one warm-ish — and since the blooms
        // are the largest coloured thing in the field, that alone kept
        // the darks green of red however the gradient was tuned.
        // Measured on five pinned skies: dropping the teal is most of
        // what turns the dark of the Ether from blue-grey to violet.
        // Turquoise stays, because the brief asks for it and one cool
        // bloom among warm ones is what makes the warm ones read as
        // warm.
        nebula:  [p.dusk, p.skyCerulean, p.dusk, p.horizonApricot],
        star:    p.paper,           // stars are paper-cream, not white
        mist:    p.dusk,
        glow:    p.candle,          // the universe's warmth
        // A second warmth, further from gold. Used for the far glow
        // that keeps a corner of the field alive when the near one has
        // drifted away.
        warm:    p.horizonApricot,
        spark:   p.ember,           // birth light, shooting stars
        veil:    p.ink
      },

      // ---------- the depth of the universe ----------
      //
      // One source of truth for how far away each layer is. The
      // Universe Camera multiplies its drift by these, and that
      // disagreement between layers IS the depth — nothing here is
      // drawn larger or smaller to fake distance, it simply moves by
      // a different amount when the viewpoint does.
      //
      // 0 is infinitely far and never moves. 1 is the plane the
      // stories live on. Above 1 is in front of them, and swims.
      depth: {
        gradient:   0.00,
        farNebula:  0.10,
        farStars:   0.18,
        mist:       0.30,
        farDust:    0.34,
        currents:   0.46,
        midDust:    0.66,
        stories:    1.00,
        nearDust:   1.12,
        foreground: 1.58
      },

      // ---------- what the universe is doing ----------
      ambient: {
        // A slow swell of overall warmth. One number, read by the
        // renderer for the ambient-glow layer.
        glow: 0.5,
        // The universe breathing. A single value near 1.0 that every
        // luminous layer multiplies into its own brightness, so the
        // whole Ether brightens and dims together as one body rather
        // than as a set of independently animated effects.
        breath: 1,
        // Independent drift phases for the mist banks, so no two move
        // together and none of them ever loop visibly.
        mistPhase: [0, 2.1, 4.3],
        // Each nebula bloom's own slow pulse. Filled by the Ambient
        // System to match however many blooms the renderer made.
        nebulaPulse: [],
        // Live shooting stars. Pooled by the Ambient System — this
        // array's objects are reused, never reallocated.
        shootingStars: [],
        // Dust, in layers, at different depths. Pooled.
        dust: [],
        // Faint streaks that ride the Ether Currents — the only layer
        // that makes the rivers themselves visible. Pooled.
        streaks: [],

        // ---------- where in the Ether the Traveller is looking ----------
        //
        // Different parts of the universe have a slightly different
        // character. Not zones, not biomes, not levels and never
        // labelled — four numbers near 1.0 that every atmospheric layer
        // multiplies into itself, so one direction is a little warmer,
        // another a little mistier, another has stronger currents.
        //
        // It is a FUNCTION OF THE CAMERA'S ANGLES, not of a position,
        // which is what makes it work in a universe that wraps: sines
        // of yaw and pitch are periodic by construction, so turning a
        // full circle returns to the same character exactly, and no
        // seam can ever appear because there is no edge to cross.
        //
        // All four move slowly and land close to 1. A child should
        // never see a transition — only, having drifted somewhere,
        // notice that it is different here.
        region: { warmth: 1, mist: 1, flux: 1, sparkle: 1 },

        // ---------- how long the Traveller has been still ----------
        //
        // 0 while they are looking around, easing to 1 after a few
        // seconds of stillness. The universe answers by becoming a
        // little more present — a current brightens, the glow gathers,
        // the near dust picks up. No text, no notification, nothing
        // said. The whole intent is: THE UNIVERSE IS ALIVE EVEN WHEN I
        // STOP.
        stillness: 0
      },

      // ---------- light sources ----------
      //
      // Anything luminous in the universe, as pure {x, y, scale,
      // intensity}. The Ether Renderer draws these and the Ether
      // Currents bend around them, and neither one knows that a light
      // is a story — see stories/storyLight.js. A future Story World
      // lighting the space it occupies writes into this same array.
      lights: [],

      // ---------- focus veil ----------
      // 0 = the universe is fully present. 1 = it has receded as far
      // as it ever does behind a story a child has opened. It never
      // reaches black: the Ether keeps moving underneath, visibly, so
      // a child is never taken out of the universe to read — they are
      // only brought closer to one part of it.
      veil: 0
    };

    // Grow the field to fit `count` stories at constant density. Never
    // shrinks below MIN_SPREAD, and never shrinks the field at all —
    // a universe that contracted when a story was deleted would drag
    // every remaining story inward, and the Ether does not take space
    // back.
    // Returns the ratio the field grew by, or null if it did not. The
    // caller carries every story out with it (see the note below);
    // returning the ratio rather than moving anything keeps the Ether
    // ignorant of the fact that stories exist.
    ether.fit = function (count) {
      var viewArea = ether.viewWidth * ether.viewHeight;
      if (viewArea <= 0) return null;
      var wanted = Math.max(viewArea * MIN_SPREAD * MIN_SPREAD, count * AREA_PER_STORY);
      var scale = Math.sqrt(wanted / viewArea);
      var w = ether.viewWidth * scale;
      var h = ether.viewHeight * scale;
      if (w <= ether.width && h <= ether.height) return null;
      var ratio = { x: Math.max(1, w / ether.width), y: Math.max(1, h / ether.height) };
      ether.width = Math.max(ether.width, w);
      ether.height = Math.max(ether.height, h);
      if (signal) signal.emit('ether:grew', { width: ether.width, height: ether.height, ratio: ratio });
      return ratio;
    };

    // Called by the Universe when the mount resizes. Returns the
    // ratios so the Story Manager can hold every story in the same
    // relative place — see storyManager.rescale(). The ratios are the
    // VIEW's, not the field's: what matters is that a story a child
    // was looking at is still where they were looking.
    ether.resize = function (width, height, count) {
      if (width <= 0 || height <= 0) return null;
      if (width === ether.viewWidth && height === ether.viewHeight) return null;
      var ratio = { x: width / ether.viewWidth, y: height / ether.viewHeight };
      ether.viewWidth = width;
      ether.viewHeight = height;
      ether.width *= ratio.x;
      ether.height *= ratio.y;
      // A resize can also change how much room the stories need (a
      // phone in portrait is a different shape of universe). Both
      // ratios are combined so the caller rescales once.
      var grew = ether.fit(count || 0);
      if (grew) { ratio.x *= grew.x; ratio.y *= grew.y; }
      if (signal) signal.emit('ether:resized', { width: width, height: height, ratio: ratio });
      return ratio;
    };

    ether.setVeil = function (v) { ether.veil = Util.clamp(v, 0, 1); };

    // The centre of the VIEW, in field coordinates. Focus brings a
    // story here, so it arrives in front of the child rather than in
    // the middle of a universe they cannot see.
    ether.centre = function () {
      return { x: ether.viewWidth * 0.5, y: ether.viewHeight * 0.5 };
    };

    // A point inside the visible part of the Ether, kept off the
    // edges. Birth aims here: a story joining VihuPlanet has to be
    // seen joining it.
    ether.pointInView = function (rng) {
      var inset = 0.16;
      return {
        x: (inset + (rng ? rng.next() : Math.random()) * (1 - inset * 2)) * ether.viewWidth,
        y: (inset + (rng ? rng.next() : Math.random()) * (1 - inset * 2)) * ether.viewHeight
      };
    };

    ether.fit(0);
    return ether;
  };
})(typeof window !== 'undefined' ? window : this);
