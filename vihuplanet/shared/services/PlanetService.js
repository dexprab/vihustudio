// PlanetService — Chapter 2 placeholder interface.
//
// Every Storyteller has one Home Planet (canon). The service will
// host planet lifecycle: existence, growth, visibility, drift
// path. MEP v0.3 uses the Planet registry (planets/planets.js)
// directly for the four visible storyteller planets, and the
// DreamingPlanet registry for the singular Dreaming Planet. The
// service consolidation belongs to a later chapter.
//
// Interface only. Do not implement.

(function (global) {
  'use strict';

  var PlanetService = {
    // Look up any planet by id (storyteller planet or dreaming).
    // Deferred — MEP falls back to Planet.find / DreamingPlanet.get.
    find: function (id) {
      if (typeof Planet !== 'undefined' && typeof Planet.find === 'function') {
        var p = Planet.find(id);
        if (p) return p;
      }
      if (typeof DreamingPlanet !== 'undefined' && typeof DreamingPlanet.get === 'function') {
        var dp = DreamingPlanet.get();
        if (dp && dp.id === id) return dp;
      }
      return null;
    },

    // Return every visible planet in the universe. Deferred.
    all: function () {
      var out = [];
      if (typeof Planet !== 'undefined') out = out.concat(Planet.list());
      if (typeof DreamingPlanet !== 'undefined' && DreamingPlanet.get()) out.push(DreamingPlanet.get());
      return out;
    },

    // Called by a future chapter (Planet growth). Deferred.
    grow: function (/* planetId, delta */) { return; },

    // Called by a future chapter (Returning Home) to bring a planet
    // gently to the centre so the explorer can land on it. Deferred.
    focus: function (/* planetId */) { return; }
  };

  try { global.PlanetService = PlanetService; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
