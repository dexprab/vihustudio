// signal.js — the runtime's only communication channel between
// systems.
//
// Architecture principle for this phase: future systems plug into the
// runtime rather than modify it. That only holds if systems announce
// what happened instead of calling each other. The Story Manager
// announces `story:added`; it does not know a renderer exists. The
// Focus System announces `focus:opened`; it does not know whether a
// reading experience has been built yet (it hasn't).
//
// Deliberately tiny: on / off / emit, and errors in one listener never
// stop the others. A thrown handler inside a requestAnimationFrame
// tick would otherwise take the whole universe down.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Signal = VihuPlanet.ns('Signal');

  Signal.create = function () {
    var listeners = {};

    return {
      on: function (name, fn) {
        if (typeof fn !== 'function') return function () {};
        (listeners[name] || (listeners[name] = [])).push(fn);
        // Returns its own unsubscribe — a system that plugs in can
        // always unplug cleanly.
        return function () {
          var arr = listeners[name];
          if (!arr) return;
          var i = arr.indexOf(fn);
          if (i >= 0) arr.splice(i, 1);
        };
      },

      off: function (name, fn) {
        var arr = listeners[name];
        if (!arr) return;
        if (!fn) { delete listeners[name]; return; }
        var i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      },

      emit: function (name, payload) {
        var arr = listeners[name];
        if (!arr || !arr.length) return;
        var copy = arr.slice(); // a listener may unsubscribe itself
        for (var i = 0; i < copy.length; i++) {
          try {
            copy[i](payload);
          } catch (e) {
            if (global.console && console.warn) {
              console.warn('[VihuPlanet] listener for "' + name + '" threw', e);
            }
          }
        }
      },

      clear: function () { listeners = {}; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
