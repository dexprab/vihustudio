// registry.js — Chapter 1 World Object registry.
//
// One entry per object that lives in the world today. Each entry
// declares WHERE the object sits, HOW it moves, and WHETHER it
// responds to input. The scene bootstrap (js/scene.js) walks the
// list and mounts each object without any HTML changes. Adding a
// landmark in a future chapter is one more descriptor here.
//
// Motion categories map 1:1 with animations/motion.css:
//   Living      → twinkle / drift / float / breathe
//   Greeting    → drawn-in / warm-in / settle
//   Journey     → glide / sail / drift-long
//   Celebration → (empty in Chapter 1)

(function () {
  'use strict';
  if (typeof WorldObject === 'undefined') return;

  // === Ground shape ==================================================
  // Rolling hills span the entire ground layer.
  WorldObject.register({
    id: 'hills',
    label: 'Rolling hills',
    assetHref: 'assets/objects/hills.svg',
    layer: 'ground',
    placement: {
      left: '0', right: '0', top: '0', bottom: '0',
      width: '100%', height: '100%'
    }
    // No motion — the hills are the world's stillness.
  });

  // === Sky landmarks ==================================================

  // Moon — big, warm, top-left. Breathes gently.
  WorldObject.register({
    id: 'moon',
    label: 'Moon',
    assetHref: 'assets/objects/moon.svg',
    layer: 'sky',
    placement: { top: '4vh', left: '5vw', width: '180px', height: '180px' },
    motion: { category: 'Living', name: 'breathe', duration: '6.4s', delay: '0.2s' }
  });

  // Stars — hand-authored positions so the constellation feels
  // intentional. Warm amber four-point sparkles per the Contract.
  var stars = [
    { id: 'star-1', top:  '6vh', left: '32vw', size: '28px', duration: '4.6s', delay: '0.0s' },
    { id: 'star-2', top: '15vh', left: '40vw', size: '22px', duration: '5.0s', delay: '1.1s' },
    { id: 'star-3', top:  '8vh', left: '48vw', size: '24px', duration: '4.3s', delay: '2.0s' },
    { id: 'star-4', top: '20vh', left: '58vw', size: '26px', duration: '5.4s', delay: '0.4s' },
    { id: 'star-5', top:  '4vh', left: '64vw', size: '22px', duration: '4.8s', delay: '2.4s' },
    { id: 'star-6', top: '10vh', left: '76vw', size: '26px', duration: '5.1s', delay: '1.4s' },
    { id: 'star-7', top: '28vh', left: '44vw', size: '20px', duration: '5.7s', delay: '2.7s' },
    { id: 'star-8', top: '34vh', left: '20vw', size: '24px', duration: '4.4s', delay: '0.6s' },
    { id: 'star-9', top: '30vh', left: '87vw', size: '22px', duration: '5.3s', delay: '1.9s' }
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

  // Clouds — four cottony puffs across the sky at different heights.
  var clouds = [
    { id: 'cloud-1', top:  '9vh', left: '15vw', width: '150px', duration: '24s', delay:   '0s' },
    { id: 'cloud-2', top: '22vh', left: '54vw', width: '190px', duration: '28s', delay:  '-6s' },
    { id: 'cloud-3', top: '12vh', left: '82vw', width: '140px', duration: '26s', delay: '-12s' },
    { id: 'cloud-4', top: '32vh', left: '30vw', width: '160px', duration: '25s', delay:  '-8s' }
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

  // Rocket — Journey object. Contract cadence 18–22s left→right glide,
  // slight upward tilt. Negative delay puts it partway across at
  // load so it lands in a natural sky spot on the first frame.
  WorldObject.register({
    id: 'rocket',
    label: 'Rocket',
    assetHref: 'assets/objects/rocket.svg',
    layer: 'sky',
    placement: { top: '4vh', left: '0vw', width: '72px', height: '130px' },
    motion: {
      // Rocket climbs at a steeper tilt now that the hero prompt sits
      // in the sky's middle band. The negative delay keeps it visible
      // in the top-left corner at capture time.
      category: 'Journey', name: 'glide', duration: '26s', delay: '-6s',
      params: { '--vp-glide-tilt': '-28deg', '--vp-glide-drop': '-1vh' }
    }
  });

  // Paper plane — Contract cadence 16–20s right→left sail with a
  // curly dashed trail. Negative delay places it mid-flight so the
  // first frame shows it comfortably in-scene.
  WorldObject.register({
    id: 'paper-plane',
    label: 'Paper plane',
    assetHref: 'assets/objects/paper-plane.svg',
    layer: 'sky',
    placement: { top: '10vh', left: '0', width: '180px', height: '82px' },
    motion: {
      // Nose points right in the SVG → glide left→right. A 20 s
      // loop with -6 s delay puts the plane around 18 vw at load
      // and gently sails it toward the top-right; the plane stays
      // in view for the whole capture window.
      category: 'Journey', name: 'glide', duration: '20s', delay: '-6s',
      params: { '--vp-glide-tilt': '-8deg', '--vp-glide-drop': '3vh' }
    }
  });

  // === Ground landmarks ===============================================

  // Flowers — a scatter of daisies along the hills. Living float so
  // they gently sway.
  var flowers = [
    { id: 'flower-1', bottom:  '4vh', left:  '8vw', width: '46px', duration: '5.6s', delay: '0.4s' },
    { id: 'flower-2', bottom:  '6vh', left: '18vw', width: '38px', duration: '5.0s', delay: '1.2s' },
    { id: 'flower-3', bottom:  '3vh', left: '28vw', width: '42px', duration: '5.8s', delay: '0.8s' },
    { id: 'flower-4', bottom:  '5vh', left: '38vw', width: '40px', duration: '5.4s', delay: '2.0s' },
    { id: 'flower-5', bottom:  '3vh', left: '48vw', width: '36px', duration: '5.2s', delay: '2.6s' },
    { id: 'flower-6', bottom:  '4vh', left: '58vw', width: '42px', duration: '5.9s', delay: '1.7s' }
  ];
  flowers.forEach(function (f) {
    WorldObject.register({
      id: f.id,
      label: 'Flower',
      assetHref: 'assets/objects/flower.svg',
      layer: 'ground',
      placement: { bottom: f.bottom, left: f.left, width: f.width },
      motion: { category: 'Living', name: 'float', duration: f.duration, delay: f.delay }
    });
  });

  // Telescope — a visible **future landmark**. Non-interactive in
  // Chapter 1 (`interactive:false`); a later chapter flips it on
  // and lets the child peer through it at the stars. Positioned on
  // the right of the hills per the Visual Contract.
  WorldObject.register({
    id: 'telescope',
    label: 'Telescope (coming soon)',
    assetHref: 'assets/objects/telescope.svg',
    layer: 'ground',
    placement: { bottom: '8vh', right: '10vw', width: '130px', height: '162px' },
    motion: { category: 'Living', name: 'float', duration: '6.8s', delay: '0.8s' },
    interactive: false
  });
})();
