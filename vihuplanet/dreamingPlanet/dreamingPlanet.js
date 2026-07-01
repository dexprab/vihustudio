// dreamingPlanet.js — Chapter 2 · Dreaming Planet registry.
//
// A single Dreaming Planet exists per universe (VihuPlanet canon).
// Register it via DreamingPlanet.register({...}) — same shape as
// WorldObject / Planet so the mental model is consistent.
//
// Descriptor:
//   id           — stable identifier ('dreaming' is the canonical id)
//   asset        — SVG file (contains the sphere + sleeping companion)
//   placement    — position + size in the sky
//   motion       — the sphere's Living breathing motion
//   companion    — { name?, dialogue: { intro, question, yes,
//                                       already, later } }
//   state        — initial state (defaults to 'sleeping')

(function (global) {
  'use strict';

  var _entry = null;

  function register(d) {
    if (!d || !d.id) return false;
    _entry = d;
    return true;
  }
  function get() { return _entry; }

  var DreamingPlanet = { register: register, get: get };
  try { global.DreamingPlanet = DreamingPlanet; } catch (e) {}
})(typeof window !== 'undefined' ? window : this);


// The Dreaming Planet's own descriptor.
(function () {
  'use strict';
  if (typeof DreamingPlanet === 'undefined') return;

  DreamingPlanet.register({
    id:        'dreaming',
    asset:     'assets/planets/dreaming.svg',
    placement: { top: '20vh', right: '4vw', width: '190px', height: '210px' },
    motion:    { category: 'Living', name: 'breathing', duration: '8s' },
    state:     'sleeping',
    companion: {
      // The companion has no name yet — the child names them in a
      // future chapter. For now the dialogue lines are the only
      // words the child sees from them.
      dialogue: {
        intro:    'I’ve been dreaming of meeting my storyteller…',
        question: 'Would you be my storyteller?',
        yes:      { headline: 'Really?', line: 'Then let’s get to know each other.' },
        already:  { headline: 'Wonderful!', line: 'Let’s find your way home.' },
        later:    { headline: 'That’s alright.', line: 'I’ll keep dreaming until you’re ready.' }
      }
    }
  });
})();
