// registry.js — the M0.1 World Object registry.
//
// One entry per object that lives in the world today. Each entry
// declares WHERE the object sits, HOW it moves, and WHETHER it
// responds to input. Adding a new landmark in a future sprint means
// dropping in one more descriptor here; the scene bootstrap
// (js/scene.js) walks the list and mounts each object without any
// HTML changes.
//
// Motion categories map 1:1 with animations/motion.css:
//   Living      → twinkle / drift / float / breathe
//   Greeting    → drawn-in / warm-in / settle
//   Journey     → glide / sail / drift-long
//   Celebration → (empty in M0.1)

(function () {
  'use strict';
  if (typeof WorldObject === 'undefined') return;

  // === Sky landmarks ==================================================

  WorldObject.register({
    id: 'moon',
    label: 'Moon',
    assetHref: 'assets/objects/moon.svg',
    layer: 'sky',
    placement: { top: '6vh', left: '8vw', width: '92px', height: '92px' },
    motion: { category: 'Living', name: 'breathe', duration: '6.2s', delay: '0.4s' }
  });

  // Stars — one entry per star. Sizes / positions authored by hand so
  // the constellation feels intentional rather than random.
  var stars = [
    { id: 'star-1', top:  '8vh', left: '22vw', size: '9px', duration: '3.8s', delay: '0.0s' },
    { id: 'star-2', top: '14vh', left: '36vw', size: '6px', duration: '4.5s', delay: '0.9s' },
    { id: 'star-3', top: '10vh', left: '52vw', size: '7px', duration: '5.1s', delay: '1.6s' },
    { id: 'star-4', top: '22vh', left: '63vw', size: '8px', duration: '4.2s', delay: '0.3s' },
    { id: 'star-5', top:  '6vh', left: '74vw', size: '6px', duration: '5.4s', delay: '2.1s' },
    { id: 'star-6', top: '30vh', left: '84vw', size: '7px', duration: '4.8s', delay: '1.2s' },
    { id: 'star-7', top: '34vh', left: '48vw', size: '5px', duration: '5.6s', delay: '2.4s' },
    { id: 'star-8', top: '42vh', left: '18vw', size: '6px', duration: '5.2s', delay: '0.5s' },
    { id: 'star-9', top: '46vh', left: '68vw', size: '7px', duration: '4.4s', delay: '1.8s' }
  ];
  stars.forEach(function (s) {
    WorldObject.register({
      id: s.id,
      label: 'Star',
      assetHref: 'assets/objects/star.svg',
      layer: 'sky',
      placement: { top: s.top, left: s.left, width: s.size, height: s.size },
      motion: { category: 'Living', name: 'twinkle', duration: s.duration, delay: s.delay }
    });
  });

  // Clouds — three at different heights + sizes + drift phases. Each
  // uses the Living `drift` motion (soft back-and-forth); a future
  // sprint could add a `drift-long` cloud that traverses the whole
  // sky for variety.
  var clouds = [
    { id: 'cloud-1', top: '8vh',  left: '6vw',  width: '160px', duration: '22s', delay: '0s' },
    { id: 'cloud-2', top: '26vh', left: '42vw', width: '200px', duration: '28s', delay: '-6s' },
    { id: 'cloud-3', top: '40vh', left: '66vw', width: '130px', duration: '24s', delay: '-12s' }
  ];
  clouds.forEach(function (c) {
    WorldObject.register({
      id: c.id,
      label: 'Cloud',
      assetHref: 'assets/objects/cloud.svg',
      layer: 'sky',
      placement: { top: c.top, left: c.left, width: c.width },
      motion: { category: 'Living', name: 'drift', duration: c.duration, delay: c.delay }
    });
  });

  // Rocket — Journey object. Enters from the left, glides across,
  // exits right. Slight downward drift over the traversal for a
  // natural arc.
  WorldObject.register({
    id: 'rocket',
    label: 'Rocket',
    assetHref: 'assets/objects/rocket.svg',
    layer: 'sky',
    placement: { top: '12vh', left: '-12vw', width: '72px', height: '144px' },
    motion: {
      category: 'Journey', name: 'glide', duration: '32s', delay: '-6s',
      params: { '--vp-glide-tilt': '78deg', '--vp-glide-drop': '6vh' }
    }
  });

  // Paper plane — different Journey path, faster, steeper drop.
  WorldObject.register({
    id: 'paper-plane',
    label: 'Paper plane',
    assetHref: 'assets/objects/paper-plane.svg',
    layer: 'sky',
    placement: { top: '34vh', left: '-14vw', width: '110px', height: '55px' },
    motion: {
      category: 'Journey', name: 'glide', duration: '26s', delay: '-14s',
      params: { '--vp-glide-tilt': '-6deg', '--vp-glide-drop': '10vh' }
    }
  });

  // === Ground landmarks ===============================================

  // Grass tufts — Living motion, gently sway.
  var tufts = [
    { id: 'tuft-1', left: '12vw', width: '74px' },
    { id: 'tuft-2', left: '46vw', width: '96px' },
    { id: 'tuft-3', left: '76vw', width: '62px' }
  ];
  tufts.forEach(function (t) {
    WorldObject.register({
      id: t.id,
      label: 'Grass',
      assetHref: 'assets/objects/tuft.svg',
      layer: 'ground',
      placement: { bottom: '3vh', left: t.left, width: t.width },
      motion: { category: 'Living', name: 'float', duration: '5.4s' }
    });
  });

  // Telescope — a visible **future landmark**. Non-interactive in
  // M0.1; a later sprint flips `interactive:true` and adds a click
  // handler that carries the child up to see the stars. Deliberately
  // positioned on the ground so it belongs to the world today, not
  // hidden away for later.
  WorldObject.register({
    id: 'telescope',
    label: 'Telescope (coming soon)',
    assetHref: 'assets/objects/telescope.svg',
    layer: 'ground',
    placement: { bottom: '6vh', right: '10vw', width: '112px', height: '140px' },
    motion: { category: 'Living', name: 'float', duration: '6.8s', delay: '0.8s' },
    interactive: false
  });
})();
