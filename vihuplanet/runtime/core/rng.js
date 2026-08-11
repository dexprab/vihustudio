// rng.js — seeded randomness for the runtime.
//
// Every procedural field in the Ether (stars, nebula blobs, mist,
// particle seeds) is generated from a seed rather than from
// Math.random(). Two reasons, both of them the Hero's existing
// philosophy rather than new invention:
//
//   1. A star field that reshuffles on every reload is jarring in the
//      same way the World Library's session-sticky asset choice exists
//      to avoid (HERO_CANON.md §6). The universe should be the same
//      universe when a child comes back to the tab.
//   2. Procedural means reproducible. A bug in a drifting field is
//      only debuggable if the field can be regenerated exactly.
//
// The session seed is stored in sessionStorage, matching WorldLibrary:
// varies between browser sessions, holds steady across reloads.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Rng = VihuPlanet.ns('Rng');
  var SEED_KEY = 'vp-runtime-seed';

  // mulberry32 — 32-bit, no dependencies, fast enough to call
  // thousands of times during field generation without being noticed.
  function create(seed) {
    var a = (seed >>> 0) || 1;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      // between(2, 5) → a real number in [2, 5)
      between: function (lo, hi) { return lo + next() * (hi - lo); },
      // int(4) → 0..3
      int: function (n) { return Math.floor(next() * n); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      // Signed jitter, the shape most procedural placement wants.
      spread: function (amount) { return (next() * 2 - 1) * amount; }
    };
  }

  function sessionSeed() {
    var stored = null;
    try { stored = global.sessionStorage.getItem(SEED_KEY); } catch (e) {}
    if (stored) {
      var parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
    var fresh = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    try { global.sessionStorage.setItem(SEED_KEY, String(fresh)); } catch (e) {}
    return fresh;
  }

  // Derive a stable seed from a string — a Story Entity's id becomes
  // its own drift, bob phase and tilt, so the same story always moves
  // the same way without any of that being stored on the story.
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  Rng.create = create;
  Rng.sessionSeed = sessionSeed;
  Rng.hash = hash;
  Rng.forId = function (id) { return create(hash(id)); };
})(typeof window !== 'undefined' ? window : this);
