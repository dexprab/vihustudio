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
  // Placement notes (Art Direction v1.0): planets are landmasses,
  // not spheres. Each carries visible geography + an inhabitant
  // going about their day. Composition targets ~55 % negative
  // space (B's air over C's density). Planets vary in size so the
  // frame reads with depth: closer ones larger, farther ones
  // smaller and more transparent (see planets.css for the
  // atmospheric-opacity ramp).
  Planet.register({
    id:       'vihaan',
    name:     'Vihaan',
    teaser:   'The dragon finally learned to fly.',
    asset:    'assets/planets/vihaan.svg',
    placement:{ top: '18vh', left: '5vw', width: '150px' },
    depth:    'midground',
    motion:   { category: 'Living', name: 'planet-drift', duration: '28s', delay: '-4s' }
  });

  Planet.register({
    id:       'aarav',
    name:     'Aarav',
    teaser:   'The little star who loved to dance.',
    asset:    'assets/planets/aarav.svg',
    placement:{ top: '4vh',  left: '38vw', width: '115px' },
    depth:    'background',
    motion:   { category: 'Living', name: 'planet-drift', duration: '32s', delay: '-11s' }
  });

  Planet.register({
    id:       'meera',
    name:     'Meera',
    teaser:   'The fox who painted the sky.',
    asset:    'assets/planets/meera.svg',
    placement:{ top: '44vh', left: '14vw', width: '135px' },
    depth:    'midground',
    motion:   { category: 'Living', name: 'planet-drift', duration: '30s', delay: '-16s' }
  });

  Planet.register({
    id:       'emma',
    name:     'Emma',
    teaser:   'The penguin who found her song.',
    asset:    'assets/planets/emma.svg',
    placement:{ top: '44vh', left: '54vw', width: '120px' },
    depth:    'midground',
    motion:   { category: 'Living', name: 'planet-drift', duration: '34s', delay: '-8s' }
  });
})();
