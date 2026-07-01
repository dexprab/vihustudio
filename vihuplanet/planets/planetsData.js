// planetsData.js — Chapter 2 storyteller-planet registry.
//
// The floating planets that live in the sky. Each carries a
// storyteller name and a one-line story teaser per the Visual
// Contract's example: "The dragon finally learned to fly."
//
// The Dreaming Planet lives in its own registry
// (dreamingPlanet/dreamingPlanet.js) because its behaviour is
// distinct and singular.

(function () {
  'use strict';
  if (typeof Planet === 'undefined') return;

  // Placement notes: planets flank the hero prompt (which sits at
  // ~35–42 vh centre), stay above the horizon (60 vh), and keep a
  // ~5–8 vw margin from the edges. The Dreaming Planet (mounted by
  // its own manager) occupies the far right so the story-teasers
  // don't crowd it.
  // Placement notes: the sky is shared with Chapter 1 (moon top-
  // left, rocket + paper plane traversing, hero prompt at ~38 vh
  // centre, Dreaming Planet on the right). Storyteller planets
  // occupy the remaining free zones so nothing overlaps.
  Planet.register({
    id:       'vihaan',
    name:     'Vihaan',
    teaser:   'The dragon finally learned to fly.',
    asset:    'assets/planets/vihaan.svg',
    placement:{ top: '22vh', left: '3vw', width: '120px', height: '132px' },
    motion:   { category: 'Living', name: 'planet-drift', duration: '26s', delay: '-4s' }
  });

  Planet.register({
    id:       'aarav',
    name:     'Aarav',
    teaser:   'The little star who loved to dance.',
    asset:    'assets/planets/aarav.svg',
    placement:{ top: '5vh',  left: '32vw', width: '120px', height: '132px' },
    motion:   { category: 'Living', name: 'planet-drift', duration: '30s', delay: '-11s' }
  });

  Planet.register({
    id:       'meera',
    name:     'Meera',
    teaser:   'The fox who painted the sky.',
    asset:    'assets/planets/meera.svg',
    placement:{ top: '42vh', left: '10vw', width: '110px', height: '121px' },
    motion:   { category: 'Living', name: 'planet-drift', duration: '28s', delay: '-16s' }
  });

  Planet.register({
    id:       'emma',
    name:     'Emma',
    teaser:   'The penguin who found her song.',
    asset:    'assets/planets/emma.svg',
    placement:{ top: '44vh', left: '50vw', width: '110px', height: '121px' },
    motion:   { category: 'Living', name: 'planet-drift', duration: '32s', delay: '-8s' }
  });
})();
