// spatialGrid.js — neighbour lookup for soft avoidance.
//
// Avoidance is the one law in the Ether that needs a story to know
// about other stories. Done naively that is N² distance checks every
// frame: fine at twenty stories, 250,000 checks at five hundred, and
// the runtime is meant to carry hundreds comfortably.
//
// A uniform hash grid is the cheapest fix that fits the problem. The
// field is divided into square cells roughly two story-widths across;
// a story can only crowd something in its own cell or the eight around
// it, so each frame is a rebuild (O(n), one pass, no allocation after
// the first frames) plus nine bucket reads per story.
//
// Buckets are reused between frames rather than reallocated — the
// arrays are emptied in place. Object pooling, applied to the least
// glamorous object in the runtime.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Physics = VihuPlanet.ns('Physics');

  Physics.createGrid = function (cellSize) {
    var cell = cellSize || 160;
    var buckets = {};      // "cx,cy" → array of entities
    var used = [];         // buckets touched this frame, for cheap reset

    function key(cx, cy) { return cx + ',' + cy; }

    function reset() {
      for (var i = 0; i < used.length; i++) used[i].length = 0;
      used.length = 0;
    }

    function build(entities) {
      reset();
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        var k = key(Math.floor(e.position.x / cell), Math.floor(e.position.y / cell));
        var bucket = buckets[k];
        if (!bucket) { bucket = buckets[k] = []; }
        if (!bucket.length) used.push(bucket);
        bucket.push(e);
      }
    }

    // Calls `fn(other)` for every entity in the 3×3 cell neighbourhood
    // around `e`, including `e` itself — the caller skips it by
    // identity, which is cheaper than making this method careful.
    function forEachNear(e, fn) {
      var cx = Math.floor(e.position.x / cell);
      var cy = Math.floor(e.position.y / cell);
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var bucket = buckets[key(cx + dx, cy + dy)];
          if (!bucket) continue;
          for (var i = 0; i < bucket.length; i++) fn(bucket[i]);
        }
      }
    }

    // The field can change size (a rotated phone); the cell size is
    // derived from story size, not field size, so it only changes if
    // the story scale itself does.
    function setCellSize(size) {
      if (size === cell) return;
      cell = size;
      buckets = {};
      used.length = 0;
    }

    return {
      build: build,
      forEachNear: forEachNear,
      setCellSize: setCellSize,
      cellSize: function () { return cell; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
