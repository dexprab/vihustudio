// scene.js — VihuPlanet scene bootstrap.
//
// Chapter 1 responsibilities:
//   1. WorldObject.mount(): fetch every registered SVG and inject it
//      into the correct layer (.sky / .ground / .foreground).
//   2. armMotion(): attach the motion-name class from
//      animations/motion.css onto each mounted object.
//
// Chapter 2 additions:
//   3. mountStorytellerPlanets(): PlanetsManager paints the four
//      floating storyteller planets into .foreground.
//   4. mountDreamingPlanet(): DreamingPlanetManager paints the
//      Dreaming Planet + dialogue + choice buttons.
//
// MEP-01 addition:
//   5. mountSky(): if world-library/skies/ has artwork, layers it
//      over the existing painted sky gradient. Does nothing at all
//      when the library is empty — the gradient is the fallback and
//      is never removed from the DOM.
//
// Sprint H4-H6 addition:
//   6. armLensGlint(): picks one random 20-35s duration per page
//      load for the telescope's lens-glint (css/scene.css) — see
//      that file for why a CSS keyframe alone can't be "random".

(function () {
  'use strict';

  function mountSky() {
    if (typeof WorldLibrary === 'undefined') return;
    var sky = document.querySelector('.sky');
    if (!sky) return;
    WorldLibrary.resolve('sky').then(function (url) {
      if (!url) return; // no art yet — existing gradient stands as-is
      var layer = document.createElement('div');
      layer.className = 'watercolor-sky-image';
      layer.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      sky.appendChild(layer);
    }).catch(function () {});
  }

  function armMotion() {
    document.querySelectorAll('.world-object').forEach(function (wrap) {
      var motionName = wrap.dataset.motionName;
      if (motionName) wrap.classList.add(motionName);
      var motionCategory = wrap.dataset.motionCategory;
      if (motionCategory) wrap.classList.add('motion-category-' + motionCategory.toLowerCase());
    });
  }

  // Sprint H4-H6 Part 3 — "every 20-35 seconds, random timing" for
  // the telescope's lens glint. A single fixed CSS duration can't be
  // "random"; picking one real number per page load (no
  // sessionStorage — unlike asset selection, a timing detail
  // reloading differently isn't jarring) is what makes it so.
  function armLensGlint() {
    var telescope = document.querySelector('.world-object[data-object-id="telescope"]');
    if (!telescope) return;
    var seconds = 20 + Math.random() * 15; // 20-35s
    telescope.style.setProperty('--vp-lens-glint-duration', seconds.toFixed(2) + 's');
  }

  function mountStorytellerPlanets(delayMs) {
    var host = document.querySelector('[data-planets-host]');
    if (!host || typeof PlanetsManager === 'undefined') return;
    window.setTimeout(function () { PlanetsManager.mount(host); }, delayMs);
  }

  function mountDreamingPlanet(delayMs) {
    var host = document.querySelector('[data-dreaming-planet-host]');
    if (!host || typeof DreamingPlanetManager === 'undefined') return;
    window.setTimeout(function () { DreamingPlanetManager.mount(host); }, delayMs);
  }

  function boot() {
    var world = document.querySelector('.world');
    if (!world) return;

    mountSky();

    if (typeof WorldObject === 'undefined') {
      mountStorytellerPlanets(3400);
      mountDreamingPlanet(3800);
      return;
    }

    WorldObject.mount(world).then(function () {
      armMotion();
      armLensGlint();
      // Planets settle in first, then the Dreaming Planet arrives
      // ~0.4s after them so the eye naturally travels: familiar
      // planets → the mystery.
      mountStorytellerPlanets(3400);
      mountDreamingPlanet(3800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
