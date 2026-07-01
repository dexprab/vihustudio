// RecognitionService — Chapter 2 placeholder interface.
//
// A Storyteller is an Explorer who accepted a Companion's invitation
// (VihuPlanet canon). When they return to VihuPlanet, VihuPlanet
// should quietly recognise them — without an account, without a
// login, without a form. Recognition is deferred; the actual
// mechanics (Companion's First Meeting, Camera recognition,
// Constellation recognition) belong to a later chapter.
//
// This file is intentionally an interface-only placeholder per the
// sprint's Architecture Contract: "Prepare interfaces only. Do not
// implement."

(function (global) {
  'use strict';

  var RecognitionService = {
    // Ask the world quietly if it recognises the explorer.
    // → Returns a Promise<{ recognised:boolean, storytellerId?:string }>
    //   Deferred: always resolves { recognised:false } in MEP v0.3.
    identify: function () {
      return Promise.resolve({ recognised: false });
    },

    // Called by a future chapter (Companion's First Meeting) to
    // record the moment a companion + explorer bond. Deferred.
    remember: function (/* storytellerId, companionId */) { return; },

    // Called by a future chapter (Constellation / Returning Home)
    // to look up a home planet by constellation pattern. Deferred.
    findHome: function (/* constellationPattern */) {
      return Promise.resolve({ found: false });
    }
  };

  try { global.RecognitionService = RecognitionService; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
