// CompanionService — Chapter 2 placeholder interface.
//
// Companions choose Storytellers (canon). The service will host the
// companion's presence: dialogue, mood, memory. In MEP v0.3 the
// Dreaming Planet's companion is spoken directly by
// DreamingPlanetManager because there is exactly one; a later
// chapter promotes this to a real service so multiple companions
// (each Storyteller's Home Planet has one) can be addressed
// uniformly.
//
// Interface only. Do not implement.

(function (global) {
  'use strict';

  var CompanionService = {
    // Return the companion currently paired with the explorer, if
    // any. Deferred — MEP resolves null.
    current: function () { return null; },

    // Ask a companion to say a line. In MEP the Dreaming Planet's
    // manager handles this directly; the placeholder is here so
    // Chapter 3+ can consolidate the call site.
    say: function (/* companionId, line */) { return; },

    // Ask a companion to change mood — sleeping / awake / excited /
    // listening / dreaming.
    setMood: function (/* companionId, mood */) { return; }
  };

  try { global.CompanionService = CompanionService; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
