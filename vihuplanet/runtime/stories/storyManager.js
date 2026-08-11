// storyManager.js — the Story Manager.
//
// Owns every story currently in the Ether. Nothing else does.
//
// It knows the shape of the field (it has to put a new story
// somewhere) and it knows the Story Entity contract. It does not know
// that a renderer exists, it does not know how a story moves, and it
// does not know what publishing is. Adding a story to the universe and
// drawing a story are two different jobs in two different files, and
// the only thing that crosses between them is the entity itself.
//
// Public API:
//   manager.add(story, options)     → entity
//   manager.addMany(stories)        → [entity]
//   manager.remove(id)              → boolean
//   manager.get(id)                 → entity | null
//   manager.all()                   → live array (do not mutate)
//   manager.count()
//   manager.clear()
//
// Events (via the universe signal):
//   story:added    { entity }
//   story:removed  { entity }
//   story:changed  { entity }   metadata was updated in place

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Stories = VihuPlanet.ns('Stories');
  var Rng = VihuPlanet.Rng;

  Stories.createManager = function (opts) {
    opts = opts || {};
    var field = opts.field;             // the Ether — bounds only
    var signal = opts.signal;
    var entities = [];
    var byId = {};

    // Placement for a story that arrives without coordinates. Seeded
    // from the id so a given story lands in the same part of the Ether
    // every session, and inset from the edges so nothing is born
    // half-off the field.
    function seedPosition(entity) {
      var rng = Rng.forId(entity.id + ':place');
      var w = field ? field.width : 1024;
      var h = field ? field.height : 640;
      var inset = 0.08;
      entity.position.x = rng.between(w * inset, w * (1 - inset));
      entity.position.y = rng.between(h * inset, h * (1 - inset));
    }

    function add(story, options) {
      options = options || {};
      var entity = Stories.create(story, options);

      if (byId[entity.id]) return byId[entity.id];   // already in the Ether

      var placed = (typeof story.x === 'number' && typeof story.y === 'number');
      if (!placed) seedPosition(entity);

      // A story that is being born starts invisible and inert; the
      // Birth system drives it the rest of the way in. Anything else
      // simply already exists — the Ether is not empty on arrival, it
      // is a universe that was already here (Art Direction v1.0's
      // first stance: "The universe existed long before the Explorer
      // arrived").
      if (options.birthing) {
        entity.state = Stories.STATES.BIRTHING;
        entity.birthT = 0;
      }

      entities.push(entity);
      byId[entity.id] = entity;
      if (signal) signal.emit('story:added', { entity: entity });
      return entity;
    }

    function addMany(list, options) {
      var out = [];
      for (var i = 0; i < (list || []).length; i++) {
        out.push(add(list[i], options));
      }
      return out;
    }

    function remove(id) {
      var entity = byId[id];
      if (!entity) return false;
      var i = entities.indexOf(entity);
      if (i >= 0) entities.splice(i, 1);
      delete byId[id];
      if (signal) signal.emit('story:removed', { entity: entity });
      return true;
    }

    // Metadata only. Position, velocity and state belong to Physics,
    // Focus and Birth respectively, and are deliberately not writable
    // through here — a caller reaching in to move a story would be
    // fighting the integrator for the same value every frame.
    function update(id, patch) {
      var entity = byId[id];
      if (!entity || !patch) return null;
      var fields = ['title', 'cover', 'creator', 'publishedAt', 'source'];
      for (var i = 0; i < fields.length; i++) {
        if (patch.hasOwnProperty(fields[i])) entity[fields[i]] = patch[fields[i]];
      }
      if (signal) signal.emit('story:changed', { entity: entity });
      return entity;
    }

    function clear() {
      var snapshot = entities.slice();
      entities.length = 0;
      byId = {};
      if (signal) {
        for (var i = 0; i < snapshot.length; i++) {
          signal.emit('story:removed', { entity: snapshot[i] });
        }
      }
    }

    // Called by the Ether when the field is resized. Positions are
    // held proportionally so a rotated phone or a resized window does
    // not shuffle the universe — a story stays where the child last
    // saw it, relative to the space it lives in.
    function rescale(ratioX, ratioY) {
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        e.position.x *= ratioX;
        e.position.y *= ratioY;
        if (e.home) { e.home.x *= ratioX; e.home.y *= ratioY; }
      }
    }

    return {
      add: add,
      addMany: addMany,
      remove: remove,
      update: update,
      get: function (id) { return byId[id] || null; },
      all: function () { return entities; },
      count: function () { return entities.length; },
      clear: clear,
      rescale: rescale
    };
  };
})(typeof window !== 'undefined' ? window : this);
