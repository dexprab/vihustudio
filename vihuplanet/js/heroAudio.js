// js/heroAudio.js — VihuPlanet Hero Audio (Sprint H4-H6, rewritten
// for the Hero Premium Pass — Pass 2).
//
// The Hero should sound like opening an old storybook, not a game:
// no hover sounds, no looping ambience, no background music, no
// repetitive effects. Only a meaningful click produces a sound, and
// only ever a soft, short, handcrafted one.
//
// This plays real audio FILES from assets/audio/ rather than
// synthesizing tones in the browser — the Premium Pass's own
// acceptance test ("close your eyes, click an object; if it sounds
// like software, it fails") isn't something Web Audio oscillators
// can pass. The files checked in today are placeholders (see
// assets/audio/README.md for the exact list and what each should
// eventually be) — they exist to prove the loading path end to end.
// A human sound designer drops a real recording in at the same
// filename and nothing else here has to change, the same
// replace-in-place workflow the World Library already uses for
// images.
//
// Playback only ever happens from inside a click/keydown handler (a
// user gesture), which already satisfies browsers' autoplay
// restriction — no unlock hack needed.
//
// Public API (unchanged from the synthesized version — no caller
// needed to change):
//   HeroAudio.storyWorldClick()
//   HeroAudio.telescopeClick()
//   HeroAudio.dreamingHomeClick()
// Registered but not yet wired to a trigger — no "enter a Story
// World" flow exists yet (HERO_CANON.md, Chapter 3 is unbuilt):
//   HeroAudio.transitionPageTurn()
//   HeroAudio.transitionBreeze()

(function (global) {
  'use strict';

  var BASE = 'assets/audio/';
  var VOLUME = 0.55; // spec: "no sound should draw attention" — played back attenuated

  var FILES = {
    storyWorldClick:    'story-world-click.wav',
    telescopeClick:     'telescope-click.wav',
    dreamingHomeClick:  'dreaming-home-click.wav',
    transitionPageTurn: 'transition-page-turn.wav',
    transitionBreeze:   'transition-breeze.wav'
  };

  var _cache = {};
  function _load(name) {
    if (_cache[name]) return _cache[name];
    var audio = new Audio(BASE + FILES[name]);
    audio.preload = 'auto';
    audio.volume = VOLUME;
    _cache[name] = audio;
    return audio;
  }

  // Rewinds before playing so a rapid re-click restarts the sound
  // cleanly instead of doing nothing (a single <audio> element can't
  // overlap itself, and these are one-shot acknowledgments, never
  // meant to layer). Swallows playback errors (autoplay policy edge
  // cases, missing file) — a missing click sound should never break
  // the click itself.
  function _play(name) {
    var audio = _load(name);
    try {
      audio.currentTime = 0;
      var p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  var api = {
    storyWorldClick:    function () { _play('storyWorldClick'); },
    telescopeClick:     function () { _play('telescopeClick'); },
    dreamingHomeClick:  function () { _play('dreamingHomeClick'); },
    transitionPageTurn: function () { _play('transitionPageTurn'); },
    transitionBreeze:   function () { _play('transitionBreeze'); }
  };
  try { global.HeroAudio = api; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
