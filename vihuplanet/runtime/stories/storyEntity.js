// storyEntity.js — the Story Entity contract.
//
// This file is the seam of the whole runtime. Physics moves Story
// Entities and knows nothing else about them. Renderers draw Story
// Entities and know nothing else about them. The Story Manager owns
// them. A published story from VihuStudio, a seeded demo story, and a
// story that a future Story World hands over are all the same shape
// once they are in the Ether.
//
// ---------------------------------------------------------------
// THE CONTRACT
//
// Identity — supplied by whoever publishes the story:
//   id           string, unique in the Ether
//   title        string
//   cover        string URL, or null (the Ether draws a plain
//                luminous card when a story has no cover yet)
//   creator      string, or null
//   publishedAt  ISO string or epoch ms
//   source       free-form; the runtime never reads it. Somewhere to
//                keep a project id without the runtime caring.
//
// Motion state — owned by Physics, written every frame:
//   position     { x, y }   field pixels
//   velocity     { x, y }   field pixels per second
//   rotation     degrees
//   spin         degrees per second
//   flow         how completely the Ether Currents carry this story
//   personal     { x, y }  its own tiny drift on top of the current
//   bob          { phase, speed, amplitude }  the tiny floating motion
//   bobX, bobY   the bob resolved for this frame. Renderers ADD these
//                to position; physics never integrates them.
//
// Presentation state — read by renderers, never written by them:
//   depth        0 (far) .. 1 (near). Drives scale and opacity, per
//                Art Direction v1.0: depth is felt through scale and
//                atmospheric opacity, never through parallax tricks.
//   scale        current render scale, depth-derived
//   opacity      0..1, depth-derived
//   radius       collision/avoidance radius in field pixels
//   state        see STATES below
//
// Lifecycle state — owned by Focus and Birth:
//   focusT       0..1 how far this story has come forward
//   birthT       0..1 how far through its arrival it is
//   home         { x, y } the exact place it occupied before focus
//
// Given to it by other Travellers — written by the surface, read by
// renderers, and touched by nothing else:
//   cheer        0..1, a cheer arriving right now. Set to 1 at the
//                moment one is given and decays on its own; it is the
//                clock the starlight animation runs on.
//   cheers       how much starlight this story has been given, total.
//   grown        true once that total has crossed the threshold. The
//                Spirit is a little more alive for it, permanently.
//                Belongs to THIS story and no other, and to no
//                Creator — it is a property of the thing that was
//                made, not of whoever made it.
//
// Future systems attach here rather than modifying the contract:
//   anchor       { x, y, strength } or null — the plug point Story
//                World clustering will use. Physics already honours
//                it; nothing in Phase 1 ever sets it.
//   world        null — reserved for the Future World Engine.
// ---------------------------------------------------------------
//
// Renderers may read anything above. They must write nothing. That
// single rule is what lets a second renderer (canvas, WebGL, a
// Telescope's narrow view) exist later without touching physics.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Rng = VihuPlanet.Rng;
  var Stories = VihuPlanet.ns('Stories');

  // A story is in exactly one of these at any moment.
  var STATES = {
    BIRTHING:  'birthing',   // arriving — light, rise, join
    DRIFTING:  'drifting',   // the normal life of a story
    FOCUSING:  'focusing',   // coming forward under a child's touch
    FOCUSED:   'focused',    // held open
    RETURNING: 'returning',  // going back to the exact place it left
    DORMANT:   'dormant'     // present, not simulated (reserved)
  };

  // Depth ramp. Deliberately narrow — the difference between the
  // nearest and farthest story in the Ether should read as air, not as
  // a zoom. Matches ArtDirection.composition.atmosphericOpacity, which
  // puts background elements at 0.40–0.65 and midground at 0.85–1.0.
  var DEPTH = {
    minScale:   0.58,
    maxScale:   1.0,
    // The floor is above Art Direction's 0.40 for background elements
    // on purpose: a Hero background object is scenery, and a story is
    // something a child is meant to be able to reach for. A story
    // faint enough to be missed is a story that cannot be discovered.
    minOpacity: 0.52,
    maxOpacity: 1.0
  };

  function scaleForDepth(depth) {
    return Util.lerp(DEPTH.minScale, DEPTH.maxScale, depth);
  }

  function opacityForDepth(depth) {
    return Util.lerp(DEPTH.minOpacity, DEPTH.maxOpacity, depth);
  }

  // Everything procedural about a story derives from its id, so the
  // same story drifts, bobs and tilts identically in every session and
  // on every device — without a single one of those numbers being
  // stored on the published story. The Ether feels authored; it is
  // only ever derived.
  function create(input, options) {
    input = input || {};
    options = options || {};

    var id = input.id || Util.uid('story');
    var rng = Rng.forId(id);

    var depth = (typeof input.depth === 'number')
      ? Util.clamp(input.depth, 0, 1)
      : rng.between(0.25, 1.0);

    // Initial drift, in field px/s. Slow enough that the movement is
    // caught out of the corner of the eye rather than watched — Art
    // Direction v1.0's "no object animates faster than a shaft of
    // sunlight moving across a room". Within a few seconds the Ether
    // Currents have taken over and this is forgotten; it exists so a
    // story is never seen to start from a standstill.
    var speed = rng.between(2.4, 5.0) * Util.lerp(0.55, 1.0, depth);
    var heading = rng.between(0, Math.PI * 2);

    var entity = {
      // --- identity ---
      id:          id,
      title:       input.title || '',
      cover:       input.cover || null,
      creator:     input.creator || null,
      publishedAt: input.publishedAt || null,
      // Whether the Story has a voice — true if any page carries
      // narration. A boolean, never the audio itself and never a count
      // of it: the runtime does not play sound, does not know what a
      // recording is, and must not start holding one. It is the same
      // kind of fact as `cover` — something the Story knows about
      // itself that a surface may choose to show.
      hasAudio:    input.hasAudio === true,
      source:      input.source || null,

      // --- motion ---
      position: {
        x: (typeof input.x === 'number') ? input.x : 0,
        y: (typeof input.y === 'number') ? input.y : 0
      },
      velocity: {
        x: Math.cos(heading) * speed,
        y: Math.sin(heading) * speed
      },
      // How completely this story surrenders to the Ether Currents.
      // Near 1, so stories in the same river travel together — that
      // shared direction is the thing that makes the space read as a
      // current rather than as noise. The spread is small but it
      // matters: identical affinity looks like a conveyor belt.
      flow: rng.between(0.78, 1.16) * Util.lerp(0.62, 1.0, depth),
      // A tiny drift of its own, on top of the current, so no two
      // stories in the same river are ever perfectly locked.
      personal: {
        x: rng.spread(1.4),
        y: rng.spread(1.4)
      },
      rotation: rng.between(-6, 6),
      // Degrees per second. At this range a full turn takes between
      // four and twelve minutes — a story is never seen to rotate,
      // only to have rotated.
      spin: rng.spread(0.9),
      bob: {
        phase:     rng.between(0, Math.PI * 2),
        speed:     rng.between(0.16, 0.30),   // radians/s
        amplitude: rng.between(2.2, 5.4)      // field px
      },
      // The bob, resolved. Physics writes these; renderers ADD them to
      // position at draw time. They are never integrated into position
      // itself — see the header of physics.js for why presentation
      // motion must not feed back into simulation.
      bobX: 0,
      bobY: 0,

      // --- presentation ---
      depth:   depth,
      scale:   scaleForDepth(depth),
      opacity: opacityForDepth(depth),
      radius:  (options.radius || 84) * scaleForDepth(depth),
      tilt:    rng.between(-2.4, 2.4),        // the card's own resting lean
      state:   STATES.DRIFTING,

      // --- lifecycle ---
      focusT: 0,
      birthT: 1,
      home:   null,

      // --- starlight given by other Travellers ---
      // `cheer` is the moment one arrives and decays on its own;
      // `cheers` is how much this story has been given altogether, and
      // `grown` is what that total has earned it. Declared here so
      // every Spirit has them from birth and no renderer has to guard
      // against their absence.
      // Read from the STORY, not from the manager's options: whoever
      // publishes a story into the Ether is who knows how much
      // starlight it has already been given. Getting this wrong was
      // caught by the reload test — the count persisted perfectly and
      // the Spirit came back ungrown, which is the half a child would
      // actually notice.
      cheer:  0,
      cheers: input.cheers || 0,
      grown:  !!input.grown,
      // How grown, 0 → 1, and the ONLY thing about starlight the
      // drawing code ever reads. It is a continuous quantity with no
      // stages in it: there is no level to be on, nothing to cross,
      // and nothing to announce. A renderer given a count could be
      // asked to show a count; given this, there is nothing to show.
      growth: (typeof input.growth === 'number') ? input.growth : 0,

      // --- plug points, never set in Phase 1 ---
      anchor: null,
      world:  null
    };

    return entity;
  }

  // The read-only view a renderer is handed. Phase 1 passes entities
  // directly for speed — freezing or cloning several hundred objects
  // every frame is exactly the cost this runtime exists to avoid — so
  // this exists as the documented shape and as a debugging aid, not as
  // an enforcement mechanism. The rule "renderers never write" is held
  // by review, not by the language.
  function snapshot(e) {
    return {
      id: e.id, title: e.title, cover: e.cover, creator: e.creator,
      x: e.position.x, y: e.position.y,
      rotation: e.rotation, scale: e.scale, opacity: e.opacity,
      depth: e.depth, state: e.state, focusT: e.focusT, birthT: e.birthT
    };
  }

  Stories.STATES = STATES;
  Stories.DEPTH = DEPTH;
  Stories.create = create;
  Stories.snapshot = snapshot;
  Stories.scaleForDepth = scaleForDepth;
  Stories.opacityForDepth = opacityForDepth;
})(typeof window !== 'undefined' ? window : this);
