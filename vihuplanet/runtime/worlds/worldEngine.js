// worldEngine.js — the Future World Engine.
//
// This file deliberately does almost nothing, and that is its entire
// job.
//
// The product decision: until VihuPlanet has enough Story Worlds and
// Storytellers, published stories do not belong to any Story World —
// they belong to the Ether. There is no "Create Story World" feature,
// and there will not be one. Worlds are an emergent property of a
// universe that already has stories drifting in it.
//
// So Phase 1 does not implement Story Worlds, clustering, or world
// emergence. What it does implement is the guarantee that adding them
// later will not require rewriting the runtime. The seams already
// exist, and they are all in place and exercised:
//
//   1. entity.anchor — physics.js already applies a gentle spring
//      toward `{ x, y, strength }` if a story has one. That IS
//      clustering, minus anything that decides where a cluster
//      should be. Nothing in Phase 1 ever sets an anchor.
//
//   2. entity.world — a slot on the Story Entity contract that the
//      runtime reads nowhere. When worlds exist, this is where a
//      story's belonging goes, and no other file changes shape.
//
//   3. The signal bus — `story:added`, `story:born`, `story:removed`
//      are already announced. A future emergence system observes the
//      universe filling up; it does not need the Story Manager to
//      call it.
//
//   4. ether.palette — expressed as named roles, not hexes, so a
//      world can re-tint the space it occupies without any renderer
//      knowing that worlds are a thing that exists.
//
// If a future phase finds itself needing to modify physics.js,
// storyManager.js or etherRenderer.js in order to add Story Worlds,
// that is the signal that this architecture failed — not that those
// files need editing.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Worlds = VihuPlanet.ns('Worlds');

  Worlds.create = function (opts) {
    opts = opts || {};

    // Intentionally empty and intentionally without a way to fill it.
    // A `register()` here would be a Create Story World feature with a
    // different name, and the product decision is explicit that no
    // such feature exists.
    var worlds = [];

    return {
      // Always empty in Phase 1. Callers may ask; the honest answer is
      // that this universe has no worlds in it yet.
      list: function () { return worlds.slice(); },
      count: function () { return worlds.length; },

      // The one question anything outside the runtime should be asking
      // right now. Every story is in the Ether, because that is where
      // stories live until the universe grows enough to say otherwise.
      worldFor: function (/* storyId */) { return null; },

      // Present so that "is this universe ready for worlds?" has a
      // single place to be answered later, rather than being inferred
      // from a story count scattered across three files.
      hasEmerged: function () { return false; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
